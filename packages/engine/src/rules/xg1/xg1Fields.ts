/**
 * クロスギャザー XG1 の継続効果の判定（低水準。SP・アタックの制限・特徴やキーワードの付与など）。
 * 選択を開く処理（rules/xg1/xg1Effects.ts）からは独立させ、core/catalog.ts・rules/legend3/fieldEffects.ts 等から循環なく読めるようにする。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../../types/game";
import { rm1ResidentCount } from "../rm/rm1Fields";

type Defs = Pick<GameState, "definitions">;

function def(state: Defs, cardId: string): CardDefinition | undefined {
  return state.definitions[cardId];
}

function cats(state: Defs, cardId: string): string[] {
  const c = def(state, cardId)?.category;
  if (!c) return [];
  return (Array.isArray(c) ? c : [c]) as string[];
}

function other(playerId: PlayerId): PlayerId {
  return playerId === "player1" ? "player2" : "player1";
}

// ---------------------------------------------------------------------------
// SP

/** XG1-011【スペースメタルの魔剣】: 自軍ゾーンか敵軍ゾーン（パワーゾーン・コマンドゾーン）に OT を持つオモテ向きのカードがあるか。 */
function otFaceUpInZones(state: GameState): boolean {
  for (const pid of ["player1", "player2"] as const) {
    const p = state.players[pid];
    for (const c of [...p.power, ...p.command]) {
      if (c.faceDown) continue;
      if (cats(state, c.cardId).includes("OT")) return true;
    }
  }
  return false;
}

/**
 * XG1 の「SP1」になる継続効果（rules/legend3/fieldEffects.ts legend3EffectiveSp）。
 * - XG1-011 巨大バッカスフンド【スペースメタルの魔剣】（atwiki/page-1644）
 * - XG1-012 レッドパンチャー ※（自軍コマンドがすべてリリース状態。atwiki/page-1615）
 * - XG1-020 ターボロボ【高速剣ターボクラッシュ】（BP10000 以上。atwiki/page-1545）
 */
export function xg1EffectiveSp(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  sp: number,
  effectiveBp: (state: GameState, playerId: PlayerId, card: CardInstance) => number,
): number {
  const id = instance.cardId;
  if (isSameCardIdentity(id, "XG1-011") && otFaceUpInZones(state)) return Math.max(sp, 1);
  if (isSameCardIdentity(id, "XG1-012") && state.players[playerId].command.every((c) => !c.commandHeld)) return Math.max(sp, 1);
  if (isSameCardIdentity(id, "XG1-020") && effectiveBp(state, playerId, instance) >= 10000) return Math.max(sp, 1);
  return sp;
}

// ---------------------------------------------------------------------------
// アタックの制限

function areaHas(state: GameState, playerId: PlayerId, cardId: string, zones: Array<"battle" | "rush"> = ["battle", "rush"]): boolean {
  const p = state.players[playerId];
  return zones.some((z) => p[z].some((c) => isSameCardIdentity(c.cardId, cardId)));
}

/**
 * アタックされない（rules/legend3/restrictions.ts canAttackDefender）。
 * - XG1-017 シグナルマン【許可なき戦いへの介入】: これが自軍エリアにある間、自分も相手も — S ユニットは、追加条件を持つ M ユニット・SC ユニットに
 *   アタックできない（atwiki/page-1672）。
 * - XG1-018 サイレンダーPM【治安維持】: これが自軍バトルエリアにある間、相手は — S ユニットは、M・SC・L ユニットにアタックできない（atwiki/page-1585）。
 */
export function xg1DefenderBlocksAttack(state: GameState, attackerPlayerId: PlayerId, attacker: CardInstance, defenderPlayerId: PlayerId, defender: CardInstance): boolean {
  if (def(state, attacker.cardId)?.size !== "S") return false;
  const d = def(state, defender.cardId);
  if (!d || d.type !== "unit") return false;
  const size = d.size;
  if ((size === "M" || size === "SC") && d.rushAdditionalCondition && (areaHas(state, "player1", "XG1-017") || areaHas(state, "player2", "XG1-017"))) return true;
  if ((size === "M" || size === "SC" || size === "L") && areaHas(state, other(attackerPlayerId), "XG1-018", ["battle"])) return true;
  void defenderPlayerId;
  return false;
}

