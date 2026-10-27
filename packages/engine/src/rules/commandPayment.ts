import { isXg2SelfHoldPayment } from "./xg2/xg2Effects";
import { rm1SonicFlapExtraHolds } from "./rm/rm1Fields";
import {
  emergencyRequestEnemyCommandIds,
  releaseEmergencyRequestCommands,
} from "./legend1/set4NamedEffects";
import { rk2RaiaDiscardCandidates } from "./rk/rk2UnitEffects";
import { driverCommandRushIds } from "./driverCommandRush";
import { shifuSubstituteAvailable } from "./legend1/set6NamedEffectsB";
import { operationPaymentCategories } from "./legend1/set5NamedEffectsA";
import type { Category } from "@rangers-strike/cards";
import {
  getBattleEntryHoldCount,
  MOTHERSHIP_CONFIG,
  mothershipHoldsRequiredForRush,
  resolveRushAdditionalCondition,
  zordSlotsFilledByMaterial,
} from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import { getCardEffect } from "@rangers-strike/cards";
import {
  collectOperationTargets,
  isValidOperationTarget,
  needsOperationTarget,
} from "../effects/resolveOperation";
import type { InitiateCommandPaymentAction, ZordMaterialDestination } from "../types/actions";
import { isCostWindowSatisfied, satisfyCostWindow } from "../core/costWindow";
import type {
  CommandPaymentContinuation,
  PendingCommandPayment,
  PendingEffectChoice,
  PendingZordSetup,
} from "../types/game";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { isShironLightRushTarget } from "./shironLight";
import {
  allCategoriesExistInCommandZone,
  canPlayOperation,
  canPlayOperationExceptCommandHold,
  effectiveCommandCategories,
  canRushUnit,
  canRushUnitExceptCommandHold,
  cardCategories,
  getDefinition,
  hasHeldCommandForCategories,
  hasOperationEffect,
  hasReleasedCommandForCategories,
  isRushable,
  isUnit,
  parsePowerCost,
} from "../core/catalog";
import { countAvailablePower, effectivePowerCost } from "../core/power";
import { findInZone } from "../core/helpers";
import { memoizeInSearchWithContext } from "../core/searchCache";
import { actionContextState } from "./zordFeatureContext";
import {
  canMoveUnitToBattle,
  canMoveUnitToBattleExceptHoldRequirements,
  countBattleEntryEligibleHolds,
  countHeldCommands,
  countReleasedCommands,
  hasCommandForCardUse,
  requiredBattleEntryHolds,
} from "./restrictions";
import {
  dslOperationOpensChoose,
  getDslOperationEffect,
  shouldUseDslOperation,
} from "../dsl/dslCatalog";
import { collectTargetInstanceIds } from "../dsl/targetSelectors";
import { operationFizzles } from "./operationFizzle";
import { canCompleteRushAfterCommandPayment, rushPowerBudget } from "./rushDeclaration";
import {
  collectHoldExtraCommandCandidates,
  needsHoldExtraCommand,
} from "./zordExtended";

/** 通常ラッシュ1回ごとに、リリース中コマンドからホールド支払いができるか。 */
export function canPayRushCategoryHold(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  categories: Category[],
): boolean {
  if (categories.length === 0) return true;
  const callUnits = collectCallLeadFieldUnits(player, definitions, "call", categories);
  // ルール: R-KW-CALL-01 補足 — 単色ならコマンドゾーンにそのカテゴリがなくてもコールで支払える。
  if (categories.length === 1 && callUnits.length > 0) return true;
  if (!allCategoriesExistInCommandZone(player, definitions, categories)) return false;
  if (hasReleasedCommandForCategories(player, definitions, categories)) return true;
  if (callUnits.length > 0) {
    return true;
  }
  return (
    hasOperationEffect(player, "prism_power", definitions) &&
    countReleasedCommands(player) >= 2
  );
}
import {
  applyMothershipHolds,
  canUseMothershipForZordRush,
  collectMothershipEligibleCommands,
  mothershipSelfHoldMaterialIds,
  validateMothershipHolds,
} from "./mothership";
import {
  hasAllRequiredFusionMaterials,
  needsZordMaterial,
  requiresAllFusionPartners,
} from "./zord";
import { canBeginZordSetup, hasLegalZordRush } from "./zordSetup";
import { memoizeInEnumeration } from "../core/enumerationMemo";
import {
  canInitiateCounterCategoryPayment,
  isCounterReactionActive,
} from "./operationCounters";
import {
  collectCallLeadFieldUnits,
  holdPaymentSource,
  paymentSourceMatchesCategories,
  type CallLeadKind,
} from "./callLead";
import {
  collectUndeadCommandRushHoldUnits,
  paymentSourceIsUndeadCommandRushHold,
  unitHasUndeadFeature,
} from "./undeadCommandRushHold";

function formatCategories(categories: Category[]): string {
  return categories.join("・");
}

export type CommandPaymentView = {
  kind: PendingCommandPayment["kind"];
  sourceCardId: string;
  sourceCardName: string;
  selectCount: number;
  eligibleSelectMin: number;
  categories: Category[];
  prismSubstitute: boolean;
  prismAvailable: boolean;
  validInstanceIds: string[];
  consumeOnConfirm?: boolean;
  allowRushZoneCommands?: boolean;
};

function cardDisplayName(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): string {
  return getDefinition(definitions, cardId)?.name ?? cardId;
}

function holdCommand(player: PlayerState, instanceId: string): PlayerState {
  const command = player.command.map((c) =>
    c.instanceId === instanceId
      ? { ...c, commandHeld: true, mothershipHold: false }
      : c,
  );
  return { ...player, command };
}

export function getBattleEntryPaymentNeeds(
  state: GameState,
  playerId: PlayerId,
  unit: CardInstance,
): { eligibleNeeded: number; totalNeeded: number } | null {
  if (!canMoveUnitToBattleExceptHoldRequirements(state, playerId, unit, "rush")) {
    return null;
  }
  if (canMoveUnitToBattle(state, playerId, unit, "rush")) return null;

  const player = state.players[playerId];
  // ルール: R-ADD-07 — 「ホールドしなければ出られない」制限（※・稲妻重力エネルギー・ハリケンレオン）は
  // 1つずつ別々に、出る直前にリリース状態のコマンドを新たにホールドして満たす。
  const requiredTotal = requiredBattleEntryHolds(state, playerId, unit);
  if (requiredTotal <= 0) return null;
  if (isCostWindowSatisfied(player, "battle_entry_hold")) return null;
  if (countReleasedCommands(player) < requiredTotal) return null;

  const unitHold = Math.min(getBattleEntryHoldCount(unit.cardId), requiredTotal);
  return { eligibleNeeded: unitHold, totalNeeded: requiredTotal };
}

function callLeadKindForContinuation(
  continuation: CommandPaymentContinuation,
): CallLeadKind {
  return continuation.type === "rush" ? "call" : "lead";
}

function unheldPaymentSourcesMatchingCategory(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  categories: Category[],
  callLeadKind: CallLeadKind,
  rushingCardId?: string,
): CardInstance[] {
  const fromCommand = player.command.filter((cmd) => {
    if (cmd.commandHeld) return false;
    const cmdCats = effectiveCommandCategories(player, definitions, cmd.cardId);
    return categories.some((cat) => cmdCats.includes(cat));
  });
  // ルール: R-KW-CALL-01 — コールのユニットはビークルのラッシュには使えない。
  const rushingVehicle =
    rushingCardId !== undefined && getDefinition(definitions, rushingCardId)?.type === "vehicle";
  const fromField = rushingVehicle
    ? []
    : collectCallLeadFieldUnits(player, definitions, callLeadKind, categories);
  const undeadHold =
    rushingCardId !== undefined && unitHasUndeadFeature(definitions, rushingCardId)
      ? collectUndeadCommandRushHoldUnits(player)
      : [];
  return [...fromCommand, ...fromField, ...undeadHold];
}

