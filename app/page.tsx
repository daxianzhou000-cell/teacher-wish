import { PackageGenerator } from "@/components/package-generator";
import { listStudents } from "@/lib/repositories/student-progress";
import type { GenerateRequest } from "@/lib/types/lesson-package";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type FollowUpPrefill = {
  studentId: string;
  previousRecordId: string;
  learningThreadId: string;
  sourceTopic: string;
  sourceFeedback: string;
  sourceSuggestion: string;
  sourceMasteryLevel: string;
};

function getSingleValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parsePrefill(searchParams: SearchParams): {
  prefillForm: GenerateRequest | null;
  prefillStudentId: string;
  followUpPrefill: FollowUpPrefill | null;
} {
  const subject = getSingleValue(searchParams.subject);
  const grade = getSingleValue(searchParams.grade);
  const topic = getSingleValue(searchParams.topic);
  const studentLevel = getSingleValue(searchParams.studentLevel);
  const lessonStyle = getSingleValue(searchParams.lessonStyle);
  const duration = Number(getSingleValue(searchParams.duration));
  const exerciseCount = Number(getSingleValue(searchParams.exerciseCount));
  const studentId = getSingleValue(searchParams.studentId);
  const previousRecordId = getSingleValue(searchParams.previousRecordId);
  const learningThreadId = getSingleValue(searchParams.learningThreadId);
  const sourceTopic = getSingleValue(searchParams.sourceTopic);
  const sourceFeedback = getSingleValue(searchParams.sourceFeedback);
  const sourceSuggestion = getSingleValue(searchParams.sourceSuggestion);
  const sourceMasteryLevel = getSingleValue(searchParams.sourceMasteryLevel);

  const isValid =
    (subject === "语文" || subject === "数学" || subject === "英语") &&
    (grade === "七年级" || grade === "八年级" || grade === "九年级") &&
    Boolean(topic.trim()) &&
    (studentLevel === "基础薄弱" || studentLevel === "普通" || studentLevel === "提分") &&
    (lessonStyle === "基础补习" ||
      lessonStyle === "提分补习" ||
      lessonStyle === "考前冲刺" ||
      lessonStyle === "一对一讲解") &&
    (duration === 30 || duration === 60 || duration === 90) &&
    (exerciseCount === 3 || exerciseCount === 5 || exerciseCount === 8);

  if (!isValid) {
    return {
      prefillForm: null,
      prefillStudentId: "",
      followUpPrefill: null,
    };
  }

  return {
    prefillForm: {
      subject,
      grade,
      topic,
      studentLevel,
      lessonStyle,
      duration,
      exerciseCount,
      previousLessonTopic: sourceTopic || undefined,
      previousLessonFeedback: sourceFeedback || undefined,
      previousLessonSuggestion: sourceSuggestion || undefined,
    },
    prefillStudentId: studentId,
    followUpPrefill:
      previousRecordId && learningThreadId
        ? {
            studentId,
            previousRecordId,
            learningThreadId,
          sourceTopic,
          sourceFeedback,
          sourceSuggestion,
          sourceMasteryLevel,
        }
      : null,
  };
}

export default async function HomePage({
  searchParams = {},
}: {
  searchParams?: SearchParams;
}) {
  const students = await listStudents();
  const { prefillForm, prefillStudentId, followUpPrefill } = parsePrefill(searchParams);

  return (
    <PackageGenerator
      initialStudents={students}
      initialForm={prefillForm}
      initialStudentId={prefillStudentId}
      initialFollowUpPrefill={followUpPrefill}
    />
  );
}
