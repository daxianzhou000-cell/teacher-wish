import { normalizeGenerateResult } from "@/lib/normalizers/follow-up-generation";
import { buildLessonPackagePrompt } from "@/lib/prompts/lesson-package";
import { getLessonPackageProviderByName } from "@/lib/providers/registry";
import {
  readResolvedModelSettings,
  resolveModelSettings,
} from "@/lib/storage/model-settings-store";
import type { GenerateRequest, GenerateResult } from "@/lib/types/lesson-package";
import type { ModelConnectionSettings, ModelSettings } from "@/lib/types/model-settings";

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

    try {
      const rawResult = await provider.generateLessonPackage(input, { prompt, config });
      return normalizeGenerateResult(input, rawResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : "模型调用失败。";
      errors.push(`${config.provider}: ${message}`);
    }
  }

  throw new Error(errors.join("；") || "生成失败。");
}
