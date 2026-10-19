/**
 * クロスギャザー ザ・ギガンティックタイタン（XG6）の継続効果の判定（cardSpec XG6 の監査）。ほかの処理の場所から呼ぶ小さな判定だけを置く。
 *
 * - `xg6FieldBpBonus`: XG6-013 英雄タイタンの※（BP-1000）・XG6-021【激臨剣】の能力（BP+2000。rules/fieldAuras.ts）。
 * - `xg6EffectiveSp`: XG6-021【激臨剣】の能力（BP20000以上で「SP2」。rules/legend3/fieldEffects.ts）。
 * - `xg6CommandCategories` / `xg6CommandPowerBonus`: XG6-013【未来の戦士達へ】（core/catalog.ts・core/power.ts）。
 * - `xg6LoseDamageThreshold`: XG6-020【究極の大冒険】（core/createGame.ts）。
 * - `xg6BlocksAttack`: XG6-012 フラッシュタイタンの※（rules/legend3/restrictions.ts）。
 * - `xg6GrantsBlast`: XG6-004 フルブラスト・アクション（keywords/battleKeywords.ts）。
 * - ターン中の記録（`hasXg6Mark` 等。GameState.xg6）。
 */
import { cardCategories, isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../../types/game";
import { hasTurnRuleModifier } from "../../core/scopedModifiers";

type Marks = NonNullable<NonNullable<GameState["xg6"]>["marks"]>;
type Mark = Marks[number];

export const XG6_BLAST_RULE_ID = "xg6_004_full_blast";

/** このターンの記録（key・playerId・instanceId が一致するもの）。 */
export function xg6Marks(state: Pick<GameState, "xg6" | "turn">, key: string, playerId?: PlayerId, instanceId?: string): Mark[] {
  return (state.xg6?.marks ?? []).filter(
    (m) => m.key === key && m.turn === state.turn && (!playerId || m.playerId === playerId) && (!instanceId || m.instanceId === instanceId),
  );
}

export function hasXg6Mark(state: Pick<GameState, "xg6" | "turn">, key: string, playerId?: PlayerId, instanceId?: string): boolean {
  return xg6Marks(state, key, playerId, instanceId).length > 0;
}

/** このターンの記録を足す（前のターンの記録は消す）。 */
export function addXg6Mark(state: GameState, mark: Omit<Mark, "turn">): GameState {
  const kept = (state.xg6?.marks ?? []).filter((m) => m.turn === state.turn);
  return { ...state, xg6: { ...state.xg6, marks: [...kept, { ...mark, turn: state.turn }] } };
}

export function removeXg6Marks(state: GameState, key: string, instanceId?: string): GameState {
  const marks = state.xg6?.marks ?? [];
  if (!marks.some((m) => m.key === key && (!instanceId || m.instanceId === instanceId))) return state;
  return { ...state, xg6: { ...state.xg6, marks: marks.filter((m) => !(m.key === key && (!instanceId || m.instanceId === instanceId))) } };
}

function printedCategories(state: Pick<GameState, "definitions">, cardId: string): string[] {
  return cardCategories(state.definitions[cardId]) as string[];
}

function fieldOf(player: Pick<PlayerState, "battle" | "rush">): CardInstance[] {
  return [...player.battle, ...player.rush];
}

/** 自軍捨札にあるカテゴリを2つ以上持つカードの枚数（XG6-021・XG6-022）。 */
export function xg6MultiCategoryDiscardCount(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId): number {
  return state.players[playerId].discard.filter((c) => printedCategories(state, c.cardId).length >= 2).length;
}

/** XG6-021【激臨剣】の能力を得ているユニットか（このターン）。 */
function hasGekirinken(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  return hasXg6Mark(state, "XG6-021", playerId, instanceId);
}

export function xg6FieldBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  let bonus = 0;
  // XG6-013 英雄タイタン「※これは、「OT」以外のカテゴリを持つコマンド1つにつきBP-1000される。」（両軍のコマンド。atwiki/page-2326）
  if (isSameCardIdentity(instance.cardId, "XG6-013")) {
    const count = (["player1", "player2"] as const).reduce(
      (sum, pid) =>
        sum +
        state.players[pid].command.filter((c) => xg6CommandCategories(c.cardId, printedCategories(state, c.cardId)).some((cat) => cat !== "OT")).length,
      0,
    );
    bonus -= 1000 * count;
  }
  // XG6-021【激臨剣】「これは、自軍捨札にあるカテゴリを2つ以上持つカード1枚につきBP+2000され」（atwiki/page-2351）
  if (hasGekirinken(state, playerId, instance.instanceId)) bonus += 2000 * xg6MultiCategoryDiscardCount(state, playerId);
  return bonus;
}

export function xg6EffectiveSp(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  sp: number,
  bpOf: (state: GameState, playerId: PlayerId, instance: CardInstance) => number,
): number {
  // XG6-021【激臨剣】「BP20000以上のとき「SP2」になる」
  if (hasGekirinken(state, playerId, instance.instanceId) && bpOf(state, playerId, instance) >= 20000) return Math.max(sp, 2);
  return sp;
}

/** XG6-013【未来の戦士達へ】「これが自軍コマンドゾーンにある間、このカードはカテゴリにWB、MA、ETが追加され」 */
export function xg6CommandCategories<T extends string>(cardId: string, printed: T[]): T[] {
  if (!isSameCardIdentity(cardId, "XG6-013")) return printed;
  return [...new Set([...printed, "WB", "MA", "ET"] as T[])];
}

/**
 * コマンドゾーンのカードが相手のパワーに足す数（マルチカテゴリの1を含む）。XG6-013 はカテゴリが追加されてマルチカテゴリになり（1）、
 * 「敵軍パワーは追加で2増える」（2）。それ以外は 0（呼び出し側の印刷のマルチカテゴリの判定に任せる）。
 */
export function xg6CommandPowerBonus(cardId: string): number {
  return isSameCardIdentity(cardId, "XG6-013") ? 3 : 0;
}

/** XG6-020【究極の大冒険】「これが自軍エリアにある間、自分はダメージが10点になるまでゲームに負けない。」 */
export function xg6LoseDamageThreshold(state: Pick<GameState, "players">, playerId: PlayerId): number {
  return fieldOf(state.players[playerId]).some((c) => isSameCardIdentity(c.cardId, "XG6-020")) ? 10 : 0;
}

/** XG6-012 フラッシュタイタン「※自軍「タイタンボーイ」があるとき、これはアタックすることができない。」 */
export function xg6BlocksAttack(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, attackerCardId: string): boolean {
  if (!isSameCardIdentity(attackerCardId, "XG6-012")) return false;
  return fieldOf(state.players[playerId]).some((c) => state.definitions[c.cardId]?.name === "タイタンボーイ");
}

/** XG6-004 フルブラスト・アクション: このターン、手札にあった BP16000 以下の L ユニットのカードはブラストを得る。 */
export function xg6GrantsBlast(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, cardId: string): boolean {
  const player = state.players[playerId];
  if (!hasTurnRuleModifier(player, XG6_BLAST_RULE_ID)) return false;
  const def = state.definitions[cardId];
  return def?.type === "unit" && def.size === "L" && typeof def.bp === "number" && def.bp <= 16000;
}
