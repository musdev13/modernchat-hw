import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useState, useRef } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { fetch } from "expo/fetch";
import { ImageViewerModal } from "@/components/ImageViewerModal";
import { TypingDots } from "@/components/TypingDots";

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const chatRoomId = id as Id<"chatRooms">;

  const room = useQuery(api.rooms.getRoom, {
    roomId: chatRoomId,
  });

  const messages = useQuery(api.messages.listMessages, {
    chatRoomId,
  });

  const currentUser = useQuery(api.users.currentUser);

  const typingUsers = useQuery(
    api.typing.getTypingUsers,
    {
      chatRoomId,
    }
  );

  const sendMessage = useMutation(api.messages.sendMessage);
  const editMessage = useMutation(api.messages.editMessage);
  const deleteMessage = useMutation(api.messages.deleteMessage);
  const generateUploadUrl = useMutation(
    api.messages.generateUploadUrl
  );
  const sendMediaMessage = useMutation(
    api.messages.sendMediaMessage
  );
  const setTyping = useMutation(api.typing.setTyping);

  const [inputText, setInputText] = useState("");
  const [editingMessageId, setEditingMessageId] =
    useState<Id<"messages"> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImageUri, setSelectedImageUri] =
    useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] =
    useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const lastTypingSentRef = useRef(0);

  const handleTextChange = (text: string) => {
    setInputText(text);

    const now = Date.now();

    if (
      now - lastTypingSentRef.current >
      1500
    ) {
      lastTypingSentRef.current = now;

      setTyping({
        chatRoomId,
      }).catch(() => {});
    }
  };

  const pickImage = async () => {
    try {
      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.8,
        });

      if (
        !result.canceled &&
        result.assets[0]?.uri
      ) {
        setSelectedImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);

      Alert.alert(
        "Помилка",
        "Не вдалося відкрити галерею."
      );
    }
  };

  const handleSend = async () => {
    if (isSubmitting) {
      return;
    }

    const text = inputText.trim();

    if (!selectedImageUri && !text) {
      return;
    }

    try {
      setIsSubmitting(true);

      if (selectedImageUri) {
        const uploadUrl =
          await generateUploadUrl();

        const file = new File(
          selectedImageUri
        );

        const uploadResponse = await fetch(
          uploadUrl,
          {
            method: "POST",
            headers: {
              "Content-Type": "image/jpeg",
            },
            body: file,
          }
        );

        if (!uploadResponse.ok) {
          throw new Error("Upload failed");
        }

        const { storageId } =
          await uploadResponse.json();

        await sendMediaMessage({
          chatRoomId,
          storageId,
          caption: text || undefined,
        });

        setSelectedImageUri(null);
        setInputText("");

        return;
      }

      if (editingMessageId) {
        await editMessage({
          messageId: editingMessageId,
          content: text,
        });

        setEditingMessageId(null);
        setInputText("");

        return;
      }

      await sendMessage({
        chatRoomId,
        content: text,
      });

      setInputText("");
    } catch (error) {
      console.error(
        "Error sending message:",
        error
      );

      Alert.alert(
        "Помилка",
        "Не вдалося відправити повідомлення."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = (
    messageId: Id<"messages">
  ) => {
    Alert.alert(
      "Видалити повідомлення?",
      "Це повідомлення буде видалено назавжди.",
      [
        {
          text: "Скасувати",
          style: "cancel",
        },
        {
          text: "Видалити",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMessage({
                messageId,
              });

              if (
                editingMessageId ===
                messageId
              ) {
                setEditingMessageId(null);
                setInputText("");
              }
            } catch (error) {
              console.error(
                "Error deleting message:",
                error
              );

              Alert.alert(
                "Помилка",
                "Не вдалося видалити повідомлення."
              );
            }
          },
        },
      ]
    );
  };

  const handleMessageLongPress = (
    message: {
      _id: Id<"messages">;
      senderId: Id<"users">;
      content?: string;
    }
  ) => {
    if (
      !currentUser ||
      message.senderId !==
        currentUser._id
    ) {
      return;
    }

    Alert.alert(
      "Дії з повідомленням",
      "Оберіть дію:",
      [
        {
          text: "Редагувати",
          onPress: () => {
            if (!message.content) {
              return;
            }

            setEditingMessageId(
              message._id
            );
            setInputText(
              message.content
            );
            setSelectedImageUri(null);
          },
        },
        {
          text: "Видалити",
          style: "destructive",
          onPress: () => {
            confirmDelete(message._id);
          },
        },
        {
          text: "Скасувати",
          style: "cancel",
        },
      ]
    );
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setInputText("");
  };

  if (
    room === undefined ||
    messages === undefined ||
    currentUser === undefined
  ) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center"
        style={{
          backgroundColor:
            COLORS.background,
        }}
      >
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
      </SafeAreaView>
    );
  }

  if (
    room === null ||
    currentUser === null
  ) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center px-6"
        style={{
          backgroundColor:
            COLORS.background,
        }}
      >
        <Ionicons
          name="chatbubbles-outline"
          size={56}
          color={COLORS.textMuted}
        />

        <Text className="text-white text-xl font-bold mt-4 text-center">
          Кімнату не знайдено
        </Text>

        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-primary rounded-2xl px-6 py-3 mt-6"
          activeOpacity={0.8}
        >
          <Text className="text-white font-bold">
            Назад
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1"
      style={{
        backgroundColor:
          COLORS.background,
      }}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : "height"
        }
        className="flex-1"
      >
        {/* Header */}
        <View
          className="h-14 flex-row items-center px-4 border-b"
          style={{
            backgroundColor:
              COLORS.surface,
            borderBottomColor:
              COLORS.surfaceLight,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full"
            style={{
              backgroundColor:
                COLORS.secondary,
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color={COLORS.white}
            />
          </TouchableOpacity>

          <View className="flex-1 ml-3 mr-2">
            <Text
              className="text-white text-lg font-bold"
              numberOfLines={1}
            >
              {room.title}
            </Text>

            {room.description ? (
              <Text
                className="text-xs mt-0.5"
                style={{
                  color:
                    COLORS.textMuted,
                }}
                numberOfLines={1}
              >
                {room.description}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            onPress={() =>
              router.push(
                `/settings/${chatRoomId}`
              )
            }
            className="w-10 h-10 items-center justify-center rounded-full"
            style={{
              backgroundColor:
                COLORS.secondary,
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="ellipsis-vertical"
              size={21}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          className="flex-1"
          style={{
            backgroundColor:
              COLORS.background,
          }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 16,
            backgroundColor:
              COLORS.background,
            flexGrow:
              messages.length === 0
                ? 1
                : 0,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd(
              {
                animated: true,
              }
            );
          }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center">
              <View
                className="w-20 h-20 rounded-full items-center justify-center"
                style={{
                  backgroundColor:
                    COLORS.secondary,
                }}
              >
                <Ionicons
                  name="chatbubbles-outline"
                  size={40}
                  color={
                    COLORS.textMuted
                  }
                />
              </View>

              <Text className="text-white text-base font-semibold mt-4">
                Тут ще немає повідомлень
              </Text>

              <Text
                className="text-sm mt-1 text-center"
                style={{
                  color:
                    COLORS.textMuted,
                }}
              >
                Будьте першим, хто напише в
                цю кімнату
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe =
              item.senderId ===
              currentUser._id;

            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onLongPress={() =>
                  handleMessageLongPress(
                    item
                  )
                }
                delayLongPress={350}
                className={`mb-3 max-w-[82%] ${
                  isMe
                    ? "self-end"
                    : "self-start"
                }`}
              >
                <View
                  className={`px-4 py-3 rounded-2xl ${
                    isMe
                      ? "rounded-tr-sm"
                      : "border rounded-tl-sm"
                  }`}
                  style={{
                    backgroundColor: isMe
                      ? COLORS.primary
                      : COLORS.secondary,
                    borderColor: isMe
                      ? "transparent"
                      : COLORS.surfaceLight,
                  }}
                >
                  {!isMe ? (
                    <Text
                      className="text-xs font-bold mb-1.5"
                      style={{
                        color:
                          COLORS.primary,
                      }}
                    >
                      {item.senderName}
                    </Text>
                  ) : null}

                  {/* Image */}
                  {item.imageUrl ? (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() =>
                        setFullscreenImage(
                          item.imageUrl!
                        )
                      }
                      className="mb-1 rounded-xl overflow-hidden"
                    >
                      <Image
                        source={{
                          uri: item.imageUrl,
                        }}
                        className="w-56 h-56 rounded-xl"
                        style={{
                          backgroundColor:
                            COLORS.surfaceLight,
                        }}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ) : null}

                  {/* Text */}
                  {item.content ? (
                    <Text className="text-white text-base leading-5">
                      {item.content}
                    </Text>
                  ) : null}

                  {/* Time */}
                  <View className="flex-row items-center justify-end mt-1.5">
                    {item.isEdited ? (
                      <Text className="text-white/60 text-[10px] italic mr-1.5">
                        (ред.)
                      </Text>
                    ) : null}

                    <Text className="text-white/60 text-[10px]">
                      {new Date(
                        item._creationTime
                      ).toLocaleTimeString(
                        [],
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />

        {/* Typing indicator */}
        {typingUsers &&
        typingUsers.length > 0 ? (
          <TypingDots
            typingUsers={typingUsers}
          />
        ) : null}

        {/* Editing bar */}
        {editingMessageId ? (
          <View
            className="px-4 py-2.5 border-t"
            style={{
              backgroundColor:
                COLORS.surface,
              borderTopColor:
                COLORS.surfaceLight,
            }}
          >
            <View className="flex-row items-center">
              <View
                className="w-8 h-8 rounded-lg items-center justify-center"
                style={{
                  backgroundColor:
                    "rgba(59, 130, 246, 0.15)",
                }}
              >
                <Ionicons
                  name="pencil"
                  size={16}
                  color={COLORS.primary}
                />
              </View>

              <View className="flex-1 ml-3">
                <Text className="text-primary text-xs font-bold">
                  Редагування
                </Text>

                <Text
                  className="text-xs mt-0.5"
                  style={{
                    color:
                      COLORS.textMuted,
                  }}
                  numberOfLines={1}
                >
                  Змініть текст повідомлення
                </Text>
              </View>

              <TouchableOpacity
                onPress={cancelEditing}
                className="w-9 h-9 items-center justify-center rounded-full"
                style={{
                  backgroundColor:
                    COLORS.background,
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Selected image preview */}
        {selectedImageUri ? (
          <View
            className="px-4 py-2.5 border-t"
            style={{
              backgroundColor:
                COLORS.surface,
              borderTopColor:
                COLORS.surfaceLight,
            }}
          >
            <View className="flex-row items-center">
              <Image
                source={{
                  uri: selectedImageUri,
                }}
                className="w-14 h-14 rounded-xl"
                resizeMode="cover"
              />

              <View className="flex-1 ml-3">
                <Text className="text-white text-sm font-semibold">
                  Фото додано
                </Text>

                <Text
                  className="text-xs mt-0.5"
                  style={{
                    color:
                      COLORS.textMuted,
                  }}
                  numberOfLines={1}
                >
                  Додайте опис або відправте
                  фото
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setSelectedImageUri(null)
                }
                className="w-9 h-9 rounded-full items-center justify-center"
                style={{
                  backgroundColor:
                    COLORS.background,
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Input */}
        <View
          className="px-3 py-3 border-t"
          style={{
            backgroundColor:
              COLORS.surface,
            borderTopColor:
              COLORS.surfaceLight,
          }}
        >
          <View className="flex-row items-end">
            {!editingMessageId ? (
              <TouchableOpacity
                onPress={pickImage}
                disabled={isSubmitting}
                className="w-12 h-12 rounded-full items-center justify-center mr-2"
                style={{
                  backgroundColor:
                    COLORS.secondary,
                  opacity: isSubmitting
                    ? 0.4
                    : 1,
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="image-outline"
                  size={22}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
            ) : null}

            <TextInput
              className="flex-1 max-h-32 text-white px-4 py-3 rounded-2xl border text-base mr-2"
              style={{
                backgroundColor:
                  COLORS.background,
                borderColor:
                  COLORS.surfaceLight,
              }}
              placeholder={
                editingMessageId
                  ? "Змініть текст..."
                  : selectedImageUri
                    ? "Додайте опис до фото..."
                    : "Напишіть повідомлення..."
              }
              placeholderTextColor={
                COLORS.textMuted
              }
              value={inputText}
              onChangeText={
                handleTextChange
              }
              multiline
              textAlignVertical="center"
              editable={!isSubmitting}
            />

            <TouchableOpacity
              onPress={handleSend}
              disabled={
                (!inputText.trim() &&
                  !selectedImageUri) ||
                isSubmitting
              }
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{
                backgroundColor:
                  COLORS.primary,
                opacity:
                  (!inputText.trim() &&
                    !selectedImageUri) ||
                  isSubmitting
                    ? 0.4
                    : 1,
              }}
              activeOpacity={0.75}
            >
              {isSubmitting ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.white}
                />
              ) : (
                <Ionicons
                  name={
                    editingMessageId
                      ? "checkmark"
                      : "send"
                  }
                  size={21}
                  color={COLORS.white}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Fullscreen image viewer */}
      <ImageViewerModal
        visible={!!fullscreenImage}
        imageUrl={fullscreenImage}
        onClose={() =>
          setFullscreenImage(null)
        }
      />
    </SafeAreaView>
  );
}
