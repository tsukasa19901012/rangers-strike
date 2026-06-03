"use client";

import Image from "next/image";
import type { CardDefinition } from "@rangers-strike/cards";
import { getCardBackImageUrl, getCardEffect } from "@rangers-strike/cards";
import { type DragCardPayload } from "@/lib/dnd";
import { usePointerDrag } from "@/lib/PointerDragContext";

type CardImageProps = {
  card?: CardDefinition;
  instanceId?: string;
  fromZone?: DragCardPayload["fromZone"];
  playerId?: DragCardPayload["playerId"];
  small?: boolean;
  selected?: boolean;
  disabled?: boolean;
  draggable?: boolean;
  onDragStartExtra?: () => void;
  onDragEnd?: () => void;
  onPreview?: () => void;
  onSelect?: () => void;
  commandHeld?: boolean;
  hideMeta?: boolean;
  faceDown?: boolean;
};

export function CardImage({
  card,
  instanceId,
  fromZone,
  playerId,
  small,
  selected,
  disabled,
  draggable,
  onDragStartExtra,
  onDragEnd,
  onPreview,
  onSelect,
  commandHeld,
  hideMeta,
  faceDown,
}: CardImageProps) {
  const { bindDragSource, consumeClickSuppression } = usePointerDrag();

  if (!card) return null;

  const className = [
    "card",
    small ? "card--small" : "",
    selected ? "card--selected" : "",
    disabled ? "card--disabled" : "",
    draggable && !disabled ? "card--draggable" : "",
    onPreview || onSelect ? "card--previewable" : "",
    commandHeld ? "card--command-held" : "",
    faceDown ? "card--face-down" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const effect = getCardEffect(card.id);
  const imageSrc = faceDown ? getCardBackImageUrl() : card.imageUrl;
  const imageAlt = faceDown ? "カード裏" : card.name;

  const canDrag =
    draggable && !disabled && !!instanceId && !!fromZone && !!playerId;

  const dragPayload: DragCardPayload | null = canDrag
    ? {
        instanceId,
        cardId: card.id,
        fromZone,
        playerId,
      }
    : null;

  const inHorizontalScrollZone =
    fromZone === "hand" ||
    fromZone === "rush" ||
    fromZone === "battle" ||
    fromZone === "command";

  const handlePointerDown =
    dragPayload &&
    bindDragSource({
      enabled: true,
      payload: dragPayload,
      imageSrc: imageSrc ?? undefined,
      inHorizontalScrollZone,
      onStart: onDragStartExtra,
      onEnd: onDragEnd,
    });

  const handleClick = () => {
    if (consumeClickSuppression()) return;
    if (onSelect) {
      onSelect();
      return;
    }
    if (onPreview) onPreview();
  };

  const interactive = !!(onPreview || onSelect);

  return (
    <div
      className={className}
      onPointerDown={handlePointerDown ?? undefined}
      onClick={handleClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={(event) => {
        if (interactive && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          if (onSelect) onSelect();
          else if (onPreview) onPreview();
        }
      }}
    >
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt={imageAlt}
          width={small ? 72 : 110}
          height={small ? 102 : 154}
          className="card__image"
          unoptimized
          draggable={false}
        />
      ) : (
        <div className="card__placeholder">{faceDown ? "裏" : card.id}</div>
      )}
      {!faceDown && !hideMeta && (
      <div className="card__meta">
        <span className="card__name">{card.name}</span>
        {card.bp !== undefined && <span>BP {card.bp}</span>}
        {card.type === "operation" && (
          <span className={`card__type ${disabled ? "card__type--muted" : ""}`}>
            OP {card.powerCost}
          </span>
        )}
        {commandHeld && (
          <span className="card__command card__command--held">ホールド中</span>
        )}
        {effect?.kind === "permanent" && (
          <span className="card__tag">常駐</span>
        )}
      </div>
      )}
    </div>
  );
}
