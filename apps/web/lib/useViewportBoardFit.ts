import { useEffect, type RefObject } from "react";

const MIN_SCALE = 0.52;
const ACTION_BAR_RESERVE_PX = 56;
const BOTTOM_GAP_PX = 8;

function readRootPx(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Shrinks the human playsheet (zones + hand) so it fits above the action bar
 * when vertical space is tight (e.g. phone landscape).
 */
export function useViewportBoardFit(
  gameRef: RefObject<HTMLElement | null>,
  humanBoardRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return;

    let frame = 0;

    const applyFit = () => {
      const game = gameRef.current;
      const board = humanBoardRef.current;
      if (!game || !board) return;

      game.classList.remove("game--viewport-fit");
      game.style.removeProperty("--viewport-fit-card-width");
      game.style.removeProperty("--viewport-fit-sidebar-width");

      const viewportH = window.visualViewport?.height ?? window.innerHeight;
      const boardTop = board.getBoundingClientRect().top;
      const available = viewportH - boardTop - ACTION_BAR_RESERVE_PX - BOTTOM_GAP_PX;

      let naturalHeight = board.getBoundingClientRect().height;
      if (naturalHeight <= available || available < 120) {
        return;
      }

      let scale = Math.max(MIN_SCALE, Math.min(1, available / naturalHeight));
      const baseCard = readRootPx("--card-width", 72);
      const baseSidebar = readRootPx("--playsheet-sidebar-width", 92);

      const applyScale = (s: number) => {
        game.style.setProperty(
          "--viewport-fit-card-width",
          `${Math.max(28, Math.round(baseCard * s))}px`,
        );
        game.style.setProperty(
          "--viewport-fit-sidebar-width",
          `${Math.max(52, Math.round(baseSidebar * s))}px`,
        );
        game.classList.add("game--viewport-fit");
      };

      applyScale(scale);

      const scaledHeight = board.getBoundingClientRect().height;
      if (scaledHeight > available + 1) {
        scale = Math.max(MIN_SCALE, scale * (available / scaledHeight));
        applyScale(scale);
      }
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
    vv?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);

    schedule();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      vv?.removeEventListener("resize", schedule);
      vv?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      gameRef.current?.classList.remove("game--viewport-fit");
      gameRef.current?.style.removeProperty("--viewport-fit-card-width");
      gameRef.current?.style.removeProperty("--viewport-fit-sidebar-width");
    };
  }, [enabled, gameRef, humanBoardRef]);
}
