import { requestOpenAICompatibleLessonPackage } from "@/lib/providers/shared/openai-compatible";
import type { LessonPackageProvider } from "@/lib/providers/types";

export const customLessonPackageProvider: LessonPackageProvider = {
  name: "custom",
  async generateLessonPackage(input, context) {
    return requestOpenAICompatibleLessonPackage(input, context, {
      apiKey: process.env.CUSTOM_API_KEY,
      baseUrl: process.env.CUSTOM_BASE_URL || "",
      model: process.env.CUSTOM_MODEL || "",
      providerLabel: "自定义模型",
    });
  },
};
