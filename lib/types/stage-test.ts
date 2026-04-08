import type { Grade, Subject } from "@/lib/types/lesson-package";

export type StageTestQuestion = {
  id: string;
  type: "选择题" | "填空题" | "解答题";
  topic: string;
  sourceLabel: string;
  question: string;
  answer: string;
  analysis: string;
};

export type StudentStageTest = {
  title: string;
  studentName: string;
  grade: Grade;
  subject: Subject;
  topics: string[];
  generatedAt: string;
  questions: StageTestQuestion[];
  source?: "legacy" | "job";
  jobId?: string;
  mode?: "stage_test";
};
