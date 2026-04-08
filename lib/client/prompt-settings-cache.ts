"use client";

import { getAppMeta, removeAppMeta, setAppMeta } from "@/lib/client/app-meta-store";
import type { PromptSettings } from "@/lib/types/prompt-settings";

const PROMPT_SETTINGS_CACHE_KEY = "prompt-settings-cache";

export async function readCachedPromptSettings(): Promise<PromptSettings | null> {
  const value = await getAppMeta(PROMPT_SETTINGS_CACHE_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as PromptSettings;
  } catch {
    await removeAppMeta(PROMPT_SETTINGS_CACHE_KEY);
    return null;
  }
}

export async function writeCachedPromptSettings(input: PromptSettings): Promise<void> {
  await setAppMeta(PROMPT_SETTINGS_CACHE_KEY, JSON.stringify(input));
}

export async function clearCachedPromptSettings(): Promise<void> {
  await removeAppMeta(PROMPT_SETTINGS_CACHE_KEY);
}
