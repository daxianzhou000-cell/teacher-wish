"use client";

import { RECORDS_STORE, STUDENTS_STORE, readRequest, withStore } from "@/lib/client/local-db";
import type {
  Student,
  StudentDetail,
  TutoringRecord,
} from "@/lib/types/student-progress";

function sortByUpdatedAtDesc<T extends { updatedAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function buildRecentTopics(records: TutoringRecord[]): string[] {
  return Array.from(new Set(records.map((record) => record.topic.trim()).filter(Boolean))).slice(0, 6);
}

async function putIfNewer<T extends { id: string; updatedAt: string }>(
  store: IDBObjectStore,
  item: T,
): Promise<void> {
  const existing = await readRequest<T | undefined>(store.get(item.id) as IDBRequest<T | undefined>);

  if (existing && existing.updatedAt.localeCompare(item.updatedAt) > 0) {
    return;
  }

  await readRequest(store.put(item));
}

export async function cacheStudents(students: Student[]): Promise<void> {
  await withStore(STUDENTS_STORE, "readwrite", async (store) => {
    for (const student of students) {
      await putIfNewer(store, student);
    }
  });
}

export async function cacheStudent(student: Student): Promise<void> {
  await withStore(STUDENTS_STORE, "readwrite", async (store) => {
    await putIfNewer(store, student);
  });
}

export async function readCachedStudents(): Promise<Student[]> {
  return withStore(STUDENTS_STORE, "readonly", async (store) => {
    const students = await readRequest<Student[]>(store.getAll() as IDBRequest<Student[]>);
    return sortByUpdatedAtDesc(students);
  });
}

export async function removeCachedStudent(studentId: string): Promise<void> {
  await withStore(STUDENTS_STORE, "readwrite", async (store) => {
    await readRequest(store.delete(studentId));
  });
}

export async function cacheRecords(records: TutoringRecord[]): Promise<void> {
  await withStore(RECORDS_STORE, "readwrite", async (store) => {
    for (const record of records) {
      await putIfNewer(store, record);
    }
  });
}

export async function readCachedRecords(): Promise<TutoringRecord[]> {
  return withStore(RECORDS_STORE, "readonly", async (store) => {
    const records = await readRequest<TutoringRecord[]>(
      store.getAll() as IDBRequest<TutoringRecord[]>,
    );
    return sortByUpdatedAtDesc(records);
  });
}

export async function cacheRecord(record: TutoringRecord): Promise<void> {
  await withStore(RECORDS_STORE, "readwrite", async (store) => {
    await putIfNewer(store, record);
  });
}

export async function removeCachedRecord(recordId: string): Promise<void> {
  await withStore(RECORDS_STORE, "readwrite", async (store) => {
    await readRequest(store.delete(recordId));
  });
}

export async function removeCachedRecordsByStudentId(studentId: string): Promise<void> {
  await withStore(RECORDS_STORE, "readwrite", async (store) => {
    const index = store.index("studentId");
    const records = await readRequest<TutoringRecord[]>(
      index.getAll(studentId) as IDBRequest<TutoringRecord[]>,
    );

    for (const record of records) {
      await readRequest(store.delete(record.id));
    }
  });
}

export async function readCachedStudentDetail(studentId: string): Promise<StudentDetail | null> {
  const [students, records] = await Promise.all([
    withStore(STUDENTS_STORE, "readonly", async (store) =>
      readRequest<Student | undefined>(store.get(studentId) as IDBRequest<Student | undefined>),
    ),
    withStore(RECORDS_STORE, "readonly", async (store) => {
      const index = store.index("studentId");
      return readRequest<TutoringRecord[]>(
        index.getAll(studentId) as IDBRequest<TutoringRecord[]>,
      );
    }),
  ]);

  if (!students) {
    return null;
  }

  const sortedRecords = sortByUpdatedAtDesc(records);

  return {
    student: students,
    records: sortedRecords,
    recentTopics: buildRecentTopics(sortedRecords),
  };
}
