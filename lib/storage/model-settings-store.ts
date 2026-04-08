import { readFileSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  ApiKeySource,
  ConfigurableProviderName,
  ModelConnectionSettings,
  ModelSettings,
  PrimaryModelMode,
  ResolvedModelSettings,
} from "@/lib/types/model-settings";

const dataDir = path.join(process.cwd(), "data");
const settingsFile = path.join(dataDir, "model-settings.json");
const envLocalFile = path.join(process.cwd(), ".env.local");
const runtimeApiKeyCache: Record<
  "primary" | "backup",
  { provider: ConfigurableProviderName; apiKey: string }
> = {
  primary: { provider: "mock", apiKey: "" },
  backup: { provider: "mock", apiKey: "" },
};

const builtinPrimaryDefaults = {
  provider: "custom" as ConfigurableProviderName,
  openaiModel: "gpt-4o-mini",
  openaiBaseUrl: "https://api.openai.com/v1",
  customModel: "gpt-5.4",
  customBaseUrl: "https://api.gemai.cc/v1",
};

let modelSettingsStorageAvailable: boolean | null = null;
let memorySettings: ModelSettings | null = null;

let envLocalCache:
  | {
      mtimeMs: number;
      values: Record<string, string>;
    }
  | null = null;

function isProvider(value: unknown): value is ConfigurableProviderName {
  return value === "mock" || value === "openai" || value === "custom";
}

function readEnvLocalValues(): Record<string, string> {
  try {
    const stats = statSync(envLocalFile);

    if (envLocalCache && envLocalCache.mtimeMs === stats.mtimeMs) {
      return envLocalCache.values;
    }

    const content = readFileSync(envLocalFile, "utf-8");
    const values: Record<string, string> = {};

    for (const line of content.split("\n")) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");

      if (separatorIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      const value =
        (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'"))
          ? rawValue.slice(1, -1)
          : rawValue;

      values[key] = value;
    }

    envLocalCache = {
      mtimeMs: stats.mtimeMs,
      values,
    };

    return values;
  } catch {
    return envLocalCache?.values ?? {};
  }
}

function getRuntimeEnvValue(key: string): string {
  return (process.env[key] || readEnvLocalValues()[key] || "").trim();
}

function buildDefaultConnection(
  provider: ConfigurableProviderName,
  enabled: boolean,
): ModelConnectionSettings {
  const apiKeySource: ApiKeySource = getEnvApiKey(provider) ? "builtin" : "custom";

  if (provider === "openai") {
    return {
      provider,
      model: getRuntimeEnvValue("OPENAI_MODEL") || builtinPrimaryDefaults.openaiModel,
      baseUrl: getRuntimeEnvValue("OPENAI_BASE_URL") || builtinPrimaryDefaults.openaiBaseUrl,
      apiKey: "",
      apiKeySource,
      enabled,
    };
  }

  if (provider === "custom") {
    return {
      provider,
      model: getRuntimeEnvValue("CUSTOM_MODEL") || builtinPrimaryDefaults.customModel,
      baseUrl: getRuntimeEnvValue("CUSTOM_BASE_URL") || builtinPrimaryDefaults.customBaseUrl,
      apiKey: "",
      apiKeySource,
      enabled,
    };
  }

  return {
    provider: "mock",
    model: "",
    baseUrl: "",
    apiKey: "",
    apiKeySource: "builtin",
    enabled,
  };
}

function getEnvApiKey(provider: ConfigurableProviderName): string {
  if (provider === "openai") {
    return getRuntimeEnvValue("OPENAI_API_KEY");
  }

  if (provider === "custom") {
    return getRuntimeEnvValue("CUSTOM_API_KEY");
  }

  return "";
}

export function getBuiltinApiKey(provider: ConfigurableProviderName): string {
  return getEnvApiKey(provider);
}

function defaultSettings(): ModelSettings {
  return {
    primaryMode: "builtin",
    builtinPrimaryModel: "",
    primaryCustom: {
      provider: "custom",
      model: "",
      baseUrl: "",
      apiKey: "",
      apiKeySource: "custom",
      enabled: true,
    },
    backup: buildDefaultConnection("mock", false),
    autoFallback: true,
    updatedAt: new Date().toISOString(),
  };
}

export function getDefaultModelSettings(): ModelSettings {
  return defaultSettings();
}

export function getBuiltinPrimaryConnection(modelOverride?: string): ModelConnectionSettings {
  const envProvider = getRuntimeEnvValue("MODEL_PROVIDER");
  const primaryProvider = isProvider(envProvider) ? envProvider : builtinPrimaryDefaults.provider;
  const builtin = buildDefaultConnection(primaryProvider, true);
  const builtinApiKey = getBuiltinApiKey(primaryProvider);

  return {
    ...builtin,
    model: modelOverride?.trim() || builtin.model,
    apiKey: builtinApiKey,
    apiKeySource: "builtin",
    enabled: true,
  };
}

function normalizeConnection(
  value: unknown,
  fallback: ModelConnectionSettings,
): ModelConnectionSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fallback;
  }

  const record = value as Record<string, unknown>;
  const provider = isProvider(record.provider) ? record.provider : fallback.provider;
  const apiKeySource: ApiKeySource =
    record.apiKeySource === "builtin" || record.apiKeySource === "custom"
      ? record.apiKeySource
      : fallback.apiKeySource;

  return {
    provider,
    model: typeof record.model === "string" ? record.model.trim() : fallback.model,
    baseUrl: typeof record.baseUrl === "string" ? record.baseUrl.trim() : fallback.baseUrl,
    apiKey: typeof record.apiKey === "string" ? record.apiKey.trim() : fallback.apiKey,
    apiKeySource,
    enabled: typeof record.enabled === "boolean" ? record.enabled : fallback.enabled,
  };
}

