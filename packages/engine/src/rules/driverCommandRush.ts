/**
 * コマンドゾーンのドライバーをホールドして、特徴を持つユニットカードをラッシュする※。
 * - XG7-045 ロストドライバー（atwiki/page-2399）・XP-015 ダブルドライバー（atwiki/page-1880）
 *   「※これが自軍コマンドゾーンにある間、自軍ラッシュフェイズ中、これをホールドして、自分の手札から特徴「X」を持つユニットカードを
 *    1枚選び、自軍ラッシュエリアに出してもよい。ただし、必要パワーと追加条件は満たすこと。」
 * 手札からのラッシュの支払い（category_use）で、これをカテゴリを問わないコマンドとしてホールドできるようにする
 * （カード評価「特徴「ダブルドライバー」持ちのユニットを何でもラッシュできる万能コマンド」）。必要パワー・追加条件は通常のラッシュと同じに確かめる。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";

const DRIVER_COMMANDS: ReadonlyArray<{ cardId: string; feature: string }> = [
  { cardId: "XG7-045", feature: "ロストドライバー" },
  { cardId: "XP-015", feature: "ダブルドライバー" },
];

/** rushingCardId のユニットを手札からラッシュするとき、カテゴリを問わずホールドできる自軍コマンド（リリース状態のドライバー）。 */
export function driverCommandRushIds(
  state: Pick<GameState, "players" | "definitions" | "phase" | "activePlayer">,
  playerId: PlayerId,
  rushingCardId: string | undefined,
): string[] {
  if (!rushingCardId) return [];
  if (state.phase !== "rush" || state.activePlayer !== playerId) return [];
  const def = getDefinition(state.definitions, rushingCardId);
  if (!def || def.type !== "unit") return [];
  const features = def.features ?? [];
  return state.players[playerId].command
    .filter((c) => !c.commandHeld && DRIVER_COMMANDS.some((d) => isSameCardIdentity(c.cardId, d.cardId) && features.includes(d.feature)))
    .map((c) => c.instanceId);
}
