import { buildMockLessonPackage } from "@/lib/providers/mock/data";
import type {
  GenerateRequest,
  LessonPackage,
} from "@/lib/types/lesson-package";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getByAliases(source: UnknownRecord, aliases: string[]): unknown {
  for (const key of aliases) {
    if (key in source) {
      return source[key];
    }
  }

  return undefined;
}

function toNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized ? normalized : fallback;
}

function toStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return normalized.length > 0 ? normalized : fallback;
}

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

function summarizeText(value: string, maxLength = 120): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

type LinearExpr = {
  a: number;
  b: number;
};

type Point = {
  x: number;
  y: number;
};

function normalizeEquationSource(value: string): string {
  return value
    .replace(/\\\(|\\\)|\\\[|\\\]/g, "")
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "(($1)/($2))")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[＝]/g, "=")
    .replace(/[×]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/\s+/g, "");
}

function extractEquationCandidate(question: string): string | null {
  const normalized = normalizeEquationSource(question);
  const match = normalized.match(/([0-9xX+\-*/().]+=[0-9xX+\-*/().]+)/);
  return match ? match[1] : null;
}

function tokenizeExpression(expression: string): string[] {
  const rawTokens = expression.match(/\d+(?:\.\d+)?|[xX]|[()+\-*/]/g) ?? [];
  const tokens: string[] = [];

  for (let index = 0; index < rawTokens.length; index += 1) {
    const current = rawTokens[index];
    const previous = tokens[tokens.length - 1];
    const needImplicitMultiply =
      previous &&
      ((/\d|\)|x|X/.test(previous) && (current === "(" || current === "x" || current === "X")) ||
        ((previous === "x" || previous === "X") && /\d/.test(current)));

    if (needImplicitMultiply) {
      tokens.push("*");
    }

    tokens.push(current);
  }

  return tokens;
}

function parseLinearExpression(expression: string): LinearExpr | null {
  const tokens = tokenizeExpression(expression);
  let index = 0;

  function peek() {
    return tokens[index];
  }

  function consume(expected?: string) {
    const token = tokens[index];

    if (expected && token !== expected) {
      throw new Error("unexpected token");
    }

    index += 1;
    return token;
  }

  function combineAdd(left: LinearExpr, right: LinearExpr): LinearExpr {
    return { a: left.a + right.a, b: left.b + right.b };
  }

  function combineSub(left: LinearExpr, right: LinearExpr): LinearExpr {
    return { a: left.a - right.a, b: left.b - right.b };
  }

  function combineMul(left: LinearExpr, right: LinearExpr): LinearExpr {
    if (left.a !== 0 && right.a !== 0) {
      throw new Error("nonlinear multiplication");
    }

    if (right.a === 0) {
      return { a: left.a * right.b, b: left.b * right.b };
    }

    return { a: right.a * left.b, b: right.b * left.b };
  }

  function combineDiv(left: LinearExpr, right: LinearExpr): LinearExpr {
    if (right.a !== 0 || right.b === 0) {
      throw new Error("invalid division");
    }

    return { a: left.a / right.b, b: left.b / right.b };
  }

  function parseFactor(): LinearExpr {
    const token = peek();

    if (!token) {
      throw new Error("unexpected end");
    }

    if (token === "+") {
      consume("+");
      return parseFactor();
    }

    if (token === "-") {
      consume("-");
      const factor = parseFactor();
      return { a: -factor.a, b: -factor.b };
    }

    if (token === "(") {
      consume("(");
      const value = parseExpression();
      consume(")");
      return value;
    }

    if (token === "x" || token === "X") {
      consume();
      return { a: 1, b: 0 };
    }

    if (/^\d/.test(token)) {
      consume();
      return { a: 0, b: Number(token) };
    }

    throw new Error("invalid factor");
  }

  function parseTerm(): LinearExpr {
    let value = parseFactor();

    while (peek() === "*" || peek() === "/") {
      const operator = consume();
      const right = parseFactor();
      value = operator === "*" ? combineMul(value, right) : combineDiv(value, right);
    }

    return value;
  }

  function parseExpression(): LinearExpr {
    let value = parseTerm();

    while (peek() === "+" || peek() === "-") {
      const operator = consume();
      const right = parseTerm();
      value = operator === "+" ? combineAdd(value, right) : combineSub(value, right);
    }

    return value;
  }

  try {
    const result = parseExpression();
    return index === tokens.length ? result : null;
  } catch {
    return null;
  }
}

