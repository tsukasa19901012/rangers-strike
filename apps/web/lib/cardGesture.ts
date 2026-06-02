/**
 * Pointer gesture classification (dnd-kit / mobile map apps style).
 * Locks the primary axis after a small movement threshold so scroll and drag do not fight.
 */

export const GESTURE_ACTIVATION_PX = 10;
const DRAG_UP_MIN_PX = 12;
const AXIS_DOMINANCE = 1.15;

export type GestureKind = "pending" | "horizontal-scroll" | "vertical-scroll" | "drag";

export type GestureOptions = {
  /** Parent zone scrolls horizontally (hand / rush / battle / command). */
  inHorizontalScrollZone: boolean;
  /** Card can be dragged to play (not disabled). */
  canDrag: boolean;
  /** Mouse uses immediate drag; touch uses axis lock for scroll coexistence. */
  pointerType: string;
};

export function classifyGesture(
  dx: number,
  dy: number,
  options: GestureOptions,
): GestureKind {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const distance = Math.hypot(dx, dy);

  if (distance < GESTURE_ACTIVATION_PX) {
    return "pending";
  }

  if (options.pointerType === "mouse" && options.canDrag) {
    return "drag";
  }

  if (options.inHorizontalScrollZone && absDx > absDy * AXIS_DOMINANCE) {
    return "horizontal-scroll";
  }

  if (
    options.canDrag &&
    dy <= -DRAG_UP_MIN_PX &&
    absDy > absDx * AXIS_DOMINANCE
  ) {
    return "drag";
  }

  if (options.canDrag && dy < 0 && absDy >= GESTURE_ACTIVATION_PX && absDy >= absDx) {
    return "drag";
  }

  if (absDy > absDx * 0.85) {
    return "vertical-scroll";
  }

  if (options.inHorizontalScrollZone && absDx >= absDy) {
    return "horizontal-scroll";
  }

  return "vertical-scroll";
}
