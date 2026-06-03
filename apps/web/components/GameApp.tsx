"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCardEffect,
  getCardById,
  type CardDefinition,
} from "@rangers-strike/cards";
import {
  applyAction,
  collectFiveTechInterceptors,
  createGame,
  explainCannotEnterBattle,
  explainCannotRush,
  findMandatoryBattleEntries,
  formatActionError,
  getLegalActions,
  getStrikeableInstanceIds,
  isCpuTurn,
  mustDrawBeforeStartEnd,
  needsOperationTarget,
  needsEffectHoldPayment,
  pickCpuAction,
  type CardInstance,
  type GameAction,
  type GameState,
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
import { EffectNoticeModal } from "./EffectNoticeModal";
import { CommandPaymentModal } from "./CommandPaymentModal";
import { ZordSetupModal } from "./ZordSetupModal";
import { OperationPromptModal } from "./OperationPromptModal";
import { ReactionModal } from "./ReactionModal";
import { DeckBuilderScreen } from "./DeckBuilderScreen";
import { LogModal } from "./LogModal";
import { PhaseGuide } from "./PhaseGuide";
import { PileModal } from "./PileModal";
import { PlayerBoard } from "./PlayerBoard";
import { StartScreen } from "./StartScreen";
import { TurnNoticeModal } from "./TurnNoticeModal";
import { effectChoiceHint } from "@/lib/effectChoiceHint";
import {
  formatEffectLogNotice,
  shouldShowEffectLogNotice,
} from "@/lib/effectLogNotice";

const CPU_PLAYER = "player2" as const;
const HUMAN_PLAYER = "player1" as const;
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
    game.pendingZordSetup
  );
}