type CategoryPaymentOptionsInput = {
  perRushPayment?: boolean;
  callLeadKind?: CallLeadKind;
  rushingCardId?: string;
  /** ラッシュするカード（RS-223【緊急システム発動要請】の判定だけに使う）。 */
  emergencyRushCardId?: string;
};

type CategoryPaymentOptions = { selectCount: number; prismAvailable: boolean; prismSubstitute: boolean; shifuSubstitute?: boolean };

export function getCategoryPaymentOptions(
  state: GameState,
  playerId: PlayerId,
  categories: Category[],
  options?: CategoryPaymentOptionsInput,
): CategoryPaymentOptions | null {
  // CPU の探索の間は、同じ状態・同じ指定の結果を使い回す（合法手の列挙と支払いの合法判定で何度も調べる。コール／リードの判定は
  // applyAction / getLegalActions の入口の状態も読むので、それも区別する）。結果は呼び出しごとに写して返す。
  const key = `${playerId}|${categories.join(",")}|${options?.perRushPayment ?? ""}|${options?.callLeadKind ?? ""}|${options?.rushingCardId ?? ""}|${options?.emergencyRushCardId ?? ""}|${options ? 1 : 0}`;
  const result = memoizeInSearchWithContext(state, actionContextState(), state, `categoryPayment:${key}`, () => {
    const computed = getCategoryPaymentOptionsUncached(state, playerId, categories, options);
    return computed ? { ...computed } : null;
  });
  return result ? { ...result } : null;
}

function getCategoryPaymentOptionsUncached(
  state: GameState,
  playerId: PlayerId,
  categories: Category[],
  options?: CategoryPaymentOptionsInput,
): CategoryPaymentOptions | null {
  const player = state.players[playerId];
  // RS-429【暮らしの中に修行あり】: 自軍ターン中、MA のコマンドのかわりに WB のコマンド＋追加1つをホールドしてよい。
  const shifu = (options?.callLeadKind ?? "call") === "call" && shifuSubstituteAvailable(state, playerId, categories);
  const callLeadKind = options?.callLeadKind ?? "call";
  // RS-223【緊急システム発動要請】: 敵軍コマンドのリリースで自軍コマンド1つのホールドを代替できる（カテゴリは問わない）。
  const emergencyIds =
    callLeadKind === "call"
      ? emergencyRequestEnemyCommandIds(state, playerId, options?.emergencyRushCardId ?? options?.rushingCardId)
      : [];
  // XG7-045・XP-015 ※: 特徴を持つユニットのラッシュに、カテゴリを問わずホールドできるドライバー（rules/driverCommandRush.ts）。
  const driverIds =
    callLeadKind === "call"
      ? driverCommandRushIds(state, playerId, options?.emergencyRushCardId ?? options?.rushingCardId)
      : [];
  // ルール: R-KW-CALL-01 補足 — 単色のカードなら、コマンドゾーンにそのカテゴリがなくてもコール／リードで支払える。
  const singleCategoryCallLead =
    categories.length === 1 &&
    unheldPaymentSourcesMatchingCategory(
      player,
      state.definitions,
      categories,
      callLeadKind,
      options?.rushingCardId,
    ).some((c) => !player.command.some((cmd) => cmd.instanceId === c.instanceId));
  if (
    !singleCategoryCallLead &&
    emergencyIds.length === 0 &&
    driverIds.length === 0 &&
    !allCategoriesExistInCommandZone(player, state.definitions, categories)
  ) {
    return shifu ? { selectCount: 2, prismAvailable: false, prismSubstitute: false, shifuSubstitute: true } : null;
  }

  if (
    !options?.perRushPayment &&
    hasCommandForCardUse(player, state.definitions, categories, callLeadKind)
  ) {
    return null;
  }
  const prismAvailable =
    hasOperationEffect(player, "prism_power", state.definitions) &&
    player.command.filter((c) => !c.commandHeld).length >= 2;

  const matching = unheldPaymentSourcesMatchingCategory(
    player,
    state.definitions,
    categories,
    callLeadKind,
    options?.rushingCardId,
  );
  if (matching.length >= 1 || emergencyIds.length >= 1 || driverIds.length >= 1) {
    return { selectCount: 1, prismAvailable, prismSubstitute: false };
  }

  if (prismAvailable) {
    return { selectCount: 2, prismAvailable: true, prismSubstitute: true };
  }

  if (shifu) return { selectCount: 2, prismAvailable: false, prismSubstitute: false, shifuSubstitute: true };

  return null;
}

export function buildBattleEntryPayment(
  state: GameState,
  playerId: PlayerId,
  unit: CardInstance,
  rideOff?: boolean,
): PendingCommandPayment | null {
  const needs = getBattleEntryPaymentNeeds(state, playerId, unit);
  if (!needs) return null;

  const player = state.players[playerId];
  const validInstanceIds = player.command
    .filter((c) => !c.commandHeld)
    .map((c) => c.instanceId);

  return {
    playerId,
    kind: "battle_entry",
    sourceInstanceId: unit.instanceId,
    sourceCardId: unit.cardId,
    eligibleNeeded: needs.eligibleNeeded,
    totalNeeded: needs.totalNeeded,
    validInstanceIds,
    continuation: { type: "move_to_battle", rideOff },
  };
}

export function buildCategoryPayment(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  sourceCardId: string,
  categories: Category[],
  continuation: CommandPaymentContinuation,
  prismSubstitute: boolean,
  options?: { perRushPayment?: boolean; driverCommandInstanceId?: string },
): PendingCommandPayment | null {
  const callLeadKind = callLeadKindForContinuation(continuation);
  if (options?.driverCommandInstanceId !== undefined) {
    // XG7-045・XP-015 ※: そのドライバーだけをホールドしてラッシュする（rules/driverCommandRush.ts）。
    if (continuation.type !== "rush" || prismSubstitute) return null;
    if (!driverCommandRushIds(state, playerId, sourceCardId).includes(options.driverCommandInstanceId)) return null;
    return {
      playerId,
      kind: "category_use",
      sourceInstanceId,
      sourceCardId,
      categories,
      prismSubstitute: false,
      eligibleNeeded: 0,
      totalNeeded: 1,
      validInstanceIds: [options.driverCommandInstanceId],
      continuation,
    };
  }
  const paymentOptions = getCategoryPaymentOptions(state, playerId, categories, {
    ...options,
    callLeadKind,
    rushingCardId: continuation.type === "rush" ? sourceCardId : undefined,
  });
  if (!paymentOptions) return null;

  const usePrism = prismSubstitute && paymentOptions.prismAvailable;
  const useShifu = !usePrism && paymentOptions.shifuSubstitute === true;
  const selectCount = usePrism || useShifu ? 2 : paymentOptions.selectCount;
  const player = state.players[playerId];
  const matchingIds = unheldPaymentSourcesMatchingCategory(
    player,
    state.definitions,
    categories,
    callLeadKind,
    continuation.type === "rush" ? sourceCardId : undefined,
  ).map((c) => c.instanceId);
  const validInstanceIds = usePrism || useShifu
    ? player.command.filter((c) => !c.commandHeld).map((c) => c.instanceId)
    : [
        ...matchingIds,
        // RS-223【緊急システム発動要請】: ホールド状態の敵軍コマンド（選ぶとリリースする）。
        ...(continuation.type === "rush"
          ? emergencyRequestEnemyCommandIds(state, playerId, sourceCardId)
          : []),
        // XG7-045・XP-015 ※: カテゴリを問わずホールドできるドライバー（カテゴリが合うものは上に入っている）。
        ...(continuation.type === "rush"
          ? driverCommandRushIds(state, playerId, sourceCardId).filter((id) => !matchingIds.includes(id))
          : []),
      ];

  if (validInstanceIds.length < selectCount) return null;

  // RM-014 ソニックフラップ: 自分の捨札に同じカード名のユニットカードがあれば、コマンドを追加で2つホールドしなければラッシュできない
  // （追加分はカテゴリを問わないリリース状態の自軍コマンド。rules/rm/rm1Fields.ts）。
  const sonicExtra = continuation.type === "rush" && !usePrism && !useShifu ? rm1SonicFlapExtraHolds(state, playerId, sourceCardId) : 0;
  if (sonicExtra > 0) {
    const extras = player.command.filter((c) => !c.commandHeld).map((c) => c.instanceId);
    const all = [...new Set([...validInstanceIds, ...extras])];
    if (all.length < selectCount + sonicExtra) return null;
    return {
      playerId,
      kind: "category_use",
      sourceInstanceId,
      sourceCardId,
      categories,
      prismSubstitute: false,
      eligibleNeeded: 0,
      totalNeeded: selectCount + sonicExtra,
      validInstanceIds: all,
      continuation,
      rm1ExtraHolds: sonicExtra,
    };
  }

  return {
    playerId,
    kind: "category_use",
    sourceInstanceId,
    sourceCardId,
    categories,
    prismSubstitute: usePrism,
    ...(useShifu ? { shifuSubstitute: true } : {}),
    eligibleNeeded: 0,
    totalNeeded: selectCount,
    validInstanceIds,
    continuation,
  };
}

