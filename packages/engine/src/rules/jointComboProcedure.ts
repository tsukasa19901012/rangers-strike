import type { CardDefinition, Category, ComboNumber } from "@rangers-strike/cards";
import {
  getJointLNamedEffect,
  getJointRNamedEffect,
  getJointLEffect,
  getJointREffect,
  matchesJointLPartnerById,
  matchesJointRPartnerById,
  partnerCategoryMatches,
  getUnitEffectBlock,
} from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getDefinition, unitEffectiveCategories, unitSizeOf } from "../core/catalog";
import { updatePlayer } from "../core/helpers";
import { crossReducedNumber, crossReductionFor } from "../keywords/battleKeywords";
import { buildLogEntry } from "../log/formatLog";
import { tryResolveDslTriggeredEffects } from "../dsl/triggerResolver";
import { listDslEffectsForTrigger } from "../dsl/effectLookup";
import {
  getLegend3JointLEffect,
  getLegend3JointREffect,
  resolveLegend3JointCombo,
  resolveLegend3JointComboR,
} from "./legend3/jointComboEffects";
import { grantSp1OnPlayer, grantSpOverrideOnPlayer, patchPlayer } from "./playerPatches";
import type { ComboOutcome } from "./comboTypes";
import { addJointComboGrant } from "./jointComboGrants";
import { openOptionalEffectConfirm, registerOptionalEffect } from "./optionalEffects";
import { trySet9CJointR } from "./legend1/set9NamedEffectsC";

/** カードの効果を判定するときのカテゴリ（バトルエリアで追加されるカテゴリを含む。RS-166 ガインガイン）。 */
export type JointCategoriesOf = (card: CardInstance) => Category[] | undefined;

function definitionWithCategories(
  definitions: GameState["definitions"],
  card: CardInstance,
  categoriesOf: JointCategoriesOf | undefined,
): CardDefinition | undefined {
  const def = getDefinition(definitions, card.cardId);
  if (!def || !categoriesOf) return def;
  const categories = categoriesOf(card);
  if (!categories || categories.length === 0) return def;
  return { ...def, category: categories.length === 1 ? categories[0]! : categories } as CardDefinition;
}

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
  // RK-013 Jパワー・RS-255 巨大化爆弾を重ねたユニットも L（core/catalog.ts unitSizeOf）。
  return unitSizeOf(definitions, card) === "L";
}

/**
 * 並びの中の分数 SP（クロスで分母が減ったもの。R-KW-CROSS-01）。RK-147 デンライナーイスルギ「SP1/4のSユニット」は、クロスで
 * SP1/5 から SP1/4 になったユニットを含み、SP1/4 から SP1/3 になったユニットを含まない（atwiki/page-673 コメント欄）。
 */
function withCrossAdjustedSp(def: CardDefinition, battle: CardInstance[] | undefined, partner: CardInstance): CardDefinition {
  if (!battle || typeof def.sp !== "string") return def;
  const m = def.sp.match(/^1\/(\d+)$/);
  if (!m) return def;
  const reduction = crossReductionFor(battle, partner.instanceId);
  if (reduction <= 0) return def;
  return { ...def, sp: `1/${crossReducedNumber(Number(m[1]), reduction)}` as CardDefinition["sp"] };
}

function isJointLPartnerMatch(
  definitions: GameState["definitions"],
  anchor: CardInstance,
  partner: CardInstance,
  categoriesOf?: JointCategoriesOf,
  battle?: CardInstance[],
): boolean {
  const anchorDef = definitionWithCategories(definitions, anchor, categoriesOf);
  const partnerDef = definitionWithCategories(definitions, partner, categoriesOf);
  if (!anchorDef || !partnerDef) return false;
  return matchesJointLPartnerById(anchor.cardId, anchorDef, withCrossAdjustedSp(partnerDef, battle, partner));
}

