/**
 * ザ・マスクドライダーEXP vol.2 RK-106〜RK-126 の継続効果（SP・BP・特徴・バトル進入の制限・選べない制限・コマンドのホールドの防止）。
 * core/catalog.ts・rules/fieldAuras.ts・rules/addedFeatures.ts・rules/restrictions.ts・keywords/effectTargetability.ts 等の低い層から呼ぶ
 * 小さなモジュール。カードの効果の起点は rules/rk/rk6UnitEffects.ts。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { SpValue } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import { getDefinition } from "../../core/catalog";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import { rk1IsSmallNow } from "./rk1Features";

type FieldState = Pick<GameState, "players" | "definitions">;

function fieldCards(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

function hasFieldCard(state: Pick<GameState, "players">, playerId: PlayerId, cardId: string): boolean {
  // BP・特徴の計算のたびに呼ばれるので、場の配列を作らずに見る。
  const p = state.players[playerId];
  return p.battle.some((c) => isSameCardIdentity(c.cardId, cardId)) || p.rush.some((c) => isSameCardIdentity(c.cardId, cardId));
}

function isUnitCard(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function other(playerId: PlayerId): PlayerId {
  return playerId === "player1" ? "player2" : "player1";
}

function ownerOf(state: Pick<GameState, "players">, instanceId: string): PlayerId | undefined {
  for (const pid of ["player1", "player2"] as const) {
    if (fieldCards(state, pid).some((c) => c.instanceId === instanceId)) return pid;
  }
  return undefined;
}

/** そのときのターンプレイヤー（保留中の処理があればその処理のターンプレイヤー）。 */
function turnPlayer(state: GameState): PlayerId {
  if (state.pendingStrike) return state.pendingStrike.battlePhasePlayer;
  if (state.pendingBattle) return state.pendingBattle.phasePlayerId;
  if (state.pendingRush) return state.pendingRush.phasePlayerId;
  if (state.pendingLeave) return state.pendingLeave.phasePlayerId;
  if (state.pendingEffectChoice) return state.pendingEffectChoice.phasePlayerId;
  return state.activePlayer;
}

function hasTurnRule(state: Pick<GameState, "players">, playerId: PlayerId, ruleId: string): number {
  return getPlayerModifiers(state.players[playerId]).filter((m) => m.kind === "rule" && m.ruleId === ruleId && m.scope === "turn").length;
}

// ---------------------------------------------------------------------------
// RK-106 仮面ライダーアギトFF「※これはライド中、「SP1/3」になる。」（atwiki/page-691。rules/fractionalSp.ts resolveInstanceSpValue から呼ぶ）

/** ライド中の SP の指定値（対象でなければ undefined）。 */
export function rk6RidingSpValue(instance: Pick<CardInstance, "cardId" | "mountedOnInstanceId">): SpValue | undefined {
  if (isSameCardIdentity(instance.cardId, "RK-106") && instance.mountedOnInstanceId) return "1/3";
  return undefined;
}

// ---------------------------------------------------------------------------
// BP の増減（rules/fieldAuras.ts passiveNamedFieldBpBonus から呼ぶ。"general" のときだけ）。
// - RK-107 マシントルネイダー【硬化装甲】「これにライドしているユニットは、敵軍ターン中、リリース状態の自軍コマンド1つにつきBP+1000される。」
// - RK-117 仮面ライダータイガの※（ホールド状態の敵軍ユニット1体につき BP+1000）は rules/rkFieldPassives.ts の文言の解析で数える。
// - RK-121 サイドバッシャーBM【エクザップバスター】「これをラッシュしたターン、敵軍SユニットはBP-500される。」（BP0 以下の撃破は R-BP-02）

export const EXA_BUSTER_RULE = "rk121_exa_buster";