function solveLinearEquation(question: string): number | null {
  const candidate = extractEquationCandidate(question);

  if (!candidate) {
    return null;
  }

  const [left, right] = candidate.split("=");

  if (!left || !right) {
    return null;
  }

  const leftExpr = parseLinearExpression(left);
  const rightExpr = parseLinearExpression(right);

  if (!leftExpr || !rightExpr) {
    return null;
  }

  const coefficient = leftExpr.a - rightExpr.a;
  const constant = rightExpr.b - leftExpr.b;

  if (Math.abs(coefficient) < 1e-9) {
    return null;
  }

  return constant / coefficient;
}

function isFunctionValueQuestion(question: string): boolean {
  return (
    (/函数值|求y的值|求y值|求.*函数值/.test(question) && /y\s*=/.test(question)) ||
    /填表/.test(question) ||
    /变化趋势|变化情况/.test(question) ||
    /比较.*函数值|函数值.*比较|比较大小/.test(question) ||
    /点.*是否在.*图像上|是否在.*图像上/.test(question)
  );
}

function isEquationSolvingQuestion(question: string): boolean {
  if (isFunctionValueQuestion(question)) {
    return false;
  }

  return /解方程|求x|求未知数|未知数x|方程/.test(question);
}

function formatSolutionValue(value: number): string {
  const rounded = Math.round(value);

  if (Math.abs(value - rounded) < 1e-9) {
    return String(rounded);
  }

  return Number(value.toFixed(6)).toString();
}

function extractSolvedValues(answer: string): string[] {
  return Array.from(answer.matchAll(/x\s*=\s*(-?\d+(?:\.\d+)?(?:\/-?\d+)*)/g)).map(
    (match) => match[1],
  );
}

function formatSignedNumber(value: number): string {
  if (value === 0) {
    return "";
  }

  const sign = value > 0 ? "+" : "-";
  return `${sign}${Math.abs(value)}`;
}

function formatLineEquation(a: number, b: number): string {
  const slope = a === 1 ? "x" : a === -1 ? "-x" : `${formatSolutionValue(a)}x`;
  return `y=${slope}${formatSignedNumber(Number(formatSolutionValue(b)))}`;
}

function extractSlopeIntercept(question: string): LinearExpr | null {
  const normalized = question
    .replace(/\s+/g, "")
    .replace(/[−]/g, "-")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[，]/g, ",");
  const match = normalized.match(/y=([+-]?\d*(?:\.\d+)?)x([+-]\d+(?:\.\d+)?)?/i);

  if (!match) {
    return null;
  }

  const slopeToken = match[1];
  const interceptToken = match[2] ?? "";
  const a =
    slopeToken === "" || slopeToken === "+" ? 1 : slopeToken === "-" ? -1 : Number(slopeToken);
  const b = interceptToken ? Number(interceptToken) : 0;

  if (Number.isNaN(a) || Number.isNaN(b)) {
    return null;
  }

  return { a, b };
}

function extractPoint(question: string): Point | null {
  const normalized = question
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[，]/g, ",");
  const match = normalized.match(/点\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/);

  if (!match) {
    return null;
  }

  const x = Number(match[1]);
  const y = Number(match[2]);

  if (Number.isNaN(x) || Number.isNaN(y)) {
    return null;
  }

  return { x, y };
}

function replaceFirstPoint(question: string, point: Point): string {
  return question.replace(
    /点\s*[（(]\s*-?\d+(?:\.\d+)?\s*[，,]\s*-?\d+(?:\.\d+)?\s*[）)]/,
    `点(${formatSolutionValue(point.x)},${formatSolutionValue(point.y)})`,
  );
}

function buildParallelLineAnswer(a: number, point: Point): string {
  const b = point.y - a * point.x;
  const equation = formatLineEquation(a, b);

  return [
    `[破题眼] 平行说明两条直线斜率相同，所以先确定斜率为 ${formatSolutionValue(a)}。`,
    `[过程步] 设所求直线为 y=${formatSolutionValue(a)}x+b，把点(${formatSolutionValue(point.x)},${formatSolutionValue(point.y)})代入，得 b=${formatSolutionValue(b)}。`,
    `[满分范式] 解：设所求直线解析式为 y=${formatSolutionValue(a)}x+b。因为它经过点(${formatSolutionValue(point.x)},${formatSolutionValue(point.y)})，所以 ${formatSolutionValue(point.y)}=${formatSolutionValue(a)}×${formatSolutionValue(point.x)}+b，解得 b=${formatSolutionValue(b)}。故所求解析式为 ${equation}。`,
  ].join("\n");
}

