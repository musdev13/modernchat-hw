import "@expo/metro-runtime";
import "../global.css";

import InitialLayout from "@/components/InitialLayout";
import { COLORS } from "@/constants/theme";
import { PremiumProvider } from "@/context/PremiumContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { api } from "@/convex/_generated/api";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import {
  Authenticated,
  ConvexReactClient,
  useMutation,
} from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect } from "react";
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

// Clerk's Convex integration puts the claims in the default session token,
// so we must not request the legacy "convex" JWT template.
function useConvexClerkAuth() {
  const auth = useAuth();
  const { getToken } = auth;
  const getDefaultToken = useCallback(
    async (options?: { skipCache?: boolean }) =>
      getToken({ skipCache: options?.skipCache }),
    [getToken],
  );
  return { ...auth, getToken: getDefaultToken } as unknown as ReturnType<
    typeof useAuth
  >;
}

function UserSync() {
  const { isSignedIn } = useAuth();
  const storeUser = useMutation(api.users.store);

  useEffect(() => {
    if (!isSignedIn) return;

    storeUser()
      .catch((err) => {
        console.error("❌ [UserSync] Помилка синхронізації з Convex:", err);
      });
  }, [isSignedIn, storeUser]);

  return null;
}

function ThemedStatusBar() {
  const { theme } = useTheme();
  return <StatusBar style={theme.isDark ? "light" : "dark"} />;
}

function AppContent() {
  return (
    <>
      <ThemedStatusBar />
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
          <ConvexProviderWithClerk client={convex} useAuth={useConvexClerkAuth}>
            <ThemeProvider>
              <SettingsProvider>
                <PremiumProvider>
                  <AppContent />
                </PremiumProvider>
              </SettingsProvider>
            </ThemeProvider>
          </ConvexProviderWithClerk>
        </ClerkProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}