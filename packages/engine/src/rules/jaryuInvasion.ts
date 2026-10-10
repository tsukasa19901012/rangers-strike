/**
 * RS-242 創造王リュウオーン【ジャリュウ一族の侵攻】:
 * これが自軍ラッシュエリアにある間、自分が特徴「戦闘員」を持つユニットのカードをラッシュするとき、
 * コマンドをホールドせずにラッシュしてもよい。ただしラッシュのための必要パワーと追加条件は満たすこと。
 *
 * - 手札のカードはユニットではないので、カードに印刷された特徴で判定する（デウス遺伝子で加わった特徴は使えない。
 *   faq-card-4 RS-242 Q3・RS-203 Q5）。
 * - 何体でもラッシュできる（faq-card-4 RS-242 Q1）。ホールドしてふつうにラッシュしてもよい。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";

const RYUOON_CARD_ID = "RS-242";
const GRUNT_FEATURE = "戦闘員";

export function jaryuInvasionAllowsRushWithoutHold(
  state: Pick<GameState, "players">,
  playerId: PlayerId,
  definition: CardDefinition | undefined,
): boolean {
  if (!definition || definition.type !== "unit") return false;
  if (!(definition.features ?? []).includes(GRUNT_FEATURE)) return false;
  return state.players[playerId].rush.some((c) => c.cardId === RYUOON_CARD_ID);
}
