import { Id } from "@/convex/_generated/dataModel";
import { File, UploadType } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

export type AttachmentKind = "image" | "video" | "file";

/** Вкладення, яке користувач обрав, але ще не надіслав. */
export interface PendingAttachment {
  id: string;
  uri: string;
  kind: AttachmentKind;
  name: string;
  size?: number;
  mimeType: string;
  width?: number;
  height?: number;
  /** Тривалість відео, секунди. */
  duration?: number;
}

export const MAX_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;

let counter = 0;
const nextId = () => `att-${Date.now()}-${counter++}`;

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ГБ`;
}

function fromAsset(asset: ImagePicker.ImagePickerAsset): PendingAttachment {
  const isVideo = asset.type === "video";
  const fallbackName = `${isVideo ? "video" : "photo"}-${Date.now()}.${isVideo ? "mp4" : "jpg"}`;
  return {
    id: nextId(),
    uri: asset.uri,
    kind: isVideo ? "video" : "image",
    name: asset.fileName ?? fallbackName,
    size: asset.fileSize,
    mimeType: asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg"),
    width: asset.width,
    height: asset.height,
    duration: asset.duration ? asset.duration / 1000 : undefined,
  };
}

/** Галерея: кілька фото й відео одразу. */
export async function pickFromGallery(limit: number): Promise<PendingAttachment[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Немає доступу", "Дозвольте доступ до галереї, щоб надсилати фото й відео.");
    return [];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    allowsMultipleSelection: true,
    selectionLimit: Math.max(1, limit),
    orderedSelection: true,
    quality: 0.85,
  });
  if (result.canceled) return [];
  return result.assets.map(fromAsset);
}

/** Камера: одне фото або відео. */
export async function captureWithCamera(): Promise<PendingAttachment[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Немає доступу", "Дозвольте доступ до камери, щоб зробити фото чи відео.");
    return [];
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images", "videos"],
    quality: 0.85,
    videoMaxDuration: 180,
  });
  if (result.canceled) return [];
  return result.assets.map(fromAsset);
}

/** Системний вибір довільних файлів (кілька одразу). */
export async function pickDocuments(): Promise<PendingAttachment[]> {
  const result = await File.pickFileAsync({ multipleFiles: true });
  if (result.canceled) return [];
  return result.result.map((file) => ({
    id: nextId(),
    uri: file.uri,
    kind: "file" as const,
    name: file.name || "Файл",
    size: file.size ?? undefined,
    mimeType: file.type || "application/octet-stream",
  }));
}

/** Завантажує локальний файл на одноразове посилання Convex storage з відсотками прогресу. */
export async function uploadToStorage(
  uploadUrl: string,
  attachment: Pick<PendingAttachment, "uri" | "mimeType">,
  onProgress: (fraction: number) => void,
): Promise<Id<"_storage">> {
  const file = new File(attachment.uri);
  const mime = attachment.mimeType || file.type || "application/octet-stream";

  const parse = (body: string): Id<"_storage"> => {
    const id = JSON.parse(body)?.storageId;
    if (!id) throw new Error("Сервер не повернув ідентифікатор файлу.");
    return id as Id<"_storage">;
  };

  try {
    const task = file.createUploadTask(uploadUrl, {
      httpMethod: "POST",
      uploadType: UploadType.BINARY_CONTENT,
      headers: { "Content-Type": mime },
      sessionType: "foreground",
      onProgress: ({ bytesSent, totalBytes }) => {
        if (totalBytes > 0) onProgress(Math.min(1, bytesSent / totalBytes));
      },
    });
    const response = await task.uploadAsync();
    if (!response || response.status < 200 || response.status >= 300) {
      throw new Error(`Не вдалося завантажити файл (${response?.status ?? "—"})`);
    }
    onProgress(1);
    return parse(response.body);
  } catch (error) {
    // Запасний шлях без відсотків: звичайний fetch із файлом як тілом запиту.
    console.warn("Завантаження з прогресом не вдалося, пробуємо fetch:", error);
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": mime },
      body: file as unknown as Blob,
    });
    if (!response.ok) throw new Error(`Не вдалося завантажити файл (${response.status})`);
    onProgress(1);
    return parse(await response.text());
  }
}