export function rk6FieldBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  let bonus = 0;
  const p = state.players[playerId];
  if (instance.mountedOnInstanceId) {
    const vehicle = fieldCards(state, playerId).find((c) => c.instanceId === instance.mountedOnInstanceId);
    if (vehicle && isSameCardIdentity(vehicle.cardId, "RK-107") && turnPlayer(state) !== playerId) {
      bonus += 1000 * p.command.filter((c) => !c.commandHeld).length;
    }
  }
  const busters = hasTurnRule(state, other(playerId), EXA_BUSTER_RULE);
  if (busters > 0 && isUnitCard(state, instance.cardId) && rk1IsSmallNow(state, instance) && ownerOf(state, instance.instanceId) === playerId) {
    bonus -= 500 * busters;
  }
  return bonus;
}

// ---------------------------------------------------------------------------
// RK-122 ホースオルフェノク格闘態
// 「※これは自軍パワーゾーンに6枚以上カードが無ければバトルエリアに出られない。」（ウラ向きのカードも数える。R-POW-01）
// 「【使途再生】これが自軍エリアにある間、ホールド状態の自軍Sユニットは特徴「オルフェノク」が追加される。」（atwiki/page-706）

/** バトルエリアに出られないか（rules/restrictions.ts canMoveUnitToBattle から呼ぶ）。 */
export function rk6BlocksBattleEntry(state: Pick<GameState, "players">, playerId: PlayerId, unit: Pick<CardInstance, "cardId">): boolean {
  return isSameCardIdentity(unit.cardId, "RK-122") && state.players[playerId].power.length < 6;
}

/** 追加される特徴（rules/addedFeatures.ts unitFeatures から呼ぶ）。 */
export function rk6AddedFeatures(state: FieldState, ownerId: PlayerId, instance: Pick<CardInstance, "cardId" | "instanceId">): string[] {
  const card = fieldCards(state, ownerId).find((c) => c.instanceId === instance.instanceId);
  if (!card?.commandHeld || !isUnitCard(state, card.cardId) || !rk1IsSmallNow(state, card)) return [];
  return hasFieldCard(state, ownerId, "RK-122") ? ["オルフェノク"] : [];
}

// ---------------------------------------------------------------------------
// RK-116 マグナギガ【そびえる巨体】「これが自軍バトルエリアにある間、自軍コマンドゾーンのカードは敵軍ユニットの効果によってホールドされない。」
// （atwiki/page-645）。敵軍ユニットの効果で敵軍コマンドをホールドする処理（dsl/grantKeyword.ts の hold_all_enemy_commands、
// dsl/cardInterpreter.ts の hold_command）から呼ぶ。

/** commandOwnerId のコマンドが、sourceCardId（敵軍のユニット）の効果でホールドされないか。 */
export function rk6CommandHoldBlocked(state: Pick<GameState, "players" | "definitions">, commandOwnerId: PlayerId, sourceCardId: string | undefined): boolean {
  if (!state.players[commandOwnerId].battle.some((c) => isSameCardIdentity(c.cardId, "RK-116"))) return false;
  if (!sourceCardId || !isUnitCard(state, sourceCardId)) return false;
  // 自軍のユニットの効果では防がない（発生源が敵軍の場にあるときだけ）。
  return fieldCards(state, other(commandOwnerId)).some((c) => c.cardId === sourceCardId);
}

// ---------------------------------------------------------------------------
// RK-124 スネークオルフェノク【人を守る決意】
// 「これが自軍バトルエリアにある間、相手は次の制限を受ける⇒自分自身のターン中、アタックや効果の対象として対戦相手の「スネークオルフェノク」を
//  一度も選んでいなければ、特徴「仮面ライダー」を持つ対戦相手のユニットと「スネークオルフェノク」以外の特徴「オルフェノク」を持つ対戦相手の
//  ユニットは選べない。」（atwiki/page-708）
// - 制限は相手（スネークの持ち主の対戦相手）のターン中だけ。そのターンにスネークをアタックの対象（アタックの宣言）か効果の対象（選択の解決）として
//   選んだら、そのターンは制限がなくなる（rk6RecordSnakeSelected）。
// - アタック先（rules/legend3/restrictions.ts canAttackDefender）と、相手の効果の対象（keywords/effectTargetability.ts）で見る。

