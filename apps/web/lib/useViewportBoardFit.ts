import { useEffect, type RefObject } from "react";

const MIN_SCALE = 0.52;
const ACTION_BAR_RESERVE_PX = 56;
const BOTTOM_GAP_PX = 8;

function readActionBarScrollReserve(): number {
  return readRootPx("--action-bar-scroll-reserve", ACTION_BAR_RESERVE_PX + BOTTOM_GAP_PX);
}
const SCALE_EPSILON = 0.025;

function readRootPx(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

function clearFit(game: HTMLElement): void {
  game.classList.remove("game--viewport-fit");
  game.style.removeProperty("--viewport-fit-card-width");
  game.style.removeProperty("--viewport-fit-sidebar-width");
}

function applyScaleVars(game: HTMLElement, scale: number): void {
  const baseCard = readRootPx("--card-width", 72);
  const baseSidebar = readRootPx("--playsheet-sidebar-width", 92);
  game.style.setProperty(
    "--viewport-fit-card-width",
    `${Math.max(28, Math.round(baseCard * scale))}px`,
  );
  game.style.setProperty(
    "--viewport-fit-sidebar-width",
    `${Math.max(52, Math.round(baseSidebar * scale))}px`,
  );
  game.classList.add("game--viewport-fit");
}

/** スクロール不変: getBoundingClientRect().top 単独ではなくドキュメント位置を使用。 */
function availableHeightForBoard(game: HTMLElement, board: HTMLElement): number {
  const boardTopInGame = board.getBoundingClientRect().top - game.getBoundingClientRect().top;
  const gameRect = game.getBoundingClientRect();
  const boardDocTop = gameRect.top + window.scrollY + boardTopInGame;
  const viewportH = window.visualViewport?.height ?? window.innerHeight;
  return viewportH - boardDocTop - readActionBarScrollReserve() - BOTTOM_GAP_PX;
}

/**
 * 任意の保険: 低い横向きビューポートで人間側プレイシートを縮小。
 * {@link COMPACT_VIEWPORT_MQ} に一致するときのみ有効。スクロール不変。
 */
export function useViewportBoardFit(
  gameRef: RefObject<HTMLElement | null>,
  humanBoardRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return;

    let frame = 0;
    let lastScale: number | null = null;

    const applyFit = () => {
      const game = gameRef.current;
      const board = humanBoardRef.current;
      if (!game || !board) return;

      const available = availableHeightForBoard(game, board);

      const scaled = game.classList.contains("game--viewport-fit");
      const naturalHeight =
        scaled && lastScale ? board.offsetHeight / lastScale : board.offsetHeight;

      if (naturalHeight <= available || available < 120) {
        clearFit(game);
        lastScale = null;
        return;
      }

      let scale = Math.max(MIN_SCALE, Math.min(1, available / naturalHeight));

      if (lastScale !== null && Math.abs(scale - lastScale) < SCALE_EPSILON) {
        applyScaleVars(game, lastScale);
        return;
      }

      applyScaleVars(game, scale);

      const scaledHeight = board.offsetHeight;
      if (scaledHeight > available + 1) {
        scale = Math.max(MIN_SCALE, scale * (available / scaledHeight));
      }

      applyScaleVars(game, scale);
      lastScale = scale;
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(applyFit);
    };

    const ro = new ResizeObserver(schedule);
    const gameEl = gameRef.current;
    const boardEl = humanBoardRef.current;
    if (gameEl) ro.observe(gameEl);
    if (boardEl) ro.observe(boardEl);

    const vv = window.visualViewport;
    vv?.addEventListener("resize", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);

    schedule();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      vv?.removeEventListener("resize", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      const game = gameRef.current;
      if (game) clearFit(game);
    };
  }, [enabled, gameRef, humanBoardRef]);
}
