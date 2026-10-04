import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useEffect } from "react";
import { AppState } from "react-native";

// Інтервал heartbeat; на сервері «в мережі» = heartbeat не пізніше ніж 70 с тому.
const HEARTBEAT_INTERVAL_MS = 40_000;

/**
 * Загальна присутність: поки застосунок на передньому плані — heartbeat кожні 40 с;
 * у фоні — goOffline (фіксує «був(ла) о …» і одразу знімає статус «в мережі»).
 */
export function usePresence() {
  const heartbeat = useMutation(api.presence.heartbeat);
  const goOffline = useMutation(api.presence.goOffline);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      heartbeat().catch(() => {});
      timer = setInterval(() => heartbeat().catch(() => {}), HEARTBEAT_INTERVAL_MS);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      goOffline().catch(() => {});
    };

    if (AppState.currentState === "active") start();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") start();
      else stop();
    });

    return () => {
      sub.remove();
      if (timer) clearInterval(timer);
    };
  }, [heartbeat, goOffline]);
}