export const SNAKE_SELECTED_RULE = "rk124_snake_selected";

function snakeRestrictionActive(state: GameState, selectorId: PlayerId, targetOwnerId: PlayerId): boolean {
  if (selectorId === targetOwnerId) return false;
  if (turnPlayer(state) !== selectorId) return false;
  if (!state.players[targetOwnerId].battle.some((c) => isSameCardIdentity(c.cardId, "RK-124"))) return false;
  return hasTurnRule(state, selectorId, SNAKE_SELECTED_RULE) === 0;
}

function snakeProtected(state: GameState, ownerId: PlayerId, card: CardInstance, features: (s: GameState, p: PlayerId, c: CardInstance) => string[]): boolean {
  if (!isUnitCard(state, card.cardId)) return false;
  const fs = features(state, ownerId, card);
  if (fs.includes("仮面ライダー")) return true;
  return fs.includes("オルフェノク") && !isSameCardIdentity(card.cardId, "RK-124");
}

/** selectorId が targetOwnerId の card を（アタックや効果の対象として）選べないか。 */
export function rk6SnakeBlocksSelection(
  state: GameState,
  selectorId: PlayerId,
  targetOwnerId: PlayerId,
  card: CardInstance,
  features: (s: GameState, p: PlayerId, c: CardInstance) => string[],
): boolean {
  if (!snakeRestrictionActive(state, selectorId, targetOwnerId)) return false;
  return snakeProtected(state, targetOwnerId, card, features);
}

/** selectorId が targetInstanceId（対戦相手の「スネークオルフェノク」なら）を選んだことを記録する。 */
export function rk6RecordSnakeSelected(state: GameState, selectorId: PlayerId, targetInstanceId: string): GameState {
  const ownerId = ownerOf(state, targetInstanceId);
  if (!ownerId || ownerId === selectorId) return state;
  const card = fieldCards(state, ownerId).find((c) => c.instanceId === targetInstanceId);
  if (!card || !isSameCardIdentity(card.cardId, "RK-124")) return state;
  if (turnPlayer(state) !== selectorId) return state;
  if (hasTurnRule(state, selectorId, SNAKE_SELECTED_RULE) > 0) return state;
  const p = state.players[selectorId];
  return {
    ...state,
    players: {
      ...state.players,
      [selectorId]: { ...p, modifiers: [...getPlayerModifiers(p), { kind: "rule", ruleId: SNAKE_SELECTED_RULE, scope: "turn", sourceCardId: "RK-124" }] },
    },
  };
}

// ---------------------------------------------------------------------------
// RK-111 ガードチェイサー【非常警戒態勢】「これにライドしているSユニットは次の能力を得る⇒これが自軍ラッシュエリアにある間、相手にストライクされた
//  とき、これをバトルエリアに出し、ストライクしてきた敵軍ユニットとバトルしてもよい。そうしたとき、そのストライクは無効になる。」（atwiki/page-660。
//  rules/strikeReactions.ts collectFiveTechInterceptors から呼ぶ）

/** 自軍ラッシュエリアで RK-111 にライドしている S ユニットか。 */
export function rk6RidesGuardChaserInRush(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, card: CardInstance): boolean {
  if (!card.mountedOnInstanceId || !isUnitCard(state, card.cardId) || !rk1IsSmallNow(state, card)) return false;
  const rush = state.players[playerId].rush;
  if (!rush.some((c) => c.instanceId === card.instanceId)) return false;
  const vehicle = rush.find((c) => c.instanceId === card.mountedOnInstanceId);
  return !!vehicle && isSameCardIdentity(vehicle.cardId, "RK-111");
}
