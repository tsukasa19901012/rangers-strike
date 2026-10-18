/**
 * ザ・マスクドライダーEXP vol.3〜4 RK-232〜RK-252 の継続効果の判定（低い層から呼ぶ小さなモジュール。rules/rk/rk12UnitEffects.ts が記録を書く）。
 * core/catalog.ts・rules/addedFeatures.ts からも呼ぶので、core/catalog.ts を import しない（定義は state.definitions を直接見る）。
 *
 * - `rk12EffectiveSp`: RK-240 仮面ライダー電王CF（2nd）の※（特徴「仮面ライダー」を持つ自軍ユニットがホールドされたターン「SP1」。rules/legend3/fieldEffects.ts）。
 * - `rk12BlocksBattleEntry`: RK-247 仮面ライダーネガ電王の※（自軍ユニットがホールドされたターンにしか出られない。rules/restrictions.ts）。
 * - `rk12RequiresBattleEntry`: RK-247【不敵な挑発】（特徴「警察」を持つユニットは可能なら毎ターン出る。rules/restrictions.ts）。
 * - `rk12ResidentsNegated`: RK-248 パラダイス・ロスト（このターン、相手の常駐オペレーションは無効。rules/rk/rk1Features.ts・core/catalog.ts 等）。
 * - `rk12FieldBpBonus`・`rk12AddedFeatures`: RK-250 サバイブを重ねたユニット（BP+1500・特徴「サバイブ」）、RK-242 クライマックス刑事（イマジンに「警察」）。
 * - `rk12PlacesHeldOnRush`: RK-245 仮面ライダーキバ等の「※これはラッシュするとき、可能ならホールド状態で置く。」（core/applyAction.ts・rules/effectRush.ts）。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import { getPlayerModifiers } from "../../core/scopedModifiers";

/** このターン、ホールドされた自軍ユニット（payload: { instanceId, cardId, features }。ユニットの持ち主の記録）。 */
export const RK12_UNIT_HELD_RULE = "rk12_unit_held";
/** RK-242 クライマックス刑事の「そうしたとき」（payload: { cardId }。使ったプレイヤーの記録）。 */
export const RK12_CLIMAX_POLICE_RULE = "rk242_imagin_police";
/** RK-248 パラダイス・ロストの「そうしたとき」（payload: { cardId }。使ったプレイヤーの記録。相手の常駐が無効）。 */
export const RK12_PARADISE_LOST_RULE = "rk248_residents_negated";

export const SURVIVE_CARD_ID = "RK-250";

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
export function rk12TurnPayloads<T>(state: Pick<GameState, "players">, playerId: PlayerId, ruleId: string): T[] {
  return getPlayerModifiers(state.players[playerId])
    .filter((m) => m.kind === "rule" && m.ruleId === ruleId && m.scope === "turn")
    .map((m) => (m as { payload?: unknown }).payload as T)
    .filter((p): p is T => p !== undefined && p !== null);
}

function hasRule(state: Pick<GameState, "players">, playerId: PlayerId, ruleId: string): boolean {
  return getPlayerModifiers(state.players[playerId]).some((m) => m.kind === "rule" && m.ruleId === ruleId && m.scope === "turn");
}

/** このターン、ownerId のユニットがホールドされたか（feature を渡せば、その特徴を持つユニット）。 */
export function rk12UnitHeldThisTurn(state: Pick<GameState, "players">, ownerId: PlayerId, feature?: string): boolean {
  return rk12TurnPayloads<{ features?: string[] }>(state, ownerId, RK12_UNIT_HELD_RULE).some((p) => !feature || (p.features ?? []).includes(feature));
}

/** RK-240「※これは特徴「仮面ライダー」を持つ自軍ユニットがホールドされたターン「SP1」になる。」（atwiki/page-954）。 */
export function rk12EffectiveSp(state: Pick<GameState, "players">, playerId: PlayerId, instance: CardInstance, sp: number): number {
  if (!isSameCardIdentity(instance.cardId, "RK-240")) return sp;
  return rk12UnitHeldThisTurn(state, playerId, "仮面ライダー") ? Math.max(sp, 1) : sp;
}

/** RK-247「※これは自軍ユニットがホールドされたターンにしかバトルエリアに出られない。」（atwiki/page-1011）。 */
export function rk12BlocksBattleEntry(state: Pick<GameState, "players">, playerId: PlayerId, unit: CardInstance): boolean {
  if (!isSameCardIdentity(unit.cardId, "RK-247")) return false;
  return !rk12UnitHeldThisTurn(state, playerId);
}

/**
 * RK-247【不敵な挑発】「これが自軍エリアにある間、次の効果を発動する⇒特徴「警察」を持つユニットは、可能なら毎ターンバトルエリアに出る。」
 * （atwiki/page-1011）。どちらの場にネガ電王があっても、両プレイヤーの「警察」のユニットが対象（自軍・敵軍の限定がない）。features はいまの特徴。
 */
export function rk12RequiresBattleEntry(state: Pick<GameState, "players">, features: string[]): boolean {
  if (!features.includes("警察")) return false;
  return PLAYERS.some((pid) => fieldOf(state, pid).some((c) => isSameCardIdentity(c.cardId, "RK-247")));
}

/** RK-248「そうしたとき、このターン、相手の常駐オペレーションは無効になる。」（atwiki/page-951）。ownerId の常駐が無効か。 */
export function rk12ResidentsNegated(state: Pick<GameState, "players">, ownerId: PlayerId): boolean {
  return hasRule(state, opponentOf(ownerId), RK12_PARADISE_LOST_RULE);
}

/** RK-250 サバイブを重ねた枚数。 */
export function surviveCount(instance: Pick<CardInstance, "stackedCards"> | undefined): number {
  return (instance?.stackedCards ?? []).filter((c) => isSameCardIdentity(c.cardId, SURVIVE_CARD_ID)).length;
}

/** RK-250「このカードに重ねたユニットは、BP+1500され」（atwiki/page-1350）。 */
export function rk12FieldBpBonus(instance: CardInstance): number {
  return 1500 * surviveCount(instance);
}

/** 場のユニットに追加される特徴（rules/addedFeatures.ts unitFeatures から呼ぶ）。 */
export function rk12AddedFeatures(
  state: Pick<GameState, "players" | "definitions">,
  ownerId: PlayerId,
  instance: Pick<CardInstance, "cardId" | "instanceId">,
  base: string[],
): string[] {
  const extra: string[] = [];
  // RK-250「特徴「サバイブ」が追加される」。
  if (surviveCount(instance as CardInstance) > 0) extra.push("サバイブ");
  // RK-242「このターン、特徴「イマジン」を持つ自軍ユニットは、…特徴「警察」を追加される」（atwiki/page-762）。
  if (base.includes("イマジン") && hasRule(state, ownerId, RK12_CLIMAX_POLICE_RULE)) extra.push("警察");
  return extra;
}

/** 「※これはラッシュするとき、可能ならホールド状態で置く。」を持つか（RK-245 等。文言で判定する）。 */
export function rk12PlacesHeldOnRush(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return /※これはラッシュするとき、可能ならホールド状態で置く/.test((def(state, cardId)?.text ?? "").normalize("NFKC"));
}
