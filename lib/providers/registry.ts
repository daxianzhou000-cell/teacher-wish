import { anthropicLessonPackageProvider } from "@/lib/providers/anthropic/provider";
import { customLessonPackageProvider } from "@/lib/providers/custom/provider";
import { mockLessonPackageProvider } from "@/lib/providers/mock/provider";
import { openAILessonPackageProvider } from "@/lib/providers/openai/provider";
import type { LessonPackageProvider } from "@/lib/providers/types";
import type { ModelProviderName } from "@/lib/types/lesson-package";

const providerMap: Record<ModelProviderName, LessonPackageProvider> = {
  mock: mockLessonPackageProvider,
  openai: openAILessonPackageProvider,
  anthropic: anthropicLessonPackageProvider,
  custom: customLessonPackageProvider,
};

export function resolveModelProviderName(): ModelProviderName {
  const value = process.env.MODEL_PROVIDER;

  if (
    value === "mock" ||
    value === "openai" ||
    value === "anthropic" ||
    value === "custom"
  ) {
    return value;
  }

  return "mock";
}

export function getLessonPackageProvider(): LessonPackageProvider {
  return providerMap[resolveModelProviderName()];
}

export function getLessonPackageProviderByName(
  providerName: ModelProviderName,
): LessonPackageProvider {
  return providerMap[providerName];
}
