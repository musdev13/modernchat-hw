import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/** Локальні налаштування застосунку (зберігаються на пристрої; сповіщення — ще й на сервері). */
export interface AppSettings {
  appearance: {
    /** Масштаб тексту повідомлень: 0.85 … 1.35. */
    textScale: number;
    /** Радіус кутів бульбашок: 6 … 24. */
    bubbleRadius: number;
    /** Анімації інтерфейсу (появи, переходи). */
    animations: boolean;
    /** Анімовані зірки на тлі чату. */
    chatStars: boolean;
    /** Premium: великі попередні перегляди посилань (ширша картка та велике зображення). */
    largeLinkPreview: boolean;
  };
  data: {
    autoPhoto: boolean;
    autoVideo: boolean;
  };
  notifications: {
    /** Показувати банер, коли застосунок відкрито. */
    inApp: boolean;
  };
  privacy: {
    /** Надсилати співрозмовникам «друкує…». */
    sendTyping: boolean;
  };
  folders: {
    /** Приховані вкладки-папки списку чатів. */
    hidden: string[];
    /** Вкладка, з якої відкривається список чатів. */
    initial: string;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  appearance: { textScale: 1, bubbleRadius: 18, animations: true, chatStars: false, largeLinkPreview: false },
  data: { autoPhoto: true, autoVideo: true },
  notifications: { inApp: true },
  privacy: { sendTyping: true },
  folders: { hidden: [], initial: "all" },
};

const KEY = "app_settings_v1";

type Patch<K extends keyof AppSettings> = Partial<AppSettings[K]>;

interface SettingsContextValue {
  settings: AppSettings;
  ready: boolean;
  update: <K extends keyof AppSettings>(section: K, patch: Patch<K>) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  ready: false,
  update: () => {},
});

function merge(base: AppSettings, saved: unknown): AppSettings {
  if (!saved || typeof saved !== "object") return base;
  const out: any = { ...base };
  for (const k of Object.keys(base) as (keyof AppSettings)[]) {
    const s = (saved as any)[k];
    if (s && typeof s === "object") out[k] = { ...base[k], ...s };
  }
  const a = out.appearance;
  a.textScale = Math.min(1.35, Math.max(0.85, Number(a.textScale) || 1));
  a.bubbleRadius = Math.min(24, Math.max(6, Number(a.bubbleRadius) || 18));
  return out as AppSettings;
}

/** Модульна копія для коду поза React (обробник сповіщень). */
let current: AppSettings = DEFAULT_SETTINGS;
export const getSettingsSnapshot = () => current;

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    SecureStore.getItemAsync(KEY)
      .then((raw) => {
        if (!alive) return;
        if (raw) {
          try {
            const next = merge(DEFAULT_SETTINGS, JSON.parse(raw));
            current = next;
            setSettings(next);
          } catch {
            // пошкоджені дані — лишаємо типові
          }
        }
      })
      .catch(() => {})
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback<SettingsContextValue["update"]>((section, patch) => {
    setSettings((prev) => {
      const next = { ...prev, [section]: { ...prev[section], ...patch } } as AppSettings;
      current = next;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        SecureStore.setItemAsync(KEY, JSON.stringify(next)).catch(() => {});
      }, 250);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, ready, update }), [settings, ready, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}

/** Чи дозволено анімації (налаштування «Анімації»). */
export function useAnimationsEnabled(): boolean {
  return useContext(SettingsContext).settings.appearance.animations;
}
