const superscriptMap: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  "=": "⁼",
  "(": "⁽",
  ")": "⁾",
  n: "ⁿ",
  i: "ⁱ",
};

const subscriptMap: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋",
  "=": "₌",
  "(": "₍",
  ")": "₎",
  a: "ₐ",
  e: "ₑ",
  h: "ₕ",
  i: "ᵢ",
  j: "ⱼ",
  k: "ₖ",
  l: "ₗ",
  m: "ₘ",
  n: "ₙ",
  o: "ₒ",
  p: "ₚ",
  r: "ᵣ",
  s: "ₛ",
  t: "ₜ",
  u: "ᵤ",
  v: "ᵥ",
  x: "ₓ",
};

function toUnicodeScript(value: string, map: Record<string, string>): string | null {
  const converted = Array.from(value).map((char) => map[char]);

  if (converted.some((char) => !char)) {
    return null;
  }

  return converted.join("");
}

function stripMathDelimiters(value: string): string {
  return value
    .replace(/[\uFFFD\u21B5\u23CE]/g, "")
    .replace(/[\u200B-\u200F\u2060\uFEFF]/g, "")
    .replace(/[\uE000-\uF8FF]/g, "")
    .replace(/\$\$([\s\S]*?)\$\$/g, "$1")
    .replace(/\$([^$\n]+)\$/g, "$1")
    .replace(/\\\(([\s\S]*?)\\\)/g, "$1")
    .replace(/\\\[([\s\S]*?)\\\]/g, "$1");
}

function replaceFractions(value: string): string {
  let next = value;
  const fractionPattern = /\\(?:d?frac|tfrac)\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g;

  while (fractionPattern.test(next)) {
    next = next.replace(fractionPattern, "($1)/($2)");
  }

  return next;
}

function replaceRoots(value: string): string {
  let next = value;
  const indexedRootPattern = /\\sqrt\s*\[([^\[\]]+)\]\s*\{([^{}]+)\}/g;
  const squareRootPattern = /\\sqrt\s*\{([^{}]+)\}/g;

  while (indexedRootPattern.test(next)) {
    next = next.replace(indexedRootPattern, (_, rawIndex: string, rawBody: string) => {
      const index = rawIndex.trim();
      const body = rawBody.trim();

      if (index === "2") {
        return /^[-+]?[\w\u4e00-\u9fa5]+$/u.test(body) ? `√${body}` : `√(${body})`;
      }

      if (index === "3") {
        return /^[-+]?[\w\u4e00-\u9fa5]+$/u.test(body) ? `∛${body}` : `∛(${body})`;
      }

      if (index === "4") {
        return /^[-+]?[\w\u4e00-\u9fa5]+$/u.test(body) ? `∜${body}` : `∜(${body})`;
      }

      const superscript = toUnicodeScript(index, superscriptMap) ?? `[${index}]`;
      return /^[-+]?[\w\u4e00-\u9fa5]+$/u.test(body) ? `${superscript}√${body}` : `${superscript}√(${body})`;
    });
  }

  while (squareRootPattern.test(next)) {
    next = next.replace(squareRootPattern, (_, rawBody: string) => {
      const body = rawBody.trim();
      return /^[-+]?[\w\u4e00-\u9fa5]+$/u.test(body) ? `√${body}` : `√(${body})`;
    });
  }

  return next;
}

function replaceScripts(value: string): string {
  return value
    .replace(/\^\{([^{}]+)\}/g, (_, script: string) => {
      const compact = script.trim();
      return toUnicodeScript(compact, superscriptMap) ?? `^(${compact})`;
    })
    .replace(/\^([A-Za-z0-9+-]+)/g, (_, script: string) => {
      const compact = script.trim();
      return toUnicodeScript(compact, superscriptMap) ?? `^(${compact})`;
    })
    .replace(/_\{([^{}]+)\}/g, (_, script: string) => {
      const compact = script.trim();
      return toUnicodeScript(compact, subscriptMap) ?? `₍${compact}₎`;
    })
    .replace(/_([A-Za-z0-9+-]+)/g, (_, script: string) => {
      const compact = script.trim();
      return toUnicodeScript(compact, subscriptMap) ?? `₍${compact}₎`;
    });
}

function replaceLatexFunctions(value: string): string {
  return value
    .replaceAll("\\%", "%")
    .replaceAll("\\degree", "°")
    .replaceAll("\\circ", "°")
    .replaceAll("\\pi", "π")
    .replaceAll("\\alpha", "α")
    .replaceAll("\\beta", "β")
    .replaceAll("\\gamma", "γ")
    .replaceAll("\\theta", "θ")
    .replaceAll("\\lambda", "λ")
    .replaceAll("\\mu", "μ")
    .replaceAll("\\Delta", "Δ")
    .replaceAll("\\triangle", "△")
    .replaceAll("\\angle", "∠")
    .replaceAll("\\overline", "")
    .replaceAll("\\overrightarrow", "")
    .replaceAll("\\vec", "")
    .replaceAll("\\text", "");
}

function cleanupLatexBraces(value: string): string {
  return value
    .replace(/\{([^{}]+)\}/g, "$1")
    .replace(/\s{2,}/g, " ");
}

function replaceLatexOperators(value: string): string {
  return value
    .replaceAll("\\times", "×")
    .replaceAll("\\cdot", "·")
    .replaceAll("\\div", "÷")
    .replaceAll("\\leq", "≤")
    .replaceAll("\\geq", "≥")
    .replaceAll("\\neq", "≠")
    .replaceAll("\\pm", "±")
    .replaceAll("\\mp", "∓")
    .replaceAll("\\approx", "≈")
    .replaceAll("\\sim", "∽")
    .replaceAll("\\parallel", "∥")
    .replaceAll("\\perp", "⊥")
    .replaceAll("\\because", "∵")
    .replaceAll("\\therefore", "∴")
    .replaceAll("\\infty", "∞")
    .replaceAll("\\in", "∈")
    .replaceAll("\\notin", "∉")
    .replaceAll("\\subseteq", "⊆")
    .replaceAll("\\supseteq", "⊇")
    .replaceAll("\\cup", "∪")
    .replaceAll("\\cap", "∩")
    .replaceAll("\\varnothing", "∅")
    .replaceAll("\\emptyset", "∅")
    .replaceAll("\\mid", "|")
    .replaceAll("\\to", "→")
    .replaceAll("\\rightarrow", "→")
    .replaceAll("\\leftarrow", "←")
    .replaceAll("\\left", "")
    .replaceAll("\\right", "");
}

export function renderMathText(value: string): string {
  return cleanupLatexBraces(
    replaceScripts(
      replaceLatexFunctions(
        replaceLatexOperators(replaceRoots(replaceFractions(stripMathDelimiters(value)))),
      ),
    ),
  ).trim();
}

export function containsReplacementChar(value: string): boolean {
  return value.includes("\uFFFD");
}
