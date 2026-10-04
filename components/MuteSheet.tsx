import { ActionSheet } from "@/components/ActionSheet";

const HOUR = 60 * 60 * 1000;

interface Props {
  visible: boolean;
  onClose: () => void;
  /** durationMs === undefined — вимкнути назавжди. */
  onPick: (durationMs?: number) => void;
  title?: string;
}

/** Вибір, на який час вимкнути сповіщення чату. */
export function MuteSheet({ visible, onClose, onPick, title }: Props) {
  const options: { key: string; label: string; ms?: number }[] = [
    { key: "1h", label: "На 1 годину", ms: HOUR },
    { key: "8h", label: "На 8 годин", ms: 8 * HOUR },
    { key: "2d", label: "На 2 дні", ms: 48 * HOUR },
    { key: "forever", label: "Назавжди" },
  ];
  return (
    <ActionSheet
      visible={visible}
      onClose={onClose}
      title="Вимкнути сповіщення"
      subtitle={title}
      actions={options.map((option) => ({
        key: option.key,
        label: option.label,
        icon: "notifications-off-outline" as const,
        onPress: () => onPick(option.ms),
      }))}
    />
  );
}

/** Підпис «Вимкнено до …» для рядка/кнопки. */
export function mutedUntilLabel(mutedUntil?: number): string {
  if (!mutedUntil) return "Вимкнено";
  const d = new Date(mutedUntil);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const same = d.toDateString() === new Date().toDateString();
  const date = same
    ? ""
    : ` ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `До${date} ${hh}:${mm}`;
}
