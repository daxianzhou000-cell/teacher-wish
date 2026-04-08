import { NextResponse } from "next/server";

import { parseUpdateRecordInput } from "@/lib/domain/student-progress-input";
import {
  deleteTutoringRecord,
  getTutoringRecordById,
  updateTutoringRecord,
} from "@/lib/repositories/student-progress";
import { buildNextStepSuggestion } from "@/lib/services/next-step-suggestion";

export async function PATCH(
  request: Request,
  context: { params: { id: string } },
) {
  try {
    const input = parseUpdateRecordInput(await request.json());

    if (!input) {
      return NextResponse.json({ error: "补课记录信息不完整。" }, { status: 400 });
    }

    const existingRecord = await getTutoringRecordById(context.params.id);

    if (!existingRecord) {
      return NextResponse.json({ error: "补课记录不存在。" }, { status: 404 });
    }

    const hasEnoughProgress = Boolean(input.masteryLevel);
    const nextStepSuggestion = hasEnoughProgress
      ? buildNextStepSuggestion({
          topic: input.topic,
          studentLevel: existingRecord.generateRequest.studentLevel,
          masteryLevel: input.masteryLevel!,
          teacherFeedback: input.teacherFeedback,
        })
      : "";

    const data = await updateTutoringRecord(context.params.id, {
      ...input,
      nextStepSuggestion,
    });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新补课记录失败。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { id: string } },
) {
  try {
    await deleteTutoringRecord(context.params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除补课记录失败。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
