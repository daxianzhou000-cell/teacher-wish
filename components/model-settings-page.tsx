"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  readCachedModelSettings,
  writeCachedModelSettings,
} from "@/lib/client/model-settings-cache";
import { shouldUseLocalPrimaryStorage } from "@/lib/client/storage-mode";
import type {
  ApiKeySource,
  BuiltinModelPreset,
  ConfigurableProviderName,
  ModelConnectionSettings,
  ModelSettings,
  PrimaryModelMode,
} from "@/lib/types/model-settings";

const providerOptions: Array<{ value: ConfigurableProviderName; label: string }> = [
  { value: "mock", label: "mock" },
  { value: "openai", label: "openai" },
  { value: "custom", label: "custom" },
];

const apiKeySourceOptions: Array<{ value: ApiKeySource; label: string }> = [
  { value: "builtin", label: "平台内置" },
  { value: "custom", label: "用户自配" },
];

const shellClassName =
  "rounded-[28px] border border-white/80 bg-[rgba(255,255,255,0.68)] p-5 backdrop-blur-xl shadow-[0_18px_44px_rgba(219,188,198,0.08),inset_0_1px_0_rgba(255,255,255,0.92)]";

const fieldClassName =
  "rounded-[18px] border border-white/82 bg-[rgba(255,255,255,0.76)] px-4 py-3 text-sm text-[#4F463F] outline-none transition focus:border-[#F3C4D0] focus:ring-4 focus:ring-[#FDEBF1]";

type ApiPayload = {
  data?: ModelSettings;
  error?: string;
};

type ModelsPayload = {
  data?: {
    models?: string[];
  };
  error?: string;
};

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

function validateModelSettings(
  input: ModelSettings,
  builtinPrimary: ModelConnectionSettings,
): string | null {
  const effectivePrimary = input.primaryMode === "builtin" ? builtinPrimary : input.primaryCustom;

  if (
    input.primaryMode === "builtin" &&
    builtinPrimary.provider !== "mock" &&
    (!builtinPrimary.model.trim() || !builtinPrimary.baseUrl.trim() || !builtinPrimary.apiKey.trim())
  ) {
    return "当前应用内置主模型还未配置完整，请先切换到用户自配主模型，或由部署者补齐默认主模型配置。";
  }

  if (
    input.primaryMode === "custom" &&
    effectivePrimary.enabled &&
    effectivePrimary.provider !== "mock" &&
    !effectivePrimary.model.trim()
  ) {
    return "主模型配置需要填写模型名称。";
  }

  if (
    input.primaryMode === "custom" &&
    effectivePrimary.enabled &&
    effectivePrimary.provider === "mock" &&
    (effectivePrimary.model.trim() ||
      effectivePrimary.baseUrl.trim() ||
      effectivePrimary.apiKey.trim())
  ) {
    return "你当前仍选择的是 mock。若要接真实模型，请把 Provider 改为 openai 或 custom，再填写模型名称、Base URL 和 API Key。";
  }

  if (
    input.primaryMode === "custom" &&
    effectivePrimary.enabled &&
    effectivePrimary.provider !== "mock" &&
    (!effectivePrimary.baseUrl.trim() || !effectivePrimary.apiKey.trim())
  ) {
    return "主模型配置需要填写 Base URL 和 API Key。";
  }

  if (input.backup.enabled && input.backup.provider !== "mock") {
    if (
      !input.backup.model.trim() ||
      !input.backup.baseUrl.trim() ||
      !input.backup.apiKey.trim()
    ) {
      return input.backup.apiKeySource === "builtin"
        ? "备用模型当前选择的是应用内置 Key，但这套默认备用配置还不可用。请切换为用户自配，或由部署者补齐默认配置。"
        : "备用模型已启用时，需要完整填写模型名称、Base URL 和 API Key。";
    }
  }

  return null;
}

