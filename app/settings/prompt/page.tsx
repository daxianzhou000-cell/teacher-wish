import { PromptSettingsPage } from "@/components/prompt-settings-page";
import { readPromptSettings } from "@/lib/storage/prompt-settings-store";

export const dynamic = "force-dynamic";

export default async function PromptSettingsRoute() {
  const settings = await readPromptSettings();

  return <PromptSettingsPage initialSettings={settings} />;
}
