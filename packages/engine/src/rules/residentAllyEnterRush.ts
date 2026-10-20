/**
 * 常駐オペレーション「自軍バトルフェイズ中、特徴「X」を持つ自軍Sユニットがバトルエリアに出たとき、次の効果を発動できる
 * ⇒バトルエリアに出たユニットの必要パワーの数字よりも、必要パワーの数字が小さいWBのMユニットのカードを、自分の手札から
 * 1枚選び、自軍ラッシュエリアに出す。」（RS-436 激気）。文言で判定する（カードを列挙しない）。
 *
 * 特徴は効果で追加されたものも含めて見る（rules/addedFeatures の unitFeatures）。発動は任意（見送れる）。
 * 手札から出すのは効果によるラッシュ（R-RUSH-20: 必要パワー・追加条件・ホールドは不要。R-RUSH-22: 「ラッシュしたとき」は誘発する）。
 */
import type { Category } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { cardCategories, getDefinition, parsePowerCost, unitSizeOf } from "../core/catalog";
import { unitFeatures } from "./addedFeatures";
import { startEffectRush } from "./effectRush";
import { xg1HandCardAddedCategories } from "./xg1/xg1Fields";

const RESIDENT_ALLY_ENTER_RUSH_RE =
  /自軍バトルフェイズ中、特徴「([^」]+)」を持つ自軍(S|M|L)ユニットがバトルエリアに出たとき、次の効果を発動できる\s*⇒\s*バトルエリアに出たユニットの必要パワーの数字よりも、必要パワーの数字が小さい([A-Z]{2})の(S|M|L)ユニットのカードを、自分の手札から1枚選び、自軍ラッシュエリアに出す/;

const CATEGORY_LONG_NAMES: Readonly<Record<string, Category>> = {
  アーステクノロジー: "ET",
  ワイルドビースト: "WB",
  オーバーテクノロジー: "OT",
  ミスティックアームズ: "MA",
  ダークアライアンス: "DA",
};

function normalizeCategoryNames(text: string): string {
  return text.replace(/(アーステクノロジー|ワイルドビースト|オーバーテクノロジー|ミスティックアームズ|ダークアライアンス)の/g, (_, n: string) => `${CATEGORY_LONG_NAMES[n]}の`);
}

type Parsed = { feature: string; enteringSize: string; category: Category; size: string };

const parsedCache = new Map<string, Parsed | null>();

function parse(state: GameState, cardId: string): Parsed | null {
  if (parsedCache.has(cardId)) return parsedCache.get(cardId)!;
  const def = getDefinition(state.definitions, cardId);
  // 再録（PR-021）の「ワイルドビースト」「Ｓユニット」の表記も同じに読む。
  const text = def?.type === "operation" ? normalizeCategoryNames((def.text ?? "").normalize("NFKC")) : "";
  const m = /^※常駐/.test(text) ? text.match(RESIDENT_ALLY_ENTER_RUSH_RE) : null;
  const parsed = m ? { feature: m[1]!, enteringSize: m[2]!, category: m[3] as Category, size: m[4]! } : null;
  parsedCache.set(cardId, parsed);
  return parsed;
}

/** 自軍ユニットがバトルエリアに出たとき、常駐置き場の該当カードの効果（任意）を開く。 */
export function tryResidentRushOnAllyEnterBattle(
  state: GameState,
  playerId: PlayerId,
  entering: CardInstance,
): GameState {
  if (state.phase !== "battle" || state.activePlayer !== playerId) return state;
  if (state.pendingEffectChoice || state.pendingEffectRush) return state;
  const enteringDef = getDefinition(state.definitions, entering.cardId);
  if (enteringDef?.type !== "unit") return state;
  const player = state.players[playerId];
  for (const op of player.operation) {
    const parsed = parse(state, op.cardId);
    if (!parsed) continue;
    if (unitSizeOf(state.definitions, entering) !== parsed.enteringSize) continue;
    if (!unitFeatures(state, playerId, entering).includes(parsed.feature)) continue;
    const enteringCost = parsePowerCost(enteringDef.powerCost ?? 0);
    const candidates = player.hand
      .filter((c) => {
        const def = getDefinition(state.definitions, c.cardId);
        return (
          def?.type === "unit" &&
          unitSizeOf(state.definitions, c) === parsed.size &&
          // XG1-031 ゴーオンレッドの※（手札の炎神に WB。rules/xg1/xg1Fields.ts）。
          (cardCategories(def).includes(parsed.category) || xg1HandCardAddedCategories(state, playerId, c.cardId).includes(parsed.category)) &&
          parsePowerCost(def.powerCost ?? 99) < enteringCost
        );
      })
      .map((c) => c.instanceId);
    if (candidates.length === 0) continue;
    const next = startEffectRush(state, {
      playerId,
      phasePlayerId: playerId,
      effectId: "resident_ally_enter_rush",
      sourceCardId: op.cardId,
      sourceInstanceId: op.instanceId,
      fromZone: "hand",
      candidates,
      maxCount: 1,
      requireConditions: false,
      alwaysAsk: true,
    });
    if (next !== state) return next;
  }
  return state;
}