export function getCommandPaymentView(
  state: GameState,
  pending: PendingCommandPayment,
): CommandPaymentView {
  const definitions = state.definitions;
  const unitHold =
    pending.kind === "battle_entry"
      ? getBattleEntryHoldCount(pending.sourceCardId)
      : 0;

  return {
    kind: pending.kind,
    sourceCardId: pending.sourceCardId,
    sourceCardName: cardDisplayName(definitions, pending.sourceCardId),
    selectCount: pending.totalNeeded,
    eligibleSelectMin: pending.eligibleNeeded,
    categories: pending.categories ?? [],
    prismSubstitute: pending.prismSubstitute ?? false,
    prismAvailable:
      pending.kind === "category_use" &&
      getCategoryPaymentOptions(state, pending.playerId, pending.categories ?? [])
        ?.prismAvailable === true,
    validInstanceIds: pending.validInstanceIds,
    consumeOnConfirm: pending.kind === "mothership_hold",
    allowRushZoneCommands:
      pending.kind === "mothership_hold" ||
      (pending.kind === "category_use" && pending.continuation.type === "rush"),
  };
}

/**
 * RS-429【暮らしの中に修行あり】の代用ができる「「MA」の自軍コマンドを１つホールドして」の支払い:
 * MA のコマンド1つか、WB のコマンド＋追加1つ（カテゴリを問わない）の計2つ。
 */
function validateShifuEffectHold(
  state: GameState,
  pending: PendingCommandPayment,
  commandInstanceIds: string[],
): string | null {
  for (const id of commandInstanceIds) {
    if (!pending.validInstanceIds.includes(id)) return "invalid_command";
  }
  const player = state.players[pending.playerId];
  const hasCategory = (id: string | undefined, category: Category) => {
    const cmd = player.command.find((c) => c.instanceId === id);
    return !!cmd && !cmd.commandHeld && effectiveCommandCategories(player, state.definitions, cmd.cardId).includes(category);
  };
  if (commandInstanceIds.length === 1) return hasCategory(commandInstanceIds[0], "MA") ? null : "invalid_command";
  if (commandInstanceIds.length === 2) return commandInstanceIds.some((id) => hasCategory(id, "WB")) ? null : "invalid_command";
  return "wrong_count";
}

export function validatePaymentSelection(
  state: GameState,
  pending: PendingCommandPayment,
  commandInstanceIds: string[],
): string | null {
  const unique = new Set(commandInstanceIds);
  if (unique.size !== commandInstanceIds.length) return "duplicate_selection";
  if (pending.extraCommandHoldCount) {
    // 追加分も選ぶ支払い（RS-627）: カテゴリの支払い分と追加分に分けられるか。
    return splitExtraHoldPayment(state, pending, commandInstanceIds) ? null : "invalid_command";
  }
  if (pending.kind === "effect_hold" && pending.shifuSubstitute) {
    return validateShifuEffectHold(state, pending, commandInstanceIds);
  }
  if (pending.kind === "category_use" && pending.rm1ExtraHolds) {
    // RM-014 ソニックフラップ: カテゴリの支払い分（選んだうちの残り）がカテゴリに合い、全部がリリース状態のコマンドか。
    if (commandInstanceIds.length !== pending.totalNeeded) return "wrong_count";
    if (commandInstanceIds.some((id) => !pending.validInstanceIds.includes(id))) return "invalid_command";
    const player = state.players[pending.playerId];
    const matching = commandInstanceIds.filter((id) =>
      paymentSourceMatchesCategories(player, state.definitions, id, pending.categories ?? [], callLeadKindForContinuation(pending.continuation)),
    ).length;
    return matching >= pending.totalNeeded - pending.rm1ExtraHolds ? null : "invalid_command";
  }
  if (commandInstanceIds.length !== pending.totalNeeded) return "wrong_count";
  if (pending.discardInsteadOfHold) {
    // RK-036: 候補（同じカテゴリの自軍コマンドゾーンのカード。ホールド状態でもよい）から選ぶ。
    return commandInstanceIds.every((id) => pending.validInstanceIds.includes(id)) ? null : "invalid_command";
  }

  for (const id of commandInstanceIds) {
    if (!pending.validInstanceIds.includes(id)) return "invalid_command";
  }

  if (pending.kind === "mothership_hold") {
    const player = state.players[pending.playerId];
    const kind = canUseMothershipForZordRush(
      state.definitions,
      player,
      pending.sourceCardId,
    );
    if (!kind) return "invalid_command";
    if (!validateMothershipPaymentHolds(state, pending, commandInstanceIds)) {
      return "invalid_command";
    }
    return null;
  }

  if (pending.kind === "battle_entry" && pending.eligibleNeeded > 0) {
    if (commandInstanceIds.length < pending.eligibleNeeded) {
      return "insufficient_eligible";
    }
  }

  if (pending.kind === "category_use") {
    const player = state.players[pending.playerId];
    const categories = pending.categories ?? [];
    const callLeadKind = callLeadKindForContinuation(pending.continuation);
    const emergencyIds =
      pending.continuation.type === "rush"
        ? emergencyRequestEnemyCommandIds(state, pending.playerId, pending.sourceCardId)
        : [];
    const emergencyPicked = commandInstanceIds.filter((id) => emergencyIds.includes(id));
    if (emergencyPicked.length > 1) return "invalid_command";
    if (emergencyPicked.length > 0) {
      // 敵軍コマンドのリリースで「ラッシュに必要な自軍コマンドを1つホールドした」ことにする。
      return null;
    }
    if (
      pending.continuation.type === "rush" &&
      commandInstanceIds.length === 1 &&
      driverCommandRushIds(state, pending.playerId, pending.sourceCardId).includes(commandInstanceIds[0]!)
    ) {
      // XG7-045・XP-015 ※: ドライバーをホールドしてラッシュする（カテゴリは問わない）。
      return null;
    }
    if (pending.shifuSubstitute) {
      // RS-429: 選んだ2つのうち1つは WB のコマンド（もう1つは追加のコマンド。カテゴリは問わない）。
      const hasWb = commandInstanceIds.some((id) => {
        const cmd = player.command.find((c) => c.instanceId === id);
        return !!cmd && !cmd.commandHeld && effectiveCommandCategories(player, state.definitions, cmd.cardId).includes("WB");
      });
      return hasWb ? null : "invalid_command";
    }
    const singleCategoryByCallLead =
      categories.length === 1 &&
      commandInstanceIds.length > 0 &&
      commandInstanceIds.every((id) => !player.command.some((c) => c.instanceId === id));
    if (
      !singleCategoryByCallLead &&
      !allCategoriesExistInCommandZone(player, state.definitions, categories)
    ) {
      return "invalid_command";
    }
    if (!pending.prismSubstitute) {
      const rushingCardId =
        pending.continuation.type === "rush" ? pending.sourceCardId : undefined;
      for (const id of commandInstanceIds) {
        if (
          paymentSourceMatchesCategories(
            player,
            state.definitions,
            id,
            categories,
            callLeadKind,
          ) ||
          (rushingCardId !== undefined &&
            paymentSourceIsUndeadCommandRushHold(
              player,
              id,
              rushingCardId,
              state.definitions,
            ))
        ) {
          continue;
        }
        return "invalid_command";
      }
    }
  }

  return null;
}

