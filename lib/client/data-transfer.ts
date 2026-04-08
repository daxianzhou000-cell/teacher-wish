"use client";

import { parseCreateRecordInput, parseCreateStudentInput } from "@/lib/domain/student-progress-input";
import {
  listAppMetaRecords,
  setAppMeta,
  type AppMetaRecord,
} from "@/lib/client/app-meta-store";
import {
  cacheRecords,
  cacheStudents,
  readCachedRecords,
  readCachedStudents,
  removeCachedRecord,
  removeCachedStudent,
} from "@/lib/client/student-record-cache";
import type { Student, TutoringRecord } from "@/lib/types/student-progress";

const LOCAL_PRIMARY_STUDENT_RECORDS_SEEDED_KEY = "local-primary-student-records-seeded";
const LAST_BACKUP_AT_KEY = "local-data-last-backup-at";
const BACKUP_META_KEYS = new Set([
  "client-storage-mode",
  "class-candy-entry-complete",
  "lesson-package-active-job",
  "lesson-package-active-form",
  "lesson-package-draft",
  "student-detail-active-stage-test-job",
  "model-settings-cache",
  LOCAL_PRIMARY_STUDENT_RECORDS_SEEDED_KEY,
  LAST_BACKUP_AT_KEY,
]);
const BACKUP_META_PREFIXES = ["generation-job-cache:"];

export type LocalBackupPayload = {
  version: 1;
  exportedAt: string;
  students: Student[];
  records: TutoringRecord[];
  appMeta?: AppMetaRecord[];
};

export type LocalImportSummary = {
  students: Student[];
  records: TutoringRecord[];
  mode: "replace-all" | "merge";
  label: string;
  appMeta?: AppMetaRecord[];
};

type CsvRow = string[];

const STUDENT_CSV_HEADERS = [
  "id",
  "name",
  "grade",
  "subject",
  "note",
  "createdAt",
  "updatedAt",
] as const;

const RECORD_CSV_HEADERS = [
  "id",
  "studentId",
  "date",
  "topic",
  "learningThreadId",
  "previousRecordId",
  "nextRecordId",
  "teacherFeedback",
  "masteryLevel",
  "nextStepSuggestion",
  "stage",
  "createdAt",
  "updatedAt",
  "lessonPackageJson",
  "generateRequestJson",
] as const;

function nowIso() {
  return new Date().toISOString();
}

function shouldBackupAppMetaKey(key: string): boolean {
  if (BACKUP_META_KEYS.has(key)) {
    return true;
  }

  return BACKUP_META_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }

  return value;
}

function buildCsv(headers: readonly string[], rows: CsvRow[]): string {
  return [headers.join(","), ...rows.map((row) => row.map(escapeCsvCell).join(","))].join("\n");
}

function parseCsv(content: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }

      row.push(current);
      current = "";

      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }

  return rows;
}

function normalizeStudent(input: Student): Student {
  return {
    ...input,
    id: input.id.trim(),
    name: input.name.trim(),
    note: input.note?.trim() || "",
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || nowIso(),
  };
}

function normalizeRecord(input: TutoringRecord): TutoringRecord {
  return {
    ...input,
    id: input.id.trim(),
    studentId: input.studentId?.trim() || null,
    topic: input.topic.trim(),
    learningThreadId: input.learningThreadId?.trim() || input.id.trim(),
    previousRecordId: input.previousRecordId?.trim() || null,
    nextRecordId: input.nextRecordId?.trim() || null,
    teacherFeedback: input.teacherFeedback.trim(),
    nextStepSuggestion: input.nextStepSuggestion.trim(),
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || nowIso(),
  };
}

function ensureStudentCsv(headers: string[]) {
  if (STUDENT_CSV_HEADERS.every((header, index) => headers[index] === header)) {
    return;
  }

  throw new Error("学生 CSV 表头不正确。");
}

function ensureRecordCsv(headers: string[]) {
  if (RECORD_CSV_HEADERS.every((header, index) => headers[index] === header)) {
    return;
  }

  throw new Error("记录 CSV 表头不正确。");
}

