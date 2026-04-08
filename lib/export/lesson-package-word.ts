import type { LessonPackage } from "@/lib/types/lesson-package";
import {
  escapeHtmlWithoutMath,
  renderMathHtml,
  renderMathParagraphsHtml,
} from "@/lib/utils/render-math-html";

export const exportModuleLabels = {
  keyDifficulties: "难点提醒",
  overview: "知识讲义",
  examples: "例题示范",
  classExercises: "课堂练习",
  homework: "课后练习",
  answerAnalysis: "答案解析",
  improvementTips: "提分建议",
  quickQuiz: "小测收尾",
} as const;

export type ExportModuleKey = keyof typeof exportModuleLabels;
export type ExportPreset = "teacher" | "student";
export type ExportMode = ExportPreset | "custom";

export const exportPresets: Record<ExportPreset, ExportModuleKey[]> = {
  teacher: [
    "keyDifficulties",
    "overview",
    "examples",
    "classExercises",
    "homework",
    "answerAnalysis",
    "improvementTips",
    "quickQuiz",
  ],
  student: ["overview", "classExercises", "homework", "quickQuiz"],
};

function escapeHtml(value: string): string {
  return renderMathHtml(value);
}

function escapeHtmlRaw(value: string): string {
  return escapeHtmlWithoutMath(value);
}

function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "补课备课包";
}

function stripDuplicatedOverviewHeading(text: string): string {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return text;
  }

  const firstLine = lines[0].replace(/[：:]/g, "");

  if (firstLine === "知识讲义") {
    return lines.slice(1).join("\n");
  }

  return text;
}

type LinearForm = {
  a: number;
  b: number;
};

type AnswerEntry = {
  label: string;
  question: string;
  answer: string;
  explanation: string;
};

function parseLinearFunction(question: string): LinearForm | null {
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

function parseXValues(question: string): number[] {
  const triggerIndex = question.indexOf("当 x=");

  if (triggerIndex === -1) {
    return [];
  }

  const snippet = question.slice(triggerIndex, triggerIndex + 40);
  const match = snippet.match(/当\s*x\s*=\s*([^，。；]+)/);

  if (!match) {
    return [];
  }

  return match[1]
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => !Number.isNaN(item));
}

function formatNumber(value: number): string {
  const rounded = Math.round(value);
  return Math.abs(value - rounded) < 1e-9 ? String(rounded) : Number(value.toFixed(6)).toString();
}

function buildLinearValueTrendAnswer(question: string): string | null {
  if (!/当\s*x\s*=/.test(question) || !/求\s*y\s*的值/.test(question) || !/变化情况|变化趋势/.test(question)) {
    return null;
  }

  const form = parseLinearFunction(question);
  const xValues = parseXValues(question);

  if (!form || xValues.length === 0) {
    return null;
  }

  const pairs = xValues.map((x) => ({
    x,
    y: form.a * x + form.b,
  }));
  const pairText = pairs
    .map((item) => `x=${formatNumber(item.x)} 时，y=${formatNumber(item.y)}`)
    .join("；");
  const trend =
    form.a > 0 ? "y 随 x 的增大而增大" : form.a < 0 ? "y 随 x 的增大而减小" : "y 保持不变";

  return `${pairText}；因为 k=${formatNumber(form.a)}，所以 ${trend}。`;
}

function buildLinearValueWork(question: string): string | null {
  const form = parseLinearFunction(question);
  const xValues = parseXValues(question);

  if (!form || xValues.length === 0) {
    return null;
  }

  const pairText = xValues
    .map((x) => `把 x=${formatNumber(x)} 代入 y=${formatNumber(form.a)}x${form.b === 0 ? "" : form.b > 0 ? `+${formatNumber(form.b)}` : formatNumber(form.b)}，得 y=${formatNumber(form.a * x + form.b)}`)
    .join("；");
  const trend =
    form.a > 0 ? "k>0，图像从左向右上升，函数值随 x 增大而增大" :
    form.a < 0 ? "k<0，图像从左向右下降，函数值随 x 增大而减小" :
    "k=0，函数值保持不变";

  return `${pairText}；再根据斜率判断：${trend}。`;
}

