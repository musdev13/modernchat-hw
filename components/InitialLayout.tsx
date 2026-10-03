import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@clerk/clerk-expo";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

export default function InitialLayout() {
  usePushNotifications();

  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthScreen = segments[0] === "(auth)";

    if (isSignedIn) {
      if (inAuthScreen) {
        router.replace("/(app)");
      }
    } else {
      if (!inAuthScreen) {
        router.replace("/(auth)/login");
      }
    }

    SplashScreen.hideAsync();
  }, [isLoaded, isSignedIn, segments, router]);

  if (!isLoaded) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}