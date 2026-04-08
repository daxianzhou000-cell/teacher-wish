import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { normalizeLessonPackage } from "@/lib/normalizers/lesson-package";
import type { GenerateRequest } from "@/lib/types/lesson-package";
import type { Student, TutoringRecord } from "@/lib/types/student-progress";

type AppData = {
  students: Student[];
  records: TutoringRecord[];
};

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "app-data.json");

const defaultData: AppData = {
  students: [],
  records: [],
};
let appDataStorageAvailable: boolean | null = null;
let memoryAppData: AppData = defaultData;

function isGrade(value: unknown): value is GenerateRequest["grade"] {
  return value === "七年级" || value === "八年级" || value === "九年级";
}

function isSubject(value: unknown): value is GenerateRequest["subject"] {
  return value === "语文" || value === "数学" || value === "英语";
}

function isStudentLevel(value: unknown): value is GenerateRequest["studentLevel"] {
  return value === "基础薄弱" || value === "普通" || value === "提分";
}

function isLessonStyle(value: unknown): value is GenerateRequest["lessonStyle"] {
  return (
    value === "基础补习" ||
    value === "提分补习" ||
    value === "考前冲刺" ||
    value === "一对一讲解"
  );
}

function isLessonDuration(value: unknown): value is GenerateRequest["duration"] {
  return value === 30 || value === 60 || value === 90;
}

function isExerciseCount(value: unknown): value is GenerateRequest["exerciseCount"] {
  return value === 3 || value === 5 || value === 8;
}

function inferRecordStage(
  teacherFeedback: string,
  masteryLevel: TutoringRecord["masteryLevel"],
  nextStepSuggestion: string,
): TutoringRecord["stage"] {
  return masteryLevel && nextStepSuggestion.trim()
    ? "feedback"
    : "package";
}

function normalizeGenerateRequest(
  value: unknown,
  topicFallback: string,
): GenerateRequest | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const topic =
    typeof record.topic === "string" && record.topic.trim() ? record.topic.trim() : topicFallback;

  if (
    !isSubject(record.subject) ||
    !isGrade(record.grade) ||
    !topic ||
    !isStudentLevel(record.studentLevel) ||
    !isLessonStyle(record.lessonStyle) ||
    !isLessonDuration(record.duration) ||
    !isExerciseCount(record.exerciseCount)
  ) {
    return null;
  }

  return {
    subject: record.subject,
    grade: record.grade,
    topic,
    studentLevel: record.studentLevel,
    lessonStyle: record.lessonStyle,
    duration: record.duration,
    exerciseCount: record.exerciseCount,
    previousLessonTopic:
      typeof record.previousLessonTopic === "string" ? record.previousLessonTopic.trim() || undefined : undefined,
    previousLessonFeedback:
      typeof record.previousLessonFeedback === "string"
        ? record.previousLessonFeedback.trim() || undefined
        : undefined,
    previousLessonSuggestion:
      typeof record.previousLessonSuggestion === "string"
        ? record.previousLessonSuggestion.trim() || undefined
        : undefined,
  };
}

function normalizeStudent(student: Partial<Student>): Student | null {
  if (
    typeof student.id !== "string" ||
    typeof student.name !== "string" ||
    !isGrade(student.grade) ||
    !isSubject(student.subject) ||
    typeof student.createdAt !== "string" ||
    typeof student.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    id: student.id,
    name: student.name.trim(),
    grade: student.grade,
    subject: student.subject,
    note: typeof student.note === "string" ? student.note : "",
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
  };
}

function repairRecordChains(records: TutoringRecord[]): TutoringRecord[] {
  const groups = new Map<string, TutoringRecord[]>();

  records.forEach((record) => {
    const threadId = record.learningThreadId || record.id;
    const group = groups.get(threadId) ?? [];
    group.push(record);
    groups.set(threadId, group);
  });

  groups.forEach((group) => {
    const ordered = [...group].sort((a, b) => {
      const createdCompare = a.createdAt.localeCompare(b.createdAt);
      if (createdCompare !== 0) {
        return createdCompare;
      }

      return a.updatedAt.localeCompare(b.updatedAt);
    });

    ordered.forEach((record, index) => {
      record.previousRecordId = index === 0 ? null : ordered[index - 1]?.id ?? null;
      record.nextRecordId = index === ordered.length - 1 ? null : ordered[index + 1]?.id ?? null;
    });
  });

  return records;
}

