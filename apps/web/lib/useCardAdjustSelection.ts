import { useEffect } from "react";

export function useCardAdjustSelection(
  selectedCardId: string | null,
  setSelectedCardId: (cardId: string | null) => void,
) {
  useEffect(() => {
    if (!selectedCardId) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (target.closest(".deck-builder__deck-cell--selected")) return;
      setSelectedCardId(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [selectedCardId, setSelectedCardId]);
}
