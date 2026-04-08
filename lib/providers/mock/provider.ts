import {
  buildMockLessonPackage,
  buildMockStageTest,
} from "@/lib/providers/mock/data";
import type { LessonPackageProvider } from "@/lib/providers/types";

export const mockLessonPackageProvider: LessonPackageProvider = {
  name: "mock",
  async generateLessonPackage(input) {
    if (input.mode === "stage_test") {
      return buildMockStageTest(input);
    }

    return buildMockLessonPackage(input);
  },
};
