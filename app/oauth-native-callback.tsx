import { KawaiiLoadingScreen } from "@/components/ui/KawaiiLoadingScreen";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useEffect } from "react";

export default function OAuthNativeCallback() {
  const router = useRouter();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isSignedIn) {
        router.replace("/(app)");
      } else {
        router.replace("/(auth)/login");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isSignedIn]);

  return <KawaiiLoadingScreen />;
}