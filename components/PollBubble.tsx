import { RoomAvatar } from "@/components/RoomAvatar";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { memo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface PollData {
  _id: Id<"polls">;
  question: string;
  anonymous: boolean;
  multiple: boolean;
  closed: boolean;
  creatorId: Id<"users">;
  totalVoters: number;
  myVotes: string[];
  options: { id: string; text: string; votes: number }[];
}

/** Українська множина: 1 голос, 2 голоси, 5 голосів. */
export function votesLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} голос`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} голоси`;
  return `${n} голосів`;
}

function VotersSheet({ pollId, onClose }: { pollId: Id<"polls"> | null; onClose: () => void }) {
  const c = useChatPalette();
  const insets = useSafeAreaInsets();
  const data = useQuery(api.polls.getVoters, pollId ? { pollId } : "skip");
  return (
    <Modal
      transparent
      visible={!!pollId}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={{ flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: c.sheet,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: "70%",
            minHeight: 200,
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          <Text
            style={{
              color: c.text,
              fontSize: 17,
              fontWeight: "700",
              paddingHorizontal: 18,
              paddingTop: 16,
              paddingBottom: 8,
            }}
          >
            Хто проголосував
          </Text>
          {data === undefined ? (
            <View style={{ padding: 32 }}>
              <ActivityIndicator color={c.accent} />
            </View>
          ) : (
            <ScrollView>
              {(data ?? []).map((option) => (
                <View key={option.id} style={{ paddingBottom: 6 }}>
                  <Text
                    style={{
                      color: c.accent,
                      fontSize: 14,
                      fontWeight: "700",
                      paddingHorizontal: 18,
                      paddingTop: 10,
                      paddingBottom: 4,
                    }}
                  >
                    {option.text} · {option.voters.length}
                  </Text>
                  {option.voters.length === 0 ? (
                    <Text style={{ color: c.muted, paddingHorizontal: 18, paddingVertical: 4 }}>
                      Ніхто не обрав
                    </Text>
                  ) : (
                    option.voters.map((voter) => (
                      <View
                        key={`${option.id}-${voter.userId}`}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 18,
                          paddingVertical: 6,
                        }}
                      >
                        <RoomAvatar title={voter.name} imageUrl={voter.image} size={36} />
                        <Text
                          numberOfLines={1}
                          style={{ flex: 1, color: c.text, fontSize: 15, marginLeft: 12 }}
                        >
                          {voter.name}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Бульбашка опитування: вибір варіанта, результати у відсотках, скасування голосу. */
export const PollBubble = memo(function PollBubble({
  poll,
  isOwn,
  isCreator,
}: {
  poll: PollData;
  isOwn: boolean;
  isCreator: boolean;
}) {
  const c = useChatPalette();
  const voteMutation = useMutation(api.polls.vote);
  const closeMutation = useMutation(api.polls.closePoll);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [votersOpen, setVotersOpen] = useState(false);

  const fg = isOwn ? c.outgoingText : c.incomingText;
  const sub = isOwn ? c.outgoingMeta : c.incomingMeta;
  const tint = isOwn ? c.onAccent : c.accent;
  const hasVoted = poll.myVotes.length > 0;
  const showResults = hasVoted || poll.closed;

  const submit = async (optionIds: string[]) => {
    if (busy) return;
    setBusy(true);
    try {
      await voteMutation({ pollId: poll._id, optionIds });
      void Haptics.selectionAsync();
      setSelected([]);
    } catch (error: any) {
      Alert.alert("Помилка", error?.message ?? "Не вдалося проголосувати");
    } finally {
      setBusy(false);
    }
  };

  const onOptionPress = (id: string) => {
    if (showResults || busy) return;
    if (!poll.multiple) {
      void submit([id]);
      return;
    }
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const confirmClose = () =>
    Alert.alert("Завершити опитування?", "Після цього голосувати вже не можна.", [
      { text: "Скасувати", style: "cancel" },
      {
        text: "Завершити",
        style: "destructive",
        onPress: () =>
          void closeMutation({ pollId: poll._id }).catch((e) =>
            Alert.alert("Помилка", e?.message ?? "Не вдалося завершити опитування"),
          ),
      },
    ]);

  const subtitle = [
    poll.closed ? "Опитування завершено" : poll.anonymous ? "Анонімне опитування" : "Публічне опитування",
    poll.multiple && !poll.closed ? "кілька відповідей" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const linkStyle = { color: tint, fontSize: 14, fontWeight: "600" as const };

  return (
    <View style={{ minWidth: 250, paddingVertical: 2 }}>
      <Text style={{ color: fg, fontSize: 16, fontWeight: "700", lineHeight: 22 }}>
        {poll.question}
      </Text>
      <Text style={{ color: sub, fontSize: 12.5, marginTop: 2, marginBottom: 8 }}>{subtitle}</Text>

      {poll.options.map((option) => {
        const picked = showResults ? poll.myVotes.includes(option.id) : selected.includes(option.id);
        const pct =
          poll.totalVoters > 0 ? Math.round((option.votes / poll.totalVoters) * 100) : 0;
        return (
          <TouchableOpacity
            key={option.id}
            activeOpacity={showResults ? 1 : 0.7}
            onPress={() => onOptionPress(option.id)}
            accessibilityRole={poll.multiple ? "checkbox" : "radio"}
            accessibilityState={{ checked: picked }}
            style={{ marginBottom: 8 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: poll.multiple ? 6 : 11,
                  borderWidth: picked ? 0 : 1.5,
                  borderColor: withAlpha(tint, 0.6),
                  backgroundColor: picked ? tint : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 10,
                }}
              >
                {picked ? (
                  <Ionicons name="checkmark" size={15} color={isOwn ? c.accent : c.onAccent} />
                ) : null}
              </View>
              <Text style={{ color: fg, fontSize: 15, flex: 1 }}>{option.text}</Text>
              {showResults ? (
                <Text style={{ color: fg, fontSize: 14, fontWeight: "700", marginLeft: 8 }}>
                  {pct}%
                </Text>
              ) : null}
            </View>
            {showResults ? (
              <View
                style={{
                  height: 5,
                  borderRadius: 3,
                  marginTop: 5,
                  marginLeft: 32,
                  backgroundColor: withAlpha(tint, 0.18),
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: 5,
                    borderRadius: 3,
                    width: `${pct}%`,
                    backgroundColor: tint,
                  }}
                />
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}

      {!showResults && poll.multiple ? (
        <TouchableOpacity
          disabled={selected.length === 0 || busy}
          onPress={() => void submit(selected)}
          activeOpacity={0.7}
          accessibilityRole="button"
          style={{
            alignSelf: "stretch",
            alignItems: "center",
            paddingVertical: 8,
            marginTop: 2,
            borderRadius: 10,
            backgroundColor: withAlpha(tint, selected.length === 0 ? 0.1 : 0.25),
          }}
        >
          <Text style={[linkStyle, { opacity: selected.length === 0 ? 0.5 : 1 }]}>
            Проголосувати
          </Text>
        </TouchableOpacity>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          marginTop: 4,
          columnGap: 14,
          rowGap: 4,
        }}
      >
        <Text style={{ color: sub, fontSize: 13 }}>
          {poll.totalVoters > 0 ? votesLabel(poll.totalVoters) : "Ще ніхто не проголосував"}
        </Text>
        {hasVoted && !poll.closed ? (
          <TouchableOpacity onPress={() => void submit([])} disabled={busy} hitSlop={6}>
            <Text style={linkStyle}>Скасувати голос</Text>
          </TouchableOpacity>
        ) : null}
        {!poll.anonymous && poll.totalVoters > 0 && showResults ? (
          <TouchableOpacity onPress={() => setVotersOpen(true)} hitSlop={6}>
            <Text style={linkStyle}>Хто проголосував</Text>
          </TouchableOpacity>
        ) : null}
        {isCreator && !poll.closed ? (
          <TouchableOpacity onPress={confirmClose} hitSlop={6}>
            <Text style={linkStyle}>Завершити</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {votersOpen ? (
        <VotersSheet pollId={poll._id} onClose={() => setVotersOpen(false)} />
      ) : null}
    </View>
  );
});
