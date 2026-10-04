import { Logo } from "@/components/Logo";
import { SpaceBackdrop } from "@/components/SpaceBackdrop";
import {
  PREMIUM_ADMIN_NOTE,
  PREMIUM_GOLD,
  PREMIUM_GOLD_SOFT,
  PREMIUM_PERKS,
} from "@/constants/premium";
import { formatPremiumUntil, usePremium } from "@/hooks/usePremium";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Екран «Modesto Premium»: кінематографічний темний стиль, перелік переваг і статус. */
export default function PremiumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const premium = usePremium();
  const [noteShown, setNoteShown] = useState(false);
  const until = formatPremiumUntil(premium);

  return (
    <View style={{ flex: 1, backgroundColor: "#04060A" }}>
      <SpaceBackdrop stars={46} horizon glow="#B8892B" starColor="#FFF4D6" top="#04060A" bottom="#0B0905" />
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" }}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Назад"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.08)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.14)",
          }}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: 18 }}
      >
        <View style={{ alignItems: "center", paddingTop: 10 }}>
          <Logo size={92} color={PREMIUM_GOLD} glow={PREMIUM_GOLD} animated />
          <Text style={{ color: "#FFFFFF", fontSize: 30, fontWeight: "800", marginTop: 18, letterSpacing: 0.4 }}>
            Modesto Premium
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 15.5, textAlign: "center", marginTop: 8, lineHeight: 22 }}>
            Більше можливостей для спілкування: анімований аватар, історії, емодзі-статус і теми з космосу.
          </Text>
        </View>

        {/* Статус */}
        <Animated.View
          entering={FadeInDown.delay(120).duration(360)}
          style={{
            marginTop: 24,
            borderRadius: 20,
            padding: 16,
            backgroundColor: premium.isPremium ? "rgba(245,196,81,0.10)" : "rgba(255,255,255,0.05)",
            borderWidth: 1,
            borderColor: premium.isPremium ? "rgba(245,196,81,0.45)" : "rgba(255,255,255,0.12)",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: premium.isPremium ? PREMIUM_GOLD : "rgba(255,255,255,0.1)",
            }}
          >
            <Ionicons name={premium.isPremium ? "star" : "star-outline"} size={22} color={premium.isPremium ? "#1A1300" : "#FFFFFF"} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 16.5, fontWeight: "700" }}>
              {premium.loading ? "Завантаження…" : premium.isPremium ? "Premium активний" : "Безкоштовний план"}
            </Text>
            <Text style={{ color: premium.isPremium ? PREMIUM_GOLD_SOFT : "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 2 }}>
              {premium.isPremium
                ? `Діє ${until}`
                : premium.until !== null
                  ? "Термін дії преміуму закінчився"
                  : "Преміум-функції зараз недоступні"}
            </Text>
          </View>
        </Animated.View>

        {/* Переваги */}
        <View style={{ marginTop: 20 }}>
          {PREMIUM_PERKS.map((perk, i) => (
            <Animated.View
              key={perk.title}
              entering={FadeInDown.delay(180 + i * 70).duration(360)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 18,
                padding: 14,
                marginBottom: 10,
                backgroundColor: "rgba(255,255,255,0.05)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.09)",
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(245,196,81,0.14)",
                }}
              >
                <Ionicons name={perk.icon} size={22} color={PREMIUM_GOLD} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>{perk.title}</Text>
                <Text style={{ color: "rgba(255,255,255,0.62)", fontSize: 13.5, marginTop: 2, lineHeight: 19 }}>
                  {perk.text}
                </Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* Отримати */}
        {!premium.isPremium && !premium.loading ? (
          <View style={{ marginTop: 10 }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                void Haptics.selectionAsync();
                setNoteShown(true);
              }}
              style={{
                height: 54,
                borderRadius: 27,
                backgroundColor: PREMIUM_GOLD,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#1A1300", fontSize: 17, fontWeight: "800" }}>Отримати</Text>
            </TouchableOpacity>
            {noteShown ? (
              <Animated.Text
                entering={FadeIn.duration(220)}
                style={{ color: PREMIUM_GOLD_SOFT, fontSize: 14.5, textAlign: "center", marginTop: 12, lineHeight: 20 }}
              >
                {PREMIUM_ADMIN_NOTE}
              </Animated.Text>
            ) : null}
          </View>
        ) : null}

        {premium.isAdmin ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/(app)/prefs/admin" as any)}
            style={{
              marginTop: 16,
              height: 50,
              borderRadius: 25,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(245,196,81,0.5)",
            }}
          >
            <Ionicons name="shield-checkmark" size={20} color={PREMIUM_GOLD} />
            <Text style={{ color: PREMIUM_GOLD, fontSize: 16, fontWeight: "700", marginLeft: 8 }}>Адмін-панель</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}
