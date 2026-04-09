import type { StudentStageTest } from "@/lib/types/stage-test";
import { escapeHtmlWithoutMath, renderMathHtml } from "@/lib/utils/render-math-html";

export type StageTestExportMode = "questions" | "answers" | "both";

function escapeHtml(value: string): string {
  return renderMathHtml(value);
}

function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "阶段性测试";
}

export function downloadStageTestAsWord(
  result: StudentStageTest,
  mode: StageTestExportMode = "both",
) {
  const modeLabel =
    mode === "questions" ? "仅题目版" : mode === "answers" ? "仅答案版" : "题目+答案版";
  const sections: string[] = [];

  if (mode === "questions" || mode === "both") {
    sections.push(`
      <div class="section">
        <h2>测试题目</h2>
        <ol>
          ${result.questions
            .map(
              (question, index) =>
                `<li><strong>第 ${index + 1} 题</strong>（${escapeHtml(question.topic)} · ${escapeHtml(question.sourceLabel)}）：${escapeHtml(question.question)}${
                  question.type === "解答题"
                    ? `<div class="answer-space"><div class="answer-line"></div><div class="answer-line"></div><div class="answer-line"></div><div class="answer-line"></div></div>`
                    : ""
                }</li>`,
            )
            .join("")}
        </ol>
      </div>
    `);
  }

  if (mode === "answers" || mode === "both") {
    sections.push(`
      <div class="section">
        <h2>答案解析</h2>
        <ol>
          ${result.questions
            .map(
              (question, index) =>
                `<li><p><strong>第 ${index + 1} 题答案：</strong>${escapeHtml(question.answer)}</p><p><strong>解析：</strong>${escapeHtml(question.analysis)}</p></li>`,
            )
            .join("")}
        </ol>
      </div>
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
          ol, ul { padding-left: 24px; }
          .section { margin-bottom: 12px; }
          .math-display-line { margin: 8px 0 8px 2em; }
          .answer-space { margin-top: 10px; }
          .answer-line { border-bottom: 1px solid #d8deea; height: 22px; margin-bottom: 6px; }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="cover">
            <h1>${escapeHtml(result.title)} - ${modeLabel}</h1>
            <div class="meta">${escapeHtml(result.grade)} · ${escapeHtml(result.subject)} · 生成于 ${escapeHtml(result.generatedAt)}</div>
            <div class="meta">专题范围：${result.topics.map((topic) => escapeHtmlWithoutMath(topic)).join(" / ")}</div>
          </div>
          ${sections.join("")}
        </div>
      </body>
    </html>
  `;

  const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = `${sanitizeFileName(result.title)}-${modeLabel}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(href);
}
