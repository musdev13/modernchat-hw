import { Id } from "@/convex/_generated/dataModel";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

export interface PickedImage {
  uri: string;
  mimeType: string;
}

/** Відкриває галерею й повертає обране квадратне зображення (або null, якщо скасовано). */
export async function pickSquareImage(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Немає доступу", "Дозвольте доступ до галереї, щоб обрати фото.");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" };
}

/** Завантажує локальний файл на одноразове посилання Convex storage. */
export async function uploadImageToStorage(
  uploadUrl: string,
  image: PickedImage,
): Promise<Id<"_storage">> {
  const file = new File(image.uri);
  if (!file.exists) throw new Error("Обране зображення не знайдено.");
  const base64 = await file.base64();
  if (!base64) throw new Error("Не вдалося прочитати зображення.");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": image.mimeType },
    body: bytes,
  });
  if (!response.ok) {
    throw new Error(`Не вдалося завантажити фото (${response.status})`);
  }
  const json = await response.json();
  if (!json.storageId) throw new Error("Сервер не повернув ідентифікатор файлу.");
  return json.storageId as Id<"_storage">;
}
