"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCardEffect,
  getCardById,
  type CardDefinition,
} from "@rangers-strike/cards";
import {
  applyAction,
  canPlayOperationExceptCommandHold,
  collectOperationTargets,
  createGameForDecks,
  effectiveBp,
  strikeDamageFor,
  explainCannotEnterBattle,
  explainCannotRush,
  findMandatoryBattleEntries,
  formatActionError,
  getStartPhaseStatus,
  getLegalActions,
  findDirectZordRushAction,
  getStrikeableInstanceIds,
  isCpuTurn,
  needsOperationTarget,
  needsEffectHoldPayment,
  needsZordMaterial,
  isDenjiRevealAudience,
  canActOnDenjiChoice,
  canInitiateShironLight,
  isShironRevealAudience,
  canActOnShironChoice,
  getLightningGravityHoldNotice,
  type LightningGravityHoldNotice,
  opponent,
  pickCpuAction,
  pickCpuFallbackAction,
  type CardInstance,
  type GameAction,
  type GameState,
  type Phase,
  type PlayerId,
  type CpuLevel,
} from "@rangers-strike/engine";
import {
  PHASE_LABELS,
  PLAYER_LABELS,
} from "@/lib/labels";
import {
  getCustomDeck,
  loadCustomDecks,
  validateDeckEntries,
  type CustomDeck,
} from "@/lib/deckBuilder";
import {
  decodeDeckSelection,
  deckSelectionLabel,
  encodeDeckSelection,
  resolveDeckCards,
  type DeckSelection,
} from "@/lib/deckSelection";
import { resolveCardTargets } from "@/lib/cardTargets";
import type { DragCardPayload, DropTarget, PendingOperation } from "@/lib/dnd";
import { CardModal } from "./CardModal";
import { BattleEntryModal } from "./BattleEntryModal";
import { AlertModal } from "./AlertModal";
import { EffectChoiceModal } from "./EffectChoiceModal";
import { DamagePaymentModal } from "./DamagePaymentModal";
import { damagePaymentHint } from "@/lib/damagePaymentHint";
import { EffectNoticeModal } from "./EffectNoticeModal";
import { CommandPaymentBanner } from "./CommandPaymentBanner";
import {
  buildCommandPaymentView,
  canConfirmCommandPayment,
  resolveCommandPaymentSelectedCards,
  toggleCommandPaymentSelection,
} from "@/lib/commandPaymentUi";
import {
  isHumanCommandPaymentActive,
  resolveCommandPaymentBoardTargetIds,
} from "@/lib/webUiIntegration";
import { zordSetupHighlightZones } from "@/lib/zordSetupUi";
import {
  analyzeBoardTapEffectChoice,
  effectChoiceSkipLabel,
} from "@/lib/effectChoiceBoardTap";
import { ZordSetupBanner } from "./ZordSetupBanner";
import { EffectChoiceBanner } from "./EffectChoiceBanner";
import { OperationPromptModal } from "./OperationPromptModal";
import { PermanentOperationModal } from "./PermanentOperationModal";
import { ShironLightModal } from "./ShironLightModal";
import { CyberSRiderModal } from "./CyberSRiderModal";
import { BattleDanceModal } from "./BattleDanceModal";
import { LightningGravityHoldModal } from "./LightningGravityHoldModal";
import { ReactionModal } from "./ReactionModal";
import { DeckBuilderScreen } from "./DeckBuilderScreen";
import { LogModal } from "./LogModal";
import { PhaseGuide } from "./PhaseGuide";
import { StartPhaseModal } from "./StartPhaseModal";
import { PileModal } from "./PileModal";
import { PlayerBoard } from "./PlayerBoard";
import { StartScreen } from "./StartScreen";
import { TurnNoticeModal } from "./TurnNoticeModal";
import { PhaseNoticeModal } from "./PhaseNoticeModal";
import { effectChoiceHint } from "@/lib/effectChoiceHint";
import {
  formatEffectLogNotice,
  shouldShowEffectLogNotice,
} from "@/lib/effectLogNotice";
import { useCompactGameViewport } from "@/lib/compactViewport";
import { useViewportBoardFit } from "@/lib/useViewportBoardFit";
import {
  isHumanStrikeDefender as checkHumanStrikeDefender,
  resolveReactionModalUi,
} from "@/lib/webUiIntegration";
import {
  canSelectCyberSRiderHand,
  listCyberSRiderHandCandidates,
} from "@/lib/cyberSRiderUi";
import { findBattleDanceAction } from "@/lib/battleDanceUi";
import { usePointerDrag } from "@/lib/PointerDragContext";

const CPU_PLAYER = "player2" as const;
const HUMAN_PLAYER = "player1" as const;

function formatBattleUnitSp(
  sp: CardDefinition["sp"],
  effectiveSp: number,
): string {
  if (effectiveSp > 0) return `SP${effectiveSp}`;
  if (sp === "special") return "SP！";
  if (typeof sp === "number") return `SP${sp}`;
  return "SP0";
}
const HUMAN_STARTER_KEY = encodeDeckSelection({ kind: "starter", id: "abarenoh" });
const CPU_STARTER_KEY = encodeDeckSelection({ kind: "starter", id: "dekaranger" });

type AppScreen = "start" | "deck-builder";

type PileView = {
  title: string;
  cards: CardInstance[];
  faceDown?: boolean;
  playerId: PlayerId;
  pile: "deck" | "discard";
};

function hasReactionWindow(game: GameState): boolean {
  return !!(
    game.pendingStrike ||
    game.pendingBattle ||
    game.pendingRush ||
    game.pendingLeave ||
    game.pendingEffectChoice ||
    game.pendingBattleEntry ||
    game.pendingCommandPayment ||
    game.pendingZordSetup ||
    game.pendingDamagePayment
  );
}

