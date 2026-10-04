import { QrCode } from "@/components/QrCode";
import { api } from "@/convex/_generated/api";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { copyText } from "@/utils/clipboard";
import { userLink } from "@/utils/profileFormat";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Share, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** QR-візитка профілю: modernchat://u/<username>. */
export default function QrScreen() {
  const c = useChatPalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const me = useQuery(api.users.currentUser);
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const link = me?.username ? userLink(me.username) : null;
  const qrSize = Math.min(width - 96, 280);

  const copy = async () => {
    if (!link) return;
    if ((await copyText(link)) === "copied") {
      void Haptics.selectionAsync();
      setNote("Посилання скопійовано");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setNote(null), 1600);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.divider, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", height: 56, paddingHorizontal: 8 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Назад"
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={{ color: c.text, fontSize: 18, fontWeight: "700", marginLeft: 6 }}>QR-код</Text>
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        {me === undefined ? null : link && me ? (
          <Animated.View
            entering={FadeInDown.duration(380)}
            style={{
              alignItems: "center",
              backgroundColor: c.header,
              borderRadius: 28,
              paddingTop: 26,
              paddingBottom: 22,
              paddingHorizontal: 24,
              borderWidth: 1,
              borderColor: withAlpha(c.muted, 0.18),
            }}
          >
            <View style={{ padding: 10, borderRadius: 20, backgroundColor: "#FFFFFF" }}>
              <QrCode value={link} size={qrSize} />
            </View>
            <Text
              numberOfLines={1}
              style={{ color: c.text, fontSize: 22, fontWeight: "800", marginTop: 18, maxWidth: qrSize + 20 }}
            >
              {me.name}
            </Text>
            <Text numberOfLines={1} style={{ color: c.accent, fontSize: 16, marginTop: 3 }}>
              @{me.username}
            </Text>
          </Animated.View>
        ) : (
          <View style={{ alignItems: "center" }}>
            <Ionicons name="qr-code-outline" size={56} color={c.muted} />
            <Text style={{ color: c.text, fontSize: 17, fontWeight: "600", textAlign: "center", marginTop: 14 }}>
              Спершу задайте ім'я користувача
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, textAlign: "center", marginTop: 6 }}>
              QR-код кодує посилання на ваш профіль за @username.
            </Text>
          </View>
        )}
      </View>

      {link ? (
        <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }}>
          <TouchableOpacity
            onPress={() => void copy()}
            accessibilityRole="button"
            style={{
              flex: 1,
              height: 50,
              borderRadius: 16,
              backgroundColor: c.header,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Ionicons name="copy-outline" size={20} color={c.accent} />
            <Text style={{ color: c.accent, fontSize: 15, fontWeight: "700" }}>Копіювати посилання</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => void Share.share({ message: link }).catch(() => {})}
            accessibilityRole="button"
            style={{
              flex: 1,
              height: 50,
              borderRadius: 16,
              backgroundColor: c.accent,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Ionicons name="share-outline" size={20} color={c.onAccent} />
            <Text style={{ color: c.onAccent, fontSize: 15, fontWeight: "700" }}>Поділитися</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ height: insets.bottom + 20 }} />
      )}

      {note ? (
        <Animated.View
          pointerEvents="none"
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(160)}
          style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 96, alignItems: "center" }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              height: 40,
              paddingHorizontal: 16,
              borderRadius: 20,
              backgroundColor: "rgba(28,28,30,0.94)",
            }}
          >
            <Ionicons name="checkmark-circle" size={18} color="#34C759" />
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>{note}</Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}
