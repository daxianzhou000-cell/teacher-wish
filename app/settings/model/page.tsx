import { ModelSettingsPage } from "@/components/model-settings-page";
import {
  getDefaultModelSettings,
  getBuiltinPrimaryConnection,
  getBuiltinPrimaryPresets,
  getBuiltinApiKeyAvailability,
} from "@/lib/storage/model-settings-store";

export default async function ModelSettingsRoute() {
  const settings = getDefaultModelSettings();
  const builtinApiKeyAvailability = getBuiltinApiKeyAvailability();
  const builtinPrimaryPresets = getBuiltinPrimaryPresets();
  const builtinPrimaryConnections = Object.fromEntries(
    builtinPrimaryPresets.map((preset) => [
      preset.id,
      getBuiltinPrimaryConnection(preset.id),
    ]),
  );

  return (
    <ModelSettingsPage
      initialSettings={settings}
      builtinPrimaryConnections={builtinPrimaryConnections}
      builtinPrimaryPresets={builtinPrimaryPresets}
      builtinApiKeyAvailability={builtinApiKeyAvailability}
    />
  );
}
