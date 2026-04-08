import type { GenerateRequest, LessonPackage } from "@/lib/types/lesson-package";
import type { MasteryLevel } from "@/lib/types/student-progress";
import { parseGenerateRequest } from "@/lib/domain/lesson-package-input";

type CreateStudentRequest = {
  name: string;
  grade: GenerateRequest["grade"];
  subject: GenerateRequest["subject"];
  note?: string;
};

export type CreateRecordRequest = {
  studentId: string | null;
  date: string;
  topic: string;
  learningThreadId: string | null;
  previousRecordId: string | null;
  lessonPackage: LessonPackage;
  teacherFeedback: string;
  masteryLevel: MasteryLevel | null;
  generateRequest: GenerateRequest;
};

export type UpdateRecordRequest = {
  date: string;
  topic: string;
  teacherFeedback: string;
  masteryLevel: MasteryLevel | null;
  nextStepSuggestion: string;
  studentId?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGrade(value: unknown): value is GenerateRequest["grade"] {
  return value === "七年级" || value === "八年级" || value === "九年级";
}

function isSubject(value: unknown): value is GenerateRequest["subject"] {
  return value === "语文" || value === "数学" || value === "英语";
}

function isMasteryLevel(value: unknown): value is MasteryLevel {
  return (
    value === "未掌握" ||
    value === "一般" ||
    value === "基本掌握" ||
    value === "熟练"
  );
}

export function parseCreateStudentInput(body: unknown): CreateStudentRequest | null {
  if (!isRecord(body)) {
    return null;
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!name || !isGrade(body.grade) || !isSubject(body.subject)) {
    return null;
  }

  return {
    name,
    grade: body.grade,
    subject: body.subject,
    note,
  };
}

export function parseUpdateStudentInput(body: unknown): CreateStudentRequest | null {
  return parseCreateStudentInput(body);
}

export function parseCreateRecordInput(body: unknown): CreateRecordRequest | null {
  if (!isRecord(body)) {
    return null;
  }

  const studentId =
    typeof body.studentId === "string" && body.studentId.trim() ? body.studentId.trim() : null;
  const learningThreadId =
    typeof body.learningThreadId === "string" && body.learningThreadId.trim()
      ? body.learningThreadId.trim()
      : null;
  const previousRecordId =
    typeof body.previousRecordId === "string" && body.previousRecordId.trim()
      ? body.previousRecordId.trim()
      : null;
  const date = typeof body.date === "string" ? body.date.trim() : "";
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const teacherFeedback =
    typeof body.teacherFeedback === "string" ? body.teacherFeedback.trim() : "";
  const masteryLevel = isMasteryLevel(body.masteryLevel) ? body.masteryLevel : null;

  if (
    !date ||
    !topic ||
    !isRecord(body.lessonPackage) ||
    !isRecord(body.generateRequest)
  ) {
    return null;
  }

  const generateRequest = parseGenerateRequest(body.generateRequest);

  if (!generateRequest) {
    return null;
  }

  return {
    studentId,
    date,
    topic,
    learningThreadId,
    previousRecordId,
    lessonPackage: body.lessonPackage as LessonPackage,
    teacherFeedback,
    masteryLevel,
    generateRequest,
  };
}

export function parseUpdateRecordInput(body: unknown): UpdateRecordRequest | null {
  if (!isRecord(body)) {
    return null;
  }

  const date = typeof body.date === "string" ? body.date.trim() : "";
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const teacherFeedback =
    typeof body.teacherFeedback === "string" ? body.teacherFeedback.trim() : "";
  const nextStepSuggestion =
    typeof body.nextStepSuggestion === "string" ? body.nextStepSuggestion.trim() : "";
  const studentId =
    typeof body.studentId === "string"
      ? body.studentId.trim() || null
      : body.studentId === null
        ? null
        : undefined;
  const masteryLevel = isMasteryLevel(body.masteryLevel) ? body.masteryLevel : null;

  if (!date || !topic) {
    return null;
  }

  return {
    date,
    topic,
    teacherFeedback,
    masteryLevel,
    nextStepSuggestion,
    studentId,
  };
}
