// 対戦の始めに自分のデッキの中身から決める、プレイの方針。
// 自分のカード（全ゾーン）は対戦中ずっと同じ顔ぶれなので、定義表（対戦ごとに作られる）ごとに 1 度だけ数える。
import type { GameState, PlayerId } from "../types/game";
import { getDefinition, parsePowerCost } from "../core/catalog";

export type DeckProfile = {
  /** デッキで一番重いユニット・オペレーションの必要パワー。これ以上パワーを溜めても使い道がない。 */
  maxPowerCost: number;
  /**
   * 切り札（デッキで一番重い「合体―」ユニット）と、その合体の文に名前が出てくる自分のデッキのカード。
   * 人は「切り札をラッシュする道筋だけは無くさない」ようにチャージする（残りを山札から引けるか、コマンドを回収できるかを見る）。
   */
  keyCards: ReadonlySet<string>;
  /** 自軍コマンドを手札に戻す手段（XG1-088 バイクルなど）がデッキにあるか。あればキーカードをコマンドに置いても取り戻せる。 */
  commandRecovery: boolean;
};

const cache = new WeakMap<object, Partial<Record<PlayerId, DeckProfile>>>();

export function deckProfile(state: GameState, playerId: PlayerId): DeckProfile {
  const byPlayer = cache.get(state.definitions) ?? {};
  const cached = byPlayer[playerId];
  if (cached) return cached;
  const p = state.players[playerId];
  let maxPowerCost = 0;
  for (const card of [...p.deck, ...p.hand, ...p.rush, ...p.battle, ...p.power, ...p.command, ...p.operation, ...p.discard]) {
    const def = getDefinition(state.definitions, card.cardId);
    if (!def || (def.type !== "unit" && def.type !== "operation")) continue;
    maxPowerCost = Math.max(maxPowerCost, parsePowerCost(def.powerCost));
  }
  const all = [...p.deck, ...p.hand, ...p.rush, ...p.battle, ...p.power, ...p.command, ...p.operation, ...p.discard];
  const defs = all.map((c) => getDefinition(state.definitions, c.cardId)).filter((d): d is NonNullable<typeof d> => !!d);
  const keyCards = new Set<string>();
  let commandRecovery = false;
  for (const def of defs) {
    if (def.text && /自軍コマンド[^。]*?(?:自分の)?手札に戻/.test(def.text)) commandRecovery = true;
    if (def.type !== "unit" || !def.text?.includes("合体―") || parsePowerCost(def.powerCost) < maxPowerCost) continue;
    keyCards.add(def.id);
    const line = def.text.slice(def.text.indexOf("合体―"), def.text.indexOf("合体―") + 200).split(/[※【]/)[0]!;
    for (const other of defs) if (other.id !== def.id && other.type === "unit" && other.name && line.includes(other.name)) keyCards.add(other.id);
  }
  const profile = { maxPowerCost, keyCards, commandRecovery };
  byPlayer[playerId] = profile;
  cache.set(state.definitions, byPlayer);
  return profile;
}
