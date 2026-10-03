import { usePushNotifications } from "@/hooks/usePushNotifications";
import { setOAuthInProgress } from "@/lib/authFlowState";
import { useAuth } from "@clerk/clerk-expo";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

export default function InitialLayout() {
  usePushNotifications();

  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    if (isLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    if (segments.length === 0) return;

    const root = segments[0];
    const inAuthScreen = root === "(auth)";
    const inAppScreen = root === "(app)";

    if (isSignedIn && inAuthScreen) {
      setOAuthInProgress(false);
      router.replace("/(app)");
    } else if (!isSignedIn && inAppScreen) {
      setOAuthInProgress(false);
      router.replace("/(auth)/login");
    }
  }, [isLoaded, isSignedIn, segments, router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}