async function replaceAllLocalData(students: Student[], records: TutoringRecord[]) {
  const [currentStudents, currentRecords] = await Promise.all([
    readCachedStudents(),
    readCachedRecords(),
  ]);

  for (const student of currentStudents) {
    await removeCachedStudent(student.id);
  }

  for (const record of currentRecords) {
    await removeCachedRecord(record.id);
  }

  await cacheStudents(students);
  await cacheRecords(records);
}

export async function downloadBackupJson(): Promise<void> {
  const appMeta = (await listAppMetaRecords()).filter((record) => shouldBackupAppMetaKey(record.key));
  const payload: LocalBackupPayload = {
    version: 1,
    exportedAt: nowIso(),
    students: await readCachedStudents(),
    records: await readCachedRecords(),
    appMeta,
  };

  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }),
    `class-candy-backup-${payload.exportedAt.slice(0, 10)}.json`,
  );

  await setAppMeta(LAST_BACKUP_AT_KEY, payload.exportedAt);
}

export async function downloadStudentsCsv(): Promise<void> {
  const students = await readCachedStudents();
  const rows = students.map((student) => [
    student.id,
    student.name,
    student.grade,
    student.subject,
    student.note,
    student.createdAt,
    student.updatedAt,
  ]);

  downloadBlob(
    new Blob([`\ufeff${buildCsv(STUDENT_CSV_HEADERS, rows)}`], {
      type: "text/csv;charset=utf-8",
    }),
    "class-candy-students.csv",
  );

  await setAppMeta(LAST_BACKUP_AT_KEY, nowIso());
}

export async function downloadRecordsCsv(): Promise<void> {
  const records = await readCachedRecords();
  const rows = records.map((record) => [
    record.id,
    record.studentId ?? "",
    record.date,
    record.topic,
    record.learningThreadId,
    record.previousRecordId ?? "",
    record.nextRecordId ?? "",
    record.teacherFeedback,
    record.masteryLevel ?? "",
    record.nextStepSuggestion,
    record.stage,
    record.createdAt,
    record.updatedAt,
    JSON.stringify(record.lessonPackage),
    JSON.stringify(record.generateRequest),
  ]);

  downloadBlob(
    new Blob([`\ufeff${buildCsv(RECORD_CSV_HEADERS, rows)}`], {
      type: "text/csv;charset=utf-8",
    }),
    "class-candy-records.csv",
  );

  await setAppMeta(LAST_BACKUP_AT_KEY, nowIso());
}

async function importJsonPayload(content: string): Promise<LocalImportSummary> {
  const parsed = JSON.parse(content) as Partial<LocalBackupPayload>;
  const students = Array.isArray(parsed.students) ? parsed.students.map((item) => normalizeStudent(item as Student)) : [];
  const records = Array.isArray(parsed.records) ? parsed.records.map((item) => normalizeRecord(item as TutoringRecord)) : [];
  const appMeta = Array.isArray(parsed.appMeta)
    ? parsed.appMeta
        .filter((item): item is AppMetaRecord => Boolean(item && typeof item.key === "string" && typeof item.value === "string"))
        .filter((item) => shouldBackupAppMetaKey(item.key))
    : [];

  return {
    students,
    records,
    mode: "replace-all",
    label: "JSON 完整备份",
    appMeta,
  };
}

async function importStudentsCsv(content: string): Promise<LocalImportSummary> {
  const rows = parseCsv(content.replace(/^\ufeff/, ""));
  if (rows.length < 1) {
    throw new Error("学生 CSV 内容为空。");
  }

  ensureStudentCsv(rows[0] ?? []);
  const students: Student[] = [];

  for (const row of rows.slice(1)) {
    const [id, name, grade, subject, note, createdAt, updatedAt] = row;
    const parsed = parseCreateStudentInput({ name, grade, subject, note });

    if (!parsed || !id?.trim()) {
      continue;
    }

    students.push(
      normalizeStudent({
        id: id.trim(),
        ...parsed,
        note: parsed.note ?? "",
        createdAt: createdAt || nowIso(),
        updatedAt: updatedAt || nowIso(),
      }),
    );
  }

  return {
    students,
    records: [],
    mode: "merge",
    label: "学生 CSV",
    appMeta: [],
  };
}

