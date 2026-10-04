import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library/legacy";
import * as Sharing from "expo-sharing";
import { Platform, Share } from "react-native";

export type SaveKind = "image" | "video" | "file";

const ALBUM = "Modesto";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/3gpp": "3gp",
  "application/pdf": "pdf",
};

const DEFAULT_EXT: Record<SaveKind, string> = { image: "jpg", video: "mp4", file: "bin" };

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 80) || "file";
}

function extOf(name: string | undefined): string | null {
  const m = name?.match(/\.([A-Za-z0-9]{2,5})$/);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Завантажує файл у кеш (з прогресом 0..1) і повертає локальний шлях.
 * Розширення береться з імені файлу, інакше з Content-Type, інакше за типом.
 */
export async function downloadToCache(
  url: string,
  kind: SaveKind,
  onProgress?: (fraction: number) => void,
  fileName?: string,
): Promise<string> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error("Немає доступу до кешу");
  const tmp = `${dir}mc_dl_${Date.now()}.tmp`;
  const task = FileSystem.createDownloadResumable(url, tmp, {}, (p) => {
    if (onProgress && p.totalBytesExpectedToWrite > 0) {
      onProgress(Math.min(1, p.totalBytesWritten / p.totalBytesExpectedToWrite));
    }
  });
  const res = await task.downloadAsync();
  if (!res || res.status < 200 || res.status >= 300) {
    await FileSystem.deleteAsync(tmp, { idempotent: true });
    throw new Error("Не вдалося завантажити файл");
  }
  const mime = (res.mimeType ?? res.headers?.["Content-Type"] ?? res.headers?.["content-type"] ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const ext = extOf(fileName) ?? MIME_EXT[mime] ?? DEFAULT_EXT[kind];
  const base = fileName ? safeName(fileName.replace(/\.[A-Za-z0-9]{2,5}$/, "")) : `Modesto_${Date.now()}`;
  const finalUri = `${dir}${base}_${Date.now() % 100000}.${ext}`;
  await FileSystem.moveAsync({ from: tmp, to: finalUri });
  onProgress?.(1);
  return finalUri;
}

/** Зберігає фото/відео в галерею (альбом «Modesto»). Для інших файлів відкриває системне меню збереження. */
export async function saveMedia(
  url: string,
  kind: SaveKind,
  onProgress?: (fraction: number) => void,
  fileName?: string,
): Promise<"gallery" | "shared"> {
  const local = await downloadToCache(url, kind, onProgress, fileName);
  if (kind === "file") {
    await shareLocal(local, fileName);
    return "shared";
  }
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (!perm.granted) {
    await FileSystem.deleteAsync(local, { idempotent: true });
    throw new Error("Немає дозволу на доступ до галереї");
  }
  const asset = await MediaLibrary.createAssetAsync(local);
  try {
    const album = await MediaLibrary.getAlbumAsync(ALBUM);
    if (album) await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    else await MediaLibrary.createAlbumAsync(ALBUM, asset, false);
  } catch {
    // альбом не вдалося створити — файл уже збережено в загальну галерею
  }
  await FileSystem.deleteAsync(local, { idempotent: true });
  return "gallery";
}

async function shareLocal(local: string, name?: string): Promise<void> {
  await Sharing.shareAsync(local, { dialogTitle: name ?? "Поділитися" });
}

/** Ділиться самим файлом (завантажує в кеш); якщо системне меню недоступне — ділиться посиланням. */
export async function shareMedia(
  url: string,
  kind: SaveKind,
  onProgress?: (fraction: number) => void,
  fileName?: string,
): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    const local = await downloadToCache(url, kind, onProgress, fileName);
    await shareLocal(local, fileName);
    return;
  }
  await Share.share(Platform.OS === "ios" ? { url } : { message: url });
}
