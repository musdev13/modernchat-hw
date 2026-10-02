import { COLORS } from "@/constants/theme";
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
      <View className="flex-1 bg-black/95 items-center justify-center px-4">
        <View
          className="relative items-center justify-center"
          style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
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
              stroke="rgba(255,255,255,0.2)"
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
            }}
          >
            {isReady ? (
              <CameraView
                ref={cameraRef}
                mode="video"
                facing="front"
                videoQuality="480p"
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <Text className="text-white/70 text-xs text-center px-4">
                  Очікування дозволів...
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text className="text-white font-bold text-lg mt-6">
          {formatDuration(duration)} / {formatDuration(MAX_DURATION)}
        </Text>

        <Text className="text-white/50 text-xs mt-1">
          {isRecording ? "Запис..." : "Натисніть кнопку для запису"}
        </Text>

        <View className="flex-row items-center justify-around w-full mt-10 px-8">
          <TouchableOpacity
            onPress={handleCancel}
            disabled={isSending}
            className="w-14 h-14 rounded-full items-center justify-center bg-surfaceLight"
          >
            <Ionicons name="close" size={28} color={COLORS.white} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={isRecording ? handleStop : startRecording}
            disabled={!isReady || isSending}
            activeOpacity={0.85}
            className={`w-20 h-20 rounded-full items-center justify-center border-4 border-white ${
              !isReady || isSending
                ? "bg-surfaceLight opacity-50"
                : isRecording
                  ? "bg-red-500"
                  : "bg-primary"
            }`}
          >
            <Ionicons
              name={isRecording ? "stop" : "radio-button-on"}
              size={36}
              color={COLORS.white}
            />
          </TouchableOpacity>

          <View style={{ width: 56 }} />
        </View>

        {isSending && (
          <Text className="text-primary text-sm mt-6 font-semibold">
            Надсилання...
          </Text>
        )}
      </View>
    </Modal>
  );
};