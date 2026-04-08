import { generateLessonPackage } from "@/lib/services/generate-lesson-package";
import {
  createGenerationJob,
  getGenerationJob,
  updateGenerationJob,
} from "@/lib/storage/generation-jobs-store";
import type { GenerateRequest } from "@/lib/types/lesson-package";

const runningJobs = new Set<string>();

export async function enqueueGenerationJob(input: GenerateRequest) {
  const job = await createGenerationJob(input);
  void runGenerationJob(job.id);
  return job;
}

export async function readGenerationJob(jobId: string) {
  return getGenerationJob(jobId);
}

async function runGenerationJob(jobId: string) {
  if (runningJobs.has(jobId)) {
    return;
  }

  runningJobs.add(jobId);

  try {
    const job = await getGenerationJob(jobId);

    if (!job) {
      return;
    }

    await updateGenerationJob(jobId, {
      status: "running",
      error: "",
    });

    const result = await generateLessonPackage(job.input);

    await updateGenerationJob(jobId, {
      status: "completed",
      result,
      error: "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成失败。";

    await updateGenerationJob(jobId, {
      status: "failed",
      error: message,
    });
  } finally {
    runningJobs.delete(jobId);
  }
}
