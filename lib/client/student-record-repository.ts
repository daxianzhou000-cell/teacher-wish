"use client";

import { getAppMeta, setAppMeta } from "@/lib/client/app-meta-store";
import {
  cacheRecord,
  cacheRecords,
  cacheStudent,
  cacheStudents,
  readCachedStudentDetail,
  readCachedRecords,
  readCachedStudents,
  removeCachedRecord,
  removeCachedRecordsByStudentId,
  removeCachedStudent,
} from "@/lib/client/student-record-cache";
import { shouldUseLocalPrimaryStorage } from "@/lib/client/storage-mode";
import { buildNextStepSuggestion } from "@/lib/services/next-step-suggestion";
import type { GenerateRequest, LessonPackage } from "@/lib/types/lesson-package";
import type {
  MasteryLevel,
  Student,
  StudentDetail,
  TutoringRecord,
} from "@/lib/types/student-progress";

type ErrorPayload = {
  error?: string;
};

type LibraryData = {
  students: Student[];
  records: TutoringRecord[];
};

const LOCAL_PRIMARY_STUDENT_RECORDS_SEEDED_KEY = "local-primary-student-records-seeded";

function shouldFallbackToLocal(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "TypeError" ||
    /Failed to fetch|NetworkError|Load failed/i.test(error.message)
  );
}

function nowIso() {
  return new Date().toISOString();
}

function getLatestUpdatedAt(items: Array<{ updatedAt: string }>): string {
  return items
    .map((item) => item.updatedAt)
    .sort((left, right) => right.localeCompare(left))[0] ?? "";
}

function normalizeMasteryLevel(value: MasteryLevel | "" | null | undefined): MasteryLevel | null {
  if (
    value === "未掌握" ||
    value === "一般" ||
    value === "基本掌握" ||
    value === "熟练"
  ) {
    return value;
  }

  return null;
}

function getStudentById(students: Student[], studentId: string) {
  return students.find((student) => student.id === studentId) ?? null;
}

function findThreadTail(records: TutoringRecord[], learningThreadId: string): TutoringRecord | null {
  const threadRecords = records
    .filter((record) => record.learningThreadId === learningThreadId)
    .sort((a, b) => {
      const createdCompare = a.createdAt.localeCompare(b.createdAt);
      if (createdCompare !== 0) {
        return createdCompare;
      }

      return a.updatedAt.localeCompare(b.updatedAt);
    });

  return threadRecords.at(-1) ?? null;
}

function buildRecentTopics(records: TutoringRecord[]): string[] {
  return Array.from(new Set(records.map((record) => record.topic.trim()).filter(Boolean))).slice(0, 6);
}

function isStudentCollectionNewer(cachedStudents: Student[], initialStudents: Student[]): boolean {
  return getLatestUpdatedAt(cachedStudents).localeCompare(getLatestUpdatedAt(initialStudents)) > 0;
}

function isLibraryDataNewer(cached: LibraryData, initial: LibraryData): boolean {
  return (
    getLatestUpdatedAt(cached.students).localeCompare(getLatestUpdatedAt(initial.students)) > 0 ||
    getLatestUpdatedAt(cached.records).localeCompare(getLatestUpdatedAt(initial.records)) > 0
  );
}

function isStudentDetailNewer(cached: StudentDetail, initial: StudentDetail): boolean {
  const cachedLatest = getLatestUpdatedAt([cached.student, ...cached.records]);
  const initialLatest = getLatestUpdatedAt([initial.student, ...initial.records]);
  return cachedLatest.localeCompare(initialLatest) > 0;
}

async function isLocalPrimarySeeded(): Promise<boolean> {
  return (await getAppMeta(LOCAL_PRIMARY_STUDENT_RECORDS_SEEDED_KEY)) === "1";
}

async function markLocalPrimarySeeded(): Promise<void> {
  await setAppMeta(LOCAL_PRIMARY_STUDENT_RECORDS_SEEDED_KEY, "1");
}

export async function readPreferredStudents(initialStudents: Student[]): Promise<Student[]> {
  if (await shouldUseLocalPrimaryStorage()) {
    const seeded = await isLocalPrimarySeeded();
    const cachedStudents = await readCachedStudents();

    if (!seeded) {
      await cacheStudents(initialStudents);
      await markLocalPrimarySeeded();
      return readCachedStudents();
    }

    return cachedStudents;
  }

  await cacheStudents(initialStudents);

  const cachedStudents = await readCachedStudents();
  if (!cachedStudents.length) {
    return initialStudents;
  }

  return isStudentCollectionNewer(cachedStudents, initialStudents) ? cachedStudents : initialStudents;
}

