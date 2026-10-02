import { COLORS } from "@/constants/theme";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

export default function OAuthNativeCallback() {
  const router = useRouter();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    // Затримка, щоб Clerk встиг обробити токен з URL
    const timer = setTimeout(() => {
      if (isSignedIn) {
        router.replace("/(app)");
      } else {
        router.replace("/(auth)/login");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isSignedIn]);

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