import { useTheme } from "@/context/ThemeContext";
import { usePresence } from "@/hooks/usePresence";
import { Stack } from "expo-router";

export default function AppLayout() {
  const { colors: c } = useTheme();
  usePresence();

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
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="new-message"
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="new-room"
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="new-channel"
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="subscribers/[id]"
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="channel-settings/[id]"
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="c/[slug]"
        options={{
          headerShown: false,
          animation: "slide_from_right",
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
        name="u/[username]"
        options={{
          headerShown: false,
          animation: "fade",
        }}
      />
      <Stack.Screen
        name="user/[id]"
        options={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="prefs/notifications"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="prefs/privacy"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="prefs/data"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="prefs/appearance"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="prefs/folders"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="prefs/language"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="prefs/premium"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="prefs/admin"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="prefs/about"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
    </Stack>
  );
}