export async function readPreferredStudentDetail(
  initialDetail: StudentDetail,
): Promise<StudentDetail> {
  if (await shouldUseLocalPrimaryStorage()) {
    const seeded = await isLocalPrimarySeeded();
    const cachedDetail = await readCachedStudentDetail(initialDetail.student.id);

    if (!seeded) {
      await Promise.all([
        cacheStudent(initialDetail.student),
        cacheRecords(initialDetail.records),
      ]);
      await markLocalPrimarySeeded();
      return (await readCachedStudentDetail(initialDetail.student.id)) ?? initialDetail;
    }

    if (cachedDetail) {
      return cachedDetail;
    }

    const cachedStudent =
      (await readCachedStudents()).find((student) => student.id === initialDetail.student.id) ?? null;

    return buildStudentDetailFromState(cachedStudent ?? initialDetail.student, []);
  }

  await Promise.all([
    cacheStudent(initialDetail.student),
    cacheRecords(initialDetail.records),
  ]);

  const cachedDetail = await readCachedStudentDetail(initialDetail.student.id);
  if (!cachedDetail) {
    return initialDetail;
  }

  return isStudentDetailNewer(cachedDetail, initialDetail) ? cachedDetail : initialDetail;
}

export async function readPreferredLibraryData(initial: LibraryData): Promise<LibraryData> {
  if (await shouldUseLocalPrimaryStorage()) {
    const seeded = await isLocalPrimarySeeded();

    if (!seeded) {
      await Promise.all([
        cacheStudents(initial.students),
        cacheRecords(initial.records),
      ]);
      await markLocalPrimarySeeded();
    }

    const [cachedStudents, cachedRecords] = await Promise.all([
      readCachedStudents(),
      readCachedRecords(),
    ]);

    return {
      students: cachedStudents,
      records: cachedRecords,
    };
  }

  await Promise.all([
    cacheStudents(initial.students),
    cacheRecords(initial.records),
  ]);

  const [cachedStudents, cachedRecords] = await Promise.all([readCachedStudents(), readCachedRecords()]);
  const cached: LibraryData = {
    students: cachedStudents,
    records: cachedRecords,
  };

  if (!cachedStudents.length && !cachedRecords.length) {
    return initial;
  }

  return isLibraryDataNewer(cached, initial) ? cached : initial;
}

export function buildStudentDetailFromState(
  student: Student,
  records: TutoringRecord[],
): StudentDetail {
  return {
    student,
    records,
    recentTopics: buildRecentTopics(records),
  };
}

async function createStudentLocal(input: {
  name: string;
  grade: Student["grade"];
  subject: Student["subject"];
  note?: string;
}): Promise<Student> {
  const now = nowIso();
  const student: Student = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    grade: input.grade,
    subject: input.subject,
    note: input.note?.trim() || "",
    createdAt: now,
    updatedAt: now,
  };

  await cacheStudent(student);
  return student;
}

async function updateStudentLocal(
  studentId: string,
  input: {
    name: string;
    grade: Student["grade"];
    subject: Student["subject"];
    note?: string;
  },
): Promise<Student> {
  const students = await readCachedStudents();
  const current = getStudentById(students, studentId);

  if (!current) {
    throw new Error("学生不存在，无法更新。");
  }

  const updated: Student = {
    ...current,
    name: input.name.trim(),
    grade: input.grade,
    subject: input.subject,
    note: input.note?.trim() || "",
    updatedAt: nowIso(),
  };

  await cacheStudent(updated);
  return updated;
}

async function deleteStudentLocal(studentId: string): Promise<void> {
  await removeCachedStudent(studentId);
  await removeCachedRecordsByStudentId(studentId);
}

