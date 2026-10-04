import { RoomAvatar } from "@/components/RoomAvatar";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useChatPalette } from "@/hooks/useChatPalette";
import { formatLastSeen } from "@/utils/chat";
import { useQuery } from "convex/react";
import { ReactNode, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface Contact {
  _id: Id<"users">;
  name: string;
  username?: string;
  image?: string;
  online: boolean;
  lastSeenAt?: number;
  lastSeenHidden: boolean;
}

/** Контакти з серверним пошуком (із затримкою, щоб не слати запит на кожну літеру). */
export function useContacts(search: string) {
  const [debounced, setDebounced] = useState(search.trim());
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  return useQuery(api.users.listContacts, { query: debounced || undefined, limit: 200 });
}

const ONLINE_DOT = "#4CD964";

export function ContactRow({
  contact,
  busy,
  selectable,
  selected,
  onPress,
}: {
  contact: Contact;
  busy?: boolean;
  /** Режим вибору (група): справа показуємо «пташку». */
  selectable?: boolean;
  selected?: boolean;
  onPress: (contact: Contact) => void;
}) {
  const c = useChatPalette();
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      disabled={busy}
      onPress={() => onPress(contact)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 8,
      }}
    >
      <View>
        <RoomAvatar title={contact.name} imageUrl={contact.image} size={50} />
        {contact.online ? (
          <View
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: ONLINE_DOT,
              borderWidth: 2,
              borderColor: c.bg,
            }}
          />
        ) : null}
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
          {contact.name}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: contact.online ? c.accent : c.muted,
            fontSize: 13,
            marginTop: 2,
          }}
        >
          {contact.username ? `@${contact.username} · ` : ""}
          {formatLastSeen(contact.lastSeenAt, contact.online, contact.lastSeenHidden)}
        </Text>
      </View>
      {busy ? <ActivityIndicator color={c.accent} /> : null}
      {selectable ? (
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: selected ? c.accent : c.muted,
            backgroundColor: selected ? c.accent : "transparent",
          }}
        >
          {selected ? <Ionicons name="checkmark" size={15} color={c.onAccent} /> : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

interface ListProps {
  search: string;
  onSelect: (contact: Contact) => void;
  busyId?: Id<"users"> | null;
  /** Режим вибору кількох контактів. */
  selectedIds?: Set<string>;
  header?: ReactNode;
  footer?: ReactNode;
  bottomInset?: number;
}

/** Список контактів (усі користувачі, крім себе), відсортований за активністю. */
export function ContactsList({
  search,
  onSelect,
  busyId,
  selectedIds,
  header,
  footer,
  bottomInset = 24,
}: ListProps) {
  const c = useChatPalette();
  const contacts = useContacts(search);

  return (
    <FlatList
      data={contacts ?? []}
      extraData={selectedIds}
      keyExtractor={(item) => item._id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: bottomInset }}
      ListHeaderComponent={<>{header}</>}
      ListFooterComponent={footer ? <>{footer}</> : null}
      renderItem={({ item }) => (
        <ContactRow
          contact={item}
          busy={busyId === item._id}
          selectable={!!selectedIds}
          selected={selectedIds?.has(item._id)}
          onPress={onSelect}
        />
      )}
      ListEmptyComponent={
        contacts === undefined ? (
          <View style={{ paddingTop: 48, alignItems: "center" }}>
            <ActivityIndicator size="large" color={c.accent} />
          </View>
        ) : (
          <View style={{ alignItems: "center", paddingTop: 48, paddingHorizontal: 24 }}>
            <Ionicons
              name={search.trim() ? "search-outline" : "people-outline"}
              size={40}
              color={c.muted}
            />
            <Text style={{ color: c.muted, fontSize: 15, marginTop: 10, textAlign: "center" }}>
              {search.trim() ? "Нічого не знайдено" : "Поки немає інших користувачів"}
            </Text>
          </View>
        )
      }
    />
  );
}
