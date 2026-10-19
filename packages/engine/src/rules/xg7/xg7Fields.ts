/**
 * クロスギャザー ザ・ベストパートナー XG7-001〜XG7-068 の継続効果の判定（低いレベルの関数だけ。選択や処理の続きは rules/xg7/xg7Effects.ts）。
 *
 * - `xg7FieldBpBonus`: 常時の BP 修正（rules/fieldAuras.ts passiveNamedFieldBpBonus）。
 * - `xg7AttackerBattleBonus` / `xg7DefenderBattleBonus`: バトル中の BP 修正（rules/namedUnitEffects.ts）。
 * - `xg7EffectiveSp`: SP（rules/legend3/fieldEffects.ts legend3EffectiveSp）。
 * - `xg7DefenderBlocksAttack`: アタックされない（rules/legend3/restrictions.ts canAttackDefender）。
 * - `xg7NotSelectable`: 相手に選ばれない（keywords/effectTargetability.ts isSelectableByOpponentEffect）。
 * - `xg7HandDeployCondition`: 「これが自分の手札にある間、…これを自軍ラッシュエリアに出してもよい」（rules/keywordGapRuntime.ts）。
 * - `xg7NcAnyNumberAt`: 「バトルエリアの2番目にコンビネーションするときは、ナンバーに関係なく発動する」（rules/numberComboEffects.ts）。
 * - `xg7CrossBonus`: このターン得たクロス（keywords/battleKeywords.ts crossShiftLeftOf）。
 * - `xg7UsableAsName`: 条件つきの「「X」として使える」（rules/leaveEffects.ts RS-426）。
 * - `xg7AdjustLeaveIntent`: 撃破したユニットを捨札にするかわりに除外する（rules/operationCounters.ts tryLeaveField）。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PendingLeave, PlayerId } from "../../types/game";
import { effectiveBp, getDefinition, unitEffectiveCategories, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { sameCardName } from "../../core/cardNames";
import { unitFeatures } from "../addedFeatures";
import { hasFlag } from "./xg7Registry";

type Defs = Pick<GameState, "definitions">;

function isId(cardId: string, id: string): boolean {
  return isSameCardIdentity(cardId, id);
}

function areaCards(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

function isUnit(state: Defs, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function areaUnits(state: GameState, playerId: PlayerId): CardInstance[] {
  return areaCards(state, playerId).filter((c) => isUnit(state, c.cardId));
}

function ownTurn(state: Pick<GameState, "activePlayer">, playerId: PlayerId): boolean {
  return state.activePlayer === playerId;
}

/** バトルエリアのアタックしたユニット（ウイングのアタックならラッシュエリア）。 */
function attackerOf(state: GameState, pending: PendingBattle): { card: CardInstance; zone: "battle" | "rush" } | null {
  const p = state.players[pending.attackerPlayerId];
  const inBattle = p.battle.find((c) => c.instanceId === pending.attackerInstanceId);
  if (inBattle) return { card: inBattle, zone: "battle" };
  const inRush = p.rush.find((c) => c.instanceId === pending.attackerInstanceId);
  return inRush ? { card: inRush, zone: "rush" } : null;
}

// ---------------------------------------------------------------------------
// 常時の BP 修正

/**
 * - XG7-007【龍撃剣＆獣奏剣】「これは自軍ターン中、特徴「恐竜」を持つユニット1体につきBP+1000され」（自軍・敵軍のユニットを数える。XG7-questions Q1）。
 * - XG7-007 ※「これが自軍捨札にある間、特徴「恐竜」を持つ自軍Mユニットは、アタックするとき、BP+1000される。」（捨札の枚数分）。
 * - XG7-008【アースの戦士】「これは自軍ターン中、リリース状態の自軍コマンド1つにつきBP+1000される。」
 */
export function xg7FieldBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance, role: "general" | "attacking" | "defending"): number {
  let bonus = 0;
  if (role === "general") {
    if (isId(instance.cardId, "XG7-007") && ownTurn(state, playerId)) {
      const dinos = (["player1", "player2"] as const).reduce(
        (n, pid) => n + areaUnits(state, pid).filter((c) => unitFeatures(state, pid, c).includes("恐竜")).length,
        0,
      );
      bonus += 1000 * dinos;
    }
    if (isId(instance.cardId, "XG7-008") && ownTurn(state, playerId)) {
      bonus += 1000 * state.players[playerId].command.filter((c) => !c.commandHeld).length;
    }
  }
  if (role === "attacking") {
    const copies = state.players[playerId].discard.filter((c) => isId(c.cardId, "XG7-007")).length;
    if (copies > 0 && unitSizeOf(state.definitions, instance) === "M" && unitFeatures(state, playerId, instance).includes("恐竜")) {
      bonus += 1000 * copies;
    }
  }
  return bonus;
}

/**
 * バトル中のアタックしたユニットの BP 修正。
 * - XG7-019【スカイコンビブレイク】「このターン、自軍ユニットは、ウイングでアタックしたとき、そのバトル中、BP+2000される。」
 *   （ウイングのアタック＝ラッシュエリアからのアタック。NC・これ自身のウイングのアタックで記録する。rules/xg7/xg7aEffects.ts）。
 */
export function xg7AttackerBattleBonus(state: GameState, pending: PendingBattle): number {
  if (pending.effectBattle) return 0;
  const attacker = attackerOf(state, pending);
  if (!attacker) return 0;
  let bonus = 0;
  if (attacker.zone === "rush") {
    const skyCombi = (state.xg7?.flags ?? []).filter((f) => f.key === "xg7019_sky_combi" && f.playerId === pending.attackerPlayerId && f.turn === state.turn);
    bonus += 2000 * new Set(skyCombi.map((f) => f.instanceId)).size;
  }
  return bonus;
}

