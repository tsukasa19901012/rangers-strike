/**
 * クロスギャザー ザ・ファーストエンカウント XG1-041〜XG1-060（仮面ライダーアマゾン〜コーカサスビートルアンデッド）のカード固有の効果
 * （cardSpec XG1-041-060 の監査）。
 *
 * - DSL の `xg1::XG1-NNN::name` から呼ばれる効果（RC・ラッシュしたとき・バトルエリアに出たとき・オペレーション）。
 * - フックから呼ぶもの:
 *   - `xg1cAfterBattle`: XG1-042【吸血】・XG1-053【バーニングライダーパンチ】（rules/xg1/xg1aEffects.ts xg1aAfterBattle から）。
 *   - `xg1cOnAttackDeclared`: XG1-045【墨攻撃】（core/applyAction.ts の attack）。
 *   - `xg1cOnMorphSwap`: XG1-046【Vジェット】（keywords/morphReaction.ts）。
 *   - `openXg1cMantisOnEnemyRush`: XG1-055【血に飢えた予言者】（rules/onRushUnitEffects.ts applyPassiveRushTriggers）。
 *   - `xg1cBlackFangOnRide`: XG1-057【衝撃波】（core/applyAction.ts の mount_ride）。
 *   - `xg1cBattleToRush`: XG1-060【カード強奪】（rules/startPhase.ts continueBattleToRushEffectQueue）。
 *   - `collectXg1TurnEndQueue` / `openXg1TurnEndEntry`: XG1-052【ファイヤーストームアタック】・XG1-053 の撃破（rules/turnEndingEffects.ts）。
 *   - `xg1ForcedAttackFilter`: XG1-053 の「可能なら追加でアタックする」（core/legalActions.ts getLegalActions）。
 * 継続効果（XG1-043 のアタック先・XG1-044 のコマンドゾーンから出す・XG1-045 の特徴・XG1-058 の BP）は rules/xg1/xg1Fields.ts。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { GameAction } from "../../types/actions";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import { cardCategories, effectiveBp, effectiveCommandCategories, getDefinition } from "../../core/catalog";
import { drawOne, opponent } from "../../core/helpers";
import { shuffleCards } from "../../core/deckShuffle";
import type { GrantKeywordContext } from "../../dsl/grantKeyword";
import { cardNotSelectableByOpponent } from "../../keywords/effectTargetability";
import { unitFeatures } from "../addedFeatures";
import { moveToExile } from "../exile";
import { hasBakiBakiExtraAttackOnly } from "../legend3/destroyEffects";
import { patchPlayer } from "../playerPatches";
import { openEffectChoice } from "../pendingChoices";
import { rk1IsSmallNow } from "../rk/rk1Features";
import { RK12_UNIT_HELD_RULE, rk12TurnPayloads } from "../rk/rk12Fields";
import { grantSp1ToRushUnit } from "../srEffects";
import { addBakiBakiExtraAttack } from "../turnModifierBridge";
import { strikeDamageFor } from "../combo";
import {
  type BaseCtx,
  base,
  close,
  ctxBase,
  destroyAll,
  fieldUnits,
  findField,
  logFor,
  moveFieldUnit,
  openAfter,
  openNext,
  pendingBase,
  printedBp,
  proceed,
  selectableEnemy,
  simpleSkip,
  stripForZone,
  zoneOfField,
} from "../rm/rm1Effects";
import { returnBattleUnitToRush } from "./xg1aEffects";
import { XG1_KEYWORDS, XG1_RESOLVERS, XG1_SKIPPERS, noop } from "./xg1Core";
import {
  commandHasRoom,
  costNumber,
  enemySUnits,
  fieldUnitToCommandReleased,
  holdThen,
  isUnitDef,
  printedFeatures,
  registerHold,
  releasedCommands,
  residentZoneCards,
  unitCatsNow,
} from "./xg1Shared";

function pickOne(ctx: BaseCtx, sourceCardId: string, effectId: string, ids: string[], optional: boolean, extra: Partial<PendingEffectChoice> = {}): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "select_unit", validInstanceIds: ids, selectCount: 1, optional, ...extra };
}

function confirmOptions(ctx: BaseCtx, sourceCardId: string, effectId: string, options: string[], optional: boolean, extra: Partial<PendingEffectChoice> = {}): PendingEffectChoice {
  return { ...base(ctx, sourceCardId), effectId, kind: "confirm", validInstanceIds: options, selectCount: 1, optional, ...extra };
}

function isSUnitCard(state: Pick<GameState, "definitions">, cardId: string): boolean {
  const d = getDefinition(state.definitions, cardId);
  return d?.type === "unit" && d.size === "S";
}

/** 場（ラッシュエリア・バトルエリア）のカードを持ち主ごとに探す。 */
function ownerOfField(state: GameState, instanceId: string): PlayerId | null {
  for (const pid of ["player1", "player2"] as const) if (zoneOfField(state, pid, instanceId)) return pid;
  return null;
}

// ---------------------------------------------------------------------------
// XG1-041 仮面ライダーアマゾン【ガガの腕輪】（RC）「これをリリースする。」（atwiki/page-1543）

XG1_KEYWORDS["XG1-041::gaga"] = (state, ctx) => {
  const id = ctx.triggerSourceInstanceId;
  if (!id || !findField(state, ctx.playerId, id)?.commandHeld) return { state, detail: "xg1_041:not_held" };
  const next = patchPlayer(state, ctx.playerId, (p) => {
    const release = (c: CardInstance): CardInstance => (c.instanceId === id ? { ...c, commandHeld: false } : c);
    return { ...p, rush: p.rush.map(release), battle: p.battle.map(release) };
  });
  return { state: next, detail: "xg1_041:release" };
};

// ---------------------------------------------------------------------------
// XG1-042 十面鬼ゴルゴス【吸血】
// 「これが自軍エリアにある間、自軍ターン中、特徴「怪人」を持つ自軍ユニットが、特徴「男」または「女」を持つ敵軍ユニットを撃破したとき、このターン、
//  これは「SP1」になる。」（atwiki/page-1586）。バトルで撃破したとき（アタックしたとき・アタックされたときとも）。特徴はバトルの時点のもの。
// XG1-053 仮面ライダーアギトBF【バーニングライダーパンチ】
// 「これは、アタックしてバトルに勝つたび、可能なら追加でアタックする。ただし、これはバトルを終えるたび、このターン、BP+500され、自分がターンを
//  終えるときBP6000以上なら撃破される。」（atwiki/page-1571）。追加のアタックは RS-167【バキバキパンチ】と同じ記録を使い、
//  アタックできる間はほかの手を選べない（xg1ForcedAttackFilter）。

