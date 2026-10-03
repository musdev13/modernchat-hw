import { KawaiiGradient } from "@/components/ui/KawaiiGradient";
import { COLORS, FONTS } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Modal, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

interface VideoNoteRecorderModalProps {
  visible: boolean;
  onClose: () => void;
  onSendVideo: (videoUri: string, durationSeconds: number) => Promise<void>;
}

const MAX_DURATION = 60;
const CIRCLE_SIZE = 260;
const INNER_SIZE = CIRCLE_SIZE - 12;
const STROKE_WIDTH = 4;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const VideoNoteRecorderModal: React.FC<VideoNoteRecorderModalProps> = ({
  visible,
  onClose,
  onSendVideo,
}) => {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const cameraRef = useRef<CameraView>(null);
  const isCancelledRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [facing, setFacing] = useState<"front" | "back">("front");

  useEffect(() => {
    if (!visible) return;

    if (!cameraPermission?.granted) {
      void requestCameraPermission();
    }
    if (!micPermission?.granted) {
      void requestMicPermission();
    }
  }, [visible, cameraPermission?.granted, micPermission?.granted]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (visible) {
      isCancelledRef.current = false;
      setDuration(0);
      setIsRecording(false);
      setIsSending(false);
      setFacing("front");
    }
  }, [visible]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopRecording = () => {
    clearTimer();
    cameraRef.current?.stopRecording();
  };

  const startRecording = async () => {
    if (!cameraRef.current || isRecording) return;

    if (!cameraPermission?.granted || !micPermission?.granted) {
      Alert.alert(
        "Дозволи потрібні",
        "Надайте доступ до камери та мікрофона для запису відеокружечка.",
      );
      return;
    }

    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      isCancelledRef.current = false;
      setIsRecording(true);
      setDuration(0);
      startTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDuration(elapsed);

        if (elapsed >= MAX_DURATION) {
          stopRecording();
        }
      }, 100);

      const video = await cameraRef.current.recordAsync({
        maxDuration: MAX_DURATION,
      });

      clearTimer();
      setIsRecording(false);

      if (isCancelledRef.current) {
        setDuration(0);
        return;
      }

      if (video?.uri) {
        const finalDuration = Math.max(
          1,
          Math.round((Date.now() - startTimeRef.current) / 1000),
        );

        setIsSending(true);
        try {
          await onSendVideo(video.uri, finalDuration);
          onClose();
        } catch (error) {
          console.error("Помилка надсилання кружечка:", error);
          Alert.alert("Помилка", "Не вдалося надіслати відеокружечок.");
        } finally {
          setIsSending(false);
        }
      }
    } catch (error) {
      clearTimer();
      setIsRecording(false);
      console.error("Помилка запису відео:", error);
      Alert.alert("Помилка", "Не вдалося записати відео.");
    } finally {
      setDuration(0);
    }
  };

  const handleStop = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    stopRecording();
  };

  const handleFlipCamera = () => {
    if (isRecording) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFacing((prev) => (prev === "front" ? "back" : "front"));
  };

  const handleCancel = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    isCancelledRef.current = true;

    if (isRecording) {
      stopRecording();
    }

    clearTimer();
    setDuration(0);
    setIsRecording(false);
    onClose();
  };

  const formatDuration = (sec: number) => {
    const safe = Math.max(0, Math.floor(sec));
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const progressRatio = Math.min(1, duration / MAX_DURATION);
  const strokeDashoffset = CIRCUMFERENCE - progressRatio * CIRCUMFERENCE;
  const isReady = cameraPermission?.granted && micPermission?.granted;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(10,6,18,0.97)",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 16,
        }}
      >
        <View
          style={{ alignItems: "center", marginBottom: 22 }}
        >
          <Text
            style={{
              color: COLORS.primary,
              fontFamily: FONTS.headingBold,
              fontSize: 20,
            }}
          >
            Відеокружечок
          </Text>
          <Text style={{ fontSize: 11, marginTop: 2 }}>✨ 📹 💕</Text>
        </View>

        <View
          style={{
            position: "relative",
            alignItems: "center",
            justifyContent: "center",
            width: CIRCLE_SIZE,
            height: CIRCLE_SIZE,
          }}
        >
          <Svg
            width={CIRCLE_SIZE}
            height={CIRCLE_SIZE}
            style={{
              position: "absolute",
              transform: [{ rotate: "-90deg" }],
              zIndex: 10,
            }}
            pointerEvents="none"
          >
            <Circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              stroke="rgba(183,148,246,0.25)"
              strokeWidth={STROKE_WIDTH}
              fill="none"
            />

            {isRecording && (
              <Circle
                cx={CIRCLE_SIZE / 2}
                cy={CIRCLE_SIZE / 2}
                r={RADIUS}
                stroke={progressRatio >= 0.9 ? COLORS.danger : COLORS.primary}
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
              />
            )}
          </Svg>

          <View
            style={{
              width: INNER_SIZE,
              height: INNER_SIZE,
              borderRadius: INNER_SIZE / 2,
              overflow: "hidden",
              backgroundColor: COLORS.background,
              borderWidth: 1,
              borderColor: "rgba(255,143,180,0.25)",
            }}
          >
            {isReady ? (
              <CameraView
                ref={cameraRef}
                mode="video"
                facing={facing}
                videoQuality="480p"
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 20,
                }}
              >
                <Text style={{ fontSize: 28, marginBottom: 6 }}>🔒</Text>
                <Text
                  style={{
                    color: COLORS.textMuted,
                    fontFamily: FONTS.body,
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  Очікування дозволів...
                </Text>
              </View>
            )}
          </View>

          {isReady && (
            <TouchableOpacity
              onPress={handleFlipCamera}
              disabled={isRecording || isSending}
              activeOpacity={0.8}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                zIndex: 20,
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0,0,0,0.55)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.2)",
                opacity: isRecording ? 0.35 : 1,
              }}
            >
              <Ionicons
                name="camera-reverse-outline"
                size={20}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          )}
        </View>

        <View
          style={{
            marginTop: 20,
            paddingHorizontal: 20,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: "rgba(183,148,246,0.1)",
            borderWidth: 1,
            borderColor: "rgba(183,148,246,0.25)",
          }}
        >
          <Text
            style={{
              color: COLORS.text,
              fontFamily: FONTS.headingBold,
              fontSize: 18,
              letterSpacing: 0.5,
            }}
          >
            {formatDuration(duration)}{" "}
            <Text style={{ color: COLORS.textMuted, fontSize: 14 }}>
              / {formatDuration(MAX_DURATION)}
            </Text>
          </Text>
        </View>

        <Text
          style={{
            color: COLORS.textMuted,
            fontFamily: FONTS.body,
            fontSize: 11,
            marginTop: 10,
            letterSpacing: 0.3,
          }}
        >
          {isRecording
            ? "🔴 Запис йде..."
            : "Натисни кнопку, щоб почати запис"}
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-around",
            width: "100%",
            marginTop: 30,
            paddingHorizontal: 24,
          }}
        >
          <TouchableOpacity
            onPress={handleCancel}
            disabled={isSending}
            activeOpacity={0.85}
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,92,122,0.15)",
              borderWidth: 1,
              borderColor: "rgba(255,92,122,0.3)",
            }}
          >
            <Ionicons name="close" size={26} color={COLORS.danger} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={isRecording ? handleStop : startRecording}
            disabled={!isReady || isSending}
            activeOpacity={0.85}
          >
            <KawaiiGradient
              variant={isRecording ? "bubble-mine" : "primary"}
              glow
              style={{
                width: 84,
                height: 84,
                borderRadius: 42,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 4,
                borderColor: "#FFFFFF",
                opacity: !isReady || isSending ? 0.5 : 1,
              }}
            >
              <Ionicons
                name={isRecording ? "stop" : "radio-button-on"}
                size={34}
                color="#FFFFFF"
              />
            </KawaiiGradient>
          </TouchableOpacity>

          <View style={{ width: 56 }} />
        </View>

        {isSending && (
          <Text
            style={{
              color: COLORS.primary,
              fontFamily: FONTS.bodyBold,
              fontSize: 13,
              marginTop: 24,
            }}
          >
            ✨ Надсилання...
          </Text>
        )}
      </View>
    </Modal>
  );
};