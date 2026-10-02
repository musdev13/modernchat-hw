import { api } from "@/convex/_generated/api";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@clerk/clerk-expo";
import { useQuery } from "convex/react";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

export default function InitialLayout() {
  usePushNotifications();

  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Чекаємо, поки Clerk-сесія синхронізується в Convex
  const user = useQuery(
    api.users.currentUser,
    isSignedIn ? {} : "skip",
  );

  // Редирект робимо лише коли Clerk завантажився І (якщо залогінений) user підтягнувся
  const isBooting = !isLoaded || (isSignedIn && user === undefined);

  useEffect(() => {
    if (isBooting) return;

    const inAuthScreen = segments[0] === "(auth)";

    if (isSignedIn && user) {
      if (inAuthScreen) {
        router.replace("/(app)");
      }
    } else {
      if (!inAuthScreen) {
        router.replace("/(auth)/login");
      }
    }

    SplashScreen.hideAsync();
  }, [isBooting, isSignedIn, user, segments, router]);

  if (isBooting) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}