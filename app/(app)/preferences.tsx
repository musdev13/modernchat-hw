import { BouncyPressable } from "@/components/BouncyPressable";
import {
  getThemeColors,
  ThemeName,
  useAppTheme,
} from "@/components/AppThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const THEME_ORDER: ThemeName[] = [
  "glass",
  "violet",
  "ocean",
  "sunset",
  "light",
];

export default function PreferencesScreen() {
  const router = useRouter();
  const { theme, themes, setTheme } = useAppTheme();
  const [saving, setSaving] = useState(false);

  const selectTheme = async (nextTheme: ThemeName) => {
    if (saving || nextTheme === theme) return;
    setSaving(true);
    try {
      await setTheme(nextTheme);
    } catch (error) {
      console.error("Не вдалося зберегти тему:", error);
      Alert.alert("Помилка", "Не вдалося зберегти вибрану тему.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-7 flex-row items-center justify-between">
          <BouncyPressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Назад"
            contentStyle={{
              width: 42,
              height: 42,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 21,
              backgroundColor: getThemeColors(theme).surface,
            }}
          >
            <Ionicons name="arrow-back" size={21} color={getThemeColors(theme).white} />
          </BouncyPressable>
          <Text className="text-xl font-bold text-white">Налаштування</Text>
          <View className="h-[42px] w-[42px]" />
        </View>

        <Animated.View entering={FadeInDown.springify().damping(18)}>
          <LinearGradient
            colors={
              theme === "light"
                ? [
                    getThemeColors(theme).secondary,
                    getThemeColors(theme).surface,
                    getThemeColors(theme).secondary,
                  ]
                : [
                    getThemeColors(theme).primary,
                    getThemeColors(theme).primaryDark,
                    getThemeColors(theme).secondary,
                  ]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 26, padding: 20, overflow: "hidden" }}
          >
            <View className="mb-2 h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
              <Ionicons name="color-palette" size={23} color={getThemeColors(theme).white} />
            </View>
            <Text className="text-2xl font-bold text-white">Твій стиль</Text>
            <Text className="mt-1 text-sm leading-5 text-white/80">
              Обери палітру — вона збережеться у твоєму профілі.
            </Text>
          </LinearGradient>
        </Animated.View>

        <Text className="mb-3 mt-8 text-base font-bold text-white">
          Теми оформлення
        </Text>
        {THEME_ORDER.map((themeName, index) => {
          const option = themes[themeName];
          const colors = getThemeColors(themeName);
          const selected = theme === themeName;
          return (
            <Animated.View
              key={themeName}
              entering={FadeInDown.delay(index * 55).springify().damping(18)}
              className="mb-3"
            >
              <BouncyPressable
                onPress={() => void selectTheme(themeName)}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={`Тема ${option.label}`}
                accessibilityState={{ selected }}
                contentStyle={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 15,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.surfaceLight,
                  backgroundColor: colors.surface,
                }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 15,
                    backgroundColor: colors.background,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 13,
                    borderWidth: themeName === "glass" ? 1 : 0,
                    borderColor: themeName === "glass" ? "#FFFFFF99" : "transparent",
                  }}
                >
                  <View
                    style={{
                      width: 23,
                      height: 23,
                      borderRadius: 12,
                      backgroundColor: colors.primary,
                      borderWidth: 3,
                      borderColor: colors.accent,
                    }}
                  />
                  {themeName === "glass" && (
                    <View
                      style={{
                        position: "absolute",
                        top: 7,
                        left: 8,
                        width: 20,
                        height: 8,
                        borderRadius: 8,
                        backgroundColor: "#FFFFFF70",
                        transform: [{ rotate: "-35deg" }],
                      }}
                    />
                  )}
                </View>
                <View className="flex-1">
                  <Text style={{ color: colors.white }} className="text-[15px] font-bold">
                    {option.label}
                  </Text>
                  <Text style={{ color: colors.textMuted }} className="mt-0.5 text-xs">
                    {option.description}
                  </Text>
                </View>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={23} color={colors.primary} />
                ) : (
                  <Ionicons name="ellipse-outline" size={23} color={colors.textMuted} />
                )}
              </BouncyPressable>
            </Animated.View>
          );
        })}

        <View className="mt-5 rounded-2xl border border-surfaceLight bg-surface p-4">
          <View className="flex-row items-center">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-[14px] bg-primary/15">
              <Ionicons name="star" size={19} color={getThemeColors(theme).primary} />
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-bold text-white">Обрані чати</Text>
              <Text className="mt-1 text-xs leading-4 text-textMuted">
                Позначай кімнати зірочкою на головному екрані та показуй тільки їх.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
