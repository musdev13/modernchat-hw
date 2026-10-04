import { File, Paths } from "expo-file-system";
import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";

// Незавершені повідомлення по чатах. Тримаємо в памʼяті й зберігаємо у файл у каталозі
// документів (без нових нативних залежностей), щоб чернетки переживали перезапуск.
const drafts = new Map<string, string>();
let snapshot: Record<string, string> = {};
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const draftsFile = () => new File(Paths.document, "chat-drafts.json");

function emit() {
  snapshot = Object.fromEntries(drafts);
  listeners.forEach((listener) => listener());
}

/** Негайно записує чернетки на диск. */
export function flushDrafts() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    const file = draftsFile();
    if (!file.exists) file.create();
    file.write(JSON.stringify(Object.fromEntries(drafts)));
  } catch (error) {
    console.warn("Не вдалося зберегти чернетки:", error);
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushDrafts, 400);
}

/** Один раз читає чернетки з диска (повторні виклики повертають той самий проміс). */
export function loadDrafts(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      try {
        const file = draftsFile();
        if (file.exists) {
          const stored = JSON.parse(await file.text()) as Record<string, unknown>;
          for (const [roomId, text] of Object.entries(stored)) {
            // Те, що користувач уже встиг набрати цього сеансу, важливіше за збережене.
            if (typeof text === "string" && text.trim() && !drafts.has(roomId)) {
              drafts.set(roomId, text);
            }
          }
        }
      } catch (error) {
        console.warn("Не вдалося прочитати чернетки:", error);
      }
      emit();
    })();
  }
  return loading;
}

export function getDraft(roomId: string): string {
  return drafts.get(roomId) ?? "";
}

/** Зберігає чернетку; порожній (або з самих пробілів) текст видаляє її. */
export function setDraft(roomId: string, text: string) {
  if (text.trim()) {
    if (drafts.get(roomId) === text) return;
    drafts.set(roomId, text);
  } else if (!drafts.delete(roomId)) {
    return;
  }
  emit();
  scheduleSave();
}

export function clearDraft(roomId: string) {
  setDraft(roomId, "");
}

AppState.addEventListener("change", (state) => {
  if (state !== "active" && saveTimer) flushDrafts();
});

/** Усі чернетки: { [roomId]: текст } — оновлюється при кожній зміні. */
export function useDrafts(): Record<string, string> {
  useEffect(() => {
    void loadDrafts();
  }, []);
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => snapshot,
    () => snapshot,
  );
}
