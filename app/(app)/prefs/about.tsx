import { useChatPalette } from "@/hooks/useChatPalette";
import { Logo } from "@/components/Logo";
import { Group, NavRow, SettingsPage } from "@/components/SettingsUI";
import { copyText } from "@/utils/clipboard";
import Constants from "expo-constants";
import { Alert, Platform, View } from "react-native";

export default function AboutSettings() {
  const c = useChatPalette();
  const cfg = Constants.expoConfig;
  const name = cfg?.name ?? "Modesto";
  const version = cfg?.version ?? "1.0.0";
  const build =
    Platform.OS === "android"
      ? String(cfg?.android?.versionCode ?? Constants.nativeBuildVersion ?? "—")
      : String(cfg?.ios?.buildNumber ?? Constants.nativeBuildVersion ?? "—");
  const sdk = cfg?.sdkVersion ?? Constants.expoVersion ?? "—";
  const summary = `${name} ${version} (${build}), Expo SDK ${sdk}, ${Platform.OS} ${Platform.Version}`;

  return (
    <SettingsPage title="Про застосунок">
      <View style={{ alignItems: "center", paddingTop: 28, paddingBottom: 6 }}>
        <Logo size={84} tone="text" glow={c.glow} animated />
        <View style={{ marginTop: 22 }}>
          <Logo variant="wordmark" size={170} tone="text" animated delay={400} />
        </View>
      </View>
      <Group>
        <NavRow icon="chatbubbles" tint="#10B981" label={name} value={`Версія ${version}`} />
        <NavRow icon="hammer" tint="#6B7280" label="Збірка" value={build} />
        <NavRow icon="logo-react" tint="#3B82F6" label="Expo SDK" value={String(sdk)} />
        <NavRow icon="phone-portrait" tint="#8B5CF6" label="Платформа" value={`${Platform.OS} ${Platform.Version}`} />
      </Group>
      <Group footer="Скопіюйте, щоб надіслати розробнику разом із описом проблеми.">
        <NavRow icon="copy" tint="#F59E0B" label="Скопіювати інформацію" onPress={() => {
            void copyText(summary).then((r) => {
              if (r === "copied") Alert.alert("Скопійовано", "Інформацію про застосунок скопійовано.");
            });
          }} />
      </Group>
    </SettingsPage>
  );
}
