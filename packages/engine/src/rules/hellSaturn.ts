/**
 * RS-364 ヘルサターン総統【黒き太陽神への忠誠】（atwiki/page-576・grnrngr/faq-card-6 RS-364）:
 * 「これが自軍エリアにある間、自軍ユニットがすべてDAなら、「ヘルサターン総統」以外の自軍Sユニットは次の効果を得る⇒
 *  「これは自軍コマンドを1つホールドしなければバトルエリアに出られない。」と書かれているかのように扱い、BP＋3000され、
 *  BP8000以上のとき「SP1」になる。」
 *
 * - 自軍エリア＝自軍ラッシュエリア・バトルエリア。複数あれば BP+3000 は重複する（Q3）が、
 *   ホールドの要件は「書かれているかのように扱う」だけなので 1 つ（Q5）。
 * - 「すべてDA」はバトルエリアで追加されたカテゴリや効果で追加された DA を含めて判定する（Q6）。
 * - ホールドの要件は RS-243 獣奏剣で無効にできる（Q4。requiredBattleEntryHolds の獣奏剣の判定より前に加える）。
 */
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getDefinition, unitEffectiveCategories } from "../core/catalog";

const HELL_SATURN_ID = "RS-364";
const HELL_SATURN_NAME = "ヘルサターン総統";

/** instance（playerId の S ユニット）に効果を与えている RS-364 の数。条件を満たさなければ 0。 */
export function hellSaturnGrantCount(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  const def = getDefinition(state.definitions, instance.cardId);
  if (!def || def.type !== "unit" || def.size !== "S" || def.name === HELL_SATURN_NAME) return 0;
  const player = state.players[playerId];
  const count =
    player.rush.filter((c) => c.cardId === HELL_SATURN_ID).length +
    player.battle.filter((c) => c.cardId === HELL_SATURN_ID).length;
  if (count === 0) return 0;
  const isOwnUnit = (zone: "rush" | "battle") => player[zone].some((c) => c.instanceId === instance.instanceId);
  if (!isOwnUnit("rush") && !isOwnUnit("battle")) return 0;
  const allDa = (["rush", "battle"] as const).every((zone) =>
    player[zone].every((c) => {
      const d = getDefinition(state.definitions, c.cardId);
      if (d?.type !== "unit") return true;
      return unitEffectiveCategories(state, playerId, c, zone).includes("DA");
    }),
  );
  return allDa ? count : 0;
}
