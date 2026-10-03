import { Share } from "react-native";

/**
 * Копіює текст у буфер обміну.
 * Якщо пакет expo-clipboard ще не встановлено — відкриває системне меню «Поділитися».
 * Щоб увімкнути справжнє копіювання: `npx expo install expo-clipboard` і перезбірка dev-клієнта.
 */
export async function copyText(text: string): Promise<"copied" | "shared"> {
  try {
    const Clipboard = require("expo-clipboard") as {
      setStringAsync: (value: string) => Promise<boolean>;
    };
    await Clipboard.setStringAsync(text);
    return "copied";
  } catch {
    await Share.share({ message: text });
    return "shared";
  }
}
