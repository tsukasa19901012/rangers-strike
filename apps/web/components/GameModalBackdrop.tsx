"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type GameModalBackdropProps = {
  children: ReactNode;
  onBackdropClick?: () => void;
};

export function GameModalBackdrop({ children, onBackdropClick }: GameModalBackdropProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="modal-backdrop modal-backdrop--game"
      onClick={onBackdropClick}
      role="presentation"
    >
      {children}
    </div>,
    document.body,
  );
}
