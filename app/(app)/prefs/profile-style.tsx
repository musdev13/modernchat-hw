import { ProfilePattern } from "@/components/ProfilePattern";
import { Group, NavRow, SettingsPage } from "@/components/SettingsUI";
import { usePremiumUi } from "@/context/PremiumContext";
import { PROFILE_COLORS, PROFILE_PATTERNS } from "@/convex/limits";
import { api } from "@/convex/_generated/api";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { usePremium } from "@/hooks/usePremium";
import { convexErrorText, isLimitError } from "@/utils/convexError";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { Alert, Text, TouchableOpacity, View } from "react-native";

const PATTERN_LABEL: Record<string, string> = {
  none: "Без візерунка",
  stars: "Зірки",
  dots: "Крапки",
  waves: "Хвилі",
  hearts: "Серця",
};

function Swatches({
  value,
  onPick,
  onReset,
}: {
  value?: string;
  onPick: (color: string) => void;
  onReset: () => void;
}) {
  const c = useChatPalette();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 14, paddingVertical: 12, gap: 12 }}>
      <TouchableOpacity
        onPress={onReset}
        accessibilityRole="button"
        accessibilityLabel="Скинути колір"
        style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: value ? withAlpha(c.muted, 0.4) : c.accent, alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons name="close" size={18} color={c.muted} />
      </TouchableOpacity>
      {PROFILE_COLORS.map((col) => (
        <TouchableOpacity
          key={col}
          onPress={() => onPick(col)}
          accessibilityRole="button"
          accessibilityLabel={`Колір ${col}`}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: col, borderWidth: value === col ? 3 : 0, borderColor: c.text, alignItems: "center", justifyContent: "center" }}
        >
          {value === col ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Premium: колір імені (і смужки цитат), колір обкладинки профілю та візерунок на ній. */
export default function ProfileStyleScreen() {
  const c = useChatPalette();
  const premium = usePremium();
  const { openUpsell } = usePremiumUi();
  const me = useQuery(api.users.currentUser);
  const setStyle = useMutation(api.premiumFeatures.setProfileStyle);

  const nameColor = premium.isPremium ? me?.nameColor : undefined;
  const profileColor = premium.isPremium ? me?.profileColor : undefined;
  const profilePattern = premium.isPremium ? me?.profilePattern : undefined;

  const apply = (patch: { nameColor?: string | null; profileColor?: string | null; profilePattern?: string | null }) => {
    const sets = Object.values(patch).some((x) => x !== null && x !== undefined && x !== "none");
    if (sets && !premium.isPremium) {
      openUpsell("profile");
      return;
    }
    setStyle(patch).catch((e) => {
      if (isLimitError(e)) openUpsell("profile", convexErrorText(e));
      else Alert.alert("Помилка", convexErrorText(e));
    });
  };

  const cover = profileColor ?? "#3B82F6";
  return (
    <SettingsPage title="Колір профілю">
      <View
        style={{
          marginTop: 14,
          marginHorizontal: 12,
          height: 130,
          borderRadius: 18,
          overflow: "hidden",
          backgroundColor: withAlpha(cover, profileColor ? 0.7 : 0.25),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ProfilePattern pattern={profilePattern} />
        <Text style={{ color: nameColor ?? c.text, fontSize: 22, fontWeight: "800" }} numberOfLines={1}>
          {me?.name ?? "Ваше ім'я"}
        </Text>
        <View style={{ marginTop: 10, borderLeftWidth: 3, borderLeftColor: nameColor ?? c.accent, paddingLeft: 8 }}>
          <Text style={{ color: nameColor ?? c.accent, fontSize: 12, fontWeight: "700" }}>Цитата відповіді</Text>
          <Text style={{ color: c.text, fontSize: 12, opacity: 0.8 }}>Так виглядатимуть ваші повідомлення</Text>
        </View>
      </View>
      {!premium.isPremium ? (
        <Group footer="Кольори й візерунки профілю доступні з Modesto Premium. Без нього параметри не застосовуються.">
          <NavRow first icon="star" tint="#F59E0B" label="Дізнатися про Premium" onPress={() => openUpsell("profile")} />
        </Group>
      ) : null}

      <Group title="Колір імені та цитат" footer="Колір імені у повідомленнях груп і смужки у ваших відповідях.">
        <Swatches value={nameColor} onPick={(col) => apply({ nameColor: col })} onReset={() => apply({ nameColor: null })} />
      </Group>
      <Group title="Колір обкладинки профілю">
        <Swatches value={profileColor} onPick={(col) => apply({ profileColor: col })} onReset={() => apply({ profileColor: null })} />
      </Group>
      <Group title="Візерунок обкладинки">
        {PROFILE_PATTERNS.map((p, i) => (
          <NavRow
            key={p}
            first={i === 0}
            icon={profilePattern === p || (!profilePattern && p === "none") ? "radio-button-on" : "radio-button-off"}
            tint="#8B5CF6"
            label={PATTERN_LABEL[p] ?? p}
            chevron={false}
            onPress={() => apply({ profilePattern: p })}
          />
        ))}
      </Group>
    </SettingsPage>
  );
}
