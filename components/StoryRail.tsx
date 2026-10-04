import { BouncyPressable } from "@/components/BouncyPressable";
import { getThemeColors, useAppTheme } from "@/components/AppThemeProvider";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { File } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";

type StoryMedia = {
  _id: Id<"stories">;
  mediaType: "image" | "video";
  mediaUrl: string;
  expiresAt: number;
};

type StoryGroup = {
  userId: Id<"users">;
  name: string;
  image?: string;
  profileEmoji?: string;
  isCurrentUser: boolean;
  stories: StoryMedia[];
};

function StoryVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: "100%" }}
      contentFit="contain"
      nativeControls
    />
  );
}

function StoryViewer({
  group,
  index,
  onClose,
  onNext,
  onPrevious,
  onDelete,
  isDeleting,
  now,
}: {
  group: StoryGroup | null;
  index: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  now: number;
}) {
  const story = group?.stories[index];

  return (
    <Modal
      visible={!!group && !!story}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {group && story ? (
        <View className="flex-1 bg-black">
          <Animated.View
            entering={FadeIn.duration(250)}
            className="absolute inset-0"
          >
            {story.mediaType === "image" ? (
              <Image
                source={{ uri: story.mediaUrl }}
                className="h-full w-full"
                resizeMode="contain"
              />
            ) : (
              <StoryVideo key={story._id} uri={story.mediaUrl} />
            )}
          </Animated.View>

          <LinearGradient
            colors={["rgba(0,0,0,0.76)", "transparent"]}
            className="absolute left-0 right-0 top-0 h-36 px-4 pt-12"
          >
            <View className="flex-row gap-1">
              {group.stories.map((item, itemIndex) => (
                <View
                  key={item._id}
                  className={`h-1 flex-1 rounded-full ${
                    itemIndex <= index ? "bg-white" : "bg-white/35"
                  }`}
                />
              ))}
            </View>
            <View className="mt-4 flex-row items-center">
              {group.image ? (
                <Image
                  source={{ uri: group.image }}
                  className="h-10 w-10 rounded-full border border-white/70"
                />
              ) : (
                <View className="h-10 w-10 items-center justify-center rounded-full bg-white/15">
                  <Ionicons name="person" size={19} color="#FFFFFF" />
                </View>
              )}
              <View className="ml-3 flex-1">
                <Text className="text-white font-bold">
                  {group.name} {group.profileEmoji}
                </Text>
                <Text className="mt-0.5 text-xs text-white/75">
                  {Math.max(
                    1,
                    Math.ceil((story.expiresAt - now) / 3_600_000),
                  )}
                  ч до зникнення
                </Text>
              </View>
              {group.isCurrentUser && (
                <TouchableOpacity
                  onPress={onDelete}
                  disabled={isDeleting}
                  className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-white/15"
                  accessibilityRole="button"
                  accessibilityLabel="Удалить сторис"
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Ionicons name="trash-outline" size={20} color="white" />
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={onClose}
                className="h-10 w-10 items-center justify-center rounded-full bg-white/15"
                accessibilityRole="button"
                accessibilityLabel="Закрыть сторис"
              >
                <Ionicons name="close" size={23} color="white" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <View className="absolute bottom-10 left-4 right-4 flex-row justify-between">
            <BouncyPressable
              onPress={onPrevious}
              disabled={index === 0}
              contentStyle={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.16)",
                opacity: index === 0 ? 0.35 : 1,
              }}
            >
              <Ionicons name="chevron-back" size={24} color="white" />
            </BouncyPressable>
            <BouncyPressable
              onPress={onNext}
              contentStyle={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.16)",
              }}
            >
              <Ionicons name="chevron-forward" size={24} color="white" />
            </BouncyPressable>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

export function StoryRail() {
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const groups = useQuery(api.stories.listActiveStories);
  const status = useQuery(api.stories.myStoryStatus);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const createStory = useMutation(api.stories.createStory);
  const deleteStory = useMutation(api.stories.deleteStory);
  const [selectedGroup, setSelectedGroup] = useState<StoryGroup | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const showPremiumPlaceholder = () => {
    Alert.alert(
      "Premium скоро",
      "У майбутньому Premium дозволить публікувати більше двох активних сторисів. Оплата поки не підключена.",
      [{ text: "Зрозуміло" }],
    );
  };

  const createStoryFromLibrary = async () => {
    if (isUploading) return;
    if (
      status &&
      !status.isPremium &&
      status.activeCount >= status.freeLimit
    ) {
      showPremiumPlaceholder();
      return;
    }

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Потрібен доступ до галереї",
          "Дозволь доступ до фото та відео, щоб додати сторис.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsEditing: false,
        quality: 0.85,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.uri) return;

      setIsUploading(true);
      const file = new File(asset.uri);
      if (!file.exists) throw new Error("Обраний файл не знайдено.");

      const uploadUrl = await generateUploadUrl();
      const mediaType = asset.type === "video" ? "video" : "image";
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type":
            asset.mimeType ??
            (mediaType === "video" ? "video/mp4" : "image/jpeg"),
        },
        body: file,
      });
      if (!response.ok) {
        throw new Error(`Не вдалося завантажити медіа (${response.status}).`);
      }
      const uploadResult = (await response.json()) as {
        storageId?: Id<"_storage">;
      };
      if (!uploadResult.storageId) {
        throw new Error("Сховище не повернуло ідентифікатор файлу.");
      }

      await createStory({
        storageId: uploadResult.storageId,
        mediaType,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Story upload failed:", error);
      const message =
        error instanceof Error ? error.message : "Не вдалося опублікувати сторис.";
      if (message.includes("STORY_LIMIT_REACHED")) {
        showPremiumPlaceholder();
      } else {
        Alert.alert("Помилка", message);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const openStories = (group: StoryGroup) => {
    setSelectedGroup(group);
    setSelectedIndex(0);
  };

  const advanceStory = () => {
    if (!selectedGroup) return;
    if (selectedIndex + 1 < selectedGroup.stories.length) {
      setSelectedIndex((index) => index + 1);
      return;
    }
    const nextGroupIndex = (groups ?? []).findIndex(
      (group) => group.userId === selectedGroup.userId,
    );
    const nextGroup = groups?.[nextGroupIndex + 1];
    if (nextGroup) {
      openStories(nextGroup);
    } else {
      setSelectedGroup(null);
    }
  };

  const deleteSelectedStory = async () => {
    const story = selectedGroup?.stories[selectedIndex];
    if (!story || isDeleting) return;
    Alert.alert("Видалити сторис?", "Публікацію буде видалено назавжди.", [
      { text: "Скасувати", style: "cancel" },
      {
        text: "Видалити",
        style: "destructive",
        onPress: async () => {
          setIsDeleting(true);
          try {
            await deleteStory({ storyId: story._id });
            const remaining = selectedGroup?.stories.filter(
              (item) => item._id !== story._id,
            );
            if (!selectedGroup || !remaining?.length) {
              setSelectedGroup(null);
            } else {
              setSelectedGroup({ ...selectedGroup, stories: remaining });
              setSelectedIndex(Math.min(selectedIndex, remaining.length - 1));
            }
          } catch (error) {
            console.error("Story deletion failed:", error);
            Alert.alert(
              "Помилка",
              error instanceof Error
                ? error.message
                : "Не вдалося видалити сторис.",
            );
          } finally {
            setIsDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <>
      <Animated.View
        entering={FadeInDown.delay(80).duration(350)}
        className="mt-1 mb-3"
      >
        <View className="mb-3 flex-row items-center justify-between px-5">
          <View>
            <Text className="text-white text-base font-bold">Сториси</Text>
            <Text className="mt-0.5 text-xs text-textMuted">
              Зникають через 24 години
            </Text>
          </View>
          <View className="rounded-full bg-primary/15 px-3 py-1.5">
            <Text className="text-primary text-[11px] font-bold">
              {status?.isPremium
                ? "PREMIUM"
                : `${status?.activeCount ?? 0}/${status?.freeLimit ?? 2}`}
            </Text>
          </View>
        </View>

        <View className="flex-row px-4">
          <View className="mr-3 w-[72px] items-center">
            <BouncyPressable
              onPress={createStoryFromLibrary}
              disabled={isUploading || status === undefined}
              contentStyle={{
                width: 68,
                height: 68,
                borderRadius: 25,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark, colors.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 25,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View className="h-[62px] w-[62px] items-center justify-center rounded-[22px] bg-background">
                  {isUploading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="add" size={29} color={colors.primary} />
                  )}
                </View>
              </LinearGradient>
            </BouncyPressable>
            <Text
              numberOfLines={1}
              className="mt-1.5 text-center text-[11px] font-semibold text-white"
            >
              Твоя
            </Text>
          </View>

          {groups === undefined ? (
            <View className="h-[68px] flex-1 justify-center">
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            groups
              .filter((group) => !group.isCurrentUser)
              .map((group, index) => (
                <Animated.View
                  key={group.userId}
                  entering={ZoomIn.delay(Math.min(index, 8) * 45)}
                  className="mr-3 w-[72px] items-center"
                >
                  <BouncyPressable
                    onPress={() => openStories(group)}
                    contentStyle={{
                      width: 68,
                      height: 68,
                      borderRadius: 25,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <LinearGradient
                      colors={[colors.accent, colors.primary, colors.primaryDark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        width: 68,
                        height: 68,
                        borderRadius: 25,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {group.image ? (
                        <Image
                          source={{ uri: group.image }}
                          className="h-[60px] w-[60px] rounded-[21px] border-2 border-background"
                        />
                      ) : (
                        <View className="h-[60px] w-[60px] items-center justify-center rounded-[21px] border-2 border-background bg-secondary">
                          <Ionicons
                            name="person"
                            size={24}
                            color={colors.primary}
                          />
                        </View>
                      )}
                    </LinearGradient>
                  </BouncyPressable>
                  <Text
                    numberOfLines={1}
                    className="mt-1.5 max-w-[70px] text-center text-[11px] text-textMuted"
                  >
                    {group.name} {group.profileEmoji}
                  </Text>
                </Animated.View>
              ))
          )}
        </View>
      </Animated.View>

      <StoryViewer
        group={selectedGroup}
        index={selectedIndex}
        onClose={() => setSelectedGroup(null)}
        onNext={advanceStory}
        onPrevious={() => setSelectedIndex((index) => Math.max(0, index - 1))}
        onDelete={() => void deleteSelectedStory()}
        isDeleting={isDeleting}
        now={now}
      />
    </>
  );
}
