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
import { classifyGesture, type GestureKind } from "./cardGesture";
import type { DragCardPayload } from "./dnd";

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
  sourceEl: HTMLElement;
  pointerId: number;
  onEnd?: () => void;
};

type PendingPointer = {
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  inHorizontalScrollZone: boolean;
  payload: DragCardPayload;
  sourceEl: HTMLElement;
  rect: DOMRect;
  imageSrc?: string;
  onStart?: () => void;
  onEnd?: () => void;
  lock: GestureKind;
};

type PointerDragContextValue = {
  activeDrag: DragVisual | null;
  registerDropTarget: (el: HTMLElement, registration: DropTargetRegistration) => () => void;
  bindDragSource: (options: {
    enabled: boolean;
    payload: DragCardPayload;
    imageSrc?: string;
    inHorizontalScrollZone?: boolean;
    onStart?: () => void;
    onEnd?: () => void;
  }) => (event: React.PointerEvent<HTMLElement>) => void;
  consumeClickSuppression: () => boolean;
};

const PointerDragContext = createContext<PointerDragContextValue | null>(null);

function findDropTargetElement(
  x: number,
  y: number,
  targets: Map<HTMLElement, DropTargetRegistration>,
): HTMLElement | null {
  const elements = document.elementsFromPoint(x, y);
  for (const element of elements) {
    let node: HTMLElement | null = element as HTMLElement;
    while (node) {
      const target = targets.get(node);
      if (target?.accepts()) return node;
      node = node.parentElement;
    }
  }
  return null;
}

function releaseCapture(sourceEl: HTMLElement, pointerId: number) {
  if (sourceEl.hasPointerCapture(pointerId)) {
    sourceEl.releasePointerCapture(pointerId);
  }
}

function setSourceDragging(sourceEl: HTMLElement | null, active: boolean) {
  if (!sourceEl) return;
  sourceEl.classList.toggle("card--dragging-source", active);
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

  const cancelPending = useCallback((pointerId: number) => {
    const pending = pendingRef.current;
    if (!pending || pending.pointerId !== pointerId) return;
    releaseCapture(pending.sourceEl, pointerId);
    pendingRef.current = null;
  }, []);

  const finishDrag = useCallback(
    (clientX: number, clientY: number, pointerId?: number) => {
      const drag = activeRef.current;
      if (drag) {
        const targetEl = findDropTargetElement(clientX, clientY, targetsRef.current);
        if (targetEl) {
          targetsRef.current.get(targetEl)?.drop(drag.payload);
          suppressClickRef.current = true;
        }
        drag.onEnd?.();
        setSourceDragging(drag.sourceEl, false);
        releaseCapture(drag.sourceEl, pointerId ?? drag.pointerId);
      }

      const pending = pendingRef.current;
      if (pending) {
        releaseCapture(pending.sourceEl, pending.pointerId);
      }
      pendingRef.current = null;
      activeRef.current = null;
      setActiveDrag(null);
      clearHover();
      document.body.classList.remove("is-dragging-card");
    },
    [clearHover],
  );

  const startDrag = useCallback(
    (pending: PendingPointer, event: PointerEvent) => {
      event.preventDefault();
      pending.sourceEl.setPointerCapture(event.pointerId);
      document.body.classList.add("is-dragging-card");
      setSourceDragging(pending.sourceEl, true);

      const drag: ActiveSession = {
        payload: pending.payload,
        x: event.clientX,
        y: event.clientY,
        offsetX: pending.startX - pending.rect.left,
        offsetY: pending.startY - pending.rect.top,
        width: pending.rect.width,
        height: pending.rect.height,
        imageSrc: pending.imageSrc,
        sourceEl: pending.sourceEl,
        pointerId: event.pointerId,
        onEnd: pending.onEnd,
      };
      activeRef.current = drag;
      setActiveDrag(drag);
      pending.onStart?.();
      pendingRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const pending = pendingRef.current;
      const active = activeRef.current;

      if (active) {
        event.preventDefault();
        const next: ActiveSession = {
          ...active,
          x: event.clientX,
          y: event.clientY,
        };
        activeRef.current = next;
        setActiveDrag(next);
        setHover(findDropTargetElement(event.clientX, event.clientY, targetsRef.current));
        return;
      }

      if (!pending || event.pointerId !== pending.pointerId) return;

      const dx = event.clientX - pending.startX;
      const dy = event.clientY - pending.startY;

      const kind = classifyGesture(dx, dy, {
        inHorizontalScrollZone: pending.inHorizontalScrollZone,
        canDrag: true,
        pointerType: pending.pointerType,
      });

      if (kind === "pending") return;

      if (pending.lock === "pending") {
        pending.lock = kind;
      }

      if (pending.lock === "horizontal-scroll" || pending.lock === "vertical-scroll") {
        cancelPending(event.pointerId);
        return;
      }

      if (pending.lock === "drag") {
        startDrag(pending, event);
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (pendingRef.current?.pointerId === event.pointerId) {
        cancelPending(event.pointerId);
        return;
      }
      if (!activeRef.current || activeRef.current.pointerId !== event.pointerId) return;
      finishDrag(event.clientX, event.clientY, event.pointerId);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      finishDrag(event.clientX, event.clientY, event.pointerId);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [cancelPending, finishDrag, setHover, startDrag]);

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
      inHorizontalScrollZone = false,
      onStart,
      onEnd,
    }: {
      enabled: boolean;
      payload: DragCardPayload;
      imageSrc?: string;
      inHorizontalScrollZone?: boolean;
      onStart?: () => void;
      onEnd?: () => void;
    }) =>
      (event: React.PointerEvent<HTMLElement>) => {
        if (!enabled || event.button !== 0) return;

        const sourceEl = event.currentTarget;

        pendingRef.current = {
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          startX: event.clientX,
          startY: event.clientY,
          inHorizontalScrollZone,
          payload,
          sourceEl,
          rect: sourceEl.getBoundingClientRect(),
          imageSrc,
          onStart,
          onEnd,
          lock: "pending",
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
            transform: `translate3d(${activeDrag.x - activeDrag.offsetX}px, ${activeDrag.y - activeDrag.offsetY}px, 0)`,
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
