import "@expo/metro-runtime";
import "../global.css";

import InitialLayout from "@/components/InitialLayout";
import { AppThemeProvider, getThemeColors, useAppTheme } from "@/components/AppThemeProvider";
import { api } from "@/convex/_generated/api";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { ConvexReactClient, useConvexAuth, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
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
  const { isAuthenticated } = useConvexAuth();
  const storeUser = useMutation(api.users.store);

  useEffect(() => {
    if (!isAuthenticated) return;

    storeUser()
      .then((userId) => {
        console.log("✅ [UserSync] Користувача успішно синхронізовано з Convex:", userId);
      })
      .catch((err) => {
        console.error("❌ [UserSync] Помилка синхронізації з Convex:", err);
      });
  }, [isAuthenticated, storeUser]);

  return null;
}

function AppContent() {
  const { theme } = useAppTheme();
  return (
    <>
      <StatusBar style={getThemeColors(theme).statusBar} />
      <UserSync />
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
            <AppThemeProvider>
              <AppContent />
            </AppThemeProvider>
          </ConvexProviderWithClerk>
        </ClerkProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}