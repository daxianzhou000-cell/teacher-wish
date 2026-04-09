import { normalizeGenerateResult } from "@/lib/normalizers/follow-up-generation";
import { buildLessonPackagePrompt } from "@/lib/prompts/lesson-package";
import { getLessonPackageProviderByName } from "@/lib/providers/registry";
import {
  readResolvedModelSettings,
  resolveModelSettings,
} from "@/lib/storage/model-settings-store";
import type { GenerateRequest, GenerateResult } from "@/lib/types/lesson-package";
import type { ModelConnectionSettings, ModelSettings } from "@/lib/types/model-settings";

function shouldRetryProviderError(message: string): boolean {
  return /memory overloaded|system memory|rate limit|too many requests|timeout|timed out|service unavailable|upstream|temporarily unavailable|overloaded|busy/i.test(
    message,
  );
}

function normalizeProviderErrorMessage(provider: string, message: string): string {
  if (/memory overloaded|system memory|overloaded|busy/i.test(message)) {
    return `${provider}：当前内置平台节点繁忙或资源不足，请稍后重试；若已配置备用模型，系统会自动尝试切换。`;
  }

  if (/rate limit|too many requests/i.test(message)) {
    return `${provider}：当前内置平台请求过多，已触发限流，请稍后再试。`;
  }

  if (/timeout|timed out|service unavailable|upstream|temporarily unavailable/i.test(message)) {
    return `${provider}：当前内置平台响应超时或上游服务不可用，请稍后重试。`;
  }

  return `${provider}: ${message}`;
}

async function waitBeforeRetry(delayMs: number) {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function generateLessonPackage(
  input: GenerateRequest,
  modelSettingsOverride?: ModelSettings,
): Promise<GenerateResult> {
  const settings = modelSettingsOverride
    ? resolveModelSettings(modelSettingsOverride, { includeRuntimeCache: true })
    : await readResolvedModelSettings();
  const prompt = buildLessonPackagePrompt(input);
  const attempts: ModelConnectionSettings[] = [];
  const errors: string[] = [];

  if (settings.primary.enabled) {
    attempts.push(settings.primary);
  }

  if (settings.backup.enabled) {
    if (!settings.primary.enabled) {
      attempts.push(settings.backup);
    } else if (settings.autoFallback) {
      attempts.push(settings.backup);
    }
  }

  if (attempts.length === 0) {
    throw new Error("当前没有启用可用模型。请在模型设置页至少启用一套模型配置。");
  }

  if (
    settings.primary.enabled &&
    settings.primary.provider === "mock" &&
    (settings.primary.model.trim() ||
      settings.primary.baseUrl.trim() ||
      settings.primary.apiKey.trim())
  ) {
    throw new Error(
      "当前主模型仍设置为 mock，不会真实调用 API。请到模型设置页把 Provider 改为 openai 或 custom，并填写正确的模型名称。",
    );
  }

  for (const config of attempts) {
    const provider = getLessonPackageProviderByName(config.provider);
    const providerLabel = config.provider === "custom" ? "内置模型" : config.provider;

    for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
      try {
        const rawResult = await provider.generateLessonPackage(input, { prompt, config });
        return normalizeGenerateResult(input, rawResult);
      } catch (error) {
        const message = error instanceof Error ? error.message : "模型调用失败。";
        const retryable = shouldRetryProviderError(message);
        const isLastTry = attemptIndex === 1;

        if (retryable && !isLastTry) {
          await waitBeforeRetry(800);
          continue;
        }

        errors.push(normalizeProviderErrorMessage(providerLabel, message));
        break;
      }
    }
  }

  throw new Error(errors.join("；") || "生成失败。");
}