function repairDegenerateParallelLineVariant(question: string) {
  const hasParallelSignals =
    question.includes("平行") &&
    /过点|经过点/.test(question) &&
    /解析式|函数关系式/.test(question);

  if (!hasParallelSignals) {
    return null;
  }

  const line = extractSlopeIntercept(question);
  const point = extractPoint(question);

  if (!line || !point) {
    return null;
  }

  if (Math.abs(point.y - (line.a * point.x + line.b)) >= 1e-9) {
    return null;
  }

  const repairedPoint = {
    x: point.x,
    y: point.y + 1,
  };

  return {
    question: replaceFirstPoint(question, repairedPoint),
    answer: buildParallelLineAnswer(line.a, repairedPoint),
  };
}

function buildConsistentEquationAnswer(question: string, solvedValue: string): string {
  const equation = extractEquationCandidate(question) ?? question.trim();
  const hasDenominator = /\\frac|\/\d|\)\//.test(question);
  const hasBrackets = /[()（）]/.test(question);
  const hint = hasDenominator
    ? "先去分母，再按标准顺序移项、合并同类项。"
    : hasBrackets
      ? "先去括号，再移项并合并同类项。"
      : "按标准顺序移项、合并同类项，再把未知数系数化为 1。";

  return [
    `[破题眼] ${hint}`,
    `[过程步] 由方程 ${equation} 化简可得 x=${solvedValue}。`,
    `[满分范式] 解：根据题意，解方程 ${equation}，得 x=${solvedValue}。`,
  ].join("\n");
}

function ensureExerciseAnswerConsistency(
  input: GenerateRequest,
  question: string,
  answer: string,
): string {
  if (input.subject !== "数学") {
    return answer;
  }

  if (!isEquationSolvingQuestion(question)) {
    return answer;
  }

  const solvedValue = solveLinearEquation(question);

  if (solvedValue === null) {
    return answer;
  }

  const expected = formatSolutionValue(solvedValue);
  const solvedValues = Array.from(new Set(extractSolvedValues(answer)));

  if (solvedValues.length <= 1 && (solvedValues.length === 0 || solvedValues[0] === expected)) {
    return answer;
  }

  if (isDevelopment()) {
    console.info("[lesson-package normalizer] 数学题答案过程一致性校验已触发", {
      topic: input.topic,
      questionPreview: summarizeText(question, 100),
      expected,
      found: solvedValues,
    });
  }

  return buildConsistentEquationAnswer(question, expected);
}

function normalizeMathExercisePair(
  input: GenerateRequest,
  question: string,
  answer: string,
): { question: string; answer: string } {
  if (input.subject !== "数学") {
    return { question, answer };
  }

  const repaired = repairDegenerateParallelLineVariant(question);

  if (!repaired) {
    return {
      question,
      answer: ensureExerciseAnswerConsistency(input, question, answer),
    };
  }

  if (isDevelopment()) {
    console.info("[lesson-package normalizer] 数学退化变式题修复已触发", {
      topic: input.topic,
      originalQuestionPreview: summarizeText(question, 100),
      repairedQuestionPreview: summarizeText(repaired.question, 100),
      rule: "平行 + 过点 + 求解析式 若退化回原题，则自动换点",
    });
  }

  return repaired;
}

