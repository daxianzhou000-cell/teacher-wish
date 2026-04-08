"use client";

import {
  readCachedGenerationJob,
  removeCachedGenerationJob,
  writeCachedGenerationJob,
} from "@/lib/client/generation-job-cache";
import { readCachedModelSettings } from "@/lib/client/model-settings-cache";
import { shouldUseLocalPrimaryStorage } from "@/lib/client/storage-mode";
import { normalizeGenerateResult } from "@/lib/normalizers/follow-up-generation";
import { buildLessonPackagePrompt } from "@/lib/prompts/lesson-package";
import { buildMockLessonPackage, buildMockStageTest } from "@/lib/providers/mock/data";
import { requestOpenAICompatibleLessonPackage } from "@/lib/providers/shared/openai-compatible";
import type {
  GenerateRequestEnvelope,
  GenerateRequest,
  GenerateResult,
} from "@/lib/types/lesson-package";
import type { ModelConnectionSettings, ModelSettings } from "@/lib/types/model-settings";

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

const ACTIVE_CACHE_STALE_AFTER_MS = 5 * 1000;

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

function buildDirectGenerationAttempts(settings: ModelSettings | null): ModelConnectionSettings[] {
  if (!settings) {
    return [];
  }

  const attempts: ModelConnectionSettings[] = [];

  if (settings.primaryMode === "custom") {
    const primary = {
      ...settings.primaryCustom,
      apiKey: settings.primaryCustom.apiKey.trim(),
    };

    if (
      primary.provider === "mock" ||
      (primary.enabled && primary.baseUrl.trim() && primary.model.trim() && primary.apiKey.trim())
    ) {
      attempts.push(primary);
    }
  }

  const backup = {
    ...settings.backup,
    apiKey: settings.backup.apiKey.trim(),
  };

  if (
    settings.autoFallback &&
    backup.enabled &&
    (backup.provider === "mock" ||
      (backup.baseUrl.trim() && backup.model.trim() && backup.apiKey.trim()))
  ) {
    attempts.push(backup);
  }

  return attempts;
}

function isBuiltinPrimarySelected(settings: ModelSettings | null): boolean {
  return settings?.primaryMode === "builtin";
}

async function generateDirectly(
  input: GenerateRequest,
  settings: ModelSettings | null,
): Promise<GenerateResult> {
  const attempts = buildDirectGenerationAttempts(settings);

  if (!attempts.length) {
    throw new Error("当前环境无法直接本地生成，请先使用用户自配主模型或保留可用备用模型。");
  }

  const prompt = buildLessonPackagePrompt(input);
  const errors: string[] = [];

  for (const config of attempts) {
    try {
      if (config.provider === "mock") {
        const raw =
          input.mode === "stage_test" ? buildMockStageTest(input) : buildMockLessonPackage(input);
        return normalizeGenerateResult(input, raw);
      }

      const providerLabel = config.provider === "openai" ? "OpenAI" : "自定义模型";
      const raw = await requestOpenAICompatibleLessonPackage(
        input,
        {
          prompt,
          config,
        },
        {
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
          providerLabel,
        },
      );

      return normalizeGenerateResult(input, raw);
    } catch (error) {
      errors.push(
        `${config.provider}: ${error instanceof Error ? error.message : "模型调用失败。"}`,
      );
    }
  }

  throw new Error(errors.join("；") || "本地生成失败。");
}

async function createLocalGenerationJob(
  input: GenerateRequest,
  modelSettings: ModelSettings | null,
): Promise<ClientGenerationJob> {
  const jobId = crypto.randomUUID();
  await writeCachedGenerationJob({
    jobId,
    status: "running",
    input,
  });

  try {
    const data = await generateDirectly(input, modelSettings);
    const completed: ClientGenerationJob = {
      jobId,
      status: "completed",
      input,
      data,
    };
    await writeCachedGenerationJob(completed);
    return completed;
  } catch (error) {
    const failed: ClientGenerationJob = {
      jobId,
      status: "failed",
      input,
      error: error instanceof Error ? error.message : "本地生成失败。",
    };
    await writeCachedGenerationJob(failed);
    throw error;
  }
}

async function shouldUseDirectGeneration(modelSettings: ModelSettings | null): Promise<boolean> {
  if (!(await shouldUseLocalPrimaryStorage())) {
    return false;
  }

  if (isBuiltinPrimarySelected(modelSettings)) {
    return false;
  }

  return buildDirectGenerationAttempts(modelSettings).length > 0;
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
  const modelSettings = await readCachedModelSettings();
  const payload: GenerateRequestEnvelope = {
    input,
    modelSettings: modelSettings ?? undefined,
  };

  if (await shouldUseDirectGeneration(modelSettings)) {
    return createLocalGenerationJob(input, modelSettings);
  }

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
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
  } catch (error) {
    if ((await shouldUseLocalPrimaryStorage()) && !isBuiltinPrimarySelected(modelSettings)) {
      return createLocalGenerationJob(input, modelSettings);
    }

    throw error;
  }
}

export async function fetchGenerationJob(
  jobId: string,
): Promise<ClientGenerationJob> {
  const cached = await readCachedGenerationJob(jobId);

  if (await shouldUseLocalPrimaryStorage()) {
    if (cached && (cached.status === "completed" || cached.status === "failed")) {
      return cached;
    }
  }

  try {
    const response = await fetch(`/api/generate?jobId=${jobId}`, {
      cache: "no-store",
    });

    return parseJobResponse(response, jobId);
  } catch (error) {
    if (cached) {
      if (
        (cached.status === "pending" || cached.status === "running") &&
        Date.now() - new Date(cached.updatedAt).getTime() > ACTIVE_CACHE_STALE_AFTER_MS
      ) {
        throw new Error("任务在等待期间中断了，请重新发起生成。");
      }

      if (cached.status === "completed" || cached.status === "failed") {
        return cached;
      }
    }

    throw error;
  }
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