export function GameApp() {
  const [appScreen, setAppScreen] = useState<AppScreen>("start");
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [customDecks, setCustomDecks] = useState<CustomDeck[]>([]);
  const [humanDeckKey, setHumanDeckKey] = useState(HUMAN_STARTER_KEY);
  const [cpuDeckKey, setCpuDeckKey] = useState(CPU_STARTER_KEY);
  const [cpuLevel, setCpuLevel] = useState<CpuLevel>(1);
  const [firstPlayer, setFirstPlayer] = useState<PlayerId>(HUMAN_PLAYER);
  const [startError, setStartError] = useState<string | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [previewCard, setPreviewCard] = useState<CardDefinition | null>(null);
  const [pileView, setPileView] = useState<PileView | null>(null);
  const [pendingOp, setPendingOp] = useState<PendingOperation | null>(null);
  const [pendingHiddenNinja, setPendingHiddenNinja] = useState<{
    counterInstanceId: string;
  } | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [battleDrag, setBattleDrag] = useState<DragCardPayload | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [blockedBattleAlert, setBlockedBattleAlert] = useState<string | null>(null);
  const [blockedRushAlert, setBlockedRushAlert] = useState<string | null>(null);
  const [turnNotice, setTurnNotice] = useState<PlayerId | null>(null);
  const [effectNotice, setEffectNotice] = useState<string | null>(null);
  const prevLogLenRef = useRef(0);
  const prevActivePlayerRef = useRef<PlayerId | null>(null);
  const cpuBoardRef = useRef<HTMLDivElement>(null);
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
      const game = createGame({
        player1Deck: resolveDeckCards(humanDeckSelection!),
        player2Deck: resolveDeckCards(cpuDeckSelection!),
        firstPlayer,
        rng: () => Math.random(),
      });
      setState(game);
      setStartError(null);
      setPendingOp(null);
      setPendingHiddenNinja(null);
      setPreviewCard(null);
      setPileView(null);
      setActionError(null);
      setBattleDrag(null);
      setLogOpen(false);
      prevActivePlayerRef.current = null;
      setTurnNotice(null);
      setEffectNotice(null);
      prevLogLenRef.current = 0;
    } catch {
      setStartError("デッキの読み込みに失敗しました。");
    }
  }, [cpuDeckSelection, firstPlayer, humanDeckSelection, resolveSelection]);

  const returnToStart = useCallback(() => {
    setState(null);
    setAppScreen("start");
    setEditingDeckId(null);
    setPendingOp(null);
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
      let action = pickCpuAction(state, CPU_PLAYER, cpuLevel);
      if (!action) {
        const legal = getLegalActions(state);
        action =
          legal.find(
            (a) =>
              a.playerId === CPU_PLAYER &&
              (a.type === "pass_battle_entry" ||
                a.type === "skip_effect_choice" ||
                a.type === "pass_battle_reaction" ||
                a.type === "pass_strike_reaction" ||
                a.type === "pass_rush_reaction" ||
                a.type === "pass_leave_reaction"),
          ) ?? legal.find((a) => a.playerId === CPU_PLAYER) ?? null;
      }
      if (!action) return;
      const result = applyAction(state, action);
      if (result.ok) {
        setState(result.state);
        setActionError(null);
      } else {
        setActionError(formatActionError(result.error));
      }
    }, 550);

    return () => window.clearTimeout(timer);
  }, [state, cpuLevel]);

  const legalActions = useMemo(
    () => (state ? getLegalActions(state) : []),
    [state],
  );

  const humanCanAct =
    state?.activePlayer === HUMAN_PLAYER && !state.winner;

  const dismissTurnNotice = useCallback(() => {
    setTurnNotice((current) => {
      if (current) {
        const targetRef = current === HUMAN_PLAYER ? humanBoardRef : cpuBoardRef;
        window.requestAnimationFrame(() => {
          targetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    if (!state || !humanCanAct) return;
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
  }, [apply, humanCanAct, legalActions, state]);

  const tryPlayOperation = useCallback(
    (instanceId: string, targetInstanceId?: string) => {
      const action = legalActions.find(
        (a) =>
          a.type === "play_operation" &&
          a.instanceId === instanceId &&
          (targetInstanceId
            ? a.targetInstanceId === targetInstanceId
            : !a.targetInstanceId),
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
      });
    },
    [apply, legalActions],
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

        if (needsOperationTarget(card.cardId)) {
          const effect = getCardEffect(card.cardId);
          if (!effect?.target) return;
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
        const rushActions = legalActions.filter(
          (a): a is Extract<typeof a, { type: "rush" }> =>
            a.type === "rush" && a.instanceId === payload.instanceId,
        );

        const simpleRush = rushActions.find(
          (a) =>
            !a.zordMaterialInstanceId &&
            (a.zordMothershipHoldInstanceIds?.length ?? 0) === 0,
        );
        if (simpleRush) {
          apply(simpleRush);
          return;
        }

        const beginSetup = legalActions.find(
          (a): a is Extract<typeof a, { type: "begin_zord_setup" }> =>
            a.type === "begin_zord_setup" && a.zordInstanceId === payload.instanceId,
        );
        if (beginSetup) {
          apply(beginSetup);
          return;
        }

        if (rushActions.length === 1) {
          if (apply(rushActions[0]!)) return;
        }

        if (
          apply({
            type: "initiate_command_payment",
            playerId: HUMAN_PLAYER,
            kind: "category_use",
            sourceInstanceId: payload.instanceId,
          })
        ) {
          return;
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

  const handleCommandPaymentConfirm = useCallback(
    (commandInstanceIds: string[]) => {
      apply({
        type: "resolve_command_payment",
        playerId: HUMAN_PLAYER,
        commandInstanceIds,
      });
    },
    [apply],
  );

  const handleCommandPaymentCancel = useCallback(() => {
    apply({ type: "cancel_command_payment", playerId: HUMAN_PLAYER });
  }, [apply]);

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
    for (const action of legalActions) {
      if (
        action.type === "play_counter" &&
        action.instanceId === pendingHiddenNinja.counterInstanceId &&
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
    if (state?.pendingBattleEntry?.playerId === HUMAN_PLAYER) return undefined;
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
    if (state?.pendingBattleEntry?.playerId === HUMAN_PLAYER) return undefined;
    const entry = state?.pendingBattleEntry;
    if (!entry || entry.playerId !== HUMAN_PLAYER) return undefined;
    return new Set([entry.instanceId]);
  }, [state?.pendingBattleEntry]);

  const isHumanBattleEntry =
    !!humanCanAct && state?.pendingBattleEntry?.playerId === HUMAN_PLAYER;

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
    const sp = definition?.sp;
    const modifier = unit.spModifier ?? 0;
    let strikeDamage = Math.max(1, modifier);
    if (typeof sp === "number") {
      strikeDamage = sp + modifier;
    } else if (sp === "special") {
      strikeDamage = Math.max(1, modifier);
    }

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

    return { unitCard, strikeDamage, canStrike, targets };
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

  const interceptableIds = useMemo(() => {
    if (!state?.pendingStrike || state.activePlayer !== HUMAN_PLAYER) return undefined;
    const ids = collectFiveTechInterceptors(state, HUMAN_PLAYER);
    return ids.length > 0 ? new Set(ids) : undefined;
  }, [state]);

  const counterIds = useMemo(() => {
    if (!state || state.activePlayer !== HUMAN_PLAYER) return undefined;
    const ids = legalActions
      .filter((a): a is Extract<typeof a, { type: "play_counter" }> => a.type === "play_counter")
      .map((a) => a.instanceId);
    return ids.length > 0 ? new Set(ids) : undefined;
  }, [legalActions, state]);

  const isReactionTurn =
    !!state &&
    !state.winner &&
    state.activePlayer === HUMAN_PLAYER &&
    (!!state.pendingStrike ||
      !!state.pendingBattle ||
      !!state.pendingRush ||
      !!state.pendingLeave);

  const canPassBattleReaction =
    isReactionTurn && legalActions.some((a) => a.type === "pass_battle_reaction");
  const canPassRushReaction =
    isReactionTurn && legalActions.some((a) => a.type === "pass_rush_reaction");
  const canPassLeaveReaction =
    isReactionTurn && legalActions.some((a) => a.type === "pass_leave_reaction");

  const canBonusDraw =
    humanCanAct &&
    state?.phase === "start" &&
    legalActions.some((a) => a.type === "bonus_draw");

  const canEndPhase =
    humanCanAct &&
    state &&
    (state.phase !== "start" || !mustDrawBeforeStartEnd(state, HUMAN_PLAYER)) &&
    legalActions.some((a) => a.type === "end_phase");

  const handleCounterSelect = useCallback(
    (instanceId: string) => {
      const counterActions = legalActions.filter(
        (a): a is Extract<typeof a, { type: "play_counter" }> =>
          a.type === "play_counter" && a.instanceId === instanceId,
      );
      if (counterActions.length === 0) return;

      const needsSubstitute = counterActions.every((a) => a.substituteInstanceId);
      if (needsSubstitute) {
        setPendingHiddenNinja({ counterInstanceId: instanceId });
        return;
      }

      const action =
        counterActions.find((a) => !a.substituteInstanceId) ?? counterActions[0];
      if (action) apply(action);
    },
    [apply, legalActions],
  );

  const handleSubstituteSelect = useCallback(
    (substituteInstanceId: string) => {
      if (!pendingHiddenNinja) return;
      const action = legalActions.find(
        (a) =>
          a.type === "play_counter" &&
          a.instanceId === pendingHiddenNinja.counterInstanceId &&
          a.substituteInstanceId === substituteInstanceId,
      );
      if (action) apply(action);
    },
    [apply, legalActions, pendingHiddenNinja],
  );

  const counterInstanceIds = useMemo(() => {
    if (!state || state.activePlayer !== HUMAN_PLAYER) return [];
    const ids = legalActions
      .filter((a): a is Extract<typeof a, { type: "play_counter" }> => a.type === "play_counter")
      .map((a) => a.instanceId);
    return [...new Set(ids)];
  }, [legalActions, state]);

  const operationTargetIds = useMemo(() => {
    const ids = new Set<string>();
    pendingTargets?.forEach((id) => ids.add(id));
    return [...ids];
  }, [pendingTargets]);

  const zordSetup = state?.pendingZordSetup;
  const isHumanZordSetup =
    humanCanAct && zordSetup?.playerId === HUMAN_PLAYER;

  const humanReactionKind = useMemo((): "strike" | "battle" | "rush" | "leave" | null => {
    if (!state) return null;
    if (state.pendingStrike && state.activePlayer === HUMAN_PLAYER) return "strike";
    if (state.pendingBattle && state.activePlayer === HUMAN_PLAYER) return "battle";
    if (state.pendingRush && state.activePlayer === HUMAN_PLAYER) return "rush";
    if (state.pendingLeave && state.activePlayer === HUMAN_PLAYER) return "leave";
    return null;
  }, [state]);

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

  /** Clears floating notices when a blocking modal takes over (not battle entry / effect choice). */
  const suppressFloatingNotices =
    !!state &&
    ((state.pendingStrike && state.activePlayer === HUMAN_PLAYER) ||
      (state.pendingBattle && state.activePlayer === HUMAN_PLAYER) ||
      (state.pendingRush && state.activePlayer === HUMAN_PLAYER) ||
      (state.pendingLeave && state.activePlayer === HUMAN_PLAYER) ||
      !!pendingOp ||
      !!state.pendingZordSetup ||
      !!pendingHiddenNinja);

  useEffect(() => {
    if (!suppressFloatingNotices) return;
    setTurnNotice(null);
    setEffectNotice(null);
  }, [suppressFloatingNotices]);

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

  const isStrikeReaction =
    !!state.pendingStrike && state.activePlayer === HUMAN_PLAYER;

  const canUsePlasma =
    isStrikeReaction &&
    legalActions.some((a) => a.type === "use_plasma_energy");

  const pendingChoice = state.pendingEffectChoice;
  const isHumanEffectChoice =
    humanCanAct && pendingChoice?.playerId === HUMAN_PLAYER;

  const canSkipEffectChoice =
    isHumanEffectChoice &&
    (!!pendingChoice?.optional || pendingChoice?.effectId === "earth_force") &&
    legalActions.some((a) => a.type === "skip_effect_choice");

  const showReactionModal =
    !!humanReactionKind &&
    (pendingHiddenNinja !== null ||
      counterInstanceIds.length > 0 ||
      (interceptableIds?.size ?? 0) > 0 ||
      canPassBattleReaction ||
      canPassRushReaction ||
      canPassLeaveReaction ||
      isStrikeReaction);

  const showOperationModal =
    humanCanAct && !!pendingOp && operationTargetIds.length > 0;

  const showZordSetupModal = isHumanZordSetup && !!zordSetup;

  const showEffectNotice =
    !!effectNotice &&
    !showReactionModal &&
    !showOperationModal &&
    !showZordSetupModal;

  const showEffectChoiceModal =
    isHumanEffectChoice &&
    !!pendingChoice &&
    !needsEffectHoldPayment(pendingChoice) &&
    !showEffectNotice;

  const showBattleEntryModal = !!battleEntryModal && !showEffectNotice;

  const showCommandPaymentModal =
    humanCanAct &&
    state.pendingCommandPayment?.playerId === HUMAN_PLAYER;

  const boardEffectChoiceTargets = showEffectChoiceModal
    ? undefined
    : pendingEffectChoiceTargets;
  const boardOperationTargets = showOperationModal ? undefined : pendingTargets;
  const boardZordTargets = showZordSetupModal ? undefined : pendingZordSetupTargets;
  const boardCounterIds = showReactionModal ? undefined : counterIds;
  const boardInterceptIds = showReactionModal ? undefined : interceptableIds;
  const boardSubstituteIds = showReactionModal ? undefined : pendingSubstituteTargets;

  const pendingHint = showCommandPaymentModal
    ? "コマンドを選んでホールド（行動と同時に確定）"
    : showZordSetupModal
      ? zordSetup?.step === "material"
        ? "ゾードアップの素材を選んでください"
        : zordSetup?.step === "destination"
          ? "素材の行き先を選んでください"
          : "母艦の支払いに進みます"
    : showEffectChoiceModal || showReactionModal || showOperationModal
    ? undefined
    : isStrikeReaction
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

  return (
    <div className="game">
      {previewCard && (
        <CardModal card={previewCard} onClose={() => setPreviewCard(null)} />
      )}
      {pileView && (
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
          strikeDamage={battleEntryModal.strikeDamage}
          canStrike={battleEntryModal.canStrike}
          targets={battleEntryModal.targets}
          onStrike={handleBattleEntryStrike}
          onAttack={handleAttackTargetSelect}
          onPass={handleBattleEntryPass}
        />
      )}
      {showEffectChoiceModal && pendingChoice && (
        <EffectChoiceModal
          state={state}
          playerId={HUMAN_PLAYER}
          pending={pendingChoice}
          canSkip={canSkipEffectChoice}
          skipLabel={
            pendingChoice.effectId === "earth_force"
              ? "アースの力を捨札にする"
              : "効果をスキップ"
          }
          onSelect={handleEffectChoiceSelect}
          onSkip={() => apply({ type: "skip_effect_choice", playerId: HUMAN_PLAYER })}
          onRuinSurvey={(placement) =>
            apply({
              type: "resolve_ruin_survey",
              playerId: HUMAN_PLAYER,
              placement,
            })
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
          interceptInstanceIds={interceptableIds ? [...interceptableIds] : []}
          substituteInstanceIds={
            pendingSubstituteTargets ? [...pendingSubstituteTargets] : []
          }
          hiddenNinjaCounterId={pendingHiddenNinja?.counterInstanceId ?? null}
          canUsePlasma={canUsePlasma}
          canPass={
            humanReactionKind === "strike"
              ? isStrikeReaction
              : humanReactionKind === "battle"
                ? canPassBattleReaction
                : humanReactionKind === "rush"
                  ? canPassRushReaction
                  : canPassLeaveReaction
          }
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
      {showZordSetupModal && zordSetup && (
        <ZordSetupModal
          state={state}
          playerId={HUMAN_PLAYER}
          setup={zordSetup}
          onSelectMaterial={handleZordMaterial}
          onSelectDestination={handleZordDestination}
          onContinue={handleZordSetupContinue}
          onCancel={handleZordSetupCancel}
        />
      )}
      {showOperationModal && pendingOp && (
        <OperationPromptModal
          state={state}
          pendingOp={pendingOp}
          targetInstanceIds={operationTargetIds}
          discardOnlyIds={pendingDiscardTargets ?? null}
          onSelectTarget={handleOperationTarget}
          onCancel={() => setPendingOp(null)}
        />
      )}
      {showEffectNotice && effectNotice && (
        <EffectNoticeModal
          message={effectNotice}
          onClose={() => setEffectNotice(null)}
        />
      )}
      {showCommandPaymentModal && (
        <CommandPaymentModal
          key={`${state.pendingCommandPayment!.sourceInstanceId}-${state.pendingCommandPayment!.prismSubstitute ?? false}`}
          state={state}
          playerId={HUMAN_PLAYER}
          onConfirm={handleCommandPaymentConfirm}
          onCancel={handleCommandPaymentCancel}
          onPrismModeChange={handleCommandPaymentPrismChange}
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
          {state.pendingStrike
            ? "（ストライク応答）"
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
                      : "のターン"}
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
            pendingEffectChoiceTargets={boardEffectChoiceTargets}
            onEffectChoiceSelect={handleEffectChoiceSelect}
          />

          <PlayerBoard
            label="あなた"
            boardRef={humanBoardRef}
            playerId={HUMAN_PLAYER}
            player={state.players[HUMAN_PLAYER]}
            definitions={state.definitions}
            isHuman
            isHumanTurn={humanCanAct}
            isActive={state.activePlayer === HUMAN_PLAYER}
            phase={state.phase}
            onPreview={setPreviewCard}
            onZoneDrop={handleZoneDrop}
            pendingOperationTargets={boardOperationTargets}
            pendingZordTargets={boardZordTargets}
            onOperationTarget={handleOperationTarget}
            onZordMaterial={
              showZordSetupModal && zordSetup?.step === "material"
                ? handleZordMaterial
                : undefined
            }
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
            entryAttackerIds={entryAttackerIds}
            pendingEffectChoiceTargets={boardEffectChoiceTargets}
            onEffectChoiceSelect={handleEffectChoiceSelect}
          />
        </div>

      </div>

      <footer className="action-bar">
        {humanCanAct && state.phase === "start" && legalActions.some((a) => a.type === "draw") && (
          <button
            type="button"
            className="btn"
            onClick={() => apply({ type: "draw", playerId: HUMAN_PLAYER })}
          >
            ドロー
          </button>
        )}
        {canBonusDraw && (
          <button
            type="button"
            className="btn"
            onClick={() => apply({ type: "bonus_draw", playerId: HUMAN_PLAYER })}
          >
            追加ドロー
          </button>
        )}
        {canEndPhase &&
          !showReactionModal &&
          !showEffectChoiceModal &&
          !showOperationModal &&
          !showCommandPaymentModal &&
          !canPassBattleEntry && (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => apply({ type: "end_phase", playerId: HUMAN_PLAYER })}
          >
            {PHASE_LABELS[state.phase]}フェイズ終了
          </button>
        )}
        {!canEndPhase && humanCanAct && state.phase === "start" && (
          <span className="hint">先にドローしてください</span>
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
