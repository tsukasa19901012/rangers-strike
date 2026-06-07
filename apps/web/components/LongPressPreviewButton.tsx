"use client";

import { useCardLongPress } from "@/lib/useCardLongPress";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type LongPressPreviewButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  onPreview?: () => void;
  children: ReactNode;
};

export function LongPressPreviewButton({
  onPreview,
  onClick,
  children,
  disabled,
  ...rest
}: LongPressPreviewButtonProps) {
  const longPress = useCardLongPress({
    enabled: !!onPreview && !disabled,
    onLongPress: () => onPreview?.(),
  });

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (longPress.consumeLongPressSuppression()) return;
    onClick?.(event);
  };

  return (
    <button
      {...rest}
      type={rest.type ?? "button"}
      disabled={disabled}
      onPointerDown={(event) => {
        longPress.handlePointerDown(event);
        rest.onPointerDown?.(event);
      }}
      onPointerMove={(event) => {
        longPress.handlePointerMove(event);
        rest.onPointerMove?.(event);
      }}
      onPointerUp={(event) => {
        longPress.handlePointerUp(event);
        rest.onPointerUp?.(event);
      }}
      onPointerCancel={(event) => {
        longPress.handlePointerCancel(event);
        rest.onPointerCancel?.(event);
      }}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}