function sanitizeConnectionForStorage(input: ModelConnectionSettings): ModelConnectionSettings {
  return {
    ...input,
    apiKey: input.apiKeySource === "custom" ? input.apiKey.trim() : "",
  };
}

function setRuntimeApiKey(
  slot: "primary" | "backup",
  provider: ConfigurableProviderName,
  apiKey: string,
) {
  runtimeApiKeyCache[slot] = {
    provider,
    apiKey: apiKey.trim(),
  };
}

function getRuntimeApiKey(
  slot: "primary" | "backup",
  provider: ConfigurableProviderName,
): string {
  const cached = runtimeApiKeyCache[slot];

  if (cached.provider !== provider) {
    return "";
  }

  return cached.apiKey;
}

export function resolveModelSettings(
  input: ModelSettings,
  options?: { includeRuntimeCache?: boolean },
): ResolvedModelSettings {
  const includeRuntimeCache = options?.includeRuntimeCache ?? true;
  const builtinPrimary = getBuiltinPrimaryConnection(input.builtinPrimaryModel);
  const primaryCustomApiKey =
    input.primaryCustom.apiKeySource === "builtin"
      ? getEnvApiKey(input.primaryCustom.provider)
      : input.primaryCustom.apiKey.trim() ||
        (includeRuntimeCache ? getRuntimeApiKey("primary", input.primaryCustom.provider) : "");
  const backupApiKey =
    input.backup.apiKeySource === "builtin"
      ? getEnvApiKey(input.backup.provider)
      : input.backup.apiKey.trim() ||
        (includeRuntimeCache ? getRuntimeApiKey("backup", input.backup.provider) : "");

  return {
    ...input,
    primary: {
      ...(input.primaryMode === "builtin" ? builtinPrimary : input.primaryCustom),
      apiKey:
        input.primaryMode === "builtin"
          ? builtinPrimary.apiKey
          : primaryCustomApiKey,
      apiKeySource:
        input.primaryMode === "builtin" ? "builtin" : input.primaryCustom.apiKeySource,
      enabled: true,
    },
    primaryCustom: {
      ...input.primaryCustom,
      apiKey: primaryCustomApiKey,
    },
    backup: {
      ...input.backup,
      apiKey: backupApiKey,
    },
  };
}

async function ensureSettingsFile(): Promise<boolean> {
  if (modelSettingsStorageAvailable === false) {
    return false;
  }

  try {
    await mkdir(dataDir, { recursive: true });

    try {
      await readFile(settingsFile, "utf-8");
    } catch {
      await writeFile(settingsFile, JSON.stringify(defaultSettings(), null, 2), "utf-8");
    }

    modelSettingsStorageAvailable = true;
    return true;
  } catch {
    modelSettingsStorageAvailable = false;
    return false;
  }
}

