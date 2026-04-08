import type { ModelProviderName } from "@/lib/types/lesson-package";

export type ConfigurableProviderName = Exclude<ModelProviderName, "anthropic">;
export type ApiKeySource = "builtin" | "custom";
export type PrimaryModelMode = "builtin" | "custom";

export type ModelConnectionSettings = {
  provider: ConfigurableProviderName;
  model: string;
  baseUrl: string;
  apiKey: string;
  apiKeySource: ApiKeySource;
  enabled: boolean;
};

export type ModelSettings = {
  primaryMode: PrimaryModelMode;
  builtinPrimaryModel: string;
  primaryCustom: ModelConnectionSettings;
  backup: ModelConnectionSettings;
  autoFallback: boolean;
  updatedAt: string;
};

export type ResolvedModelSettings = {
  primaryMode: PrimaryModelMode;
  builtinPrimaryModel: string;
  primary: ModelConnectionSettings;
  primaryCustom: ModelConnectionSettings;
  backup: ModelConnectionSettings;
  autoFallback: boolean;
  updatedAt: string;
};
