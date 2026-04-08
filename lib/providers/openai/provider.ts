import { requestOpenAICompatibleLessonPackage } from "@/lib/providers/shared/openai-compatible";
import type { LessonPackageProvider } from "@/lib/providers/types";

export const openAILessonPackageProvider: LessonPackageProvider = {
  name: "openai",
  async generateLessonPackage(input, context) {
    return requestOpenAICompatibleLessonPackage(input, context, {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      providerLabel: "OpenAI",
    });
  },
};
