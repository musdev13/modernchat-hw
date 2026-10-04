import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { Modal, StatusBar, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  url: string | null;
  onClose: () => void;
}

function Player({ url, onClose }: { url: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(url, (p) => {
    p.play();
  });
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <VideoView
        player={player}
        style={{ flex: 1 }}
        nativeControls
        contentFit="contain"
      />
      <TouchableOpacity
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Закрити"
        style={{
          position: "absolute",
          top: insets.top + 8,
          left: 12,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: "rgba(0,0,0,0.55)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="close" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

/** Повноекранний перегляд відео з рідними елементами керування. */
export function VideoViewerModal({ url, onClose }: Props) {
  return (
    <Modal visible={!!url} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar hidden />
      {url ? <Player url={url} onClose={onClose} /> : null}
    </Modal>
  );
}
