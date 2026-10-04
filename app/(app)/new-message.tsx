import { ContactsList } from "@/components/ContactsList";
import { SearchField } from "@/components/SearchField";
import { useTheme } from "@/context/ThemeContext";
import { useOpenDirectChat } from "@/hooks/useOpenDirectChat";
import { withAlpha } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** «Нове повідомлення»: нова група + список контактів (тап → особистий чат). */
export default function NewMessageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: c } = useTheme();
  const [search, setSearch] = useState("");
  const { open, busyId } = useOpenDirectChat("replace");

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={{
          backgroundColor: c.header,
          paddingTop: insets.top + 8,
          paddingHorizontal: 8,
          paddingBottom: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", height: 44 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Назад"
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="arrow-back" size={24} color={c.text} />
          </TouchableOpacity>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: "700", marginLeft: 4 }}>
            Нове повідомлення
          </Text>
        </View>
        <View style={{ paddingHorizontal: 6, marginTop: 4 }}>
          <SearchField
            value={search}
            onChangeText={setSearch}
            placeholder="Пошук контактів"
          />
        </View>
      </View>

      <ContactsList
        search={search}
        busyId={busyId}
        onSelect={(contact) => open(contact._id)}
        bottomInset={insets.bottom + 24}
        header={
          <View>
            {!search.trim() && (
              <TouchableOpacity
                activeOpacity={0.6}
                onPress={() => router.push("/new-room" as any)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}
              >
                <View
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: withAlpha(c.accent, 0.16),
                  }}
                >
                  <Ionicons name="people" size={24} color={c.accent} />
                </View>
                <Text style={{ color: c.text, fontSize: 16, fontWeight: "600", marginLeft: 14 }}>
                  Нова група
                </Text>
              </TouchableOpacity>
            )}
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: c.divider,
                marginTop: 4,
              }}
            >
              <Text
                style={{
                  color: c.accent,
                  fontSize: 14,
                  fontWeight: "700",
                  paddingHorizontal: 16,
                  paddingTop: 12,
                  paddingBottom: 4,
                }}
              >
                Сортування за часом активності
              </Text>
            </View>
          </View>
        }
      />
    </View>
  );
}
