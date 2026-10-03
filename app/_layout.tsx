import "@expo/metro-runtime";
import "../global.css";

import InitialLayout from "@/components/InitialLayout";
import { KawaiiLoadingScreen } from "@/components/ui/KawaiiLoadingScreen";
import { api } from "@/convex/_generated/api";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import {
  Nunito_400Regular,
  Nunito_700Bold,
} from "@expo-google-fonts/nunito";
import { PottaOne_400Regular } from "@expo-google-fonts/potta-one";
import {
  TsukimiRounded_400Regular,
  TsukimiRounded_600SemiBold,
} from "@expo-google-fonts/tsukimi-rounded";
import { ConvexReactClient, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useFonts } from "expo-font";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useEffect, useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  getOAuthInProgress,
  subscribeOAuth,
} from "@/lib/authFlowState";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
if (!publishableKey) {
  throw new Error("Відсутній EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY у .env.local");
}

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error("SecureStore getToken error:", error);
      await SecureStore.deleteItemAsync(key);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error("SecureStore saveToken error:", error);
    }
  },
};

function UserSync() {
  const storeUser = useMutation(api.users.store);
  useEffect(() => {
    storeUser().catch((err) => {
      console.error("Помилка синхронізації користувача з Convex:", err);
    });
  }, [storeUser]);
  return null;
}

function AppContent() {
  const [fontsLoaded] = useFonts({
    TsukimiRounded_400Regular,
    TsukimiRounded_600SemiBold,
    Nunito_400Regular,
    Nunito_700Bold,
    PottaOne_400Regular,
  });

  const { isSignedIn } = useAuth();

  const oauthInProgress = useSyncExternalStore(
    subscribeOAuth,
    getOAuthInProgress,
    () => false,
  );

  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
      <StatusBar style="light" />
      {isSignedIn && <UserSync />}
      <InitialLayout />

      {oauthInProgress && !isSignedIn && (
        <View style={StyleSheet.absoluteFill}>
          <KawaiiLoadingScreen />
        </View>
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            <AppContent />
          </ConvexProviderWithClerk>
        </ClerkProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}