function buildFunctionValueCompareAnswer(question: string): { answer: string; explanation: string } | null {
  const normalized = question.replace(/\s+/g, "");
  const form = parseLinearFunction(question);
  const compareMatch = normalized.match(/x=([+-]?\d+(?:\.\d+)?)和x=([+-]?\d+(?:\.\d+)?)/);

  if (!form || !compareMatch || !/比较.*函数值|函数值.*比较|比较大小/.test(question)) {
    return null;
  }

  const leftX = Number(compareMatch[1]);
  const rightX = Number(compareMatch[2]);
  const leftY = form.a * leftX + form.b;
  const rightY = form.a * rightX + form.b;
  const relation = leftY === rightY ? "=" : leftY > rightY ? ">" : "<";

  return {
    answer: `当 x=${formatNumber(leftX)} 时，y=${formatNumber(leftY)}；当 x=${formatNumber(rightX)} 时，y=${formatNumber(rightY)}，所以 ${formatNumber(leftY)} ${relation} ${formatNumber(rightY)}。`,
    explanation: `分别代入两个自变量求出函数值，再直接比较大小即可。`,
  };
}

function buildPointOnLineAnswer(question: string): { answer: string; explanation: string } | null {
  const form = parseLinearFunction(question);
  const normalized = question
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[，]/g, ",");
  const pointMatch = normalized.match(/点\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/);

  if (!form || !pointMatch || !/是否在.*图像上/.test(question)) {
    return null;
  }

  const x = Number(pointMatch[1]);
  const y = Number(pointMatch[2]);
  const expected = form.a * x + form.b;
  const onLine = Math.abs(expected - y) < 1e-9;

  return {
    answer: `把 x=${formatNumber(x)} 代入得 y=${formatNumber(expected)}，${onLine ? "与点的纵坐标相同，所以该点在图像上。" : `与点的纵坐标 ${formatNumber(y)} 不同，所以该点不在图像上。`}`,
    explanation: `判断点是否在图像上，只要把点的横坐标代入解析式，看算出的函数值是否等于纵坐标。`,
  };
}

function buildInterceptExplanation(question: string): string | null {
  if (!/交点/.test(question)) {
    return null;
  }

  if (/y轴/.test(question) || /x轴/.test(question)) {
    return "与 y 轴交点令 x=0；与 x 轴交点令 y=0。";
  }

  return "先判断要求的是哪一类交点，再令对应坐标为 0 求出交点。";
}

function buildTwoPointLineExplanation(question: string): string | null {
  if (
    !(/两点|经过点.*和.*点|经过.*两点|已知点.*和点/.test(question)) ||
    !/解析式|函数关系式/.test(question)
  ) {
    return null;
  }

  return "先设 y=kx+b，再把两点坐标分别代入求出 k 和 b。";
}

function buildParallelLineExplanation(question: string): string | null {
  if (!/平行/.test(question) || !/解析式|函数关系式/.test(question)) {
    return null;
  }

  return "平行说明斜率相同，先定 k，再把已知点代入求 b。";
}

function buildTranslationExplanation(question: string): string | null {
  if (!/平移|上移|下移/.test(question) || !/解析式|函数关系式/.test(question)) {
    return null;
  }

  return "上下平移只改 b，不改 k；向上加、向下减。";
}

function buildModelingExplanation(question: string): string | null {
  if (!/应用|实际|费用|路程|单价|总价|电话费|水费|出租车|建模/.test(question)) {
    return null;
  }

  return "先找变化量和固定量，再写成 y=kx+b，最后代值求结果。";
}