export function applyCommandPaymentResolve(
  state: GameState,
  playerId: PlayerId,
  pending: PendingCommandPayment,
  commandInstanceIds: string[],
): { state: GameState; nextPending?: PendingCommandPayment } | { error: string } {
  if (pending.extraCommandHoldCount) {
    const split = splitExtraHoldPayment(state, pending, commandInstanceIds);
    if (!split) return { error: "invalid_command" };
    return applyCommandPaymentResolve(state, playerId, split.pending, split.ids);
  }
  if (pending.kind === "mothership_hold") {
    const afterMothership = applyMothershipPaymentHolds(
      state,
      playerId,
      pending,
      commandInstanceIds,
    );
    if (!afterMothership) return { error: "invalid_command" };
    const followUp = continueAfterMothershipPayment(
      afterMothership,
      pending,
      commandInstanceIds,
    );
    if (followUp) {
      return { state: afterMothership, nextPending: followUp };
    }
    if (pending.continuation.type !== "rush") return { error: "invalid_payment" };
    return {
      state: {
        ...afterMothership,
        pendingCommandPayment: undefined,
        pendingZordSetup: undefined,
      },
    };
  }

  if (pending.kind === "effect_hold") {
    let nextState = applyPaymentHolds(state, playerId, commandInstanceIds);
    return { state: { ...nextState, pendingCommandPayment: undefined } };
  }

  if (pending.discardInsteadOfHold) {
    // RK-036 仮面ライダーライア: 選んだカードを自軍コマンドゾーンから捨札にして、カウンターの支払いを済ませる。
    const player = state.players[playerId];
    const paid = player.command.filter((c) => commandInstanceIds.includes(c.instanceId));
    if (paid.length !== commandInstanceIds.length) return { error: "invalid_command" };
    const nextPlayer = satisfyCostWindow(
      {
        ...player,
        command: player.command.filter((c) => !commandInstanceIds.includes(c.instanceId)),
        discard: [...player.discard, ...paid.map((c) => ({ instanceId: c.instanceId, cardId: c.cardId }))],
      },
      "counter_category",
      { raiaDiscard: true },
    );
    return { state: { ...state, players: { ...state.players, [playerId]: nextPlayer }, pendingCommandPayment: undefined } };
  }

  const emergencyIds =
    pending.kind === "category_use" && pending.continuation.type === "rush"
      ? emergencyRequestEnemyCommandIds(state, playerId, pending.sourceCardId).filter((id) =>
          commandInstanceIds.includes(id),
        )
      : [];
  let nextState = applyPaymentHolds(
    releaseEmergencyRequestCommands(state, playerId, emergencyIds),
    playerId,
    commandInstanceIds.filter((id) => !emergencyIds.includes(id)),
  );
  const player = nextState.players[playerId];
  let playerPatch: typeof player = player;
  if (pending.kind === "battle_entry") {
    playerPatch = satisfyCostWindow(playerPatch, "battle_entry_hold");
  }
  if (pending.kind === "category_use" && pending.continuation.type === "rush") {
    playerPatch = satisfyCostWindow(playerPatch, "rush_category");
    playerPatch = {
      ...playerPatch,
      lastRushPayment: {
        rushedInstanceId: pending.sourceInstanceId,
        holdInstanceIds: [...commandInstanceIds],
      },
    };
    const holdsPending = pending.continuation.zordMothershipHoldsPending ?? 0;
    if (holdsPending > 0) {
      const afterCategory = {
        ...nextState,
        players: { ...nextState.players, [playerId]: playerPatch },
      };
      const mothership = buildPartialMothershipHoldPayment(
        afterCategory,
        playerId,
        pending.sourceInstanceId,
        pending.sourceCardId,
        pending.continuation.zordMaterialInstanceIds ?? [],
        pending.continuation.zordMaterialDestination,
        holdsPending,
      );
      if (!mothership) return { error: "invalid_payment" };
      return { state: afterCategory, nextPending: mothership };
    }
  }
  if (pending.kind === "category_use" && pending.continuation.type === "play_counter") {
    playerPatch = satisfyCostWindow(playerPatch, "counter_category");
  }
  if (pending.kind === "category_use" && pending.continuation.type === "play_operation") {
    playerPatch = satisfyCostWindow(playerPatch, "operation_category");
  }
  if (playerPatch !== player) {
    nextState = {
      ...nextState,
      players: { ...nextState.players, [playerId]: playerPatch },
    };
  }
  return { state: { ...nextState, pendingCommandPayment: undefined } };
}

export function applyPaymentHolds(
  state: GameState,
  playerId: PlayerId,
  commandInstanceIds: string[],
): GameState {
  let player = state.players[playerId];
  for (const instanceId of commandInstanceIds) {
    player = holdPaymentSource(player, instanceId);
  }
  return { ...state, players: { ...state.players, [playerId]: player } };
}

export function needsEffectHoldPayment(
  pending: PendingEffectChoice,
  state?: GameState,
): boolean {
  if (
    pending.commandAction !== "hold" ||
    (pending.kind !== "select_command" && pending.kind !== "select_commands")
  ) {
    return false;
  }
  // 自軍コマンドを支払いとしてホールドする場合だけ。敵軍コマンドを選んでホールドする効果
  // （RS-082【トリケランス】等）は resolve_effect_choice で選ぶ。
  if (!state) return true;
  const own = state.players[pending.playerId].command;
  // XG2-075・076・078「これをホールドして次の効果を発動できる」（場のこのユニット自身。rules/xg2/xg2Core.ts）。
  if (isXg2SelfHoldPayment(state, pending)) return true;
  return pending.validInstanceIds.every((id) => own.some((c) => c.instanceId === id));
}

export function buildEffectHoldPayment(state: GameState): PendingCommandPayment | null {
  const pending = state.pendingEffectChoice;
  if (!pending || !needsEffectHoldPayment(pending, state)) return null;

  const selectCount = pending.selectCount ?? 1;
  const validInstanceIds = pending.validInstanceIds;
  if (validInstanceIds.length < selectCount) return null;

  if (pending.shifuSubstitute && selectCount === 1) {
    // RS-429【暮らしの中に修行あり】: MA のコマンド1つ、または WB のコマンド＋追加1つ（計2つ）。
    return {
      playerId: pending.playerId,
      kind: "effect_hold",
      sourceInstanceId: pending.sourceInstanceId ?? validInstanceIds[0]!,
      sourceCardId: pending.sourceCardId,
      eligibleNeeded: 0,
      totalNeeded: 2,
      minNeeded: 1,
      shifuSubstitute: true,
      validInstanceIds,
      continuation: { type: "effect_choice" },
    };
  }

  return {
    playerId: pending.playerId,
    kind: "effect_hold",
    sourceInstanceId: pending.sourceInstanceId ?? validInstanceIds[0]!,
    sourceCardId: pending.sourceCardId,
    eligibleNeeded: 0,
    totalNeeded: selectCount,
    validInstanceIds,
    continuation: { type: "effect_choice" },
  };
}

