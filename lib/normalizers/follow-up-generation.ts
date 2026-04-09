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

function isVagueSuggestionText(value: string): boolean {
  const normalized = value.trim();

  if (!normalized) {
    return true;
  }

  return /继续安排下一次补习|继续围绕同一知识点|分层训练|先稳住基础|逐步加入变式题|讲解\s*\+\s*练习\s*\+\s*讲评|重点加强易错点复盘|暴露出的薄弱环节|保持节奏|继续巩固基础|针对性补习/.test(
    normalized,
  );
}

function blendSpecificList(
  candidate: string[],
  fallback: string[],
  min: number,
  max: number,
): string[] {
  const specificItems = candidate.filter((item) => !isVagueSuggestionText(item));
  const merged = [...specificItems];

  for (const item of fallback) {
    if (merged.length >= max) {
      break;
    }

    if (!merged.includes(item)) {
      merged.push(item);
    }
  }

  return merged.length >= min ? merged.slice(0, max) : fallback.slice(0, max);
}

function buildSuggestionFallback(
  topic: string,
  followUpContext: FollowUpContext,
): NextLessonSuggestion {
  const previousTopic = followUpContext.previousTopic.trim();
  const weakContent = followUpContext.weakContent.trim();
  const masteredContent = followUpContext.masteredContent.trim();
  const teacherRemark = followUpContext.teacherRemark.trim();
  const rawIssue = weakContent || teacherRemark;
  const mentionsCalculation = /计算|运算|代入|抄写|符号|粗心|公式/i.test(rawIssue);
  const mentionsFormula = /公式|判别式|因式分解|配方|平方差|完全平方/i.test(rawIssue);
  const issueLabel =
    rawIssue || `“${previousTopic}”里暴露出的具体薄弱点`;

  return {
    goal: `围绕“${topic}”完成下一轮针对性补习，优先解决${issueLabel}，让学生能独立完成同类基础题。`,
    continueFocus: [
      masteredContent || `延续上一节“${previousTopic}”中已经能独立完成的基础题型`,
      mentionsFormula
        ? "继续保留公式识别和选用顺序，先判断用哪种方法，再开始计算"
        : "继续保留上一节已经建立的审题顺序和基础解题步骤",
    ],
    weakPointFocus: [
      mentionsCalculation
        ? "先单练 3-5 题代入与化简，重点盯住符号、括号、分子分母抄写和计算顺序"
        : weakContent || `继续补强“${previousTopic}”中暴露出的具体薄弱环节`,
      mentionsFormula
        ? `把“${topic}”里涉及公式选用、条件判断和代入计算的关键易错点拆开练`
        : `把“${topic}”中的关键易错点拆开讲透并反复练习`,
    ],
    teachingStrategy: [
      mentionsCalculation
        ? "开头先用 5 分钟做 3 题纯计算诊断，不讲新题，先找学生到底卡在代入、符号还是化简"
        : "开头先用 5 分钟做短诊断，确认学生这次具体卡点再决定展开深度",
      mentionsFormula
        ? "先练公式判断和代入，再做完整题，避免一上来就做综合题导致再次算乱"
        : "先补最弱的基础环节，再做一题同型巩固，最后再加一题轻变式",
      "每个关键点都按“老师示范 1 题 + 学生当堂做 1 题 + 立即订正 1 题”推进",
      mentionsCalculation
        ? "结尾留 5 分钟把本节做错的计算题重新独立算一遍，要求学生自己说出错在第几步"
        : "结尾留 5 分钟做错题回看，要求学生复述方法和易错点",
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

  const goalCandidate = toNonEmptyString(value.goal, fallback.goal);
  const continueFocusCandidate = toBoundedStringList(
    value.continueFocus,
    fallback.continueFocus,
    2,
    4,
  );
  const weakPointFocusCandidate = toBoundedStringList(
    value.weakPointFocus,
    fallback.weakPointFocus,
    2,
    4,
  );
  const teachingStrategyCandidate = toBoundedStringList(
    value.teachingStrategy,
    fallback.teachingStrategy,
    3,
    5,
  );

  return {
    goal: isVagueSuggestionText(goalCandidate) ? fallback.goal : goalCandidate,
    continueFocus: blendSpecificList(
      continueFocusCandidate,
      fallback.continueFocus,
      2,
      4,
    ),
    weakPointFocus: blendSpecificList(
      weakPointFocusCandidate,
      fallback.weakPointFocus,
      2,
      4,
    ),
    teachingStrategy: blendSpecificList(
      teachingStrategyCandidate,
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
