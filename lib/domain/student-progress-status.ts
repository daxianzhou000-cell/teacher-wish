import type { TutoringRecord } from "@/lib/types/student-progress";

export function isFeedbackCompleted(record: Pick<TutoringRecord, "teacherFeedback" | "masteryLevel" | "nextStepSuggestion" | "stage">): boolean {
  if (record.stage === "feedback") {
    return true;
  }

  return Boolean(
    record.masteryLevel &&
      record.nextStepSuggestion.trim(),
  );
}

export function getRecordStageLabel(
  record: Pick<TutoringRecord, "teacherFeedback" | "masteryLevel" | "nextStepSuggestion" | "stage">,
): string {
  return isFeedbackCompleted(record) ? "已完成反馈" : "待补反馈";
}

export function getRecordActionLabel(
  record: Pick<TutoringRecord, "teacherFeedback" | "masteryLevel" | "nextStepSuggestion" | "stage">,
): string {
  return isFeedbackCompleted(record) ? "更新记录" : "补充反馈";
}
