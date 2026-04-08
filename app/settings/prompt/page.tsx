import { PromptSettingsPage } from "@/components/prompt-settings-page";
import { getDefaultPromptSettings } from "@/lib/storage/prompt-settings-store";

export default function PromptSettingsRoute() {
  const settings = getDefaultPromptSettings();

  return <PromptSettingsPage initialSettings={settings} />;
}
