import { ModelSettingsPage } from "@/components/model-settings-page";
import {
  getBuiltinPrimaryConnection,
  getBuiltinApiKeyAvailability,
  readModelSettings,
} from "@/lib/storage/model-settings-store";

export const dynamic = "force-dynamic";

export default async function ModelSettingsRoute() {
  const settings = await readModelSettings();
  const builtinApiKeyAvailability = getBuiltinApiKeyAvailability();
  const builtinPrimary = getBuiltinPrimaryConnection(settings.builtinPrimaryModel);

  return (
    <ModelSettingsPage
      initialSettings={settings}
      builtinPrimary={builtinPrimary}
      builtinApiKeyAvailability={builtinApiKeyAvailability}
    />
  );
}
