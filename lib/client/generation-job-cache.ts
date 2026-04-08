"use client";

import { getAppMeta, removeAppMeta, setAppMeta } from "@/lib/client/app-meta-store";
import type { GenerateRequest, GenerateResult } from "@/lib/types/lesson-package";

type CachedGenerationJob = {
  jobId: string;
  status: "pending" | "running" | "completed" | "failed";
  input?: GenerateRequest;
  data?: GenerateResult;
  error?: string;
  updatedAt: string;
};

function getGenerationJobCacheKey(jobId: string) {
  return `generation-job-cache:${jobId}`;
}

export async function readCachedGenerationJob(
  jobId: string,
): Promise<CachedGenerationJob | null> {
  const value = await getAppMeta(getGenerationJobCacheKey(jobId));

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as CachedGenerationJob;
  } catch {
    await removeCachedGenerationJob(jobId);
    return null;
  }
}

export async function writeCachedGenerationJob(
  payload: Omit<CachedGenerationJob, "updatedAt">,
): Promise<void> {
  await setAppMeta(
    getGenerationJobCacheKey(payload.jobId),
    JSON.stringify({
      ...payload,
      updatedAt: new Date().toISOString(),
    } satisfies CachedGenerationJob),
  );
}

export async function removeCachedGenerationJob(jobId: string): Promise<void> {
  await removeAppMeta(getGenerationJobCacheKey(jobId));
}
