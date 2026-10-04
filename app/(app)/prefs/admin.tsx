import { RoomAvatar } from "@/components/RoomAvatar";
import { SearchField } from "@/components/SearchField";
import { Group, SettingsPage } from "@/components/SettingsUI";
import { NameBadges } from "@/components/PremiumBadge";
import { PREMIUM_GOLD } from "@/constants/premium";
import { api } from "@/convex/_generated/api";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { usePremium } from "@/hooks/usePremium";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from "react-native";

type Duration = "7d" | "30d" | "1y" | "forever";

const DURATIONS: { id: Duration; label: string }[] = [
  { id: "7d", label: "7 днів" },
  { id: "30d", label: "30 днів" },
  { id: "1y", label: "1 рік" },
  { id: "forever", label: "Назавжди" },
];

const DURATION_LABEL: Record<string, string> = {
  "7d": "7 днів",
  "30d": "30 днів",
  "1y": "1 рік",
  forever: "назавжди",
};

function errorText(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const m = raw.match(/Uncaught Error:\s*(.+?)(?:\n|$)/);
  return (m ? m[1] : raw.replace(/\[CONVEX[^\]]*\]\s*/g, "").replace(/\[Request ID:[^\]]*\]\s*/g, "")).trim();
}

function dateTime(ms: number): string {
  const d = new Date(ms);
  return `${d.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" })} ${d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function AdminPanel() {
  const c = useChatPalette();
  const premium = usePremium();
  const grant = useMutation(api.premium.grant);
  const revoke = useMutation(api.premium.revoke);

  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setTerm(input.trim().replace(/^@/, "")), 350);
    return () => clearTimeout(t);
  }, [input]);

  const allowed = premium.isAdmin;
  const found = useQuery(api.premium.lookup, allowed && term ? { username: term } : "skip");
  const grants = useQuery(api.premium.recentGrants, allowed ? {} : "skip");

  if (premium.loading) {
    return (
      <SettingsPage title="Адмін-панель">
        <ActivityIndicator style={{ marginTop: 40 }} color={c.accent} />
      </SettingsPage>
    );
  }
  if (!allowed) {
    return (
      <SettingsPage title="Адмін-панель">
        <Text style={{ color: c.muted, fontSize: 15, textAlign: "center", marginTop: 48, paddingHorizontal: 24 }}>
          Доступ лише для адміністратора.
        </Text>
      </SettingsPage>
    );
  }

  const doGrant = async (username: string, duration: Duration) => {
    setBusy(`g:${duration}`);
    try {
      await grant({ username, duration });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert("Не вдалося видати преміум", errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const doRevoke = (username: string) => {
    Alert.alert("Відкликати преміум?", `Користувач @${username} одразу втратить преміум-функції.`, [
      { text: "Скасувати", style: "cancel" },
      {
        text: "Відкликати",
        style: "destructive",
        onPress: async () => {
          setBusy("revoke");
          try {
            await revoke({ username });
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (e) {
            Alert.alert("Не вдалося відкликати", errorText(e));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const statusText = found
    ? found.isAdmin
      ? "Адміністратор · преміум назавжди"
      : found.isPremium
        ? found.lifetime
          ? "Premium назавжди"
          : `Premium до ${new Date(found.until ?? 0).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" })}`
        : "Безкоштовний план"
    : "";

  return (
    <SettingsPage title="Адмін-панель">
      <SearchField
        value={input}
        onChangeText={setInput}
        placeholder="Пошук за @username"
        style={{ marginHorizontal: 12, marginTop: 8 }}
      />

      {term ? (
        found === undefined ? (
          <ActivityIndicator style={{ marginTop: 28 }} color={c.accent} />
        ) : found === null ? (
          <Text style={{ color: c.muted, fontSize: 15, textAlign: "center", marginTop: 28 }}>
            Користувача @{term} не знайдено
          </Text>
        ) : (
          <Group title="Користувач">
            <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
              <RoomAvatar title={found.name} imageUrl={found.image} size={52} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text numberOfLines={1} style={{ color: c.text, fontSize: 17, fontWeight: "700", flexShrink: 1 }}>
                    {found.name}
                  </Text>
                  <NameBadges premium={found.isPremium} size={15} />
                </View>
                <Text style={{ color: c.muted, fontSize: 14, marginTop: 2 }}>@{found.username}</Text>
                <Text style={{ color: found.isPremium ? PREMIUM_GOLD : c.muted, fontSize: 13.5, marginTop: 4, fontWeight: "600" }}>
                  {statusText}
                </Text>
              </View>
            </View>
            <View style={{ paddingHorizontal: 12, paddingBottom: 14, borderTopWidth: 1, borderTopColor: c.divider }}>
              <Text style={{ color: c.muted, fontSize: 13, marginTop: 12, marginBottom: 8, marginLeft: 4 }}>
                Видати / продовжити
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {DURATIONS.map((d) => (
                  <View key={d.id} style={{ width: "50%", padding: 4 }}>
                    <TouchableOpacity
                      disabled={busy !== null}
                      activeOpacity={0.8}
                      onPress={() => void doGrant(found.username ?? term, d.id)}
                      style={{
                        height: 46,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: withAlpha(PREMIUM_GOLD, 0.16),
                        borderWidth: 1,
                        borderColor: withAlpha(PREMIUM_GOLD, 0.5),
                        opacity: busy !== null ? 0.6 : 1,
                      }}
                    >
                      {busy === `g:${d.id}` ? (
                        <ActivityIndicator size="small" color={PREMIUM_GOLD} />
                      ) : (
                        <Text style={{ color: PREMIUM_GOLD, fontSize: 15.5, fontWeight: "700" }}>{d.label}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <View style={{ padding: 4, marginTop: 4 }}>
                <TouchableOpacity
                  disabled={busy !== null || !found.isPremium || found.isAdmin}
                  activeOpacity={0.8}
                  onPress={() => doRevoke(found.username ?? term)}
                  style={{
                    height: 46,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: withAlpha(c.danger, 0.6),
                    opacity: busy !== null || !found.isPremium || found.isAdmin ? 0.4 : 1,
                  }}
                >
                  {busy === "revoke" ? (
                    <ActivityIndicator size="small" color={c.danger} />
                  ) : (
                    <Text style={{ color: c.danger, fontSize: 15.5, fontWeight: "700" }}>Відкликати преміум</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Group>
        )
      ) : (
        <Text style={{ color: c.muted, fontSize: 14, textAlign: "center", marginTop: 22, paddingHorizontal: 28, lineHeight: 20 }}>
          Введіть @username користувача, щоб побачити його статус і видати або відкликати Modesto Premium.
        </Text>
      )}

      <Group title="Останні дії">
        {grants === undefined ? (
          <ActivityIndicator style={{ margin: 20 }} color={c.accent} />
        ) : grants.length === 0 ? (
          <Text style={{ color: c.muted, fontSize: 14.5, padding: 16 }}>Поки що порожньо</Text>
        ) : (
          grants.map((g) => (
            <View key={g._id} style={{ paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: g.action === "grant" ? PREMIUM_GOLD : c.danger,
                  marginRight: 12,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>
                  {g.action === "grant"
                    ? `Видано ${g.username ? `@${g.username}` : g.name} · ${DURATION_LABEL[g.duration ?? ""] ?? ""}`
                    : `Відкликано ${g.username ? `@${g.username}` : g.name}`}
                </Text>
                <Text style={{ color: c.muted, fontSize: 12.5, marginTop: 2 }}>
                  {dateTime(g.createdAt)}
                  {g.byUsername ? ` · від @${g.byUsername}` : ""}
                </Text>
              </View>
            </View>
          ))
        )}
      </Group>
    </SettingsPage>
  );
}
