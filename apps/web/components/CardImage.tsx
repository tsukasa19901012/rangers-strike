"use client";

import Image from "next/image";
import type { CardDefinition } from "@rangers-strike/cards";
import { getCardBackImageUrl, getCardEffect } from "@rangers-strike/cards";
import { DND_MIME, serializeDragPayload, type DragCardPayload } from "@/lib/dnd";

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
  onCommandToggle?: () => void;
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
  onCommandToggle,
  hideMeta,
  faceDown,
}: CardImageProps) {
  if (!card) return null;

  const className = [
    "card",
    small ? "card--small" : "",
    selected ? "card--selected" : "",
    disabled ? "card--disabled" : "",
    draggable && !disabled ? "card--draggable" : "",
    onPreview ? "card--previewable" : "",
    commandHeld ? "card--command-held" : "",
    onCommandToggle ? "card--command-toggle" : "",
    faceDown ? "card--face-down" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const effect = getCardEffect(card.id);
  const imageSrc = faceDown ? getCardBackImageUrl() : card.imageUrl;
  const imageAlt = faceDown ? "カード裏" : card.name;

  const handleDragStart = (event: React.DragEvent) => {
    if (!draggable || disabled || !instanceId || !fromZone || !playerId) return;
    const payload: DragCardPayload = {
      instanceId,
      cardId: card.id,
      fromZone,
      playerId,
    };
    event.dataTransfer.setData(DND_MIME, serializeDragPayload(payload));
    event.dataTransfer.effectAllowed = "move";
    onDragStartExtra?.();
  };

  const handleDragEnd = () => {
    onDragEnd?.();
  };

  const handleClick = () => {
    if (onSelect) {
      onSelect();
      return;
    }
    if (onCommandToggle) {
      onCommandToggle();
      return;
    }
    if (onPreview) onPreview();
  };

  return (
    <div
      className={className}
      draggable={draggable && !disabled}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      role={onPreview || onCommandToggle ? "button" : undefined}
      tabIndex={onPreview || onCommandToggle ? 0 : undefined}
      onKeyDown={(event) => {
        if ((onPreview || onCommandToggle) && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          if (onCommandToggle) onCommandToggle();
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
        {commandHeld !== undefined && (
          <span className={`card__command ${commandHeld ? "card__command--held" : ""}`}>
            {commandHeld ? "ホールド中" : "リリース"}
          </span>
        )}
        {effect?.kind === "permanent" && (
          <span className="card__tag">常駐</span>
        )}
      </div>
      )}
    </div>
  );
}