export function buildMothershipHoldPayment(
  state: GameState,
  playerId: PlayerId,
  setup: Pick<PendingZordSetup, "zordInstanceId" | "zordCardId">,
  materialInstanceId?: string,
  materialDestination?: ZordMaterialDestination,
): PendingCommandPayment | null {
  const player = state.players[playerId];
  const kind = canUseMothershipForZordRush(state.definitions, player, setup.zordCardId);
  if (!kind) return null;

  const slotsFilled = materialInstanceId
    ? zordSlotsFilledByMaterial(setup.zordCardId, true, materialDestination === "hold" ? "discard" : materialDestination) // XG1-013 hold は捨札のかわり
    : 0;
  const holdsRequired = mothershipHoldsRequiredForRush(setup.zordCardId, slotsFilled);
  if (holdsRequired <= 0) return null;

  const category = kind.commandCategory;
  const validInstanceIds = collectMothershipEligibleCommands(
    player,
    state.definitions,
    category,
  ).map((e) => e.card.instanceId);
  if (validInstanceIds.length < holdsRequired) return null;

  const continuation: CommandPaymentContinuation = {
    type: "rush",
    zordMaterialInstanceId: materialInstanceId,
    zordMaterialDestination: materialDestination,
  };

  return {
    playerId,
    kind: "mothership_hold",
    sourceInstanceId: setup.zordInstanceId,
    sourceCardId: setup.zordCardId,
    eligibleNeeded: 0,
    totalNeeded: holdsRequired,
    validInstanceIds,
    continuation,
  };
}

function applyMothershipPaymentHolds(
  state: GameState,
  playerId: PlayerId,
  pending: PendingCommandPayment,
  commandInstanceIds: string[],
): GameState | null {
  const player = state.players[playerId];
  const kind = canUseMothershipForZordRush(
    state.definitions,
    player,
    pending.sourceCardId,
  );
  if (!kind) return null;
  if (!validateMothershipPaymentHolds(state, pending, commandInstanceIds)) return null;
  // コマンドゾーンに送る素材そのもののホールド（RS-075 Q2）は、ラッシュの解決で素材を送ったあとに行う。
  const selfHolds = mothershipPaymentSelfHolds(state, pending, kind);
  const afterHolds = applyMothershipHolds(
    player,
    state.definitions,
    commandInstanceIds.filter((id) => !selfHolds.includes(id)),
    kind,
  );
  if (!afterHolds) return null;
  return { ...state, players: { ...state.players, [playerId]: afterHolds } };
}

function mothershipPaymentMaterialIds(pending: PendingCommandPayment): string[] {
  const cont = pending.continuation;
  if (cont.type !== "rush") return [];
  return cont.zordMaterialInstanceIds ?? (cont.zordMaterialInstanceId ? [cont.zordMaterialInstanceId] : []);
}

/** 母艦ホールド支払いで必要なホールド数（素材で満たした枠を除く）。 */
function mothershipPaymentHoldsRequired(pending: PendingCommandPayment): number {
  const cont = pending.continuation;
  const materialIds = mothershipPaymentMaterialIds(pending);
  const slotsFilled =
    cont.type === "rush" && cont.zordMaterialInstanceIds && materialIds.length > 0
      ? materialIds.length
      : cont.type === "rush" && cont.zordMaterialInstanceId
        ? zordSlotsFilledByMaterial(pending.sourceCardId, true, cont.zordMaterialDestination === "hold" ? "discard" : cont.zordMaterialDestination)
        : 0;
  return mothershipHoldsRequiredForRush(pending.sourceCardId, slotsFilled);
}

function mothershipPaymentSelfHolds(
  state: GameState,
  pending: PendingCommandPayment,
  kind: NonNullable<ReturnType<typeof canUseMothershipForZordRush>>,
): string[] {
  const cont = pending.continuation;
  if (cont.type !== "rush" || !cont.zordMaterialInstanceIds) return [];
  return mothershipSelfHoldMaterialIds(
    state.players[pending.playerId],
    state.definitions,
    kind,
    cont.zordMaterialInstanceIds,
    cont.zordMaterialDestination,
  );
}

function validateMothershipPaymentHolds(
  state: GameState,
  pending: PendingCommandPayment,
  commandInstanceIds: string[],
): boolean {
  const player = state.players[pending.playerId];
  const kind = canUseMothershipForZordRush(state.definitions, player, pending.sourceCardId);
  if (!kind) return false;
  const holdsRequired = mothershipPaymentHoldsRequired(pending);
  if (commandInstanceIds.length !== holdsRequired) return false;
  const selfHolds = mothershipPaymentSelfHolds(state, pending, kind).filter((id) =>
    commandInstanceIds.includes(id),
  );
  const others = commandInstanceIds.filter((id) => !selfHolds.includes(id));
  return validateMothershipHolds(
    player,
    state.definitions,
    pending.sourceCardId,
    kind,
    others,
    holdsRequired - selfHolds.length,
  );
}

/**
 * 「Sユニット2体をそれぞれ…」の一部を素材で満たしたあとの【母艦】ホールド支払い
 * （faq-card-2 RS-076 Q7・RS-075 Q2）。カテゴリのホールドの後に選ぶ。
 */
export function buildPartialMothershipHoldPayment(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  sourceCardId: string,
  materialInstanceIds: string[],
  materialDestination: ZordMaterialDestination | undefined,
  holdsRequired: number,
): PendingCommandPayment | null {
  const player = state.players[playerId];
  const kind = canUseMothershipForZordRush(state.definitions, player, sourceCardId);
  if (!kind || holdsRequired <= 0) return null;
  const category = kind.commandCategory;
  const validInstanceIds = [
    ...collectMothershipEligibleCommands(player, state.definitions, category).map(
      (e) => e.card.instanceId,
    ),
    ...mothershipSelfHoldMaterialIds(
      player,
      state.definitions,
      kind,
      materialInstanceIds,
      materialDestination,
    ),
  ];
  if (validInstanceIds.length < holdsRequired) return null;
  return {
    playerId,
    kind: "mothership_hold",
    sourceInstanceId,
    sourceCardId,
    eligibleNeeded: 0,
    totalNeeded: holdsRequired,
    validInstanceIds,
    continuation: {
      type: "rush",
      zordMaterialInstanceIds: materialInstanceIds,
      zordMaterialDestination: materialDestination,
    },
  };
}

export function continueAfterMothershipPayment(
  state: GameState,
  pending: PendingCommandPayment,
  commandInstanceIds: string[],
): PendingCommandPayment | null {
  if (pending.continuation.type !== "rush") return null;
  const playerId = pending.playerId;
  // カテゴリのホールドを先に済ませた場合（部分的な母艦の代用）はそのままラッシュする。
  if (isCostWindowSatisfied(state.players[playerId], "rush_category")) return null;
  const def = getDefinition(state.definitions, pending.sourceCardId);
  if (!def || !isRushable(def)) return null;

  const cont = pending.continuation;
  const player = state.players[playerId];
  if (
    canRushUnit(
      player,
      state.definitions,
      def,
      pending.sourceInstanceId,
      cont.zordMaterialInstanceId,
      commandInstanceIds,
      cont.zordMaterialDestination,
      undefined,
      { ...state, playerId },
    )
  ) {
    return null;
  }

  const categories = cardCategories(def);
  return buildCategoryPayment(
    state,
    playerId,
    pending.sourceInstanceId,
    pending.sourceCardId,
    categories,
    {
      type: "rush",
      zordMaterialInstanceId: cont.zordMaterialInstanceId,
      zordMaterialInstanceIds: cont.zordMaterialInstanceIds,
      zordMaterialDestination: cont.zordMaterialDestination,
      zordMothershipHoldInstanceIds: commandInstanceIds,
      zordExtraCommandHoldInstanceIds: cont.zordExtraCommandHoldInstanceIds,
      godomDiscardInstanceIds: cont.godomDiscardInstanceIds,
    },
    false,
  );
}

