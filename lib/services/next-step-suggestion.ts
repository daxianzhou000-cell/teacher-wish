import type { GenerateRequest } from "@/lib/types/lesson-package";
import type { MasteryLevel } from "@/lib/types/student-progress";

const masteryStrategies: Record<MasteryLevel, string> = {
  未掌握: "下一次先回到同一知识点的基础概念和最小题型，重新建立解题步骤。",
  一般: "下一次建议继续围绕同一知识点做分层训练，先稳住基础，再逐步加入变式题。",
  基本掌握: "下一次可以从本知识点过渡到相邻考点，重点练综合应用和审题速度。",
  熟练: "下一次建议进入拔高或综合复盘，重点做跨知识点迁移和限时训练。",
};

const levelStrategies: Record<GenerateRequest["studentLevel"], string> = {
  基础薄弱: "建议保留更多口头复述、例题跟做和错题回讲环节。",
  普通: "建议维持“讲解 + 练习 + 讲评”节奏，重点加强易错点复盘。",
  提分: "建议增加高频变式、得分点总结和限时训练。",
};

const followUpTopicStrategies: Record<MasteryLevel, string> = {
  未掌握: "基础回炉与步骤重建",
  一般: "巩固训练与变式提升",
  基本掌握: "综合应用与易错突破",
  熟练: "综合迁移与提分训练",
};

export function buildNextStepSuggestion(params: {
  topic: string;
  studentLevel: GenerateRequest["studentLevel"];
  masteryLevel: MasteryLevel;
  teacherFeedback: string;
}): string {
  const feedback = params.teacherFeedback.trim();
  const feedbackHint = feedback
    ? `结合本次老师反馈“${feedback}”，下一次补习时应先针对暴露出的薄弱环节做 5-10 分钟诊断。`
    : "下一次补习前可先用 2-3 题快速诊断上节内容是否真正保留。";

  return [
    `围绕“${params.topic}”继续安排下一次补习。`,
    masteryStrategies[params.masteryLevel],
    levelStrategies[params.studentLevel],
    feedbackHint,
  ].join("");
}

export function buildFollowUpTopic(params: {
  topic: string;
  masteryLevel: MasteryLevel;
}): string {
  return `${params.topic} · ${followUpTopicStrategies[params.masteryLevel]}`;
}
