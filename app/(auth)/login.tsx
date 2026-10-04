import { Logo } from "@/components/Logo";
import { AuthIntro, wasIntroSeen } from "@/components/AuthIntro";
import { SpaceBackdrop } from "@/components/SpaceBackdrop";
import { useAuth, useSSO, useSignIn, useSignUp } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { StatusBar } from "expo-status-bar";
import { ComponentProps, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const insets = useSafeAreaInsets();
  // Вступ (3 слайди) показуємо лише при першому запуску.
  const [intro, setIntro] = useState<"loading" | "show" | "done">("loading");
  useEffect(() => {
    let alive = true;
    wasIntroSeen().then((seen) => {
      if (alive) setIntro(seen ? "done" : "show");
    });
    return () => {
      alive = false;
    };
  }, []);

  // Інтро логотипа: поява зі збільшенням і розсуванням літер.
  const logo = useSharedValue(0);
  useEffect(() => {
    logo.value = withDelay(150, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [logo]);
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logo.value,
    transform: [{ scale: 0.86 + 0.14 * logo.value }, { translateY: (1 - logo.value) * 10 }],
  }));

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

      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl,
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/(app)");
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

  const busy = isLoading || isGoogleLoading;

  const field = (
    icon: ComponentProps<typeof Ionicons>["name"],
    props: ComponentProps<typeof TextInput>,
  ) => (
    <View style={styles.field}>
      <Ionicons name={icon} size={20} color="rgba(255,255,255,0.55)" style={{ marginRight: 12 }} />
      <TextInput
        style={styles.input}
        placeholderTextColor="rgba(255,255,255,0.4)"
        selectionColor="#7CC4FF"
        {...props}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#02030A" }}>
      <StatusBar style="light" />
      <SpaceBackdrop />

      {intro === "show" ? (
        <AuthIntro onDone={() => setIntro("done")} />
      ) : intro === "done" ? (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 56, paddingBottom: insets.bottom + 28 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={[{ alignItems: "center" }, logoStyle]}>
              <Logo size={88} glow="#B8D0E8" animated delay={200} />
              <View style={{ marginTop: 26 }}>
                <Logo variant="wordmark" size={216} animated delay={650} />
              </View>
              <Text style={styles.tagline}>
                {isSignUp ? "Приєднуйтесь до нового способу спілкування" : "Зв'язок без меж. Увійдіть, щоб продовжити"}
              </Text>
            </Animated.View>

            <Animated.View
              layout={LinearTransition.duration(260)}
              entering={FadeInDown.delay(450).duration(650).easing(Easing.out(Easing.cubic))}
              style={styles.card}
            >
              {isSignUp && (
                <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(140)}>
                  {field("person-outline", {
                    placeholder: "Ваше ім'я",
                    value: name,
                    onChangeText: setName,
                    autoCapitalize: "words",
                  })}
                </Animated.View>
              )}

              {field("mail-outline", {
                placeholder: "Email",
                value: email,
                onChangeText: setEmail,
                keyboardType: "email-address",
                autoCapitalize: "none",
                autoCorrect: false,
              })}

              {field("lock-closed-outline", {
                placeholder: "Пароль",
                value: password,
                onChangeText: setPassword,
                secureTextEntry: true,
                autoCapitalize: "none",
              })}

              <TouchableOpacity
                style={[styles.primary, busy && { opacity: 0.6 }]}
                activeOpacity={0.85}
                onPress={handleAuth}
                disabled={busy}
              >
                {isLoading ? (
                  <ActivityIndicator color="#05070D" size="small" />
                ) : (
                  <Text style={styles.primaryText}>{isSignUp ? "Зареєструватися" : "Увійти"}</Text>
                )}
              </TouchableOpacity>

              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>АБО</Text>
                <View style={styles.orLine} />
              </View>

              <TouchableOpacity
                style={[styles.secondary, busy && { opacity: 0.6 }]}
                activeOpacity={0.85}
                onPress={handleGoogleSignIn}
                disabled={busy}
              >
                {isGoogleLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.googleRow}>
                    <Ionicons name="logo-google" size={20} color="#EA4335" />
                    <Text style={styles.secondaryText}>
                      {isSignUp ? "Зареєструватися через Google" : "Продовжити з Google"}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>

            <Animated.View entering={FadeIn.delay(900).duration(600)} style={{ alignItems: "center", marginTop: 18 }}>
              <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={{ paddingVertical: 8 }}>
                <Text style={styles.switchText}>
                  {isSignUp ? "Вже є акаунт? Увійти" : "Немає акаунту? Створити новий"}
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
                  style={{ paddingVertical: 8, marginTop: 6 }}
                >
                  <Text style={styles.signOutText}>Вийти з поточного акаунта</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tagline: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 10,
    paddingHorizontal: 40,
  },
  card: {
    alignSelf: "center",
    width: "88%",
    maxWidth: 400,
    marginTop: 40,
    padding: 18,
    gap: 12,
    borderRadius: 26,
    backgroundColor: "rgba(10,16,32,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: "#FFFFFF" },
  primary: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  primaryText: { color: "#05070D", fontSize: 16, fontWeight: "800", letterSpacing: 0.6 },
  orRow: { flexDirection: "row", alignItems: "center" },
  orLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.14)" },
  orText: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "700", letterSpacing: 2, paddingHorizontal: 12 },
  secondary: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  googleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  secondaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  switchText: { color: "#9FD3FF", fontSize: 14, fontWeight: "600" },
  signOutText: { color: "rgba(255,255,255,0.5)", fontSize: 12, textDecorationLine: "underline" },
});
