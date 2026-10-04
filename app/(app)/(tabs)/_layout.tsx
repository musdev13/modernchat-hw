import { useTheme } from "@/context/ThemeContext";
import { Tabs } from "expo-router";

/**
 * Головні вкладки: Чати | Контакти | Налаштування | Профіль.
 * Стандартну панель вимкнено: кожен екран сам малює скляну панель (MainTabBar) усередині свого
 * GlassProvider, щоб вона розмивала саме вміст цього екрана.
 */
export default function TabsLayout() {
  const { colors: c } = useTheme();
  return (
    <Tabs
      tabBar={() => null}
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Чати" }} />
      <Tabs.Screen name="contacts" options={{ title: "Контакти" }} />
      <Tabs.Screen name="preferences" options={{ title: "Налаштування" }} />
      <Tabs.Screen name="profile" options={{ title: "Профіль" }} />
    </Tabs>
  );
}
