import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  GenerateRequest,
  GenerateResult,
  LessonPackage,
  StageTestResult,
} from "@/lib/types/lesson-package";
import type { ModelSettings } from "@/lib/types/model-settings";

export type GenerationJobStatus = "pending" | "running" | "completed" | "failed";

export type GenerationJob = {
  id: string;
  input: GenerateRequest;
  modelSettings: ModelSettings | null;
  status: GenerationJobStatus;
  result: GenerateResult | null;
  error: string;
  createdAt: string;
  updatedAt: string;
};

type GenerationJobFile = {
  jobs: GenerationJob[];
};

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "generation-jobs.json");

const defaultData: GenerationJobFile = {
  jobs: [],
};
const ACTIVE_JOB_STALE_AFTER_MS = 3 * 60 * 1000;
let generationJobStorageAvailable: boolean | null = null;
let memoryData: GenerationJobFile = defaultData;

function isGenerationJobStatus(value: unknown): value is GenerationJobStatus {
  return value === "pending" || value === "running" || value === "completed" || value === "failed";
}

function shouldFailStaleActiveJob(job: GenerationJob): boolean {
  if (job.status !== "pending" && job.status !== "running") {
    return false;
  }

  const updatedAt = new Date(job.updatedAt).getTime();

  if (Number.isNaN(updatedAt)) {
    return true;
  }

  return Date.now() - updatedAt > ACTIVE_JOB_STALE_AFTER_MS;
}

function recoverJob(job: GenerationJob): GenerationJob {
  if (!shouldFailStaleActiveJob(job)) {
    return job;
  }

  return {
    ...job,
    status: "failed",
    error: "任务在等待期间中断了，可能是服务重启或刷新导致。请重新发起生成。",
    updatedAt: new Date().toISOString(),
  };
}

function normalizeJobResult(value: unknown): GenerateResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    record.mode === "single" &&
    record.lessonPackage &&
    typeof record.lessonPackage === "object"
  ) {
    return record as GenerateResult;
  }

  if (
    record.mode === "follow_up" &&
    record.lessonPackage &&
    typeof record.lessonPackage === "object" &&
    record.nextLessonSuggestion &&
    typeof record.nextLessonSuggestion === "object"
  ) {
    return record as GenerateResult;
  }

  if (
    record.mode === "stage_test" &&
    record.stageTest &&
    typeof record.stageTest === "object"
  ) {
    return record as GenerateResult;
  }

  if (
    "title" in record &&
    "topicsCovered" in record &&
    "questions" in record &&
    "answerAnalysis" in record
  ) {
    return {
      mode: "stage_test",
      stageTest: value as StageTestResult,
    };
  }

  return {
    mode: "single",
    lessonPackage: value as LessonPackage,
  };
}

async function ensureDataFile(): Promise<boolean> {
  if (generationJobStorageAvailable === false) {
    return false;
  }

  try {
    await mkdir(dataDir, { recursive: true });

    try {
      await readFile(dataFile, "utf-8");
    } catch {
      await writeFile(dataFile, JSON.stringify(defaultData, null, 2), "utf-8");
    }

    generationJobStorageAvailable = true;
    return true;
  } catch {
    generationJobStorageAvailable = false;
    return false;
  }
}

async function readData(): Promise<GenerationJobFile> {
  const storageAvailable = await ensureDataFile();

  if (!storageAvailable) {
    return memoryData;
  }

  try {
    const content = await readFile(dataFile, "utf-8");
    const parsed = JSON.parse(content) as Partial<GenerationJobFile>;
    let didRecoverActiveJob = false;

    const normalized = {
      jobs: Array.isArray(parsed.jobs)
        ? parsed.jobs
            .map((job) => {
              if (!job || typeof job !== "object") {
                return null;
              }

              const record = job as Partial<GenerationJob>;

              if (
                typeof record.id !== "string" ||
                !isGenerationJobStatus(record.status) ||
                typeof record.error !== "string" ||
                typeof record.createdAt !== "string" ||
                typeof record.updatedAt !== "string" ||
                !record.input
              ) {
                return null;
              }

              const nextJob = recoverJob({
                id: record.id,
                input: record.input,
                modelSettings:
                  record.modelSettings && typeof record.modelSettings === "object"
                    ? (record.modelSettings as ModelSettings)
                    : null,
                status: record.status,
                result: normalizeJobResult(record.result),
                error: record.error,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt,
              } satisfies GenerationJob);

              if (nextJob !== null && nextJob.status === "failed" && record.status !== "failed") {
                didRecoverActiveJob = true;
              }

              return nextJob;
            })
            .filter((job): job is GenerationJob => job !== null)
        : [],
    };

    if (didRecoverActiveJob) {
      await writeData(normalized);
    }

    memoryData = normalized;
    return normalized;
  } catch {
    return memoryData;
  }
}

async function writeData(data: GenerationJobFile) {
  memoryData = data;

  const storageAvailable = await ensureDataFile();
  if (!storageAvailable) {
    return;
  }

  try {
    await writeFile(dataFile, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    generationJobStorageAvailable = false;
  }
}

export async function createGenerationJob(
  input: GenerateRequest,
  modelSettings: ModelSettings | null = null,
): Promise<GenerationJob> {
  const data = await readData();
  const now = new Date().toISOString();
  const job: GenerationJob = {
    id: randomUUID(),
    input,
    modelSettings,
    status: "pending",
    result: null,
    error: "",
    createdAt: now,
    updatedAt: now,
  };

  data.jobs.unshift(job);
  data.jobs = data.jobs.slice(0, 40);
  await writeData(data);

  return job;
}

export async function getGenerationJob(jobId: string): Promise<GenerationJob | null> {
  const data = await readData();
  return data.jobs.find((job) => job.id === jobId) ?? null;
}

export async function updateGenerationJob(
  jobId: string,
  patch: Partial<Pick<GenerationJob, "status" | "result" | "error">>,
): Promise<GenerationJob | null> {
  const data = await readData();
  const job = data.jobs.find((item) => item.id === jobId);

  if (!job) {
    return null;
  }

  if (patch.status) {
    job.status = patch.status;
  }

  if (patch.result !== undefined) {
    job.result = patch.result;
  }

  if (patch.error !== undefined) {
    job.error = patch.error;
  }

  job.updatedAt = new Date().toISOString();
  await writeData(data);
  return job;
}
