import { avatarColor, initialsOf } from "@/constants/theme";
import { useChatPalette } from "@/hooks/useChatPalette";
import { dayLabel, formatTime } from "@/utils/chat";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export interface SearchResult {
  _id: string;
  _creationTime: number;
  senderName: string;
  snippet: string;
}

interface ChatSearchPanelProps {
  query: string;
  /** undefined — пошук ще виконується. */
  results: SearchResult[] | undefined;
  maxHeight: number;
  onSelect: (messageId: string) => void;
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const c = useChatPalette();
  const needle = query.trim().toLowerCase();
  const idx = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (idx < 0) {
    return (
      <Text numberOfLines={2} style={{ color: c.text, fontSize: 14, opacity: 0.9 }}>
        {text}
      </Text>
    );
  }
  return (
    <Text numberOfLines={2} style={{ color: c.text, fontSize: 14, opacity: 0.9 }}>
      {text.slice(0, idx)}
      <Text style={{ color: c.accent, fontWeight: "700" }}>
        {text.slice(idx, idx + needle.length)}
      </Text>
      {text.slice(idx + needle.length)}
    </Text>
  );
}

/** Список результатів пошуку по чату: тап переходить до повідомлення. */
export function ChatSearchPanel({
  query,
  results,
  maxHeight,
  onSelect,
}: ChatSearchPanelProps) {
  const c = useChatPalette();
  const hasQuery = query.trim().length > 0;

  let body: React.ReactNode;
  if (!hasQuery) {
    body = (
      <Text style={{ color: c.muted, fontSize: 14, padding: 16, textAlign: "center" }}>
        Введіть слово або фразу для пошуку по чату
      </Text>
    );
  } else if (results === undefined) {
    body = (
      <View style={{ padding: 18, alignItems: "center" }}>
        <ActivityIndicator size="small" color={c.accent} />
      </View>
    );
  } else if (results.length === 0) {
    body = (
      <Text style={{ color: c.muted, fontSize: 14, padding: 16, textAlign: "center" }}>
        Нічого не знайдено
      </Text>
    );
  } else {
    body = (
      <FlatList
        data={results}
        keyExtractor={(item) => item._id}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => (
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: c.divider,
              marginLeft: 58,
            }}
          />
        )}
        ListHeaderComponent={
          <Text style={{ color: c.muted, fontSize: 12, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 }}>
            Знайдено: {results.length}
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={() => onSelect(item._id)}
            accessibilityRole="button"
            accessibilityLabel={`Перейти до повідомлення від ${item.senderName}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: avatarColor(item.senderName),
                alignItems: "center",
                justifyContent: "center",
                marginRight: 10,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 13 }}>
                {initialsOf(item.senderName)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text
                  numberOfLines={1}
                  style={{ color: c.text, fontWeight: "700", fontSize: 14, flex: 1, marginRight: 8 }}
                >
                  {item.senderName}
                </Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>
                  {dayLabel(item._creationTime)}, {formatTime(item._creationTime)}
                </Text>
              </View>
              <Highlighted text={item.snippet} query={query} />
            </View>
          </TouchableOpacity>
        )}
      />
    );
  }

  return (
    <View
      style={{
        maxHeight,
        backgroundColor: c.sheet,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: c.divider,
        overflow: "hidden",
        elevation: 8,
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      }}
    >
      {body}
    </View>
  );
}