export async function readModelSettings(): Promise<ModelSettings> {
  const storageAvailable = await ensureSettingsFile();

  if (!storageAvailable) {
    return memorySettings ?? defaultSettings();
  }

  try {
    const content = await readFile(settingsFile, "utf-8");
    const parsed = JSON.parse(content) as Partial<ModelSettings>;
    const fallback = defaultSettings();
    const legacyPrimary = normalizeConnection(
      (parsed as Partial<Record<"primary", unknown>>).primary,
      fallback.primaryCustom,
    );
    const parsedPrimaryCustom = normalizeConnection(parsed.primaryCustom, legacyPrimary);
    const parsedBackup = normalizeConnection(parsed.backup, fallback.backup);
    const primaryMode: PrimaryModelMode =
      parsed.primaryMode === "custom" || parsed.primaryMode === "builtin"
        ? parsed.primaryMode
        : legacyPrimary.apiKeySource === "builtin"
          ? "builtin"
          : "custom";
    const hasLegacyPersistedApiKey =
      Boolean(parsedPrimaryCustom.apiKey.trim()) || Boolean(parsedBackup.apiKey.trim());

    if (parsedPrimaryCustom.apiKey.trim()) {
      setRuntimeApiKey("primary", parsedPrimaryCustom.provider, parsedPrimaryCustom.apiKey);
      if (parsedPrimaryCustom.apiKeySource !== "builtin") {
        parsedPrimaryCustom.apiKeySource = "custom";
      }
    }

    if (parsedBackup.apiKey.trim()) {
      setRuntimeApiKey("backup", parsedBackup.provider, parsedBackup.apiKey);
      if (parsedBackup.apiKeySource !== "builtin") {
        parsedBackup.apiKeySource = "custom";
      }
    }

    const normalized: ModelSettings = {
      primaryMode,
      builtinPrimaryModel:
        typeof parsed.builtinPrimaryModel === "string" ? parsed.builtinPrimaryModel.trim() : "",
      primaryCustom: sanitizeConnectionForStorage(parsedPrimaryCustom),
      backup: sanitizeConnectionForStorage(parsedBackup),
      autoFallback:
        typeof parsed.autoFallback === "boolean" ? parsed.autoFallback : fallback.autoFallback,
      updatedAt:
        typeof parsed.updatedAt === "string" && parsed.updatedAt.trim()
          ? parsed.updatedAt
          : fallback.updatedAt,
    };

    if (hasLegacyPersistedApiKey) {
      try {
        await writeFile(settingsFile, JSON.stringify(normalized, null, 2), "utf-8");
      } catch {
        modelSettingsStorageAvailable = false;
      }
    }

    memorySettings = normalized;
    return normalized;
  } catch {
    return memorySettings ?? defaultSettings();
  }
}

export async function readResolvedModelSettings(): Promise<ResolvedModelSettings> {
  const settings = await readModelSettings();
  return resolveModelSettings(settings, { includeRuntimeCache: true });
}

export async function writeModelSettings(input: ModelSettings): Promise<void> {
  setRuntimeApiKey("primary", input.primaryCustom.provider, input.primaryCustom.apiKey);
  setRuntimeApiKey("backup", input.backup.provider, input.backup.apiKey);

  const sanitized: ModelSettings = {
    ...input,
    primaryCustom: sanitizeConnectionForStorage(input.primaryCustom),
    backup: sanitizeConnectionForStorage(input.backup),
  };

  memorySettings = sanitized;

  const storageAvailable = await ensureSettingsFile();

  if (!storageAvailable) {
    return;
  }

  try {
    await writeFile(settingsFile, JSON.stringify(sanitized, null, 2), "utf-8");
  } catch {
    modelSettingsStorageAvailable = false;
  }
}

export function getBuiltinApiKeyAvailability(): Record<"openai" | "custom", boolean> {
  return {
    openai: Boolean(getEnvApiKey("openai")),
    custom: Boolean(getEnvApiKey("custom")),
  };
}

export function getModelSettingsFilePath() {
  return settingsFile;
}
