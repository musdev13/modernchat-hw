import { api } from "@/convex/_generated/api";
import { useClerk } from "@clerk/clerk-expo";
import { useMutation } from "convex/react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useCallback } from "react";
import { Alert } from "react-native";

/** Вихід з акаунта з підтвердженням: прибирає push-токен, гасить сповіщення, виходить із Clerk. */
export function useSignOut() {
  const { signOut } = useClerk();
  const removePushToken = useMutation(api.users.removePushToken);

  return useCallback(() => {
    Alert.alert("Вихід", "Ви впевнені, що хочете вийти з акаунта?", [
      { text: "Скасувати", style: "cancel" },
      {
        text: "Вийти",
        style: "destructive",
        onPress: async () => {
          try {
            // 1. Видаляємо push-токен з БД ДО виходу
            try {
              await removePushToken();
            } catch (err) {
              console.error("Failed to remove push token:", err);
            }

            // 2. Локально гасимо всі сповіщення на цьому пристрої
            await Notifications.dismissAllNotificationsAsync();
            await Notifications.cancelAllScheduledNotificationsAsync();

            // 3. Вихід із Clerk
            await signOut();

            // 4. Редірект
            router.replace("/(auth)/login");
          } catch (error) {
            console.error(error);
          }
        },
      },
    ]);
  }, [removePushToken, signOut]);
}
