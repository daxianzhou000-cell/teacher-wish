export type GradeStage =
  | "小学高年级"
  | "初一"
  | "初二"
  | "初三";

function normalizeGrade(grade: string): string {
  return grade.trim().replace(/\s+/g, "");
}

export function resolveGradeStage(grade: string): GradeStage {
  const value = normalizeGrade(grade);

  if (
    value.includes("初一") ||
    value.includes("七年级") ||
    value.includes("7年级") ||
    value === "七" ||
    value === "7"
  ) {
    return "初一";
  }

  if (
    value.includes("初二") ||
    value.includes("八年级") ||
    value.includes("8年级") ||
    value === "八" ||
    value === "8"
  ) {
    return "初二";
  }

  if (
    value.includes("初三") ||
    value.includes("九年级") ||
    value.includes("9年级") ||
    value === "九" ||
    value === "9"
  ) {
    return "初三";
  }

  if (
    value.includes("小学五年级") ||
    value.includes("五年级") ||
    value.includes("5年级") ||
    value.includes("小学六年级") ||
    value.includes("六年级") ||
    value.includes("6年级")
  ) {
    return "小学高年级";
  }

  return "小学高年级";
}

export function buildGradeRoutingPrompt(grade: string): string {
  const stage = resolveGradeStage(grade);

  const rules: Record<GradeStage, string[]> = {
    小学高年级: [
      "当前学段：小学高年级。",
      "重点是更具象、少抽象，帮助学生先看懂、再会做。",
      "讲解要强调画面感、步骤感和基础理解，不要用过重术语压学生。",
    ],
    初一: [
      "当前学段：初一。",
      "重点是过渡与规范，帮助学生从小学思维平稳进入初中表达和方法。",
      "内容要先把标准做法讲稳，再逐步引入题型意识。",
    ],
    初二: [
      "当前学段：初二。",
      "重点是方法与变式，开始强化条件分析、思路迁移和中档综合训练。",
      "要帮助学生从“会做”走向“会变化、会判断”。",
    ],
    初三: [
      "当前学段：初三。",
      "重点是中考得分、综合迁移、规范答案和易错点规避。",
      "题目与解析都要更贴近考试实战，突出提分导向。",
    ],
  };

  return [
    "## 学段差异化策略",
    `当前学段判定：${stage}`,
    ...rules[stage],
  ].join("\n");
}