XG1_KEYWORDS["XG1-042::vampire"] = noop("xg1_042:after_battle");
XG1_KEYWORDS["XG1-053::burning_rider_punch"] = noop("xg1_053:after_battle");

export function xg1cAfterBattle(
  state: GameState,
  pending: { attackerPlayerId: PlayerId; attackerInstanceId: string; defenderPlayerId: PlayerId; defenderInstanceId: string; phasePlayerId: PlayerId; effectBattle?: boolean },
  r: { attacker: CardInstance; defender: CardInstance; defenderOwner: PlayerId; attackerBp: number; defenderBp: number; defenderDestroyed: boolean; attackerDestroyed: boolean },
): ((s: GameState) => GameState) | undefined {
  const steps: Array<(s: GameState) => GameState> = [];
  const sides = [
    { self: r.attacker, selfOwner: pending.attackerPlayerId, enemy: r.defender, enemyOwner: r.defenderOwner, enemyDestroyed: r.defenderDestroyed },
    { self: r.defender, selfOwner: r.defenderOwner, enemy: r.attacker, enemyOwner: pending.attackerPlayerId, enemyDestroyed: r.attackerDestroyed },
  ];
  for (const side of sides) {
    if (side.selfOwner === side.enemyOwner || !side.enemyDestroyed || pending.phasePlayerId !== side.selfOwner) continue;
    if (!unitFeatures(state, side.selfOwner, side.self).includes("怪人")) continue;
    const enemyFeatures = unitFeatures(state, side.enemyOwner, side.enemy);
    if (!enemyFeatures.includes("男") && !enemyFeatures.includes("女")) continue;
    const owner = side.selfOwner;
    steps.push((s) => {
      let next = s;
      for (const c of fieldUnits(next, owner).filter((u) => isSameCardIdentity(u.cardId, "XG1-042"))) {
        next = grantSp1ToRushUnit(next, owner, c.instanceId);
        next = { ...next, log: [...next.log, logFor(next, owner, "XG1-042", `xg1_042_vampire:${c.instanceId}`)] };
      }
      return next;
    });
  }
  for (const [ownerId, card] of [[pending.attackerPlayerId, r.attacker], [r.defenderOwner, r.defender]] as const) {
    if (!isSameCardIdentity(card.cardId, "XG1-053")) continue;
    const won = ownerId === pending.attackerPlayerId && !pending.effectBattle && r.defenderDestroyed && !r.attackerDestroyed;
    steps.push((s) => {
      if (!zoneOfField(s, ownerId, card.instanceId)) return s;
      let next = patchPlayer(s, ownerId, (p) => {
        const plus = (c: CardInstance): CardInstance => (c.instanceId === card.instanceId ? { ...c, bpModifier: (c.bpModifier ?? 0) + 500 } : c);
        return { ...p, battle: p.battle.map(plus), rush: p.rush.map(plus) };
      });
      if (won) next = patchPlayer(next, ownerId, (p) => addBakiBakiExtraAttack(p, card.instanceId));
      return next;
    });
  }
  if (steps.length === 0) return undefined;
  return (s) => steps.reduce((acc, f) => f(acc), s);
}

/** XG1-053: 追加でアタックできる間は、そのユニットのアタックしか選べない（「可能なら追加でアタックする」）。 */
export function xg1ForcedAttackFilter(state: GameState, actions: GameAction[]): GameAction[] {
  if (state.phase !== "battle" || state.pendingEffectChoice) return actions;
  const pid = state.activePlayer;
  const forced = state.players[pid].battle.filter((c) => isSameCardIdentity(c.cardId, "XG1-053") && hasBakiBakiExtraAttackOnly(state, pid, c.instanceId));
  if (forced.length === 0) return actions;
  const ids = new Set(forced.map((c) => c.instanceId));
  const attacks = actions.filter((a) => a.type === "battle" && a.playerId === pid && ids.has(a.attackerInstanceId));
  return attacks.length > 0 ? attacks : actions;
}

// ---------------------------------------------------------------------------
// XG1-043 カメバズーカ【砲撃】（アタック先。rules/xg1/xg1Fields.ts xg1AttackerCanAttackRush）。

XG1_KEYWORDS["XG1-043::hougeki"] = noop("xg1_043:attack_rush_when_held");

// ---------------------------------------------------------------------------
// XG1-044 仮面ライダーV3【V3反転キック】（RC）
// 「敵軍バトルエリアからSユニットを1体選び、持ち主のコマンドゾーンに置いてもよい。置けなければ捨札にする。このとき選んだユニットのSPが1以上だった
//  なら、これはSP1になる。」（atwiki/page-1619）。リリース状態で置く（カード評価）。SP は選んだときのいまの SP。置けなくても SP1 になる（Q1）。
// ※（コマンドゾーンから出す）は rules/xg1/xg1Fields.ts xg1CanDeployFromCommand。

const V3_KICK_EFFECT_ID = "xg1_044_v3_kick";

XG1_KEYWORDS["XG1-044::v3_kick"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = state.players[enemyId].battle.filter((c) => isUnitDef(state, c.cardId) && rk1IsSmallNow(state, c) && selectableEnemy(state, ctx.playerId, "XG1-044", c)).map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg1_044:no_targets" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-044", V3_KICK_EFFECT_ID, ids, true)), detail: V3_KICK_EFFECT_ID };
};

