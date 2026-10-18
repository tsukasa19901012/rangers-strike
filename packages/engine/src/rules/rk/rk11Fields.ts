/**
 * ザ・マスクドライダーEXP vol.3 RK-211〜RK-231 の継続効果の判定（低い層から呼ぶ小さなモジュール。rules/rk/rk11UnitEffects.ts が記録を書く）。
 * core/catalog.ts からも呼ぶので、core/catalog.ts を import しない（定義は state.definitions を直接見る）。
 *
 * - `rk11RushSubstituteFor`: RK-217 イーグルアンデッド・RK-218 ピーコックアンデッドの※（手札のこれを捨札にすれば「X」を捨札にしたことにできる。
 *   rules/zord.ts・rules/zordDown.ts・core/applyAction.ts）。
 * - `rk11UsePrintedDefenderBp`: RK-215【スペード2―スラッシュ】で得た能力（rules/namedUnitEffects.ts）。
 * - `rk11EffectiveSp`: RK-218【下級アンデッドを操る者】・RK-221【音撃打・火炎連打】・RK-222【音撃打・灼熱真紅の型】の「SP1」（rules/legend3/fieldEffects.ts）。
 * - `rk11AttackerCanAttackRush`: RK-217【滑空攻撃】（rules/legend3/restrictions.ts canAttackDefender）。
 * - `rk11KyosukeWinButDestroyed`: RK-224 京介変身体【サポート】（rules/operationCounters.ts のバトルの解決）。
 * - `rk11CounterCostReduction`: RK-225 仮面ライダー朱鬼【陰陽術】（core/catalog.ts canPlayOperationExceptCommandHold）。
 * - `rk11EntryDiscardFeature`: RK-220 アルビノジョーカーの※（rules/legend3/restrictions.ts のバトル進入の捨札）。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PlayerId } from "../../types/game";
import { getPlayerModifiers } from "../../core/scopedModifiers";

/** RK-215 で能力を得たユニット（payload: { instanceId }）。 */
export const RK11_LIZARD_RULE = "rk215_spade2_slash";
/** RK-216 で能力を得たユニット（payload: { instanceId }）。 */
export const RK11_DRAGONFLY_RULE = "rk216_heart4_float";
/** このターン「SP1」になったユニット（payload: { instanceId }。RK-218・RK-221・RK-222）。 */
export const RK11_SP1_RULE = "rk11_sp1";
/** RK-218 で選ばれ、ターンを終えるとき撃破されるユニット（payload: { instanceId }）。 */
export const RK11_PEACOCK_DESTROY_RULE = "rk218_destroy_at_end";
/** RK-221・RK-222 で「このターンを終えるときホールド状態なら、リリースしてもよい」を得たユニット（payload: { instanceId, cardId }）。 */
export const RK11_RELEASE_AT_END_RULE = "rk11_release_at_end";

const PLAYERS: PlayerId[] = ["player1", "player2"];

function def(state: Pick<GameState, "definitions">, cardId: string): CardDefinition | undefined {
  return state.definitions[cardId];
}

