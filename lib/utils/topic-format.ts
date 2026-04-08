function normalizeTopic(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function extractBaseTopic(topic: string): string {
  const normalized = normalizeTopic(topic);

  if (!normalized) {
    return "";
  }

  const [baseTopic] = normalized.split(/\s*[·•｜|]\s*/);

  return (baseTopic ?? normalized).trim();
}

function toChineseNumber(value: number): string {
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

  if (value <= 0) {
    return "零";
  }

  if (value < 10) {
    return digits[value] ?? String(value);
  }

  if (value < 20) {
    return `十${value === 10 ? "" : digits[value - 10]}`;
  }

  if (value < 100) {
    const tens = Math.floor(value / 10);
    const ones = value % 10;
    return `${digits[tens]}十${ones === 0 ? "" : digits[ones]}`;
  }

  return String(value);
}

export function formatAttemptLabel(attemptIndex: number): string {
  const safeIndex = Number.isFinite(attemptIndex) && attemptIndex > 0 ? Math.floor(attemptIndex) : 1;
  return `第${toChineseNumber(safeIndex)}次`;
}

export function formatTopicSummary(topic: string, attemptCount: number): string {
  const baseTopic = extractBaseTopic(topic) || "当前主题";
  const safeCount = Number.isFinite(attemptCount) && attemptCount > 0 ? Math.floor(attemptCount) : 1;

  return `${baseTopic}（${safeCount}）`;
}

export function buildLessonPackageFileName(params: {
  studentName?: string | null;
  topic: string;
  attemptIndex?: number | null;
}): string {
  const baseTopic = extractBaseTopic(params.topic) || "补课备课包";
  const parts = [params.studentName?.trim(), baseTopic].filter(Boolean) as string[];

  if (params.attemptIndex && params.attemptIndex > 0) {
    parts.push(formatAttemptLabel(params.attemptIndex));
  }

  return parts.join("+") || "补课备课包";
}
