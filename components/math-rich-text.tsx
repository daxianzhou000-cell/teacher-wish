import katex from "katex";
import { Fragment, type ReactNode } from "react";

import { renderMathText } from "@/lib/utils/render-math-text";

type MathToken =
  | { type: "text"; value: string }
  | { type: "math"; value: string; display: boolean };

function looksLikeMathSegment(value: string): boolean {
  const compact = value.trim();

  if (!compact) {
    return false;
  }

  return /\\[A-Za-z]+|[A-Za-z][0-9]?|[=+\-*/^()[\]{}<>≤≥≠≈∥⊥∈√∛∜|]/.test(compact);
}

function splitImplicitMathSegments(value: string): MathToken[] {
  const pattern =
    /([A-Za-z0-9\\{}[\]()+\-*/=.^|<>≤≥≠≈∥⊥∈√∛∜]+(?:\s+[A-Za-z0-9\\{}[\]()+\-*/=.^|<>≤≥≠≈∥⊥∈√∛∜]+)*)/g;
  const tokens: MathToken[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(pattern)) {
    const start = match.index ?? 0;
    const segment = match[0];

    if (start > lastIndex) {
      tokens.push({ type: "text", value: value.slice(lastIndex, start) });
    }

    tokens.push(
      looksLikeMathSegment(segment)
        ? { type: "math", value: segment.trim(), display: false }
        : { type: "text", value: segment },
    );

    lastIndex = start + segment.length;
  }

  if (lastIndex < value.length) {
    tokens.push({ type: "text", value: value.slice(lastIndex) });
  }

  return tokens;
}

function normalizeUnicodeRoots(value: string): string {
  let result = "";

  for (let index = 0; index < value.length; index += 1) {
    const marker = value[index];

    if (marker !== "√" && marker !== "∛" && marker !== "∜") {
      result += marker;
      continue;
    }

    let cursor = index + 1;

    while (cursor < value.length && /\s/.test(value[cursor] ?? "")) {
      cursor += 1;
    }

    if (cursor >= value.length) {
      result += marker;
      continue;
    }

    let operand = "";
    const nextChar = value[cursor] ?? "";

    if (nextChar === "(") {
      let depth = 0;
      let end = cursor;

      for (; end < value.length; end += 1) {
        const char = value[end] ?? "";

        if (char === "(") {
          depth += 1;
        } else if (char === ")") {
          depth -= 1;

          if (depth === 0) {
            break;
          }
        }
      }

      if (depth === 0) {
        operand = value.slice(cursor + 1, end).trim();
        cursor = end + 1;
      }
    } else {
      const match = value.slice(cursor).match(/^[A-Za-z0-9\u4e00-\u9fa5.+\-]+/);

      if (match) {
        operand = match[0];
        cursor += match[0].length;
      }
    }

    if (!operand) {
      result += marker;
      continue;
    }

    result +=
      marker === "∛"
        ? `\\sqrt[3]{${operand}}`
        : marker === "∜"
          ? `\\sqrt[4]{${operand}}`
          : `\\sqrt{${operand}}`;
    index = cursor - 1;
  }

  return result;
}