function isJointRPartnerMatch(
  definitions: GameState["definitions"],
  rUnit: CardInstance,
  leftPartner: CardInstance,
  categoriesOf?: JointCategoriesOf,
): boolean {
  const rDef = definitionWithCategories(definitions, rUnit, categoriesOf);
  const partnerDef = definitionWithCategories(definitions, leftPartner, categoriesOf);
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
  categoriesOf?: JointCategoriesOf,
): JointComboTrigger[] {
  const triggers: JointComboTrigger[] = [];
  const entering = battle[enterIndex];
  if (!entering) return triggers;

  const enteringDef = getDefinition(definitions, entering.cardId);
  if (!enteringDef) return triggers;

  if (enteringDef.comboNumber === "L") {
    const partner = battle[enterIndex + 1];
    if (partner && isJointLPartnerMatch(definitions, entering, partner, categoriesOf, battle)) {
      triggers.push({ kind: "joint_l", lIndex: enterIndex, partnerIndex: enterIndex + 1 });
    }
  }

  // ルール: R-BA（05 §並び順）— ビークルにライドしたまま出たユニットは、ビークルと合わせて1つの並び順を占める。
  // 左隣の並びは、自分が乗っているビークルのさらに左。
  const leftIndex =
    entering.mountedOnInstanceId !== undefined &&
    battle[enterIndex - 1]?.instanceId === entering.mountedOnInstanceId
      ? enterIndex - 2
      : enterIndex - 1;

  if (enteringDef.comboNumber === "R") {
    const partner = battle[leftIndex];
    if (partner && isJointRPartnerMatch(definitions, entering, partner, categoriesOf)) {
      triggers.push({ kind: "joint_r", rIndex: enterIndex, partnerIndex: leftIndex });
    }
  }

  const left = battle[leftIndex];
  const leftDef = left ? getDefinition(definitions, left.cardId) : undefined;
  if (
    left &&
    leftDef?.comboNumber === "L" &&
    isJointLPartnerMatch(definitions, left, entering, categoriesOf, battle)
  ) {
    triggers.push({ kind: "joint_l", lIndex: leftIndex, partnerIndex: enterIndex });
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

/** L ナンバーのカードの「このユニットからコンビネーションする…は、次の能力を得る⇒…」の効果。 */
function jointLGrantingEffect(cardId: string) {
  const joint = getJointLNamedEffect(cardId);
  if (joint && /次の能力を得る/.test(joint.text)) return joint;
  return getUnitEffectBlock(cardId)?.namedEffects.find((named) =>
    /この(?:ユニット|ビークル)からコンビネーションする.*次の能力を得る/.test(named.text),
  );
}

/** R ナンバーのカードの「次の効果を発動できる⇒このコンビネーションが成立している間、…」の効果。 */
function jointRWhileEstablishedEffect(cardId: string) {
  const joint = getJointRNamedEffect(cardId);
  if (joint && /このコンビネーションが成立している間/.test(joint.text)) return joint;
  return undefined;
}

/** 任意確認で「発動する」を選んだとき、R ナンバーのカードに効果を記録する。effectId はカードの効果 id。 */
const jointRWhileEstablishedHandler = {
  apply: (state: GameState, pending: { playerId: PlayerId; sourceCardId: string; sourceInstanceId?: string; effectId: string }) => {
    const rId = pending.sourceInstanceId;
    if (!rId) return state;
    const battle = state.players[pending.playerId].battle;
    const index = battle.findIndex((c) => c.instanceId === rId);
    const left = index > 0 ? battle[index - 1] : undefined;
    if (!left) return state;
    return addJointComboGrant(state, pending.playerId, rId, {
      kind: "r",
      effectId: pending.effectId,
      sourceCardId: pending.sourceCardId,
      partnerInstanceId: left.instanceId,
    });
  },
};

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
    nextPlayer = nextState.players[playerId];
    logs.push(...result.logs);
  }

  // 「…コンビネーションするLユニットは、次の能力を得る⇒…」は下の addJointComboGrant で能力として付与する。
  // その DSL スタブ（例: RS-171 の deal_damage）を成立時に即時解決すると、条件（撃破したなら等）を
  // 無視したダメージになるため、付与型の効果だけのカードでは DSL を解決しない。
  const grantOnlyDsl =
    jointLGrantingEffect(lCard.cardId) !== undefined &&
    listDslEffectsForTrigger(lCard.cardId, "joint_combo_l").every((effect) =>
      effect.effects.every((p) => p.type === "deal_damage"),
    );
  const dsl = grantOnlyDsl
    ? { state: nextState, logs: [] as string[], handled: false }
    : tryResolveDslTriggeredEffects({
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
  const grantEffect = jointLGrantingEffect(lCard.cardId);
  if (grantEffect) {
    nextState = addJointComboGrant(nextState, playerId, partner.instanceId, {
      kind: "l",
      effectId: grantEffect.effectId,
      sourceCardId: lCard.cardId,
      partnerInstanceId: lCard.instanceId,
    });
    if (!logs.some((entry) => entry.includes("joint_combo_l"))) {
      logs.push(
        buildLogEntry(playerId, "joint_combo_l", lCard.cardId, state.definitions, partner.cardId),
      );
    }
  }
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
  // NC の欄に分類された R ナンバーの効果（RS-651【体当たり】・RS-652【清輝顕現バブルキャプチャー】。rules/legend1/set9NamedEffectsC.ts）。
  const fallback = trySet9CJointR(state, playerId, rCard);
  if (fallback) return fallback;
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

  // 「次の効果を発動できる⇒このコンビネーションが成立している間、…」（RS-158【エレファントシールド】、
  // RS-172【ショベルディフェンス】等）は任意。発動したら R ナンバーのカードに記録する（R-CN-06）。
  const whileEstablished = jointRWhileEstablishedEffect(rCard.cardId);
  if (whileEstablished) {
    if (logs.length > 0) {
      nextState = { ...nextState, ...updatePlayer(nextState, playerId, nextPlayer) };
    }
    logs.push(
      buildLogEntry(playerId, "joint_combo_r", rCard.cardId, state.definitions, whileEstablished.effectId),
    );
    registerOptionalEffect(whileEstablished.effectId, jointRWhileEstablishedHandler);
    const withConfirm = openOptionalEffectConfirm(nextState, {
      playerId,
      effectId: whileEstablished.effectId,
      sourceCardId: rCard.cardId,
      sourceInstanceId: rCard.instanceId,
      phasePlayerId: playerId,
    });
    return { state: withConfirm, logs };
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
    (c) => unitEffectiveCategories(state, playerId, c, "battle"),
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
