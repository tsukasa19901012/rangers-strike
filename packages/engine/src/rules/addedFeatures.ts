/**
 * 効果で追加された特徴（このターンだけ）。
 *
 * - RS-203 大帝ラー・デウス【デウス遺伝子】: これをラッシュしたターン、追加条件で捨札にしたユニットのカードの特徴を、
 *   すべてのユニット（自軍・敵軍、あとからラッシュしたユニットも）の特徴に追加する（atwiki/page-383・
 *   grnrngr/faq-card-4 RS-203 Q1/Q4）。手札のカードはユニットではないので対象外（同 Q5）。
 * - RS-206 シシレンジャー【天幻星・霧隠れ】: このターン、このユニットは選んだユニットの特徴が追加される（atwiki/page-117）。
 */
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { getPlayerModifiers } from "../core/scopedModifiers";

export const DEUS_GENE_RULE_ID = "deus_gene_features";
export const KIRIGAKURE_RULE_ID = "kirigakure_features";

type DeusPayload = { features: string[] };
type KirigakurePayload = { instanceId: string; features: string[] };

function turnRulePayloads<T>(player: PlayerState, ruleId: string): T[] {
  return getPlayerModifiers(player)
    .filter((m) => m.kind === "rule" && m.ruleId === ruleId && m.scope === "turn")
    .map((m) => (m as { payload?: unknown }).payload as T)
    .filter((p): p is T => !!p);
}

/** このターンだけの特徴追加を記録する（同じ規則 ID でも重ねて記録する）。 */
export function addTurnFeatureModifier(
  player: PlayerState,
  ruleId: typeof DEUS_GENE_RULE_ID | typeof KIRIGAKURE_RULE_ID,
  payload: DeusPayload | KirigakurePayload,
  sourceCardId: string,
): PlayerState {
  return {
    ...player,
    modifiers: [...getPlayerModifiers(player), { kind: "rule", ruleId, scope: "turn", payload, sourceCardId }],
  };
}

/** 場のユニットの特徴（カードの特徴＋このターン効果で追加された特徴）。 */
export function unitFeatures(
  state: Pick<GameState, "players" | "definitions">,
  _ownerId: PlayerId,
  instance: Pick<CardInstance, "cardId" | "instanceId">,
): string[] {
  const base = state.definitions[instance.cardId]?.features ?? [];
  const extra: string[] = [];
  for (const pid of ["player1", "player2"] as const) {
    const player = state.players[pid];
    for (const p of turnRulePayloads<DeusPayload>(player, DEUS_GENE_RULE_ID)) extra.push(...p.features);
    for (const p of turnRulePayloads<KirigakurePayload>(player, KIRIGAKURE_RULE_ID)) {
      if (p.instanceId === instance.instanceId) extra.push(...p.features);
    }
  }
  if (extra.length === 0) return base;
  return [...new Set([...base, ...extra])];
}
