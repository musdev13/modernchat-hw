import { getThemeColors, useAppTheme } from "@/components/AppThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: "700", color: colors.white },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarBackground:
          theme === "glass"
            ? () => (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: colors.background },
                  ]}
                >
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 12,
                      right: 12,
                      bottom: Math.max(insets.bottom > 0 ? 6 : 10, 6),
                      borderRadius: 25,
                      borderWidth: 1,
                      borderColor: "rgba(221, 241, 255, 0.32)",
                      backgroundColor: "rgba(18, 28, 41, 0.94)",
                      shadowColor: "#8BD7FF",
                      shadowOffset: { width: 0, height: -2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 18,
                      elevation: 12,
                    }}
                  />
                </View>
              )
            : undefined,
        tabBarStyle: {
          display: "flex",
          height: 64 + Math.max(insets.bottom, 8),
          paddingTop: 7,
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: theme === "glass" ? "transparent" : colors.surface,
          borderTopColor:
            theme === "glass" ? "transparent" : colors.surfaceLight,
          borderTopWidth: theme === "glass" ? 0 : 1,
          ...(theme === "glass"
            ? {
                elevation: 0,
                shadowOpacity: 0,
              }
            : {}),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          marginTop: 1,
        },
        tabBarIconStyle: { marginTop: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Чати",
          tabBarLabel: "Чати",
          tabBarIcon: ({ color, size, focused }) => (
            <View
              style={{
                minWidth: 48,
                height: 28,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  theme === "glass" && focused
                    ? "rgba(146, 223, 255, 0.16)"
                    : "transparent",
                borderWidth: theme === "glass" && focused ? 1 : 0,
                borderColor: "rgba(221, 241, 255, 0.4)",
              }}
            >
              <Ionicons name="chatbubbles-outline" size={size} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="preferences"
        options={{
          headerShown: false,
          title: "Налаштування",
          tabBarLabel: "Налаштування",
          tabBarIcon: ({ color, size, focused }) => (
            <View
              style={{
                minWidth: 48,
                height: 28,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  theme === "glass" && focused
                    ? "rgba(146, 223, 255, 0.16)"
                    : "transparent",
                borderWidth: theme === "glass" && focused ? 1 : 0,
                borderColor: "rgba(221, 241, 255, 0.4)",
              }}
            >
              <Ionicons name="settings-outline" size={size} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerShown: false,
          title: "Профіль",
          tabBarLabel: "Профіль",
          tabBarIcon: ({ color, size, focused }) => (
            <View
              style={{
                minWidth: 48,
                height: 28,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  theme === "glass" && focused
                    ? "rgba(146, 223, 255, 0.16)"
                    : "transparent",
                borderWidth: theme === "glass" && focused ? 1 : 0,
                borderColor: "rgba(221, 241, 255, 0.4)",
              }}
            >
              <Ionicons name="person-circle-outline" size={size} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="new-room"
        options={{
          href: null,
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          href: null,
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="chat/[id]"
        options={{
          href: null,
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="settings/[id]"
        options={{
          href: null,
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="user/[id]"
        options={{
          href: null,
          title: "Профіль учасника",
          tabBarStyle: { display: "none" },
        }}
      />
    </Tabs>
  );
}
