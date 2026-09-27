import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";

export interface RecordedVoice {
  uri: string;
  durationSeconds: number;
  waveform: number[];
}

const WAVEFORM_BARS = 32;
const LIVE_BARS = 30;
const METERING_INTERVAL_MS = 80;

/**
 * Нормалізує dB (від'ємні значення, типово -160..0) у [0..1].
 * Формула підібрана так, щоб навіть тиха мова давала помітні стовпчики,
 * але не було «насичення» на гучних звуках.
 */
function dbToAmplitude(db: number): number {
  if (!Number.isFinite(db)) return 0.05;
  const clamped = Math.max(-60, Math.min(0, db));
  const linear = (clamped + 60) / 60; // 0..1
  return Math.max(0.05, Math.min(1, Math.pow(linear, 0.6)));
}

/**
 * Перетворює довільну історію амплітуд у масив з рівно 32 значень
 * через усереднення по групах. Використовується при фіналізації запису.
 */
function reduceToWaveform(history: number[]): number[] {
  if (history.length === 0) {
    return Array.from({ length: WAVEFORM_BARS }, () => 0.15);
  }

  const result: number[] = [];
  const groupSize = Math.max(1, Math.floor(history.length / WAVEFORM_BARS));

  for (let i = 0; i < WAVEFORM_BARS; i++) {
    const start = i * groupSize;
    const end =
      i === WAVEFORM_BARS - 1
        ? history.length
        : Math.min(history.length, (i + 1) * groupSize);

    if (start >= history.length) {
      result.push(0.15);
      continue;
    }

    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += history[j];
      count += 1;
    }

    const avg = count > 0 ? sum / count : 0.15;
    // легкий «роздув» для виразності
    const boosted = Math.min(1, Math.max(0.12, avg * 1.4));
    result.push(Number(boosted.toFixed(2)));
  }

  return result;
}

export interface UseVoiceRecorderResult {
  isRecording: boolean;
  durationMillis: number;
  liveAmplitudes: number[];
  hasPermission: boolean | null;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<RecordedVoice | null>;
  cancelRecording: () => Promise<void>;
}

export function useVoiceRecorder(): UseVoiceRecorderResult {
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });

  const recorderState = useAudioRecorderState(recorder, METERING_INTERVAL_MS);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [liveAmplitudes, setLiveAmplitudes] = useState<number[]>([]);

  const amplitudeHistoryRef = useRef<number[]>([]);
  const isStoppingRef = useRef(false);

  // Запит дозволу при монтуванні
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (mounted) {
          setHasPermission(permission.granted);
        }
      } catch {
        if (mounted) setHasPermission(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Реактивно відстежуємо metering з recorderState
  useEffect(() => {
    if (!recorderState.isRecording) return;

    const db = recorderState.metering;
    if (typeof db !== "number") return;

    const amplitude = dbToAmplitude(db);

    amplitudeHistoryRef.current.push(amplitude);

    setLiveAmplitudes((prev) => {
      const next = [...prev, amplitude];
      if (next.length > LIVE_BARS) {
        next.splice(0, next.length - LIVE_BARS);
      }
      return next;
    });
  }, [
    recorderState.isRecording,
    recorderState.metering,
    recorderState.durationMillis,
  ]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (recorderState.isRecording) return false;

    try {
      // Запит дозволу, якщо ще не отримано
      if (!hasPermission) {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        setHasPermission(permission.granted);
        if (!permission.granted) return false;
      }

      // Перемикаємо аудіо-модуль у режим запису
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Очищуємо історію перед новим записом
      amplitudeHistoryRef.current = [];
      setLiveAmplitudes([]);
      isStoppingRef.current = false;

      await recorder.prepareToRecordAsync();
      recorder.record();

      return true;
    } catch (error) {
      console.error("Не вдалося почати запис:", error);
      return false;
    }
  }, [hasPermission, recorder, recorderState.isRecording]);

  const stopRecording = useCallback(async (): Promise<RecordedVoice | null> => {
    if (!recorderState.isRecording || isStoppingRef.current) return null;

    isStoppingRef.current = true;

    try {
      const durationBeforeStop = recorderState.durationMillis;
      await recorder.stop();

      // Повертаємо аудіо-модуль у режим відтворення
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      const uri = recorder.uri;
      if (!uri) return null;

      const durationSeconds = Math.max(
        1,
        Math.round(durationBeforeStop / 1000),
      );

      const waveform = reduceToWaveform(amplitudeHistoryRef.current);

      // Очищаємо live-стан
      setLiveAmplitudes([]);
      amplitudeHistoryRef.current = [];

      return { uri, durationSeconds, waveform };
    } catch (error) {
      console.error("Не вдалося зупинити запис:", error);
      return null;
    } finally {
      isStoppingRef.current = false;
    }
  }, [recorder, recorderState.durationMillis, recorderState.isRecording]);

  const cancelRecording = useCallback(async () => {
    if (!recorderState.isRecording) return;

    isStoppingRef.current = true;

    try {
      await recorder.stop();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
    } catch (error) {
      console.error("Не вдалося скасувати запис:", error);
    } finally {
      setLiveAmplitudes([]);
      amplitudeHistoryRef.current = [];
      isStoppingRef.current = false;
    }
  }, [recorder, recorderState.isRecording]);

  return {
    isRecording: recorderState.isRecording,
    durationMillis: recorderState.durationMillis ?? 0,
    liveAmplitudes,
    hasPermission,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