function buildDirectValueExplanation(question: string): string | null {
  if (!/函数值|求\s*y\s*的值|求y值|代入/.test(question) || !/y\s*=/.test(question)) {
    return null;
  }

  return "把给定 x 代入解析式，分别求出对应 y 值。";
}

function buildQuadraticClassificationExplanation(question: string): string | null {
  if (!/一元二次方程|二次项系数|最高次数/.test(question) || !/判定|判断|是否为/.test(question)) {
    return null;
  }

  return "先看未知数最高次数是否为 2，再检查二次项系数是否不为 0。";
}

function buildQuadraticFactoringExplanation(question: string): string | null {
  if (!/因式分解|分解因式|提公因式/.test(question)) {
    return null;
  }

  return "先移到一边化为 0，再提公因式或分解成两个一次因式。";
}

function buildQuadraticSquareRootExplanation(question: string): string | null {
  if (!/开平|平方项|直接开平|\(.*\)\^?2|x²\s*=\s*/.test(question)) {
    return null;
  }

  return "先把平方项单独留下，再两边开平方，注意不要漏掉正负号。";
}

function buildQuadraticFormulaExplanation(question: string): string | null {
  if (!/公式法|求根公式|a、b、c|判别式/.test(question)) {
    return null;
  }

  return "先化为一般形式，确定 a、b、c，再算判别式和公式结果。";
}

function buildQuadraticDiscriminantExplanation(question: string): string | null {
  if (!/判别式|Δ|根的情况|根的个数|有几个实数根/.test(question)) {
    return null;
  }

  return "先算 Δ = b² - 4ac，再根据 Δ 的正负判断根的情况。";
}

function buildQuadraticApplicationExplanation(question: string): string | null {
  if (!/应用题|实际|面积|长方形|增长|利润|题意|舍去/.test(question)) {
    return null;
  }

  return "先设未知数并列方程，解出后再结合题意舍去不合实际的根。";
}

function buildGenericMathExplanation(question: string): string | null {
  return (
    buildQuadraticClassificationExplanation(question) ??
    buildQuadraticFactoringExplanation(question) ??
    buildQuadraticSquareRootExplanation(question) ??
    buildQuadraticFormulaExplanation(question) ??
    buildQuadraticDiscriminantExplanation(question) ??
    buildQuadraticApplicationExplanation(question) ??
    (/判断点.*是否在.*图像上|是否在.*图像上/.test(question)
      ? "把点的横坐标代入解析式，看所得函数值是否等于纵坐标。"
      : null) ??
    (/比较.*函数值|函数值.*比较|比较大小/.test(question)
      ? "先分别代值，或先看斜率正负，再比较对应函数值。"
      : null) ??
    buildInterceptExplanation(question) ??
    buildTwoPointLineExplanation(question) ??
    buildParallelLineExplanation(question) ??
    buildTranslationExplanation(question) ??
    buildModelingExplanation(question) ??
    buildDirectValueExplanation(question)
  );
}

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

function buildCleanReferenceAnswer(label: string, question: string, answer: string): string {
  const linearValueTrendAnswer = buildLinearValueTrendAnswer(question);
  const looksLikeWrongEquationTemplate =
    /由方程\s*x\s*=/.test(answer) || /\[满分范式\].*解方程\s*x\s*=/.test(answer);

  if (linearValueTrendAnswer && looksLikeWrongEquationTemplate) {
    if (isDevelopment()) {
      console.info("[lesson-package export] 参考答案兜底重算已触发", {
        label,
        question,
        originalAnswer: answer,
        recalculatedAnswer: linearValueTrendAnswer,
        reason: "命中表值题错误模板",
      });
    }

    return linearValueTrendAnswer;
  }

  return answer;
}

