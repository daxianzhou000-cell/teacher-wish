import { NextResponse } from "next/server";

import { parseGenerateRequest } from "@/lib/domain/lesson-package-input";
import {
  enqueueGenerationJob,
  readGenerationJob,
} from "@/lib/services/generation-jobs";

export async function POST(request: Request) {
  try {
    const input = parseGenerateRequest(await request.json());

    if (!input) {
      return NextResponse.json(
        { error: "缺少必要字段，请检查输入。" },
        { status: 400 },
      );
    }

    const job = await enqueueGenerationJob(input);

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成失败。";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "缺少 jobId。" }, { status: 400 });
  }

  const job = await readGenerationJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "生成任务不存在。" }, { status: 404 });
  }

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    data: job.result,
    input: job.input,
    error: job.error || undefined,
  });
}
