import { MediaViewer } from "@/components/MediaViewer";
import { useMemo } from "react";

interface Props {
  url: string | null;
  onClose: () => void;
}

/** Перегляд одного відео в єдиному переглядачі (власні елементи керування, зум, швидкість). */
export function VideoViewerModal({ url, onClose }: Props) {
  const items = useMemo(
    () => (url ? [{ id: url, kind: "video" as const, url }] : []),
    [url],
  );
  return <MediaViewer visible={!!url} items={items} onClose={onClose} />;
}
