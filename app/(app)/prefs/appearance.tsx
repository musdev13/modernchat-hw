import { Group, SettingsPage, StepSlider, SwitchRow } from "@/components/SettingsUI";
import { useSettings } from "@/context/SettingsContext";
import { THEMES, THEME_ORDER, isPremiumTheme, type ThemeId } from "@/constants/theme";
import { PREMIUM_GOLD } from "@/constants/premium";
import { usePremiumUi } from "@/context/PremiumContext";
import { useTheme } from "@/context/ThemeContext";
import { usePremium } from "@/hooks/usePremium";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

export default function AppearanceSettings() {
  const c = useChatPalette();
  const { settings, update } = useSettings();
  const [scale, setScale] = useState(settings.appearance.textScale);
  const [radius, setRadius] = useState(settings.appearance.bubbleRadius);
  const premium = usePremium();
  const { openUpsell } = usePremiumUi();

  return (
    <SettingsPage title="Оформлення">
      <ThemeSection />
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
      <Group footer="Тихі мерехтливі зорі за повідомленнями, у кольорах теми. Вимкніть, якщо потрібна максимальна економія батареї.">
        <SwitchRow
          icon="star"
          tint="#F59E0B"
          label="Зоряний фон у чатах"
          sub={premium.isPremium ? undefined : "Лише з Modesto Premium"}
          value={premium.isPremium && settings.appearance.chatStars}
          onChange={(v) => {
            if (!premium.isPremium) {
              openUpsell("chatStars");
              return;
            }
            update("appearance", { chatStars: v });
          }}
        />
      </Group>
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

// Статичні «зорі» для мініатюр преміальних тем (координати у відсотках).
const MINI_STARS: [number, number][] = [
  [12, 22], [30, 12], [52, 30], [70, 14], [86, 26], [22, 48], [64, 52], [90, 58],
];

function ThemePreview({ id, selected, locked }: { id: ThemeId; selected: boolean; locked: boolean }) {
  const t = THEMES[id];
  const k = t.colors;
  const ex = t.extras;
  return (
    <View
      style={{
        borderRadius: 16,
        padding: 6,
        borderWidth: 2,
        borderColor: selected ? k.accent : ex.premium ? ex.line : withAlpha(k.muted, 0.25),
        backgroundColor: k.bg,
      }}
    >
      <View style={{ borderRadius: 10, overflow: "hidden", backgroundColor: k.divider, height: 92 }}>
        {ex.premium ? (
          <>
            <View
              style={{
                position: "absolute",
                top: -34,
                right: -26,
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: withAlpha(ex.glow, 0.22),
              }}
            />
            {MINI_STARS.map(([x, y], i) => (
              <View
                key={i}
                style={{
                  position: "absolute",
                  left: `${x}%`,
                  top: `${y}%`,
                  width: i % 3 === 0 ? 2.5 : 1.5,
                  height: i % 3 === 0 ? 2.5 : 1.5,
                  borderRadius: 2,
                  backgroundColor: withAlpha(ex.star, 0.8),
                }}
              />
            ))}
          </>
        ) : null}
        {locked ? (
          <View
            style={{
              position: "absolute",
              top: 5,
              right: 5,
              zIndex: 3,
              width: 22,
              height: 22,
              borderRadius: 11,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0,0,0,0.72)",
              borderWidth: 1,
              borderColor: PREMIUM_GOLD,
            }}
          >
            <Ionicons name="lock-closed" size={12} color={PREMIUM_GOLD} />
          </View>
        ) : null}
        <View style={{ height: 18, backgroundColor: k.header, flexDirection: "row", alignItems: "center", paddingHorizontal: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: k.accent }} />
          <View style={{ width: 34, height: 4, borderRadius: 2, marginLeft: 5, backgroundColor: k.text, opacity: 0.8 }} />
        </View>
        <View style={{ padding: 6 }}>
          <View
            style={{
              alignSelf: "flex-start",
              width: "62%",
              height: 17,
              borderRadius: 8,
              justifyContent: "center",
              paddingHorizontal: 6,
              backgroundColor: t.isDark ? k.search : k.bg,
            }}
          >
            <View style={{ width: "70%", height: 3, borderRadius: 2, backgroundColor: k.text, opacity: 0.75 }} />
          </View>
          <View
            style={{
              alignSelf: "flex-end",
              width: "54%",
              height: 17,
              borderRadius: 8,
              marginTop: 5,
              justifyContent: "center",
              paddingHorizontal: 6,
              backgroundColor: k.accent,
            }}
          >
            <View style={{ width: "65%", height: 3, borderRadius: 2, backgroundColor: k.onAccent, opacity: 0.85 }} />
          </View>
        </View>
      </View>
    </View>
  );
}

// Секція вибору теми з живими мініатюрами чату.
function ThemeSection() {
  const c = useChatPalette();
  const { themeId, setThemeId, premiumUnlocked } = useTheme();
  const { openUpsell } = usePremiumUi();
  const rows: ThemeId[][] = [];
  for (let i = 0; i < THEME_ORDER.length; i += 2) rows.push(THEME_ORDER.slice(i, i + 2));
  return (
    <Group
      title="Тема оформлення"
      footer="Світла тема — «Світла». Автоперемикання за системою недоступне: застосунок зафіксовано в темному режимі."
    >
      <View style={{ padding: 8 }}>
        {rows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: "row" }}>
            {row.map((id) => {
              const t = THEMES[id];
              const selected = id === themeId;
              const locked = isPremiumTheme(id) && !premiumUnlocked;
              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => {
                    if (locked) {
                      openUpsell("theme");
                      return;
                    }
                    setThemeId(id);
                  }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Тема: ${t.name}`}
                  accessibilityState={{ selected }}
                  style={{ flex: 1, padding: 4 }}
                >
                  <ThemePreview id={id} selected={selected} locked={locked} />
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 7, paddingHorizontal: 4 }}>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: c.text, fontSize: 14, fontWeight: selected ? "800" : "600" }}>
                        {t.name}
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={{ color: locked ? PREMIUM_GOLD : c.muted, fontSize: 11.5, lineHeight: 15, marginTop: 1 }}
                      >
                        {locked ? "Лише Premium" : t.extras.tagline}
                      </Text>
                    </View>
                    {selected ? <Ionicons name="checkmark-circle" size={20} color={c.accent} /> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
            {row.length === 1 ? <View style={{ flex: 1, padding: 4 }} /> : null}
          </View>
        ))}
      </View>
    </Group>
  );
}
