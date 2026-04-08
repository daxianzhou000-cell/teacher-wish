import type { LessonPackageProvider } from "@/lib/providers/types";

export const anthropicLessonPackageProvider: LessonPackageProvider = {
  name: "anthropic",
  async generateLessonPackage() {
    throw new Error("Anthropic provider 尚未接入。");
  },
};