function buildTeacherAnswerBlock(label: string, question: string, answer: string): AnswerEntry {
  const cleanedAnswer = buildCleanReferenceAnswer(label, question, answer);
  const linearValueWork = buildLinearValueWork(question);
  const compareAnswer = buildFunctionValueCompareAnswer(question);
  const pointOnLineAnswer = buildPointOnLineAnswer(question);
  const genericMathExplanation = buildGenericMathExplanation(question);
  const equationStyle = /\[破题眼\]|\[过程步\]|\[满分范式\]/.test(cleanedAnswer);

  if (compareAnswer) {
    return {
      label,
      question,
      answer: compareAnswer.answer,
      explanation: compareAnswer.explanation,
    };
  }

  if (pointOnLineAnswer) {
    return {
      label,
      question,
      answer: pointOnLineAnswer.answer,
      explanation: pointOnLineAnswer.explanation,
    };
  }

  if (linearValueWork) {
    return {
      label,
      question,
      answer: cleanedAnswer,
      explanation: buildDirectValueExplanation(question) ?? linearValueWork,
    };
  }

  if (equationStyle) {
    const segments = cleanedAnswer
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    const answerLine =
      segments.find((item) => item.startsWith("[满分范式]")) ??
      segments.at(-1) ??
      cleanedAnswer;
    const explanation = segments
      .filter((item) => !item.startsWith("[满分范式]"))
      .map((item) => item.replace(/^\[(破题眼|过程步)\]\s*/, ""))
      .join("；");

    return {
      label,
      question,
      answer: answerLine.replace(/^\[满分范式\]\s*/, ""),
      explanation: genericMathExplanation || explanation || "先判断题型，再沿着对应方法完成计算。",
    };
  }

  return {
      label,
      question,
      answer: cleanedAnswer,
      explanation: genericMathExplanation || "先判断题型，再沿着对应方法完成计算。", 
  };
}