function normalizeEquationSystems(value: string): string {
  return value
    .replace(/[\{]\s*█\(([\s\S]*?)\)┤/g, (_, content: string) => {
      const lines = content
        .split("@")
        .map((item) => item.trim())
        .filter(Boolean);

      return lines.length >= 2 ? `\\begin{cases}${lines.join("\\\\")}\\end{cases}` : _;
    })
    .replace(/\{([^{}]*(?:=|≤|≥|<|>)[^{}]*)\}/g, (matched, content: string) => {
      const normalized = content
        .replace(/[；;]/g, ",")
        .replace(/[，]/g, ",")
        .replace(/\s*\n\s*/g, ",");
      const lines = normalized
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      return lines.length >= 2 ? `\\begin{cases}${lines.join("\\\\")}\\end{cases}` : matched;
    });
}

function normalizeUnicodeOperators(value: string): string {
  return value
    .replaceAll("×", "\\times ")
    .replaceAll("÷", "\\div ")
    .replaceAll("≤", "\\leq ")
    .replaceAll("≥", "\\geq ")
    .replaceAll("≠", "\\neq ")
    .replaceAll("≈", "\\approx ")
    .replaceAll("∥", "\\parallel ")
    .replaceAll("⊥", "\\perp ")
    .replaceAll("∵", "\\because ")
    .replaceAll("∴", "\\therefore ")
    .replaceAll("∞", "\\infty ")
    .replaceAll("∈", "\\in ")
    .replaceAll("∠", "\\angle ")
    .replaceAll("△", "\\triangle ");
}

function normalizeImplicitSubscripts(value: string): string {
  return value.replace(
    /(^|[^\\A-Za-z])([A-Za-z])([0-9]+)(?=$|[^0-9.])/g,
    (_, prefix: string, variable: string, script: string) =>
      `${prefix}${variable}_{${script}}`,
  );
}

function normalizeUnicodeScripts(value: string): string {
  return value
    .replaceAll("⁰", "^{0}")
    .replaceAll("¹", "^{1}")
    .replaceAll("²", "^{2}")
    .replaceAll("³", "^{3}")
    .replaceAll("⁴", "^{4}")
    .replaceAll("⁵", "^{5}")
    .replaceAll("⁶", "^{6}")
    .replaceAll("⁷", "^{7}")
    .replaceAll("⁸", "^{8}")
    .replaceAll("⁹", "^{9}")
    .replaceAll("₀", "_{0}")
    .replaceAll("₁", "_{1}")
    .replaceAll("₂", "_{2}")
    .replaceAll("₃", "_{3}")
    .replaceAll("₄", "_{4}")
    .replaceAll("₅", "_{5}")
    .replaceAll("₆", "_{6}")
    .replaceAll("₇", "_{7}")
    .replaceAll("₈", "_{8}")
    .replaceAll("₉", "_{9}");
}

function normalizeGeometryPointLabels(value: string): string {
  return value.replace(
    /(^|[^\\A-Za-z])([A-Z]{1,2})([0-9]+)(?=$|[^0-9.])/g,
    (_, prefix: string, point: string, script: string) =>
      `${prefix}${point}_{${script}}`,
  );
}

function normalizeBareLatex(value: string): string {
  return normalizeGeometryPointLabels(
    normalizeImplicitSubscripts(
      normalizeUnicodeScripts(
        normalizeUnicodeOperators(normalizeEquationSystems(normalizeUnicodeRoots(value))),
      ),
    ),
  )
    .replace(
      /(\([^)]+\)|\[[^\]]+\]|[A-Za-z0-9.+\-]+)\s*\/\s*(\([^)]+\)|\[[^\]]+\]|[A-Za-z0-9.+\-]+)/g,
      (_, rawNumerator: string, rawDenominator: string) => {
        const numerator = rawNumerator.trim().replace(/^\(|\)$/g, "").replace(/^\[|\]$/g, "");
        const denominator = rawDenominator.trim().replace(/^\(|\)$/g, "").replace(/^\[|\]$/g, "");
        return `\\frac{${numerator}}{${denominator}}`;
      },
    )
    .replace(/\\sqrt\s*\[([^\]]+)\]\s*([A-Za-z0-9])/g, "\\sqrt[$1]{$2}")
    .replace(/\\sqrt(?!\s*\[)(?!\s*\{)\s*([A-Za-z0-9])/g, "\\sqrt{$1}")
    .replace(
      /(^|[\s(（=:：，,；;])([+\-]?(?:\\(?:d?frac|tfrac)\s*\{[^{}]+\}\s*\{[^{}]+\}|\\sqrt(?:\[[^\]]+\])?(?:\{[^{}]+\}|[A-Za-z0-9])))(?=$|[\s)）=:：，,；;。.!！?？])/g,
      (_, prefix: string, expr: string) => `${prefix}$${expr}$`,
    )
    .replace(
      /(^|[\s])((\\begin\{(cases|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|array|aligned)\}[\s\S]*?\\end\{\4\}))(?=$|[\s])/g,
      (_, prefix: string, expr: string) => `${prefix}$$${expr}$$`,
    );
}

function tokenizeMath(value: string): MathToken[] {
  const normalized = normalizeBareLatex(value);
  const pattern = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+\$|\\\([\s\S]+?\\\))/g;
  const tokens: MathToken[] = [];
  let lastIndex = 0;

  for (const match of normalized.matchAll(pattern)) {
    const start = match.index ?? 0;
    const token = match[0];

    if (start > lastIndex) {
      tokens.push({ type: "text", value: normalized.slice(lastIndex, start) });
    }

    if (token.startsWith("$$") && token.endsWith("$$")) {
      tokens.push({ type: "math", value: token.slice(2, -2).trim(), display: true });
    } else if (token.startsWith("\\[") && token.endsWith("\\]")) {
      tokens.push({ type: "math", value: token.slice(2, -2).trim(), display: true });
    } else if (token.startsWith("$") && token.endsWith("$")) {
      tokens.push({ type: "math", value: token.slice(1, -1).trim(), display: false });
    } else if (token.startsWith("\\(") && token.endsWith("\\)")) {
      tokens.push({ type: "math", value: token.slice(2, -2).trim(), display: false });
    }

    lastIndex = start + token.length;
  }

  if (lastIndex < normalized.length) {
    tokens.push({ type: "text", value: normalized.slice(lastIndex) });
  }

  return tokens.flatMap((token) =>
    token.type === "text" ? splitImplicitMathSegments(token.value) : [token],
  );
}

function renderFormula(value: string, display: boolean, key: string) {
  const html = katex.renderToString(value, {
    displayMode: display,
    throwOnError: false,
    strict: "ignore",
    trust: false,
  });

  return (
    <span
      key={key}
      className={
        display
          ? "class-candy-math class-candy-math-display"
          : "class-candy-math class-candy-math-inline"
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderLine(line: string, lineKey: string): ReactNode {
  const tokens = tokenizeMath(line);

  if (
    tokens.length === 1 &&
    tokens[0]?.type === "math" &&
    tokens[0].display
  ) {
    return <div key={lineKey}>{renderFormula(tokens[0].value, true, `${lineKey}-display`)}</div>;
  }

  return (
    <Fragment key={lineKey}>
      {tokens.map((token, index) =>
        token.type === "math" ? (
          renderFormula(token.value, token.display, `${lineKey}-math-${index}`)
        ) : (
          <Fragment key={`${lineKey}-text-${index}`}>{renderMathText(token.value)}</Fragment>
        ),
      )}
    </Fragment>
  );
}

export function MathInlineText({ value }: { value: string }) {
  return <>{renderLine(value, "inline")}</>;
}

export function MathTextBlock({
  value,
  className = "",
  paragraphClassName = "",
}: {
  value: string;
  className?: string;
  paragraphClassName?: string;
}) {
  return (
    <div className={className}>
      {value.split("\n").map((line, index) => (
        <p
          key={`${line}-${index}`}
          className={`${index === 0 ? "" : "mt-2"} ${paragraphClassName}`.trim()}
        >
          {renderLine(line, `line-${index}`)}
        </p>
      ))}
    </div>
  );
}
