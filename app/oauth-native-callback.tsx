import { COLORS } from "@/constants/theme";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

export default function OAuthNativeCallback() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      router.replace("/(app)");
      return;
    }

    const timer = setTimeout(() => {
      if (isSignedIn) {
        router.replace("/(app)");
      } else {
        router.replace("/(auth)/login");
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [isSignedIn, isLoaded, router]);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: COLORS.background,
      }}
    >
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}