export function xg7DefenderBattleBonus(_state: GameState, _pending: PendingBattle, _ownerId: PlayerId, _card: CardInstance): number {
  return 0;
}

// ---------------------------------------------------------------------------
// SP

/** XG7-007【龍撃剣＆獣奏剣】「BP8000以上のときSP1になる」。 */
export function xg7EffectiveSp(state: GameState, playerId: PlayerId, instance: CardInstance, sp: number): number {
  if (isId(instance.cardId, "XG7-007") && effectiveBp(state, playerId, instance) >= 8000) return Math.max(sp, 1);
  return sp;
}

// ---------------------------------------------------------------------------
// アタック・選ばれない

/** XG7-009【受け継いだもの】「これは自軍Lユニットがあれば、敵軍ユニットにアタックされない。」 */
export function xg7DefenderBlocksAttack(state: GameState, attackerPlayerId: PlayerId, _attacker: CardInstance, defenderPlayerId: PlayerId, defender: CardInstance): boolean {
  if (attackerPlayerId === defenderPlayerId) return false;
  if (isId(defender.cardId, "XG7-009") && areaUnits(state, defenderPlayerId).some((c) => unitSizeOf(state.definitions, c) === "L")) return true;
  return false;
}

/**
 * 相手に選ばれない（selectorPlayerId が ownerId の相手のとき）。
 * - XG7-009【受け継いだもの】「このユニットと隣り合うOTを持つLユニットはアタックされる以外では相手に選ばれない。」（バトルエリアの並びで両隣）。
 */
export function xg7NotSelectable(state: GameState, selectorPlayerId: PlayerId, ownerId: PlayerId, card: CardInstance): boolean {
  if (selectorPlayerId === ownerId) return false;
  const battle = state.players[ownerId].battle;
  const index = battle.findIndex((c) => c.instanceId === card.instanceId);
  if (index >= 0 && unitSizeOf(state.definitions, card) === "L" && unitEffectiveCategories(state, ownerId, card, "battle").includes("OT")) {
    const neighbors = [battle[index - 1], battle[index + 1]].filter((c): c is CardInstance => !!c);
    if (neighbors.some((c) => isId(c.cardId, "XG7-009"))) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 手札から出す

/**
 * 「※これが自分の手札にある間、自軍ラッシュフェイズ中、＜条件＞あれば、これを自軍ラッシュエリアに出してもよい。」の条件。
 * 対象外のカードは null。
 * - XG7-006 ギンガピンク「特徴「獣」を持つ自軍ビークルか、特徴「ブラック」を持つ自軍ユニットがあれば」。
 */
export function xg7HandDeployCondition(state: GameState, playerId: PlayerId, cardId: string): boolean | null {
  if (isId(cardId, "XG7-006")) {
    return areaCards(state, playerId).some((c) => {
      const type = getDefinition(state.definitions, c.cardId)?.type;
      const features = unitFeatures(state, playerId, c);
      return (type === "vehicle" && features.includes("獣")) || (type === "unit" && features.includes("ブラック"));
    });
  }
  return null;
}

// ---------------------------------------------------------------------------
// コンビネーション・クロス

/** 「（この効果はバトルエリアの2番目にコンビネーションするときは、ナンバーに関係なく発動する）」（XG7-013・XG7-016）。 */
export function xg7NcAnyNumberAt(cardId: string, battlePosition: number): boolean {
  return battlePosition === 2 && (isId(cardId, "XG7-013") || isId(cardId, "XG7-016"));
}

/** このターン得たクロスの値（XG7-015【ボウケンジャーになれ】等）。 */
export function xg7CrossBonus(card: Pick<CardInstance, "xg7Turn">): number {
  return card.xg7Turn?.cross ?? 0;
}

// ---------------------------------------------------------------------------
// カード名

/**
 * 条件つきの「「X」として使える」。
 * - XG7-016 黒獅子リオ×スーパーゲキレッド「※自軍Lユニットが無ければ、これは「ゲキレッド+黒獅子リオ」として使える。」
 */
export function xg7UsableAsName(state: GameState, ownerId: PlayerId, cardId: string, name: string): boolean {
  if (isId(cardId, "XG7-016") && (sameCardName(name, "ゲキレッド") || sameCardName(name, "黒獅子リオ"))) {
    return !areaUnits(state, ownerId).some((c) => unitSizeOf(state.definitions, c) === "L");
  }
  return false;
}

// ---------------------------------------------------------------------------
// 離場

/**
 * XG7-008【アースの戦士】「BP7000以上のとき、次の能力を得る⇒これがバトルで敵軍ユニットを撃破したとき、捨札にするかわりにゲームから除外する。」
 * バトルで撃破されて捨札になる離場を、捨札のかわりに除外する離場にする。
 */
export function xg7AdjustLeaveIntent(state: GameState, intent: PendingLeave): PendingLeave {
  if (intent.xg7Exile || intent.toZone !== "discard" || intent.notDestruction || !intent.battleOpponentInstanceId) return intent;
  const enemyId = opponent(intent.ownerPlayerId);
  const by = areaCards(state, enemyId).find((c) => c.instanceId === intent.battleOpponentInstanceId);
  if (!by || !isId(by.cardId, "XG7-008")) return intent;
  if (effectiveBp(state, enemyId, by) < 7000) return intent;
  return { ...intent, xg7Exile: true };
}

/** このターンの記録があるか（xg7Registry.hasFlag の再輸出。fields だけを読み込む呼び出し側のため）。 */
export const xg7HasFlag = hasFlag;
