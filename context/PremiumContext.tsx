import { Logo } from "@/components/Logo";
import {
  PREMIUM_GOLD,
  PREMIUM_PERKS,
  PREMIUM_REASONS,
  PremiumFeature,
} from "@/constants/premium";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { Pressable, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface UpsellRequest {
  feature: PremiumFeature;
  /** Власний текст причини (наприклад, серверна помилка про ліміт). */
  message?: string;
}

interface PremiumUi {
  /** Відкриває «шторку» з пропозицією Modesto Premium. */
  openUpsell: (feature?: PremiumFeature, message?: string) => void;
  closeUpsell: () => void;
}

const Ctx = createContext<PremiumUi | null>(null);

export function usePremiumUi(): PremiumUi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePremiumUi має використовуватись усередині PremiumProvider");
  return ctx;
}

/** Провайдер + оверлей-шторка «Modesto Premium» (у дереві, без RN Modal). */
export function PremiumProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<UpsellRequest | null>(null);
  const openUpsell = useCallback((feature: PremiumFeature = "general", message?: string) => {
    void Haptics.selectionAsync();
    setRequest({ feature, message });
  }, []);
  const closeUpsell = useCallback(() => setRequest(null), []);
  const value = useMemo(() => ({ openUpsell, closeUpsell }), [openUpsell, closeUpsell]);

  return (
    <Ctx.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {request ? <UpsellSheet request={request} onClose={closeUpsell} /> : null}
      </View>
    </Ctx.Provider>
  );
}

function UpsellSheet({ request, onClose }: { request: UpsellRequest; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reason = request.message ?? PREMIUM_REASONS[request.feature];

  return (
    <View
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000 }}
      pointerEvents="box-none"
    >
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(160)}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)" }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Закрити" />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.duration(260)}
        exiting={SlideOutDown.duration(200)}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "#0B0E14",
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          borderWidth: 1,
          borderBottomWidth: 0,
          borderColor: "rgba(245,196,81,0.28)",
          paddingTop: 10,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 16,
        }}
      >
        <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.22)" }} />
        <View style={{ alignItems: "center", marginTop: 16 }}>
          <Logo size={54} color={PREMIUM_GOLD} glow={PREMIUM_GOLD} />
          <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginTop: 12 }}>Modesto Premium</Text>
          <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 15, textAlign: "center", marginTop: 6, lineHeight: 21 }}>
            {reason}
          </Text>
        </View>

        <View style={{ marginTop: 16 }}>
          {PREMIUM_PERKS.slice(0, 4).map((perk) => (
            <View key={perk.title} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}>
              <Ionicons name={perk.icon} size={20} color={PREMIUM_GOLD} />
              <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 14.5, marginLeft: 12, flex: 1 }}>
                {perk.title}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            onClose();
            router.push("/(app)/prefs/premium" as any);
          }}
          style={{
            marginTop: 16,
            height: 52,
            borderRadius: 26,
            backgroundColor: PREMIUM_GOLD,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#1A1300", fontSize: 16.5, fontWeight: "800" }}>Дізнатися більше</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onClose}
          style={{ height: 46, alignItems: "center", justifyContent: "center", marginTop: 4 }}
        >
          <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 15.5, fontWeight: "600" }}>Не зараз</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