async function importRecordsCsv(content: string): Promise<LocalImportSummary> {
  const rows = parseCsv(content.replace(/^\ufeff/, ""));
  if (rows.length < 1) {
    throw new Error("记录 CSV 内容为空。");
  }

  ensureRecordCsv(rows[0] ?? []);
  const records: TutoringRecord[] = [];

  for (const row of rows.slice(1)) {
    const [
      id,
      studentId,
      date,
      topic,
      learningThreadId,
      previousRecordId,
      nextRecordId,
      teacherFeedback,
      masteryLevel,
      nextStepSuggestion,
      stage,
      createdAt,
      updatedAt,
      lessonPackageJson,
      generateRequestJson,
    ] = row;

    if (!id?.trim()) {
      continue;
    }

    const parsed = parseCreateRecordInput({
      studentId: studentId || null,
      date,
      topic,
      learningThreadId,
      previousRecordId,
      lessonPackage: JSON.parse(lessonPackageJson || "{}"),
      teacherFeedback,
      masteryLevel: masteryLevel || null,
      generateRequest: JSON.parse(generateRequestJson || "{}"),
    });

    if (!parsed) {
      continue;
    }

    records.push(
      normalizeRecord({
        id: id.trim(),
        ...parsed,
        learningThreadId: parsed.learningThreadId || id.trim(),
        nextRecordId: nextRecordId?.trim() || null,
        nextStepSuggestion: nextStepSuggestion || "",
        stage: stage === "feedback" ? "feedback" : "package",
        createdAt: createdAt || nowIso(),
        updatedAt: updatedAt || nowIso(),
      }),
    );
  }

  return {
    students: [],
    records,
    mode: "merge",
    label: "记录 CSV",
    appMeta: [],
  };
}

export async function importLocalDataFile(file: File): Promise<LocalImportSummary> {
  const content = await file.text();
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".json")) {
    return importJsonPayload(content);
  }

  if (lowerName.endsWith(".csv")) {
    const [headerRow] = parseCsv(content.replace(/^\ufeff/, ""));
    const headers = headerRow ?? [];

    if (headers[0] === "id" && headers.includes("grade") && headers.includes("subject") && headers.includes("note")) {
      return importStudentsCsv(content);
    }

    if (headers[0] === "id" && headers.includes("lessonPackageJson") && headers.includes("generateRequestJson")) {
      return importRecordsCsv(content);
    }
  }

  throw new Error("暂不支持该文件格式，请导入 JSON 完整备份或学生/记录 CSV。");
}

export async function applyImportedLocalData(summary: LocalImportSummary): Promise<LocalBackupPayload> {
  if (summary.mode === "replace-all") {
    await replaceAllLocalData(summary.students, summary.records);
  } else {
    if (summary.students.length) {
      await cacheStudents(summary.students);
    }

    if (summary.records.length) {
      await cacheRecords(summary.records);
    }
  }

  for (const record of summary.appMeta ?? []) {
    await setAppMeta(record.key, record.value);
  }

  await setAppMeta(LOCAL_PRIMARY_STUDENT_RECORDS_SEEDED_KEY, "1");

  return {
    version: 1,
    exportedAt: nowIso(),
    students: await readCachedStudents(),
    records: await readCachedRecords(),
    appMeta: (await listAppMetaRecords()).filter((record) => shouldBackupAppMetaKey(record.key)),
  };
}

export async function readLastBackupAt(): Promise<string | null> {
  const records = await listAppMetaRecords();
  const target = records.find((record) => record.key === LAST_BACKUP_AT_KEY);
  return target?.value ?? null;
}
