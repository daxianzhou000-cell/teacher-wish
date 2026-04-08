import { ModelSettingsPage } from "@/components/model-settings-page";
import {
  getDefaultModelSettings,
  getBuiltinPrimaryConnection,
  getBuiltinApiKeyAvailability,
} from "@/lib/storage/model-settings-store";

export default async function ModelSettingsRoute() {
  const settings = getDefaultModelSettings();
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