function toOverview(
  input: GenerateRequest,
  value: unknown,
  fallback: string,
): string {
  const normalized = toNonEmptyString(value, fallback);

  if (input.subject !== "数学") {
    return normalized;
  }

  const hasMathLectureSignals = ["概念", "定义", "规则", "步骤", "易错"].some((keyword) =>
    normalized.includes(keyword),
  );

  const fallbackReasons: string[] = [];

  if (normalized.length < 120) {
    fallbackReasons.push(`overview 过短（${normalized.length} 字）`);
  }

  if (!hasMathLectureSignals) {
    fallbackReasons.push("缺少数学讲义关键信号词（概念/定义/规则/步骤/易错）");
  }

  if (fallbackReasons.length > 0) {
    if (isDevelopment()) {
      console.info("[lesson-package normalizer] 数学 overview fallback 已触发", {
        subject: input.subject,
        topic: input.topic,
        triggered: true,
        reasons: fallbackReasons,
        originalOverviewLength: normalized.length,
        originalOverviewPreview: summarizeText(normalized),
      });
    }

    return fallback;
  }

  if (isDevelopment()) {
    console.info("[lesson-package normalizer] 数学 overview fallback 未触发", {
      subject: input.subject,
      topic: input.topic,
      triggered: false,
      originalOverviewLength: normalized.length,
      originalOverviewPreview: summarizeText(normalized),
    });
  }

  return normalized;
}

function toHomework(
  input: GenerateRequest,
  value: unknown,
  fallback: LessonPackage["homework"],
): LessonPackage["homework"] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((item, index) => {
      if (typeof item === "string") {
        const question = item.trim();
        if (!question) {
          return null;
        }

        const base = fallback[index] ?? fallback[0];
        return {
          question,
          answer: base.answer,
        };
      }

      if (!isRecord(item)) {
        return null;
      }

      const base = fallback[index] ?? fallback[0];
      const question = toNonEmptyString(item.question, base.question);
      const answer = toNonEmptyString(item.answer, base.answer);
      const normalizedPair = normalizeMathExercisePair(input, question, answer);

      return {
        question: normalizedPair.question,
        answer: normalizedPair.answer,
      };
    })
    .filter((item): item is LessonPackage["homework"][number] => Boolean(item));

  return normalized.length > 0 ? normalized : fallback;
}

function toExamples(
  input: GenerateRequest,
  value: unknown,
  fallback: LessonPackage["examples"],
): LessonPackage["examples"] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((item, index) => {
      if (!isRecord(item)) {
        return null;
      }

      const base = fallback[index] ?? fallback[0];
      const question = toNonEmptyString(item.question, base.question);
      const repaired = repairDegenerateParallelLineVariant(question);

      return {
        title: toNonEmptyString(item.title, base.title),
        question: repaired?.question ?? question,
        thinkingBreakpoint: toNonEmptyString(
          item.thinkingBreakpoint,
          base.thinkingBreakpoint,
        ),
        process: repaired?.answer ?? toNonEmptyString(item.process, base.process),
        perfectAnswer:
          repaired?.answer ?? toNonEmptyString(item.perfectAnswer, base.perfectAnswer),
      };
    })
    .filter((item): item is LessonPackage["examples"][number] => Boolean(item));

  return normalized.length > 0 ? normalized : fallback;
}

function toExercises(
  input: GenerateRequest,
  value: unknown,
  fallback: LessonPackage["classExercises"],
): LessonPackage["classExercises"] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((item, index) => {
      if (!isRecord(item)) {
        return null;
      }

      const base = fallback[index] ?? fallback[0];
      const question = toNonEmptyString(item.question, base.question);
      const answer = toNonEmptyString(item.answer, base.answer);
      const normalizedPair = normalizeMathExercisePair(input, question, answer);

      return {
        question: normalizedPair.question,
        answer: normalizedPair.answer,
      };
    })
    .filter((item): item is LessonPackage["classExercises"][number] => Boolean(item));

  return normalized.length > 0 ? normalized : fallback;
}

function toAnswerAnalysis(
  value: unknown,
  fallback: string[],
): string[] {
  const normalized = toStringList(value, fallback);
  const boundaryKeywords = [
    "知识讲义",
    "难点提醒",
    "提分建议",
    "例题示范",
    "例题解析",
  ];

  const filteredOut: Array<{
    keyword: string;
    preview: string;
  }> = [];

  const filtered = normalized.filter((item) => {
    const text = item.replace(/\s+/g, "");
    const matchedKeyword = boundaryKeywords.find((keyword) => text.includes(keyword));

    if (!matchedKeyword) {
      return true;
    }

    filteredOut.push({
      keyword: matchedKeyword,
      preview: summarizeText(item, 80),
    });

    return false;
  });

  if (isDevelopment()) {
    if (filteredOut.length > 0) {
      console.info("[lesson-package normalizer] answerAnalysis 越界过滤已触发", {
        triggered: true,
        filteredCount: filteredOut.length,
        reasons: filteredOut.map((item) => ({
          keyword: item.keyword,
          rule: "答案解析不得包含讲义/难点/提分建议/例题示范/例题解析",
          preview: item.preview,
        })),
      });
    } else {
      console.info("[lesson-package normalizer] answerAnalysis 越界过滤未触发", {
        triggered: false,
        filteredCount: 0,
      });
    }
  }

  return filtered.length > 0 ? filtered : fallback;
}

