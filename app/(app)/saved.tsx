import { BouncyPressable } from "@/components/BouncyPressable";
import { getThemeColors, useAppTheme } from "@/components/AppThemeProvider";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SavedScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const savedItems = useQuery(api.messages.listSavedMessages);
  const createNote = useMutation(api.messages.createSavedNote);
  const deleteSaved = useMutation(api.messages.deleteSavedMessage);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const saveNote = async () => {
    if (!note.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await createNote({ body: note });
      setNote("");
    } catch (error) {
      console.error("Не вдалося зберегти нотатку:", error);
      Alert.alert(
        "Помилка",
        error instanceof Error ? error.message : "Не вдалося зберегти нотатку.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const removeSavedItem = (savedMessageId: Id<"savedMessages">) => {
    Alert.alert("Видалити зі збереженого?", "Цю дію неможливо скасувати.", [
      { text: "Скасувати", style: "cancel" },
      {
        text: "Видалити",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteSaved({ savedMessageId });
          } catch (error) {
            console.error("Не вдалося видалити збережене:", error);
            Alert.alert("Помилка", "Не вдалося видалити цей запис.");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-1 px-4">
          <View className="mb-5 mt-2 flex-row items-center justify-between">
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
                backgroundColor: colors.surface,
              }}
            >
              <Ionicons name="arrow-back" size={21} color={colors.white} />
            </BouncyPressable>
            <View className="items-center">
              <Text className="text-lg font-bold text-white">Особисте</Text>
              <Text className="text-[11px] text-textMuted">Твоє «Збережене»</Text>
            </View>
            <View className="h-[42px] w-[42px]" />
          </View>

          <View
            className="mb-3 rounded-2xl border p-3"
            style={{
              borderColor: colors.surfaceLight,
              backgroundColor: colors.surface,
            }}
          >
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Швидка нотатка тільки для тебе…"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={3000}
              accessibilityLabel="Текст особистої нотатки"
              className="max-h-32 min-h-12 text-[15px] text-white"
              style={{ textAlignVertical: "top" }}
            />
            <View className="mt-2 flex-row items-center justify-between">
              <Text className="text-[10px] text-textMuted">
                До 3000 символів · приватно
              </Text>
              <BouncyPressable
                onPress={() => void saveNote()}
                disabled={!note.trim() || isSaving}
                accessibilityRole="button"
                accessibilityLabel="Зберегти нотатку"
                contentStyle={{
                  height: 36,
                  paddingHorizontal: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 18,
                  backgroundColor: colors.primary,
                  opacity: !note.trim() || isSaving ? 0.55 : 1,
                }}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="add" size={17} color="#FFFFFF" />
                    <Text className="ml-1 text-xs font-bold text-white">
                      Нотатка
                    </Text>
                  </>
                )}
              </BouncyPressable>
            </View>
          </View>

          <Text className="mb-2 ml-1 text-xs font-bold uppercase tracking-wider text-textMuted">
            Збережене
          </Text>
          {savedItems === undefined ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : savedItems.length === 0 ? (
            <View className="flex-1 items-center justify-center px-6 pb-16">
              <View
                className="mb-4 h-[76px] w-[76px] items-center justify-center rounded-[26px]"
                style={{ backgroundColor: colors.secondary }}
              >
                <Ionicons name="bookmark-outline" size={34} color={colors.primary} />
              </View>
              <Text className="text-center text-lg font-bold text-white">
                Твоє особисте місце
              </Text>
              <Text className="mt-2 text-center text-sm leading-5 text-textMuted">
                Додавай нотатки тут або зберігай повідомлення кнопкою-закладкою
                в чаті.
              </Text>
            </View>
          ) : (
            <FlatList
              data={savedItems}
              keyExtractor={(item) => item._id}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 28 }}
              renderItem={({ item, index }) => (
                <Animated.View
                  entering={FadeInDown.delay(Math.min(index, 8) * 35)
                    .springify()
                    .damping(18)}
                  className="mb-2 rounded-[20px] border p-4"
                  style={{
                    borderColor: colors.surfaceLight,
                    backgroundColor: colors.surface,
                  }}
                >
                  <View className="mb-2 flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <Ionicons
                        name={item.kind === "note" ? "create-outline" : "bookmark"}
                        size={15}
                        color={colors.primary}
                      />
                      <Text className="ml-1.5 text-[11px] font-semibold text-textMuted">
                        {item.kind === "note"
                          ? "Особиста нотатка"
                          : item.sourceRoomTitle ?? "З чату"}
                      </Text>
                    </View>
                    <BouncyPressable
                      onPress={() => removeSavedItem(item._id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Видалити зі збереженого"
                      contentStyle={{
                        width: 30,
                        height: 30,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 15,
                      }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={15}
                        color={colors.textMuted}
                      />
                    </BouncyPressable>
                  </View>
                  <Text className="text-[15px] leading-5 text-white">
                    {item.body}
                  </Text>
                  {item.sourceSenderName ? (
                    <Text className="mt-2 text-[11px] text-textMuted">
                      {item.sourceSenderName}
                    </Text>
                  ) : null}
                  <Text className="mt-2 text-right text-[10px] text-textMuted">
                    {new Date(item.savedAt).toLocaleString()}
                  </Text>
                </Animated.View>
              )}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
