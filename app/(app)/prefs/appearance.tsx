import { Group, SettingsPage, StepSlider, SwitchRow } from "@/components/SettingsUI";
import { useSettings } from "@/context/SettingsContext";
import { THEMES, THEME_ORDER } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

export default function AppearanceSettings() {
  const c = useChatPalette();
  const { settings, update } = useSettings();
  const [scale, setScale] = useState(settings.appearance.textScale);
  const [radius, setRadius] = useState(settings.appearance.bubbleRadius);

  return (
    <SettingsPage title="Оформлення">
      <Group title="Розмір тексту" footer="Застосовується до тексту повідомлень у чатах.">
        <View style={{ padding: 16, gap: 14 }}>
          <Preview scale={scale} radius={radius} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ color: c.muted, fontSize: 13 }}>A</Text>
            <View style={{ flex: 1 }}>
              <StepSlider
                min={0.85}
                max={1.35}
                step={0.05}
                value={settings.appearance.textScale}
                onLive={setScale}
                onCommit={(v) => update("appearance", { textScale: v })}
              />
            </View>
            <Text style={{ color: c.muted, fontSize: 22 }}>A</Text>
          </View>
          <Text style={{ color: c.muted, fontSize: 13, textAlign: "center" }}>{Math.round(scale * 100)}%</Text>
        </View>
      </Group>

      <Group title="Кути бульбашок" footer="Радіус заокруглення бульбашок повідомлень.">
        <View style={{ padding: 16, gap: 10 }}>
          <StepSlider
            min={6}
            max={24}
            step={2}
            value={settings.appearance.bubbleRadius}
            onLive={setRadius}
            onCommit={(v) => update("appearance", { bubbleRadius: v })}
          />
          <Text style={{ color: c.muted, fontSize: 13, textAlign: "center" }}>{Math.round(radius)} px</Text>
        </View>
      </Group>

      <Group footer="Вимкніть анімації, щоб застосунок працював швидше й спокійніше.">
        <SwitchRow
          icon="sparkles"
          tint="#8B5CF6"
          label="Анімації"
          value={settings.appearance.animations}
          onChange={(v) => update("appearance", { animations: v })}
        />
      </Group>
      <ThemeSection />
    </SettingsPage>
  );
}

function Preview({ scale, radius }: { scale: number; radius: number }) {
  const c = useChatPalette();
  const fs = 16 * scale;
  const lh = 22 * scale;
  return (
    <View style={{ backgroundColor: c.wallpaper, borderRadius: 14, padding: 12, gap: 6 }}>
      <View
        style={{
          alignSelf: "flex-start",
          maxWidth: "80%",
          backgroundColor: c.incoming,
          borderRadius: radius,
          paddingHorizontal: 12,
          paddingVertical: 7,
        }}
      >
        <Text style={{ color: c.incomingText, fontSize: fs, lineHeight: lh }}>Привіт! Як справи?</Text>
      </View>
      <View
        style={{
          alignSelf: "flex-end",
          maxWidth: "80%",
          backgroundColor: c.outgoing,
          borderRadius: radius,
          paddingHorizontal: 12,
          paddingVertical: 7,
        }}
      >
        <Text style={{ color: c.outgoingText, fontSize: fs, lineHeight: lh }}>Чудово, дивлюсь на зорі 🚀</Text>
      </View>
    </View>
  );
}

// Секція вибору теми з живими мініатюрами чату.
function ThemeSection() {
  const c = useChatPalette();
  const { themeId, setThemeId } = useTheme();
  return (
    <Group title="Тема оформлення">
      <View style={{ flexDirection: "row", flexWrap: "wrap", padding: 8 }}>
        {THEME_ORDER.map((id) => {
          const t = THEMES[id];
          const selected = id === themeId;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => setThemeId(id)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Тема: ${t.name}`}
              accessibilityState={{ selected }}
              style={{ width: "50%", padding: 4 }}
            >
              <View
                style={{
                  borderRadius: 16,
                  padding: 8,
                  borderWidth: 2,
                  borderColor: selected ? t.colors.accent : withAlpha(c.muted, 0.25),
                  backgroundColor: c.search,
                }}
              >
                <View style={{ borderRadius: 10, overflow: "hidden", backgroundColor: t.colors.divider, height: 78 }}>
                  <View style={{ height: 16, backgroundColor: t.colors.header }} />
                  <View style={{ padding: 6 }}>
                    <View
                      style={{
                        alignSelf: "flex-start",
                        width: "62%",
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: t.isDark ? t.colors.search : t.colors.bg,
                      }}
                    />
                    <View
                      style={{
                        alignSelf: "flex-end",
                        width: "52%",
                        height: 14,
                        borderRadius: 7,
                        marginTop: 5,
                        backgroundColor: t.colors.accent,
                      }}
                    />
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                  <Text numberOfLines={1} style={{ flex: 1, color: c.text, fontSize: 13, fontWeight: selected ? "700" : "500" }}>
                    {t.name}
                  </Text>
                  {selected ? <Ionicons name="checkmark-circle" size={18} color={t.colors.accent} /> : null}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Group>
  );
}
