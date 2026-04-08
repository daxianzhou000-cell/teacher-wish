import { NextResponse } from "next/server";

import { getBuiltinApiKey } from "@/lib/storage/model-settings-store";
import type { ApiKeySource, ConfigurableProviderName } from "@/lib/types/model-settings";

function isProvider(value: unknown): value is ConfigurableProviderName {
  return value === "mock" || value === "openai" || value === "custom";
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function buildModelListCandidates(baseUrl: string): string[] {
  const normalized = normalizeBaseUrl(baseUrl);

  if (!normalized) {
    return [];
  }

  const candidates = [`${normalized}/models`];

  if (!/\/v\d+$/.test(normalized)) {
    candidates.push(`${normalized}/v1/models`);
  }

  return Array.from(new Set(candidates));
}

function extractModelIds(payload: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  const data = payload.data;
  const models = payload.models;

  if (Array.isArray(data)) {
    for (const item of data) {
      if (
        item &&
        typeof item === "object" &&
        typeof (item as { id?: unknown }).id === "string" &&
        (item as { id: string }).id.trim()
      ) {
        ids.add((item as { id: string }).id.trim());
      }
    }
  }

  if (Array.isArray(models)) {
    for (const item of models) {
      if (typeof item === "string" && item.trim()) {
        ids.add(item.trim());
        continue;
      }

      if (item && typeof item === "object") {
        const record = item as { id?: unknown; name?: unknown; model?: unknown };
        const candidates = [record.id, record.name, record.model];

        for (const candidate of candidates) {
          if (typeof candidate === "string" && candidate.trim()) {
            ids.add(candidate.trim());
            break;
          }
        }
      }
    }
  }

  return Array.from(ids).sort((left, right) => left.localeCompare(right));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      provider?: unknown;
      baseUrl?: unknown;
      apiKey?: unknown;
      apiKeySource?: unknown;
    };

    const provider = isProvider(body.provider) ? body.provider : "mock";
    const rawBaseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
    const apiKeySource: ApiKeySource =
      body.apiKeySource === "builtin" || body.apiKeySource === "custom"
        ? body.apiKeySource
        : "custom";
    const apiKey =
      apiKeySource === "builtin"
        ? getBuiltinApiKey(provider)
        : typeof body.apiKey === "string"
          ? body.apiKey.trim()
          : "";
    const candidates = buildModelListCandidates(rawBaseUrl);

    if (provider === "mock") {
      return NextResponse.json(
        { error: "mock 模式没有可拉取的真实模型列表，请先切换到 openai 或 custom。" },
        { status: 400 },
      );
    }

    if (!candidates.length) {
      return NextResponse.json({ error: "请先填写 Base URL。" }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            apiKeySource === "builtin"
              ? "当前选择的是应用内置 Key，但这套默认配置还不可用。"
              : "请先填写 API Key。",
        },
        { status: 400 },
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      let lastError =
        "当前平台没有返回可用模型列表。你仍然可以直接手动填写模型名并保存测试。";

      for (const candidateUrl of candidates) {
        const response = await fetch(candidateUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });

        const rawText = await response.text();
        const payload = ((): Record<string, unknown> => {
          try {
            return JSON.parse(rawText) as Record<string, unknown>;
          } catch {
            return {};
          }
        })();

        if (/<!doctype html>|<html/i.test(rawText)) {
          lastError =
            "当前地址返回的是平台网页而不是模型接口。请确认你填写的是 API 地址；如果这家平台不支持模型列表拉取，你也可以直接手动填写模型名。";
          continue;
        }

        if (!response.ok) {
          lastError =
            typeof (payload.error as { message?: string } | undefined)?.message === "string"
              ? (payload.error as { message?: string }).message!
              : "模型列表拉取失败，请检查 Base URL、API Key 或平台兼容性。";
          continue;
        }

        const models = extractModelIds(payload);

        if (!models.length) {
          const successFlag = payload.success;
          lastError =
            successFlag === true
              ? "接口请求成功，但这个 API Key 当前返回的是空模型列表。通常说明该 Key 没有被分配可访问模型。你可以先去平台后台查看，或直接手动填写模型名测试。"
              : "已请求成功，但没有解析到可用模型列表。该平台可能不提供标准模型列表接口，你可以直接手动填写模型名测试。";
          continue;
        }

        return NextResponse.json({ data: { models } });
      }

      return NextResponse.json({ error: lastError }, { status: 422 });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return NextResponse.json({ error: "拉取模型列表超时，请稍后重试。" }, { status: 504 });
      }

      const message =
        error instanceof Error
          ? error.message
          : "拉取模型列表失败，请检查网络或平台地址。";
      return NextResponse.json({ error: message }, { status: 500 });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "拉取模型列表失败。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
