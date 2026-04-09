import katex from "katex";

import { renderMathText } from "@/lib/utils/render-math-text";

type MathToken =
  | { type: "text"; value: string }
  | { type: "math"; value: string; display: boolean };

function looksLikeMathSegment(value: string): boolean {
  const compact = value.trim();

  if (!compact) {
    return false;
  }

  return /\\[A-Za-z]+|[A-Za-z](?:_[A-Za-z0-9]+|[0-9])?|[=+\-*/^_()[\]{}<>≤≥≠≈∥⊥∈√∛∜|]/.test(
    compact,
  );
}

function splitImplicitMathSegments(value: string): MathToken[] {
  const pattern =
    /([A-Za-z0-9\\{}[\]()+\-*/=.^_|,<>≤≥≠≈∥⊥∈√∛∜]+(?:\s+[A-Za-z0-9\\{}[\]()+\-*/=.^_|,<>≤≥≠≈∥⊥∈√∛∜]+)*)/g;
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
    })
    .replace(
      /([A-Za-z0-9+\-*/^_()\\]+(?:=|≤|≥|<|>)[^，。；;\n]+)[；;]\s*([A-Za-z0-9+\-*/^_()\\]+(?:=|≤|≥|<|>)[^，。；;\n]+)/g,
      (_, left: string, right: string) => `\\begin{cases}${left.trim()}\\\\${right.trim()}\\end{cases}`,
    )
    .replace(
      /([A-Za-z0-9+\-*/^_()\\]+(?:=|≤|≥|<|>)[^\n]+)\n([A-Za-z0-9+\-*/^_()\\]+(?:=|≤|≥|<|>)[^\n]+)/g,
      (_, left: string, right: string) => `\\begin{cases}${left.trim()}\\\\${right.trim()}\\end{cases}`,
    );
}

function normalizeGeometryNotation(value: string): string {
  return value
    .replace(/([A-Z]{2})\s*∥\s*([A-Z]{2})/g, "$$$1\\parallel $2$")
    .replace(/([A-Z]{2})\s*⊥\s*([A-Z]{2})/g, "$$$1\\perp $2$")
    .replace(/∠\s*([A-Z]{3,4})/g, "$\\angle $1$")
    .replace(/△\s*([A-Z]{3,4})/g, "$\\triangle $1$")
    .replace(/([A-Z]{2})\s*=\s*([A-Z]{2})/g, "$$$1=$2$")
    .replace(/([A-Z]{1,2})([0-9]+)\s*∥\s*([A-Z]{1,2})([0-9]+)/g, "$$1_{$2}\\parallel $3_{$4}$");
}

function normalizeChainedMathLines(value: string): string {
  return value.replace(
    /(^|[\n])((?:[A-Za-z0-9_{}^()+\-*/\\]+|\\frac\{[^{}]+\}\{[^{}]+\}|\\sqrt(?:\[[^\]]+\])?\{[^{}]+\})(?:\s*[=≈≠≤≥<>]\s*(?:[A-Za-z0-9_{}^()+\-*/\\]+|\\frac\{[^{}]+\}\{[^{}]+\}|\\sqrt(?:\[[^\]]+\])?\{[^{}]+\})){2,})(?=$|[\n])/g,
    (_, prefix: string, expr: string) => `${prefix}$$${expr.trim()}$$`,
  );
}