// ---------------------------------------------------------------------------
// 追加条件「追加で自軍コマンドをNつホールドする」を、ラッシュのコマンド支払いの中で選ぶ
// （RS-627 メガシップ ※「…次のように変更される⇒追加で自軍コマンドを2つホールドする」）。
// 追加分を先に決めた initiate_command_payment（zordExtraCommandHoldInstanceIds）も従来どおり使える。

function extraHoldCombinations<T>(items: T[], count: number): T[][] {
  if (count <= 0) return [[]];
  if (count > items.length) return [];
  const result: T[][] = [];
  for (let i = 0; i <= items.length - count; i += 1) {
    for (const rest of extraHoldCombinations(items.slice(i + 1), count - 1)) {
      result.push([items[i]!, ...rest]);
    }
  }
  return result;
}

/** 追加分を決めずに支払いを始めたとき、追加分も選ぶ支払いを作る。対象外なら undefined、支払えなければ null。 */
function buildExtraHoldInPayment(
  state: GameState,
  playerId: PlayerId,
  action: InitiateCommandPaymentAction,
  card: CardInstance,
  def: CardDefinition,
  categories: Category[],
): PendingCommandPayment | null | undefined {
  if ((action.zordExtraCommandHoldInstanceIds?.length ?? 0) > 0 || action.prismSubstitute) return undefined;
  if (!needsHoldExtraCommand(state.definitions, def.id)) return undefined;
  const count = resolveRushAdditionalCondition(def.id, def)?.unitCount ?? 1;
  const player = state.players[playerId];
  const extras = collectHoldExtraCommandCandidates(player, state.definitions);
  if (extras.length < count) return null;
  // 追加分以外（パワー等）の判定。追加分は仮に候補の先頭を使う（実際の追加分は確定時に選ぶ）。
  if (
    !canRushUnitExceptCommandHold(
      player,
      state.definitions,
      def,
      card.instanceId,
      action.zordMaterialInstanceId,
      action.zordMothershipHoldInstanceIds,
      action.zordMaterialDestination,
      rushPowerBudget(state, playerId, player, def),
      { ...state, playerId },
      action.zordMaterialInstanceIds,
      extras.slice(0, count).map((c) => c.instanceId),
    )
  ) {
    return null;
  }
  const base = buildCategoryPayment(
    state,
    playerId,
    card.instanceId,
    card.cardId,
    categories,
    {
      type: "rush",
      zordMaterialInstanceId: action.zordMaterialInstanceId,
      zordMaterialInstanceIds: action.zordMaterialInstanceIds,
      zordMaterialDestination: action.zordMaterialDestination,
      zordMothershipHoldInstanceIds: action.zordMothershipHoldInstanceIds,
    },
    false,
    { perRushPayment: true },
  );
  if (!base || base.shifuSubstitute) return null;
  const validInstanceIds = [...new Set([...base.validInstanceIds, ...extras.map((c) => c.instanceId)])];
  const totalNeeded = base.totalNeeded + count;
  if (validInstanceIds.length < totalNeeded) return null;
  return { ...base, validInstanceIds, totalNeeded, extraCommandHoldCount: count };
}

/**
 * 追加分も選ぶ支払い（extraCommandHoldCount）の選択を、カテゴリの支払い分と追加分に分ける。
 * 追加分はリリース状態の自軍コマンド（オペレーション）。分けられなければ null。対象外の支払いはそのまま返す。
 */
export function splitExtraHoldPayment(
  state: GameState,
  pending: PendingCommandPayment,
  commandInstanceIds: string[],
): { pending: PendingCommandPayment; ids: string[] } | null {
  const count = pending.extraCommandHoldCount;
  if (!count) return { pending, ids: commandInstanceIds };
  if (pending.continuation.type !== "rush") return null;
  if (new Set(commandInstanceIds).size !== commandInstanceIds.length) return null;
  if (commandInstanceIds.length !== pending.totalNeeded) return null;
  if (commandInstanceIds.some((id) => !pending.validInstanceIds.includes(id))) return null;
  const extras = new Set(
    collectHoldExtraCommandCandidates(state.players[pending.playerId], state.definitions).map((c) => c.instanceId),
  );
  const { extraCommandHoldCount: _omit, ...rest } = pending;
  void _omit;
  const baseCount = pending.totalNeeded - count;
  for (const baseIds of extraHoldCombinations(commandInstanceIds, baseCount)) {
    const extraIds = commandInstanceIds.filter((id) => !baseIds.includes(id));
    if (!extraIds.every((id) => extras.has(id))) continue;
    const basePending: PendingCommandPayment = {
      ...rest,
      totalNeeded: baseCount,
      validInstanceIds: pending.validInstanceIds.filter((id) => !extraIds.includes(id)),
      continuation: { ...pending.continuation, zordExtraCommandHoldInstanceIds: extraIds },
    };
    if (validatePaymentSelection(state, basePending, baseIds) !== null) continue;
    return { pending: basePending, ids: baseIds };
  }
  return null;
}

