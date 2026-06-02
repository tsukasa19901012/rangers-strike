"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { DragCardPayload } from "./dnd";

const DRAG_THRESHOLD_PX = 8;

type DropTargetRegistration = {
  accepts: () => boolean;
  drop: (payload: DragCardPayload) => void;
};

type DragVisual = {
  payload: DragCardPayload;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  imageSrc?: string;
};

type ActiveSession = DragVisual & {
  onEnd?: () => void;
};

type PendingPointer = {
  pointerId: number;
  startX: number;
  startY: number;
  axis: "none" | "horizontal" | "vertical";
  payload: DragCardPayload;
  sourceEl: HTMLElement;
  rect: DOMRect;
  imageSrc?: string;
  onStart?: () => void;
  onEnd?: () => void;
};

type PointerDragContextValue = {
  activeDrag: DragVisual | null;
  registerDropTarget: (el: HTMLElement, registration: DropTargetRegistration) => () => void;
  bindDragSource: (options: {
    enabled: boolean;
    payload: DragCardPayload;
    imageSrc?: string;
    onStart?: () => void;
    onEnd?: () => void;
  }) => (event: React.PointerEvent<HTMLElement>) => void;
  consumeClickSuppression: () => boolean;
};

const PointerDragContext = createContext<PointerDragContextValue | null>(null);

function findDropTarget(
  x: number,
  y: number,
  targets: Map<HTMLElement, DropTargetRegistration>,
): DropTargetRegistration | null {
  const elements = document.elementsFromPoint(x, y);
  for (const element of elements) {
    let node: HTMLElement | null = element as HTMLElement;
    while (node) {
      const target = targets.get(node);
      if (target?.accepts()) return target;
      node = node.parentElement;
    }
  }
  return null;
}

