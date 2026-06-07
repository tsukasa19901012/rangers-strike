import { useCallback, useRef } from "react";
import {
  CARD_LONG_PRESS_MS,
  shouldCancelCardLongPress,
} from "./cardGesture";

export { CARD_LONG_PRESS_MS, CARD_LONG_PRESS_MOVE_TOLERANCE_PX } from "./cardGesture";

type UseCardLongPressOptions = {
  enabled: boolean;
  onLongPress: () => void;
  onCancelPendingDrag?: (pointerId: number) => void;
  onSuppressClick?: () => void;
};

export function useCardLongPress({
  enabled,
  onLongPress,
  onCancelPendingDrag,
  onSuppressClick,
}: UseCardLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const suppressClickRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!enabled || event.button !== 0) return;

      suppressClickRef.current = false;
      startRef.current = {
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId,
      };

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        suppressClickRef.current = true;
        onCancelPendingDrag?.(event.pointerId);
        onSuppressClick?.();
        onLongPress();
      }, CARD_LONG_PRESS_MS);
    },
    [enabled, onCancelPendingDrag, onLongPress, onSuppressClick],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      const start = startRef.current;
      if (!start || start.pointerId !== event.pointerId) return;

      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (shouldCancelCardLongPress(dx, dy)) {
        clearTimer();
      }
    },
    [clearTimer],
  );

  const handlePointerEnd = useCallback(
    (event: React.PointerEvent) => {
      if (startRef.current?.pointerId === event.pointerId) {
        clearTimer();
      }
    },
    [clearTimer],
  );

  const consumeLongPressSuppression = useCallback(() => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }, []);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp: handlePointerEnd,
    handlePointerCancel: handlePointerEnd,
    consumeLongPressSuppression,
  };
}
