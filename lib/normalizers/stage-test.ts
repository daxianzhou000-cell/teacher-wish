import type {
  GenerateRequest,
  StageTestAnswerItem,
  StageTestContext,
  StageTestQuestion,
  StageTestQuestionType,
  StageTestResult,
} from "@/lib/types/lesson-package";

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

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

function stripCorruptedMathArtifacts(value: string): string {
  return value
    .replace(/[\uFFFD\u21B5\u23CE]/g, "")
    .replace(/[\u200B-\u200F\u2060\uFEFF]/g, "")
    .replace(/[\uE000-\uF8FF]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeStageTestMathText(value: string): string {
  return stripCorruptedMathArtifacts(value)
    .replace(/\$\$/g, "")
    .replace(/(^|[^\\])\$+/g, "$1")
    .replace(/([A-D])\./g, " $1.")
    .replace(/([（(]\s*)([A-D])\./g, "$1$2.")
    .replace(/\\frac(?!\s*\{)\s*([A-Za-z0-9]+)\s*([A-Za-z0-9()+\-^]+)/g, "\\frac{$1}{$2}")
    .replace(/\\sqrt(?!\s*\[)(?!\s*\{)\s*([A-Za-z0-9])/g, "\\sqrt{$1}")
    .replace(/\s*\\sqrt-\s*/g, " \\sqrt{-")
    .replace(/\s+/g, " ")
    .trim();
}

function isCorruptedStageTestText(value: string): boolean {
  const compact = value.replace(/\s+/g, "");

  if (!compact) {
    return true;
  }

  const dollarCount = (compact.match(/\$/g) ?? []).length;

  return (
    /[\uFFFD\u21B5\u23CE]/.test(value) ||
    /\\frac(?!\s*\{)/.test(value) ||
    /\\sqrt-\s*\$?$/.test(value) ||
    dollarCount >= 2 ||
    /[A-Za-z0-9)]\$\$?/.test(value) ||
    /\$\$?[A-Za-z0-9(\\]/.test(value)
  );
}

function isQuestionType(value: unknown): value is StageTestQuestionType {
  return value === "选择题" || value === "填空题" || value === "解答题";
}

const invalidStageTestQuestionPatterns = [
  /课堂练习/,
  /课后作业/,
  /例题变式/,
  /请完成一道/,
  /围绕.+设置一道/,
  /要求学生先/,
  /参考答案[:：]/,
  /满分范式[:：]/,
  /检测该知识点的掌握情况/,
  /设计一道/,
] as const;

function isInvalidStageTestQuestion(prompt: string): boolean {
  const normalized = prompt.replace(/\s+/g, "");

  return invalidStageTestQuestionPatterns.some((pattern) => pattern.test(normalized));
}

function normalizeStageTestPrompt(prompt: string): string {
  return normalizeStageTestMathText(
    prompt
    .replace(/^\d+[.、]\s*/, "")
    .replace(/（(选择题|填空题|解答题)）/g, "")
    .trim(),
  );
}

function sanitizeStageTestAnswer(answer: string): string {
  return normalizeStageTestMathText(answer.replace(/^参考答案[:：]\s*/g, "").trim());
}

function sanitizeStageTestAnalysis(analysis: string): string {
  return normalizeStageTestMathText(
    analysis
    .replace(/^(解析提示|解析)[:：]\s*/g, "")
    .replace(/（?修正[:：][^）)]*）?/g, "")
    .replace(/修正[:：].*$/g, "")
    .trim(),
  );
}

function isWeakAnalysis(text: string): boolean {
  const normalized = text.replace(/\s+/g, "");

  return (
    !normalized ||
    normalized.length < 12 ||
    /先定位本题对应知识点/.test(normalized) ||
    /按该知识点的核心方法完成作答/.test(normalized) ||
    /给出标准结论/.test(normalized)
  );
}

function buildStageTestAnalysisFallback(
  question: StageTestQuestion,
  answer: string,
): string {
  const normalized = question.prompt.replace(/\s+/g, "");

  if (question.type === "选择题") {
    if (/一次函数|直线|图像|斜率|解析式|k|b/.test(normalized)) {
      return "先根据一次函数图像或解析式判断斜率、截距等关键性质，再对应选项逐个排除。";
    }

    if (/方程组|交点|联立/.test(normalized)) {
      return "先把条件转成方程组，求出未知数后，再与各选项进行比对。";
    }

    return "先抓住题目中的关键条件，再根据定义、性质或计算结果排除错误选项。";
  }

  if (question.type === "填空题") {
    if (/平移|上平移|下平移/.test(normalized)) {
      return "先判断平移前后斜率是否变化，再按“k 不变、b 改变”写出新的解析式。";
    }

    if (/一次函数.*解析式|经过点|待定系数/.test(normalized)) {
      return "先把已知点代入解析式，求出待定系数，再写出结果。";
    }

    if (/方程组|m的值|参数/.test(normalized)) {
      return "先根据题意列出等量关系，再通过代入或消元求出参数。";
    }

    return "先根据题意完成关键计算或判断，再写出最终结果。";
  }

  if (/方程组|消元|代入法|加减法/.test(normalized)) {
    return "先判断用代入法还是消元法，再通过关键变形求出两个未知数。";
  }

  if (/一次函数.*解析式|经过点|A\(|B\(|待定系数/.test(normalized)) {
    return "先设 y = kx + b，再把已知点代入，求出 k 和 b 后写出解析式。";
  }

  if (/平移|平行/.test(normalized)) {
    return "先抓住“平行斜率相同”或“平移 k 不变、只改 b”，再代入条件求出解析式。";
  }

  if (/交点|联立|直线l1|直线l2/.test(normalized)) {
    return "先把交点问题转化为联立方程求解，再根据求得的点坐标继续完成后续计算。";
  }

  if (/单价|苹果|梨|应用题|实际/.test(normalized)) {
    return "先设未知数并列出方程组，解出结果后再结合题意写出答句。";
  }

  return `先根据题意确定解题方法，再围绕“${answer}”对应的关键步骤完成作答。`;
}

function normalizeTopicsCovered(
  value: unknown,
  context: StageTestContext,
): string[] {
  const selectedTopics = context.selectedTopics.slice(0, 6);

  if (!Array.isArray(value)) {
    return selectedTopics;
  }

  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  const allowed = selectedTopics.filter((topic) =>
    normalized.some((item) => item.includes(topic) || topic.includes(item)),
  );

  if (isDevelopment()) {
    const outOfScope = normalized.filter(
      (item) => !selectedTopics.some((topic) => item.includes(topic) || topic.includes(item)),
    );

    if (outOfScope.length > 0) {
      console.info("[stage-test normalizer] topicsCovered 已收回到勾选专题范围", {
        selectedTopics,
        rawTopicsCovered: normalized,
        removedTopics: outOfScope,
      });
    }
  }

  return allowed.length >= Math.min(2, selectedTopics.length) ? allowed : selectedTopics;
}

function buildFallbackQuestions(context: StageTestContext): StageTestQuestion[] {
  const total = context.totalQuestionCount ?? 12;
  const easyCount =
    context.masteryBias === "基础巩固" ? 6 : context.masteryBias === "提升检测" ? 3 : 4;
  const hardCount =
    context.masteryBias === "基础巩固" ? 2 : context.masteryBias === "提升检测" ? 5 : 3;

  return Array.from({ length: total }, (_, index) => {
    const topic = context.selectedTopics[index % context.selectedTopics.length];
    const type: StageTestQuestionType =
      index < 4 ? "选择题" : index < 8 ? "填空题" : "解答题";
    const tier =
      index < easyCount
        ? "基础"
        : index >= total - hardCount
          ? "提升"
          : "中档";

    return {
      type,
      prompt:
        type === "选择题"
          ? `下列关于“${topic}”的说法中，正确的是（ ）`
          : type === "填空题"
            ? `已知某题考查“${topic}”，请写出题中所求结果。`
            : `某题考查“${topic}”的${tier}应用，请写出解题过程并给出结论。`,
    };
  });
}

function buildFallbackAnswerAnalysis(
  questions: StageTestQuestion[],
  context: StageTestContext,
): StageTestAnswerItem[] {
  return questions.map((question, index) => ({
    questionIndex: index + 1,
    answer: `围绕“${context.selectedTopics[index % context.selectedTopics.length]}”给出标准结论。`,
    analysis: buildStageTestAnalysisFallback(
      question,
      `围绕“${context.selectedTopics[index % context.selectedTopics.length]}”给出标准结论。`,
    ),
  }));
}

function buildFallbackStageTest(
  input: GenerateRequest,
  context: StageTestContext,
): StageTestResult {
  const questions = buildFallbackQuestions(context);

  return {
    title: context.testName?.trim() || `${input.topic || input.subject}阶段测试`,
    topicsCovered: context.selectedTopics,
    testDirections: [
      "本卷覆盖近期学习的核心知识点，请按题号顺序完成。",
      "建议先做基础题，再做中档题，最后处理提升题。",
      "解答题请写出关键步骤，避免只写结果。",
    ],
    questions,
    answerAnalysis: buildFallbackAnswerAnalysis(questions, context),
  };
}

function normalizeQuestions(
  value: unknown,
  fallback: StageTestQuestion[],
  expectedCount: number,
): StageTestQuestion[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const filteredOut: string[] = [];

  const normalized = value
    .map((item, index) => {
      if (!isRecord(item)) {
        return null;
      }

      const type = isQuestionType(item.type) ? item.type : "解答题";
      const prompt = typeof item.prompt === "string" ? normalizeStageTestPrompt(item.prompt) : "";

      if (!prompt) {
        return null;
      }

      if (isCorruptedStageTestText(prompt)) {
        return fallback[index] ?? null;
      }

      if (isInvalidStageTestQuestion(prompt)) {
        filteredOut.push(prompt);
        return null;
      }

      return { type, prompt };
    })
    .filter((item): item is StageTestQuestion => Boolean(item))
    .slice(0, expectedCount);

  if (filteredOut.length > 0 && isDevelopment()) {
    console.info("[stage-test normalizer] 无效题干已过滤", {
      filteredCount: filteredOut.length,
      previews: filteredOut.slice(0, 6),
    });
  }

  return normalized.length >= Math.min(12, expectedCount) ? normalized : fallback;
}

function normalizeAnswerAnalysis(
  value: unknown,
  questions: StageTestQuestion[],
  fallback: StageTestAnswerItem[],
  expectedCount: number,
): StageTestAnswerItem[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((item, index) => {
      if (!isRecord(item)) {
        return null;
      }

      const questionIndex =
        typeof item.questionIndex === "number" && Number.isInteger(item.questionIndex)
          ? item.questionIndex
          : index + 1;
      const answer =
        typeof item.answer === "string" ? sanitizeStageTestAnswer(item.answer) : "";
      const rawAnalysis =
        typeof item.analysis === "string" ? sanitizeStageTestAnalysis(item.analysis) : "";
      const question = questions[Math.max(0, questionIndex - 1)] ?? questions[index];
      const analysis =
        question && isWeakAnalysis(rawAnalysis)
          ? buildStageTestAnalysisFallback(question, answer)
          : rawAnalysis;

      if (!answer || !analysis || isCorruptedStageTestText(answer) || isCorruptedStageTestText(analysis)) {
        return null;
      }

      return { questionIndex, answer, analysis };
    })
    .filter((item): item is StageTestAnswerItem => Boolean(item))
    .slice(0, expectedCount);

  return normalized.length >= Math.min(12, expectedCount) ? normalized : fallback;
}

export function normalizeStageTestResult(
  input: GenerateRequest,
  raw: unknown,
): StageTestResult {
  const context = input.stageTestContext ?? {
    selectedTopics: [input.topic || "阶段测试主题"],
    masteryBias: "均衡检测",
    totalQuestionCount: 12,
  };
  const fallback = buildFallbackStageTest(input, context);

  if (!isRecord(raw)) {
    return fallback;
  }

  const expectedCount = context.totalQuestionCount ?? 12;
  const questions = normalizeQuestions(raw.questions, fallback.questions, expectedCount);

  return {
    title: toNonEmptyString(raw.title, fallback.title),
    topicsCovered: normalizeTopicsCovered(raw.topicsCovered, context),
    testDirections: toBoundedStringList(raw.testDirections, fallback.testDirections, 2, 4),
    questions,
    answerAnalysis: normalizeAnswerAnalysis(
      raw.answerAnalysis,
      questions,
      fallback.answerAnalysis,
      questions.length,
    ).map((item, index) => ({
      questionIndex:
        item.questionIndex >= 1 && item.questionIndex <= questions.length
          ? item.questionIndex
          : index + 1,
      answer: item.answer,
      analysis: item.analysis,
    })),
  };
}
