import { KawaiiButton } from "@/components/ui/KawaiiButton";
import { KawaiiGradient } from "@/components/ui/KawaiiGradient";
import { COLORS, FONTS } from "@/constants/theme";
import { setOAuthInProgress } from "@/lib/authFlowState";
import { useSSO, useSignIn, useSignUp } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import {
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
  const { signIn, setActive: setSignInActive, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: isSignUpLoaded } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleAuth = async () => {
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
        } else {
          Alert.alert("Помилка", "Необхідне додаткове підтвердження акаунта");
        }
      }
    } catch (err: any) {
      console.error("Auth Error", err);
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

    setOAuthInProgress(true);
    setIsGoogleLoading(true);

    try {
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
      } else {
        setOAuthInProgress(false);
      }
    } catch (err: any) {
      console.error("OAuth error:", err);
      setOAuthInProgress(false);
      Alert.alert(
        "Помилка Google",
        err?.errors?.[0]?.longMessage ||
          "Не вдалося виконати вхід через Google. Спробуйте ще раз.",
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: COLORS.background }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            alignItems: "center",
            paddingTop: 80,
            paddingHorizontal: 24,
          }}
        >
          <View style={{ position: "relative" }}>
            <KawaiiGradient
              variant="primary"
              glow
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="chatbubbles" size={44} color="#FFFFFF" />
            </KawaiiGradient>
            <Text
              style={{
                position: "absolute",
                top: -18,
                right: -18,
                fontSize: 22,
              }}
            >
              ✨
            </Text>
            <Text
              style={{
                position: "absolute",
                bottom: -14,
                left: -20,
                fontSize: 22,
              }}
            >
              🌸
            </Text>
          </View>

          <Text
            style={{
              fontFamily: FONTS.headingBold,
              fontSize: 34,
              color: COLORS.text,
              marginTop: 24,
              letterSpacing: 0.5,
            }}
          >
            Modern Chat
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 10,
            }}
          >
            <Text style={{ fontSize: 12 }}>💕</Text>
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 13,
                color: COLORS.textMuted,
                letterSpacing: 0.3,
              }}
            >
              {isSignUp
                ? "створи свій кавайний профіль"
                : "з поверненням, друже!"}
            </Text>
            <Text style={{ fontSize: 12 }}>💕</Text>
          </View>
        </View>

        <View
          style={{
            paddingHorizontal: 24,
            marginTop: 48,
            gap: 14,
            alignItems: "center",
          }}
        >
          {isSignUp && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "rgba(183,148,246,0.08)",
                borderWidth: 1.5,
                borderColor: "rgba(255,143,180,0.25)",
                borderRadius: 20,
                paddingHorizontal: 16,
                width: "100%",
                maxWidth: 360,
              }}
            >
              <Text style={{ fontSize: 18, marginRight: 10 }}>🎀</Text>
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  fontSize: 15,
                  color: COLORS.text,
                  fontFamily: FONTS.body,
                }}
                placeholder="Твоє ім'я"
                placeholderTextColor={COLORS.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          )}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "rgba(183,148,246,0.08)",
              borderWidth: 1.5,
              borderColor: "rgba(255,143,180,0.25)",
              borderRadius: 20,
              paddingHorizontal: 16,
              width: "100%",
              maxWidth: 360,
            }}
          >
            <Text style={{ fontSize: 18, marginRight: 10 }}>💌</Text>
            <TextInput
              style={{
                flex: 1,
                paddingVertical: 16,
                fontSize: 15,
                color: COLORS.text,
                fontFamily: FONTS.body,
              }}
              placeholder="Email"
              placeholderTextColor={COLORS.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "rgba(183,148,246,0.08)",
              borderWidth: 1.5,
              borderColor: "rgba(255,143,180,0.25)",
              borderRadius: 20,
              paddingHorizontal: 16,
              width: "100%",
              maxWidth: 360,
            }}
          >
            <Text style={{ fontSize: 18, marginRight: 10 }}>🔒</Text>
            <TextInput
              style={{
                flex: 1,
                paddingVertical: 16,
                fontSize: 15,
                color: COLORS.text,
                fontFamily: FONTS.body,
              }}
              placeholder="Пароль"
              placeholderTextColor={COLORS.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={{ width: "100%", maxWidth: 360, marginTop: 8 }}>
            <KawaiiButton
              title={isSignUp ? "Створити профіль" : "Увійти"}
              icon={isSignUp ? "sparkles" : "log-in"}
              onPress={handleAuth}
              loading={isLoading}
              disabled={isGoogleLoading}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              width: "100%",
              maxWidth: 360,
              marginVertical: 8,
            }}
          >
            <View
              style={{
                flex: 1,
                height: 1,
                backgroundColor: "rgba(183,148,246,0.25)",
              }}
            />
            <Text
              style={{
                color: COLORS.textMuted,
                fontFamily: FONTS.bodyBold,
                fontSize: 11,
                letterSpacing: 3,
                paddingHorizontal: 14,
              }}
            >
              АБО
            </Text>
            <View
              style={{
                flex: 1,
                height: 1,
                backgroundColor: "rgba(183,148,246,0.25)",
              }}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
            style={{
              width: "100%",
              maxWidth: 360,
              height: 54,
              borderRadius: 27,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              backgroundColor: "rgba(183,148,246,0.12)",
              borderWidth: 1.5,
              borderColor: "rgba(126,232,250,0.35)",
              opacity: isLoading || isGoogleLoading ? 0.5 : 1,
            }}
          >
            {isGoogleLoading ? (
              <Text
                style={{
                  color: COLORS.text,
                  fontFamily: FONTS.bodyBold,
                  fontSize: 15,
                }}
              >
                Зачекай...
              </Text>
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#EA4335" />
                <Text
                  style={{
                    color: COLORS.text,
                    fontFamily: FONTS.bodyBold,
                    fontSize: 15,
                    letterSpacing: 0.3,
                  }}
                >
                  Продовжити з Google
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsSignUp(!isSignUp)}
            style={{ marginTop: 16, paddingVertical: 8 }}
          >
            <Text
              style={{
                color: COLORS.primary,
                fontFamily: FONTS.bodyBold,
                fontSize: 14,
                letterSpacing: 0.2,
              }}
            >
              {isSignUp
                ? "Вже маєш профіль? Увійти 🌸"
                : "Немає профілю? Створити ✨"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}