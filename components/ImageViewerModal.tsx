import { MediaViewer } from "@/components/MediaViewer";
import { useMemo } from "react";

type Props = {
  visible: boolean;
  imageUrl: string | null;
  onClose: () => void;
};

/** Перегляд одного фото (аватар тощо) — той самий переглядач з зумом і закриттям свайпом. */
export function ImageViewerModal({ visible, imageUrl, onClose }: Props) {
  const items = useMemo(
    () => (imageUrl ? [{ id: imageUrl, kind: "image" as const, url: imageUrl }] : []),
    [imageUrl],
  );
  return <MediaViewer visible={visible && !!imageUrl} items={items} onClose={onClose} />;
}
