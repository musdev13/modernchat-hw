import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@clerk/clerk-expo";
import { useConvexAuth } from "convex/react";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { COLORS } from "@/constants/theme";

export default function InitialLayout() {
  usePushNotifications();

  const { isSignedIn, isLoaded } = useAuth();
  const { isAuthenticated: isConvexAuthenticated, isLoading: isConvexLoading } =
    useConvexAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    SplashScreen.hideAsync();

    const inAuthScreen = segments[0] === "(auth)";

    if (isSignedIn) {
      if (isConvexLoading || !isConvexAuthenticated) return;
      if (inAuthScreen) {
        router.replace("/(app)");
      }
    } else {
      if (!inAuthScreen) {
        router.replace("/(auth)/login");
      }
    }

  }, [
    isLoaded,
    isSignedIn,
    isConvexAuthenticated,
    isConvexLoading,
    segments,
    router,
  ]);

  if (!isLoaded) {
    return null;
  }

  if (isSignedIn && (!isConvexAuthenticated || isConvexLoading)) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text className="mt-4 text-center text-sm text-textMuted">
          Підключаємо захищене з’єднання…
        </Text>
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}