function normalizeRecord(record: Partial<TutoringRecord>): TutoringRecord | null {
  if (
    typeof record.id !== "string" ||
    typeof record.date !== "string" ||
    typeof record.topic !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.updatedAt !== "string" ||
    typeof record.lessonPackage !== "object" ||
    record.lessonPackage === null ||
    typeof record.generateRequest !== "object" ||
    record.generateRequest === null
  ) {
    return null;
  }

  const generateRequest = normalizeGenerateRequest(record.generateRequest, record.topic);

  if (!generateRequest) {
    return null;
  }

  const teacherFeedback =
    typeof record.teacherFeedback === "string" ? record.teacherFeedback.trim() : "";
  const masteryLevel =
    record.masteryLevel === "未掌握" ||
    record.masteryLevel === "一般" ||
    record.masteryLevel === "基本掌握" ||
    record.masteryLevel === "熟练"
      ? record.masteryLevel
      : null;
  const nextStepSuggestion =
    typeof record.nextStepSuggestion === "string" ? record.nextStepSuggestion.trim() : "";

  return {
    id: record.id,
    studentId: typeof record.studentId === "string" && record.studentId.trim() ? record.studentId : null,
    date: record.date,
    topic: record.topic,
    learningThreadId:
      typeof record.learningThreadId === "string" && record.learningThreadId.trim()
        ? record.learningThreadId
        : record.id,
    previousRecordId:
      typeof record.previousRecordId === "string" && record.previousRecordId.trim()
        ? record.previousRecordId
        : null,
    nextRecordId:
      typeof record.nextRecordId === "string" && record.nextRecordId.trim()
        ? record.nextRecordId
        : null,
    lessonPackage: normalizeLessonPackage(generateRequest, record.lessonPackage),
    teacherFeedback,
    masteryLevel,
    nextStepSuggestion,
    stage: inferRecordStage(teacherFeedback, masteryLevel, nextStepSuggestion),
    generateRequest,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function ensureDataFile(): Promise<boolean> {
  if (appDataStorageAvailable === false) {
    return false;
  }

  try {
    await mkdir(dataDir, { recursive: true });

    try {
      await readFile(dataFile, "utf-8");
    } catch {
      await writeFile(dataFile, JSON.stringify(defaultData, null, 2), "utf-8");
    }

    appDataStorageAvailable = true;
    return true;
  } catch {
    appDataStorageAvailable = false;
    return false;
  }
}

export async function readAppData(): Promise<AppData> {
  const storageAvailable = await ensureDataFile();

  if (!storageAvailable) {
    return memoryAppData;
  }

  try {
    const content = await readFile(dataFile, "utf-8");
    const parsed = JSON.parse(content) as Partial<AppData>;
    const normalized: AppData = {
      students: Array.isArray(parsed.students)
        ? parsed.students
            .map((student) => normalizeStudent(student as Partial<Student>))
            .filter((student): student is Student => student !== null)
        : [],
      records: Array.isArray(parsed.records)
        ? repairRecordChains(
            parsed.records
              .map((record) => normalizeRecord(record as Partial<TutoringRecord>))
              .filter((record): record is TutoringRecord => record !== null),
          )
        : [],
    };

    if (JSON.stringify(normalized) !== content.trim()) {
      try {
        await writeFile(dataFile, JSON.stringify(normalized, null, 2), "utf-8");
      } catch {
        appDataStorageAvailable = false;
      }
    }

    memoryAppData = normalized;
    return normalized;
  } catch {
    return memoryAppData;
  }
}

export async function writeAppData(data: AppData): Promise<void> {
  memoryAppData = data;

  const storageAvailable = await ensureDataFile();
  if (!storageAvailable) {
    return;
  }

  try {
    await writeFile(dataFile, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    appDataStorageAvailable = false;
  }
}

export function getAppDataFilePath() {
  return dataFile;
}
