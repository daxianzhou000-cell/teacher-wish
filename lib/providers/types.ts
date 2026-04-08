import type { GenerateRequest, ModelProviderName } from "@/lib/types/lesson-package";
import type { ModelConnectionSettings } from "@/lib/types/model-settings";

export type ProviderContext = {
  prompt: {
    system: string;
    user: string;
  };
  config: ModelConnectionSettings;
};

export interface LessonPackageProvider {
  readonly name: ModelProviderName;
  generateLessonPackage(
    input: GenerateRequest,
    context: ProviderContext,
  ): Promise<unknown>;
}
