import { CheckRow, Group, SettingsPage } from "@/components/SettingsUI";

export default function LanguageSettings() {
  return (
    <SettingsPage title="Мова">
      <Group footer="Застосунок поки що доступний лише українською. Інші мови з'являться пізніше.">
        <CheckRow icon="language" tint="#3B82F6" label="Українська" selected />
        <CheckRow icon="globe-outline" tint="#6B7280" label="English" selected={false} trailing="Скоро" disabled />
        <CheckRow icon="globe-outline" tint="#6B7280" label="Polski" selected={false} trailing="Скоро" disabled />
      </Group>
    </SettingsPage>
  );
}