async function fetchModelsDirectly(connection: ModelConnectionSettings): Promise<string[]> {
  if (connection.provider === "mock") {
    throw new Error("mock 模式没有可拉取的真实模型列表，请先切换到 openai 或 custom。");
  }

  const baseCandidates = buildModelListCandidates(connection.baseUrl);

  if (!baseCandidates.length) {
    throw new Error("请先填写 Base URL。");
  }

  if (!connection.apiKey.trim()) {
    throw new Error("请先填写 API Key。");
  }

  let lastError = "当前平台没有返回可用模型列表。你仍然可以直接手动填写模型名。";

  for (const candidateUrl of baseCandidates) {
    try {
      const response = await fetch(candidateUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${connection.apiKey.trim()}`,
          "Content-Type": "application/json",
        },
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
          "当前地址返回的是平台网页而不是模型接口。请确认你填写的是 API 地址。";
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
        lastError = "已请求成功，但没有解析到可用模型列表。你可以直接手动填写模型名。";
        continue;
      }

      return models;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "拉取模型列表失败。";
    }
  }

  throw new Error(lastError);
}

async function shouldUseDirectModelList(
  slotKey: "builtinPrimary" | "primaryCustom" | "backup",
  connection: ModelConnectionSettings,
): Promise<boolean> {
  if (!(await shouldUseLocalPrimaryStorage())) {
    return false;
  }

  if (slotKey === "builtinPrimary") {
    return false;
  }

  if (connection.provider === "mock") {
    return false;
  }

  if (connection.apiKeySource !== "custom") {
    return false;
  }

  return Boolean(connection.apiKey.trim() && connection.baseUrl.trim());
}

function TinyCandy() {
  return (
    <svg viewBox="0 0 90 72" className="h-auto w-[50px] rotate-[-8deg]" aria-hidden="true">
      <defs>
        <linearGradient id="modelSettingsCandyWrap" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE8EF" />
          <stop offset="50%" stopColor="#FFD980" />
          <stop offset="100%" stopColor="#D8EBFF" />
        </linearGradient>
        <linearGradient id="modelSettingsCandyCore" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFDF7" />
          <stop offset="100%" stopColor="#F5DEB4" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="#AA876A" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <path d="M15 39c-9-6-12-16-8-23 5-7 15-7 25 1-1 9-5 15-17 22Z" fill="url(#modelSettingsCandyWrap)" />
        <path d="M75 39c9-6 12-16 8-23-5-7-15-7-25 1 1 9 5 15 17 22Z" fill="url(#modelSettingsCandyWrap)" />
        <rect x="23" y="18" width="44" height="28" rx="14" fill="url(#modelSettingsCandyCore)" />
      </g>
    </svg>
  );
}

function TinyCat() {
  return (
    <svg viewBox="0 0 112 72" className="h-auto w-[64px]" aria-hidden="true">
      <defs>
        <linearGradient id="modelSettingsCatBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF8EC" />
          <stop offset="100%" stopColor="#F2DEC4" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="#8E745F" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1">
        <path
          fill="url(#modelSettingsCatBody)"
          d="M18 43c0-11 10-19 24-19h18c17 0 27 7 27 19 0 9-7 15-18 15H38c-12 0-20-5-20-15Z"
        />
      </g>
    </svg>
  );
}

function providerHint(provider: ConfigurableProviderName) {
  if (provider === "mock") {
    return "mock：本地示例，不调用真实模型。";
  }

  if (provider === "openai") {
    return "openai：官方接口，适合直连 OpenAI。";
  }

  return "custom：中转、代理或兼容 OpenAI 的平台。";
}

function SelectionCard({
  active,
  title,
  description,
  onSelect,
  children,
}: {
  active: boolean;
  title: string;
  description: string;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`${shellClassName} ${active ? "border-[#F2DFC1] bg-[rgba(255,250,234,0.78)]" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#A8927F]">
            Main Model
          </p>
          <h2 className="mt-2 text-[1.2rem] font-semibold text-[#3F3832]">{title}</h2>
          <p className="mt-2 text-sm leading-7 text-[#6D645C]">{description}</p>
        </div>
        <button
          type="button"
          onClick={onSelect}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            active
              ? "border border-[#F2DFC1] bg-[rgba(255,247,220,0.92)] text-[#6A5947]"
              : "border border-white/88 bg-white/76 text-[#6C6056]"
          }`}
        >
          {active ? "当前使用中" : "切换使用"}
        </button>
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

function EditableConnectionForm({
  value,
  onChange,
  availableModels,
  loadingModels,
  modelsError,
  onLoadModels,
  allowBuiltinKey,
  builtinApiKeyAvailability,
}: {
  value: ModelConnectionSettings;
  onChange: (next: ModelConnectionSettings) => void;
  availableModels: string[];
  loadingModels: boolean;
  modelsError: string;
  onLoadModels: () => void;
  allowBuiltinKey: boolean;
  builtinApiKeyAvailability: Record<"openai" | "custom", boolean>;
}) {
  const usesRemoteModel = value.provider !== "mock";
  const usesBuiltinApiKey = allowBuiltinKey && value.apiKeySource === "builtin";
  const builtinKeyReady =
    value.provider === "openai"
      ? builtinApiKeyAvailability.openai
      : value.provider === "custom"
        ? builtinApiKeyAvailability.custom
        : false;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
        <span>Provider</span>
        <select
          value={value.provider}
          onChange={(event) =>
            onChange({
              ...value,
              provider: event.target.value as ConfigurableProviderName,
              apiKeySource: allowBuiltinKey ? value.apiKeySource : "custom",
            })
          }
          className={fieldClassName}
        >
          {providerOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-xs font-normal leading-6 text-[#8F8275]">{providerHint(value.provider)}</p>
      </label>

      <label className="flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
        <span>模型名称</span>
        <input
          value={value.model}
          onChange={(event) => onChange({ ...value, model: event.target.value })}
          className={fieldClassName}
          placeholder={usesRemoteModel ? "可手填或拉取列表" : "mock 无需填写"}
        />
      </label>

      <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
        <span>Base URL</span>
        <input
          value={value.baseUrl}
          onChange={(event) => onChange({ ...value, baseUrl: event.target.value })}
          className={fieldClassName}
          placeholder={usesRemoteModel ? "例如：https://api.ekan8.com/v1" : "mock 模式无需填写"}
        />
      </label>

      {allowBuiltinKey ? (
        <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
          <span>Key 来源</span>
          <div className="flex flex-wrap gap-2">
            {apiKeySourceOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange({ ...value, apiKeySource: option.value })}
                disabled={!usesRemoteModel}
                className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                  value.apiKeySource === option.value
                    ? "border-[#F2DFC1] bg-[rgba(255,247,220,0.92)] text-[#6A5947]"
                    : "border-white/90 bg-[rgba(255,255,255,0.76)] text-[#7A6D62]"
                } ${!usesRemoteModel ? "cursor-not-allowed opacity-60" : ""}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {usesRemoteModel && usesBuiltinApiKey ? (
            <div
              className={`rounded-[16px] border px-4 py-3 text-xs font-medium leading-6 ${
                builtinKeyReady
                  ? "border-[#D9EAD7] bg-[rgba(244,252,243,0.88)] text-[#567454]"
                  : "border-[#F3D2CC] bg-[rgba(255,245,243,0.88)] text-[#A05F58]"
              }`}
            >
              {builtinKeyReady
                ? "应用内置 Key 已就绪"
                : "应用内置 Key 暂不可用，请先切到用户自配"}
            </div>
          ) : null}
        </label>
      ) : null}

      <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
        <span>{allowBuiltinKey ? "API Key" : "用户 API Key"}</span>
        <input
          value={value.apiKey}
          onChange={(event) => onChange({ ...value, apiKey: event.target.value, apiKeySource: "custom" })}
          className={fieldClassName}
          type="password"
          disabled={!usesRemoteModel || usesBuiltinApiKey}
          placeholder={
            !usesRemoteModel ? "mock 无需填写" : usesBuiltinApiKey ? "当前使用应用内置 Key" : "填写用户自己的 Key"
          }
        />
        <p className="text-xs font-normal leading-6 text-[#8F8275]">
          {allowBuiltinKey
            ? usesBuiltinApiKey
              ? "不会展示真实应用内置 Key。"
              : "自配 Key 会保存在当前本地环境。"
            : "这里就是用户自己配置的主模型 Key，会保存在当前本地环境。"}
        </p>
      </label>

      {usesRemoteModel ? (
        <div className="md:col-span-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onLoadModels}
            disabled={loadingModels}
            className="rounded-full border border-white/90 bg-[rgba(255,245,248,0.82)] px-4 py-2 text-xs font-semibold text-[#8A6473] transition hover:bg-[rgba(255,249,251,0.92)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingModels ? "拉取中..." : "拉取模型"}
          </button>
          {availableModels.length ? (
            <select
              value={availableModels.includes(value.model) ? value.model : ""}
              onChange={(event) => onChange({ ...value, model: event.target.value })}
              className={fieldClassName}
            >
              <option value="">从已拉取模型中选择</option>
              {availableModels.map((modelName) => (
                <option key={modelName} value={modelName}>
                  {modelName}
                </option>
              ))}
            </select>
          ) : null}
          {availableModels.length ? (
            <span className="text-xs text-[#8F8275]">已拉取 {availableModels.length} 个</span>
          ) : null}
        </div>
      ) : null}

      {modelsError ? <p className="md:col-span-2 text-sm text-[#C36C68]">{modelsError}</p> : null}
    </div>
  );
}

export function ModelSettingsPage({
  initialSettings,
  builtinPrimaryConnections,
  builtinPrimaryPresets,
  builtinApiKeyAvailability,
}: {
  initialSettings: ModelSettings;
  builtinPrimaryConnections: Partial<Record<string, ModelConnectionSettings>>;
  builtinPrimaryPresets: BuiltinModelPreset[];
  builtinApiKeyAvailability: Record<"openai" | "custom", boolean>;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [cacheReady, setCacheReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [availableModels, setAvailableModels] = useState<Record<"builtinPrimary" | "primaryCustom" | "backup", string[]>>({
    builtinPrimary: [],
    primaryCustom: [],
    backup: [],
  });
  const [loadingModels, setLoadingModels] = useState<Record<"builtinPrimary" | "primaryCustom" | "backup", boolean>>({
    builtinPrimary: false,
    primaryCustom: false,
    backup: false,
  });
  const [modelsError, setModelsError] = useState<Record<"builtinPrimary" | "primaryCustom" | "backup", string>>({
    builtinPrimary: "",
    primaryCustom: "",
    backup: "",
  });
  const activeBuiltinPrimary =
    builtinPrimaryConnections[settings.builtinPrimaryPresetId] ??
    builtinPrimaryConnections[builtinPrimaryPresets[0]?.id || ""] ?? {
      provider: "custom",
      model: "",
      baseUrl: "",
      apiKey: "",
      apiKeySource: "builtin",
      enabled: true,
    };
  const resolvedBuiltinPrimary: ModelConnectionSettings = {
    ...activeBuiltinPrimary,
    model: settings.builtinPrimaryModel.trim() || activeBuiltinPrimary.model,
  };
  const activeBuiltinPreset =
    builtinPrimaryPresets.find((preset) => preset.id === settings.builtinPrimaryPresetId) ??
    builtinPrimaryPresets[0] ??
    null;
  const effectivePrimary =
    settings.primaryMode === "builtin" ? resolvedBuiltinPrimary : settings.primaryCustom;
  const effectivePrimaryLabel =
    settings.primaryMode === "builtin" ? "应用内置主模型" : "用户自配主模型";

  useEffect(() => {
    let cancelled = false;

    void readCachedModelSettings().then((cachedSettings) => {
      if (cancelled) {
        return;
      }

      if (cachedSettings) {
        setSettings((current) => ({
          ...cachedSettings,
          builtinPrimaryPresetId: builtinPrimaryPresets.some(
            (preset) => preset.id === cachedSettings.builtinPrimaryPresetId,
          )
            ? cachedSettings.builtinPrimaryPresetId
            : current.builtinPrimaryPresetId,
        }));
      }

      setCacheReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [builtinPrimaryPresets]);

  useEffect(() => {
    if (!cacheReady) {
      return;
    }

    void writeCachedModelSettings(settings);
  }, [cacheReady, settings]);

  async function handleLoadModels(slotKey: "builtinPrimary" | "primaryCustom" | "backup") {
    const connection =
      slotKey === "builtinPrimary"
        ? resolvedBuiltinPrimary
        : slotKey === "primaryCustom"
          ? settings.primaryCustom
          : settings.backup;

    setModelsError((current) => ({ ...current, [slotKey]: "" }));
    setLoadingModels((current) => ({ ...current, [slotKey]: true }));

    try {
      if (await shouldUseDirectModelList(slotKey, connection)) {
        const models = await fetchModelsDirectly(connection);
        setAvailableModels((current) => ({ ...current, [slotKey]: models }));
        setMessage(`已直连拉取 ${models.length} 个可用模型。`);
        return;
      }

      const response = await fetch("/api/settings/model/models", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: connection.provider,
          baseUrl: connection.baseUrl,
          apiKey: connection.apiKey,
          apiKeySource: slotKey === "builtinPrimary" ? "builtin" : connection.apiKeySource,
          builtinPrimaryPresetId:
            slotKey === "builtinPrimary" ? settings.builtinPrimaryPresetId : undefined,
        }),
      });

      const payload = (await response.json()) as ModelsPayload;

      if (!response.ok || !payload.data?.models?.length) {
        throw new Error(payload.error || "没有拉取到可用模型。");
      }

      setAvailableModels((current) => ({ ...current, [slotKey]: payload.data?.models ?? [] }));
      setMessage(`已拉取 ${payload.data.models.length} 个可用模型。`);
    } catch (loadError) {
      const canTryDirect = await shouldUseDirectModelList(slotKey, connection);

      if (!canTryDirect) {
        setModelsError((current) => ({
          ...current,
          [slotKey]: loadError instanceof Error ? loadError.message : "拉取模型列表失败。",
        }));
        return;
      }

      try {
        const models = await fetchModelsDirectly(connection);
        setAvailableModels((current) => ({ ...current, [slotKey]: models }));
        setMessage(`已直连拉取 ${models.length} 个可用模型。`);
      } catch (directError) {
        setModelsError((current) => ({
          ...current,
          [slotKey]: directError instanceof Error ? directError.message : "拉取模型列表失败。",
        }));
      }
    } finally {
      setLoadingModels((current) => ({ ...current, [slotKey]: false }));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payloadToSave: ModelSettings = {
        ...settings,
        builtinPrimaryPresetId: settings.builtinPrimaryPresetId,
        builtinPrimaryModel: settings.builtinPrimaryModel.trim(),
        updatedAt: new Date().toISOString(),
        primaryCustom: {
          ...settings.primaryCustom,
          apiKeySource: "custom",
          enabled: true,
        },
      };
      const builtinPrimaryForValidation: ModelConnectionSettings = {
        ...resolvedBuiltinPrimary,
        model: payloadToSave.builtinPrimaryModel.trim() || activeBuiltinPrimary.model,
      };
      const validationError = validateModelSettings(payloadToSave, builtinPrimaryForValidation);

      if (validationError) {
        throw new Error(validationError);
      }

      const useLocalPrimary = await shouldUseLocalPrimaryStorage();

      if (useLocalPrimary) {
        setSettings(payloadToSave);
        await writeCachedModelSettings(payloadToSave);
      } else {
        const response = await fetch("/api/settings/model", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payloadToSave),
        });

        const payload = (await response.json()) as ApiPayload;

        if (!response.ok || !payload.data) {
          throw new Error(payload.error || "保存模型设置失败。");
        }

        setSettings(payload.data);
        await writeCachedModelSettings(payload.data);
      }

      setMessage(
        payloadToSave.primaryMode === "builtin"
          ? "已保存。当前默认走应用内置主模型。"
          : "已保存。当前默认走用户自配主模型，配置会继续保留。",
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "保存模型设置失败。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-8 text-[#4F463F] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="relative rounded-[26px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,249,232,0.78)_0%,rgba(255,255,255,0.72)_52%,rgba(238,246,255,0.7)_100%)] px-5 py-4 backdrop-blur-xl shadow-[0_16px_34px_rgba(219,188,198,0.08),inset_0_1px_0_rgba(255,255,255,0.92)]">
          <div className="pointer-events-none absolute -top-5 left-4">
            <TinyCandy />
          </div>
          <div className="pointer-events-none absolute -bottom-4 right-5">
            <TinyCat />
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[1.35rem] font-semibold tracking-tight text-[#3F3832]">
                  模型设置
                </h1>
                <span className="rounded-full bg-[rgba(255,255,255,0.76)] px-3 py-1.5 text-xs font-semibold text-[#8B7765]">
                  应用主模型 · 用户主模型 · 备用模型
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#6D645C]">
                现在只有三口：应用内置主模型、用户自配主模型、备用模型。
              </p>
            </div>
            <Link
              href="/settings"
              className="rounded-full border border-white/90 bg-[rgba(255,248,226,0.86)] px-5 py-3 text-sm font-semibold text-[#866F4A] transition hover:bg-[rgba(255,251,236,0.94)]"
            >
              返回设置
            </Link>
          </div>
        </section>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <section className={shellClassName}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#A8927F]">
              Active Summary
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full border border-white/88 bg-white/76 px-4 py-2 font-semibold text-[#6C6056]">
                当前主来源：{effectivePrimaryLabel}
              </span>
              <span className="rounded-full border border-white/88 bg-white/76 px-4 py-2 font-semibold text-[#6C6056]">
                应用内置平台：{activeBuiltinPreset?.label || "未配置"}
              </span>
              <span className="rounded-full border border-white/88 bg-white/76 px-4 py-2 font-semibold text-[#6C6056]">
                内置模型覆盖：{settings.builtinPrimaryModel || "未覆盖，使用默认"}
              </span>
              <span className="rounded-full border border-white/88 bg-white/76 px-4 py-2 font-semibold text-[#6C6056]">
                当前主 Provider：{effectivePrimary.provider}
              </span>
              <span className="rounded-full border border-white/88 bg-white/76 px-4 py-2 font-semibold text-[#6C6056]">
                当前主模型：{effectivePrimary.model || "未配置"}
              </span>
              <span className="rounded-full border border-white/88 bg-white/76 px-4 py-2 font-semibold text-[#6C6056]">
                备用模型：{settings.backup.enabled ? "已启用" : "未启用"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-[18px] border border-white/85 bg-[rgba(255,255,255,0.72)] px-4 py-3 text-sm leading-7 text-[#5E554D]">
                <p className="font-semibold text-[#6B5745]">当前实际生效主模型</p>
                <p className="mt-2">来源：{effectivePrimaryLabel}</p>
                <p>Provider：{effectivePrimary.provider}</p>
                <p>模型：{effectivePrimary.model || "未配置"}</p>
                <p className="break-all">Base URL：{effectivePrimary.baseUrl || "未配置"}</p>
              </div>
              <div className="rounded-[18px] border border-white/85 bg-[rgba(255,255,255,0.72)] px-4 py-3 text-sm leading-7 text-[#5E554D]">
                <p className="font-semibold text-[#6B5745]">备用模型兜底状态</p>
                <p className="mt-2">自动切换：{settings.autoFallback ? "开启" : "关闭"}</p>
                <p>启用状态：{settings.backup.enabled ? "已启用" : "未启用"}</p>
                <p>Provider：{settings.backup.provider}</p>
                <p>模型：{settings.backup.model || "未配置"}</p>
              </div>
            </div>
          </section>

          <SelectionCard
            active={settings.primaryMode === "builtin"}
            title="应用内置主模型"
            description="初始默认走这里。只要这里被选中，系统就优先使用应用默认主模型配置。"
            onSelect={() => setSettings((current) => ({ ...current, primaryMode: "builtin" }))}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[18px] border border-white/85 bg-[rgba(255,255,255,0.74)] px-4 py-3 text-sm text-[#5E554D]">
                <p className="font-semibold text-[#6B5745]">Provider</p>
                <p className="mt-2">{resolvedBuiltinPrimary.provider}</p>
              </div>
              <div className="rounded-[18px] border border-white/85 bg-[rgba(255,255,255,0.74)] px-4 py-3 text-sm text-[#5E554D]">
                <p className="font-semibold text-[#6B5745]">当前内置生效模型</p>
                <p className="mt-2">{resolvedBuiltinPrimary.model || "未配置"}</p>
              </div>
              <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                <span>应用内置平台</span>
                <select
                  value={settings.builtinPrimaryPresetId}
                  onChange={(event) => {
                    const nextPresetId = event.target.value;
                    setSettings((current) => ({
                      ...current,
                      builtinPrimaryPresetId: nextPresetId,
                    }));
                    setAvailableModels((current) => ({ ...current, builtinPrimary: [] }));
                    setModelsError((current) => ({ ...current, builtinPrimary: "" }));
                  }}
                  className={fieldClassName}
                >
                  {builtinPrimaryPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs font-normal leading-6 text-[#8F8275]">
                  切换内置平台后，会继续使用该平台对应的应用内置 Key、Provider 和默认 Base URL。
                </p>
              </label>
              <div className="md:col-span-2 rounded-[18px] border border-white/85 bg-[rgba(255,255,255,0.74)] px-4 py-3 text-sm text-[#5E554D]">
                <p className="font-semibold text-[#6B5745]">Base URL</p>
                <p className="mt-2 break-all">{resolvedBuiltinPrimary.baseUrl || "未配置"}</p>
              </div>
              <label className="md:col-span-2 flex flex-col gap-2 text-sm font-semibold text-[#6B5745]">
                <span>使用的内置模型</span>
                <input
                  value={settings.builtinPrimaryModel}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      builtinPrimaryModel: event.target.value,
                    }))
                  }
                  className={fieldClassName}
                  placeholder={activeBuiltinPrimary.model || "默认使用应用内置模型"}
                />
                <p className="text-xs font-normal leading-6 text-[#8F8275]">
                  不填就走应用默认模型；填写后，会继续沿用同一平台和内置 Key，只覆盖模型名。
                </p>
              </label>
              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleLoadModels("builtinPrimary")}
                  disabled={loadingModels.builtinPrimary}
                  className="rounded-full border border-white/90 bg-[rgba(255,245,248,0.82)] px-4 py-2 text-xs font-semibold text-[#8A6473] transition hover:bg-[rgba(255,249,251,0.92)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingModels.builtinPrimary ? "拉取中..." : "拉取内置模型"}
                </button>
                {availableModels.builtinPrimary.length ? (
                  <select
                    value={
                      availableModels.builtinPrimary.includes(settings.builtinPrimaryModel)
                        ? settings.builtinPrimaryModel
                        : ""
                    }
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        builtinPrimaryModel: event.target.value,
                      }))
                    }
                    className={fieldClassName}
                  >
                    <option value="">从已拉取模型中选择</option>
                    {availableModels.builtinPrimary.map((modelName) => (
                      <option key={modelName} value={modelName}>
                        {modelName}
                      </option>
                    ))}
                  </select>
                ) : null}
                {availableModels.builtinPrimary.length ? (
                  <span className="text-xs text-[#8F8275]">
                    已拉取 {availableModels.builtinPrimary.length} 个
                  </span>
                ) : null}
              </div>
              {modelsError.builtinPrimary ? (
                <p className="md:col-span-2 text-sm text-[#C36C68]">{modelsError.builtinPrimary}</p>
              ) : null}
            </div>
          </SelectionCard>

          <SelectionCard
            active={settings.primaryMode === "custom"}
            title="用户自配主模型"
            description="取消应用内置主模型后，就走这里。你在这里填的新配置，保存后会一直保留。"
            onSelect={() => setSettings((current) => ({ ...current, primaryMode: "custom" }))}
          >
            <EditableConnectionForm
              value={settings.primaryCustom}
              onChange={(next) => setSettings((current) => ({ ...current, primaryCustom: next }))}
              availableModels={availableModels.primaryCustom}
              loadingModels={loadingModels.primaryCustom}
              modelsError={modelsError.primaryCustom}
              onLoadModels={() => handleLoadModels("primaryCustom")}
              allowBuiltinKey={false}
              builtinApiKeyAvailability={builtinApiKeyAvailability}
            />
          </SelectionCard>

          <section className={shellClassName}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#A8927F]">
                  Backup
                </p>
                <h2 className="mt-2 text-[1.2rem] font-semibold text-[#3F3832]">备用模型</h2>
                <p className="mt-2 text-sm leading-7 text-[#6D645C]">
                  当系统主模型或用户主模型失败时，就自动走这里。
                </p>
              </div>
              <label className="flex items-center gap-2 rounded-full border border-white/88 bg-white/76 px-4 py-2 text-sm font-semibold text-[#6C6056]">
                <input
                  type="checkbox"
                  checked={settings.backup.enabled}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      backup: { ...current.backup, enabled: event.target.checked },
                    }))
                  }
                />
                启用
              </label>
            </div>

            <div className="mt-5">
              <EditableConnectionForm
                value={settings.backup}
                onChange={(next) => setSettings((current) => ({ ...current, backup: next }))}
                availableModels={availableModels.backup}
                loadingModels={loadingModels.backup}
                modelsError={modelsError.backup}
                onLoadModels={() => handleLoadModels("backup")}
                allowBuiltinKey
                builtinApiKeyAvailability={builtinApiKeyAvailability}
              />
            </div>
          </section>

          <section className={shellClassName}>
            <label className="flex items-center gap-3 text-sm font-semibold text-[#6B5745]">
              <input
                type="checkbox"
                checked={settings.autoFallback}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, autoFallback: event.target.checked }))
                }
              />
              主模型失败时自动切换到备用模型
            </label>
            <p className="mt-2 text-xs text-[#8F8275]">
              最近保存时间：{settings.updatedAt || "尚未保存"}
            </p>
          </section>

          {error ? <p className="text-sm text-[#C36C68]">{error}</p> : null}
          {message ? <p className="text-sm text-[#64806C]">{message}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full border border-white/90 bg-[rgba(255,242,194,0.82)] px-6 py-3 text-sm font-semibold text-[#645746] shadow-[0_16px_32px_rgba(240,215,150,0.16)] transition hover:bg-[rgba(255,239,186,0.9)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "保存中..." : "保存模型设置"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
