import { normalizeLessonPackage } from "@/lib/normalizers/lesson-package";
import { normalizeStageTestResult } from "@/lib/normalizers/stage-test";
import type {
  FollowUpContext,
  GenerateRequest,
  GenerateResult,
  NextLessonSuggestion,
} from "@/lib/types/lesson-package";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized || fallback;
}

function toBoundedStringList(
  value: unknown,
  fallback: string[],
  min: number,
  max: number,
): string[] {
  if (!Array.isArray(value)) {
    return fallback.slice(0, max);
  }

  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, max);

  return normalized.length >= min ? normalized : fallback.slice(0, max);
}

function buildSuggestionFallback(
  topic: string,
  followUpContext: FollowUpContext,
): NextLessonSuggestion {
  const previousTopic = followUpContext.previousTopic.trim();
  const weakContent = followUpContext.weakContent.trim();
  const masteredContent = followUpContext.masteredContent.trim();

  return {
    goal: `围绕“${topic}”完成下一轮针对性补习，在延续“${previousTopic}”基础上稳住核心方法并推进新训练。`,
    continueFocus: [
      masteredContent || `延续上一节“${previousTopic}”中已经建立的基础理解`,
      "保留上一节已经能完成的基础步骤和审题顺序",
    ],
    weakPointFocus: [
      weakContent || `继续补强“${previousTopic}”中暴露出的薄弱环节`,
      `把“${topic}”中的关键易错点拆开讲透并反复练习`,
    ],
    teachingStrategy: [
      "先做短诊断，再决定本节讲义展开深度",
      "先补弱再做变式，避免一开始进入综合题",
      "每个关键点都配一题讲解和一题即时练习",
    ],
  };
}

function normalizeNextLessonSuggestion(
  value: unknown,
  topic: string,
  followUpContext: FollowUpContext,
): NextLessonSuggestion {
  const fallback = buildSuggestionFallback(topic, followUpContext);

  if (!isRecord(value)) {
    return fallback;
  }

  return {
    goal: toNonEmptyString(value.goal, fallback.goal),
    continueFocus: toBoundedStringList(value.continueFocus, fallback.continueFocus, 2, 4),
    weakPointFocus: toBoundedStringList(value.weakPointFocus, fallback.weakPointFocus, 2, 4),
    teachingStrategy: toBoundedStringList(
      value.teachingStrategy,
      fallback.teachingStrategy,
      3,
      5,
    ),
  };
}

export function normalizeGenerateResult(
  input: GenerateRequest,
  raw: unknown,
): GenerateResult {
  if (input.mode === "stage_test" && input.stageTestContext) {
    return {
      mode: "stage_test",
      stageTest: normalizeStageTestResult(input, raw),
    };
  }

  if (input.mode === "follow_up" && input.followUpContext) {
    const source = isRecord(raw) ? raw : {};
    const lessonPackageSource =
      isRecord(source.lessonPackage) || typeof source.lessonPackage === "string"
        ? source.lessonPackage
        : raw;

    return {
      mode: "follow_up",
      nextLessonSuggestion: normalizeNextLessonSuggestion(
        source.nextLessonSuggestion,
        input.topic,
        input.followUpContext,
      ),
      lessonPackage: normalizeLessonPackage(input, lessonPackageSource),
    };
  }

  return {
    mode: "single",
    lessonPackage: normalizeLessonPackage(input, raw),
  };
}