export function PointerDragProvider({ children }: { children: ReactNode }) {
  const targetsRef = useRef(new Map<HTMLElement, DropTargetRegistration>());
  const pendingRef = useRef<PendingPointer | null>(null);
  const activeRef = useRef<ActiveSession | null>(null);
  const hoveredRef = useRef<HTMLElement | null>(null);
  const suppressClickRef = useRef(false);

  const [activeDrag, setActiveDrag] = useState<DragVisual | null>(null);

  const clearHover = useCallback(() => {
    if (hoveredRef.current) {
      hoveredRef.current.classList.remove("drop-zone--drag-hover");
      hoveredRef.current = null;
    }
  }, []);

  const setHover = useCallback(
    (el: HTMLElement | null) => {
      if (hoveredRef.current === el) return;
      clearHover();
      if (!el) return;
      el.classList.add("drop-zone--drag-hover");
      hoveredRef.current = el;
    },
    [clearHover],
  );

  const finishDrag = useCallback(
    (clientX: number, clientY: number) => {
      const drag = activeRef.current;
      if (drag) {
        const target = findDropTarget(clientX, clientY, targetsRef.current);
        if (target) {
          target.drop(drag.payload);
          suppressClickRef.current = true;
        }
        drag.onEnd?.();
      }
      pendingRef.current = null;
      activeRef.current = null;
      setActiveDrag(null);
      clearHover();
      document.body.classList.remove("is-dragging-card");
    },
    [clearHover],
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const pending = pendingRef.current;
      const active = activeRef.current;

      if (active) {
        event.preventDefault();
        const next: DragVisual = {
          ...active,
          x: event.clientX,
          y: event.clientY,
        };
        activeRef.current = next;
        setActiveDrag(next);

        const hovered = [...targetsRef.current.entries()].find(([el, registration]) => {
          if (!registration.accepts()) return false;
          const rect = el.getBoundingClientRect();
          return (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          );
        });
        setHover(hovered?.[0] ?? null);
        return;
      }

      if (!pending || event.pointerId !== pending.pointerId) return;

      const dx = event.clientX - pending.startX;
      const dy = event.clientY - pending.startY;
      const distance = Math.hypot(dx, dy);
      if (distance < DRAG_THRESHOLD_PX) return;

      if (pending.axis === "none") {
        pending.axis = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
      if (pending.axis === "horizontal") {
        pendingRef.current = null;
        return;
      }

      event.preventDefault();
      pending.sourceEl.setPointerCapture(event.pointerId);
      document.body.classList.add("is-dragging-card");

      const drag: ActiveSession = {
        payload: pending.payload,
        x: event.clientX,
        y: event.clientY,
        offsetX: pending.startX - pending.rect.left,
        offsetY: pending.startY - pending.rect.top,
        width: pending.rect.width,
        height: pending.rect.height,
        imageSrc: pending.imageSrc,
        onEnd: pending.onEnd,
      };
      activeRef.current = drag;
      setActiveDrag(drag);
      pending.onStart?.();
      pendingRef.current = null;
    };

    const handlePointerUp = (event: PointerEvent) => {
      const pending = pendingRef.current;
      if (pending?.pointerId === event.pointerId) {
        pendingRef.current = null;
        return;
      }
      if (!activeRef.current) return;
      finishDrag(event.clientX, event.clientY);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (pendingRef.current?.pointerId === event.pointerId) {
        pendingRef.current = null;
      }
      if (!activeRef.current) return;
      finishDrag(event.clientX, event.clientY);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [finishDrag, setHover]);

  const registerDropTarget = useCallback(
    (el: HTMLElement, registration: DropTargetRegistration) => {
      targetsRef.current.set(el, registration);
      return () => {
        targetsRef.current.delete(el);
        if (hoveredRef.current === el) clearHover();
      };
    },
    [clearHover],
  );

  const bindDragSource = useCallback(
    ({
      enabled,
      payload,
      imageSrc,
      onStart,
      onEnd,
    }: {
      enabled: boolean;
      payload: DragCardPayload;
      imageSrc?: string;
      onStart?: () => void;
      onEnd?: () => void;
    }) =>
      (event: React.PointerEvent<HTMLElement>) => {
        if (!enabled || event.button !== 0) return;
        const sourceEl = event.currentTarget;
        pendingRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          axis: "none",
          payload,
          sourceEl,
          rect: sourceEl.getBoundingClientRect(),
          imageSrc,
          onStart,
          onEnd,
        };
      },
    [],
  );

  const consumeClickSuppression = useCallback(() => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }, []);

  return (
    <PointerDragContext.Provider
      value={{ activeDrag, registerDropTarget, bindDragSource, consumeClickSuppression }}
    >
      {children}
      {activeDrag && (
        <div
          className="drag-ghost"
          style={{
            width: activeDrag.width,
            height: activeDrag.height,
            transform: `translate(${activeDrag.x - activeDrag.offsetX}px, ${activeDrag.y - activeDrag.offsetY}px)`,
          }}
          aria-hidden
        >
          {activeDrag.imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={activeDrag.imageSrc} alt="" className="drag-ghost__image" draggable={false} />
          ) : (
            <div className="drag-ghost__placeholder" />
          )}
        </div>
      )}
    </PointerDragContext.Provider>
  );
}

export function usePointerDrag() {
  const context = useContext(PointerDragContext);
  if (!context) {
    throw new Error("usePointerDrag must be used within PointerDragProvider");
  }
  return context;
}

export function useDropTarget(
  ref: RefObject<HTMLElement | null>,
  registration: DropTargetRegistration,
) {
  const { registerDropTarget } = usePointerDrag();
  const acceptsRef = useRef(registration.accepts);
  const dropRef = useRef(registration.drop);

  acceptsRef.current = registration.accepts;
  dropRef.current = registration.drop;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return registerDropTarget(el, {
      accepts: () => acceptsRef.current(),
      drop: (payload) => dropRef.current(payload),
    });
  }, [ref, registerDropTarget]);
}