async function createRecordLocal(input: {
  studentId: string | null;
  date: string;
  topic: string;
  learningThreadId: string | null;
  previousRecordId: string | null;
  lessonPackage: LessonPackage;
  teacherFeedback: string;
  masteryLevel: MasteryLevel | "" | null;
  generateRequest: GenerateRequest;
}): Promise<TutoringRecord> {
  const [students, records] = await Promise.all([readCachedStudents(), readCachedRecords()]);
  const student = input.studentId ? getStudentById(students, input.studentId) : null;

  if (input.studentId && !student) {
    throw new Error("学生不存在，无法保存补课记录。");
  }

  const requestedPreviousRecord = input.previousRecordId
    ? records.find((record) => record.id === input.previousRecordId) ?? null
    : null;

  if (input.previousRecordId && !requestedPreviousRecord) {
    throw new Error("上一条学习记录不存在，无法建立连续备课链路。");
  }

  const previousRecord = requestedPreviousRecord
    ? findThreadTail(
        records,
        requestedPreviousRecord.learningThreadId || requestedPreviousRecord.id,
      ) ?? requestedPreviousRecord
    : null;

  const now = nowIso();
  const masteryLevel = normalizeMasteryLevel(input.masteryLevel);
  const record: TutoringRecord = {
    id: crypto.randomUUID(),
    studentId: input.studentId,
    date: input.date,
    topic: input.topic.trim(),
    learningThreadId:
      previousRecord?.learningThreadId || input.learningThreadId || crypto.randomUUID(),
    previousRecordId: previousRecord?.id || null,
    nextRecordId: null,
    lessonPackage: input.lessonPackage,
    teacherFeedback: input.teacherFeedback.trim(),
    masteryLevel,
    nextStepSuggestion:
      masteryLevel && input.generateRequest.studentLevel
        ? buildNextStepSuggestion({
            topic: input.topic.trim(),
            studentLevel: input.generateRequest.studentLevel,
            masteryLevel,
            teacherFeedback: input.teacherFeedback.trim(),
          })
        : "",
    stage: masteryLevel ? "feedback" : "package",
    generateRequest: input.generateRequest,
    createdAt: now,
    updatedAt: now,
  };

  if (previousRecord) {
    previousRecord.nextRecordId = record.id;
    previousRecord.updatedAt = now;
    await cacheRecord(previousRecord);
  }

  if (student) {
    await cacheStudent({
      ...student,
      updatedAt: now,
    });
  }

  await cacheRecord(record);
  return record;
}

async function updateRecordLocal(
  recordId: string,
  input: {
    date: string;
    topic: string;
    teacherFeedback: string;
    masteryLevel: MasteryLevel | "" | null;
    nextStepSuggestion?: string;
    studentId?: string | null;
  },
): Promise<TutoringRecord> {
  const [students, records] = await Promise.all([readCachedStudents(), readCachedRecords()]);
  const record = records.find((item) => item.id === recordId);

  if (!record) {
    throw new Error("补课记录不存在，无法更新。");
  }

  const previousStudentId = record.studentId;
  const nextStudentId = input.studentId === undefined ? record.studentId : input.studentId;

  if (nextStudentId) {
    const student = getStudentById(students, nextStudentId);
    if (!student) {
      throw new Error("学生不存在，无法绑定资料包。");
    }
  }

  const masteryLevel = normalizeMasteryLevel(input.masteryLevel);
  const updatedAt = nowIso();
  const updatedRecord: TutoringRecord = {
    ...record,
    date: input.date,
    topic: input.topic.trim(),
    teacherFeedback: input.teacherFeedback.trim(),
    masteryLevel,
    nextStepSuggestion:
      input.nextStepSuggestion !== undefined
        ? input.nextStepSuggestion.trim()
        : masteryLevel
          ? buildNextStepSuggestion({
              topic: input.topic.trim(),
              studentLevel: record.generateRequest.studentLevel,
              masteryLevel,
              teacherFeedback: input.teacherFeedback.trim(),
            })
          : "",
    studentId: input.studentId === undefined ? record.studentId : input.studentId,
    stage: masteryLevel ? "feedback" : "package",
    updatedAt,
  };

  await cacheRecord(updatedRecord);

  if (previousStudentId && previousStudentId !== nextStudentId) {
    const previousStudent = getStudentById(students, previousStudentId);
    if (previousStudent) {
      await cacheStudent({
        ...previousStudent,
        updatedAt,
      });
    }
  }

  if (nextStudentId) {
    const nextStudent = getStudentById(students, nextStudentId);
    if (nextStudent) {
      await cacheStudent({
        ...nextStudent,
        updatedAt,
      });
    }
  }

  return updatedRecord;
}

async function deleteRecordLocal(recordId: string): Promise<void> {
  const [students, records] = await Promise.all([readCachedStudents(), readCachedRecords()]);
  const record = records.find((item) => item.id === recordId);

  if (!record) {
    throw new Error("补课记录不存在，无法删除。");
  }

  const previousRecord = record.previousRecordId
    ? records.find((item) => item.id === record.previousRecordId) ?? null
    : null;
  const nextRecord = record.nextRecordId
    ? records.find((item) => item.id === record.nextRecordId) ?? null
    : null;
  const updatedAt = nowIso();

  if (previousRecord) {
    await cacheRecord({
      ...previousRecord,
      nextRecordId: nextRecord?.id ?? null,
      updatedAt,
    });
  }

  if (nextRecord) {
    await cacheRecord({
      ...nextRecord,
      previousRecordId: previousRecord?.id ?? null,
      updatedAt,
    });
  }

  if (record.studentId) {
    const student = getStudentById(students, record.studentId);
    if (student) {
      await cacheStudent({
        ...student,
        updatedAt,
      });
    }
  }

  await removeCachedRecord(recordId);
}

