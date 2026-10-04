import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

/**
 * Відкрити (або створити) особистий чат із користувачем.
 * mode: "push" — додати чат у стек, "replace" — замінити поточний екран (напр. «Нове повідомлення»),
 * "navigate" — повернутися до вже відкритого чату, якщо він є в стеку.
 */
export function useOpenDirectChat(mode: "push" | "replace" | "navigate" = "push") {
  const router = useRouter();
  const getOrCreate = useMutation(api.rooms.getOrCreateDirectRoom);
  const [busyId, setBusyId] = useState<Id<"users"> | null>(null);

  const open = useCallback(
    async (userId: Id<"users">) => {
      if (busyId) return;
      setBusyId(userId);
      try {
        const roomId = await getOrCreate({ otherUserId: userId });
        const href = `/chat/${roomId}` as any;
        if (mode === "replace") router.replace(href);
        else if (mode === "navigate") router.navigate(href);
        else router.push(href);
      } catch (error: any) {
        Alert.alert("Помилка", error?.message ?? "Не вдалося відкрити чат.");
      } finally {
        setBusyId(null);
      }
    },
    [busyId, getOrCreate, mode, router],
  );

  return { open, busyId };
}
