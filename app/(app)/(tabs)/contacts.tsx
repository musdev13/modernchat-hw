import { ContactsList } from "@/components/ContactsList";
import { GlassProvider, GlassTarget } from "@/components/Glass";
import { MainTabBar, useTabBarSpace } from "@/components/MainTabBar";
import { SearchField } from "@/components/SearchField";
import { useTheme } from "@/context/ThemeContext";
import { useOpenDirectChat } from "@/hooks/useOpenDirectChat";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ContactsTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const { colors: c } = useTheme();
  const [search, setSearch] = useState("");
  const { open, busyId } = useOpenDirectChat("push");

  return (
    <GlassProvider>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <View
          style={{
            backgroundColor: c.header,
            paddingTop: insets.top + 8,
            paddingHorizontal: 14,
            paddingBottom: 10,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
              height: 40,
            }}
          >
            <Text style={{ color: c.text, fontSize: 22, fontWeight: "700" }}>Контакти</Text>
            <TouchableOpacity
              onPress={() => router.push("/new-room" as any)}
              activeOpacity={0.8}
              accessibilityLabel="Нова група"
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: c.search,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="people-outline" size={22} color={c.accent} />
            </TouchableOpacity>
          </View>
          <SearchField value={search} onChangeText={setSearch} placeholder="Пошук контактів" />
        </View>

        <GlassTarget style={{ flex: 1, backgroundColor: c.bg }}>
          <ContactsList
            search={search}
            busyId={busyId}
            onSelect={(contact) => open(contact._id)}
            bottomInset={tabSpace + 12}
            header={
              <Text
                style={{
                  color: c.accent,
                  fontSize: 14,
                  fontWeight: "700",
                  paddingHorizontal: 16,
                  paddingTop: 14,
                  paddingBottom: 6,
                }}
              >
                Сортування за часом активності
              </Text>
            }
          />
        </GlassTarget>

        <MainTabBar active="contacts" />
      </View>
    </GlassProvider>
  );
}
