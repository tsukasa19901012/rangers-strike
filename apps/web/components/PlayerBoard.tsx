"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, PlayerId } from "@rangers-strike/engine";
import { COMMAND_ZONE_MAX, isRushable, isUnit, rushCardsForDisplay, battleCardsForDisplay } from "@rangers-strike/engine";
import { type DragCardPayload, type DropTarget } from "@/lib/dnd";
import { useDropTarget } from "@/lib/PointerDragContext";
import { CardImage } from "./CardImage";

type DropZoneProps = {
  zoneId: DropTarget;
  title: string;
  count?: number;
  accepts?: boolean;
  highlighted?: boolean;
  inactive?: boolean;
  emptyLabel?: string;
  className?: string;
  onDrop?: (payload: DragCardPayload) => void;
  children: ReactNode;
  cardsRef?: React.RefObject<HTMLDivElement | null>;
  scrollX?: boolean;
  scrollY?: boolean;
};

export function DropZone({
  zoneId,
  title,
  count,
  accepts,
  highlighted,
  inactive,
  emptyLabel = "—",
  className,
  onDrop,
  children,
  cardsRef,
  scrollX,
  scrollY,
}: DropZoneProps) {
  const zoneRef = useRef<HTMLElement>(null);

  useDropTarget(zoneRef, {
    accepts: () => !!(accepts && onDrop),
    drop: (payload) => onDrop?.(payload),
  });

  return (
    <section
      ref={zoneRef}
      className={[
        "zone",
        "drop-zone",
        className ?? "",
        inactive ? "drop-zone--inactive" : "",
        accepts ? "drop-zone--accepts" : "",
        highlighted ? "drop-zone--highlight" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-zone={zoneId}
    >
      <header className="zone__title">
        {title}
        {count !== undefined && <span className="zone__count">{count}</span>}
      </header>
      <div
        className={[
          "zone__cards",
          scrollX ? "zone__cards--scroll-x" : "",
          scrollY ? "zone__cards--scroll-y" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        ref={cardsRef}
      >
        {children}
        {count === 0 && emptyLabel && (
          <span className="zone__empty">{emptyLabel}</span>
        )}
      </div>
    </section>
  );
}

type ZoneCardsProps = {
  title: string;
  zoneId: DropTarget;
  cards: CardInstance[];
  /** ライド重ね表示用のゾーン全カード（表示リストと別の場合）。 */
  zoneCards?: CardInstance[];
  definitions: Record<string, CardDefinition>;
  playerId: PlayerId;
  fromZone: DragCardPayload["fromZone"];
  accepts?: boolean;
  highlighted?: boolean;
  inactive?: boolean;
  onDrop?: (payload: DragCardPayload) => void;
  onPreview?: (card: CardDefinition) => void;
  draggable?: boolean;
  getDraggable?: (card: CardInstance, definition?: CardDefinition) => boolean;
  getDisabled?: (card: CardInstance, definition?: CardDefinition) => boolean;
  onCardDragStart?: (payload: DragCardPayload) => void;
  onCardDragEnd?: () => void;
  selectedId?: string | null;
  selectedIds?: Set<string>;
  selectableIds?: Set<string>;
  strikeableIds?: Set<string>;
  interceptableIds?: Set<string>;
  counterIds?: Set<string>;
  substituteIds?: Set<string>;
  onSelectTarget?: (instanceId: string) => void;
  onInterceptSelect?: (instanceId: string) => void;
  onCounterSelect?: (instanceId: string) => void;
  onSubstituteSelect?: (instanceId: string) => void;
  onCardClick?: (card: CardInstance) => void;
  onCardDrop?: (targetInstanceId: string, payload: DragCardPayload) => void;
  emptyLabel?: string;
  className?: string;
  imageOnly?: boolean;
  getCommandHeld?: (card: CardInstance) => boolean | undefined;
  cardsScrollX?: boolean;
  cardsScrollY?: boolean;
};

function CardDropWrap({
  instanceId,
  onCardDrop,
  className,
  onClick,
  children,
}: {
  instanceId: string;
  onCardDrop?: (targetInstanceId: string, payload: DragCardPayload) => void;
  className: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useDropTarget(ref, {
    accepts: () => !!onCardDrop,
    drop: (payload) => onCardDrop?.(instanceId, payload),
  });

  return (
    <div ref={ref} className={className} onClick={onClick}>
      {children}
    </div>
  );
}

function ZoneCards({
  title,
  zoneId,
  cards,
  zoneCards,
  definitions,
  playerId,
  fromZone,
  accepts,
  highlighted,
  inactive,
  onDrop,
  onPreview,
  draggable,
  getDraggable,
  getDisabled,
  onCardDragStart,
  onCardDragEnd,
  selectedId,
  selectedIds,
  selectableIds,
  strikeableIds,
  interceptableIds,
  counterIds,
  substituteIds,
  onSelectTarget,
  onInterceptSelect,
  onCounterSelect,
  onSubstituteSelect,
  onCardClick,
  onCardDrop,
  emptyLabel,
  className,
  imageOnly,
  getCommandHeld,
  cardsScrollX,
  cardsScrollY,
}: ZoneCardsProps) {
  const cardsRef = useRef<HTMLDivElement>(null);
  const selectableKey = selectableIds ? [...selectableIds].sort().join(",") : "";
  const mountLookup = zoneCards ?? cards;

  useEffect(() => {
    if (!selectableKey || !cardsRef.current) return;
    const target = cardsRef.current.querySelector<HTMLElement>(".card-wrap--target");
    target?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectableKey]);

  return (
    <DropZone
      zoneId={zoneId}
      title={title}
      count={cards.length}
      accepts={accepts}
      highlighted={highlighted}
      inactive={inactive}
      onDrop={onDrop}
      emptyLabel={emptyLabel}
      className={className}
      cardsRef={cardsRef}
      scrollX={cardsScrollX}
      scrollY={cardsScrollY}
    >
      {cards.map((card) => {
        const definition = definitions[card.cardId];
        const mountCard = card.mountedOnInstanceId
          ? mountLookup.find((c) => c.instanceId === card.mountedOnInstanceId)
          : undefined;
        const mountDefinition = mountCard
          ? definitions[mountCard.cardId]
          : undefined;
        const isSelectable = selectableIds?.has(card.instanceId);
        const isSelected =
          selectedIds?.has(card.instanceId) || card.instanceId === selectedId;
        const cardDraggable =
          getDraggable?.(card, definition) ?? draggable ?? false;
        const cardDisabled = getDisabled?.(card, definition) ?? false;
        const canPreview =
          !!onPreview &&
          !!definition &&
          !(fromZone === "power" && card.faceDown);
        const preview = canPreview ? () => onPreview!(definition) : undefined;
        const select =
          isSelectable &&
          onSelectTarget &&
          !substituteIds?.has(card.instanceId) &&
          !interceptableIds?.has(card.instanceId) &&
          !counterIds?.has(card.instanceId)
            ? () => onSelectTarget(card.instanceId)
            : onCardClick
              ? () => onCardClick(card)
              : undefined;

        return (
        <CardDropWrap
          key={card.instanceId}
          instanceId={card.instanceId}
          onCardDrop={onCardDrop}
          className={[
            "card-wrap",
            isSelectable && !isSelected ? "card-wrap--target" : "",
            interceptableIds?.has(card.instanceId) ? "card-wrap--target" : "",
            counterIds?.has(card.instanceId) ? "card-wrap--target" : "",
            substituteIds?.has(card.instanceId) ? "card-wrap--target" : "",
            strikeableIds?.has(card.instanceId) ? "card-wrap--strikeable" : "",
            isSelected ? "card-wrap--selected" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => {
            if (substituteIds?.has(card.instanceId) && onSubstituteSelect) {
              onSubstituteSelect(card.instanceId);
              return;
            }
            if (interceptableIds?.has(card.instanceId) && onInterceptSelect) {
              onInterceptSelect(card.instanceId);
              return;
            }
            if (counterIds?.has(card.instanceId) && onCounterSelect) {
              onCounterSelect(card.instanceId);
              return;
            }
            if (selectableIds?.has(card.instanceId) && onSelectTarget) {
              onSelectTarget(card.instanceId);
            }
          }}
        >
          <div
            className={[
              mountCard ? "card-stack card-stack--riding" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {mountCard && mountDefinition && (
              <div className="card-stack__mount" aria-hidden>
                <CardImage
                  card={mountDefinition}
                  instanceId={mountCard.instanceId}
                  fromZone={fromZone}
                  playerId={playerId}
                  small
                  hideMeta={imageOnly}
                />
              </div>
            )}
            <CardImage
              card={definition}
              instanceId={card.instanceId}
              fromZone={fromZone}
              playerId={playerId}
              small
              draggable={cardDraggable}
              disabled={cardDisabled}
              onDragStartExtra={
                onCardDragStart && cardDraggable
                  ? () =>
                      onCardDragStart({
                        instanceId: card.instanceId,
                        cardId: card.cardId,
                        fromZone,
                        playerId,
                      })
                  : undefined
              }
              onDragEnd={onCardDragEnd}
              selected={isSelected}
              onPreview={preview}
              onSelect={select}
              commandHeld={getCommandHeld?.(card)}
              hideMeta={imageOnly}
              faceDown={fromZone === "power" ? card.faceDown : undefined}
            />
          </div>
        </CardDropWrap>
        );
      })}
    </DropZone>
  );
}

export type PlayerBoardProps = {
  label: string;
  playerId: PlayerId;
  player: import("@rangers-strike/engine").PlayerState;
  definitions: Record<string, CardDefinition>;
  isOpponent?: boolean;
  isActive?: boolean;
  isHuman?: boolean;
  isHumanTurn?: boolean;
  phase?: import("@rangers-strike/engine").Phase;
  onPreview?: (card: CardDefinition) => void;
  onZoneDrop?: (target: DropTarget, payload: DragCardPayload) => void;
  onBattleCardDrop?: (defenderId: string, payload: DragCardPayload) => void;
  onRushCardDrop?: (vehicleInstanceId: string, payload: DragCardPayload) => void;
  pendingOperationTargets?: Set<string>;
  onOperationTarget?: (instanceId: string) => void;
  pendingZordTargets?: Set<string>;
  onZordMaterial?: (instanceId: string) => void;
  canAcceptStrike?: boolean;
  strikeHighlight?: boolean;
  onStrikeDrop?: (payload: DragCardPayload) => void;
  onBattleDragStart?: (payload: DragCardPayload) => void;
  onBattleDragEnd?: () => void;
  strikeableIds?: Set<string>;
  interceptableIds?: Set<string>;
  counterIds?: Set<string>;
  onInterceptSelect?: (instanceId: string) => void;
  onCounterSelect?: (instanceId: string) => void;
  substituteIds?: Set<string>;
  onSubstituteSelect?: (instanceId: string) => void;
  entryAttackerIds?: Set<string>;
  wingRushSelectableIds?: Set<string>;
  wingRushSelectedIds?: Set<string>;
  onWingRushSelect?: (instanceId: string) => void;
  wingAttackDragIds?: Set<string>;
  attackTargetIds?: Set<string>;
  onAttackTargetSelect?: (defenderInstanceId: string) => void;
  pendingEffectChoiceTargets?: Set<string>;
  onEffectChoiceSelect?: (instanceId: string) => void;
  pendingCommandPaymentTargets?: Set<string>;
  commandPaymentSelectedIds?: Set<string>;
  onCommandPaymentToggle?: (instanceId: string) => void;
  commandPaymentHighlightCommand?: boolean;
  commandPaymentHighlightRush?: boolean;
  commandPaymentHighlightBattle?: boolean;
  zordSetupHighlightRush?: boolean;
  zordSetupHighlightBattle?: boolean;
  effectChoiceHighlightCommand?: boolean;
  effectChoiceHighlightPower?: boolean;
  effectChoiceHighlightRush?: boolean;
  effectChoiceHighlightBattle?: boolean;
  onViewPile?: (pile: "deck" | "discard") => void;
  onOperationCardClick?: (card: CardInstance) => void;
  boardRef?: RefObject<HTMLDivElement | null>;
};

export function PlayerBoard({
  label,
  playerId,
  player,
  definitions,
  isOpponent,
  isActive,
  isHuman,
  isHumanTurn,
  phase,
  onPreview,
  onZoneDrop,
  onBattleCardDrop,
  onRushCardDrop,
  pendingOperationTargets,
  onOperationTarget,
  pendingZordTargets,
  onZordMaterial,
  canAcceptStrike,
  strikeHighlight,
  onStrikeDrop,
  onBattleDragStart,
  onBattleDragEnd,
  strikeableIds,
  interceptableIds,
  counterIds,
  onInterceptSelect,
  onCounterSelect,
  substituteIds,
  onSubstituteSelect,
  entryAttackerIds,
  wingRushSelectableIds,
  wingRushSelectedIds,
  onWingRushSelect,
  wingAttackDragIds,
  attackTargetIds,
  onAttackTargetSelect,
  pendingEffectChoiceTargets,
  onEffectChoiceSelect,
  pendingCommandPaymentTargets,
  commandPaymentSelectedIds,
  onCommandPaymentToggle,
  commandPaymentHighlightCommand,
  commandPaymentHighlightRush,
  commandPaymentHighlightBattle,
  zordSetupHighlightRush,
  zordSetupHighlightBattle,
  effectChoiceHighlightCommand,
  effectChoiceHighlightPower,
  effectChoiceHighlightRush,
  effectChoiceHighlightBattle,
  onViewPile,
  onOperationCardClick,
  boardRef,
}: PlayerBoardProps) {
  const interactive = isHuman && isHumanTurn;
  const [dragging, setDragging] = useState<DragCardPayload | null>(null);
  const strikeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDragging(null);
  }, [phase, interactive]);

  const draggingDefinition = dragging ? definitions[dragging.cardId] : undefined;
  const draggingOperation = draggingDefinition?.type === "operation";
  const draggingUnit = isRushable(draggingDefinition);

  const canDropPower =
    interactive && phase === "charge" && !!onZoneDrop && !player.hasChargedThisTurn;
  const canDropCommand =
    interactive &&
    phase === "charge" &&
    !!onZoneDrop &&
    player.command.length < COMMAND_ZONE_MAX &&
    !player.hasChargedThisTurn;
  const canDropOperation =
    interactive && !!onZoneDrop && phase === "rush";
  const canDropRush =
    interactive && phase === "rush" && !!onZoneDrop;
  const canDropBattle =
    interactive && phase === "battle" && !!onZoneDrop;

  const highlightPower =
    effectChoiceHighlightPower ||
    (canDropPower &&
      (!dragging || (dragging.fromZone === "hand" && phase === "charge")));
  const highlightCommand =
    commandPaymentHighlightCommand ||
    effectChoiceHighlightCommand ||
    (canDropCommand &&
      (!dragging || (dragging.fromZone === "hand" && phase === "charge")));
  const highlightOperation =
    canDropOperation && (!dragging || (draggingOperation && dragging.fromZone === "hand"));
  const highlightRush =
    commandPaymentHighlightRush ||
    zordSetupHighlightRush ||
    effectChoiceHighlightRush ||
    (canDropRush && (!dragging || (draggingUnit && dragging.fromZone === "hand")));
  const highlightBattle =
    commandPaymentHighlightBattle ||
    zordSetupHighlightBattle ||
    effectChoiceHighlightBattle ||
    (canDropBattle && (!dragging || dragging.fromZone === "rush"));

  const operationZoneInactive = isHuman && phase !== "rush";

  const canDragFromHand = (card: CardInstance, definition?: CardDefinition): boolean => {
    if (!interactive || !definition) return false;
    if (phase === "charge") {
      return !player.hasChargedThisTurn;
    }
    if (phase === "rush") {
      return definition.type === "operation" || isRushable(definition);
    }
    return false;
  };

  const isHandCardDisabled = (definition?: CardDefinition): boolean => {
    if (!interactive || !definition) return false;
    if (phase === "charge") {
      return player.hasChargedThisTurn ?? false;
    }
    if (phase === "rush") {
      return definition.type !== "operation" && !isRushable(definition);
    }
    return true;
  };

  const selectableIds = (() => {
    const ids = new Set<string>();
    pendingOperationTargets?.forEach((id) => ids.add(id));
    pendingZordTargets?.forEach((id) => ids.add(id));
    pendingEffectChoiceTargets?.forEach((id) => ids.add(id));
    pendingCommandPaymentTargets?.forEach((id) => ids.add(id));
    attackTargetIds?.forEach((id) => ids.add(id));
    return ids.size > 0 ? ids : undefined;
  })();

  const handleSelectTarget = (instanceId: string) => {
    if (wingRushSelectableIds?.has(instanceId)) {
      onWingRushSelect?.(instanceId);
      return;
    }
    if (attackTargetIds?.has(instanceId)) {
      onAttackTargetSelect?.(instanceId);
      return;
    }
    if (pendingCommandPaymentTargets?.has(instanceId)) {
      onCommandPaymentToggle?.(instanceId);
      return;
    }
    if (pendingEffectChoiceTargets?.has(instanceId)) {
      onEffectChoiceSelect?.(instanceId);
      return;
    }
    if (pendingZordTargets?.has(instanceId)) {
      onZordMaterial?.(instanceId);
      return;
    }
    if (pendingOperationTargets?.has(instanceId)) {
      onOperationTarget?.(instanceId);
    }
  };

  const powerZone = (
    <ZoneCards
      title="パワーゾーン"
      zoneId="power"
      className="playsheet__power"
      cardsScrollY
      cards={player.power}
      definitions={definitions}
      playerId={playerId}
      fromZone="power"
      accepts={canDropPower}
      highlighted={highlightPower}
      onDrop={(payload) => onZoneDrop?.("power", payload)}
      onPreview={onPreview}
      selectableIds={selectableIds}
      onSelectTarget={handleSelectTarget}
      emptyLabel="—"
    />
  );

  const battleZone = (
    <ZoneCards
      title="バトルエリア"
      zoneId="battle"
      className="playsheet__battle"
      cardsScrollX
      imageOnly
      cards={battleCardsForDisplay(player.battle)}
      zoneCards={player.battle}
      definitions={definitions}
      playerId={playerId}
      fromZone="battle"
      accepts={canDropBattle && !isOpponent}
      highlighted={highlightBattle && !isOpponent}
      onDrop={(payload) => onZoneDrop?.("battle", payload)}
      onPreview={onPreview}
      selectableIds={selectableIds}
      substituteIds={substituteIds}
      strikeableIds={!isOpponent ? strikeableIds : undefined}
      onSelectTarget={handleSelectTarget}
      onSubstituteSelect={onSubstituteSelect}
      getCommandHeld={(card) => card.commandHeld}
      getDraggable={(card) =>
        !!(
          interactive &&
          phase === "battle" &&
          !isOpponent &&
          (!entryAttackerIds || entryAttackerIds.has(card.instanceId))
        )
      }
      onCardDragStart={
        !isOpponent && onBattleDragStart
          ? (payload) => onBattleDragStart(payload)
          : undefined
      }
      onCardDragEnd={!isOpponent ? onBattleDragEnd : undefined}
      onCardDrop={isOpponent && interactive ? onBattleCardDrop : undefined}
      emptyLabel="—"
    />
  );

  const rushSelectableIds = (() => {
    if (!wingRushSelectableIds?.size) return selectableIds;
    const ids = new Set(selectableIds ?? []);
    wingRushSelectableIds.forEach((id) => ids.add(id));
    return ids;
  })();

  const rushSelectedIds = (() => {
    const ids = new Set<string>();
    commandPaymentSelectedIds?.forEach((id) => ids.add(id));
    wingRushSelectedIds?.forEach((id) => ids.add(id));
    return ids.size > 0 ? ids : undefined;
  })();

  const rushZone = (
    <ZoneCards
      title="ラッシュエリア"
      zoneId="rush"
      className="playsheet__rush"
      cardsScrollX
      imageOnly
      cards={rushCardsForDisplay(player.rush)}
      zoneCards={player.rush}
      definitions={definitions}
      playerId={playerId}
      fromZone="rush"
      accepts={canDropRush}
      highlighted={highlightRush}
      onDrop={(payload) => onZoneDrop?.("rush", payload)}
      onPreview={onPreview}
      selectableIds={rushSelectableIds}
      selectedIds={rushSelectedIds}
      substituteIds={substituteIds}
      interceptableIds={isHuman ? interceptableIds : undefined}
      onSelectTarget={handleSelectTarget}
      onInterceptSelect={onInterceptSelect}
      onSubstituteSelect={onSubstituteSelect}
      getCommandHeld={(card) => card.commandHeld}
      getDraggable={(card) =>
        !!(
          interactive &&
          phase === "battle" &&
          (wingAttackDragIds?.has(card.instanceId) || !card.commandHeld)
        )
      }
      onCardDrop={
        !isOpponent && interactive && phase === "battle" ? onRushCardDrop : undefined
      }
      emptyLabel="—"
    />
  );

  const commandZone = (
    <ZoneCards
      title={`コマンドゾーン (${player.command.length}/${COMMAND_ZONE_MAX})`}
      zoneId="command"
      className="playsheet__command"
      cardsScrollX
      imageOnly
      cards={player.command}
      definitions={definitions}
      playerId={playerId}
      fromZone="command"
      accepts={canDropCommand}
      highlighted={highlightCommand}
      onDrop={(payload) => onZoneDrop?.("command", payload)}
      onPreview={onPreview}
      selectableIds={selectableIds}
      selectedIds={commandPaymentSelectedIds}
      onSelectTarget={handleSelectTarget}
      getCommandHeld={(card) => card.commandHeld}
      emptyLabel="—"
    />
  );

  const sidebar = (
    <div className="playsheet__sidebar">
      <div className="playsheet__piles">
        <button
          type="button"
          className="pile pile--deck pile--clickable"
          onClick={() => onViewPile?.("deck")}
          disabled={!onViewPile || player.deck.length === 0}
        >
          <span className="pile__label">山札</span>
          <span className="pile__count">{player.deck.length}</span>
        </button>
        <button
          type="button"
          className="pile pile--discard pile--clickable"
          onClick={() => onViewPile?.("discard")}
          disabled={!onViewPile || player.discard.length === 0}
        >
          <span className="pile__label">捨札</span>
          <span className="pile__count">{player.discard.length}</span>
        </button>
      </div>

      <ZoneCards
        title="常駐"
        zoneId="operation"
        className="playsheet__operation"
        imageOnly
        cards={player.operation}
        definitions={definitions}
        playerId={playerId}
        fromZone="operation"
        accepts={canDropOperation}
        highlighted={highlightOperation}
        inactive={operationZoneInactive}
        onDrop={(payload) => onZoneDrop?.("operation", payload)}
        onPreview={onPreview}
        onCardClick={
          interactive && (phase === "rush" || phase === "battle")
            ? onOperationCardClick
            : undefined
        }
        emptyLabel={phase === "rush" ? "使用可" : "—"}
      />
    </div>
  );

  const baseZone = (
    <div className="playsheet__base">
      {isOpponent ? (
        <>
          {sidebar}
          {commandZone}
        </>
      ) : (
        <>
          {commandZone}
          {sidebar}
        </>
      )}
    </div>
  );

  const mainZones = isOpponent ? (
    <>
      {baseZone}
      {rushZone}
      {battleZone}
    </>
  ) : (
    <>
      {battleZone}
      {rushZone}
      {baseZone}
    </>
  );

  useDropTarget(strikeRef, {
    accepts: () => !!(isOpponent && canAcceptStrike && onStrikeDrop),
    drop: (payload) => onStrikeDrop?.(payload),
  });

  return (
    <div
      ref={boardRef}
      className={`board ${isOpponent ? "board--opponent" : "board--self"} ${isActive ? "board--active" : ""}`}
    >
      <div
        ref={strikeRef}
        className={[
          "board__header",
          isOpponent && canAcceptStrike ? "board__header--strike-target" : "",
          isOpponent && strikeHighlight ? "board__header--strike-highlight" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <h2>{label}</h2>
        <div className="board__header-meta">
          {isOpponent ? (
            <span className="board__hand-count" aria-label={`手札 ${player.hand.length}枚`}>
              手札 <span className="board__hand-count-value">{player.hand.length}</span>
            </span>
          ) : null}
          <div className="damage">
            {Array.from({ length: 7 }).map((_, index) => (
              <span
                key={index}
                className={`damage__pip ${index < player.damage ? "damage__pip--filled" : ""}`}
              />
            ))}
            <span className="damage__label">{player.damage}/7</span>
          </div>
        </div>
      </div>

      <div className={`playsheet ${isOpponent ? "playsheet--opponent" : "playsheet--self"}`}>
        {isOpponent ? (
          <>
            {powerZone}
            <div className="playsheet__main">{mainZones}</div>
          </>
        ) : (
          <>
            <div className="playsheet__main">{mainZones}</div>
            {powerZone}
          </>
        )}
      </div>

      {isHuman && (
        <>
          <ZoneCards
            title="手札"
            zoneId="power"
            className="playsheet__hand"
            cardsScrollX
            imageOnly
            cards={player.hand}
            definitions={definitions}
            playerId={playerId}
            fromZone="hand"
            onPreview={onPreview}
            getDraggable={canDragFromHand}
            getDisabled={(_, definition) => isHandCardDisabled(definition)}
            onCardDragStart={setDragging}
            onCardDragEnd={() => setDragging(null)}
            selectableIds={selectableIds}
            counterIds={counterIds}
            onSelectTarget={handleSelectTarget}
            onCounterSelect={onCounterSelect}
            emptyLabel="なし"
          />
          {(pendingOperationTargets?.size ||
            pendingZordTargets?.size ||
            substituteIds?.size ||
            pendingEffectChoiceTargets?.size ||
            pendingCommandPaymentTargets?.size ||
            wingRushSelectableIds?.size ||
            attackTargetIds?.size) ? (
            <p className="target-hint">
              {pendingCommandPaymentTargets?.size
                ? "ホールドするコマンドをタップ · 長押しで詳細"
                : substituteIds?.size
                ? "身代わりにするユニットをタップ"
                : wingRushSelectableIds?.size
                  ? "ウイングするユニットをタップ · 長押しで詳細"
                : attackTargetIds?.size
                  ? "アタック対象をタップ"
                  : pendingZordTargets?.size
                  ? "追加条件の素材をタップ"
                  : pendingEffectChoiceTargets?.size
                  ? "効果の対象をタップ"
                  : "対象カードをタップしてオペレーションを完了"}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
