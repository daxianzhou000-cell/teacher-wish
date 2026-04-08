import type { ModelSettings } from "@/lib/types/model-settings";

export type Subject = "语文" | "数学" | "英语";
export type Grade = "七年级" | "八年级" | "九年级";
export type StudentLevel = "基础薄弱" | "普通" | "提分";
export type LessonStyle = "基础补习" | "提分补习" | "考前冲刺" | "一对一讲解";
export type LessonDuration = 30 | 60 | 90;
export type ExerciseCount = 3 | 5 | 8;
export type GenerateMode = "single" | "follow_up" | "stage_test";
export type FollowUpMasteryLevel = "一般" | "基本掌握" | "熟悉";
export type StageTestBias = "基础巩固" | "均衡检测" | "提升检测";

export type FollowUpContext = {
  previousTopic: string;
  masteryLevel: FollowUpMasteryLevel;
  masteredContent: string;
  weakContent: string;
  teacherRemark: string;
};

export type StageTestContext = {
  selectedTopics: string[];
  testName?: string;
  masteryBias?: StageTestBias;
  totalQuestionCount?: number;
};

export type GenerateRequest = {
  mode?: GenerateMode;
  subject: Subject;
  grade: Grade;
  topic: string;
  studentLevel: StudentLevel;
  lessonStyle: LessonStyle;
  duration: LessonDuration;
  exerciseCount: ExerciseCount;
  followUpContext?: FollowUpContext;
  stageTestContext?: StageTestContext;
  /** @deprecated 使用 followUpContext.previousTopic 替代 */
  previousLessonTopic?: string;
  /** @deprecated 使用 followUpContext.teacherRemark 替代 */
  previousLessonFeedback?: string;
  /** @deprecated follow_up 模式不再使用该字段 */
  previousLessonSuggestion?: string;
};

export type NextLessonSuggestion = {
  goal: string;
  continueFocus: string[];
  weakPointFocus: string[];
  teachingStrategy: string[];
};

export type StageTestQuestionType = "选择题" | "填空题" | "解答题";

export type StageTestQuestion = {
  type: StageTestQuestionType;
  prompt: string;
};

export type StageTestAnswerItem = {
  questionIndex: number;
  answer: string;
  analysis: string;
};

export type StageTestResult = {
  title: string;
  topicsCovered: string[];
  testDirections: string[];
  questions: StageTestQuestion[];
  answerAnalysis: StageTestAnswerItem[];
};

export type LessonPackage = {
  overview: string;
  keyPoints: string[];
  difficulties: string[];
  examples: Array<{
    title: string;
    question: string;
    thinkingBreakpoint: string;
    process: string;
    perfectAnswer: string;
  }>;
  classExercises: Array<{
    question: string;
    answer: string;
  }>;
  homework: Array<{
    question: string;
    answer: string;
  }>;
  answerAnalysis: string[];
  improvementTips: string[];
  quickQuiz: Array<{
    question: string;
    answer: string;
  }>;
};

export type GenerateResult =
  | {
      mode: "single";
      lessonPackage: LessonPackage;
    }
  | {
      mode: "follow_up";
      nextLessonSuggestion: NextLessonSuggestion;
      lessonPackage: LessonPackage;
    }
  | {
      mode: "stage_test";
      stageTest: StageTestResult;
    };

export type ModelProviderName = "mock" | "openai" | "anthropic" | "custom";

export type GenerateRequestEnvelope = {
  input: GenerateRequest;
  modelSettings?: ModelSettings;
};