function normalizeInequalityGroups(value: string): string {
  return value.replace(
    /\{([^{}]*(?:≤|≥|<|>)[^{}]*[，,；;\n][^{}]*(?:≤|≥|<|>)[^{}]*)\}/g,
    (matched, content: string) => {
      const parts = content
        .split(/[，,；;\n]/)
        .map((item) => item.trim())
        .filter(Boolean);

      return parts.length >= 2 ? `\\begin{cases}${parts.join("\\\\")}\\end{cases}` : matched;
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

function normalizeMalformedFractions(value: string): string {
  const inferBareFractionParts = (compact: string) => {
    const normalized = compact.replace(/\s+/g, "").replace(/[+\-]+$/, "");

    if (!normalized || normalized.includes("{") || normalized.includes("}")) {
      return null;
    }

    const matched = normalized.match(
      /^(.+)([A-Za-z](?:\^\{[^{}]+\}|\^[A-Za-z0-9]+)?(?:[+\-][A-Za-z0-9^()]+)+)$/,
    );

    if (!matched) {
      return null;
    }

    const numerator = matched[1]?.trim();
    const denominator = matched[2]?.trim();

    if (!numerator || !denominator) {
      return null;
    }

    return { numerator, denominator };
  };

  const inferLongFractionParts = (compact: string) => {
    const normalized = compact.replace(/\s+/g, "").replace(/[+\-]+$/, "");

    if (!normalized || normalized.includes("{") || normalized.includes("}")) {
      return null;
    }

    const tailPatterns = [
      /^(.*)(\([A-Za-z0-9+\-*/^]+\))$/,
      /^(.*)([A-Za-z](?:\^\{[^{}]+\}|\^[A-Za-z0-9]+)?(?:[+\-][A-Za-z0-9^()]+)+)$/,
      /^(.*)([A-Za-z](?:\^\{[^{}]+\}|\^[A-Za-z0-9]+)?)$/,
    ];

    for (const pattern of tailPatterns) {
      const matched = normalized.match(pattern);

      if (!matched) {
        continue;
      }

      const numerator = matched[1]?.trim();
      const denominator = matched[2]?.trim();

      if (!numerator || !denominator || numerator === denominator) {
        continue;
      }

      if (!/[A-Za-z0-9)]/.test(numerator) || !/[A-Za-z0-9)]/.test(denominator)) {
        continue;
      }

      return { numerator, denominator };
    }

    return null;
  };

  return value
    .replace(
      /\\(?:d?frac|tfrac)\s*([A-Za-z0-9]+)\s*([A-Za-z0-9^()+\-]+)(?=(?:\s|\\[A-Za-z]|[，,。.!！?？；;]|$))/g,
      (_, numerator: string, denominator: string) => {
        const cleanedDenominator = denominator.replace(/[+\-]+$/, "");
        if (!cleanedDenominator || !/[A-Za-z]/.test(cleanedDenominator)) {
          return `\\frac{${numerator}}{${denominator}}`;
        }
        return `\\frac{${numerator}}{${cleanedDenominator}}`;
      },
    )
    .replace(/\\(?:d?frac|tfrac)\s*\{([^{}]+)\}\s*([A-Za-z0-9^()+\-]+)(?=(?:\s|\\[A-Za-z]|[，,。.!！?？；;]|$))/g, "\\frac{$1}{$2}")
    .replace(
      /\\(?:d?frac|tfrac)\s*([^\\$，,。.!！?？；;\n]+?)(?=(?:[+\-]\s*\\(?:d?frac|tfrac))|[，,。.!！?？；;\n]|$)/g,
      (matched, expr: string) => {
        const inferred = inferBareFractionParts(expr) ?? inferLongFractionParts(expr);
        return inferred ? `\\frac{${inferred.numerator}}{${inferred.denominator}}` : matched;
      },
    );
}

function normalizeMalformedRoots(value: string): string {
  return value
    .replace(/\\sqrt\s*([A-Za-z0-9])(?=$|[\s，,。.!！?？；;)）])/g, "\\sqrt{$1}")
    .replace(/\\sqrt\{([^{}]+)\}\s*\^\{?([0-9]+)\}?/g, "(\\\\sqrt{$1})^{$2}")
    .replace(/\\sqrt\(([^()]+)\)/g, "\\sqrt{$1}");
}

function normalizeAbsoluteValues(value: string): string {
  return value
    .replace(/\|([^|\n]+)\|\s*\^\{?([0-9]+)\}?/g, "\\left|$1\\right|^{$2}")
    .replace(/\|([^|\n]+)\|/g, "\\left|$1\\right|");
}

