import { EmojiPanel } from "@/components/EmojiPanel";
import { useChatPalette } from "@/hooks/useChatPalette";
import { useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Нижній лист з панеллю емодзі (в дереві, без RN Modal). Піднімається над клавіатурою пошуку. */
export function EmojiStatusSheet({
  title = "Оберіть емодзі-статус",
  onSelect,
  onClose,
}: {
  title?: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const c = useChatPalette();
  const insets = useSafeAreaInsets();
  const [kb, setKb] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e) =>
      setKb(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 900 }}>
      <Animated.View
        entering={FadeIn.duration(160)}
        exiting={FadeOut.duration(140)}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" }}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
          accessibilityLabel="Закрити"
        />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.duration(240)}
        exiting={SlideOutDown.duration(180)}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: kb,
          backgroundColor: c.sheet,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          overflow: "hidden",
        }}
      >
        <View style={{ alignItems: "center", paddingVertical: 8 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: c.divider }} />
        </View>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: "700", textAlign: "center", marginBottom: 4 }}>{title}</Text>
        <EmojiPanel
          height={340}
          bottomInset={kb > 0 ? 0 : insets.bottom}
          onSelectEmoji={(emoji) => {
            Keyboard.dismiss();
            onSelect(emoji);
          }}
        />
      </Animated.View>
    </View>
  );
}