export function buildPaymentFromInitiateAction(
  state: GameState,
  action: InitiateCommandPaymentAction,
): PendingCommandPayment | null {
  const playerId = action.playerId;

  if (action.kind === "effect_hold") {
    return buildEffectHoldPayment(state);
  }

  const player = state.players[playerId];

  if (action.kind === "battle_entry") {
    if (state.phase !== "battle") return null;
    const found = findInZone(player, "rush", action.sourceInstanceId);
    if (!found) return null;
    return buildBattleEntryPayment(
      state,
      playerId,
      found.card,
      action.rideOff,
    );
  }

  if (action.kind !== "category_use") return null;

  const handFound = findInZone(player, "hand", action.sourceInstanceId);
  if (!handFound) return null;

  const def = getDefinition(state.definitions, handFound.card.cardId);
  if (!def) return null;

  // RS-292【虎の子大秘術】: 手札のオペレーションはどのカテゴリのコマンドをホールドしてもよい。
  const categories = operationPaymentCategories(state, playerId, def);
  if (isRushable(def)) {
    const extraInPayment = buildExtraHoldInPayment(state, playerId, action, handFound.card, def, categories);
    if (extraInPayment !== undefined) return extraInPayment;
    if (
      !canRushUnitExceptCommandHold(
        player,
        state.definitions,
        def,
        handFound.card.instanceId,
        action.zordMaterialInstanceId,
        action.zordMothershipHoldInstanceIds,
        action.zordMaterialDestination,
        rushPowerBudget(state, playerId, player, def),
        { ...state, playerId },
        action.zordMaterialInstanceIds,
        action.zordExtraCommandHoldInstanceIds,
      )
    ) {
      return null;
    }
    const continuation: CommandPaymentContinuation = {
      type: "rush",
      zordMaterialInstanceId: action.zordMaterialInstanceId,
      zordMaterialInstanceIds: action.zordMaterialInstanceIds,
      zordMaterialDestination: action.zordMaterialDestination,
      zordMothershipHoldInstanceIds: action.zordMothershipHoldInstanceIds,
      zordExtraCommandHoldInstanceIds: action.zordExtraCommandHoldInstanceIds,
      godomDiscardInstanceIds: action.godomDiscardInstanceIds,
    };
    return buildCategoryPayment(
      state,
      playerId,
      handFound.card.instanceId,
      handFound.card.cardId,
      categories,
      continuation,
      action.prismSubstitute ?? false,
      { perRushPayment: true, driverCommandInstanceId: action.driverCommandInstanceId },
    );
  }

  if (def.type === "operation") {
    if (!canPlayOperationExceptCommandHold(state, playerId, def)) {
      return null;
    }

    const isCounter =
      getCardEffect(handFound.card.cardId)?.kind === "counter" &&
      isCounterReactionActive(state);
    if (isCounter) {
      if (!canInitiateCounterCategoryPayment(state, playerId, handFound.card.instanceId)) {
        return null;
      }
      const continuation: CommandPaymentContinuation = {
        type: "play_counter",
        substituteInstanceId: action.substituteInstanceId,
      };
      if (action.raiaDiscard) {
        // RK-036 仮面ライダーライア【運命への反抗】: 同じカテゴリのカードを1枚選び、ホールドせずに捨札にする（rules/rk/rk2UnitEffects.ts）。
        const candidates = rk2RaiaDiscardCandidates(player, state.definitions, cardCategories(def));
        if (candidates.length === 0) return null;
        return {
          playerId,
          kind: "category_use",
          sourceInstanceId: handFound.card.instanceId,
          sourceCardId: handFound.card.cardId,
          eligibleNeeded: 0,
          totalNeeded: 1,
          validInstanceIds: candidates,
          categories: cardCategories(def),
          discardInsteadOfHold: true,
          continuation,
        };
      }
      return buildCategoryPayment(
        state,
        playerId,
        handFound.card.instanceId,
        handFound.card.cardId,
        categories,
        continuation,
        action.prismSubstitute ?? false,
        { perRushPayment: true },
      );
    }

    if (needsOperationTarget(handFound.card.cardId)) {
      if (!action.targetInstanceId) {
        // ルール: R-CARD-03 — 対象がないときだけ空撃ちとして対象なしで使用できる。
        const dslEffect = getDslOperationEffect(handFound.card.cardId, "rush");
        const dslChoose =
          dslEffect &&
          shouldUseDslOperation(handFound.card.cardId, dslEffect) &&
          dslOperationOpensChoose(dslEffect);
        // DSL の choose で解決時に対象を選ぶものは、対象なしで支払いを始めてよい。
        if (
          !dslChoose &&
          !operationFizzles(state, playerId, handFound.card.instanceId, handFound.card.cardId)
        ) {
          return null;
        }
      } else if (
        !isValidOperationTarget(
          state,
          playerId,
          handFound.card.cardId,
          action.targetInstanceId,
        )
      ) {
        return null;
      }
    }

    const continuation: CommandPaymentContinuation = {
      type: "play_operation",
      targetInstanceId: action.targetInstanceId,
      extraInstanceId: action.extraInstanceId,
    };
    // ルール: R-CMD-01 — 既にホールド済みのコマンドがあっても、使用ごとに新たにホールドして支払う。
    return buildCategoryPayment(
      state,
      playerId,
      handFound.card.instanceId,
      handFound.card.cardId,
      categories,
      continuation,
      action.prismSubstitute ?? false,
      { perRushPayment: true },
    );
  }

  return null;
}

function isPlayOperationContinuationLegal(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  targetInstanceId?: string,
  extraInstanceId?: string,
): boolean {
  if (state.phase !== "rush") return false;
  const player = state.players[playerId];
  const found = player.hand.find((c) => c.instanceId === sourceInstanceId);
  if (!found) return false;
  const definition = getDefinition(state.definitions, found.cardId);
  if (!definition || definition.type !== "operation") return false;
  if (!canPlayOperation(state, playerId, definition)) return false;
  if (operationFizzles(state, playerId, sourceInstanceId, found.cardId)) {
    // ルール: R-CARD-03, R-RES-04 — 空撃ち（対象なし）での使用のみ。
    return !targetInstanceId && !extraInstanceId;
  }

  const dslEffect = getDslOperationEffect(found.cardId, "rush");
  const dslChoose =
    dslEffect &&
    shouldUseDslOperation(found.cardId, dslEffect) &&
    dslOperationOpensChoose(dslEffect);

  if (dslChoose && dslEffect.effects[0]?.type === "choose") {
    const choose = dslEffect.effects[0];
    const targets = collectTargetInstanceIds(
      state,
      playerId,
      choose.valid,
      sourceInstanceId,
      found.cardId,
    );
    if (choose.kind === "optional_deck_draw") {
      if (player.deck.length === 0 && targets.length === 0) return false;
    } else if (targets.length === 0) {
      return false;
    }
    if (targetInstanceId) return targets.includes(targetInstanceId);
    return true;
  }

  if (needsOperationTarget(found.cardId) && !dslChoose) {
    if (!targetInstanceId) return false;
    return collectOperationTargets(state, playerId, found.cardId).includes(targetInstanceId);
  }

  if (extraInstanceId && extraInstanceId !== targetInstanceId) {
    return player.hand.some((c) => c.instanceId === extraInstanceId);
  }

  return true;
}

function previewPaymentResolve(
  state: GameState,
  pending: PendingCommandPayment,
): { state: GameState } | { error: string } | { nextPending: PendingCommandPayment } {
  const ids = pending.validInstanceIds.slice(0, pending.totalNeeded);
  if (ids.length < pending.totalNeeded) return { error: "wrong_count" };
  if (validatePaymentSelection(state, pending, ids) !== null) return { error: "invalid_command" };
  const resolved = applyCommandPaymentResolve(state, pending.playerId, pending, ids);
  if ("error" in resolved) return resolved;
  if (resolved.nextPending) return { nextPending: resolved.nextPending };
  return { state: resolved.state };
}

export function isInitiateCommandPaymentLegal(
  state: GameState,
  action: InitiateCommandPaymentAction,
): boolean {
  if (state.pendingCommandPayment || state.pendingZordSetup) return false;
  if (state.winner) return false;
  if (action.kind === "effect_hold") {
    return state.pendingEffectChoice !== undefined && buildEffectHoldPayment(state) !== null;
  }
  let pending = buildPaymentFromInitiateAction(state, action);
  if (!pending) return false;
  if (pending.extraCommandHoldCount) {
    // 追加分も選ぶ支払い（RS-627）: 先頭の選び方で分けて確認する。
    const split = splitExtraHoldPayment(state, pending, pending.validInstanceIds.slice(0, pending.totalNeeded));
    if (!split) return false;
    pending = split.pending;
  }

  const preview = previewPaymentResolve(state, pending);
  if ("error" in preview) return false;
  const cont = pending.continuation;
  if ("nextPending" in preview) {
    if (cont.type !== "rush") return true;
    return true;
  }
  if (cont.type === "rush") {
    if (
      !canCompleteRushAfterCommandPayment(
        preview.state,
        pending.playerId,
        pending.sourceInstanceId,
        {
          zordMaterialInstanceId: cont.zordMaterialInstanceId,
          zordMaterialInstanceIds: cont.zordMaterialInstanceIds,
          zordMothershipHoldInstanceIds: cont.zordMothershipHoldInstanceIds,
          zordExtraCommandHoldInstanceIds: cont.zordExtraCommandHoldInstanceIds,
          zordMaterialDestination: cont.zordMaterialDestination,
        },
      )
    ) {
      return false;
    }
  } else if (cont.type === "play_operation") {
    if (
      !isPlayOperationContinuationLegal(
        preview.state,
        pending.playerId,
        pending.sourceInstanceId,
        cont.targetInstanceId,
        cont.extraInstanceId,
      )
    ) {
      return false;
    }
  }

  if (action.kind === "category_use" && state.phase === "rush") {
    const player = state.players[action.playerId];
    const handFound = findInZone(player, "hand", action.sourceInstanceId);
    if (handFound) {
      const def = getDefinition(state.definitions, handFound.card.cardId);
      if (
        def &&
        isUnit(def) &&
        needsZordMaterial(state.definitions, handFound.card.cardId) &&
        !requiresAllFusionPartners(handFound.card.cardId) &&
        // 合法手の列挙では素材の組み合わせごとに呼ばれるので、列挙の判定（legalActions.ts）と結果を共有する。
        memoizeInEnumeration(state, `zord:${action.playerId}:${action.sourceInstanceId}`, () =>
          canBeginZordSetup(state, action.playerId, action.sourceInstanceId),
        )
      ) {
        return false;
      }
    }
  }

  if (action.kind === "category_use" && state.phase !== "rush") {
    const handFound = findInZone(state.players[action.playerId], "hand", action.sourceInstanceId);
    const isCounterPayment =
      !!handFound &&
      getCardEffect(handFound.card.cardId)?.kind === "counter" &&
      isCounterReactionActive(state);
    if (!isCounterPayment) return false;
  }
  if (action.kind === "battle_entry" && state.phase !== "battle") return false;

  return true;
}