function normalizeMalformedDollarMath(value: string): string {
  return value
    .replace(
      /\$([0-9]+)\$\s*(\\(?:d?frac|tfrac)\s*\{[^{}]+\}\s*\{[^{}]+\})/g,
      (_, integerPart: string, fractionPart: string) => `$${integerPart}${fractionPart}$`,
    )
    .replace(
      /((?:[A-Za-z0-9_{}^()+\-*/=±\\]+)\s*=\s*(?:[A-Za-z0-9_{}^()+\-*/=±\\]+|\\(?:d?frac|tfrac|sqrt)[\s\S]*?))\$\$(?=[。.!！?？；;，,）)]|$)/g,
      (_, expr: string) => `$${expr.trim()}$`,
    )
    .replace(
      /(\\(?:d?frac|tfrac|sqrt)(?:\[[^\]]+\])?(?:\{[^{}]+\}|[A-Za-z0-9])(?:\s*\{[^{}]+\})?)\$\$(?=[。.!！?？；;，,）)]|$)/g,
      (_, expr: string) => `$${expr.trim()}$`,
    )
    .replace(/\$\$(?=[。.!！?？；;，,）)]|$)/g, "");
}

function escapeHtmlRaw(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeBareLatex(value: string): string {
  return normalizeMalformedDollarMath(
    normalizeChainedMathLines(
      normalizeGeometryNotation(
        normalizeInequalityGroups(
          normalizeAbsoluteValues(
            normalizeMalformedRoots(
              normalizeMalformedFractions(
                normalizeGeometryPointLabels(
                  normalizeImplicitSubscripts(
                    normalizeUnicodeScripts(
                      normalizeUnicodeOperators(normalizeEquationSystems(normalizeUnicodeRoots(value))),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
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
      /(^|[^$\\])((?:[A-Za-z](?:_[A-Za-z0-9]+|\^\{[^{}]+\})?|[0-9()+\-*/=,^_{}[\]\\±√∛∜]|\\[A-Za-z]+)+)/g,
      (matched, prefix: string, expr: string) => {
        const compact = expr.trim();

        if (
          !compact ||
          compact.startsWith("$") ||
          !looksLikeMathSegment(compact) ||
          !/[\\_^=+\-*/√∛∜±]|[A-Za-z]_[A-Za-z0-9]+/.test(compact)
        ) {
          return matched;
        }

        return `${prefix}$${compact}$`;
      },
    )
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

function repairFormulaForKatex(value: string): string {
  return value
    .trim()
    .replace(/\$\$/g, "")
    .replace(/\$\(/g, "(")
    .replace(/\)\$/g, ")")
    .replace(/\$([A-Za-z0-9])/g, "$1")
    .replace(/([A-Za-z0-9)])\$/g, "$1")
    .replace(/\s+/g, " ");
}

function looksLikeDisplayMathLine(value: string): boolean {
  const compact = repairFormulaForKatex(value).trim();

  if (!compact) {
    return false;
  }

  const relationCount = (compact.match(/[=≈≠≤≥<>]/g) ?? []).length;

  return (
    /^[=≈≠≤≥<>+\-±∴∵]/.test(compact) ||
    /^\\(?:begin|frac|dfrac|tfrac|sqrt)/.test(compact) ||
    relationCount >= 2
  );
}

function renderMathToken(value: string, display: boolean): string {
  const repaired = repairFormulaForKatex(value);

  try {
    return katex.renderToString(repaired, {
      displayMode: display,
      throwOnError: true,
      strict: "ignore",
      trust: false,
      output: "mathml",
    });
  } catch {
    return escapeHtmlRaw(renderMathText(repaired));
  }
}

export function renderMathHtml(value: string): string {
  return tokenizeMath(value)
    .map((token) =>
      token.type === "math"
        ? renderMathToken(token.value, token.display)
        : escapeHtmlRaw(renderMathText(token.value)),
    )
    .join("");
}

export function renderMathParagraphsHtml(value: string): string {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      looksLikeDisplayMathLine(line)
        ? `<p class="math-display-line">${renderMathToken(line, true)}</p>`
        : `<p>${renderMathHtml(line)}</p>`,
    )
    .join("");
}

export function escapeHtmlWithoutMath(value: string): string {
  return escapeHtmlRaw(value);
}