function isQuadraticEquationTopic(input: GenerateRequest): boolean {
  return input.subject === "数学" && /一元二次方程/.test(input.topic);
}

function normalizeQuadraticFormulaText(text: string): string {
  return text
    .replace(/Δ\s*=\s*b\^?2\s*-\s*4ac/gi, "Δ = b² - 4ac")
    .replace(/Δ\s*>\s*0/g, "Δ > 0")
    .replace(/Δ\s*=\s*0/g, "Δ = 0")
    .replace(/Δ\s*<\s*0/g, "Δ < 0")
    .replace(/Δ\s*0\s*[>≥]/g, "Δ > 0")
    .replace(/Δ\s*0\s*=/g, "Δ = 0")
    .replace(/Δ\s*0\s*[<≤]/g, "Δ < 0")
    .replace(/x\s*=\s*\[\s*-?b\s*±\s*\(?\s*b²?\s*-\s*4ac\s*\)?\s*]\s*\/\s*2a\s*√/g, "x = (-b ± √(b² - 4ac)) / 2a")
    .replace(/x\s*=\s*\(\s*-?b\s*±\s*√?\s*\(?\s*b²?\s*-\s*4ac\s*\)?\s*\)\s*\/\s*2a/g, "x = (-b ± √(b² - 4ac)) / 2a")
    .replace(/b\^2/g, "b²")
    .replace(/x\^2/g, "x²")
    .replace(/([a-zA-Z0-9)])\s*√\s*\(/g, "$1 √(")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildQuadraticOverviewSupplement(text: string): string {
  const sections = [text.trim()].filter(Boolean);

  if (!/因式分解|直接开平|公式法/.test(text) || !/优先|适合|选法|方法/.test(text)) {
    sections.push(
      [
        "三种常用解法怎么选",
        "1. 看到方程容易拆成两个一次因式时，优先考虑因式分解法，速度快、计算量小。",
        "2. 看到方程能整理成 (x-a)²=b 这一类结构时，优先考虑直接开平方法，关键是先把平方项单独留下，再注意正负两根。",
        "3. 如果题目不容易分解、也不方便直接开平，就化为一般形式 ax²+bx+c=0，再用公式法稳妥求解。",
      ].join("\n"),
    );
  }

  if (!/Δ\s*=|判别式|两个不相等实数根|两个相等实数根|没有实数根/.test(text)) {
    sections.push(
      [
        "判别式的作用",
        "先算 Δ = b² - 4ac。",
        "当 Δ > 0 时，方程有两个不相等的实数根；当 Δ = 0 时，方程有两个相等的实数根；当 Δ < 0 时，方程没有实数根。",
        "老师讲题时可以先让学生判断根的情况，再决定有没有必要继续求根。",
      ].join("\n"),
    );
  }

  if (!/舍去|不合实际|负值|题意/.test(text)) {
    sections.push(
      [
        "应用题中的根的舍取",
        "应用题里解出方程后，不能看到两个根就全部保留。",
        "如果根表示人数、边长、时间、件数等实际量，出现负数、0 或不符合题意的结果时，要结合题目背景舍去不合理的根。",
        "课堂上要提醒学生：方程的根不一定都是问题的答案，最后一步一定要回到题意做判断。",
      ].join("\n"),
    );
  }

  return normalizeQuadraticFormulaText(sections.join("\n\n"));
}

function buildQuadraticFormulaExample(): LessonPackage["examples"][number] {
  return {
    title: "例题 3",
    question: "用公式法解方程：x²-5x+2=0。",
    thinkingBreakpoint:
      "这题不容易直接因式分解，也不属于能直接开平的标准结构，所以先化为一般形式，再考虑公式法。",
    process:
      [
        "方程已经是一般形式 ax²+bx+c=0，其中 a=1，b=-5，c=2。",
        "先算判别式：Δ = b² - 4ac = (-5)² - 4×1×2 = 25 - 8 = 17。",
        "因为 Δ > 0，所以方程有两个不相等的实数根。",
        "代入公式 x = (-b ± √(b² - 4ac)) / 2a，得 x = (5 ± √17) / 2。",
      ].join("\n"),
    perfectAnswer:
      "解：这里 a=1，b=-5，c=2。Δ = b² - 4ac = 25 - 8 = 17。因为 Δ > 0，所以方程有两个不相等的实数根。由公式 x = (-b ± √(b² - 4ac)) / 2a，得 x = (5 ± √17) / 2。",
  };
}

function enhanceQuadraticLessonPackage(
  input: GenerateRequest,
  lessonPackage: LessonPackage,
): LessonPackage {
  if (!isQuadraticEquationTopic(input)) {
    return lessonPackage;
  }

  const hasHighValueExample = lessonPackage.examples.some((item) =>
    /公式法|判别式|直接开平/.test(
      [item.title, item.question, item.thinkingBreakpoint, item.process, item.perfectAnswer].join(" "),
    ),
  );

  return {
    ...lessonPackage,
    overview: buildQuadraticOverviewSupplement(lessonPackage.overview),
    keyPoints: lessonPackage.keyPoints.map((item) => normalizeQuadraticFormulaText(item)),
    difficulties: lessonPackage.difficulties.map((item) => normalizeQuadraticFormulaText(item)),
    examples: (hasHighValueExample
      ? lessonPackage.examples
      : [...lessonPackage.examples, buildQuadraticFormulaExample()]
    ).map((item) => ({
      ...item,
      title: normalizeQuadraticFormulaText(item.title),
      question: normalizeQuadraticFormulaText(item.question),
      thinkingBreakpoint: normalizeQuadraticFormulaText(item.thinkingBreakpoint),
      process: normalizeQuadraticFormulaText(item.process),
      perfectAnswer: normalizeQuadraticFormulaText(item.perfectAnswer),
    })),
    classExercises: lessonPackage.classExercises.map((item) => ({
      question: normalizeQuadraticFormulaText(item.question),
      answer: normalizeQuadraticFormulaText(item.answer),
    })),
    homework: lessonPackage.homework.map((item) => ({
      question: normalizeQuadraticFormulaText(item.question),
      answer: normalizeQuadraticFormulaText(item.answer),
    })),
    answerAnalysis: lessonPackage.answerAnalysis.map((item) =>
      normalizeQuadraticFormulaText(item),
    ),
    improvementTips: lessonPackage.improvementTips.map((item) =>
      normalizeQuadraticFormulaText(item),
    ),
    quickQuiz: lessonPackage.quickQuiz.map((item) => ({
      question: normalizeQuadraticFormulaText(item.question),
      answer: normalizeQuadraticFormulaText(item.answer),
    })),
  };
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function joinSections(sections: Array<{ title: string; value: unknown }>): string {
  return sections
    .flatMap(({ title, value }) => {
      if (typeof value === "string" && value.trim()) {
        return [`${title}\n${value.trim()}`];
      }

      if (Array.isArray(value) && value.length > 0) {
        return [`${title}\n${value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean).join("\n")}`];
      }

      if (isRecord(value)) {
        const lines = Object.entries(value)
          .map(([key, item]) => {
            if (typeof item === "string" && item.trim()) {
              return `${key}：${item.trim()}`;
            }

            return "";
          })
          .filter(Boolean);

        if (lines.length > 0) {
          return [`${title}\n${lines.join("\n")}`];
        }
      }

      return [];
    })
    .join("\n\n")
    .trim();
}

function coerceForeignSource(
  input: GenerateRequest,
  source: UnknownRecord,
  fallback: LessonPackage,
): UnknownRecord {
  const coerced: UnknownRecord = { ...source };

  if (typeof coerced.overview !== "string" || !coerced.overview.trim()) {
    const overview = joinSections([
      { title: "一、概念定义", value: getByAliases(source, ["定义", "概念定义"]) },
      { title: "二、标准形式", value: getByAliases(source, ["标准形式"]) },
      { title: "三、核心概念", value: getByAliases(source, ["核心概念", "核心规则", "等式的基本性质"]) },
      { title: "四、标准方法", value: getByAliases(source, ["解题步骤", "标准步骤", "固定步骤"]) },
      { title: "五、易错点提醒", value: getByAliases(source, ["易错点", "易错提醒"]) },
      { title: "六、常见题型", value: getByAliases(source, ["应用题常见类型", "常见题型"]) },
    ]);

    if (overview) {
      coerced.overview = overview;
    }
  }

  if (!Array.isArray(coerced.keyPoints) || coerced.keyPoints.length === 0) {
    const keyPoints = [
      getByAliases(source, ["核心概念"]),
      getByAliases(source, ["标准形式"]),
      getByAliases(source, ["等式的基本性质"]),
      getByAliases(source, ["解题步骤"]),
    ]
      .flatMap((item) => {
        if (typeof item === "string" && item.trim()) {
          return [item.trim()];
        }

        if (Array.isArray(item)) {
          return item.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean);
        }

        return [];
      })
      .slice(0, 4);

    if (keyPoints.length > 0) {
      coerced.keyPoints = keyPoints;
    }
  }

  if (!Array.isArray(coerced.difficulties) || coerced.difficulties.length === 0) {
    const difficultyText = getByAliases(source, ["易错点", "易错提醒"]);

    if (Array.isArray(difficultyText) && difficultyText.length > 0) {
      coerced.difficulties = difficultyText;
    } else if (typeof difficultyText === "string" && difficultyText.trim()) {
      coerced.difficulties = difficultyText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    } else {
      coerced.difficulties = fallback.difficulties;
    }
  }

  if (!Array.isArray(coerced.examples) || coerced.examples.length === 0) {
    const topic = input.topic.trim() || "本节主题";
    coerced.examples = fallback.examples.map((item, index) => ({
      ...item,
      title: `例题 ${index + 1}`,
      question: item.question.replace("本节主题", topic),
    }));
  }

  if (!Array.isArray(coerced.classExercises) || coerced.classExercises.length === 0) {
    coerced.classExercises = fallback.classExercises;
  }

  if (!Array.isArray(coerced.homework) || coerced.homework.length === 0) {
    coerced.homework = fallback.homework;
  }

  if (!Array.isArray(coerced.answerAnalysis) || coerced.answerAnalysis.length === 0) {
    coerced.answerAnalysis = fallback.answerAnalysis;
  }

  if (!Array.isArray(coerced.improvementTips) || coerced.improvementTips.length === 0) {
    coerced.improvementTips = fallback.improvementTips;
  }

  if (!Array.isArray(coerced.quickQuiz) || coerced.quickQuiz.length === 0) {
    coerced.quickQuiz = fallback.quickQuiz;
  }

  if (isDevelopment()) {
    console.info("[lesson-package normalizer] 已尝试异构结构兼容映射", {
      subject: input.subject,
      topic: input.topic,
      sourceKeys: Object.keys(source).slice(0, 20),
      hasOverviewAfterCoercion:
        typeof coerced.overview === "string" && coerced.overview.trim().length > 0,
    });
  }

  return coerced;
}

export function normalizeLessonPackage(
  input: GenerateRequest,
  raw: unknown,
): LessonPackage {
  const fallback = buildMockLessonPackage(input);
  const source = typeof raw === "string" ? tryParseJson(raw) : raw;

  if (!isRecord(source)) {
    return fallback;
  }

  const normalizedSource = coerceForeignSource(input, source, fallback);

  const normalizedPackage = {
    overview: toOverview(input, normalizedSource.overview, fallback.overview),
    keyPoints: toStringList(normalizedSource.keyPoints, fallback.keyPoints),
    difficulties: toStringList(normalizedSource.difficulties, fallback.difficulties),
    examples: toExamples(input, normalizedSource.examples, fallback.examples),
    classExercises: toExercises(input, normalizedSource.classExercises, fallback.classExercises),
    homework: toHomework(input, normalizedSource.homework, fallback.homework),
    answerAnalysis: toAnswerAnalysis(normalizedSource.answerAnalysis, fallback.answerAnalysis),
    improvementTips: toStringList(normalizedSource.improvementTips, fallback.improvementTips),
    quickQuiz: toExercises(input, normalizedSource.quickQuiz, fallback.quickQuiz),
  };

  return enhanceQuadraticLessonPackage(input, normalizedPackage);
}
