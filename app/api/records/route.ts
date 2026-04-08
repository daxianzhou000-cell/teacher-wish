import { NextResponse } from "next/server";

import { parseCreateRecordInput } from "@/lib/domain/student-progress-input";
import { createTutoringRecord } from "@/lib/repositories/student-progress";
import { buildNextStepSuggestion } from "@/lib/services/next-step-suggestion";

export async function POST(request: Request) {
  try {
    const input = parseCreateRecordInput(await request.json());

    if (!input) {
      return NextResponse.json({ error: "补课记录信息不完整。" }, { status: 400 });
    }

    const hasEnoughProgress = Boolean(input.masteryLevel);
    const nextStepSuggestion = hasEnoughProgress
      ? buildNextStepSuggestion({
          topic: input.topic,
          studentLevel: input.generateRequest.studentLevel,
          masteryLevel: input.masteryLevel!,
          teacherFeedback: input.teacherFeedback,
        })
      : "";

    const data = await createTutoringRecord({
      studentId: input.studentId,
      date: input.date,
      topic: input.topic,
      learningThreadId: input.learningThreadId ?? "",
      previousRecordId: input.previousRecordId,
      nextRecordId: null,
      lessonPackage: input.lessonPackage,
      teacherFeedback: input.teacherFeedback,
      masteryLevel: input.masteryLevel,
      nextStepSuggestion,
      stage: hasEnoughProgress ? "feedback" : "package",
      generateRequest: input.generateRequest,
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存补课记录失败。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
