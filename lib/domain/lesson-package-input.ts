import type {
  FollowUpContext,
  GenerateRequest,
  GenerateMode,
  StageTestBias,
  StageTestContext,
} from "@/lib/types/lesson-package";

function isLessonDuration(value: unknown): value is GenerateRequest["duration"] {
  return value === 30 || value === 60 || value === 90;
}

function isExerciseCount(value: unknown): value is GenerateRequest["exerciseCount"] {
  return value === 3 || value === 5 || value === 8;
}

function isGenerateMode(value: unknown): value is GenerateMode {
  return value === "single" || value === "follow_up" || value === "stage_test";
}

function isFollowUpMasteryLevel(
  value: unknown,
): value is FollowUpContext["masteryLevel"] {
  return value === "一般" || value === "基本掌握" || value === "熟悉";
}

function parseFollowUpContext(value: unknown): FollowUpContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const input = value as Partial<FollowUpContext>;
  const previousTopic =
    typeof input.previousTopic === "string" ? input.previousTopic.trim() : "";

  if (!previousTopic || !isFollowUpMasteryLevel(input.masteryLevel)) {
    return null;
  }

  return {
    previousTopic,
    masteryLevel: input.masteryLevel,
    masteredContent:
      typeof input.masteredContent === "string" ? input.masteredContent.trim() : "",
    weakContent: typeof input.weakContent === "string" ? input.weakContent.trim() : "",
    teacherRemark:
      typeof input.teacherRemark === "string" ? input.teacherRemark.trim() : "",
  };
}

function isStageTestBias(value: unknown): value is StageTestBias {
  return value === "基础巩固" || value === "均衡检测" || value === "提升检测";
}

function parseStageTestContext(value: unknown): StageTestContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const input = value as Partial<StageTestContext>;
  const selectedTopics = Array.isArray(input.selectedTopics)
    ? input.selectedTopics
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
        .slice(0, 6)
    : [];

  if (selectedTopics.length < 2 || selectedTopics.length > 6) {
    return null;
  }

  const totalQuestionCount =
    typeof input.totalQuestionCount === "number" &&
    Number.isInteger(input.totalQuestionCount) &&
    input.totalQuestionCount >= 12 &&
    input.totalQuestionCount <= 15
      ? input.totalQuestionCount
      : 12;

  return {
    selectedTopics,
    testName: typeof input.testName === "string" ? input.testName.trim() : "",
    masteryBias: isStageTestBias(input.masteryBias) ? input.masteryBias : "均衡检测",
    totalQuestionCount,
  };
}

export function parseGenerateRequest(body: unknown): GenerateRequest | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const input = body as Partial<GenerateRequest>;
  const mode = isGenerateMode(input.mode) ? input.mode : "single";

  if (
    (input.subject !== "语文" && input.subject !== "数学" && input.subject !== "英语") ||
    (input.grade !== "七年级" && input.grade !== "八年级" && input.grade !== "九年级") ||
    typeof input.topic !== "string" ||
    !input.topic.trim() ||
    (input.studentLevel !== "基础薄弱" &&
      input.studentLevel !== "普通" &&
      input.studentLevel !== "提分") ||
    (input.lessonStyle !== "基础补习" &&
      input.lessonStyle !== "提分补习" &&
      input.lessonStyle !== "考前冲刺" &&
      input.lessonStyle !== "一对一讲解") ||
    !isLessonDuration(input.duration) ||
    !isExerciseCount(input.exerciseCount)
  ) {
    return null;
  }

  const parsedFollowUpContext =
    mode === "follow_up" ? parseFollowUpContext(input.followUpContext) : null;
  const parsedStageTestContext =
    mode === "stage_test" ? parseStageTestContext(input.stageTestContext) : null;

  if (mode === "follow_up" && !parsedFollowUpContext) {
    return null;
  }

  if (mode === "stage_test" && !parsedStageTestContext) {
    return null;
  }

  return {
    mode,
    subject: input.subject,
    grade: input.grade,
    topic: input.topic.trim(),
    studentLevel: input.studentLevel,
    lessonStyle: input.lessonStyle,
    duration: input.duration,
    exerciseCount: input.exerciseCount,
    followUpContext: parsedFollowUpContext ?? undefined,
    stageTestContext: parsedStageTestContext ?? undefined,
    previousLessonTopic:
      typeof input.previousLessonTopic === "string" && input.previousLessonTopic.trim()
        ? input.previousLessonTopic.trim()
        : undefined,
    previousLessonFeedback:
      typeof input.previousLessonFeedback === "string" && input.previousLessonFeedback.trim()
        ? input.previousLessonFeedback.trim()
        : undefined,
    previousLessonSuggestion:
      typeof input.previousLessonSuggestion === "string" && input.previousLessonSuggestion.trim()
        ? input.previousLessonSuggestion.trim()
        : undefined,
  };
}