XG1_RESOLVERS[V3_KICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const target = findField(state, enemyId, instanceId);
  if (!target) return { error: "invalid_target" };
  const sp = strikeDamageFor(state.definitions, target, state, enemyId);
  let next = fieldUnitToCommandReleased(close(state, pending), enemyId, instanceId, pending.phasePlayerId);
  if (sp >= 1 && pending.sourceInstanceId) next = grantSp1ToRushUnit(next, playerId, pending.sourceInstanceId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-044", `${V3_KICK_EFFECT_ID}:${instanceId}${sp >= 1 ? ":sp1" : ""}`) };
};
XG1_SKIPPERS[V3_KICK_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG1-045 イカファイア【墨攻撃】
// 「これが自軍バトルエリアにある間、敵軍バトルエリアのユニットは特徴「ブラック」を追加され、次の制限を受ける⇒アタックするとき、バトルの前に自分自身の
//  山札の上から1枚をオモテにする。そして、そのカードの必要パワーの数字が3以下なら、バトルは行われない。その後、オモテにしたカードは山札の下に
//  戻す。」（atwiki/page-1614）。特徴は rules/xg1/xg1Fields.ts。制限はバトルエリアからアタックするとき（ウイングでラッシュエリアからのアタックは除く）。

XG1_KEYWORDS["XG1-045::sumi"] = noop("xg1_045:attack_restriction");

export function xg1cOnAttackDeclared(state: GameState, attackerPlayerId: PlayerId, attackerInstanceId: string, wingFromRush: boolean): { state: GameState; cancel: boolean } {
  if (wingFromRush || !state.players[attackerPlayerId].battle.some((c) => c.instanceId === attackerInstanceId)) return { state, cancel: false };
  const ika = state.players[opponent(attackerPlayerId)].battle.find((c) => isSameCardIdentity(c.cardId, "XG1-045"));
  if (!ika) return { state, cancel: false };
  const top = state.players[attackerPlayerId].deck[0];
  if (!top) return { state, cancel: false };
  const cancel = costNumber(state, top.cardId) <= 3;
  const next = patchPlayer(state, attackerPlayerId, (p) => ({ ...p, deck: [...p.deck.slice(1), top] }));
  return { state: { ...next, log: [...next.log, logFor(next, opponent(attackerPlayerId), "XG1-045", `xg1_045_sumi:${top.cardId}:${cancel ? "no_battle" : "battle"}`)] }, cancel };
}

// ---------------------------------------------------------------------------
// XG1-046 Vマシーン（Vジェット）【Vジェット】
// 「このビークルにライドしているユニットがモーフで置き換えられたとき、このビークルにライドしているユニットをラッシュエリアに戻してもよい。」
// （atwiki/page-1607）。バトルエリアにあるときだけ意味がある。戻すのはライドの組（ユニットとビークル）。

const V_JET_EFFECT_ID = "xg1_046_v_jet";

XG1_KEYWORDS["XG1-046::v_jet"] = noop("xg1_046:on_morph");

export function xg1cOnMorphSwap(state: GameState, ownerId: PlayerId, enteredInstanceId: string, phasePlayerId: PlayerId): GameState {
  const entered = state.players[ownerId].battle.find((c) => c.instanceId === enteredInstanceId);
  if (!entered?.mountedOnInstanceId) return state;
  const vehicle = state.players[ownerId].battle.find((c) => c.instanceId === entered.mountedOnInstanceId);
  if (!vehicle || !isSameCardIdentity(vehicle.cardId, "XG1-046")) return state;
  return openAfter(state, confirmOptions({ playerId: ownerId, phasePlayerId, sourceInstanceId: vehicle.instanceId }, "XG1-046", V_JET_EFFECT_ID, ["accept"], true, { xg1Meta: { target: enteredInstanceId } }));
}

XG1_RESOLVERS[V_JET_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const target = pending.xg1Meta?.target;
  const next = target ? returnBattleUnitToRush(close(state, pending), playerId, target) : close(state, pending);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-046", `${V_JET_EFFECT_ID}:return`) };
};
XG1_SKIPPERS[V_JET_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG1-047 仮面ライダースーパー1【赤心少林拳】（RC）
// 「BP1000またはBP3000またはBP5000の敵軍Sユニットを1体選び、撃破してもよい。また、MAを持つ自軍コマンドを1つホールドしてもよい。そうしたとき、
//  このターン、これはSP1になる。」（atwiki/page-1635）。BP はいまの BP、エリアを問わない。撃破を選ばなくてもコマンドのホールドは選べる。

const SEKISHIN_EFFECT_ID = "xg1_047_sekishin";
const SEKISHIN_HOLD_EFFECT_ID = "xg1_047_sekishin_hold";

function sekishinHoldChoice(state: GameState, ctx: BaseCtx): PendingEffectChoice | null {
  const ids = releasedCommands(state, ctx.playerId, "MA");
  if (ids.length === 0) return null;
  return pickOne(ctx, "XG1-047", SEKISHIN_HOLD_EFFECT_ID, ids, true, { kind: "select_commands" });
}

XG1_KEYWORDS["XG1-047::sekishin"] = (state, ctx) => {
  const c = ctxBase(ctx);
  const ids = enemySUnits(state, ctx.playerId, "XG1-047", (u) => [1000, 3000, 5000].includes(effectiveBp(state, opponent(ctx.playerId), u)));
  if (ids.length > 0) return { state: openAfter(state, pickOne(c, "XG1-047", SEKISHIN_EFFECT_ID, ids, true)), detail: SEKISHIN_EFFECT_ID };
  const hold = sekishinHoldChoice(state, c);
  return hold ? { state: openAfter(state, hold), detail: SEKISHIN_HOLD_EFFECT_ID } : { state, detail: "xg1_047:no_targets" };
};

function afterSekishinDestroy(state: GameState, pending: PendingEffectChoice): GameState {
  const hold = sekishinHoldChoice(state, pendingBase(pending));
  return hold ? openNext(state, pending, hold) : proceed(state, pending);
}

XG1_RESOLVERS[SEKISHIN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG1-047", `${SEKISHIN_EFFECT_ID}_destroy`, [instanceId]);
  return { state: afterSekishinDestroy(next, pending), log: logFor(state, playerId, "XG1-047", `${SEKISHIN_EFFECT_ID}:${instanceId}`) };
};
XG1_SKIPPERS[SEKISHIN_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: afterSekishinDestroy(close(state, pending), pending), log: logFor(state, playerId, "XG1-047", `${SEKISHIN_EFFECT_ID}:skip`) };
};

XG1_RESOLVERS[SEKISHIN_HOLD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = patchPlayer(close(state, pending), playerId, (p) => ({ ...p, command: p.command.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)) }));
  if (pending.sourceInstanceId) next = grantSp1ToRushUnit(next, playerId, pending.sourceInstanceId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-047", `${SEKISHIN_HOLD_EFFECT_ID}:sp1`) };
};
XG1_SKIPPERS[SEKISHIN_HOLD_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG1-049 スカイライダー【セイリングジャンプ】（RC）
// 「敵軍山札の上から1枚をオモテにしてもよい。そうしたとき、オモテにしたカードがSユニットのカードなら持ち主の山札の下に、それ以外なら上に戻す。」
// （atwiki/page-1540）

const SAILING_JUMP_EFFECT_ID = "xg1_049_sailing_jump";

XG1_KEYWORDS["XG1-049::sailing_jump"] = (state, ctx) => {
  if (state.players[opponent(ctx.playerId)].deck.length === 0) return { state, detail: "xg1_049:empty_deck" };
  return { state: openAfter(state, confirmOptions(ctxBase(ctx), "XG1-049", SAILING_JUMP_EFFECT_ID, ["accept"], true)), detail: SAILING_JUMP_EFFECT_ID };
};

XG1_RESOLVERS[SAILING_JUMP_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const top = state.players[enemyId].deck[0];
  let next = close(state, pending);
  const bottom = !!top && isSUnitCard(state, top.cardId);
  if (top && bottom) next = patchPlayer(next, enemyId, (p) => ({ ...p, deck: [...p.deck.slice(1), top] }));
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-049", `${SAILING_JUMP_EFFECT_ID}:${top?.cardId ?? "none"}:${bottom ? "bottom" : "top"}`) };
};
XG1_SKIPPERS[SAILING_JUMP_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG1-050 ライダーシンドローム（オペレーション）
// 「本来の特徴に「仮面ライダー」を持つ自軍ユニットが10体以上あれば、すべての敵軍ユニットを撃破する。9体以下なら、本来の特徴に「仮面ライダー」を
//  持つ自軍ユニットのBPを合計して、その合計以下のBPを持つ敵軍ユニットを1体選び撃破する。」（atwiki/page-1633）
// 自軍ユニットはエリアを問わない。BP はいまの BP。敵軍ユニットはエリア・サイズを問わない（カード評価）。

const RIDER_SYNDROME_EFFECT_ID = "xg1_050_rider_syndrome";

XG1_KEYWORDS["XG1-050::rider_syndrome"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const riders = fieldUnits(state, ctx.playerId).filter((c) => printedFeatures(state, c.cardId).includes("仮面ライダー"));
  if (riders.length >= 10) {
    const all = fieldUnits(state, enemyId).map((c) => c.instanceId);
    return { state: destroyAll(state, ctxBase(ctx), "XG1-050", `${RIDER_SYNDROME_EFFECT_ID}_all`, all), detail: `${RIDER_SYNDROME_EFFECT_ID}:all` };
  }
  const sum = riders.reduce((acc, c) => acc + effectiveBp(state, ctx.playerId, c), 0);
  const ids = fieldUnits(state, enemyId)
    .filter((c) => effectiveBp(state, enemyId, c) <= sum && selectableEnemy(state, ctx.playerId, "XG1-050", c))
    .map((c) => c.instanceId);
  if (ids.length === 0) return { state, detail: "xg1_050:no_targets" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-050", RIDER_SYNDROME_EFFECT_ID, ids, false)), detail: RIDER_SYNDROME_EFFECT_ID };
};

XG1_RESOLVERS[RIDER_SYNDROME_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG1-050", `${RIDER_SYNDROME_EFFECT_ID}_destroy`, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-050", `${RIDER_SYNDROME_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG1-051 仮面ライダーZX【ZXキック】（RC）
// 「敵軍常駐置き場にカードが2枚以上あれば、その中から1枚選んでもよい（ウラ向きのカードはウラ向きのまま選ぶ）。そうしたとき、選んだカードを持ち主の
//  コマンドゾーンにホールド状態で置く。置けなければ捨札にする。」（atwiki/page-1637）
// 常駐置き場のカードは XG1-002 と同じ（常駐に重ねたカードを含む）。常駐を選べば、重ねたカードは捨札になる。

const ZX_KICK_EFFECT_ID = "xg1_051_zx_kick";

XG1_KEYWORDS["XG1-051::zx_kick"] = (state, ctx) => {
  const cards = residentZoneCards(state, opponent(ctx.playerId));
  if (cards.length < 2) return { state, detail: "xg1_051:fewer_than_two" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-051", ZX_KICK_EFFECT_ID, cards.map((e) => e.card.instanceId), true)), detail: ZX_KICK_EFFECT_ID };
};

XG1_RESOLVERS[ZX_KICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const entry = residentZoneCards(state, enemyId).find((e) => e.card.instanceId === instanceId);
  if (!entry) return { error: "invalid_target" };
  const room = commandHasRoom(state, enemyId);
  const placed: CardInstance = { ...stripForZone(entry.card), commandHeld: true };
  const next = patchPlayer(close(state, pending), enemyId, (p) => {
    const operation = entry.parent
      ? p.operation.map((op) => (op.instanceId === entry.parent ? { ...op, stackedCards: (op.stackedCards ?? []).filter((c) => c.instanceId !== instanceId) } : op))
      : p.operation.filter((op) => op.instanceId !== instanceId);
    const leftover = entry.parent ? [] : (entry.card.stackedCards ?? []).map(stripForZone);
    return {
      ...p,
      operation,
      command: room ? [...p.command, placed] : p.command,
      discard: [...p.discard, ...(room ? [] : [stripForZone(entry.card)]), ...leftover],
    };
  });
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-051", `${ZX_KICK_EFFECT_ID}:${room ? "command" : "discard"}`) };
};
XG1_SKIPPERS[ZX_KICK_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG1-052 仮面ライダーアギトTF【ファイヤーストームアタック】
// 「これが自軍エリアにある間、相手がターンを終えるとき、次の効果を発動できる⇒そのターン中にホールド状態になった敵軍ユニットを、すべて持ち主の山札に
//  戻してシャッフルする。」（atwiki/page-1673）。そのターン中にリリース状態からホールド状態になった（RK12_UNIT_HELD_RULE の記録）、いま場にある
//  敵軍ユニット。ホールド状態で場に出たものは含めない。
// XG1-053 の「自分がターンを終えるときBP6000以上なら撃破される」も同じ順番で処理する。

const FIRE_STORM_EFFECT_ID = "xg1_052_fire_storm";

XG1_KEYWORDS["XG1-052::fire_storm"] = noop("xg1_052:turn_end");

function heldThisTurn(state: GameState, ownerId: PlayerId): string[] {
  const ids = new Set(rk12TurnPayloads<{ instanceId?: string }>(state, ownerId, RK12_UNIT_HELD_RULE).map((p) => p.instanceId));
  return fieldUnits(state, ownerId).filter((c) => ids.has(c.instanceId)).map((c) => c.instanceId);
}

export function collectXg1TurnEndQueue(state: GameState, endingPlayerId: PlayerId): string[] {
  const out: string[] = [];
  const otherId = opponent(endingPlayerId);
  for (const c of fieldUnits(state, otherId)) if (isSameCardIdentity(c.cardId, "XG1-052")) out.push(`fire:${c.instanceId}`);
  for (const c of fieldUnits(state, endingPlayerId)) if (isSameCardIdentity(c.cardId, "XG1-053")) out.push(`burn:${c.instanceId}`);
  return out;
}

export function openXg1TurnEndEntry(state: GameState, endingPlayerId: PlayerId, entry: string): GameState {
  const [kind, instanceId] = entry.split(/:(.*)/s) as [string, string];
  if (kind === "fire") {
    const ownerId = opponent(endingPlayerId);
    if (!zoneOfField(state, ownerId, instanceId) || heldThisTurn(state, endingPlayerId).length === 0) return state;
    return openEffectChoice(state, confirmOptions({ playerId: ownerId, phasePlayerId: endingPlayerId, sourceInstanceId: instanceId }, "XG1-052", FIRE_STORM_EFFECT_ID, ["accept"], true));
  }
  if (kind === "burn") {
    const card = findField(state, endingPlayerId, instanceId);
    if (!card || effectiveBp(state, endingPlayerId, card) < 6000) return state;
    return destroyAll(state, { playerId: endingPlayerId, phasePlayerId: endingPlayerId, sourceInstanceId: instanceId }, "XG1-053", "xg1_053_burn_out", [instanceId]);
  }
  return state;
}

XG1_RESOLVERS[FIRE_STORM_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  let next = close(state, pending);
  const ids = heldThisTurn(next, enemyId);
  for (const id of ids) next = moveFieldUnit(next, enemyId, id, pending.phasePlayerId, "deck_bottom");
  next = patchPlayer(next, enemyId, (p) => ({ ...p, deck: shuffleCards(p.deck) }));
  return { state: next, log: logFor(state, playerId, "XG1-052", `${FIRE_STORM_EFFECT_ID}:${ids.length}`) };
};
XG1_SKIPPERS[FIRE_STORM_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: close(state, pending), log: logFor(state, playerId, "XG1-052", `${FIRE_STORM_EFFECT_ID}:skip`) };
};

// ---------------------------------------------------------------------------
// XG1-054 仮面ライダーアギトSHF【シャイニングカリバー】
// 「自軍ターン中、これがバトルエリアに出たとき、自軍山札の上から2枚をオモテにしてもよい。そうしたとき、オモテにしたカードの必要パワーの数字を見て、
//  数字の小さい方以上～数字が大きい方以下の必要パワーの数字を持つ敵軍ユニットがあれば1体選び、持ち主のパワーゾーンにダメージにして置く。その後、
//  オモテにしたカードから1枚選び手札に加え、残りを山札の上に戻す。」（atwiki/page-1670）
// オモテにする（任意）と範囲内の敵軍ユニットを選ぶ（あれば必ず）を1つの選択にまとめる: 範囲内の敵軍ユニットがあればその中から選ぶ（選ぶ＝オモテに
// する）、なければ「オモテにする」を選ぶ。選ばなければオモテにしない。残りのカードは山札の上のまま。

const CALIBUR_EFFECT_ID = "xg1_054_shining_calibur";
const CALIBUR_HAND_EFFECT_ID = "xg1_054_shining_calibur_hand";

XG1_KEYWORDS["XG1-054::shining_calibur"] = (state, ctx) => {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: "xg1_054:not_own_turn" };
  const top = state.players[ctx.playerId].deck.slice(0, 2);
  if (top.length === 0) return { state, detail: "xg1_054:empty_deck" };
  const costs = top.map((c) => costNumber(state, c.cardId)).filter((n) => Number.isFinite(n));
  const enemyId = opponent(ctx.playerId);
  const lo = costs.length > 0 ? Math.min(...costs) : Number.NaN;
  const hi = costs.length > 0 ? Math.max(...costs) : Number.NaN;
  const ids = fieldUnits(state, enemyId)
    .filter((c) => {
      const n = costNumber(state, c.cardId);
      return n >= lo && n <= hi && selectableEnemy(state, ctx.playerId, "XG1-054", c);
    })
    .map((c) => c.instanceId);
  const meta = { xg1Meta: { steps: top.map((c) => c.instanceId) } };
  const choice = ids.length > 0 ? pickOne(ctxBase(ctx), "XG1-054", CALIBUR_EFFECT_ID, ids, true, meta) : confirmOptions(ctxBase(ctx), "XG1-054", CALIBUR_EFFECT_ID, ["accept"], true, meta);
  return { state: openAfter(state, choice), detail: CALIBUR_EFFECT_ID };
};

function caliburHand(state: GameState, pending: PendingEffectChoice): GameState {
  const revealed = (pending.xg1Meta?.steps ?? []).filter((id) => state.players[pending.playerId].deck.some((c) => c.instanceId === id));
  if (revealed.length === 0) return proceed(state, pending);
  if (revealed.length === 1) return proceed(caliburToHand(state, pending.playerId, revealed[0]!), pending);
  return openNext(state, pending, pickOne(pendingBase(pending), "XG1-054", CALIBUR_HAND_EFFECT_ID, revealed, false));
}

function caliburToHand(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  return patchPlayer(state, playerId, (p) => {
    const card = p.deck.find((c) => c.instanceId === instanceId);
    return card ? { ...p, deck: p.deck.filter((c) => c.instanceId !== instanceId), hand: [...p.hand, stripForZone(card)] } : p;
  });
}

XG1_RESOLVERS[CALIBUR_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  let next = close(state, pending);
  if (instanceId !== "accept") next = moveFieldUnit(next, opponent(playerId), instanceId, pending.phasePlayerId, "power_damage");
  return { state: caliburHand(next, pending), log: logFor(state, playerId, "XG1-054", `${CALIBUR_EFFECT_ID}:${instanceId}`) };
};
XG1_SKIPPERS[CALIBUR_EFFECT_ID] = simpleSkip();

XG1_RESOLVERS[CALIBUR_HAND_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  return { state: proceed(caliburToHand(close(state, pending), playerId, instanceId), pending), log: logFor(state, playerId, "XG1-054", `${CALIBUR_HAND_EFFECT_ID}:${instanceId}`) };
};

// ---------------------------------------------------------------------------
// XG1-055 マンティスロード【血に飢えた予言者】
// 「これが自分の手札にある間、必要パワーに「＋」を持つ敵軍Sユニットがラッシュされたとき、DAを持つ自軍コマンドを1つホールドしてからこれを自軍
//  ラッシュエリアに出してもよい。そうしたとき、ラッシュされた敵軍ユニットを撃破する。」（atwiki/page-1572）
// 「ラッシュされたとき」の誘発（rules/onRushUnitEffects.ts）。出すのはラッシュではない（「出す」）。手札のこれを選ぶ → DA のコマンドを選ぶ。

const MANTIS_EFFECT_ID = "xg1_055_mantis";
const MANTIS_HOLD_EFFECT_ID = "xg1_055_mantis_hold";

XG1_KEYWORDS["XG1-055::prophet"] = noop("xg1_055:enemy_rush");

function hasPlusCost(state: GameState, cardId: string): boolean {
  const raw = getDefinition(state.definitions, cardId)?.powerCost;
  return typeof raw === "string" && /[+＋]/.test(raw);
}

function releasedDaCommands(state: GameState, playerId: PlayerId): string[] {
  const p = state.players[playerId];
  return p.command.filter((c) => !c.commandHeld && (effectiveCommandCategories(p, state.definitions, c.cardId) as string[]).includes("DA")).map((c) => c.instanceId);
}

export function openXg1cMantisOnEnemyRush(state: GameState, rusherPlayerId: PlayerId, rushedInstanceId: string, phasePlayerId: PlayerId): GameState {
  const defenderId = opponent(rusherPlayerId);
  const mantis = state.players[defenderId].hand.filter((c) => isSameCardIdentity(c.cardId, "XG1-055"));
  if (mantis.length === 0) return state;
  const rushed = findField(state, rusherPlayerId, rushedInstanceId);
  if (!rushed || !isUnitDef(state, rushed.cardId) || !rk1IsSmallNow(state, rushed) || !hasPlusCost(state, rushed.cardId)) return state;
  if (releasedDaCommands(state, defenderId).length === 0) return state;
  return openAfter(
    state,
    { ...pickOne({ playerId: defenderId, phasePlayerId }, "XG1-055", MANTIS_EFFECT_ID, mantis.map((c) => c.instanceId), true), kind: "select_hand", xg1Meta: { target: rushedInstanceId, ownerId: rusherPlayerId } },
  );
}

XG1_RESOLVERS[MANTIS_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const ids = releasedDaCommands(state, playerId);
  if (ids.length === 0) return { error: "invalid_target" };
  const ctx = { ...pendingBase(pending), sourceInstanceId: instanceId };
  const next = holdThen(close(state, pending), ctx, "XG1-055", MANTIS_HOLD_EFFECT_ID, ids, 1, { xg1Meta: pending.xg1Meta, resumeChoice: pending.resumeChoice });
  return { state: next, log: logFor(state, playerId, "XG1-055", `${MANTIS_EFFECT_ID}:${instanceId}`) };
};
XG1_SKIPPERS[MANTIS_EFFECT_ID] = simpleSkip();

registerHold(MANTIS_HOLD_EFFECT_ID, (state, pending) => {
  const playerId = pending.playerId;
  const selfId = pending.sourceInstanceId;
  let next = state;
  const card = selfId ? next.players[playerId].hand.find((c) => c.instanceId === selfId) : undefined;
  if (card) next = patchPlayer(next, playerId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== card.instanceId), rush: [...p.rush, stripForZone(card)] }));
  const target = pending.xg1Meta?.target;
  const ownerId = pending.xg1Meta?.ownerId;
  if (card && target && ownerId && zoneOfField(next, ownerId, target)) next = destroyAll(next, pendingBase(pending), "XG1-055", `${MANTIS_EFFECT_ID}_destroy`, [target]);
  return proceed(next, pending);
});

// ---------------------------------------------------------------------------
// XG1-056 水のエル【アギトの殲滅】（ラッシュしたとき）「カテゴリにMAを持つ敵軍Sユニットを1体選び撃破してもよい。」（atwiki/page-1573）
// エリアを問わない。カテゴリはいまのカテゴリ。

const AGITO_ANNIHILATION_EFFECT_ID = "xg1_056_agito_annihilation";

XG1_KEYWORDS["XG1-056::annihilation"] = (state, ctx) => {
  const enemyId = opponent(ctx.playerId);
  const ids = enemySUnits(state, ctx.playerId, "XG1-056", (c) => unitCatsNow(state, enemyId, c).includes("MA"));
  if (ids.length === 0) return { state, detail: "xg1_056:no_targets" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-056", AGITO_ANNIHILATION_EFFECT_ID, ids, true)), detail: AGITO_ANNIHILATION_EFFECT_ID };
};

XG1_RESOLVERS[AGITO_ANNIHILATION_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG1-056", `${AGITO_ANNIHILATION_EFFECT_ID}_destroy`, [instanceId]);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-056", `${AGITO_ANNIHILATION_EFFECT_ID}:${instanceId}`) };
};
XG1_SKIPPERS[AGITO_ANNIHILATION_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG1-057 ブラックファング【衝撃波】
// 「これがライドされている間、敵軍Sユニットは次の制限を受ける⇒ライドしてバトルエリアに出たとき、ホールド状態になる。」（atwiki/page-1564）
// 敵軍の場（エリアを問わない）にユニットがライドしているブラックファングがあれば、ライドしてバトルエリアに出た S ユニットをホールド状態にする。

XG1_KEYWORDS["XG1-057::shockwave"] = noop("xg1_057:ride_restriction");

function blackFangRidden(state: GameState, ownerId: PlayerId): boolean {
  const field = [...state.players[ownerId].rush, ...state.players[ownerId].battle];
  return field.some((v) => isSameCardIdentity(v.cardId, "XG1-057") && field.some((c) => c.mountedOnInstanceId === v.instanceId));
}

export function xg1cBlackFangOnRide(state: GameState, playerId: PlayerId, riderInstanceId: string): GameState {
  const rider = state.players[playerId].battle.find((c) => c.instanceId === riderInstanceId);
  if (!rider?.mountedOnInstanceId || rider.commandHeld || !rk1IsSmallNow(state, rider)) return state;
  if (!blackFangRidden(state, opponent(playerId))) return state;
  const next = patchPlayer(state, playerId, (p) => ({ ...p, battle: p.battle.map((c) => (c.instanceId === riderInstanceId ? { ...c, commandHeld: true } : c)) }));
  return { ...next, log: [...next.log, logFor(next, opponent(playerId), "XG1-057", `xg1_057_shockwave:${riderInstanceId}`)] };
}

// ---------------------------------------------------------------------------
// XG1-058 ウルフアンデッド【ワーウルフ化】（RC）
// 「ホールド状態のSユニットを2体選んでもよい。そうしたとき、選んだ2体でバトルさせる。ただし、特徴「男」を持つユニットを必ず1体選ぶこと。」
// （atwiki/page-1565）。自軍・敵軍、エリアを問わない（カード評価）。バトルはいまの BP を比べ、低いほうを撃破する（同じなら両方。アタックではない）。
// ※（ライド中 BP+1000）は rules/xg1/xg1Fields.ts。

const WEREWOLF_EFFECT_ID = "xg1_058_werewolf";
const WEREWOLF_SECOND_EFFECT_ID = "xg1_058_werewolf_second";

function werewolfCandidates(state: GameState, playerId: PlayerId): CardInstance[] {
  const out: CardInstance[] = [];
  for (const pid of [playerId, opponent(playerId)] as const) {
    for (const c of fieldUnits(state, pid)) {
      if (!c.commandHeld || !rk1IsSmallNow(state, c)) continue;
      if (pid !== playerId && !selectableEnemy(state, playerId, "XG1-058", c)) continue;
      out.push(c);
    }
  }
  return out;
}

function isMan(state: GameState, card: CardInstance): boolean {
  const owner = ownerOfField(state, card.instanceId);
  return !!owner && unitFeatures(state, owner, card).includes("男");
}

function werewolfPartners(state: GameState, playerId: PlayerId, firstId: string): string[] {
  const all = werewolfCandidates(state, playerId);
  const first = all.find((c) => c.instanceId === firstId);
  if (!first) return [];
  const needMan = !isMan(state, first);
  return all.filter((c) => c.instanceId !== firstId && (!needMan || isMan(state, c))).map((c) => c.instanceId);
}

XG1_KEYWORDS["XG1-058::werewolf"] = (state, ctx) => {
  const ids = werewolfCandidates(state, ctx.playerId).map((c) => c.instanceId).filter((id) => werewolfPartners(state, ctx.playerId, id).length > 0);
  if (ids.length === 0) return { state, detail: "xg1_058:no_targets" };
  return { state: openAfter(state, pickOne(ctxBase(ctx), "XG1-058", WEREWOLF_EFFECT_ID, ids, true)), detail: WEREWOLF_EFFECT_ID };
};

XG1_RESOLVERS[WEREWOLF_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const ids = werewolfPartners(state, playerId, instanceId);
  if (ids.length === 0) return { error: "invalid_target" };
  return {
    state: openNext(close(state, pending), pending, pickOne(pendingBase(pending), "XG1-058", WEREWOLF_SECOND_EFFECT_ID, ids, false, { xg1Meta: { target: instanceId } })),
    log: logFor(state, playerId, "XG1-058", `${WEREWOLF_EFFECT_ID}:${instanceId}`),
  };
};
XG1_SKIPPERS[WEREWOLF_EFFECT_ID] = simpleSkip();

XG1_RESOLVERS[WEREWOLF_SECOND_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const firstId = pending.xg1Meta?.target;
  let next = close(state, pending);
  const a = firstId ? ownerOfField(next, firstId) : null;
  const b = ownerOfField(next, instanceId);
  if (!firstId || !a || !b) return { state: proceed(next, pending) };
  const bpA = effectiveBp(next, a, findField(next, a, firstId)!);
  const bpB = effectiveBp(next, b, findField(next, b, instanceId)!);
  const losers = bpA === bpB ? [firstId, instanceId] : bpA < bpB ? [firstId] : [instanceId];
  next = destroyAll(next, pendingBase(pending), "XG1-058", `${WEREWOLF_EFFECT_ID}_battle`, losers);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-058", `${WEREWOLF_EFFECT_ID}_battle:${bpA}:${bpB}`) };
};

// ---------------------------------------------------------------------------
// XG1-059 仮面ライダーブレイドKF【ロイヤルストレートフラッシュ】
// 「自軍ターン中、これがバトルエリアに出たとき、自分の手札を5枚選び、相手に見せてもよい。そうしたとき、本来のBPが8000以下の敵軍ユニットを1体選び
//  撃破できる。その後、見せたカードのカテゴリがすべて同じなら、敵軍捨札からカードを1枚選び、ゲームから除外してもよい。」（atwiki/page-1546）
// 「すべて同じ」は5枚に共通のカテゴリが1つ以上あること（Q2: マルチカテゴリ）。「相手に選ばれない」オモテ向きのカードは捨札から選べない（Q1）。
// 手札がちょうど5枚なら、その5枚を見せる。

const RSF_EFFECT_ID = "xg1_059_royal_straight_flush";
const RSF_SHOW_EFFECT_ID = "xg1_059_royal_straight_flush_show";
const RSF_DESTROY_EFFECT_ID = "xg1_059_royal_straight_flush_destroy";
const RSF_EXILE_EFFECT_ID = "xg1_059_royal_straight_flush_exile";

XG1_KEYWORDS["XG1-059::royal_straight_flush"] = (state, ctx) => {
  if (ctx.phasePlayerId !== ctx.playerId) return { state, detail: "xg1_059:not_own_turn" };
  if (state.players[ctx.playerId].hand.length < 5) return { state, detail: "xg1_059:hand_short" };
  return { state: openAfter(state, confirmOptions(ctxBase(ctx), "XG1-059", RSF_EFFECT_ID, ["accept"], true)), detail: RSF_EFFECT_ID };
};

function sameCategory(state: GameState, ids: string[], playerId: PlayerId): boolean {
  const hand = state.players[playerId].hand;
  const sets = ids.map((id) => {
    const card = hand.find((c) => c.instanceId === id);
    const d = card ? getDefinition(state.definitions, card.cardId) : undefined;
    return new Set(d ? (cardCategories(d) as string[]) : []);
  });
  if (sets.length === 0) return false;
  return [...sets[0]!].some((cat) => sets.every((s) => s.has(cat)));
}

function rsfDestroyStep(state: GameState, pending: PendingEffectChoice, shown: string[]): GameState {
  const playerId = pending.playerId;
  const enemyId = opponent(playerId);
  const meta = { xg1Meta: { steps: shown, count: sameCategory(state, shown, playerId) ? 1 : 0 } };
  const ids = fieldUnits(state, enemyId)
    .filter((c) => printedBp(state, c.cardId) <= 8000 && selectableEnemy(state, playerId, "XG1-059", c))
    .map((c) => c.instanceId);
  if (ids.length > 0) return openNext(state, pending, pickOne(pendingBase(pending), "XG1-059", RSF_DESTROY_EFFECT_ID, ids, true, meta));
  return rsfExileStep(state, { ...pending, ...meta });
}

function rsfExileStep(state: GameState, pending: PendingEffectChoice): GameState {
  if (!pending.xg1Meta?.count) return proceed(state, pending);
  const ids = state.players[opponent(pending.playerId)].discard.filter((c) => !cardNotSelectableByOpponent(c.cardId)).map((c) => c.instanceId);
  if (ids.length === 0) return proceed(state, pending);
  return openNext(state, pending, pickOne(pendingBase(pending), "XG1-059", RSF_EXILE_EFFECT_ID, ids, true));
}

XG1_RESOLVERS[RSF_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const hand = state.players[playerId].hand.map((c) => c.instanceId);
  const next = close(state, pending);
  const log = logFor(state, playerId, "XG1-059", `${RSF_EFFECT_ID}:accept`);
  if (hand.length === 5) return { state: rsfDestroyStep(next, pending, hand), log };
  return { state: openNext(next, pending, { ...pickOne(pendingBase(pending), "XG1-059", RSF_SHOW_EFFECT_ID, hand, false), kind: "select_hand", selectCount: 5, selectedInstanceIds: [] }), log };
};
XG1_SKIPPERS[RSF_EFFECT_ID] = simpleSkip();

XG1_RESOLVERS[RSF_SHOW_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const log = logFor(state, playerId, "XG1-059", `${RSF_SHOW_EFFECT_ID}:${instanceId}`);
  if (selected.length < 5) {
    return { state: { ...state, pendingEffectChoice: { ...pending, selectedInstanceIds: selected, validInstanceIds: pending.validInstanceIds.filter((id) => !selected.includes(id)) } }, log };
  }
  return { state: rsfDestroyStep(close(state, pending), pending, selected), log };
};

XG1_RESOLVERS[RSF_DESTROY_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = destroyAll(close(state, pending), pendingBase(pending), "XG1-059", `${RSF_DESTROY_EFFECT_ID}_destroy`, [instanceId]);
  return { state: rsfExileStep(next, pending), log: logFor(state, playerId, "XG1-059", `${RSF_DESTROY_EFFECT_ID}:${instanceId}`) };
};
XG1_SKIPPERS[RSF_DESTROY_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: rsfExileStep(close(state, pending), pending), log: logFor(state, playerId, "XG1-059", `${RSF_DESTROY_EFFECT_ID}:skip`) };
};

XG1_RESOLVERS[RSF_EXILE_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const next = moveToExile(close(state, pending), opponent(playerId), "discard", instanceId);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-059", `${RSF_EXILE_EFFECT_ID}:${instanceId}`) };
};
XG1_SKIPPERS[RSF_EXILE_EFFECT_ID] = simpleSkip();

// ---------------------------------------------------------------------------
// XG1-060 コーカサスビートルアンデッド【カード強奪】
// 「これがバトルエリアからラッシュエリアに戻るとき、相手の手札を見ないで1枚選んでもよい。そうしたとき、選んだカードを持ち主の山札に戻してシャッフル
//  した後で、相手は1枚ドローする。」（atwiki/page-1580）。スタートフェイズにバトルエリアのユニットをラッシュエリアに戻したとき
// （rules/startPhase.ts）。選ぶ・選ばないを先に決め、選ぶなら相手の手札から1枚を選ぶ。

const CARD_SNATCH_EFFECT_ID = "xg1_060_card_snatch";
const CARD_SNATCH_PICK_EFFECT_ID = "xg1_060_card_snatch_pick";

XG1_KEYWORDS["XG1-060::card_snatch"] = noop("xg1_060:battle_to_rush");

export function xg1cBattleToRush(state: GameState, ownerId: PlayerId, card: CardInstance, phasePlayerId: PlayerId): GameState {
  if (!isSameCardIdentity(card.cardId, "XG1-060")) return state;
  if (state.players[opponent(ownerId)].hand.length === 0) return state;
  return openEffectChoice(state, confirmOptions({ playerId: ownerId, phasePlayerId, sourceInstanceId: card.instanceId }, "XG1-060", CARD_SNATCH_EFFECT_ID, ["accept"], true));
}

XG1_RESOLVERS[CARD_SNATCH_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  const ids = state.players[opponent(playerId)].hand.map((c) => c.instanceId);
  if (ids.length === 0) return { state: proceed(close(state, pending), pending) };
  return {
    state: openNext(close(state, pending), pending, pickOne(pendingBase(pending), "XG1-060", CARD_SNATCH_PICK_EFFECT_ID, ids, false)),
    log: logFor(state, playerId, "XG1-060", `${CARD_SNATCH_EFFECT_ID}:accept`),
  };
};
XG1_SKIPPERS[CARD_SNATCH_EFFECT_ID] = simpleSkip();

XG1_RESOLVERS[CARD_SNATCH_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const enemyId = opponent(playerId);
  const card = state.players[enemyId].hand.find((c) => c.instanceId === instanceId);
  if (!card) return { error: "invalid_target" };
  let next = patchPlayer(close(state, pending), enemyId, (p) => ({ ...p, hand: p.hand.filter((c) => c.instanceId !== instanceId), deck: shuffleCards([...p.deck, stripForZone(card)]) }));
  next = patchPlayer(next, enemyId, drawOne);
  return { state: proceed(next, pending), log: logFor(state, playerId, "XG1-060", `${CARD_SNATCH_PICK_EFFECT_ID}:shuffle_draw`) };
};
