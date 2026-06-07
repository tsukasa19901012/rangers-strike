/**
 * ポインタジェスチャの分類（dnd-kit / モバイル地図アプリ方式）。
 * 小さな移動閾値後に主軸をロックし、スクロールとドラッグの競合を防ぐ。
 */

export const GESTURE_ACTIVATION_PX = 10;
const DRAG_UP_MIN_PX = 12;
const AXIS_DOMINANCE = 1.15;

/** カード詳細表示（長押し）の待ち時間。 */
export const CARD_LONG_PRESS_MS = 450;
export const CARD_LONG_PRESS_MOVE_TOLERANCE_PX = 10;

export function shouldCancelCardLongPress(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > CARD_LONG_PRESS_MOVE_TOLERANCE_PX;
}

export type GestureKind = "pending" | "horizontal-scroll" | "vertical-scroll" | "drag";

export type GestureOptions = {
  /** 親ゾーンが横スクロール（手札 / ラッシュ / バトル / コマンド）。 */
  inHorizontalScrollZone: boolean;
  /** カードをドラッグしてプレイ可能（無効でない）。 */
  canDrag: boolean;
  /** マウスは即ドラッグ；タッチはスクロール共存のため軸ロック。 */
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
