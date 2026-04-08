import { NextResponse } from "next/server";

import {
  buildDefaultPromptSettings,
  readPromptSettings,
  writePromptSettings,
} from "@/lib/storage/prompt-settings-store";
import type { PromptSettings } from "@/lib/types/prompt-settings";

function normalizeText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export async function GET() {
  const data = await readPromptSettings();
  return NextResponse.json({ data });
}

export async function PATCH(request: Request) {
  try {
    const current = await readPromptSettings();
    const body = (await request.json()) as Partial<PromptSettings> & { resetToDefault?: boolean };

    if (body.resetToDefault) {
      const fallback = buildDefaultPromptSettings();
      await writePromptSettings(fallback);
      return NextResponse.json({ data: fallback });
    }

    const next: PromptSettings = {
      systemRole: normalizeText(body.systemRole, current.systemRole),
      lectureRequirements: normalizeText(body.lectureRequirements, current.lectureRequirements),
      exerciseRequirements: normalizeText(body.exerciseRequirements, current.exerciseRequirements),
      homeworkRequirements: normalizeText(body.homeworkRequirements, current.homeworkRequirements),
      parentFeedbackRequirements: normalizeText(
        body.parentFeedbackRequirements,
        current.parentFeedbackRequirements,
      ),
      outputRequirements: normalizeText(body.outputRequirements, current.outputRequirements),
      extraInstructions: normalizeText(body.extraInstructions, current.extraInstructions),
      updatedAt: new Date().toISOString(),
    };

    await writePromptSettings(next);
    return NextResponse.json({ data: next });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存提示词设置失败。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
