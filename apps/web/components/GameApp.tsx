"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCardEffect,
  resolvePlayableCard,
  type CardDefinition,
} from "@rangers-strike/cards";
import {
  applyAction,
  canPlayOperationExceptCommandHold,
  collectOperationTargets,
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
  needsHoldExtraCommand,
  countAvailablePower,
  isRushable,
  PHASE_ORDER,
  isDenjiRevealAudience,
  canActOnDenjiChoice,
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
import { loadCustomDecks, type CustomDeck } from "@/lib/deckBuilder";
import {
  canActivatePermanentOperationUi,
  findActivateResidentOperationAction,
  permanentOperationActivateLabel,
  shouldOpenPermanentOperationModal,
} from "@/lib/permanentOperationUi";
import {
  findOperationCategoryPaymentAction,
  findPlayOperationAction,
} from "@/lib/operationProcedureUi";
import {
  findPassMorphReactionAction,
  findSelectMorphUnitAction,
  morphOrderHint,
  resolveMorphUiState,
} from "@/lib/morphUi";
import { estimateDeckWarnings } from "@/lib/deckWarnings";
import { formatDeckValidationMessage } from "@/lib/formatDeckValidation";
import {
  createGameFromDeckSelections,
  decodeDeckSelection,
  deckSelectionLabel,
  encodeDeckSelection,
  isFullPlayableSelection,
  validateDeckSelection,
  type DeckSelection,
} from "@/lib/deckSelection";
import { resolveCardTargets } from "@/lib/cardTargets";
import type { DragCardPayload, DropTarget, PendingOperation } from "@/lib/dnd";
import { CardActionSheet, type CardSheetAction } from "./CardActionSheet";
import { CardModal } from "./CardModal";
import { BattleEntryModal } from "./BattleEntryModal";
import { RideOffModal } from "./RideOffModal";
import { RegisterModal } from "./RegisterModal";
import { ChaseModal } from "./ChaseModal";
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
import { isKnownEffectChoice } from "@/lib/webUiEffectCoverage";
import {
  isEffectDebugEnabled,
  isEffectDebugToggleVisible,
  logEffectDebug,
  setEffectDebugEnabled,
} from "@/lib/debugEffectLog";
import {
  canSelectCyberSRiderHand,
  listCyberSRiderHandCandidates,
} from "@/lib/cyberSRiderUi";
import { findBattleDanceAction } from "@/lib/battleDanceUi";
import {
  buildWingBattleModal,
  collectWingAttackerInstanceIds,
  collectWingAttackTargetIds,
  collectWingHoldInstanceIds,
  findWingBattleAction,
} from "@/lib/wingUi";
import { usePointerDrag } from "@/lib/PointerDragContext";

const CPU_PLAYER = "player2" as const;
const HUMAN_PLAYER = "player1" as const;

function formatBattleUnitSp(
  sp: CardDefinition["sp"],
  effectiveSp: number,
): string {
  if (effectiveSp > 0) return `SP${effectiveSp}`;
  if (sp === "special") return "SP！";
  if (typeof sp === "string" && sp.includes("/")) return `SP${sp}`;
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
  const [cpuLevel, setCpuLevel] = useState<CpuLevel>(4);
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
  const [wingPromptAttackerId, setWingPromptAttackerId] = useState<string | null>(null);
  const [pendingHiddenNinja, setPendingHiddenNinja] = useState<{
    counterInstanceId: string;
  } | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [effectDebugLog, setEffectDebugLog] = useState<string[]>([]);
  const [effectDebugEnabled, setEffectDebugEnabledState] = useState(false);
  const prevPendingEffectKeyRef = useRef<string | null>(null);
  const [battleDrag, setBattleDrag] = useState<DragCardPayload | null>(null);
  const [tapSheet, setTapSheet] = useState<{
    card: CardInstance;
    fromZone: "hand" | "battle" | "rush";
  } | null>(null);
  const [tapAttackerId, setTapAttackerId] = useState<string | null>(null);
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

  useEffect(() => {
    setEffectDebugEnabledState(isEffectDebugEnabled());
  }, []);

  const appendEffectDebugLog = useCallback((line: string) => {
    setEffectDebugLog((prev) => [...prev, line]);
  }, []);

  const toggleEffectDebug = useCallback(() => {
    const next = !isEffectDebugEnabled();
    setEffectDebugEnabled(next);
    setEffectDebugEnabledState(next);
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

  const deckWarningsById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof estimateDeckWarnings>>();
    for (const deck of customDecks) {
      map.set(deck.id, estimateDeckWarnings(deck.entries));
    }
    return map;
  }, [customDecks]);

  const humanDeckWarnings = useMemo(() => {
    if (humanDeckSelection?.kind !== "custom") return null;
    return deckWarningsById.get(humanDeckSelection.id) ?? null;
  }, [deckWarningsById, humanDeckSelection]);

  const cpuDeckWarnings = useMemo(() => {
    if (cpuDeckSelection?.kind !== "custom") return null;
    return deckWarningsById.get(cpuDeckSelection.id) ?? null;
  }, [deckWarningsById, cpuDeckSelection]);

  const collectSelectionErrors = useCallback((selection: DeckSelection | null): string[] => {
    if (!selection) return ["デッキが選択されていません"];
    return validateDeckSelection(selection).errors;
  }, []);

  const startGame = useCallback(() => {
    const startErrors = [
      ...collectSelectionErrors(humanDeckSelection),
      ...collectSelectionErrors(cpuDeckSelection),
    ];
    if (startErrors.length > 0) {
      setStartError(formatDeckValidationMessage(startErrors));
      return;
    }

    try {
      const game = createGameFromDeckSelections(
        humanDeckSelection!,
        cpuDeckSelection!,
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
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "デッキの読み込みに失敗しました。";
      setStartError(message);
    }
  }, [collectSelectionErrors, cpuDeckSelection, firstPlayer, humanDeckSelection]);

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
    setWingPromptAttackerId(null);
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
      if (action.type === "battle" || action.type === "pass_battle_entry") {
        setWingPromptAttackerId(null);
      }
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
    const choice = state?.pendingEffectChoice;
    if (!choice) {
      prevPendingEffectKeyRef.current = null;
      return;
    }
    const key = `${choice.effectId}:${choice.kind}:${choice.sourceInstanceId ?? ""}`;
    if (prevPendingEffectKeyRef.current === key) return;
    prevPendingEffectKeyRef.current = key;
    logEffectDebug(
      `pendingEffectChoice effectId=${choice.effectId} kind=${choice.kind} optional=${String(!!choice.optional)}`,
      appendEffectDebugLog,
    );
  }, [appendEffectDebugLog, state?.pendingEffectChoice]);

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
      const action = findPlayOperationAction(
        legalActions,
        instanceId,
        targetInstanceId,
        extraInstanceId,
      );
      if (action) {
        apply(action);
        return;
      }
      const payment = findOperationCategoryPaymentAction(
        legalActions,
        instanceId,
        targetInstanceId,
        extraInstanceId,
      );
      if (payment) {
        apply(payment);
      }
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
          `「${resolvePlayableCard(card.cardId)?.name ?? card.cardId}」はバトルエリアに出せません。`,
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
          const opDef = resolvePlayableCard(card.cardId) ?? state.definitions[card.cardId];
          if (
            !opDef ||
            !canPlayOperationExceptCommandHold(state, HUMAN_PLAYER, opDef)
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
        const zordCard = resolvePlayableCard(payload.cardId);
        const needsZord =
          !!zordCard &&
          zordCard.type === "unit" &&
          (needsZordMaterial(state.definitions, payload.cardId) ||
            needsHoldExtraCommand(state.definitions, payload.cardId));

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
            `「${resolvePlayableCard(payload.cardId)?.name ?? payload.cardId}」はラッシュできません。`,
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
      if (payload.playerId !== HUMAN_PLAYER) return;
      if (payload.fromZone !== "battle" && payload.fromZone !== "rush") return;

      const action = legalActions.find(
        (a) =>
          a.type === "battle" &&
          a.attackerInstanceId === payload.instanceId &&
          a.defenderInstanceId === defenderId,
      );
      if (action) {
        apply(action);
        setWingPromptAttackerId(null);
      }
    },
    [apply, humanCanAct, legalActions, state],
  );

  const handleRushCardDrop = useCallback(
    (vehicleInstanceId: string, payload: DragCardPayload) => {
      if (!state || !humanCanAct || state.phase !== "battle") return;
      if (payload.playerId !== HUMAN_PLAYER || payload.fromZone !== "rush") return;

      const action = legalActions.find(
        (a) =>
          a.type === "mount_ride" &&
          a.riderInstanceId === payload.instanceId &&
          a.vehicleInstanceId === vehicleInstanceId,
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
      if (!shouldOpenPermanentOperationModal(card, state.phase)) return;
      const effect = getCardEffect(card.cardId);
      if (state.phase === "battle" && effect?.effectId === "battle_dance") {
        setPendingBattleDance({ instanceId: card.instanceId, cardId: card.cardId });
        return;
      }
      if (state.phase !== "rush") return;
      setPendingPermanentOp({ instanceId: card.instanceId, cardId: card.cardId });
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
      return;
    }
    const residentAction = findActivateResidentOperationAction(
      legalActions,
      pendingPermanentOp.instanceId,
    );
    if (residentAction && apply(residentAction)) {
      setPendingPermanentOp(null);
    }
  }, [apply, legalActions, pendingPermanentOp, state]);

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

    const opDef = resolvePlayableCard(pendingOp.cardId) ?? state.definitions[pendingOp.cardId];
    if (
      opDef &&
      canPlayOperationExceptCommandHold(state, HUMAN_PLAYER, opDef)
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

  const activeBattleAttackerId = useMemo(() => {
    if (state?.pendingBattleEntry?.playerId === HUMAN_PLAYER) {
      return state.pendingBattleEntry.instanceId;
    }
    return wingPromptAttackerId;
  }, [state?.pendingBattleEntry, wingPromptAttackerId]);

  const handleAttackTargetSelect = useCallback(
    (defenderInstanceId: string) => {
      if (!activeBattleAttackerId) return;
      const action = findWingBattleAction(
        legalActions,
        activeBattleAttackerId,
        defenderInstanceId,
      );
      if (action) {
        apply(action);
        setWingPromptAttackerId(null);
      }
    },
    [activeBattleAttackerId, apply, legalActions],
  );

  const attackTargetIds = useMemo(() => {
    if (!activeBattleAttackerId) return undefined;
    const ids = collectWingAttackTargetIds(legalActions, activeBattleAttackerId);
    return ids.size > 0 ? ids : undefined;
  }, [activeBattleAttackerId, legalActions]);

  const wingHoldableIds = useMemo(() => {
    if (!state || !humanCanAct || state.phase !== "battle" || wingPromptAttackerId) {
      return undefined;
    }
    const ids = collectWingHoldInstanceIds(legalActions, HUMAN_PLAYER);
    return ids.size > 0 ? ids : undefined;
  }, [humanCanAct, legalActions, state, wingPromptAttackerId]);

  const wingAttackReadyIds = useMemo(() => {
    if (!state || !humanCanAct || state.phase !== "battle" || wingPromptAttackerId) {
      return undefined;
    }
    const rushIds = state.players[HUMAN_PLAYER].rush.map((card) => card.instanceId);
    const ids = collectWingAttackerInstanceIds(legalActions, HUMAN_PLAYER, rushIds);
    const holdable = collectWingHoldInstanceIds(legalActions, HUMAN_PLAYER);
    for (const id of holdable) {
      ids.delete(id);
    }
    return ids.size > 0 ? ids : undefined;
  }, [humanCanAct, legalActions, state, wingPromptAttackerId]);

  const wingRushSelectableIds = useMemo(() => {
    if (!wingHoldableIds && !wingAttackReadyIds) return undefined;
    const ids = new Set<string>();
    wingHoldableIds?.forEach((id) => ids.add(id));
    wingAttackReadyIds?.forEach((id) => ids.add(id));
    return ids.size > 0 ? ids : undefined;
  }, [wingAttackReadyIds, wingHoldableIds]);

  const wingAttackDragIds = useMemo(() => {
    if (!state || state.phase !== "battle") return undefined;
    const rushIds = state.players[HUMAN_PLAYER].rush.map((card) => card.instanceId);
    const ids = collectWingAttackerInstanceIds(legalActions, HUMAN_PLAYER, rushIds);
    return ids.size > 0 ? ids : undefined;
  }, [legalActions, state]);

  const handleWingRushSelect = useCallback(
    (instanceId: string) => {
      const holdAction = legalActions.find(
        (action) =>
          action.type === "hold_for_wing" &&
          action.playerId === HUMAN_PLAYER &&
          action.instanceId === instanceId,
      );
      if (holdAction) {
        if (apply(holdAction)) {
          setWingPromptAttackerId(instanceId);
        }
        return;
      }
      const canAttack = legalActions.some(
        (action) =>
          action.type === "battle" &&
          action.playerId === HUMAN_PLAYER &&
          action.attackerInstanceId === instanceId,
      );
      if (canAttack) {
        setWingPromptAttackerId(instanceId);
      }
    },
    [apply, legalActions],
  );

  const handleWingPromptPass = useCallback(() => {
    if (wingPromptAttackerId) {
      const cancelAction = legalActions.find(
        (action) =>
          action.type === "cancel_wing_hold" &&
          action.playerId === HUMAN_PLAYER &&
          action.instanceId === wingPromptAttackerId,
      );
      if (cancelAction) {
        apply(cancelAction);
      }
    }
    setWingPromptAttackerId(null);
  }, [apply, legalActions, wingPromptAttackerId]);

  const handleWingPromptAttack = useCallback(
    (defenderInstanceId: string) => {
      if (!wingPromptAttackerId) return;
      const action = findWingBattleAction(
        legalActions,
        wingPromptAttackerId,
        defenderInstanceId,
      );
      if (action) {
        apply(action);
        setWingPromptAttackerId(null);
      }
    },
    [apply, legalActions, wingPromptAttackerId],
  );

  const wingBattleModal = useMemo(() => {
    if (!state || !wingPromptAttackerId || state.pendingBattleEntry) return null;
    if (!humanCanAct || state.phase !== "battle") return null;
    const built = buildWingBattleModal(
      state,
      legalActions,
      wingPromptAttackerId,
      HUMAN_PLAYER,
      CPU_PLAYER,
      formatBattleUnitSp,
    );
    if (!built) return null;
    return {
      ...built,
      strikeDamage: 0,
      canStrike: false,
    };
  }, [humanCanAct, legalActions, state, wingPromptAttackerId]);

  useEffect(() => {
    if (!wingPromptAttackerId || !state) return;
    const inRush = state.players[HUMAN_PLAYER].rush.some(
      (card) => card.instanceId === wingPromptAttackerId,
    );
    if (!inRush) {
      setWingPromptAttackerId(null);
      return;
    }
    if (collectWingAttackTargetIds(legalActions, wingPromptAttackerId).size === 0) {
      setWingPromptAttackerId(null);
    }
  }, [legalActions, state, wingPromptAttackerId]);

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

    const unitCard = resolvePlayableCard(unit.cardId);
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
      const targetCard = resolvePlayableCard(card.cardId);
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

  const isHumanRideOffChoice =
    !!humanCanAct && state?.pendingRideOffChoice?.playerId === HUMAN_PLAYER;

  const isHumanRegisterChoice =
    !!humanCanAct && state?.pendingRegister?.ownerPlayerId === HUMAN_PLAYER;

  const registerModal = useMemo(() => {
    if (!isHumanRegisterChoice || !state?.pendingRegister) return null;
    const pending = state.pendingRegister;
    const owner = state.players[pending.ownerPlayerId];
    const unit =
      owner.battle.find((c) => c.instanceId === pending.instanceId) ??
      owner.rush.find((c) => c.instanceId === pending.instanceId);
    if (!unit) return null;
    const unitCard = resolvePlayableCard(unit.cardId);
    if (!unitCard) return null;
    return { unitCard };
  }, [isHumanRegisterChoice, state]);

  const handleRegisterHold = useCallback(() => {
    apply({ type: "use_register", playerId: HUMAN_PLAYER });
  }, [apply]);

  const handleRegisterDiscard = useCallback(() => {
    apply({ type: "pass_register", playerId: HUMAN_PLAYER });
  }, [apply]);

  const rideOffModal = useMemo(() => {
    if (!isHumanRideOffChoice || !state?.pendingRideOffChoice) return null;
    const pending = state.pendingRideOffChoice;
    const rider = state.players[HUMAN_PLAYER].battle.find(
      (c) => c.instanceId === pending.instanceId,
    );
    if (!rider) return null;
    const riderCard = resolvePlayableCard(rider.cardId);
    if (!riderCard) return null;

    const vehicle =
      state.players[HUMAN_PLAYER].battle.find(
        (c) => c.instanceId === pending.vehicleInstanceId,
      ) ??
      state.players[HUMAN_PLAYER].rush.find(
        (c) => c.instanceId === pending.vehicleInstanceId,
      );
    const vehicleCard = vehicle ? resolvePlayableCard(vehicle.cardId) : undefined;
    return { riderCard, vehicleCard };
  }, [isHumanRideOffChoice, state]);

  const handleRideOffConfirm = useCallback(() => {
    apply({
      type: "resolve_ride_off_choice",
      playerId: HUMAN_PLAYER,
      rideOff: true,
    });
  }, [apply]);

  const handleRideOffStay = useCallback(() => {
    apply({
      type: "resolve_ride_off_choice",
      playerId: HUMAN_PLAYER,
      rideOff: false,
    });
  }, [apply]);

  const isHumanChase =
    !!humanCanAct && state?.pendingChase?.chaserPlayerId === HUMAN_PLAYER;

  const chaseModal = useMemo(() => {
    if (!isHumanChase || !state?.pendingChase) return null;
    const pending = state.pendingChase;
    const chaserZone = pending.leaveIntent.fromZone;
    const chaserList =
      chaserZone === "rush" || chaserZone === "battle"
        ? state.players[HUMAN_PLAYER][chaserZone]
        : [];
    const chaser = chaserList.find((c) => c.instanceId === pending.chaserInstanceId);
    if (!chaser) return null;
    const chaserCard = resolvePlayableCard(chaser.cardId);
    if (!chaserCard) return null;

    const vehicles: Array<{ instanceId: string; card: CardDefinition }> = [];
    for (const action of legalActions) {
      if (action.type !== "resolve_chase") continue;
      const vehicle = state.players[HUMAN_PLAYER].rush.find(
        (c) => c.instanceId === action.newVehicleInstanceId,
      );
      if (!vehicle) continue;
      const card = resolvePlayableCard(vehicle.cardId);
      if (!card) continue;
      vehicles.push({ instanceId: vehicle.instanceId, card });
    }

    return {
      chaserCard,
      mode: pending.mode,
      vehicles,
    };
  }, [isHumanChase, legalActions, state]);

  const handleChaseSelect = useCallback(
    (vehicleInstanceId: string) => {
      apply({
        type: "resolve_chase",
        playerId: HUMAN_PLAYER,
        newVehicleInstanceId: vehicleInstanceId,
      });
    },
    [apply],
  );

  const handleChasePass = useCallback(() => {
    apply({ type: "pass_chase", playerId: HUMAN_PLAYER });
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

  // --- タップ操作（カードアクションシート） ---

  const canOpenTapSheet =
    !!state &&
    humanCanAct &&
    !state.winner &&
    !state.pendingStrike &&
    !state.pendingBattle &&
    !state.pendingRush &&
    !state.pendingLeave &&
    !state.pendingEffectChoice &&
    !state.pendingDamagePayment &&
    !state.pendingCommandPayment &&
    !state.pendingZordSetup &&
    !state.pendingBattleEntry &&
    !pendingOp &&
    !pendingCyberSRider &&
    !pendingBattleDance &&
    !pendingHiddenNinja &&
    !wingPromptAttackerId &&
    !tapAttackerId;

  const handleHandCardTap = useCallback(
    (card: CardInstance) => {
      if (!canOpenTapSheet) return;
      setTapSheet({ card, fromZone: "hand" });
    },
    [canOpenTapSheet],
  );

  const handleBattleCardTap = useCallback(
    (card: CardInstance) => {
      if (!canOpenTapSheet) return;
      setTapSheet({ card, fromZone: "battle" });
    },
    [canOpenTapSheet],
  );

  const handleRushCardTap = useCallback(
    (card: CardInstance) => {
      if (!canOpenTapSheet) return;
      setTapSheet({ card, fromZone: "rush" });
    },
    [canOpenTapSheet],
  );

  const tapSheetDefinition = useMemo(() => {
    if (!tapSheet) return undefined;
    return (
      state?.definitions[tapSheet.card.cardId] ??
      resolvePlayableCard(tapSheet.card.cardId) ??
      undefined
    );
  }, [state?.definitions, tapSheet]);

  const tapSheetActions = useMemo<CardSheetAction[]>(() => {
    if (!tapSheet || !state) return [];
    const { card, fromZone } = tapSheet;
    const payload: DragCardPayload = {
      instanceId: card.instanceId,
      cardId: card.cardId,
      fromZone,
      playerId: HUMAN_PLAYER,
    };
    const def = state.definitions[card.cardId] ?? resolvePlayableCard(card.cardId);
    const actions: CardSheetAction[] = [];

    if (fromZone === "hand") {
      if (state.phase === "charge") {
        if (
          legalActions.some(
            (a) => a.type === "charge_power" && a.instanceId === card.instanceId,
          )
        ) {
          actions.push({
            id: "charge-power",
            label: "パワーゾーンに置く",
            detail: "パワー +1",
            variant: "primary",
            onSelect: () => handleZoneDrop("power", payload),
          });
        }
        if (
          legalActions.some(
            (a) => a.type === "charge_command" && a.instanceId === card.instanceId,
          )
        ) {
          actions.push({
            id: "charge-command",
            label: "コマンドゾーンに置く",
            detail: "カテゴリ支払いに使う",
            onSelect: () => handleZoneDrop("command", payload),
          });
        }
      } else if (state.phase === "rush") {
        if (def?.type === "operation") {
          actions.push({
            id: "operation",
            label: "オペレーションを使う",
            variant: "primary",
            onSelect: () => handleZoneDrop("operation", payload),
          });
        } else if (isRushable(def)) {
          actions.push({
            id: "rush",
            label: "ラッシュする",
            variant: "primary",
            onSelect: () => handleZoneDrop("rush", payload),
          });
        }
      }
    } else if (fromZone === "battle" && state.phase === "battle") {
      const strikeAction = legalActions.find(
        (a) => a.type === "strike" && a.instanceId === card.instanceId,
      );
      if (strikeAction && strikeableIds?.has(card.instanceId)) {
        const unit = state.players[HUMAN_PLAYER].battle.find(
          (c) => c.instanceId === card.instanceId,
        );
        const damage = unit
          ? strikeDamageFor(state.definitions, unit, state, HUMAN_PLAYER)
          : undefined;
        actions.push({
          id: "strike",
          label: "ストライク！",
          detail: damage !== undefined ? `相手に ${damage} ダメージ` : undefined,
          variant: "danger",
          onSelect: () => apply(strikeAction),
        });
      }
      if (
        legalActions.some(
          (a) => a.type === "battle" && a.attackerInstanceId === card.instanceId,
        )
      ) {
        actions.push({
          id: "attack",
          label: "アタックする",
          detail: "対象の敵軍ユニットをタップ",
          variant: "primary",
          onSelect: () => setTapAttackerId(card.instanceId),
        });
      }
    } else if (fromZone === "rush" && state.phase === "battle") {
      if (
        legalActions.some(
          (a) => a.type === "move_to_battle" && a.instanceId === card.instanceId,
        ) ||
        legalActions.some(
          (a) =>
            a.type === "initiate_command_payment" &&
            a.kind === "battle_entry" &&
            a.sourceInstanceId === card.instanceId,
        )
      ) {
        actions.push({
          id: "enter-battle",
          label: "バトルエリアに出す",
          variant: "primary",
          onSelect: () => attemptMoveToBattle(payload),
        });
      }
      for (const action of legalActions) {
        if (action.type !== "mount_ride" || action.riderInstanceId !== card.instanceId) {
          continue;
        }
        const vehicle = state.players[HUMAN_PLAYER].rush.find(
          (c) => c.instanceId === action.vehicleInstanceId,
        );
        const vehicleName = vehicle
          ? state.definitions[vehicle.cardId]?.name ??
            resolvePlayableCard(vehicle.cardId)?.name
          : undefined;
        actions.push({
          id: `ride-${action.vehicleInstanceId}`,
          label: vehicleName ? `「${vehicleName}」にライド` : "ビークルにライド",
          onSelect: () => apply(action),
        });
      }
    }

    return actions;
  }, [apply, attemptMoveToBattle, handleZoneDrop, legalActions, state, strikeableIds, tapSheet]);

  // タップで選んだアタッカーの対象（敵軍側でハイライト）
  const tapAttackTargetIds = useMemo(() => {
    if (!tapAttackerId) return undefined;
    const ids = new Set<string>();
    for (const action of legalActions) {
      if (action.type === "battle" && action.attackerInstanceId === tapAttackerId) {
        ids.add(action.defenderInstanceId);
      }
    }
    return ids.size > 0 ? ids : undefined;
  }, [legalActions, tapAttackerId]);

  const handleTapAttackTargetSelect = useCallback(
    (defenderInstanceId: string) => {
      if (!tapAttackerId) return;
      const action = legalActions.find(
        (a) =>
          a.type === "battle" &&
          a.attackerInstanceId === tapAttackerId &&
          a.defenderInstanceId === defenderInstanceId,
      );
      if (action) apply(action);
      setTapAttackerId(null);
    },
    [apply, legalActions, tapAttackerId],
  );

  useEffect(() => {
    if (!tapAttackerId) return;
    const stillLegal = legalActions.some(
      (a) => a.type === "battle" && a.attackerInstanceId === tapAttackerId,
    );
    if (!stillLegal) setTapAttackerId(null);
  }, [legalActions, tapAttackerId]);

  useEffect(() => {
    setTapSheet(null);
  }, [state?.phase, state?.turn, state?.activePlayer]);

  // アクションのないカードはタップでそのまま詳細を開く
  useEffect(() => {
    if (!tapSheet || tapSheetActions.length > 0) return;
    const def =
      state?.definitions[tapSheet.card.cardId] ??
      resolvePlayableCard(tapSheet.card.cardId);
    if (def) setPreviewCard(def);
    setTapSheet(null);
  }, [state?.definitions, tapSheet, tapSheetActions]);

  const reactionUi = useMemo(() => {
    if (!state) return null;
    return resolveReactionModalUi(state, HUMAN_PLAYER, {
      pendingHiddenNinja: pendingHiddenNinja !== null,
    });
  }, [state, pendingHiddenNinja]);

  const morphUi = useMemo(() => {
    if (!state) return null;
    return resolveMorphUiState(state, HUMAN_PLAYER);
  }, [state]);

  const morphOrderSelectableIds = useMemo(() => {
    if (!morphUi?.isOrderPhase) return undefined;
    return new Set(morphUi.morphUnitInstanceIds);
  }, [morphUi]);

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

  const handleSkipEffectChoice = useCallback(() => {
    const pending = state?.pendingEffectChoice;
    if (!pending) return;
    const unknown = !isKnownEffectChoice(pending);
    if (legalActions.some((a) => a.type === "skip_effect_choice")) {
      apply({ type: "skip_effect_choice", playerId: HUMAN_PLAYER });
      return;
    }
    if (unknown) {
      const confirm = legalActions.find((a) => a.type === "confirm_effect_choice");
      if (confirm) {
        apply(confirm);
        return;
      }
      apply({ type: "skip_effect_choice", playerId: HUMAN_PLAYER });
    }
  }, [apply, legalActions, state?.pendingEffectChoice]);

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

  const handleMorphOrderSelect = useCallback(
    (instanceId: string) => {
      const action = findSelectMorphUnitAction(legalActions, instanceId, HUMAN_PLAYER);
      if (action) apply(action);
    },
    [apply, legalActions],
  );

  const handleMorphPass = useCallback(() => {
    const action = findPassMorphReactionAction(legalActions, HUMAN_PLAYER);
    if (action) apply(action);
  }, [apply, legalActions]);

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
        deckWarningsById={deckWarningsById}
        humanDeckWarnings={humanDeckWarnings}
        cpuDeckWarnings={cpuDeckWarnings}
        onHumanDeckChange={setHumanDeckKey}
        onCpuDeckChange={setCpuDeckKey}
        onCpuLevelChange={setCpuLevel}
        onFirstPlayerChange={setFirstPlayer}
        onOpenDeckBuilder={openDeckBuilder}
        onStart={startGame}
        startError={startError}
        effectDebugToggleVisible={isEffectDebugToggleVisible()}
        effectDebugEnabled={effectDebugEnabled}
        onToggleEffectDebug={toggleEffectDebug}
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

  const isUnknownEffectChoice =
    !!pendingChoice && !isKnownEffectChoice(pendingChoice);
  const canSkipEffectChoice =
    isHumanEffectChoice &&
    (isUnknownEffectChoice ||
      ((!!pendingChoice?.optional || pendingChoice?.effectId === "earth_force") &&
        legalActions.some((a) => a.type === "skip_effect_choice")));

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
  const showMorphOrderBanner = !!morphUi?.isOrderPhase;
  const showMorphPassBanner =
    !!morphUi?.canPass && !showMorphOrderBanner && !morphUi.isReplacementPhase;

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
    !state.pendingLeave &&
    !state.pendingRideOffChoice;

  const showRideOffModal =
    !!rideOffModal &&
    !showEffectNotice &&
    !state.pendingStrike &&
    !state.pendingDamagePayment &&
    !state.pendingLeave &&
    !state.pendingRegister;

  const showRegisterModal =
    !!registerModal &&
    !showEffectNotice &&
    !state.pendingStrike &&
    !state.pendingDamagePayment &&
    !state.pendingLeave;

  const showChaseModal =
    !!chaseModal &&
    !showEffectNotice &&
    !state.pendingStrike &&
    !state.pendingDamagePayment &&
    !state.pendingLeave &&
    !showRideOffModal;

  const showWingModal =
    !!wingBattleModal &&
    !showEffectNotice &&
    !state.pendingStrike &&
    !state.pendingDamagePayment &&
    !state.pendingLeave &&
    !showBattleEntryModal &&
    !showRideOffModal;

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
    : showEffectChoiceBanner || showMorphOrderBanner || showMorphPassBanner
      ? undefined
    : showStartPhaseModal
      ? "3つの行程を好きな順番で行ってください"
    : showDamagePaymentModal && pendingDamage
      ? damagePaymentHint(pendingDamage)
    : showEffectChoiceModal || showReactionModal || showOperationModal || showCyberSRiderModal || showBattleDanceModal || showMorphOrderBanner || showMorphPassBanner
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
        : showMorphOrderBanner
          ? morphOrderHint(false)
          : showMorphPassBanner
            ? "モーフを使わない場合はスキップしてください"
        : state.pendingLeave
          ? "離場へのカウンターを選ぶか「応答スキップ」"
          : showShironLightModal && pendingChoice
            ? effectChoiceHint(pendingChoice)
          : showDenjiRevealModal && pendingChoice
            ? effectChoiceHint(pendingChoice)
            : isHumanEffectChoice && pendingChoice
              ? effectChoiceHint(pendingChoice)
            : isHumanBattleEntry || showWingModal
              ? undefined
              : state.phase === "battle" &&
                humanCanAct &&
                wingRushSelectableIds?.size
              ? "ウイングするユニットをタップ"
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
                    : showWingModal
                      ? "（ウイング）"
                    : "のターン";

  return (
    <div className="game" ref={gameRef}>
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
          entries={[...effectDebugLog, ...state.log]}
          definitions={state.definitions}
          onClose={() => setLogOpen(false)}
        />
      )}
      {showRideOffModal && rideOffModal && (
        <RideOffModal
          riderCard={rideOffModal.riderCard}
          vehicleCard={rideOffModal.vehicleCard}
          onRideOff={handleRideOffConfirm}
          onStayMounted={handleRideOffStay}
        />
      )}
      {showRegisterModal && registerModal && (
        <RegisterModal
          unitCard={registerModal.unitCard}
          onHold={handleRegisterHold}
          onDiscard={handleRegisterDiscard}
        />
      )}
      {showChaseModal && chaseModal && (
        <ChaseModal
          chaserCard={chaseModal.chaserCard}
          mode={chaseModal.mode}
          vehicles={chaseModal.vehicles}
          onSelectVehicle={handleChaseSelect}
          onPass={handleChasePass}
          onPreviewCard={setPreviewCard}
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
      {showWingModal && wingBattleModal && (
        <BattleEntryModal
          variant="wing"
          unitCard={wingBattleModal.unitCard}
          unitSpLabel={wingBattleModal.unitSpLabel}
          unitBp={wingBattleModal.unitBp}
          strikeDamage={wingBattleModal.strikeDamage}
          canStrike={wingBattleModal.canStrike}
          targets={wingBattleModal.targets}
          onStrike={() => {}}
          onAttack={handleWingPromptAttack}
          onPass={handleWingPromptPass}
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
            const card = resolvePlayableCard(cardId);
            if (card) setPreviewCard(card);
          }}
        />
      )}
      {pendingPermanentOp && (
        (() => {
          const card = resolvePlayableCard(pendingPermanentOp.cardId);
          if (!card) return null;
          return (
            <PermanentOperationModal
              card={card}
              canActivate={
                !!state &&
                canActivatePermanentOperationUi(
                  state,
                  HUMAN_PLAYER,
                  pendingPermanentOp,
                  legalActions,
                )
              }
              activateLabel={permanentOperationActivateLabel(pendingPermanentOp.cardId)}
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
          onSkip={handleSkipEffectChoice}
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
          onPreview={(cardId) => setPreviewCard(resolvePlayableCard(cardId) ?? null)}
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
          onPreview={(cardId) => setPreviewCard(resolvePlayableCard(cardId) ?? null)}
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
      {tapSheet && tapSheetActions.length > 0 && (
        <CardActionSheet
          definition={tapSheetDefinition}
          actions={tapSheetActions}
          onPreview={
            tapSheetDefinition ? () => setPreviewCard(tapSheetDefinition) : undefined
          }
          onClose={() => setTapSheet(null)}
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

      <header className="hud">
        <button
          type="button"
          className="hud__back"
          onClick={returnToStart}
          aria-label="タイトルに戻る"
        >
          ◀
        </button>
        <div className="hud__turn">
          <span className="hud__turn-count">ターン {state.turn}</span>
          <span
            className={`hud__turn-owner ${
              state.activePlayer === HUMAN_PLAYER
                ? "hud__turn-owner--self"
                : "hud__turn-owner--cpu"
            }`}
          >
            {PLAYER_LABELS[state.activePlayer]}
            {phaseStatusSuffix}
          </span>
        </div>
        <ol className="phase-tracker" aria-label="フェイズ">
          {PHASE_ORDER.map((phase) => (
            <li
              key={phase}
              className={`phase-tracker__step ${
                phase === state.phase ? "phase-tracker__step--active" : ""
              }`}
              aria-current={phase === state.phase ? "step" : undefined}
            >
              {PHASE_LABELS[phase]}
            </li>
          ))}
        </ol>
        {state.winner && (
          <strong className="hud__winner">
            {state.winner === HUMAN_PLAYER ? "あなたの勝ち！" : "CPUの勝ち…"}
          </strong>
        )}
        <div className="hud__tools">
          <button
            type="button"
            className="btn btn--ghost hud__tool"
            onClick={() => setLogOpen(true)}
          >
            ログ {state.log.length + effectDebugLog.length}
          </button>
          {isEffectDebugToggleVisible() && (
            <button
              type="button"
              className="btn btn--ghost hud__tool"
              onClick={toggleEffectDebug}
              aria-pressed={effectDebugEnabled}
            >
              効果デバッグ{effectDebugEnabled ? " ON" : ""}
            </button>
          )}
        </div>
      </header>

      {actionError && (
        <div className="action-error action-error--floating" role="alert">
          {actionError}
        </div>
      )}

      <PhaseGuide
        phase={state.phase}
        isHumanTurn={humanCanAct}
        pendingHint={pendingHint}
      />

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
            availablePower={countAvailablePower(state, CPU_PLAYER)}
            substituteIds={pendingSubstituteTargets}
            onSubstituteSelect={handleSubstituteSelect}
            attackTargetIds={attackTargetIds ?? tapAttackTargetIds}
            onAttackTargetSelect={
              attackTargetIds ? handleAttackTargetSelect : handleTapAttackTargetSelect
            }
            pendingEffectChoiceTargets={
              morphOrderSelectableIds ??
              (damagePaymentOnCpuBoard
                ? boardDamagePaymentTargets
                : boardEffectChoiceTargets)
            }
            onEffectChoiceSelect={
              morphOrderSelectableIds
                ? handleMorphOrderSelect
                : damagePaymentOnCpuBoard
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
            onRushCardDrop={handleRushCardDrop}
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
            availablePower={countAvailablePower(state, HUMAN_PLAYER)}
            onHandCardTap={handleHandCardTap}
            onBattleCardTap={handleBattleCardTap}
            onRushCardTap={handleRushCardTap}
            entryAttackerIds={entryAttackerIds}
            wingRushSelectableIds={wingRushSelectableIds}
            wingRushSelectedIds={
              wingPromptAttackerId ? new Set([wingPromptAttackerId]) : undefined
            }
            onWingRushSelect={handleWingRushSelect}
            wingAttackDragIds={wingAttackDragIds}
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
            commandPaymentHighlightBattle={
              showCommandPaymentModal && !!commandPaymentView?.allowRushZoneCommands
            }
            effectChoiceHighlightCommand={boardTapEffectChoice?.self.command}
            effectChoiceHighlightPower={boardTapEffectChoice?.self.power}
            effectChoiceHighlightRush={boardTapEffectChoice?.self.rush}
            effectChoiceHighlightBattle={boardTapEffectChoice?.self.battle}
          />
        </div>

      </div>


      {tapAttackerId && (
        <div className="tap-attack-banner" role="status">
          <span>アタック対象の敵軍ユニットをタップ</span>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setTapAttackerId(null)}
          >
            キャンセル
          </button>
        </div>
      )}
      {showEffectChoiceBanner && boardTapEffectChoice && pendingChoice && (
        <EffectChoiceBanner
          view={boardTapEffectChoice}
          canSkip={canSkipEffectChoice}
          skipLabel={effectChoiceSkipLabel(pendingChoice)}
          onSkip={() => apply({ type: "skip_effect_choice", playerId: HUMAN_PLAYER })}
        />
      )}
      {showMorphOrderBanner && (
        <EffectChoiceBanner
          view={{
            title: "モーフ",
            hint: morphOrderHint(false),
            zoneHint: "相手のモーフユニットをタップして解決順を決めてください",
            self: { command: false, power: false, rush: false, battle: false },
            opponent: { command: false, power: false, rush: true, battle: true },
          }}
          canSkip={false}
          skipLabel=""
          onSkip={() => {}}
        />
      )}
      {showMorphPassBanner && (
        <EffectChoiceBanner
          view={{
            title: "モーフ",
            hint: "モーフを使わない場合はスキップできます",
            zoneHint: "",
            self: { command: false, power: false, rush: false, battle: false },
            opponent: { command: false, power: false, rush: false, battle: false },
          }}
          canSkip
          skipLabel="モーフをスキップ"
          onSkip={handleMorphPass}
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
          !canPassBattleEntry &&
          !showWingModal && (
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
