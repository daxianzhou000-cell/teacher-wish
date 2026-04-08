"use client";

import { getAppMeta, setAppMeta } from "@/lib/client/app-meta-store";

export type ClientStorageMode = "hybrid" | "local-first";

const STORAGE_MODE_KEY = "client-storage-mode";
const DEFAULT_STORAGE_MODE: ClientStorageMode =
  process.env.NEXT_PUBLIC_STORAGE_MODE === "hybrid" ? "hybrid" : "local-first";

function normalizeStorageMode(value: string | null | undefined): ClientStorageMode | null {
  if (value === "hybrid" || value === "local-first") {
    return value;
  }

  return null;
}

export async function getClientStorageMode(): Promise<ClientStorageMode> {
  const stored = normalizeStorageMode(await getAppMeta(STORAGE_MODE_KEY));
  return stored ?? DEFAULT_STORAGE_MODE;
}

export async function shouldUseLocalPrimaryStorage(): Promise<boolean> {
  return (await getClientStorageMode()) === "local-first";
}

export async function setClientStorageMode(mode: ClientStorageMode): Promise<void> {
  await setAppMeta(STORAGE_MODE_KEY, mode);
}
