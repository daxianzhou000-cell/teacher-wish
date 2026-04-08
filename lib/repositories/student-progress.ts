import { randomUUID } from "node:crypto";

import { readAppData, writeAppData } from "@/lib/storage/local-store";
import type {
  Student,
  StudentDetail,
  TutoringRecord,
} from "@/lib/types/student-progress";

type CreateStudentInput = {
  name: string;
  grade: Student["grade"];
  subject: Student["subject"];
  note?: string;
};

type UpdateStudentInput = CreateStudentInput;

type CreateRecordInput = Omit<
  TutoringRecord,
  "id" | "createdAt" | "updatedAt" | "learningThreadId" | "previousRecordId" | "nextRecordId"
> & {
  learningThreadId: string | null;
  previousRecordId: string | null;
  nextRecordId: string | null;
};

type UpdateRecordInput = Pick<
  TutoringRecord,
  "date" | "topic" | "teacherFeedback" | "masteryLevel" | "nextStepSuggestion"
> & {
  studentId?: string | null;
};

function sortByUpdatedAtDesc<T extends { updatedAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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

export async function listStudents(): Promise<Student[]> {
  const data = await readAppData();
  return sortByUpdatedAtDesc(data.students);
}

export async function createStudent(input: CreateStudentInput): Promise<Student> {
  const data = await readAppData();
  const now = new Date().toISOString();

  const student: Student = {
    id: randomUUID(),
    name: input.name.trim(),
    grade: input.grade,
    subject: input.subject,
    note: input.note?.trim() || "",
    createdAt: now,
    updatedAt: now,
  };

  data.students.push(student);
  await writeAppData(data);

  return student;
}

export async function getStudentById(studentId: string): Promise<Student | null> {
  const data = await readAppData();
  return data.students.find((student) => student.id === studentId) ?? null;
}

export async function getTutoringRecordById(recordId: string): Promise<TutoringRecord | null> {
  const data = await readAppData();
  return data.records.find((record) => record.id === recordId) ?? null;
}

export async function updateStudent(
  studentId: string,
  input: UpdateStudentInput,
): Promise<Student> {
  const data = await readAppData();
  const student = data.students.find((item) => item.id === studentId);

  if (!student) {
    throw new Error("学生不存在，无法更新。");
  }

  student.name = input.name.trim();
  student.grade = input.grade;
  student.subject = input.subject;
  student.note = input.note?.trim() || "";
  student.updatedAt = new Date().toISOString();

  await writeAppData(data);
  return student;
}

export async function deleteStudent(studentId: string): Promise<void> {
  const data = await readAppData();
  const hasStudent = data.students.some((student) => student.id === studentId);

  if (!hasStudent) {
    throw new Error("学生不存在，无法删除。");
  }

  data.students = data.students.filter((student) => student.id !== studentId);
  data.records = data.records.filter((record) => record.studentId !== studentId);

  await writeAppData(data);
}

export async function createTutoringRecord(
  input: CreateRecordInput,
): Promise<TutoringRecord> {
  const data = await readAppData();
  const student = input.studentId
    ? data.students.find((item) => item.id === input.studentId)
    : null;

  if (input.studentId && !student) {
    throw new Error("学生不存在，无法保存补课记录。");
  }

  const requestedPreviousRecord = input.previousRecordId
    ? data.records.find((item) => item.id === input.previousRecordId)
    : null;

  if (input.previousRecordId && !requestedPreviousRecord) {
    throw new Error("上一条学习记录不存在，无法建立连续备课链路。");
  }

  const previousRecord = requestedPreviousRecord
    ? findThreadTail(
        data.records,
        requestedPreviousRecord.learningThreadId || requestedPreviousRecord.id,
      ) ?? requestedPreviousRecord
    : null;

  const now = new Date().toISOString();
  const record: TutoringRecord = {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...input,
    learningThreadId:
      previousRecord?.learningThreadId || input.learningThreadId || randomUUID(),
    previousRecordId: previousRecord?.id || null,
    nextRecordId: null,
  };

  data.records.push(record);
  if (previousRecord) {
    previousRecord.nextRecordId = record.id;
    previousRecord.updatedAt = now;
  }
  if (student) {
    student.updatedAt = now;
  }
  await writeAppData(data);

  return record;
}

export async function updateTutoringRecord(
  recordId: string,
  input: UpdateRecordInput,
): Promise<TutoringRecord> {
  const data = await readAppData();
  const record = data.records.find((item) => item.id === recordId);

  if (!record) {
    throw new Error("补课记录不存在，无法更新。");
  }

  record.date = input.date;
  record.topic = input.topic.trim();
  record.teacherFeedback = input.teacherFeedback.trim();
  record.masteryLevel = input.masteryLevel;
  record.nextStepSuggestion = input.nextStepSuggestion.trim();
  if (input.studentId !== undefined) {
    if (input.studentId) {
      const student = data.students.find((item) => item.id === input.studentId);

      if (!student) {
        throw new Error("学生不存在，无法绑定资料包。");
      }
    }

    record.studentId = input.studentId ?? null;
  }
  record.stage =
    record.masteryLevel && record.nextStepSuggestion
      ? "feedback"
      : "package";
  record.updatedAt = new Date().toISOString();

  const student = record.studentId
    ? data.students.find((item) => item.id === record.studentId)
    : null;
  if (student) {
    student.updatedAt = record.updatedAt;
  }

  await writeAppData(data);
  return record;
}

export async function deleteTutoringRecord(recordId: string): Promise<void> {
  const data = await readAppData();
  const record = data.records.find((item) => item.id === recordId);

  if (!record) {
    throw new Error("补课记录不存在，无法删除。");
  }

  const previousRecord = record.previousRecordId
    ? data.records.find((item) => item.id === record.previousRecordId)
    : null;
  const nextRecord = record.nextRecordId
    ? data.records.find((item) => item.id === record.nextRecordId)
    : null;

  if (previousRecord) {
    previousRecord.nextRecordId = nextRecord?.id ?? null;
    previousRecord.updatedAt = new Date().toISOString();
  }

  if (nextRecord) {
    nextRecord.previousRecordId = previousRecord?.id ?? null;
    nextRecord.updatedAt = new Date().toISOString();
  }

  data.records = data.records.filter((item) => item.id !== recordId);

  const student = record.studentId
    ? data.students.find((item) => item.id === record.studentId)
    : null;
  if (student) {
    student.updatedAt = new Date().toISOString();
  }

  await writeAppData(data);
}

export async function getStudentDetail(studentId: string): Promise<StudentDetail | null> {
  const data = await readAppData();
  const student = data.students.find((item) => item.id === studentId);

  if (!student) {
    return null;
  }

  const records = sortByUpdatedAtDesc(
    data.records.filter((record) => record.studentId === studentId),
  );

  const recentTopics = Array.from(
    new Set(records.map((record) => record.topic.trim()).filter(Boolean)),
  ).slice(0, 6);

  return {
    student,
    records,
    recentTopics,
  };
}

export async function listTutoringRecords(): Promise<TutoringRecord[]> {
  const data = await readAppData();
  return sortByUpdatedAtDesc(data.records);
}
