import { EmojiStatusSheet } from "@/components/EmojiStatusSheet";
import { Logo } from "@/components/Logo";
import { SpaceBackdrop } from "@/components/SpaceBackdrop";
import {
  PREMIUM_ADMIN_NOTE,
  PREMIUM_COMPARE,
  PREMIUM_GOLD,
  PREMIUM_GOLD_SOFT,
  PREMIUM_PERKS,
} from "@/constants/premium";
import { api } from "@/convex/_generated/api";
import { useAnimatedAvatar } from "@/hooks/useAnimatedAvatar";
import { formatPremiumUntil, usePremium } from "@/hooks/usePremium";
import { convexErrorText } from "@/utils/convexError";
import { useMutation, useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Екран «Modesto Premium»: кінематографічний темний стиль, перелік переваг і статус. */
export default function PremiumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const premium = usePremium();
  const [noteShown, setNoteShown] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const me = useQuery(api.users.currentUser);
  const setEmojiStatus = useMutation(api.premium.setEmojiStatus);
  const { pick: pickAnimated, busy: animBusy } = useAnimatedAvatar();
  const currentEmoji = premium.isPremium ? me?.emojiStatus : undefined;

  const saveEmoji = async (emoji: string | undefined) => {
    try {
      await setEmojiStatus({ emoji });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert("Не вдалося зберегти статус", convexErrorText(e));
    }
  };
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
            Повноцінні історії, більші ліміти, ефекти, переклад, кольори профілю, приватність і теми з космосу.
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

        {/* Переваги: сітка */}
        <Text style={{ color: PREMIUM_GOLD, fontSize: 13.5, fontWeight: "700", marginTop: 22, marginLeft: 4 }}>
          Що входить
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 10 }}>
          {PREMIUM_PERKS.map((perk, i) => (
            <Animated.View
              key={perk.title}
              entering={FadeInDown.delay(120 + Math.min(i, 8) * 45).duration(320)}
              style={{
                width: "48.5%",
                borderRadius: 18,
                padding: 12,
                marginBottom: 10,
                backgroundColor: "rgba(255,255,255,0.05)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.09)",
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(245,196,81,0.14)",
                }}
              >
                <Ionicons name={perk.icon} size={20} color={PREMIUM_GOLD} />
              </View>
              <Text style={{ color: "#FFFFFF", fontSize: 14.5, fontWeight: "700", marginTop: 8 }}>{perk.title}</Text>
              <Text style={{ color: "rgba(255,255,255,0.62)", fontSize: 12.5, marginTop: 3, lineHeight: 17 }}>
                {perk.text}
              </Text>
            </Animated.View>
          ))}
        </View>

        {/* Порівняння */}
        <Text style={{ color: PREMIUM_GOLD, fontSize: 13.5, fontWeight: "700", marginTop: 12, marginLeft: 4 }}>
          Безкоштовно чи Premium
        </Text>
        <View
          style={{
            marginTop: 10,
            borderRadius: 18,
            overflow: "hidden",
            backgroundColor: "rgba(255,255,255,0.05)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.09)",
          }}
        >
          <View style={{ flexDirection: "row", paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "rgba(255,255,255,0.06)" }}>
            <Text style={{ flex: 1.5, color: "rgba(255,255,255,0.6)", fontSize: 12.5, fontWeight: "700" }}>Можливість</Text>
            <Text style={{ flex: 1, color: "rgba(255,255,255,0.6)", fontSize: 12.5, fontWeight: "700", textAlign: "center" }}>Безкоштовно</Text>
            <Text style={{ flex: 1, color: PREMIUM_GOLD, fontSize: 12.5, fontWeight: "800", textAlign: "center" }}>Premium</Text>
          </View>
          {PREMIUM_COMPARE.map((row, i) => (
            <View
              key={row.label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 9,
                paddingHorizontal: 12,
                borderTopWidth: 1,
                borderTopColor: "rgba(255,255,255,0.06)",
                backgroundColor: i % 2 ? "rgba(255,255,255,0.02)" : "transparent",
              }}
            >
              <Text style={{ flex: 1.5, color: "#FFFFFF", fontSize: 13.5 }}>{row.label}</Text>
              <Text style={{ flex: 1, color: "rgba(255,255,255,0.6)", fontSize: 13.5, textAlign: "center" }}>{row.free}</Text>
              <Text style={{ flex: 1, color: PREMIUM_GOLD_SOFT, fontSize: 13.5, fontWeight: "700", textAlign: "center" }}>{row.premium}</Text>
            </View>
          ))}
        </View>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12.5, marginTop: 8, marginLeft: 4, lineHeight: 18 }}>
          Усі ліміти перевіряє сервер, тому їх не можна обійти зі застосунку. {PREMIUM_ADMIN_NOTE}.
        </Text>

        {/* Мої налаштування Premium */}
        <View style={{ marginTop: 6 }}>
          <Text style={{ color: PREMIUM_GOLD, fontSize: 13.5, fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>
            Ваш профіль
          </Text>
          <View
            style={{
              borderRadius: 18,
              backgroundColor: "rgba(255,255,255,0.05)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.09)",
              overflow: "hidden",
            }}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => (premium.isPremium ? setEmojiOpen(true) : setNoteShown(true))}
              style={{ flexDirection: "row", alignItems: "center", padding: 14 }}
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
                {currentEmoji ? (
                  <Text style={{ fontSize: 22 }}>{currentEmoji}</Text>
                ) : (
                  <Ionicons name="happy-outline" size={22} color={PREMIUM_GOLD} />
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>Емодзі-статус</Text>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13.5, marginTop: 2 }}>
                  {premium.isPremium ? (currentEmoji ? "Натисніть, щоб змінити" : "Оберіть емодзі біля імені") : "Лише з Premium"}
                </Text>
              </View>
              {currentEmoji ? (
                <TouchableOpacity onPress={() => void saveEmoji(undefined)} hitSlop={10} accessibilityLabel="Прибрати статус">
                  <Ionicons name="close-circle" size={22} color="rgba(255,255,255,0.55)" />
                </TouchableOpacity>
              ) : (
                <Ionicons name={premium.isPremium ? "chevron-forward" : "lock-closed"} size={18} color="rgba(255,255,255,0.5)" />
              )}
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginLeft: 70 }} />
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={animBusy}
              onPress={() => (premium.isPremium ? void pickAnimated() : setNoteShown(true))}
              style={{ flexDirection: "row", alignItems: "center", padding: 14, opacity: animBusy ? 0.6 : 1 }}
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
                <Ionicons name="film-outline" size={22} color={PREMIUM_GOLD} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>Анімований аватар</Text>
                <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13.5, marginTop: 2 }}>
                  {animBusy ? "Завантаження…" : premium.isPremium ? "Відео до 10 с або GIF" : "Лише з Premium"}
                </Text>
              </View>
              <Ionicons name={premium.isPremium ? "chevron-forward" : "lock-closed"} size={18} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
            {[
              { icon: "color-fill-outline" as const, title: "Колір профілю", sub: "Ім'я, цитати, обкладинка, візерунок", to: "/(app)/prefs/profile-style" },
              { icon: "checkmark-done-outline" as const, title: "Приватність Premium", sub: "Прочитання, хто пише, автоархів", to: "/(app)/prefs/privacy" },
              { icon: "eye-off-outline" as const, title: "Історії: невидимка та архів", sub: "Налаштування приватності історій", to: "/(app)/prefs/story-privacy" },
            ].map((row) => (
              <View key={row.to}>
                <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginLeft: 70 }} />
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => router.push(row.to as never)}
                  style={{ flexDirection: "row", alignItems: "center", padding: 14 }}
                >
                  <View style={{ width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(245,196,81,0.14)" }}>
                    <Ionicons name={row.icon} size={22} color={PREMIUM_GOLD} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>{row.title}</Text>
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13.5, marginTop: 2 }}>{row.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          {!premium.isPremium && noteShown ? (
            <Text style={{ color: PREMIUM_GOLD_SOFT, fontSize: 13.5, marginTop: 8, marginLeft: 4 }}>
              {PREMIUM_ADMIN_NOTE}
            </Text>
          ) : null}
        </View>

        {/* Отримати */}
        {!premium.isPremium && !premium.loading ? (
          <View style={{ marginTop: 18 }}>
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

      {emojiOpen ? (
        <EmojiStatusSheet
          onClose={() => setEmojiOpen(false)}
          onSelect={(emoji) => {
            setEmojiOpen(false);
            void saveEmoji(emoji);
          }}
        />
      ) : null}
    </View>
  );
}
