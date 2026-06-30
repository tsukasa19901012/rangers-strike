import type { ComboNumber } from "@rangers-strike/cards";
import {
  getJointLEffect,
  getJointREffect,
  matchesJointLPartnerById,
  matchesJointRPartnerById,
  partnerCategoryMatches,
  getUnitEffectBlock,
} from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";
import { updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { tryResolveDslTriggeredEffects } from "../dsl/triggerResolver";
import {
  getLegend3JointLEffect,
  getLegend3JointREffect,
  resolveLegend3JointCombo,
  resolveLegend3JointComboR,
} from "./legend3/jointComboEffects";
import { grantSp1OnPlayer, grantSpOverrideOnPlayer, patchPlayer } from "./playerPatches";
import type { ComboOutcome } from "./comboTypes";

/** wiki p266 / combo-number: ナンバー L または R はジョイントコンビネーション。 */
export function isJointComboNumber(
  comboNumber: ComboNumber | undefined,
): comboNumber is "L" | "R" {
  return comboNumber === "L" || comboNumber === "R";
}

/** wiki p266 既定: L サイズ。カードテキストで S 等に上書き可能（RK-147 等）。 */
export function isJointLSizeAnchor(
  definitions: GameState["definitions"],
  card: CardInstance,
): boolean {
  const def = getDefinition(definitions, card.cardId);
  return def?.size === "L";
}

function isJointLPartnerMatch(
  definitions: GameState["definitions"],
  anchor: CardInstance,
  partner: CardInstance,
): boolean {
  const anchorDef = getDefinition(definitions, anchor.cardId);
  const partnerDef = getDefinition(definitions, partner.cardId);
  if (!anchorDef || !partnerDef) return false;
  return matchesJointLPartnerById(anchor.cardId, anchorDef, partnerDef);
}

function isJointRPartnerMatch(
  definitions: GameState["definitions"],
  rUnit: CardInstance,
  leftPartner: CardInstance,
): boolean {
  const rDef = getDefinition(definitions, rUnit.cardId);
  const partnerDef = getDefinition(definitions, leftPartner.cardId);
  if (!rDef || !partnerDef) return false;
  return matchesJointRPartnerById(rUnit.cardId, rDef, partnerDef);
}

/** @deprecated カテゴリ一致は jointPartnerCategoriesMatch を使用。 */
export function jointPartnerCategoriesMatch(
  definitions: GameState["definitions"],
  left: CardInstance,
  right: CardInstance,
): boolean {
  const leftDef = getDefinition(definitions, left.cardId);
  const rightDef = getDefinition(definitions, right.cardId);
  if (!leftDef || !rightDef) return false;
  return partnerCategoryMatches(leftDef.category, rightDef.category);
}

export type JointComboTrigger =
  | { kind: "joint_l"; lIndex: number; partnerIndex: number }
  | { kind: "joint_r"; rIndex: number; partnerIndex: number };

/**
 * wiki RS-393 / RS-172: JC は自軍ユニットがバトルに出て並びが確定したときのみ評価。
 * 進入ユニットが関与する L/R ペアだけを返す（無関係な進入で既存 JC を再発動しない）。
 */
export function findJointComboTriggersOnEnter(
  battle: CardInstance[],
  definitions: GameState["definitions"],
  enterIndex: number,
): JointComboTrigger[] {
  const triggers: JointComboTrigger[] = [];
  const entering = battle[enterIndex];
  if (!entering) return triggers;

  const enteringDef = getDefinition(definitions, entering.cardId);
  if (!enteringDef) return triggers;

  if (enteringDef.comboNumber === "L") {
    const partner = battle[enterIndex + 1];
    if (partner && isJointLPartnerMatch(definitions, entering, partner)) {
      triggers.push({ kind: "joint_l", lIndex: enterIndex, partnerIndex: enterIndex + 1 });
    }
  }

  if (enteringDef.comboNumber === "R") {
    const partner = battle[enterIndex - 1];
    if (partner && isJointRPartnerMatch(definitions, entering, partner)) {
      triggers.push({ kind: "joint_r", rIndex: enterIndex, partnerIndex: enterIndex - 1 });
    }
  }

  const left = battle[enterIndex - 1];
  const leftDef = left ? getDefinition(definitions, left.cardId) : undefined;
  if (
    left &&
    leftDef?.comboNumber === "L" &&
    isJointLPartnerMatch(definitions, left, entering)
  ) {
    triggers.push({ kind: "joint_l", lIndex: enterIndex - 1, partnerIndex: enterIndex });
  }

  return triggers;
}

function applyJointLPartnerGrants(
  state: GameState,
  playerId: PlayerId,
  lCard: CardInstance,
  partner: CardInstance,
): GameState {
  const block = getUnitEffectBlock(lCard.cardId);
  if (!block) return state;

  let nextState = state;
  for (const named of block.namedEffects) {
    if (
      named.effectId === "redomu" ||
      (/このユニットからコンビネーションする/.test(named.text) &&
        /自軍ターン中、「SP1」になる/.test(named.text))
    ) {
      nextState = patchPlayer(nextState, playerId, (player) =>
        grantSpOverrideOnPlayer(player, partner.instanceId, 1, "battle"),
      );
      break;
    }
  }
  return nextState;
}

function applyJointLTrigger(
  state: GameState,
  playerId: PlayerId,
  battle: CardInstance[],
  trigger: Extract<JointComboTrigger, { kind: "joint_l" }>,
): ComboOutcome {
  const lCard = battle[trigger.lIndex]!;
  const partner = battle[trigger.partnerIndex]!;
  const logs: string[] = [];
  let nextState = state;
  let nextPlayer = state.players[playerId];

  const jointEffect = getJointLEffect(lCard.cardId);
  if (jointEffect === "grant_sp1_to_partner") {
    nextPlayer = grantSp1OnPlayer(nextPlayer, partner.instanceId);
    logs.push(
      buildLogEntry(
        playerId,
        "joint_combo_l",
        lCard.cardId,
        state.definitions,
        partner.cardId,
      ),
    );
  }

  const legend3L = getLegend3JointLEffect(lCard.cardId);
  if (legend3L) {
    if (logs.length > 0) {
      nextState = { ...nextState, ...updatePlayer(nextState, playerId, nextPlayer) };
      nextPlayer = nextState.players[playerId];
    }
    const result = resolveLegend3JointCombo(
      nextState,
      playerId,
      lCard.cardId,
      legend3L,
      partner.instanceId,
    );
    nextState = result.state;
    logs.push(...result.logs);
  }

  const dsl = tryResolveDslTriggeredEffects({
    state: nextState,
    cardId: lCard.cardId,
    instanceId: lCard.instanceId,
    playerId,
    phasePlayerId: playerId,
    triggerType: "joint_combo_l",
    logAction: "joint_combo_l",
  });
  if (dsl.handled) {
    if (logs.length > 0) {
      nextState = { ...nextState, ...updatePlayer(nextState, playerId, nextPlayer) };
      nextPlayer = nextState.players[playerId];
    }
    nextState = dsl.state;
    logs.push(...dsl.logs);
  }

  if (logs.length > 0) {
    nextState = { ...nextState, ...updatePlayer(nextState, playerId, nextPlayer) };
  }

  const partnerBefore = nextState.players[playerId].battle.find(
    (c) => c.instanceId === partner.instanceId,
  );
  nextState = applyJointLPartnerGrants(nextState, playerId, lCard, partner);
  const partnerAfter = nextState.players[playerId].battle.find(
    (c) => c.instanceId === partner.instanceId,
  );
  if (
    partnerAfter?.spOverride === 1 &&
    partnerBefore?.spOverride !== 1 &&
    !logs.some((entry) => entry.includes("joint_combo_l"))
  ) {
    logs.push(
      buildLogEntry(
        playerId,
        "joint_combo_l",
        lCard.cardId,
        state.definitions,
        partner.cardId,
      ),
    );
  }

  return { state: nextState, logs };
}

function applyJointRTrigger(
  state: GameState,
  playerId: PlayerId,
  battle: CardInstance[],
  trigger: Extract<JointComboTrigger, { kind: "joint_r" }>,
): ComboOutcome {
  const rCard = battle[trigger.rIndex]!;
  const logs: string[] = [];
  let nextState = state;
  let nextPlayer = state.players[playerId];

  const jointEffect = getJointREffect(rCard.cardId);
  if (jointEffect === "grant_sp1") {
    nextPlayer = grantSp1OnPlayer(nextPlayer, rCard.instanceId);
    logs.push(
      buildLogEntry(
        playerId,
        "joint_combo_r",
        rCard.cardId,
        state.definitions,
        "sp1",
      ),
    );
  }

  const legend3R = getLegend3JointREffect(rCard.cardId);
  if (legend3R) {
    if (logs.length > 0) {
      nextState = { ...nextState, ...updatePlayer(nextState, playerId, nextPlayer) };
      nextPlayer = nextState.players[playerId];
    }
    const result = resolveLegend3JointComboR(
      nextState,
      playerId,
      rCard.cardId,
      legend3R,
      playerId,
    );
    nextState = result.state;
    logs.push(...result.logs);
  }

  const dsl = tryResolveDslTriggeredEffects({
    state: nextState,
    cardId: rCard.cardId,
    instanceId: rCard.instanceId,
    playerId,
    phasePlayerId: playerId,
    triggerType: "joint_combo_r",
    logAction: "joint_combo_r",
  });
  if (dsl.handled) {
    if (logs.length > 0) {
      nextState = { ...nextState, ...updatePlayer(nextState, playerId, nextPlayer) };
      nextPlayer = nextState.players[playerId];
    }
    nextState = dsl.state;
    logs.push(...dsl.logs);
  }

  if (logs.length > 0) {
    nextState = { ...nextState, ...updatePlayer(nextState, playerId, nextPlayer) };
  }

  return { state: nextState, logs };
}

/** enter_battle の tail（NC 後）で、進入ユニットに関係する JC のみ解決。 */
export function resolveJointCombosOnEnter(
  state: GameState,
  playerId: PlayerId,
  enteringInstanceId: string,
): ComboOutcome {
  const player = state.players[playerId];
  const enterIndex = player.battle.findIndex((c) => c.instanceId === enteringInstanceId);
  if (enterIndex < 0) {
    return { state, logs: [] };
  }

  const triggers = findJointComboTriggersOnEnter(
    player.battle,
    state.definitions,
    enterIndex,
  );
  if (triggers.length === 0) {
    return { state, logs: [] };
  }

  let nextState = state;
  const logs: string[] = [];

  for (const trigger of triggers) {
    const battle = nextState.players[playerId].battle;
    const result =
      trigger.kind === "joint_l"
        ? applyJointLTrigger(nextState, playerId, battle, trigger)
        : applyJointRTrigger(nextState, playerId, battle, trigger);
    nextState = result.state;
    logs.push(...result.logs);
  }

  return { state: nextState, logs };
}
