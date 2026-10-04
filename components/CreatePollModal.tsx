import { useChatPalette, withAlpha } from "@/hooks/useChatPalette";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface NewPoll {
  question: string;
  options: string[];
  anonymous: boolean;
  multiple: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreate: (poll: NewPoll) => Promise<void>;
}

const MAX_OPTIONS = 10;

/** Створення опитування: запитання, 2–10 варіантів, анонімність, кілька відповідей. */
export function CreatePollModal({ visible, onClose, onCreate }: Props) {
  const c = useChatPalette();
  const insets = useSafeAreaInsets();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [anonymous, setAnonymous] = useState(true);
  const [multiple, setMultiple] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setQuestion("");
      setOptions(["", ""]);
      setAnonymous(true);
      setMultiple(false);
      setBusy(false);
    }
  }, [visible]);

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const canCreate = question.trim().length > 0 && filled.length >= 2 && !busy;

  const submit = async () => {
    if (!canCreate) return;
    setBusy(true);
    try {
      await onCreate({ question: question.trim(), options: filled, anonymous, multiple });
    } catch (error: any) {
      Alert.alert("Помилка", error?.message ?? "Не вдалося створити опитування");
      setBusy(false);
    }
  };

  const setOption = (index: number, text: string) =>
    setOptions((prev) => prev.map((o, i) => (i === index ? text : o)));

  const section = {
    backgroundColor: c.header,
    borderRadius: 14,
    marginHorizontal: 12,
    marginTop: 14,
    overflow: "hidden" as const,
  };

  const switchRow = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <Text style={{ color: c.text, fontSize: 16 }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: withAlpha(c.muted, 0.4), true: c.accent }}
        thumbColor="#FFFFFF"
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: c.bg }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingTop: insets.top + 8,
            paddingBottom: 10,
            paddingHorizontal: 8,
            backgroundColor: c.header,
          }}
        >
          <TouchableOpacity
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Закрити"
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="close" size={26} color={c.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, color: c.text, fontSize: 19, fontWeight: "700", marginLeft: 4 }}>
            Нове опитування
          </Text>
          <TouchableOpacity
            onPress={() => void submit()}
            disabled={!canCreate}
            style={{ paddingHorizontal: 14, height: 44, justifyContent: "center" }}
          >
            {busy ? (
              <ActivityIndicator color={c.accent} />
            ) : (
              <Text
                style={{
                  color: c.accent,
                  fontSize: 16,
                  fontWeight: "700",
                  opacity: canCreate ? 1 : 0.4,
                }}
              >
                Створити
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          <Text style={{ color: c.accent, fontSize: 13, fontWeight: "700", marginHorizontal: 18, marginTop: 16 }}>
            ЗАПИТАННЯ
          </Text>
          <View style={[section, { marginTop: 6 }]}>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="Поставте запитання"
              placeholderTextColor={c.muted}
              maxLength={255}
              multiline
              selectionColor={c.accent}
              style={{ color: c.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12, maxHeight: 120 }}
            />
          </View>

          <Text style={{ color: c.accent, fontSize: 13, fontWeight: "700", marginHorizontal: 18, marginTop: 20 }}>
            ВАРІАНТИ ВІДПОВІДІ
          </Text>
          <View style={[section, { marginTop: 6 }]}>
            {options.map((option, index) => (
              <View
                key={index}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: c.divider,
                }}
              >
                <TextInput
                  value={option}
                  onChangeText={(text) => setOption(index, text)}
                  placeholder={`Варіант ${index + 1}`}
                  placeholderTextColor={c.muted}
                  maxLength={100}
                  selectionColor={c.accent}
                  style={{ flex: 1, color: c.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 }}
                />
                {options.length > 2 ? (
                  <TouchableOpacity
                    onPress={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Прибрати варіант"
                    style={{ paddingHorizontal: 14 }}
                  >
                    <Ionicons name="close-circle" size={22} color={c.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
            {options.length < MAX_OPTIONS ? (
              <TouchableOpacity
                onPress={() => setOptions((prev) => [...prev, ""])}
                activeOpacity={0.7}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderTopWidth: 1,
                  borderTopColor: c.divider,
                }}
              >
                <Ionicons name="add-circle" size={22} color={c.accent} />
                <Text style={{ color: c.accent, fontSize: 16, fontWeight: "600", marginLeft: 10 }}>
                  Додати варіант
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={{ color: c.muted, fontSize: 13, marginHorizontal: 18, marginTop: 6 }}>
            Можна додати ще {MAX_OPTIONS - options.length}.
          </Text>

          <View style={section}>
            {switchRow("Анонімне голосування", anonymous, setAnonymous)}
            <View style={{ height: 1, backgroundColor: c.divider }} />
            {switchRow("Кілька відповідей", multiple, setMultiple)}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
