import { COLORS, FONTS } from "@/constants/theme";
import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.background },
        headerTintColor: COLORS.primary,
        headerTitleStyle: {
          fontFamily: FONTS.headingBold,
          fontSize: 18,
          fontWeight: "normal",
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new-room" options={{ headerShown: false }} />
      <Stack.Screen
        name="profile"
        options={{ presentation: "modal", title: "Профіль 🌸" }}
      />
      <Stack.Screen
        name="chat/[id]"
        options={{ title: "Чат", headerBackTitle: "Назад" }}
      />
      <Stack.Screen
        name="settings/[id]"
        options={{ presentation: "modal", title: "Про кімнату 💫" }}
      />
      <Stack.Screen
        name="user/[id]"
        options={{ title: "Профіль учасника", headerBackTitle: "Назад" }}
      />
    </Stack>
  );
}