export function isResolveCommandPaymentLegal(
  state: GameState,
  rawAction: { playerId: PlayerId; commandInstanceIds: string[] },
): boolean {
  const rawPending = state.pendingCommandPayment;
  if (!rawPending || rawPending.playerId !== rawAction.playerId) return false;
  // 追加分も選ぶ支払い（RS-627）は、カテゴリの支払い分と追加分に分けて判定する。
  const split = splitExtraHoldPayment(state, rawPending, rawAction.commandInstanceIds);
  if (!split) return false;
  const pending = split.pending;
  const action = { ...rawAction, commandInstanceIds: split.ids };
  if (validatePaymentSelection(state, pending, action.commandInstanceIds) !== null) {
    return false;
  }

  const resolved = applyCommandPaymentResolve(
    state,
    pending.playerId,
    pending,
    action.commandInstanceIds,
  );
  if ("error" in resolved) return false;
  if (resolved.nextPending) return true;

  const cont = pending.continuation;
  // 支払いの後に続く move_to_battle が出せないなら、支払いも確定できない（applyAction の move_to_battle と同じ判定）。
  if (cont.type === "move_to_battle" && !cont.rideOff) {
    const unit = resolved.state.players[pending.playerId].rush.find(
      (c) => c.instanceId === pending.sourceInstanceId,
    );
    if (unit && !canMoveUnitToBattle(resolved.state, pending.playerId, unit, "rush")) return false;
  }
  if (cont.type === "play_operation") {
    return isPlayOperationContinuationLegal(
      resolved.state,
      pending.playerId,
      pending.sourceInstanceId,
      cont.targetInstanceId,
      cont.extraInstanceId,
    );
  }
  if (cont.type !== "rush") return true;

  const def = getDefinition(resolved.state.definitions, pending.sourceCardId);
  if (!def || !isRushable(def)) return false;

  const holdIds =
    pending.kind === "mothership_hold"
      ? action.commandInstanceIds
      : cont.zordMothershipHoldInstanceIds;

  return canCompleteRushAfterCommandPayment(
    resolved.state,
    pending.playerId,
    pending.sourceInstanceId,
    {
      zordMaterialInstanceId: cont.zordMaterialInstanceId,
      zordMaterialInstanceIds: cont.zordMaterialInstanceIds,
      zordMothershipHoldInstanceIds: holdIds,
      zordExtraCommandHoldInstanceIds: cont.zordExtraCommandHoldInstanceIds,
      zordMaterialDestination: cont.zordMaterialDestination,
    },
  );
}

/** 手札ユニットをラッシュできない理由（人間が読める形式）。 */
export function explainCannotRush(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): string | null {
  if (state.phase !== "rush") {
    return "ラッシュフェイズではありません。";
  }

  const player = state.players[playerId];
  const found = player.hand.find((c) => c.instanceId === instanceId);
  if (!found) return null;

  const def = getDefinition(state.definitions, found.cardId);
  if (!def || !isRushable(def)) {
    return "このカードはラッシュできません。";
  }

  const categories = cardCategories(def);
  if (
    categories.length === 0 &&
    canRushUnitExceptCommandHold(
      player,
      state.definitions,
      def,
      instanceId,
      undefined,
      undefined,
      undefined,
      undefined,
      { ...state, playerId },
    )
  ) {
    return null;
  }
  if (
    isShironLightRushTarget(player, instanceId) &&
    canRushUnitExceptCommandHold(
      player,
      state.definitions,
      def,
      instanceId,
      undefined,
      undefined,
      undefined,
      undefined,
      { ...state, playerId },
    )
  ) {
    return null;
  }
  if (
    isCostWindowSatisfied(player, "rush_category") &&
    canRushUnitExceptCommandHold(
      player,
      state.definitions,
      def,
      instanceId,
      undefined,
      undefined,
      undefined,
      undefined,
      { ...state, playerId },
    )
  ) {
    return null;
  }

  const unitName = def.name;
  const cost = parsePowerCost(def.powerCost);
  const available = countAvailablePower(state, playerId);
  const effectiveCost = effectivePowerCost(state, playerId, cost);
  if (available < effectiveCost) {
    return `「${unitName}」をラッシュするにはパワー${effectiveCost}枚が必要です（現在${available}枚）。`;
  }

  const catLabel = formatCategories(categories);
  if (
    categories.length > 0 &&
    !canPayRushCategoryHold(player, state.definitions, categories) &&
    !shifuSubstituteAvailable(state, playerId, categories)
  ) {
    return `「${unitName}」をラッシュするには${catLabel}のリリース状態のコマンドが必要ですが、ありません。`;
  }

  if (needsZordMaterial(state.definitions, def.id)) {
    if (requiresAllFusionPartners(def.id)) {
      if (
        !hasAllRequiredFusionMaterials(
          player,
          state.definitions,
          def.id,
          instanceId,
        )
      ) {
        return `「${unitName}」をラッシュするには、必要な合体ユニットが揃っていません。`;
      }
    } else if (
      !canBeginZordSetup(state, playerId, instanceId) &&
      !hasLegalZordRush(state, playerId, instanceId)
    ) {
      return `「${unitName}」のゾード条件（素材または母艦の支払い）を満たしていません。`;
    }
  }

  if (needsHoldExtraCommand(state.definitions, def.id)) {
    const extraCandidates = collectHoldExtraCommandCandidates(player, state.definitions);
    if (extraCandidates.length === 0) {
      return `「${unitName}」をラッシュするには、追加でホールドできるリリース状態の自軍コマンドが必要です。`;
    }
    const condition = resolveRushAdditionalCondition(def.id, def);
    if (condition?.text) {
      return `「${unitName}」をラッシュするには、${condition.text}必要があります。`;
    }
  }

  if (
    categories.length > 0 &&
    !isCostWindowSatisfied(player, "rush_category") &&
    getCategoryPaymentOptions(state, playerId, categories, {
      perRushPayment: true,
      callLeadKind: "call",
    })
  ) {
    return null;
  }

  if (
    categories.length > 0 &&
    !hasCommandForCardUse(player, state.definitions, categories, "call")
  ) {
    const payment = getCategoryPaymentOptions(state, playerId, categories, {
      perRushPayment: true,
      callLeadKind: "call",
    });
    if (payment?.prismAvailable) {
      return `「${unitName}」をラッシュするには、リリース中の${catLabel}コマンドを1枚ホールドするか、【プリズムパワー】でリリース2枚をホールドしてください。`;
    }
    return `「${unitName}」をラッシュするには、リリース中の${catLabel}コマンドを1枚ホールドしてください。`;
  }

  return `「${unitName}」は今ラッシュできません。`;
}
