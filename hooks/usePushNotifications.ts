import { getSettingsSnapshot } from "@/context/SettingsContext";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/clerk-expo";
import { useMutation, useQuery } from "convex/react";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

// На вебе expo-notifications не поддерживается — регистрируем хендлер только на нативе
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      // Налаштування «Показувати банери» (локальні).
      const show = getSettingsSnapshot().notifications.inApp;
      return {
        shouldShowAlert: show,
        shouldPlaySound: show,
        shouldSetBadge: true,
        shouldShowBanner: show,
        shouldShowList: show,
      };
    },
  });
}

/**
 * На вебе push не работает. Возвращаем no-op хук, чтобы не вызывать
 * нативные API expo-notifications (getLastNotificationResponse и т.д.).
 */
export function usePushNotifications() {
  if (Platform.OS === "web") {
    return;
  }
  usePushNotificationsNative();
}

function usePushNotificationsNative() {
  const { isSignedIn, isLoaded } = useAuth();
  const savePushToken = useMutation(api.users.savePushToken);

  const user = useQuery(api.users.currentUser, isSignedIn ? {} : "skip");

  const router = useRouter();

  // ⚠️ Запоминаем, для какого пользователя токен уже сохранён в этой сессии.
  // Защищает от повторного сохранения после logout → removePushToken.
  const savedForUserRef = useRef<string | null>(null);

  const lastNotificationResponse = Notifications.useLastNotificationResponse();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const handleNotificationNavigation = (data: any) => {
    if (!data) return;
    if (data.type === "story" && data.storyId) {
      router.push(`/s/${data.storyId}` as never);
      return;
    }
    const roomId = data.chatRoomId || data.conversationId;
    if (roomId) {
      router.push(`/chat/${roomId}`);
    } else {
      router.push("/(app)");
    }
  };

  useEffect(() => {
    if (
      lastNotificationResponse &&
      lastNotificationResponse.actionIdentifier ===
        Notifications.DEFAULT_ACTION_IDENTIFIER
    ) {
      const data = lastNotificationResponse.notification.request.content.data;
      handleNotificationNavigation(data);
    }
  }, [lastNotificationResponse]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      savedForUserRef.current = null;
      return;
    }

    if (user === undefined || user === null) return;
    if (savedForUserRef.current === user._id) return;

    registerForPushNotificationsAsync().then((token) => {
      if (!token) return;
      if (savedForUserRef.current === user._id) return;

      savedForUserRef.current = user._id;
      savePushToken({ pushToken: token }).catch((err) => {
        console.error("Failed to save push token:", err);
        savedForUserRef.current = null;
      });
    });

    notificationListener.current =
      Notifications.addNotificationReceivedListener(() => {});

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        handleNotificationNavigation(data);
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isSignedIn, isLoaded, user]);
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Modesto",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FFFFFF",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    return tokenData.data;
  } catch (error) {
    console.error("Failed to get Expo push token:", error);
    return null;
  }
}