"use client";

export const APP_DB_NAME = "class-candy-db";
export const APP_DB_VERSION = 2;
export const APP_META_STORE = "appMeta";
export const STUDENTS_STORE = "students";
export const RECORDS_STORE = "records";

function hasWindow() {
  return typeof window !== "undefined";
}

export function openAppDatabase(): Promise<IDBDatabase | null> {
  if (!hasWindow() || typeof window.indexedDB === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(APP_DB_NAME, APP_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(APP_META_STORE)) {
        const appMetaStore = database.createObjectStore(APP_META_STORE, { keyPath: "key" });
        appMetaStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      if (!database.objectStoreNames.contains(STUDENTS_STORE)) {
        const studentsStore = database.createObjectStore(STUDENTS_STORE, { keyPath: "id" });
        studentsStore.createIndex("updatedAt", "updatedAt", { unique: false });
        studentsStore.createIndex("name", "name", { unique: false });
        studentsStore.createIndex("grade", "grade", { unique: false });
        studentsStore.createIndex("subject", "subject", { unique: false });
      }

      if (!database.objectStoreNames.contains(RECORDS_STORE)) {
        const recordsStore = database.createObjectStore(RECORDS_STORE, { keyPath: "id" });
        recordsStore.createIndex("updatedAt", "updatedAt", { unique: false });
        recordsStore.createIndex("studentId", "studentId", { unique: false });
        recordsStore.createIndex("learningThreadId", "learningThreadId", { unique: false });
        recordsStore.createIndex("date", "date", { unique: false });
        recordsStore.createIndex("stage", "stage", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function readRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const database = await openAppDatabase();

  if (!database) {
    throw new Error("IndexedDB unavailable");
  }

  const transaction = database.transaction(storeName, mode);
  const store = transaction.objectStore(storeName);

  try {
    return await handler(store);
  } finally {
    database.close();
  }
}
