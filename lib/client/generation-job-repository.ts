"use client";

import {
  readCachedGenerationJob,
  removeCachedGenerationJob,
  writeCachedGenerationJob,
} from "@/lib/client/generation-job-cache";
import type {
  GenerateRequest,
  GenerateResult,
} from "@/lib/types/lesson-package";

type ErrorPayload = {
  error?: string;
};

export type ClientGenerationJobStatus = "pending" | "running" | "completed" | "failed";

export type ClientGenerationJob = {
  jobId: string;
  status: ClientGenerationJobStatus;
  input?: GenerateRequest;
  data?: GenerateResult;
  error?: string;
};

function normalizeJobPayload(
  payload: Partial<ClientGenerationJob> & ErrorPayload,
  fallbackJobId?: string,
): ClientGenerationJob | null {
  const jobId = payload.jobId ?? fallbackJobId;
  const status = payload.status;

  if (
    !jobId ||
    (status !== "pending" &&
      status !== "running" &&
      status !== "completed" &&
      status !== "failed")
  ) {
    return null;
  }

  return {
    jobId,
    status,
    input: payload.input,
    data: payload.data,
    error: payload.error,
  };
}

async function parseJobResponse(
  response: Response,
  fallbackJobId?: string,
): Promise<ClientGenerationJob> {
  const payload = (await response.json()) as Partial<ClientGenerationJob> & ErrorPayload;

  if (!response.ok) {
    throw new Error(payload.error || "生成任务请求失败。");
  }

  const normalized = normalizeJobPayload(payload, fallbackJobId);

  if (!normalized) {
    throw new Error("生成任务返回格式异常。");
  }

  await writeCachedGenerationJob(normalized);
  return normalized;
}

export async function createGenerationJob(
  input: GenerateRequest,
): Promise<ClientGenerationJob> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const job = await parseJobResponse(response);
  await writeCachedGenerationJob({
    jobId: job.jobId,
    status: job.status,
    input,
    data: job.data,
    error: job.error,
  });
  return {
    ...job,
    input,
  };
}

export async function fetchGenerationJob(
  jobId: string,
): Promise<ClientGenerationJob> {
  const response = await fetch(`/api/generate?jobId=${jobId}`, {
    cache: "no-store",
  });

  return parseJobResponse(response, jobId);
}

export async function hydrateGenerationJob(
  jobId: string,
): Promise<ClientGenerationJob | null> {
  const cached = await readCachedGenerationJob(jobId);
  return cached;
}

export async function failGenerationJob(
  jobId: string,
  error: string,
  input?: GenerateRequest,
): Promise<void> {
  await writeCachedGenerationJob({
    jobId,
    status: "failed",
    input,
    error,
  });
}

export async function clearGenerationJobCache(jobId: string): Promise<void> {
  await removeCachedGenerationJob(jobId);
}
