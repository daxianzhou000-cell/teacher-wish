import { NextResponse } from "next/server";

import {
  getBuiltinPrimaryConnection,
  readModelSettings,
  resolveModelSettings,
  writeModelSettings,
} from "@/lib/storage/model-settings-store";
import type {
  ApiKeySource,
  ConfigurableProviderName,
  ModelConnectionSettings,
  ModelSettings,
  PrimaryModelMode,
} from "@/lib/types/model-settings";

function isProvider(value: unknown): value is ConfigurableProviderName {
  return value === "mock" || value === "openai" || value === "custom";
}

function isApiKeySource(value: unknown): value is ApiKeySource {
  return value === "builtin" || value === "custom";
}

function parseConnection(
  value: unknown,
  fallback: ModelConnectionSettings,
): ModelConnectionSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fallback;
  }

  const record = value as Record<string, unknown>;

  return {
    provider: isProvider(record.provider) ? record.provider : fallback.provider,
    model: typeof record.model === "string" ? record.model.trim() : fallback.model,
    baseUrl: typeof record.baseUrl === "string" ? record.baseUrl.trim() : fallback.baseUrl,
    apiKey: typeof record.apiKey === "string" ? record.apiKey.trim() : fallback.apiKey,
    apiKeySource: isApiKeySource(record.apiKeySource)
      ? record.apiKeySource
      : fallback.apiKeySource,
    enabled: typeof record.enabled === "boolean" ? record.enabled : fallback.enabled,
  };
}

export async function GET() {
  const data = await readModelSettings();
  return NextResponse.json({ data });
}

export async function PATCH(request: Request) {
  try {
    const current = await readModelSettings();
    const body = (await request.json()) as Partial<ModelSettings>;
    const primaryMode: PrimaryModelMode =
      body.primaryMode === "builtin" || body.primaryMode === "custom"
        ? body.primaryMode
        : current.primaryMode;

    const next: ModelSettings = {
      primaryMode,
      builtinPrimaryModel:
        typeof body.builtinPrimaryModel === "string"
          ? body.builtinPrimaryModel.trim()
          : current.builtinPrimaryModel,
      primaryCustom: parseConnection(body.primaryCustom, current.primaryCustom),
      backup: parseConnection(body.backup, current.backup),
      autoFallback:
        typeof body.autoFallback === "boolean" ? body.autoFallback : current.autoFallback,
      updatedAt: new Date().toISOString(),
    };
    const effective = resolveModelSettings(next, { includeRuntimeCache: false });
    const builtinPrimary = getBuiltinPrimaryConnection(next.builtinPrimaryModel);

    if (
      primaryMode === "builtin" &&
      builtinPrimary.provider !== "mock" &&
      (!builtinPrimary.model.trim() || !builtinPrimary.baseUrl.trim() || !builtinPrimary.apiKey.trim())
    ) {
      return NextResponse.json(
        { error: "当前应用内置主模型还未配置完整，请先切换到用户自配主模型，或由部署者补齐默认主模型配置。" },
        { status: 400 },
      );
    }

    if (
      primaryMode === "custom" &&
      effective.primary.enabled &&
      effective.primary.provider !== "mock" &&
      !effective.primary.model.trim()
    ) {
      return NextResponse.json(
        { error: "主模型配置需要填写模型名称。" },
        { status: 400 },
      );
    }

    if (
      primaryMode === "custom" &&
      effective.primary.enabled &&
      effective.primary.provider === "mock" &&
      (effective.primary.model.trim() ||
        effective.primary.baseUrl.trim() ||
        effective.primary.apiKey.trim())
    ) {
      return NextResponse.json(
        {
          error:
            "你当前仍选择的是 mock。若要接真实模型，请把 Provider 改成 openai 或 custom，再填写模型名称、Base URL 和 API Key。",
        },
        { status: 400 },
      );
    }

    if (
      primaryMode === "custom" &&
      effective.primary.enabled &&
      effective.primary.provider !== "mock" &&
      (!effective.primary.baseUrl.trim() || !effective.primary.apiKey.trim())
    ) {
      return NextResponse.json(
        {
          error:
            effective.primary.apiKeySource === "builtin"
              ? "主模型当前选择的是应用内置 Key，但这套默认主模型还不可用。请切换为用户自配，或由部署者补齐默认配置。"
              : "主模型配置需要填写 Base URL 和 API Key。",
        },
        { status: 400 },
      );
    }

    if (effective.backup.enabled && effective.backup.provider !== "mock") {
      if (
        !effective.backup.model.trim() ||
        !effective.backup.baseUrl.trim() ||
        !effective.backup.apiKey.trim()
      ) {
        return NextResponse.json(
          {
            error:
              effective.backup.apiKeySource === "builtin"
                ? "备用模型当前选择的是应用内置 Key，但这套默认备用配置还不可用。请切换为用户自配，或由部署者补齐默认配置。"
                : "备用模型已启用时，需要完整填写模型名称、Base URL 和 API Key。",
          },
          { status: 400 },
        );
      }
    }

    await writeModelSettings(next);
    return NextResponse.json({ data: next });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存模型设置失败。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