export function GameApp() {
  const { clearClickSuppression } = usePointerDrag();
  const [appScreen, setAppScreen] = useState<AppScreen>("start");
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [customDecks, setCustomDecks] = useState<CustomDeck[]>([]);
  const [humanDeckKey, setHumanDeckKey] = useState(HUMAN_STARTER_KEY);
  const [cpuDeckKey, setCpuDeckKey] = useState(CPU_STARTER_KEY);
  const [cpuLevel, setCpuLevel] = useState<CpuLevel>(3);
  const [firstPlayer, setFirstPlayer] = useState<PlayerId>(HUMAN_PLAYER);
  const [startError, setStartError] = useState<string | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [previewCard, setPreviewCard] = useState<CardDefinition | null>(null);
  const [pileView, setPileView] = useState<PileView | null>(null);
  const [pendingOp, setPendingOp] = useState<PendingOperation | null>(null);
  const [pendingCyberSRider, setPendingCyberSRider] = useState<{
    instanceId: string;
    cardId: string;
  } | null>(null);
  const [pendingPermanentOp, setPendingPermanentOp] = useState<{
    instanceId: string;
    cardId: string;
  } | null>(null);
  const [pendingBattleDance, setPendingBattleDance] = useState<{
    instanceId: string;
    cardId: string;
  } | null>(null);
  const [pendingHiddenNinja, setPendingHiddenNinja] = useState<{
    counterInstanceId: string;
  } | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [battleDrag, setBattleDrag] = useState<DragCardPayload | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [blockedBattleAlert, setBlockedBattleAlert] = useState<string | null>(null);
  const [blockedRushAlert, setBlockedRushAlert] = useState<string | null>(null);
  const [lightningGravityNotice, setLightningGravityNotice] =
    useState<LightningGravityHoldNotice | null>(null);
  const [turnNotice, setTurnNotice] = useState<PlayerId | null>(null);
  const [phaseNotice, setPhaseNotice] = useState<Phase | null>(null);
  const [effectNotice, setEffectNotice] = useState<string | null>(null);
  const [commandPaymentSelection, setCommandPaymentSelection] = useState<string[]>([]);
  const prevLogLenRef = useRef(0);
  const prevActivePlayerRef = useRef<PlayerId | null>(null);
  const prevPhaseRef = useRef<Phase | null>(null);
  const cpuBoardRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<HTMLDivElement>(null);
  const humanBoardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCustomDecks(loadCustomDecks());
  }, []);

  const refreshCustomDecks = useCallback(() => {
    const decks = loadCustomDecks();
    setCustomDecks(decks);

    const reconcile = (key: string, fallback: string) => {
      const selection = decodeDeckSelection(key);
      if (selection?.kind !== "custom") return key;
      return decks.some((deck) => deck.id === selection.id) ? key : fallback;
    };

    setHumanDeckKey((current) => reconcile(current, HUMAN_STARTER_KEY));
    setCpuDeckKey((current) => reconcile(current, CPU_STARTER_KEY));
  }, []);

  const humanDeckSelection = useMemo(
    () => decodeDeckSelection(humanDeckKey),
    [humanDeckKey],
  );
  const cpuDeckSelection = useMemo(() => decodeDeckSelection(cpuDeckKey), [cpuDeckKey]);

  const resolveSelection = useCallback((selection: DeckSelection | null): boolean => {
    if (!selection) return false;
    if (selection.kind === "custom") {
      const deck = getCustomDeck(selection.id);
      if (!deck) return false;
      return validateDeckEntries(deck.entries).ok;
    }
    return true;
  }, []);

  const startGame = useCallback(() => {
    if (!resolveSelection(humanDeckSelection) || !resolveSelection(cpuDeckSelection)) {
      setStartError("選択した自作デッキが使えません。編集するか別のデッキを選んでください。");
      return;
    }

    try {
      const game = createGameForDecks(
        resolveDeckCards(humanDeckSelection!),
        resolveDeckCards(cpuDeckSelection!),
        {
          firstPlayer,
          rng: () => Math.random(),
        },
      );
      setState(game);
      setStartError(null);
      setPendingOp(null);
      setPendingCyberSRider(null);
      setPendingBattleDance(null);
      setPendingHiddenNinja(null);
      setPreviewCard(null);
      setPileView(null);
      setActionError(null);
      setBattleDrag(null);
      setLogOpen(false);
      prevActivePlayerRef.current = game.activePlayer;
      setTurnNotice(game.activePlayer);
      setPhaseNotice(null);
      setEffectNotice(null);
      prevLogLenRef.current = 0;
      prevPhaseRef.current = game.phase;
    } catch {
      setStartError("デッキの読み込みに失敗しました。");
    }
  }, [cpuDeckSelection, firstPlayer, humanDeckSelection, resolveSelection]);

  const returnToStart = useCallback(() => {
    setState(null);
    setAppScreen("start");
    setEditingDeckId(null);
    setPendingOp(null);
    setPendingCyberSRider(null);
    setPendingBattleDance(null);
    setPendingHiddenNinja(null);
    setPreviewCard(null);
    setPileView(null);
    setActionError(null);
    setBattleDrag(null);
    setLogOpen(false);
    refreshCustomDecks();
  }, [refreshCustomDecks]);

  const openDeckBuilder = useCallback((editDeckId?: string) => {
    setEditingDeckId(editDeckId ?? null);
    setAppScreen("deck-builder");
    setStartError(null);
  }, []);

  const handleDeckSaved = useCallback(() => {
    refreshCustomDecks();
    setAppScreen("start");
    setEditingDeckId(null);
  }, [refreshCustomDecks]);

  useEffect(() => {
    setBattleDrag(null);
  }, [state?.phase, state?.activePlayer, state?.pendingStrike, state?.pendingBattle, state?.pendingRush, state?.pendingLeave, state?.pendingEffectChoice, state?.pendingBattleEntry]);

  useEffect(() => {
    if (!state || !isCpuTurn(state, CPU_PLAYER)) return;

    const timer = window.setTimeout(() => {
      const action =
        pickCpuAction(state, CPU_PLAYER, cpuLevel) ??
        pickCpuFallbackAction(state, CPU_PLAYER);
      if (!action) return;

      const result = applyAction(state, action);
      if (result.ok) {
        setState(result.state);
        setActionError(null);
        return;
      }

      const recovery = pickCpuFallbackAction(state, CPU_PLAYER);
      if (recovery) {
        const retry = applyAction(state, recovery);
        if (retry.ok) {
          setState(retry.state);
          setActionError(null);
          return;
        }
      }

      setActionError(formatActionError(result.error));
    }, 550);

    return () => window.clearTimeout(timer);
  }, [state, cpuLevel]);

  const legalActions = useMemo(
    () => (state ? getLegalActions(state) : []),
    [state],
  );

  const humanMustResolveDamage =
    state?.pendingDamagePayment &&
    (state.pendingDamagePayment.choosingPlayerId ??
      state.pendingDamagePayment.playerId) === HUMAN_PLAYER;

  const humanCanAct =
    !state?.winner &&
    (state?.activePlayer === HUMAN_PLAYER || !!humanMustResolveDamage);

  const compactViewport = useCompactGameViewport();
  const [chromeExpanded, setChromeExpanded] = useState(true);

  useEffect(() => {
    setChromeExpanded(!compactViewport);
  }, [compactViewport]);

  useViewportBoardFit(gameRef, humanBoardRef, !!state && compactViewport);

  const dismissTurnNotice = useCallback(() => {
    setTurnNotice((current) => {
      if (current) {
        const targetRef = current === HUMAN_PLAYER ? humanBoardRef : cpuBoardRef;
        window.requestAnimationFrame(() => {
          targetRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
      }
      return null;
    });
  }, []);

  useEffect(() => {
    if (!state || state.winner) return;
    if (hasReactionWindow(state)) return;

    const prev = prevActivePlayerRef.current;
    if (prev !== null && prev !== state.activePlayer) {
      setTurnNotice(state.activePlayer);
    }
    prevActivePlayerRef.current = state.activePlayer;
  }, [
    state,
    state?.activePlayer,
    state?.winner,
    state?.pendingStrike,
    state?.pendingBattle,
    state?.pendingRush,
    state?.pendingLeave,
    state?.pendingEffectChoice,
    state?.pendingBattleEntry,
  ]);

  useEffect(() => {
    if (!state || state.winner) return;

    const prev = prevPhaseRef.current;
    if (prev !== null && prev !== state.phase) {
      setPhaseNotice(state.phase);
    }
    prevPhaseRef.current = state.phase;
  }, [state, state?.phase, state?.winner]);

  const apply = useCallback((action: GameAction): boolean => {
    if (!state) return false;
    const result = applyAction(state, action);
    if (result.ok) {
      setState(result.state);
      if (
        action.type !== "cancel_command_payment" &&
        action.type !== "resolve_command_payment" &&
        action.type !== "cancel_zord_setup"
      ) {
        setPendingOp(null);
        setPendingCyberSRider(null);
        setPendingBattleDance(null);
      }
      setPendingHiddenNinja(null);
      setActionError(null);
      return true;
    }
    setActionError(formatActionError(result.error));
    return false;
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const len = state.log.length;
    if (len <= prevLogLenRef.current) {
      prevLogLenRef.current = len;
      return;
    }
    const newEntries = state.log.slice(prevLogLenRef.current);
    prevLogLenRef.current = len;

    for (let i = newEntries.length - 1; i >= 0; i -= 1) {
      const entry = newEntries[i]!;
      if (shouldShowEffectLogNotice(entry)) {
        setEffectNotice(formatEffectLogNotice(entry, state.definitions));
        break;
      }
    }
  }, [state, pendingOp, pendingHiddenNinja]);

  useEffect(() => {
    if (!state) return;
    const choice = state.pendingEffectChoice;
    if (!choice || choice.playerId !== HUMAN_PLAYER) return;
    if (!needsEffectHoldPayment(choice)) return;
    if (state.pendingCommandPayment) return;
    const initiate = legalActions.find(
      (a) =>
        a.type === "initiate_command_payment" &&
        a.kind === "effect_hold",
    );
    if (initiate) apply(initiate);
  }, [apply, legalActions, state]);

  useEffect(() => {
    setCommandPaymentSelection([]);
  }, [
    state?.pendingCommandPayment?.sourceInstanceId,
    state?.pendingCommandPayment?.kind,
    state?.pendingCommandPayment?.prismSubstitute,
    state?.pendingCommandPayment?.totalNeeded,
  ]);

  const tryPlayOperation = useCallback(
    (instanceId: string, targetInstanceId?: string, extraInstanceId?: string) => {
      const action = legalActions.find(
        (a) =>
          a.type === "play_operation" &&
          a.instanceId === instanceId &&
          (targetInstanceId
            ? a.targetInstanceId === targetInstanceId
            : !a.targetInstanceId) &&
          (extraInstanceId
            ? a.extraInstanceId === extraInstanceId
            : !a.extraInstanceId),
      );
      if (action) {
        apply(action);
        return;
      }
      apply({
        type: "initiate_command_payment",
        playerId: HUMAN_PLAYER,
        kind: "category_use",
        sourceInstanceId: instanceId,
        targetInstanceId,
        extraInstanceId,
      });
    },
    [apply, legalActions],
  );

  const findCyberSRiderAction = useCallback(
    (operationInstanceId: string, selectedIds: string[]) => {
      if (selectedIds.length === 0) return undefined;
      if (selectedIds.length === 1) {
        return legalActions.find(
          (a) =>
            a.type === "play_operation" &&
            a.instanceId === operationInstanceId &&
            a.targetInstanceId === selectedIds[0] &&
            !a.extraInstanceId,
        );
      }
      const [first, second] = selectedIds;
      return (
        legalActions.find(
          (a) =>
            a.type === "play_operation" &&
            a.instanceId === operationInstanceId &&
            a.targetInstanceId === first &&
            a.extraInstanceId === second,
        ) ??
        legalActions.find(
          (a) =>
            a.type === "play_operation" &&
            a.instanceId === operationInstanceId &&
            a.targetInstanceId === second &&
            a.extraInstanceId === first,
        )
      );
    },
    [legalActions],
  );

  const attemptMoveToBattle = useCallback(
    (payload: DragCardPayload) => {
      if (!state || !humanCanAct || state.phase !== "battle") return;
      if (payload.fromZone !== "rush" || payload.playerId !== HUMAN_PLAYER) return;

      const action = legalActions.find(
        (a) => a.type === "move_to_battle" && a.instanceId === payload.instanceId,
      );
      if (action) {
        apply(action);
        return;
      }

      const card = state.players[HUMAN_PLAYER].rush.find(
        (c) => c.instanceId === payload.instanceId,
      );
      if (!card) return;

      if (
        apply({
          type: "initiate_command_payment",
          playerId: HUMAN_PLAYER,
          kind: "battle_entry",
          sourceInstanceId: payload.instanceId,
        })
      ) {
        return;
      }

      const lgNotice = getLightningGravityHoldNotice(state, HUMAN_PLAYER, card);
      if (lgNotice) {
        setLightningGravityNotice(lgNotice);
        return;
      }

      const reason = explainCannotEnterBattle(state, HUMAN_PLAYER, card, "rush");
      setBlockedBattleAlert(
        reason ??
          `「${getCardById(card.cardId)?.name ?? card.cardId}」はバトルエリアに出せません。`,
      );
    },
    [apply, humanCanAct, legalActions, state],
  );

  const handleZoneDrop = useCallback(
    (target: DropTarget, payload: DragCardPayload) => {
      if (!state || !humanCanAct || payload.playerId !== HUMAN_PLAYER) return;
      if (payload.fromZone !== "hand" && payload.fromZone !== "rush" && target !== "battle") return;

      if (target === "power" && state.phase === "charge") {
        const action = legalActions.find(
          (a) => a.type === "charge_power" && a.instanceId === payload.instanceId,
        );
        if (action) apply(action);
        return;
      }

      if (target === "command" && state.phase === "charge") {
        const action = legalActions.find(
          (a) => a.type === "charge_command" && a.instanceId === payload.instanceId,
        );
        if (action) apply(action);
        return;
      }

      if (target === "operation" && state.phase === "rush") {
        const card = state.players[HUMAN_PLAYER].hand.find(
          (c) => c.instanceId === payload.instanceId,
        );
        if (!card) return;

        const effect = getCardEffect(card.cardId);
        if (effect?.effectId === "cyber_s_rider") {
          const others = state.players[HUMAN_PLAYER].hand.filter(
            (c) => c.instanceId !== payload.instanceId,
          );
          if (others.length === 0) {
            setBlockedRushAlert(
              "「サイバースライダー」を発動するには、手札にホールドするカードが1枚以上必要です。",
            );
            return;
          }
          setPendingCyberSRider({
            instanceId: payload.instanceId,
            cardId: card.cardId,
          });
          return;
        }

        if (needsOperationTarget(card.cardId)) {
          if (!effect?.target) return;
          const opDef = getCardById(card.cardId) ?? state.definitions[card.cardId];
          if (
            !opDef ||
            !canPlayOperationExceptCommandHold(
              state.players[HUMAN_PLAYER],
              state.definitions,
              opDef,
            )
          ) {
            setBlockedRushAlert(
              `「${opDef?.name ?? card.cardId}」を使うにはパワーが足りません。`,
            );
            return;
          }
          const targets = collectOperationTargets(state, HUMAN_PLAYER, card.cardId);
          if (targets.length === 0) {
            setBlockedRushAlert(
              `「${opDef.name}」の対象となる自軍ユニットがいません。`,
            );
            return;
          }
          setPendingOp({
            instanceId: payload.instanceId,
            cardId: card.cardId,
            effectId: effect.effectId,
            targetType: effect.target,
          });
          return;
        }

        tryPlayOperation(payload.instanceId);
        return;
      }

      if (target === "rush" && state.phase === "rush") {
        const zordCard = getCardById(payload.cardId);
        const needsZord =
          !!zordCard &&
          zordCard.type === "unit" &&
          needsZordMaterial(state.definitions, payload.cardId);

        const rushActions = legalActions.filter(
          (a): a is Extract<typeof a, { type: "rush" }> =>
            a.type === "rush" && a.instanceId === payload.instanceId,
        );
        const paymentInits = legalActions.filter(
          (a): a is Extract<typeof a, { type: "initiate_command_payment" }> =>
            a.type === "initiate_command_payment" &&
            a.kind === "category_use" &&
            a.sourceInstanceId === payload.instanceId,
        );
        const beginSetup = legalActions.find(
          (a): a is Extract<typeof a, { type: "begin_zord_setup" }> =>
            a.type === "begin_zord_setup" && a.zordInstanceId === payload.instanceId,
        );

        if (needsZord) {
          const readyRush =
            findDirectZordRushAction(state, HUMAN_PLAYER, payload.instanceId) ??
            rushActions[0];
          if (readyRush && apply(readyRush)) {
            return;
          }
          if (beginSetup) {
            apply(beginSetup);
            return;
          }
          if (paymentInits.length >= 1) {
            apply(paymentInits[0]!);
            return;
          }
        } else {
          const simpleRush = rushActions.find(
            (a) =>
              !a.zordMaterialInstanceId &&
              (a.zordMothershipHoldInstanceIds?.length ?? 0) === 0,
          );
          if (simpleRush) {
            apply(simpleRush);
            return;
          }
          if (beginSetup) {
            apply(beginSetup);
            return;
          }
          if (rushActions.length === 1) {
            if (apply(rushActions[0]!)) return;
          }
          if (paymentInits.length >= 1) {
            apply(paymentInits[0]!);
            return;
          }
        }

        const reason = explainCannotRush(state, HUMAN_PLAYER, payload.instanceId);
        setBlockedRushAlert(
          reason ??
            `「${getCardById(payload.cardId)?.name ?? payload.cardId}」はラッシュできません。`,
        );
        return;
      }

      if (target === "battle" && state.phase === "battle") {
        attemptMoveToBattle(payload);
      }
    },
    [apply, attemptMoveToBattle, humanCanAct, legalActions, state, tryPlayOperation],
  );

  const handleBattleCardDrop = useCallback(
    (defenderId: string, payload: DragCardPayload) => {
      if (!state || !humanCanAct || state.phase !== "battle") return;
      if (payload.fromZone !== "battle" || payload.playerId !== HUMAN_PLAYER) return;

      const action = legalActions.find(
        (a) =>
          a.type === "battle" &&
          a.attackerInstanceId === payload.instanceId &&
          a.defenderInstanceId === defenderId,
      );
      if (action) apply(action);
    },
    [apply, humanCanAct, legalActions, state],
  );

  const handleStrikeDrop = useCallback(
    (payload: DragCardPayload) => {
      if (!state || !humanCanAct || state.phase !== "battle" || state.pendingStrike) return;
      if (payload.fromZone !== "battle") return;

      const action = legalActions.find(
        (a) => a.type === "strike" && a.instanceId === payload.instanceId,
      );
      if (action) apply(action);
    },
    [apply, humanCanAct, legalActions, state],
  );

  const handleOperationTarget = useCallback(
    (targetInstanceId: string) => {
      if (!pendingOp) return;
      tryPlayOperation(pendingOp.instanceId, targetInstanceId);
    },
    [pendingOp, tryPlayOperation],
  );

  const cyberSRiderHandIds = useMemo(() => {
    if (!pendingCyberSRider || !state) return [];
    return listCyberSRiderHandCandidates(
      state,
      HUMAN_PLAYER,
      pendingCyberSRider.instanceId,
    );
  }, [pendingCyberSRider, state]);

  const canConfirmCyberSRider = useCallback(
    (selectedIds: string[]) => {
      if (!pendingCyberSRider || !state) return false;
      return canSelectCyberSRiderHand(
        state,
        HUMAN_PLAYER,
        pendingCyberSRider.instanceId,
        selectedIds,
      );
    },
    [pendingCyberSRider, state],
  );

  const handleCyberSRiderConfirm = useCallback(
    (selectedIds: string[]) => {
      if (!pendingCyberSRider) return;
      const action = findCyberSRiderAction(pendingCyberSRider.instanceId, selectedIds);
      if (action) {
        apply(action);
        return;
      }
      const [first, second] = selectedIds;
      if (!first) return;
      tryPlayOperation(pendingCyberSRider.instanceId, first, second);
    },
    [apply, findCyberSRiderAction, pendingCyberSRider, tryPlayOperation],
  );

  const handleOperationCardClick = useCallback(
    (card: CardInstance) => {
      if (!state || !humanCanAct) return;
      const effect = getCardEffect(card.cardId);
      if (state.phase === "battle" && effect?.effectId === "battle_dance") {
        setPendingBattleDance({ instanceId: card.instanceId, cardId: card.cardId });
        return;
      }
      if (state.phase !== "rush") return;
      if (effect?.effectId === "shiron_light" || effect?.effectId === "hidora_egg") {
        setPendingPermanentOp({ instanceId: card.instanceId, cardId: card.cardId });
      }
    },
    [humanCanAct, state],
  );

  const handleBattleDanceConfirm = useCallback(
    (commandInstanceIds: [string, string], battleInstanceId: string) => {
      const action = findBattleDanceAction(legalActions, commandInstanceIds, battleInstanceId);
      if (action) apply(action);
    },
    [apply, legalActions],
  );

  const handlePermanentOpActivate = useCallback(() => {
    if (!pendingPermanentOp || !state) return;
    const effect = getCardEffect(pendingPermanentOp.cardId);
    if (effect?.effectId === "shiron_light") {
      if (
        apply({
          type: "shiron_light",
          playerId: HUMAN_PLAYER,
          operationInstanceId: pendingPermanentOp.instanceId,
        })
      ) {
        setPendingPermanentOp(null);
      }
      return;
    }
    if (effect?.effectId === "hidora_egg") {
      if (apply({ type: "hidora_egg", playerId: HUMAN_PLAYER })) {
        setPendingPermanentOp(null);
      }
    }
  }, [apply, pendingPermanentOp, state]);

  const handleCommandPaymentConfirm = useCallback(
    (commandInstanceIds: string[]) => {
      apply({
        type: "resolve_command_payment",
        playerId: HUMAN_PLAYER,
        commandInstanceIds,
      });
      setCommandPaymentSelection([]);
    },
    [apply],
  );

  const handleCommandPaymentCancel = useCallback(() => {
    apply({ type: "cancel_command_payment", playerId: HUMAN_PLAYER });
    setCommandPaymentSelection([]);
  }, [apply]);

  const handleCommandPaymentToggle = useCallback(
    (instanceId: string) => {
      const pending = state?.pendingCommandPayment;
      if (!pending) return;
      const required = pending.totalNeeded;
      setCommandPaymentSelection((prev) => {
        const next = toggleCommandPaymentSelection(prev, instanceId, required);
        if (pending.kind === "category_use" && next.length === required) {
          queueMicrotask(() => handleCommandPaymentConfirm(next));
        }
        return next;
      });
    },
    [handleCommandPaymentConfirm, state?.pendingCommandPayment],
  );

  const handleCommandPaymentPrismChange = useCallback(
    (usePrism: boolean) => {
      if (!state?.pendingCommandPayment) return;
      const pending = state.pendingCommandPayment;
      const cancelled = applyAction(state, {
        type: "cancel_command_payment",
        playerId: HUMAN_PLAYER,
      });
      if (!cancelled.ok) return;
      const cont = pending.continuation;
      let initiateAction: GameAction | null = null;
      if (cont.type === "rush") {
        initiateAction = {
          type: "initiate_command_payment",
          playerId: HUMAN_PLAYER,
          kind: "category_use",
          sourceInstanceId: pending.sourceInstanceId,
          prismSubstitute: usePrism,
          zordMaterialInstanceId: cont.zordMaterialInstanceId,
          zordMaterialDestination: cont.zordMaterialDestination,
          zordMothershipHoldInstanceIds: cont.zordMothershipHoldInstanceIds,
        };
      } else if (cont.type === "play_operation") {
        initiateAction = {
          type: "initiate_command_payment",
          playerId: HUMAN_PLAYER,
          kind: "category_use",
          sourceInstanceId: pending.sourceInstanceId,
          prismSubstitute: usePrism,
          targetInstanceId: cont.targetInstanceId,
          extraInstanceId: cont.extraInstanceId,
        };
      } else if (cont.type === "play_counter") {
        initiateAction = {
          type: "initiate_command_payment",
          playerId: HUMAN_PLAYER,
          kind: "category_use",
          sourceInstanceId: pending.sourceInstanceId,
          prismSubstitute: usePrism,
          substituteInstanceId: cont.substituteInstanceId,
        };
      }
      if (!initiateAction) return;
      const initiated = applyAction(cancelled.state, initiateAction);
      if (initiated.ok) {
        setState(initiated.state);
        setActionError(null);
      } else {
        setActionError(formatActionError(initiated.error));
      }
    },
    [state],
  );

  const handleZordMaterial = useCallback(
    (materialInstanceId: string) => {
      apply({
        type: "resolve_zord_setup",
        playerId: HUMAN_PLAYER,
        materialInstanceId,
      });
    },
    [apply],
  );

  const handleZordDestination = useCallback(
    (destination: "command" | "discard") => {
      apply({
        type: "resolve_zord_setup",
        playerId: HUMAN_PLAYER,
        destination,
      });
    },
    [apply],
  );

  const handleZordUseMothership = useCallback(() => {
    apply({
      type: "resolve_zord_setup",
      playerId: HUMAN_PLAYER,
      paymentPath: "mothership",
    });
  }, [apply]);

  const handleZordSetupContinue = useCallback(() => {
    apply({ type: "resolve_zord_setup", playerId: HUMAN_PLAYER });
  }, [apply]);

  const handleZordSetupCancel = useCallback(() => {
    apply({ type: "cancel_zord_setup", playerId: HUMAN_PLAYER });
  }, [apply]);

  const handleViewPile = useCallback(
    (playerId: PlayerId, pile: "deck" | "discard") => {
      if (!state) return;
      const player = state.players[playerId];
      const cards = pile === "deck" ? player.deck : player.discard;
      setPileView({
        title: pile === "deck" ? `${PLAYER_LABELS[playerId]}の山札` : `${PLAYER_LABELS[playerId]}の捨札`,
        cards,
        faceDown: pile === "deck",
        playerId,
        pile,
      });
    },
    [state],
  );

  const pendingTargets = useMemo(() => {
    if (!pendingOp || !state) return undefined;
    const ids = new Set<string>();
    for (const action of legalActions) {
      if (
        action.type === "play_operation" &&
        action.instanceId === pendingOp.instanceId &&
        action.targetInstanceId
      ) {
        ids.add(action.targetInstanceId);
      }
    }
    if (ids.size > 0) return ids;

    const player = state.players[HUMAN_PLAYER];
    const opDef = getCardById(pendingOp.cardId) ?? state.definitions[pendingOp.cardId];
    if (
      opDef &&
      canPlayOperationExceptCommandHold(player, state.definitions, opDef)
    ) {
      for (const targetId of collectOperationTargets(
        state,
        HUMAN_PLAYER,
        pendingOp.cardId,
      )) {
        ids.add(targetId);
      }
    }
    return ids.size > 0 ? ids : undefined;
  }, [legalActions, pendingOp, state]);

  const pendingZordSetupTargets = useMemo(() => {
    const setup = state?.pendingZordSetup;
    if (!setup || setup.playerId !== HUMAN_PLAYER || setup.step !== "material") {
      return undefined;
    }
    return setup.validInstanceIds.length > 0
      ? new Set(setup.validInstanceIds)
      : undefined;
  }, [state?.pendingZordSetup]);

  const pendingDiscardTargets = useMemo(() => {
    if (!pendingTargets || !state || !pendingOp) return undefined;
    const discardIds = new Set(
      state.players[HUMAN_PLAYER].discard.map((c) => c.instanceId),
    );
    const ids = new Set<string>();
    for (const id of pendingTargets) {
      if (discardIds.has(id)) ids.add(id);
    }
    return ids.size > 0 ? ids : undefined;
  }, [pendingOp, pendingTargets, state]);

  const pendingSubstituteTargets = useMemo(() => {
    if (!pendingHiddenNinja || !state) return undefined;
    const ids = new Set<string>();
    const counterId = pendingHiddenNinja.counterInstanceId;
    for (const action of legalActions) {
      if (
        action.type === "play_counter" &&
        action.instanceId === counterId &&
        action.substituteInstanceId
      ) {
        ids.add(action.substituteInstanceId);
      }
      if (
        action.type === "initiate_command_payment" &&
        action.sourceInstanceId === counterId &&
        action.substituteInstanceId
      ) {
        ids.add(action.substituteInstanceId);
      }
    }
    return ids.size > 0 ? ids : undefined;
  }, [legalActions, pendingHiddenNinja, state]);

  const pendingEffectChoiceTargets = useMemo(() => {
    if (!state?.pendingEffectChoice || state.pendingEffectChoice.playerId !== HUMAN_PLAYER) {
      return undefined;
    }
    const ids = new Set<string>();
    for (const action of legalActions) {
      if (action.type === "resolve_effect_choice") {
        ids.add(action.instanceId);
      }
    }
    return ids.size > 0 ? ids : undefined;
  }, [legalActions, state]);

  const handleEffectChoiceSelect = useCallback(
    (instanceId: string) => {
      const action = legalActions.find(
        (a) =>
          a.type === "resolve_effect_choice" &&
          a.playerId === HUMAN_PLAYER &&
          a.instanceId === instanceId,
      );
      if (action) apply(action);
    },
    [apply, legalActions],
  );

  const pendingDamagePaymentTargets = useMemo(() => {
    const pending = state?.pendingDamagePayment;
    if (!pending) return undefined;
    const chooser = pending.choosingPlayerId ?? pending.playerId;
    if (chooser !== HUMAN_PLAYER) return undefined;
    const ids = new Set<string>();
    for (const action of legalActions) {
      if (action.type === "resolve_damage_payment" && action.playerId === HUMAN_PLAYER) {
        ids.add(action.instanceId);
      }
    }
    return ids.size > 0 ? ids : undefined;
  }, [legalActions, state?.pendingDamagePayment]);

  const handleDamagePaymentSelect = useCallback(
    (instanceId: string) => {
      const action = legalActions.find(
        (a) =>
          a.type === "resolve_damage_payment" &&
          a.playerId === HUMAN_PLAYER &&
          a.instanceId === instanceId,
      );
      if (action) apply(action);
    },
    [apply, legalActions],
  );

  const handleAttackTargetSelect = useCallback(
    (defenderInstanceId: string) => {
      const entry = state?.pendingBattleEntry;
      if (!entry || entry.playerId !== HUMAN_PLAYER) return;
      const action = legalActions.find(
        (a) =>
          a.type === "battle" &&
          a.attackerInstanceId === entry.instanceId &&
          a.defenderInstanceId === defenderInstanceId,
      );
      if (action) apply(action);
    },
    [apply, legalActions, state?.pendingBattleEntry],
  );

  const attackTargetIds = useMemo(() => {
    const entry = state?.pendingBattleEntry;
    if (!entry || entry.playerId !== HUMAN_PLAYER) return undefined;
    const ids = new Set<string>();
    for (const action of legalActions) {
      if (
        action.type === "battle" &&
        action.attackerInstanceId === entry.instanceId
      ) {
        ids.add(action.defenderInstanceId);
      }
    }
    return ids.size > 0 ? ids : undefined;
  }, [legalActions, state?.pendingBattleEntry]);

  const entryAttackerIds = useMemo(() => {
    const entry = state?.pendingBattleEntry;
    if (!entry || entry.playerId !== HUMAN_PLAYER) return undefined;
    return new Set([entry.instanceId]);
  }, [state?.pendingBattleEntry]);

  const isHumanBattleEntry =
    !!humanCanAct &&
    state?.pendingBattleEntry?.playerId === HUMAN_PLAYER &&
    !state.pendingStrike &&
    !state.pendingDamagePayment &&
    !state.pendingLeave;

  const battleEntryModal = useMemo(() => {
    if (!isHumanBattleEntry || !state?.pendingBattleEntry) return null;

    const entry = state.pendingBattleEntry;
    const unit = state.players[HUMAN_PLAYER].battle.find(
      (c) => c.instanceId === entry.instanceId,
    );
    if (!unit) return null;

    const unitCard = getCardById(unit.cardId);
    if (!unitCard) return null;

    const definition = state.definitions[unit.cardId];
    const strikeDamage = strikeDamageFor(
      state.definitions,
      unit,
      state,
      HUMAN_PLAYER,
    );
    const unitBp = effectiveBp(state, HUMAN_PLAYER, unit);
    const unitSpLabel = formatBattleUnitSp(definition?.sp, strikeDamage);

    const canStrike = legalActions.some(
      (a) => a.type === "strike" && a.instanceId === entry.instanceId,
    );

    const enemy = state.players[CPU_PLAYER];
    const targets: Array<{
      instanceId: string;
      card: CardDefinition;
      zone: "battle" | "rush";
    }> = [];

    for (const action of legalActions) {
      if (action.type !== "battle" || action.attackerInstanceId !== entry.instanceId) {
        continue;
      }
      const inBattle = enemy.battle.find(
        (c) => c.instanceId === action.defenderInstanceId,
      );
      const inRush = enemy.rush.find(
        (c) => c.instanceId === action.defenderInstanceId,
      );
      const card = inBattle ?? inRush;
      if (!card) continue;
      const targetCard = getCardById(card.cardId);
      if (!targetCard) continue;
      targets.push({
        instanceId: card.instanceId,
        card: targetCard,
        zone: inBattle ? "battle" : "rush",
      });
    }

    return { unitCard, unitBp, unitSpLabel, strikeDamage, canStrike, targets };
  }, [isHumanBattleEntry, state, legalActions]);

  const handleBattleEntryStrike = useCallback(() => {
    const entry = state?.pendingBattleEntry;
    if (!entry) return;
    const action = legalActions.find(
      (a) => a.type === "strike" && a.instanceId === entry.instanceId,
    );
    if (action) apply(action);
  }, [apply, legalActions, state?.pendingBattleEntry]);

  const handleBattleEntryPass = useCallback(() => {
    apply({ type: "pass_battle_entry", playerId: HUMAN_PLAYER });
  }, [apply]);

  const canPassBattleEntry =
    isHumanBattleEntry &&
    legalActions.some((a) => a.type === "pass_battle_entry");

  const strikeableIds = useMemo(() => {
    if (
      !state ||
      !humanCanAct ||
      state.pendingStrike ||
      state.pendingBattle ||
      state.pendingRush ||
      state.pendingLeave ||
      state.pendingEffectChoice
    ) {
      return undefined;
    }
    if (state.pendingBattleEntry?.playerId === HUMAN_PLAYER) {
      return undefined;
    }
    const ids = getStrikeableInstanceIds(state, HUMAN_PLAYER);
    return ids.length > 0 ? new Set(ids) : undefined;
  }, [humanCanAct, legalActions, state]);

  const reactionUi = useMemo(() => {
    if (!state) return null;
    return resolveReactionModalUi(state, HUMAN_PLAYER, {
      pendingHiddenNinja: pendingHiddenNinja !== null,
    });
  }, [state, pendingHiddenNinja]);

  const isHumanStrikeDefender = !!state && checkHumanStrikeDefender(state, HUMAN_PLAYER);

  const interceptableIds = useMemo(() => {
    if (!reactionUi?.interceptInstanceIds.length) return undefined;
    return new Set(reactionUi.interceptInstanceIds);
  }, [reactionUi]);

  const counterIds = useMemo(() => {
    if (!reactionUi || reactionUi.showModal || reactionUi.counterInstanceIds.length === 0) {
      return undefined;
    }
    return new Set(reactionUi.counterInstanceIds);
  }, [reactionUi]);

  const startPhaseStatus =
    state && humanCanAct && state.phase === "start"
      ? getStartPhaseStatus(state, HUMAN_PLAYER)
      : null;

  const canEndPhase =
    humanCanAct &&
    state &&
    state.phase !== "start" &&
    state.phase !== "end" &&
    legalActions.some((a) => a.type === "end_phase");

  const handleCounterSelect = useCallback(
    (instanceId: string) => {
      const counterActions = legalActions.filter(
        (a): a is Extract<typeof a, { type: "play_counter" }> =>
          a.type === "play_counter" && a.instanceId === instanceId,
      );
      const paymentActions = legalActions.filter(
        (a): a is Extract<typeof a, { type: "initiate_command_payment" }> =>
          a.type === "initiate_command_payment" &&
          a.kind === "category_use" &&
          a.sourceInstanceId === instanceId,
      );

      const substituteChoices = [
        ...counterActions.map((a) => a.substituteInstanceId),
        ...paymentActions.map((a) => a.substituteInstanceId),
      ].filter((id): id is string => !!id);
      const uniqueSubstitutes = [...new Set(substituteChoices)];
      if (uniqueSubstitutes.length > 1) {
        setPendingHiddenNinja({ counterInstanceId: instanceId });
        return;
      }

      const substituteId = uniqueSubstitutes[0];

      if (counterActions.length > 0) {
        const action =
          counterActions.find(
            (a) =>
              a.substituteInstanceId === substituteId ||
              (!a.substituteInstanceId && !substituteId),
          ) ?? counterActions[0];
        if (action) apply(action);
        return;
      }

      const paymentAction =
        paymentActions.find(
          (a) =>
            a.substituteInstanceId === substituteId ||
            (!a.substituteInstanceId && !substituteId),
        ) ?? paymentActions[0];
      if (paymentAction) apply(paymentAction);
    },
    [apply, legalActions],
  );

  const handleSubstituteSelect = useCallback(
    (substituteInstanceId: string) => {
      if (!pendingHiddenNinja) return;
      const counterId = pendingHiddenNinja.counterInstanceId;
      const playAction = legalActions.find(
        (a) =>
          a.type === "play_counter" &&
          a.instanceId === counterId &&
          a.substituteInstanceId === substituteInstanceId,
      );
      if (playAction) {
        apply(playAction);
        return;
      }
      const paymentAction = legalActions.find(
        (a) =>
          a.type === "initiate_command_payment" &&
          a.kind === "category_use" &&
          a.sourceInstanceId === counterId &&
          a.substituteInstanceId === substituteInstanceId,
      );
      if (paymentAction) apply(paymentAction);
    },
    [apply, legalActions, pendingHiddenNinja],
  );

  const operationTargetIds = useMemo(() => {
    const ids = new Set<string>();
    pendingTargets?.forEach((id) => ids.add(id));
    return [...ids];
  }, [pendingTargets]);

  const zordSetup = state?.pendingZordSetup;
  const isHumanZordSetup =
    humanCanAct && zordSetup?.playerId === HUMAN_PLAYER;

  const humanReactionKind = reactionUi?.kind ?? null;

  const handleReactionPass = useCallback(() => {
    if (!humanReactionKind) return;
    const actionType =
      humanReactionKind === "strike"
        ? "pass_strike_reaction"
        : humanReactionKind === "battle"
          ? "pass_battle_reaction"
          : humanReactionKind === "rush"
            ? "pass_rush_reaction"
            : "pass_leave_reaction";
    apply({ type: actionType, playerId: HUMAN_PLAYER });
  }, [apply, humanReactionKind]);

  /** ブロッキングモーダル表示時にフローティング通知をクリア（バトル登場 / 効果選択は除く）。 */
  const suppressFloatingNotices =
    !!state &&
    (isHumanStrikeDefender ||
      (state.pendingBattle && state.activePlayer === HUMAN_PLAYER) ||
      (state.pendingRush && state.activePlayer === HUMAN_PLAYER) ||
      (state.pendingLeave && state.activePlayer === HUMAN_PLAYER) ||
      !!pendingOp ||
      !!pendingCyberSRider ||
      !!pendingBattleDance ||
      !!pendingHiddenNinja);

  useEffect(() => {
    if (!suppressFloatingNotices) return;
    setTurnNotice(null);
    setPhaseNotice(null);
    setEffectNotice(null);
  }, [suppressFloatingNotices]);

  useEffect(() => {
    if (!isHumanBattleEntry) return;
    clearClickSuppression();
  }, [clearClickSuppression, isHumanBattleEntry, state?.pendingBattleEntry?.instanceId]);

  if (!state) {
    if (appScreen === "deck-builder") {
      return (
        <DeckBuilderScreen
          editDeckId={editingDeckId}
          onBack={() => {
            setAppScreen("start");
            setEditingDeckId(null);
          }}
          onSaved={handleDeckSaved}
        />
      );
    }

    return (
      <StartScreen
        humanDeckKey={humanDeckKey}
        cpuDeckKey={cpuDeckKey}
        cpuLevel={cpuLevel}
        firstPlayer={firstPlayer}
        customDecks={customDecks}
        onHumanDeckChange={setHumanDeckKey}
        onCpuDeckChange={setCpuDeckKey}
        onCpuLevelChange={setCpuLevel}
        onFirstPlayerChange={setFirstPlayer}
        onOpenDeckBuilder={openDeckBuilder}
        onStart={startGame}
        startError={startError}
      />
    );
  }

  const canStrike =
    humanCanAct &&
    state.phase === "battle" &&
    !state.pendingStrike &&
    !state.pendingBattle &&
    !state.pendingRush &&
    !state.pendingLeave &&
    !state.pendingEffectChoice &&
    legalActions.some((a) => a.type === "strike");

  const canUsePlasma = reactionUi?.canUsePlasma ?? false;

  const pendingChoice = state.pendingEffectChoice;
  const isHumanDenjiAudience =
    !!pendingChoice && isDenjiRevealAudience(pendingChoice, HUMAN_PLAYER);

  const isHumanShironInvolved =
    !!pendingChoice &&
    pendingChoice.kind === "shiron_light" &&
    (pendingChoice.shironLightMeta?.audiencePlayerIds?.includes(HUMAN_PLAYER) ||
      isShironRevealAudience(pendingChoice, HUMAN_PLAYER) ||
      pendingChoice.playerId === HUMAN_PLAYER);

  const isHumanShironActor =
    humanCanAct && !!pendingChoice && canActOnShironChoice(pendingChoice, HUMAN_PLAYER);

  const isHumanEffectChoice =
    humanCanAct &&
    !!pendingChoice &&
    pendingChoice.playerId === HUMAN_PLAYER &&
    (canActOnDenjiChoice(pendingChoice, HUMAN_PLAYER) ||
      canActOnShironChoice(pendingChoice, HUMAN_PLAYER) ||
      (pendingChoice.kind !== "shiron_light" &&
        !(
          pendingChoice.kind === "denji_machine" &&
          pendingChoice.denjiMachineMeta?.step === "reveal"
        ) &&
        pendingChoice.effectId !== "sagas_sniper"));

  const canSkipEffectChoice =
    isHumanEffectChoice &&
    (!!pendingChoice?.optional || pendingChoice?.effectId === "earth_force") &&
    legalActions.some((a) => a.type === "skip_effect_choice");

  const showReactionModal = reactionUi?.showModal ?? false;
  const counterInstanceIds = reactionUi?.counterInstanceIds ?? [];
  const counterTargetLabels = reactionUi?.counterTargetLabels ?? {};

  const showOperationModal =
    humanCanAct && !!pendingOp && operationTargetIds.length > 0;

  const showCyberSRiderModal =
    humanCanAct &&
    !!pendingCyberSRider &&
    !state.pendingCommandPayment &&
    cyberSRiderHandIds.length > 0;

  const showBattleDanceModal =
    humanCanAct && !!pendingBattleDance && state.phase === "battle";

  const showZordSetupBanner = isHumanZordSetup && !!zordSetup;

  const isHumanDenjiRevealSpectator =
    isHumanDenjiAudience &&
    !!pendingChoice &&
    !canActOnDenjiChoice(pendingChoice, HUMAN_PLAYER);

  const showDenjiRevealModal =
    isHumanDenjiRevealSpectator &&
    !needsEffectHoldPayment(pendingChoice);

  const showEffectNotice =
    !!effectNotice &&
    !showReactionModal &&
    !showDenjiRevealModal &&
    !showOperationModal &&
    !showCyberSRiderModal &&
    !showBattleDanceModal &&
    !showZordSetupBanner;

  const showShironLightModal =
    isHumanShironInvolved &&
    !needsEffectHoldPayment(pendingChoice) &&
    !showEffectNotice;

  const isSagasRevealAudience =
    !!pendingChoice &&
    pendingChoice.effectId === "sagas_sniper" &&
    pendingChoice.playerId !== HUMAN_PLAYER;

  const showSagasRevealModal =
    isSagasRevealAudience &&
    !needsEffectHoldPayment(pendingChoice) &&
    !showEffectNotice;

  const boardTapEffectChoice =
    isHumanEffectChoice && pendingChoice
      ? analyzeBoardTapEffectChoice(state, pendingChoice, HUMAN_PLAYER)
      : null;

  const showEffectChoiceBanner = !!boardTapEffectChoice;

  const showEffectChoiceModal =
    isHumanEffectChoice &&
    !!pendingChoice &&
    pendingChoice.kind !== "shiron_light" &&
    !needsEffectHoldPayment(pendingChoice) &&
    !showEffectNotice &&
    !showDenjiRevealModal &&
    !showSagasRevealModal &&
    !showShironLightModal &&
    !showEffectChoiceBanner;

  const showBattleEntryModal =
    !!battleEntryModal &&
    !showEffectNotice &&
    !state.pendingStrike &&
    !state.pendingDamagePayment &&
    !state.pendingLeave;

  const isHumanCommandPayment = isHumanCommandPaymentActive(state, HUMAN_PLAYER);

  const showCommandPaymentModal = isHumanCommandPayment;

  const commandPaymentView =
    state.pendingCommandPayment?.playerId === HUMAN_PLAYER
      ? buildCommandPaymentView(state, state.pendingCommandPayment)
      : null;

  const boardCommandPaymentTargets = resolveCommandPaymentBoardTargetIds(
    state,
    HUMAN_PLAYER,
  );

  const commandPaymentSelectedIds = showCommandPaymentModal
    ? new Set(commandPaymentSelection)
    : undefined;

  const commandPaymentSelectedCards = showCommandPaymentModal
    ? resolveCommandPaymentSelectedCards(
        state,
        HUMAN_PLAYER,
        commandPaymentSelection,
      )
    : [];

  const canConfirmCommandPaymentSelection =
    showCommandPaymentModal &&
    canConfirmCommandPayment(
      commandPaymentSelection,
      state.pendingCommandPayment!.totalNeeded,
    );

  const pendingDamage = state.pendingDamagePayment;
  const damageChoosingPlayer = pendingDamage
    ? (pendingDamage.choosingPlayerId ?? pendingDamage.playerId)
    : undefined;
  const damageTargetPlayer = pendingDamage?.playerId;
  const isHumanDamagePayment =
    humanCanAct && damageChoosingPlayer === HUMAN_PLAYER;
  const showDamagePaymentModal = isHumanDamagePayment && !!pendingDamage;
  const damagePaymentOnCpuBoard =
    showDamagePaymentModal && damageTargetPlayer === CPU_PLAYER;
  const damagePaymentOnHumanBoard =
    showDamagePaymentModal && damageTargetPlayer === HUMAN_PLAYER;

  const showStartPhaseModal =
    humanCanAct &&
    state.phase === "start" &&
    !showEffectChoiceModal &&
    !showDenjiRevealModal &&
    !showShironLightModal &&
    !showCommandPaymentModal &&
    !!startPhaseStatus;

  const boardEffectChoiceTargets =
    showEffectChoiceModal || showDamagePaymentModal
      ? undefined
      : pendingEffectChoiceTargets;
  const boardDamagePaymentTargets = showDamagePaymentModal
    ? pendingDamagePaymentTargets
    : undefined;
  const boardOperationTargets = showOperationModal ? undefined : pendingTargets;
  const boardZordTargets =
    showZordSetupBanner && zordSetup?.step === "material"
      ? pendingZordSetupTargets
      : undefined;

  const zordSetupZoneHighlights =
    showZordSetupBanner && zordSetup?.step === "material" && pendingZordSetupTargets
      ? zordSetupHighlightZones(state, HUMAN_PLAYER, pendingZordSetupTargets)
      : { rush: false, battle: false };
  const boardCounterIds = showReactionModal ? undefined : counterIds;
  const boardInterceptIds = showReactionModal ? undefined : interceptableIds;
  const boardSubstituteIds = showReactionModal ? undefined : pendingSubstituteTargets;

  const pendingHint = showCommandPaymentModal && commandPaymentView
    ? undefined
    : showZordSetupBanner
      ? undefined
    : showEffectChoiceBanner
      ? undefined
    : showStartPhaseModal
      ? "3つの行程を好きな順番で行ってください"
    : showDamagePaymentModal && pendingDamage
      ? damagePaymentHint(pendingDamage)
    : showEffectChoiceModal || showReactionModal || showOperationModal || showCyberSRiderModal || showBattleDanceModal
    ? undefined
    : isHumanStrikeDefender
    ? interceptableIds?.size
      ? "Sユニットで迎撃、プラズマエネルギー、またはスキップ"
      : canUsePlasma
        ? "プラズマエネルギー発動、またはスキップ"
        : "ストライクへの応答"
    : state.pendingBattle
      ? pendingHiddenNinja
        ? "身代わりにするユニットをタップ"
        : "アタックへのカウンターを選ぶか「応答スキップ」"
      : state.pendingRush
        ? "ラッシュへのカウンターを選ぶか「応答スキップ」"
        : state.pendingLeave
          ? "離場へのカウンターを選ぶか「応答スキップ」"
          : showShironLightModal && pendingChoice
            ? effectChoiceHint(pendingChoice)
          : showDenjiRevealModal && pendingChoice
            ? effectChoiceHint(pendingChoice)
            : isHumanEffectChoice && pendingChoice
              ? effectChoiceHint(pendingChoice)
            : isHumanBattleEntry
              ? undefined
              : state.phase === "battle" &&
                humanCanAct &&
                findMandatoryBattleEntries(state, HUMAN_PLAYER).length > 0
              ? "「可能ならバトルエリアに出る」ユニットをバトルエリアに出してください"
              : pendingOp
                ? pendingDiscardTargets
                  ? pendingTargets && pendingTargets.size > pendingDiscardTargets.size
                    ? "対象をタップ（捨札の対象は捨札ボタンから）"
                    : "捨札ボタンをタップして対象を選んでください"
                  : "対象カードをタップしてください"
                : undefined;

  const phaseStatusSuffix =
    state.pendingStrike &&
    opponent(state.pendingStrike.strikerPlayerId) === HUMAN_PLAYER
      ? "（ストライク応答）"
      : state.pendingStrike
        ? "（ストライク処理中）"
        : state.pendingBattle
          ? "（アタック応答）"
          : state.pendingRush
            ? "（ラッシュ応答）"
            : state.pendingLeave
              ? "（離場応答）"
              : state.pendingEffectChoice
                ? "（効果選択）"
                : state.pendingCommandPayment
                  ? "（コマンド支払い）"
                  : state.pendingBattleEntry
                    ? "（バトルアクション）"
                    : "のターン";

  return (
    <div
      className={["game", chromeExpanded ? "" : "game--chrome-collapsed"]
        .filter(Boolean)
        .join(" ")}
      ref={gameRef}
    >
      {previewCard && (
        <CardModal card={previewCard} onClose={() => setPreviewCard(null)} />
      )}
      {pileView && !previewCard && (
        <PileModal
          title={pileView.title}
          cards={pileView.cards}
          definitions={state.definitions}
          faceDown={pileView.faceDown}
          onPreview={setPreviewCard}
          selectableIds={
            pileView.pile === "discard" &&
            pileView.playerId === HUMAN_PLAYER &&
            pendingDiscardTargets
              ? pendingDiscardTargets
              : undefined
          }
          onSelect={
            pileView.pile === "discard" &&
            pileView.playerId === HUMAN_PLAYER &&
            pendingDiscardTargets
              ? (instanceId) => {
                  handleOperationTarget(instanceId);
                  setPileView(null);
                }
              : undefined
          }
          onClose={() => setPileView(null)}
        />
      )}
      {logOpen && (
        <LogModal
          entries={state.log}
          definitions={state.definitions}
          onClose={() => setLogOpen(false)}
        />
      )}
      {showBattleEntryModal && battleEntryModal && (
        <BattleEntryModal
          unitCard={battleEntryModal.unitCard}
          unitSpLabel={battleEntryModal.unitSpLabel}
          unitBp={battleEntryModal.unitBp}
          strikeDamage={battleEntryModal.strikeDamage}
          canStrike={battleEntryModal.canStrike}
          targets={battleEntryModal.targets}
          onStrike={handleBattleEntryStrike}
          onAttack={handleAttackTargetSelect}
          onPass={handleBattleEntryPass}
          onPreviewCard={setPreviewCard}
        />
      )}
      {showShironLightModal && pendingChoice && (
        <ShironLightModal
          state={state}
          pending={pendingChoice}
          viewerId={HUMAN_PLAYER}
          canAct={isHumanShironActor}
          onPick={(instanceId) =>
            apply({
              type: "resolve_effect_choice",
              playerId: HUMAN_PLAYER,
              instanceId,
            })
          }
          onConfirmReveal={() =>
            apply({ type: "confirm_shiron_reveal", playerId: HUMAN_PLAYER })
          }
          onPreview={(cardId) => {
            const card = getCardById(cardId);
            if (card) setPreviewCard(card);
          }}
        />
      )}
      {pendingPermanentOp && (
        (() => {
          const card = getCardById(pendingPermanentOp.cardId);
          if (!card) return null;
          return (
            <PermanentOperationModal
              card={card}
              canActivate={
                !!state &&
                (getCardEffect(pendingPermanentOp.cardId)?.effectId === "hidora_egg"
                  ? legalActions.some((a) => a.type === "hidora_egg")
                  : canInitiateShironLight(
                      state,
                      HUMAN_PLAYER,
                      pendingPermanentOp.instanceId,
                    ))
              }
              activateLabel={
                getCardEffect(pendingPermanentOp.cardId)?.effectId === "hidora_egg"
                  ? "発動（山札から1枚）"
                  : "発動"
              }
              onActivate={handlePermanentOpActivate}
              onClose={() => setPendingPermanentOp(null)}
            />
          );
        })()
      )}
      {showDenjiRevealModal && pendingChoice && (
        <EffectChoiceModal
          state={state}
          playerId={HUMAN_PLAYER}
          pending={pendingChoice}
          canSkip={false}
          skipLabel=""
          readOnly
          onSelect={handleEffectChoiceSelect}
          onSkip={() => {}}
          onRuinSurvey={() => {}}
          onSeabedDraw={() => {}}
          onOptionalDraw={() => {}}
          onConfirmDenjiReveal={() => {}}
          onConfirmEffectChoice={() => {}}
          onPreview={setPreviewCard}
        />
      )}
      {showSagasRevealModal && pendingChoice && (
        <EffectChoiceModal
          state={state}
          playerId={pendingChoice.playerId}
          pending={pendingChoice}
          canSkip={false}
          skipLabel=""
          readOnly
          onSelect={handleEffectChoiceSelect}
          onSkip={() => {}}
          onRuinSurvey={() => {}}
          onSeabedDraw={() => {}}
          onOptionalDraw={() => {}}
          onConfirmDenjiReveal={() => {}}
          onConfirmEffectChoice={() => {}}
          onPreview={setPreviewCard}
        />
      )}
      {showEffectChoiceModal && pendingChoice && (
        <EffectChoiceModal
          state={state}
          playerId={HUMAN_PLAYER}
          pending={pendingChoice}
          canSkip={canSkipEffectChoice}
          skipLabel={effectChoiceSkipLabel(pendingChoice)}
          onSelect={handleEffectChoiceSelect}
          onSkip={() => apply({ type: "skip_effect_choice", playerId: HUMAN_PLAYER })}
          onRuinSurvey={(placement) =>
            apply({
              type: "resolve_ruin_survey",
              playerId: HUMAN_PLAYER,
              placement,
            })
          }
          onSeabedDraw={(placement) =>
            apply({
              type: "resolve_seabed_draw",
              playerId: HUMAN_PLAYER,
              placement,
            })
          }
          onOptionalDraw={() =>
            apply({
              type: "resolve_effect_choice",
              playerId: HUMAN_PLAYER,
              instanceId: "draw",
            })
          }
          onConfirmDenjiReveal={() =>
            apply({ type: "confirm_denji_reveal", playerId: HUMAN_PLAYER })
          }
          onConfirmEffectChoice={() =>
            apply({ type: "confirm_effect_choice", playerId: HUMAN_PLAYER })
          }
          onPreview={setPreviewCard}
        />
      )}
      {showReactionModal && humanReactionKind && (
        <ReactionModal
          kind={humanReactionKind}
          state={state}
          playerId={HUMAN_PLAYER}
          counterInstanceIds={counterInstanceIds}
          counterTargetLabels={counterTargetLabels}
          interceptInstanceIds={interceptableIds ? [...interceptableIds] : []}
          substituteInstanceIds={
            pendingSubstituteTargets ? [...pendingSubstituteTargets] : []
          }
          hiddenNinjaCounterId={pendingHiddenNinja?.counterInstanceId ?? null}
          canUsePlasma={canUsePlasma}
          canPass={reactionUi?.canPass ?? false}
          onCounter={handleCounterSelect}
          onSubstitute={handleSubstituteSelect}
          onIntercept={(instanceId) =>
            apply({
              type: "five_tech_intercept",
              playerId: HUMAN_PLAYER,
              interceptInstanceId: instanceId,
            })
          }
          onPlasma={() => apply({ type: "use_plasma_energy", playerId: HUMAN_PLAYER })}
          onPass={handleReactionPass}
          onCancelSubstitute={() => setPendingHiddenNinja(null)}
        />
      )}
      {showOperationModal && pendingOp && (
        <OperationPromptModal
          state={state}
          playerId={HUMAN_PLAYER}
          pendingOp={pendingOp}
          targetInstanceIds={operationTargetIds}
          discardOnlyIds={pendingDiscardTargets ?? null}
          onSelectTarget={handleOperationTarget}
          onCancel={() => setPendingOp(null)}
        />
      )}
      {showCyberSRiderModal && pendingCyberSRider && (
        <CyberSRiderModal
          state={state}
          playerId={HUMAN_PLAYER}
          operationInstanceId={pendingCyberSRider.instanceId}
          operationCardId={pendingCyberSRider.cardId}
          validHandInstanceIds={cyberSRiderHandIds}
          canConfirmSelection={canConfirmCyberSRider}
          onConfirm={handleCyberSRiderConfirm}
          onCancel={() => setPendingCyberSRider(null)}
          onPreview={(cardId) => setPreviewCard(getCardById(cardId) ?? null)}
        />
      )}
      {showBattleDanceModal && pendingBattleDance && (
        <BattleDanceModal
          state={state}
          playerId={HUMAN_PLAYER}
          operationCardId={pendingBattleDance.cardId}
          legalActions={legalActions}
          onConfirm={handleBattleDanceConfirm}
          onCancel={() => setPendingBattleDance(null)}
          onPreview={(cardId) => setPreviewCard(getCardById(cardId) ?? null)}
        />
      )}
      {lightningGravityNotice && (
        <LightningGravityHoldModal
          notice={lightningGravityNotice}
          onClose={() => setLightningGravityNotice(null)}
        />
      )}
      {showEffectNotice && effectNotice && (
        <EffectNoticeModal
          message={effectNotice}
          onClose={() => setEffectNotice(null)}
        />
      )}
      {showCommandPaymentModal && state.pendingCommandPayment && commandPaymentView && (
        <CommandPaymentBanner
          pending={state.pendingCommandPayment}
          view={commandPaymentView}
          selectedCount={commandPaymentSelection.length}
          selectedCards={commandPaymentSelectedCards}
          usePrism={state.pendingCommandPayment.prismSubstitute ?? false}
          canConfirm={canConfirmCommandPaymentSelection}
          onCancel={handleCommandPaymentCancel}
          onConfirm={() => handleCommandPaymentConfirm(commandPaymentSelection)}
          onPrismModeChange={handleCommandPaymentPrismChange}
          onPreviewCard={setPreviewCard}
          uiContext={
            state.pendingCommandPayment.kind === "effect_hold" && state.pendingEffectChoice
              ? { effectId: state.pendingEffectChoice.effectId }
              : undefined
          }
        />
      )}
      {showStartPhaseModal && startPhaseStatus && (
        <StartPhaseModal
          status={startPhaseStatus}
          onRelease={() =>
            apply({ type: "release_start_commands", playerId: HUMAN_PLAYER })
          }
          onReturnAllBattle={() =>
            apply({ type: "return_all_battle_to_rush", playerId: HUMAN_PLAYER })
          }
          onDraw={() => apply({ type: "draw", playerId: HUMAN_PLAYER })}
          onBonusDraw={() => apply({ type: "bonus_draw", playerId: HUMAN_PLAYER })}
          onSkipBonusDraw={() =>
            apply({ type: "skip_bonus_draw", playerId: HUMAN_PLAYER })
          }
        />
      )}
      {blockedBattleAlert && (
        <AlertModal
          title="バトルエリアに出せません"
          message={blockedBattleAlert}
          onClose={() => setBlockedBattleAlert(null)}
        />
      )}
      {blockedRushAlert && (
        <AlertModal
          title="ラッシュできません"
          message={blockedRushAlert}
          onClose={() => setBlockedRushAlert(null)}
        />
      )}
      {turnNotice && (
        <TurnNoticeModal playerId={turnNotice} onDismiss={dismissTurnNotice} />
      )}
      {phaseNotice && !turnNotice && (
        <PhaseNoticeModal
          phase={phaseNotice}
          onDismiss={() => setPhaseNotice(null)}
        />
      )}

      <div className="game__chrome">
        {chromeExpanded ? (
          <>
            <header className="game__header">
              <div>
                <h1>レンジャーズストライク</h1>
                <p className="game__subtitle">
                  {humanDeckSelection ? deckSelectionLabel(humanDeckSelection) : "—"}
                  {" vs "}
                  {cpuDeckSelection ? deckSelectionLabel(cpuDeckSelection) : "—"}
                </p>
              </div>
              <button type="button" className="btn btn--ghost" onClick={returnToStart}>
                タイトル
              </button>
            </header>

            <div className="status-bar">
              <span>ターン {state.turn}</span>
              <span className="status-bar__phase">
                {PLAYER_LABELS[state.activePlayer]}
                {phaseStatusSuffix}
              </span>
              {state.winner && (
                <strong className="status-bar__winner">
                  {state.winner === HUMAN_PLAYER ? "あなたの勝ち！" : "CPUの勝ち…"}
                </strong>
              )}
              <button
                type="button"
                className="btn btn--log"
                onClick={() => setLogOpen(true)}
              >
                ログ ({state.log.length})
              </button>
            </div>

            {actionError && (
              <div className="action-error" role="alert">
                {actionError}
              </div>
            )}

            <PhaseGuide
              phase={state.phase}
              isHumanTurn={humanCanAct}
              pendingHint={pendingHint}
            />
          </>
        ) : (
          <div className="game__chrome-bar">
            <span>ターン {state.turn}</span>
            <span className="status-bar__phase">
              {PLAYER_LABELS[state.activePlayer]}
              {phaseStatusSuffix}
            </span>
            {state.winner && (
              <strong className="status-bar__winner">
                {state.winner === HUMAN_PLAYER ? "勝ち" : "敗北"}
              </strong>
            )}
            <button
              type="button"
              className="btn btn--log"
              onClick={() => setLogOpen(true)}
            >
              ログ ({state.log.length})
            </button>
            <button type="button" className="btn btn--ghost" onClick={returnToStart}>
              タイトル
            </button>
            {actionError && (
              <div className="action-error" role="alert">
                {actionError}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          className="game__chrome-toggle"
          onClick={() => setChromeExpanded((open) => !open)}
          aria-expanded={chromeExpanded}
        >
          {chromeExpanded ? "情報を隠す" : "情報を表示"}
        </button>
      </div>

      <div className="game__playfield">
        <div className="game__boards">
          <PlayerBoard
            label="CPU"
            boardRef={cpuBoardRef}
            playerId={CPU_PLAYER}
            player={state.players[CPU_PLAYER]}
            definitions={state.definitions}
            isOpponent
            isActive={state.activePlayer === CPU_PLAYER}
            phase={state.phase}
            onPreview={setPreviewCard}
            onBattleCardDrop={handleBattleCardDrop}
            canAcceptStrike={canStrike}
            strikeHighlight={!!battleDrag}
            onStrikeDrop={handleStrikeDrop}
            onViewPile={(pile) => handleViewPile(CPU_PLAYER, pile)}
            substituteIds={pendingSubstituteTargets}
            onSubstituteSelect={handleSubstituteSelect}
            attackTargetIds={attackTargetIds}
            onAttackTargetSelect={handleAttackTargetSelect}
            pendingEffectChoiceTargets={
              damagePaymentOnCpuBoard
                ? boardDamagePaymentTargets
                : boardEffectChoiceTargets
            }
            onEffectChoiceSelect={
              damagePaymentOnCpuBoard
                ? handleDamagePaymentSelect
                : handleEffectChoiceSelect
            }
            effectChoiceHighlightCommand={boardTapEffectChoice?.opponent.command}
            effectChoiceHighlightPower={boardTapEffectChoice?.opponent.power}
            effectChoiceHighlightRush={boardTapEffectChoice?.opponent.rush}
            effectChoiceHighlightBattle={boardTapEffectChoice?.opponent.battle}
          />

          <PlayerBoard
            label="あなた"
            boardRef={humanBoardRef}
            playerId={HUMAN_PLAYER}
            player={state.players[HUMAN_PLAYER]}
            definitions={state.definitions}
            isHuman
            isHumanTurn={humanCanAct || isHumanCommandPayment}
            isActive={state.activePlayer === HUMAN_PLAYER}
            phase={state.phase}
            onPreview={setPreviewCard}
            onZoneDrop={handleZoneDrop}
            pendingOperationTargets={boardOperationTargets}
            pendingZordTargets={boardZordTargets}
            onOperationTarget={handleOperationTarget}
            onZordMaterial={
              showZordSetupBanner && zordSetup?.step === "material"
                ? handleZordMaterial
                : undefined
            }
            zordSetupHighlightRush={zordSetupZoneHighlights.rush}
            zordSetupHighlightBattle={zordSetupZoneHighlights.battle}
            onBattleDragStart={setBattleDrag}
            onBattleDragEnd={() => setBattleDrag(null)}
            strikeableIds={strikeableIds}
            interceptableIds={boardInterceptIds}
            counterIds={boardCounterIds}
            onInterceptSelect={(instanceId) =>
              apply({ type: "five_tech_intercept", playerId: HUMAN_PLAYER, interceptInstanceId: instanceId })
            }
            onCounterSelect={handleCounterSelect}
            substituteIds={boardSubstituteIds}
            onSubstituteSelect={handleSubstituteSelect}
            onViewPile={(pile) => handleViewPile(HUMAN_PLAYER, pile)}
            onOperationCardClick={handleOperationCardClick}
            entryAttackerIds={entryAttackerIds}
            pendingEffectChoiceTargets={
              damagePaymentOnHumanBoard
                ? boardDamagePaymentTargets
                : boardEffectChoiceTargets
            }
            onEffectChoiceSelect={
              damagePaymentOnHumanBoard
                ? handleDamagePaymentSelect
                : handleEffectChoiceSelect
            }
            pendingCommandPaymentTargets={boardCommandPaymentTargets}
            commandPaymentSelectedIds={commandPaymentSelectedIds}
            onCommandPaymentToggle={handleCommandPaymentToggle}
            commandPaymentHighlightCommand={showCommandPaymentModal}
            commandPaymentHighlightRush={
              showCommandPaymentModal && !!commandPaymentView?.allowRushZoneCommands
            }
            effectChoiceHighlightCommand={boardTapEffectChoice?.self.command}
            effectChoiceHighlightPower={boardTapEffectChoice?.self.power}
            effectChoiceHighlightRush={boardTapEffectChoice?.self.rush}
            effectChoiceHighlightBattle={boardTapEffectChoice?.self.battle}
          />
        </div>

      </div>

      <div className="game__scroll-pad" aria-hidden="true" />

      {showEffectChoiceBanner && boardTapEffectChoice && pendingChoice && (
        <EffectChoiceBanner
          view={boardTapEffectChoice}
          canSkip={canSkipEffectChoice}
          skipLabel={effectChoiceSkipLabel(pendingChoice)}
          onSkip={() => apply({ type: "skip_effect_choice", playerId: HUMAN_PLAYER })}
        />
      )}
      {showZordSetupBanner && zordSetup && (
        <ZordSetupBanner
          state={state}
          playerId={HUMAN_PLAYER}
          setup={zordSetup}
          validTargetIds={pendingZordSetupTargets ?? new Set()}
          onSelectDestination={handleZordDestination}
          onUseMothership={handleZordUseMothership}
          onContinue={handleZordSetupContinue}
          onCancel={handleZordSetupCancel}
        />
      )}
      {showDamagePaymentModal && pendingDamage && (
        <DamagePaymentModal pending={pendingDamage} />
      )}

      <footer className="action-bar">
        {canEndPhase &&
          !showReactionModal &&
          !showEffectChoiceModal &&
          !showDenjiRevealModal &&
          !showDamagePaymentModal &&
          !showOperationModal &&
          !showCommandPaymentModal &&
          !showZordSetupBanner &&
          !showEffectChoiceBanner &&
          !showStartPhaseModal &&
          !canPassBattleEntry && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => apply({ type: "end_phase", playerId: HUMAN_PLAYER })}
          >
            {PHASE_LABELS[state.phase]}フェイズ終了
          </button>
        )}
        {!humanCanAct && !state.winner && !state.pendingStrike && (
          <span className="hint">
            {state.pendingBattleEntry?.playerId === CPU_PLAYER
              ? "CPUがバトルアクションを選択中…"
              : state.pendingEffectChoice?.playerId === CPU_PLAYER
              ? "CPUが効果対象を選択中…"
              : "CPU思考中…"}
          </span>
        )}
        {state.pendingStrike && state.activePlayer === CPU_PLAYER && (
          <span className="hint">CPUがストライクに応答中…</span>
        )}
        {state.pendingStrike &&
          state.pendingLeave &&
          state.activePlayer === HUMAN_PLAYER &&
          state.pendingStrike.strikerPlayerId === HUMAN_PLAYER && (
            <span className="hint">ストライクの続き：離場への応答を選んでください</span>
          )}
        {state.winner && (
          <>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => startGame()}
            >
              もう一度
            </button>
            <button type="button" className="btn" onClick={returnToStart}>
              タイトルに戻る
            </button>
          </>
        )}
      </footer>
    </div>
  );
}
