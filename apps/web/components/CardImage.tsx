"use client";

import Image from "next/image";
import type { CardDefinition } from "@rangers-strike/cards";
import { getCardBackImageUrl, getCardEffect } from "@rangers-strike/cards";
import { type DragCardPayload } from "@/lib/dnd";
import { usePointerDrag } from "@/lib/PointerDragContext";
import { useCardLongPress } from "@/lib/useCardLongPress";

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
  const {
    bindDragSource,
    consumeClickSuppression,
    cancelPendingPointer,
    suppressClick,
  } = usePointerDrag();

  const longPress = useCardLongPress({
    enabled: !!onPreview && !faceDown && !disabled,
    onLongPress: () => onPreview?.(),
    onCancelPendingDrag: cancelPendingPointer,
    onSuppressClick: suppressClick,
  });

  if (!card) return null;

  const className = [
    "card",
    small ? "card--small" : "",
    selected ? "card--selected" : "",
    disabled ? "card--disabled" : "",
    draggable && !disabled ? "card--draggable" : "",
    onPreview || onSelect ? "card--interactive" : "",
    onPreview ? "card--previewable" : "",
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

  const handleDragPointerDown =
    dragPayload &&
    bindDragSource({
      enabled: true,
      payload: dragPayload,
      imageSrc: imageSrc ?? undefined,
      inHorizontalScrollZone,
      onStart: onDragStartExtra,
      onEnd: onDragEnd,
    });

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    longPress.handlePointerDown(event);
    handleDragPointerDown?.(event);
  };

  const handleClick = (event: React.MouseEvent) => {
    if (!onSelect) return;
    if (consumeClickSuppression()) return;
    if (longPress.consumeLongPressSuppression()) return;
    event.stopPropagation();
    onSelect();
  };

  const interactive = !!(onPreview || onSelect);
  const ariaLabel = interactive
    ? onPreview
      ? `${card.name}、長押しで詳細${onSelect ? "、タップで選択" : ""}`
      : `${card.name}、タップで選択`
    : undefined;

  return (
    <div
      className={className}
      onPointerDown={interactive ? handlePointerDown : undefined}
      onPointerMove={interactive ? longPress.handlePointerMove : undefined}
      onPointerUp={interactive ? longPress.handlePointerUp : undefined}
      onPointerCancel={interactive ? longPress.handlePointerCancel : undefined}
      onClick={onSelect ? handleClick : undefined}
      onContextMenu={
        onPreview
          ? (event) => {
              event.preventDefault();
            }
          : undefined
      }
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={ariaLabel}
      onKeyDown={(event) => {
        if (onSelect && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onSelect();
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
