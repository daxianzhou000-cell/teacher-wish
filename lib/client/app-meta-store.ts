"use client";

import { APP_META_STORE, readRequest, withStore } from "@/lib/client/local-db";

type AppMetaRecord = {
  key: string;
  value: string;
  updatedAt: string;
};

export type { AppMetaRecord };

function hasWindow() {
  return typeof window !== "undefined";
}

function getFallbackValue(key: string): string | null {
  if (!hasWindow()) {
    return null;
  }

  return window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key);
}

function clearFallbackValue(key: string) {
  if (!hasWindow()) {
    return;
  }

  window.sessionStorage.removeItem(key);
  window.localStorage.removeItem(key);
}

export async function getAppMeta(key: string): Promise<string | null> {
  if (!hasWindow()) {
    return null;
  }

  try {
    const record = await withStore(APP_META_STORE, "readonly", async (store) => {
      const result = await readRequest<AppMetaRecord | undefined>(
        store.get(key) as IDBRequest<AppMetaRecord | undefined>,
      );
      return result ?? null;
    });

    if (record?.value) {
      return record.value;
    }
  } catch {
    // fall through to storage fallback
  }

  const fallbackValue = getFallbackValue(key);

  if (fallbackValue !== null) {
    await setAppMeta(key, fallbackValue);
    clearFallbackValue(key);
  }

  return fallbackValue;
}

export async function setAppMeta(key: string, value: string): Promise<void> {
  if (!hasWindow()) {
    return;
  }

  const record: AppMetaRecord = {
    key,
    value,
    updatedAt: new Date().toISOString(),
  };

  try {
    await withStore(APP_META_STORE, "readwrite", async (store) => {
      await readRequest(store.put(record));
    });
    clearFallbackValue(key);
  } catch {
    window.localStorage.setItem(key, value);
    window.sessionStorage.removeItem(key);
  }
}

export async function removeAppMeta(key: string): Promise<void> {
  if (!hasWindow()) {
    return;
  }

  try {
    await withStore(APP_META_STORE, "readwrite", async (store) => {
      await readRequest(store.delete(key));
    });
  } catch {
    // ignore fallback failure
  }

  clearFallbackValue(key);
}

export async function listAppMetaRecords(): Promise<AppMetaRecord[]> {
  if (!hasWindow()) {
    return [];
  }

  try {
    return await withStore(APP_META_STORE, "readonly", async (store) => {
      const result = await readRequest<AppMetaRecord[]>(
        store.getAll() as IDBRequest<AppMetaRecord[]>,
      );
      return result ?? [];
    });
  } catch {
    const seen = new Set<string>();
    const records: AppMetaRecord[] = [];

    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key || seen.has(key)) {
          continue;
        }

        const value = storage.getItem(key);
        if (value === null) {
          continue;
        }

        seen.add(key);
        records.push({
          key,
          value,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return records;
  }
}