function getImprovementTips(result: LessonPackage): string[] {
  if (Array.isArray(result.improvementTips) && result.improvementTips.length > 0) {
    return result.improvementTips;
  }

  const legacyParentFeedback = (result as LessonPackage & { parentFeedback?: string }).parentFeedback;

  if (typeof legacyParentFeedback === "string" && legacyParentFeedback.trim()) {
    return legacyParentFeedback
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return ["建议先回看本节讲义和例题，再优先巩固课堂练习中的易错点。"];
}

function getQuickQuiz(result: LessonPackage): LessonPackage["quickQuiz"] {
  if (Array.isArray(result.quickQuiz) && result.quickQuiz.length > 0) {
    return result.quickQuiz;
  }

  return result.classExercises.slice(0, 3).map((item, index) => ({
    question: `小测 ${index + 1}：${item.question}`,
    answer: item.answer,
  }));
}

function buildAnswerEntries(result: LessonPackage, quickQuiz: LessonPackage["quickQuiz"]): AnswerEntry[] {
  return [
    ...result.classExercises.map((item, index) => ({
      ...buildTeacherAnswerBlock(`课堂练习 ${index + 1}`, item.question, item.answer),
    })),
    ...result.homework.map((item, index) => ({
      ...buildTeacherAnswerBlock(`课后练习 ${index + 1}`, item.question, item.answer),
    })),
    ...quickQuiz.map((item, index) => ({
      ...buildTeacherAnswerBlock(`小测收尾 ${index + 1}`, item.question, item.answer),
    })),
  ];
}

export function downloadLessonPackageAsWord(params: {
  title: string;
  fileName?: string;
  result: LessonPackage;
  selectedModules: ExportModuleKey[];
  preset: ExportMode;
}) {
  const { title, fileName, result, selectedModules, preset } = params;
  const improvementTips = getImprovementTips(result);
  const quickQuiz = getQuickQuiz(result);
  const versionLabel =
    preset === "teacher" ? "老师版" : preset === "student" ? "学生版" : "自定义版";

  const sections: string[] = [];

  if (selectedModules.includes("keyDifficulties")) {
    sections.push(`
      <h2>${exportModuleLabels.keyDifficulties}</h2>
      <p><strong>核心要点：</strong></p>
      <ul>${result.keyPoints.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      <p><strong>难点提醒：</strong></p>
      <ul>${result.difficulties.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    `);
  }

  if (selectedModules.includes("overview")) {
    sections.push(`
      <h2>${exportModuleLabels.overview}</h2>
      ${renderMathParagraphsHtml(stripDuplicatedOverviewHeading(result.overview))}
    `);
  }

  if (selectedModules.includes("examples")) {
    sections.push(`
      <h2>${exportModuleLabels.examples}</h2>
      <ol>${result.examples
        .map(
          (item) =>
            `<li><p><strong>${escapeHtml(item.title)}</strong></p><p><strong>题目：</strong>${escapeHtml(item.question)}</p><p><strong>思考断点：</strong>${escapeHtml(item.thinkingBreakpoint)}</p><p><strong>讲解过程：</strong>${escapeHtml(item.process)}</p><p><strong>满分范式：</strong>${escapeHtml(item.perfectAnswer)}</p></li>`,
        )
        .join("")}</ol>
    `);
  }

  if (selectedModules.includes("classExercises")) {
    sections.push(`
      <h2>${exportModuleLabels.classExercises}</h2>
      <ol>${result.classExercises
        .map((item) => `<li>${escapeHtml(item.question)}</li>`)
        .join("")}</ol>
    `);
  }

  if (selectedModules.includes("homework")) {
    sections.push(`
      <h2>${exportModuleLabels.homework}</h2>
      <ol>${result.homework
        .map((item) => `<li>${escapeHtml(item.question)}</li>`)
        .join("")}</ol>
    `);
  }

  if (selectedModules.includes("answerAnalysis")) {
    const answerEntries = buildAnswerEntries(result, quickQuiz);

    sections.push(`
      <h2>${exportModuleLabels.answerAnalysis}</h2>
      <ol>${answerEntries
        .map(
          (item) =>
            `<li><p><strong>${escapeHtml(item.label)}</strong></p><p><strong>题目：</strong>${escapeHtml(item.question)}</p><p><strong>参考答案：</strong>${escapeHtml(item.answer)}</p><p><strong>关键步骤：</strong>${escapeHtml(item.explanation)}</p></li>`,
        )
        .join("")}</ol>
    `);
  }

  if (selectedModules.includes("improvementTips")) {
    sections.push(`
      <h2>${exportModuleLabels.improvementTips}</h2>
      <ul>${improvementTips.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    `);
  }

  if (selectedModules.includes("quickQuiz")) {
    sections.push(`
      <h2>${exportModuleLabels.quickQuiz}</h2>
      <ol>${quickQuiz
        .map((item) => `<li>${escapeHtml(item.question)}</li>`)
        .join("")}</ol>
    `);
  }

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 12pt; line-height: 1.75; color: #172033; margin: 0; padding: 0; }
          .sheet { width: 720px; margin: 0 auto; padding: 28px 36px 40px; }
          .cover { border-bottom: 2px solid #d7deea; padding-bottom: 18px; margin-bottom: 18px; }
          .meta { color: #5b6578; font-size: 10.5pt; margin-top: 8px; }
          h1 { font-size: 18pt; font-weight: 700; margin: 0; }
          h2 { font-size: 15pt; font-weight: 700; margin-top: 24px; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 1px solid #e4e9f2; }
          p, li { margin: 6px 0; font-size: 12pt; }
          ul, ol { padding-left: 24px; }
          .section { margin-bottom: 12px; }
          math { font-size: 1em; }
          mfrac { font-size: 1em; }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="cover">
            <h1>${escapeHtmlRaw(title)} - ${versionLabel}</h1>
            <div class="meta">补课备课包导出 · 适用于打印或发送给老师 / 学生使用</div>
          </div>
          ${sections.map((section) => `<div class="section">${section}</div>`).join("")}
        </div>
      </body>
    </html>
  `;

  const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = `${sanitizeFileName(fileName || title)}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(href);
}
