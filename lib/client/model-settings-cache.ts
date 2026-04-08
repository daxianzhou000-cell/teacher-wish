"use client";

import { getAppMeta, setAppMeta, removeAppMeta } from "@/lib/client/app-meta-store";
import type { ModelSettings } from "@/lib/types/model-settings";

const MODEL_SETTINGS_CACHE_KEY = "model-settings-cache";

function sanitizeModelSettings(input: ModelSettings): ModelSettings {
  return {
    ...input,
    primaryCustom: {
      ...input.primaryCustom,
      apiKey:
        input.primaryCustom.apiKeySource === "custom" ? input.primaryCustom.apiKey : "",
    },
    backup: {
      ...input.backup,
      apiKey: input.backup.apiKeySource === "custom" ? input.backup.apiKey : "",
    },
  };
}

export async function readCachedModelSettings(): Promise<ModelSettings | null> {
  const value = await getAppMeta(MODEL_SETTINGS_CACHE_KEY);

  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<ModelSettings>;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      primaryMode: parsed.primaryMode === "custom" ? "custom" : "builtin",
      builtinPrimaryPresetId:
        typeof parsed.builtinPrimaryPresetId === "string" && parsed.builtinPrimaryPresetId.trim()
          ? parsed.builtinPrimaryPresetId
          : typeof (parsed as Partial<Record<"builtinPrimaryProvider", unknown>>)
                .builtinPrimaryProvider === "string"
            ? String(
                (parsed as Partial<Record<"builtinPrimaryProvider", string>>)
                  .builtinPrimaryProvider,
              )
            : "builtin-custom",
      builtinPrimaryModel:
        typeof parsed.builtinPrimaryModel === "string" ? parsed.builtinPrimaryModel : "",
      primaryCustom: parsed.primaryCustom as ModelSettings["primaryCustom"],
      backup: parsed.backup as ModelSettings["backup"],
      autoFallback: typeof parsed.autoFallback === "boolean" ? parsed.autoFallback : true,
      updatedAt:
        typeof parsed.updatedAt === "string" && parsed.updatedAt.trim()
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    await removeAppMeta(MODEL_SETTINGS_CACHE_KEY);
    return null;
  }
}

export async function writeCachedModelSettings(input: ModelSettings): Promise<void> {
  await setAppMeta(MODEL_SETTINGS_CACHE_KEY, JSON.stringify(sanitizeModelSettings(input)));
}

export async function clearCachedModelSettings(): Promise<void> {
  await removeAppMeta(MODEL_SETTINGS_CACHE_KEY);
}
