import type {
  GenerateRequest,
  Grade,
  LessonPackage,
  Subject,
} from "@/lib/types/lesson-package";

export type MasteryLevel = "未掌握" | "一般" | "基本掌握" | "熟练";
export type RecordStage = "package" | "feedback";

export type Student = {
  id: string;
  name: string;
  grade: Grade;
  subject: Subject;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type TutoringRecord = {
  id: string;
  studentId: string | null;
  date: string;
  topic: string;
  learningThreadId: string;
  previousRecordId: string | null;
  nextRecordId: string | null;
  lessonPackage: LessonPackage;
  teacherFeedback: string;
  masteryLevel: MasteryLevel | null;
  nextStepSuggestion: string;
  stage: RecordStage;
  generateRequest: GenerateRequest;
  createdAt: string;
  updatedAt: string;
};

export type StudentDetail = {
  student: Student;
  records: TutoringRecord[];
  recentTopics: string[];
};
