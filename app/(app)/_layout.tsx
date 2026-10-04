import { useTheme } from "@/context/ThemeContext";
import { Stack } from "expo-router";

export default function AppLayout() {
  const { colors: c } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.header },
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: "bold" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.bg },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Чат-кімнати",
          headerLargeTitle: true,
        }}
      />
      <Stack.Screen
        name="new-room"
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="chat/[id]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="settings/[id]"
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="user/[id]"
        options={{
          title: "Профіль учасника",
          headerBackTitle: "Назад",
        }}
      />
    </Stack>
  );
}