function fieldOf(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

function opponentOf(playerId: PlayerId): PlayerId {
  return playerId === "player1" ? "player2" : "player1";
}

/** このターンの記録（kind "rule"・scope "turn"）の payload。 */
export function rk11TurnPayloads<T>(state: Pick<GameState, "players">, playerId: PlayerId, ruleId: string): T[] {
  return getPlayerModifiers(state.players[playerId])
    .filter((m) => m.kind === "rule" && m.ruleId === ruleId && m.scope === "turn")
    .map((m) => (m as { payload?: unknown }).payload as T)
    .filter((p): p is T => p !== undefined && p !== null);
}

export function rk11HasInstancePayload(state: Pick<GameState, "players">, playerId: PlayerId, ruleId: string, instanceId: string): boolean {
  return rk11TurnPayloads<{ instanceId?: string }>(state, playerId, ruleId).some((p) => p?.instanceId === instanceId);
}

function normalizeName(name: string | undefined): string {
  return (name ?? "").normalize("NFKC").replace(/\s/g, "");
}

/**
 * RK-217「※これが自分の手札にある間、自分が「仮面ライダーブレイドJF」をラッシュするとき、これを捨札にすれば、自軍「仮面ライダーブレイド」を
 * 1体捨札にしたことにできる。」（atwiki/page-904）・RK-218（「仮面ライダーギャレンJF」・「仮面ライダーギャレン」。atwiki/page-945）。
 * substituteCardId が rushingCardId をラッシュするときの「かわり」になるなら true（手札にあるかは呼び出し側で確かめる）。
 */
const SUBSTITUTES: Record<string, string> = { "RK-217": "仮面ライダーブレイドJF", "RK-218": "仮面ライダーギャレンJF" };

export function rk11RushSubstituteFor(state: Pick<GameState, "definitions">, substituteCardId: string, rushingCardId: string): boolean {
  const target = Object.entries(SUBSTITUTES).find(([id]) => isSameCardIdentity(substituteCardId, id))?.[1];
  if (!target) return false;
  return normalizeName(def(state, rushingCardId)?.name) === normalizeName(target);
}

/** 手札にある substitute（RK-217・RK-218）が、rushingCardId の追加条件の「捨札にしたことにできる」かわりか。 */
export function rk11IsHandSubstitute(
  state: Pick<GameState, "definitions">,
  hand: CardInstance[],
  card: CardInstance,
  rushingCardId: string,
): boolean {
  return hand.some((c) => c.instanceId === card.instanceId) && rk11RushSubstituteFor(state, card.cardId, rushingCardId);
}

/**
 * RK-215【スペード2―スラッシュ】で得た能力「これがアタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルする。」
 * （atwiki/page-943）。アタックしたバトルだけ（効果のバトルは対象外）。
 */
export function rk11UsePrintedDefenderBp(state: Pick<GameState, "players">, pending: Pick<PendingBattle, "attackerPlayerId" | "attackerInstanceId" | "effectBattle">): boolean {
  if (pending.effectBattle) return false;
  return rk11HasInstancePayload(state, pending.attackerPlayerId, RK11_LIZARD_RULE, pending.attackerInstanceId);
}

/** このターン「SP1」になったユニット（RK-218・RK-221・RK-222）。 */
export function rk11EffectiveSp(state: Pick<GameState, "players">, playerId: PlayerId, instance: CardInstance, sp: number): number {
  if (!rk11HasInstancePayload(state, playerId, RK11_SP1_RULE, instance.instanceId)) return sp;
  return Math.max(sp, 1);
}

/** RK-217【滑空攻撃】「これは敵軍ラッシュエリアのレジストを持つユニットにアタックできる。」（atwiki/page-904）。hasResist は呼び出し側の判定。 */
export function rk11AttackerCanAttackRush(attacker: CardInstance, defenderHasResist: () => boolean): boolean {
  return isSameCardIdentity(attacker.cardId, "RK-217") && defenderHasResist();
}

/**
 * RK-224 京介変身体【サポート】「これが自軍エリアにある間、敵軍バトルエリアのSユニットは、「これは敵軍ターン中、SP1以上のユニットとバトルしたとき
 * バトルに勝っても撃破される」と書かれているかのように扱う。」（atwiki/page-900）。
 * ownerId のユニット instanceId が、今その能力を持つか（敵軍ターン中＝ownerId から見た相手のターン）。SP1 以上の判定は呼び出し側。
 */
export function rk11KyosukeWinButDestroyed(state: Pick<GameState, "players" | "definitions" | "activePlayer">, ownerId: PlayerId, instanceId: string): boolean {
  const enemyId = opponentOf(ownerId);
  if (state.activePlayer !== enemyId) return false;
  const unit = state.players[ownerId].battle.find((c) => c.instanceId === instanceId);
  if (!unit) return false;
  const d = def(state, unit.cardId);
  if (d?.type !== "unit" || d.size !== "S") return false;
  return fieldOf(state, enemyId).some((c) => isSameCardIdentity(c.cardId, "RK-224"));
}

/**
 * RK-225 仮面ライダー朱鬼【陰陽術】「これが自軍エリアにある間（これをラッシュしたときも含む）、自分も相手もカウンターを持つオペレーションカードを
 * 使用するとき、その必要パワーの数字は3少なくなる（この効果は重複しない）。」（atwiki/page-901）。どちらかの場に朱鬼があれば3。
 */
export function rk11CounterCostReduction(state: Pick<GameState, "players">, definition: Pick<CardDefinition, "type" | "text">): number {
  if (definition.type !== "operation") return 0;
  if (!/※カウンター/.test((definition.text ?? "").normalize("NFKC"))) return 0;
  return PLAYERS.some((pid) => fieldOf(state, pid).some((c) => isSameCardIdentity(c.cardId, "RK-225"))) ? 3 : 0;
}

/** RK-220「※これは自軍ラッシュエリアの特徴「アンデッド」を持つユニットを1体捨札にしなければバトルエリアに出られない。」（atwiki/page-947）。 */
export function rk11EntryDiscardFeature(cardId: string): string | undefined {
  return isSameCardIdentity(cardId, "RK-220") ? "アンデッド" : undefined;
}