export async function createStudentViaApi(input: {
  name: string;
  grade: Student["grade"];
  subject: Student["subject"];
  note?: string;
}): Promise<Student> {
  if (await shouldUseLocalPrimaryStorage()) {
    return createStudentLocal(input);
  }

  try {
    const response = await fetch("/api/students", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    const payload = (await response.json()) as { data?: Student } & ErrorPayload;

    if (!response.ok || !payload.data) {
      throw new Error(payload.error || "新增学生失败。");
    }

    await cacheStudent(payload.data);
    return payload.data;
  } catch (error) {
    if (shouldFallbackToLocal(error)) {
      return createStudentLocal(input);
    }

    throw error;
  }
}

export async function updateStudentViaApi(
  studentId: string,
  input: {
    name: string;
    grade: Student["grade"];
    subject: Student["subject"];
    note?: string;
  },
): Promise<Student> {
  if (await shouldUseLocalPrimaryStorage()) {
    return updateStudentLocal(studentId, input);
  }

  try {
    const response = await fetch(`/api/students/${studentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    const payload = (await response.json()) as { data?: Student } & ErrorPayload;

    if (!response.ok || !payload.data) {
      throw new Error(payload.error || "更新学生失败。");
    }

    await cacheStudent(payload.data);
    return payload.data;
  } catch (error) {
    if (shouldFallbackToLocal(error)) {
      return updateStudentLocal(studentId, input);
    }

    throw error;
  }
}

export async function deleteStudentViaApi(studentId: string): Promise<void> {
  if (await shouldUseLocalPrimaryStorage()) {
    await deleteStudentLocal(studentId);
    return;
  }

  try {
    const response = await fetch(`/api/students/${studentId}`, {
      method: "DELETE",
    });

    const payload = (await response.json()) as ErrorPayload;

    if (!response.ok) {
      throw new Error(payload.error || "删除学生失败。");
    }

    await removeCachedStudent(studentId);
    await removeCachedRecordsByStudentId(studentId);
  } catch (error) {
    if (shouldFallbackToLocal(error)) {
      await deleteStudentLocal(studentId);
      return;
    }

    throw error;
  }
}

export async function createRecordViaApi(input: {
  studentId: string | null;
  date: string;
  topic: string;
  learningThreadId: string | null;
  previousRecordId: string | null;
  lessonPackage: LessonPackage;
  teacherFeedback: string;
  masteryLevel: MasteryLevel | "" | null;
  generateRequest: GenerateRequest;
}): Promise<TutoringRecord> {
  if (await shouldUseLocalPrimaryStorage()) {
    return createRecordLocal(input);
  }

  try {
    const response = await fetch("/api/records", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    const payload = (await response.json()) as { data?: TutoringRecord } & ErrorPayload;

    if (!response.ok || !payload.data) {
      throw new Error(payload.error || "保存补课记录失败。");
    }

    await cacheRecord(payload.data);
    return payload.data;
  } catch (error) {
    if (shouldFallbackToLocal(error)) {
      return createRecordLocal(input);
    }

    throw error;
  }
}

export async function updateRecordViaApi(
  recordId: string,
  input: {
    date: string;
    topic: string;
    teacherFeedback: string;
    masteryLevel: MasteryLevel | "" | null;
    nextStepSuggestion?: string;
    studentId?: string | null;
  },
): Promise<TutoringRecord> {
  if (await shouldUseLocalPrimaryStorage()) {
    return updateRecordLocal(recordId, input);
  }

  try {
    const response = await fetch(`/api/records/${recordId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    const payload = (await response.json()) as { data?: TutoringRecord } & ErrorPayload;

    if (!response.ok || !payload.data) {
      throw new Error(payload.error || "更新补课记录失败。");
    }

    await cacheRecord(payload.data);
    return payload.data;
  } catch (error) {
    if (shouldFallbackToLocal(error)) {
      return updateRecordLocal(recordId, input);
    }

    throw error;
  }
}

export async function deleteRecordViaApi(recordId: string): Promise<void> {
  if (await shouldUseLocalPrimaryStorage()) {
    await deleteRecordLocal(recordId);
    return;
  }

  try {
    const response = await fetch(`/api/records/${recordId}`, {
      method: "DELETE",
    });

    const payload = (await response.json()) as ErrorPayload;

    if (!response.ok) {
      throw new Error(payload.error || "删除补课记录失败。");
    }

    await removeCachedRecord(recordId);
  } catch (error) {
    if (shouldFallbackToLocal(error)) {
      await deleteRecordLocal(recordId);
      return;
    }

    throw error;
  }
}
