import { PopoverMenu } from "@/components/PopoverMenu";
import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { QuickReactionBar } from "./ReactionPickerModal";

type IconName = ComponentProps<typeof Ionicons>["name"];

export interface MessageAction {
  key: string;
  label: string;
  icon: IconName;
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  /** Короткий фрагмент повідомлення для підпису. */
  preview?: string;
  /** Емодзі, які користувач уже поставив на це повідомлення. */
  myReactions?: string[];
  actions: MessageAction[];
  onClose: () => void;
  onReact: (emoji: string) => void;
  onMoreReactions: () => void;
  premium?: boolean;
  onLockedReaction?: () => void;
}

/** Меню довгого натискання: швидкі реакції + список дій (спільний стиль PopoverMenu). */
export function MessageActionSheet({
  visible,
  preview,
  myReactions,
  actions,
  onClose,
  onReact,
  onMoreReactions,
  premium,
  onLockedReaction,
}: Props) {
  return (
    <PopoverMenu
      visible={visible}
      onClose={onClose}
      placement="center"
      caption={preview}
      header={
        <QuickReactionBar
          selected={myReactions}
          onSelect={(emoji) => {
            onReact(emoji);
            onClose();
          }}
          onMore={onMoreReactions}
          premium={premium}
          onLocked={() => {
            onClose();
            onLockedReaction?.();
          }}
        />
      }
      actions={actions}
    />
  );
}
