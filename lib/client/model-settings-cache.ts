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
    return JSON.parse(value) as ModelSettings;
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
