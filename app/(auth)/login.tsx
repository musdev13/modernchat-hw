import { COLORS } from "@/constants/theme";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth, useSSO, useSignIn, useSignUp } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { isSignedIn, signOut } = useAuth();
  const { signIn, setActive: setSignInActive, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: isSignUpLoaded } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      router.replace("/(app)");
    }
  }, [isSignedIn, router]);

  const handleAuth = async () => {
    if (isSignedIn) {
      router.replace("/(app)");
      return;
    }

    if (!email.trim() || !password.trim()) {
      Alert.alert("Помилка", "Будь ласка, заповніть усі поля.");
      return;
    }

    if (isSignUp && !name.trim()) {
      Alert.alert("Помилка", "Будь ласка, вкажіть ваше ім'я.");
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        if (!isSignUpLoaded) return;

        const result = await signUp.create({
          emailAddress: email.trim().toLowerCase(),
          password,
          firstName: name.trim(),
        });

        if (result.status === "complete" && result.createdSessionId) {
          await setSignUpActive({ session: result.createdSessionId });
          router.replace("/(app)");
        } else {
          Alert.alert(
            "Потрібне підтвердження",
            "Перевірте пошту або вимкніть верифікацію email у Clerk Dashboard.",
          );
        }
      } else {
        if (!isSignInLoaded) return;

        const result = await signIn.create({
          identifier: email.trim().toLowerCase(),
          password,
        });

        if (result.status === "complete" && result.createdSessionId) {
          await setSignInActive({ session: result.createdSessionId });
          router.replace("/(app)");
        } else {
          Alert.alert("Помилка", "Необхідне додаткове підтвердження акаунта");
        }
      }
    } catch (err: any) {
      console.error("Auth Error", err);
      const isAlreadySignedIn =
        err?.message?.includes("already signed in") ||
        err?.errors?.[0]?.message?.includes("already signed in") ||
        err?.errors?.[0]?.code === "session_exists";

      if (isAlreadySignedIn) {
        router.replace("/(app)");
        return;
      }

      const message =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        (isSignUp
          ? "Не вдалося зареєструватися. Можливо, пошта вже зайнята."
          : "Неправильний email або пароль.");
      Alert.alert("Помилка", message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isGoogleLoading) return;

    if (isSignedIn) {
      router.replace("/(app)");
      return;
    }

    try {
      setIsGoogleLoading(true);

      // ✅ Генеруємо redirect URL з нашою схемою з app.config.ts
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: "modernchat-dev",
        path: "oauth-native-callback",
      });

      console.log("[Google OAuth] redirectUrl:", redirectUrl);

      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl,
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/(app)");
      } else {
        console.log("[Google OAuth] No session created");
      }
    } catch (err: any) {
      if (!String(err?.message ?? "").includes("already signed in")) console.error("OAuth error:", err);
      const isAlreadySignedIn =
        err?.message?.includes("already signed in") ||
        err?.errors?.[0]?.message?.includes("already signed in") ||
        err?.errors?.[0]?.code === "session_exists";

      if (isAlreadySignedIn) {
        router.replace("/(app)");
        return;
      }

      Alert.alert(
        "Помилка Google",
        err?.errors?.[0]?.longMessage ||
          err?.errors?.[0]?.message ||
          "Не вдалося виконати вхід через Google. Спробуйте ще раз.",
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="relative items-center mt-14 px-6 pt-8">
          <View className="absolute right-8 top-0 h-32 w-32 rounded-full bg-primary/10" />
          <View className="absolute left-8 top-14 h-16 w-16 rounded-full bg-accent/10" />
          <BrandLogo size={88} />

          <Text className="text-[11px] font-bold text-accent mt-6 tracking-[3px]">
            ТВОЄ КОЛО ЛЮДЕЙ
          </Text>
          <Text className="text-[34px] leading-[40px] font-bold text-white mt-2 tracking-tight">
            Modern{" "}
            <Text className="text-primary">Chat</Text>
          </Text>

          <Text className="text-sm text-textMuted mt-2 text-center leading-5">
            {isSignUp
              ? "Створи акаунт і збирай своїх людей в одному місці"
              : "Місце, де свої завжди на зв’язку"}
          </Text>
        </View>

        <View className="px-6 mt-9 w-full items-center gap-4">
          {isSignUp && (
            <View className="flex-row items-center bg-surface border border-surfaceLight rounded-[20px] px-4 w-full max-w-sm">
              <Ionicons
                name="person-outline"
                size={20}
                color={COLORS.textMuted}
                style={{ marginRight: 12 }}
              />

              <TextInput
                className="flex-1 py-3.5 text-base text-white"
                placeholder="Ваше ім'я"
                placeholderTextColor={COLORS.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          )}

          <View className="flex-row items-center bg-surface border border-surfaceLight rounded-[20px] px-4 w-full max-w-sm">
            <Ionicons
              name="mail-outline"
              size={20}
              color={COLORS.textMuted}
              style={{ marginRight: 12 }}
            />

            <TextInput
              className="flex-1 py-3.5 text-base text-white"
              placeholder="Email"
              placeholderTextColor={COLORS.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View className="flex-row items-center bg-surface border border-surfaceLight rounded-[20px] px-4 w-full max-w-sm">
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={COLORS.textMuted}
              style={{ marginRight: 12 }}
            />

            <TextInput
              className="flex-1 py-3.5 text-base text-white"
              placeholder="Пароль"
              placeholderTextColor={COLORS.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            className={`flex-row items-center justify-center bg-primary rounded-[20px] py-4 w-full max-w-sm mt-2 active:bg-primaryDark ${
              isLoading || isGoogleLoading ? "opacity-60" : ""
            }`}
            activeOpacity={0.85}
            onPress={handleAuth}
            disabled={isLoading || isGoogleLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text className="text-background text-base font-bold">
                {isSignUp ? "Зареєструватися" : "Увійти"}
              </Text>
            )}
          </TouchableOpacity>

          <View className="flex-row items-center w-full max-w-sm my-1">
            <View className="flex-1 h-px bg-surfaceLight" />
            <Text className="text-textMuted text-xs font-bold px-3 tracking-widest">
              АБО
            </Text>
            <View className="flex-1 h-px bg-surfaceLight" />
          </View>

          <TouchableOpacity
            className={`flex-row items-center justify-center bg-surface border border-surfaceLight rounded-[20px] py-4 w-full max-w-sm gap-2.5 ${
              isLoading || isGoogleLoading ? "opacity-60" : ""
            }`}
            activeOpacity={0.85}
            onPress={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
          >
            {isGoogleLoading ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#EA4335" />
                <Text className="text-white text-base font-bold">
                  {isSignUp
                    ? "Зареєструватися через Google"
                    : "Продовжити з Google"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsSignUp(!isSignUp)}
            className="mt-3 py-2"
          >
            <Text className="text-primary text-sm font-medium">
              {isSignUp
                ? "Вже є акаунт? Увійти"
                : "Немає акаунту? Створити новий"}
            </Text>
          </TouchableOpacity>

          {isSignedIn && (
            <TouchableOpacity
              onPress={async () => {
                try {
                  await signOut();
                } catch (e) {
                  console.error("SignOut error:", e);
                }
              }}
              className="mt-4 py-2"
            >
              <Text className="text-textMuted text-xs text-center underline">
                Вийти з поточного акаунта
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}