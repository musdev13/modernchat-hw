import "@expo/metro-runtime";
import "../global.css";

import InitialLayout from "@/components/InitialLayout";
import { COLORS } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import {
  Authenticated,
  AuthLoading,
  ConvexReactClient,
  useMutation,
} from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

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
  return (
    <>
      <StatusBar style="light" />
      <AuthLoading>
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
      </AuthLoading>
      <Authenticated>
        <UserSync />
      </Authenticated>
      <InitialLayout />
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