// ---------------------------------------------------------------------------
// XG1-015 宇宙警察（※常駐）
// 「特徴「警察」を持つSユニットはチェイスを得る。さらにそのユニットがOTを持つなら、特徴「宇宙刑事」が追加され、コールOTを得る。」（atwiki/page-1584）
// 得るのは常駐させたプレイヤー（自軍）のユニットだけ（ユーザー決定 2026-10-19 h–n。docs/rules/README.md §5.7）。

function policeResidentActive(state: Pick<GameState, "players">, ownerId: PlayerId): boolean {
  return rm1ResidentCount(state, ownerId, "XG1-015") > 0;
}

function isPoliceS(state: Defs, cardId: string, features?: string[]): boolean {
  const d = def(state, cardId);
  return !!d && d.type === "unit" && d.size === "S" && (features ?? d.features ?? []).includes("警察");
}

/** XG1-015: 追加される特徴（rules/addedFeatures.ts unitFeatures。features はいまの特徴）。 */
export function xg1AddedFeatures(state: Pick<GameState, "players" | "definitions">, ownerId: PlayerId, cardId: string, features: string[]): string[] {
  if (!policeResidentActive(state, ownerId)) return [];
  if (!isPoliceS(state, cardId, features) || !cats(state, cardId).includes("OT")) return [];
  return ["宇宙刑事"];
}

/** XG1-015: コールOT（rules/callLead.ts。owner はユニットの持ち主）。 */
export function xg1GrantsCallLead(owner: Pick<GameState["players"]["player1"], "operation">, definitions: GameState["definitions"], cardId: string, kind: "call" | "lead", category: string): boolean {
  if (kind !== "call" || category !== "OT") return false;
  if (!owner.operation.some((c) => isSameCardIdentity(c.cardId, "XG1-015"))) return false;
  const state = { definitions };
  return isPoliceS(state, cardId) && cats(state, cardId).includes("OT");
}

/**
 * XG1-015: チェイス（keywords/cardKeywords.ts cardHasKeyword）。持ち主が分からないときは、宇宙警察を常駐させたプレイヤーの場にそのカードがあるかで見る。
 */
export function xg1GrantsChase(state: GameState | null, playerId: PlayerId | undefined, cardId: string): boolean {
  if (!state || !isPoliceS(state, cardId)) return false;
  const owners: PlayerId[] = playerId ? [playerId] : (["player1", "player2"] as PlayerId[]).filter((pid) => [...state.players[pid].rush, ...state.players[pid].battle].some((c) => c.cardId === cardId));
  return owners.some((pid) => policeResidentActive(state, pid));
}

// ---------------------------------------------------------------------------
// XG1-013 キングピラミッダーPF【巨大要塞】
// 「これが自軍ラッシュエリアにある間、自分がラッシュするMユニットまたはLユニットの追加条件を満たすために次のようにしてもよい⇒
//   自軍Sユニットを1体捨札にするかわりに、自軍Sユニットを1体ホールドする。」（atwiki/page-1642）
// 置きかえるのは「自軍Sユニットを1体捨札にする」（conditionId send_s_unit_to_discard・1体）だけ。素材の行き先 "hold" で表す。

/** ラッシュする rushingCardId の追加条件を【巨大要塞】でホールドに置きかえられるか。 */
export function xg1HoldSubstituteAvailable(
  player: Pick<PlayerState, "rush">,
  definitions: GameState["definitions"],
  rushingCardId: string,
  conditionId: string | undefined,
  unitCount: number | undefined,
): boolean {
  if (conditionId !== "send_s_unit_to_discard" || (unitCount ?? 1) !== 1) return false;
  const size = definitions[rushingCardId]?.size;
  if (size !== "M" && size !== "L") return false;
  return player.rush.some((c) => isSameCardIdentity(c.cardId, "XG1-013"));
}

export { other as xg1Other, cats as xg1PrintedCategories };
