import { xg7AddedFeatures } from "./xg7/xg7Fields";
/**
 * 効果で追加された特徴（このターンだけ）。
 *
 * - RS-203 大帝ラー・デウス【デウス遺伝子】: これをラッシュしたターン、追加条件で捨札にしたユニットのカードの特徴を、
 *   すべてのユニット（自軍・敵軍、あとからラッシュしたユニットも）の特徴に追加する（atwiki/page-383・
 *   grnrngr/faq-card-4 RS-203 Q1/Q4）。手札のカードはユニットではないので対象外（同 Q5）。
 * - RS-206 シシレンジャー【天幻星・霧隠れ】: このターン、このユニットは選んだユニットの特徴が追加される（atwiki/page-117）。
 */
import { rk12AddedFeatures } from "./rk/rk12Fields";
import { rm3GuruAddsInsect } from "./rm/rm3Fields";
import { xg1AddedFeatures } from "./xg1/xg1Fields";
import { xg4AddedFeatures } from "./xg4/xg4Fields";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { getPlayerModifiers } from "../core/scopedModifiers";
import { rk1AddedUnitFeatures } from "./rk/rk1Features";
import { rk2FeaturesStripped } from "./rk/rk2Features";
import { rk6AddedFeatures } from "./rk/rk6Fields";
import { unitSizeOf } from "../core/catalog";

export const DEUS_GENE_RULE_ID = "deus_gene_features";
export const KIRIGAKURE_RULE_ID = "kirigakure_features";

type DeusPayload = { features: string[] };
type KirigakurePayload = { instanceId: string; features: string[] };

function turnRulePayloads<T>(player: PlayerState, ruleId: string): T[] {
  // 特徴の計算のたびに呼ばれるので、中間の配列を作らずに1回で拾う（順序は記録順のまま）。
  const out: T[] = [];
  for (const m of getPlayerModifiers(player)) {
    if (m.kind !== "rule" || m.ruleId !== ruleId || m.scope !== "turn") continue;
    const payload = (m as { payload?: unknown }).payload as T;
    if (payload) out.push(payload);
  }
  return out;
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
  // RK-035 ダークウイング【ソニックブレイカー】: 敵軍ユニットは特徴を持たず、特徴を追加されない（rules/rk/rk2Features.ts）。
  if (rk2FeaturesStripped(state, _ownerId, instance)) return [];
  const base = state.definitions[instance.cardId]?.features ?? [];
  const extra: string[] = [];
  for (const pid of ["player1", "player2"] as const) {
    const player = state.players[pid];
    for (const p of turnRulePayloads<DeusPayload>(player, DEUS_GENE_RULE_ID)) extra.push(...p.features);
    for (const p of turnRulePayloads<KirigakurePayload>(player, KIRIGAKURE_RULE_ID)) {
      if (p.instanceId === instance.instanceId) extra.push(...p.features);
    }
  }
  // RS-429 マスター・シャーフー【暮らしの中に修行あり】: 自軍ラッシュエリアにある間、すべての S ユニットの特徴に「激気」を追加する
  // （自軍・敵軍とも。atwiki/page-508）。
  if (
    unitSizeOf(state.definitions, instance) === "S" &&
    (state.players.player1.rush.some((c) => c.cardId === "RS-429") ||
      state.players.player2.rush.some((c) => c.cardId === "RS-429"))
  ) {
    extra.push("激気");
  }
  // 「※このユニットは、自軍ラッシュフェイズ中、特徴に「レッド」「ブルー」「イエロー」を追加される。」（RS-499 ゲキバイオレット。
  // atwiki/page-775）— 文言から読む。
  extra.push(...phaseAddedFeatures(state, _ownerId, instance));
  // 「※これは自軍バトルエリアにある間、特徴「ドラゴン」が追加される。」（RS-535 チェンジドラゴン。atwiki/page-1222）— 文言から読む。
  extra.push(...battleAreaAddedFeatures(state, _ownerId, instance));
  // RK-001 改造人間（「男」「女」に「改造人間」を追加）・RK-013 Jパワー（「人型」を追加）（rules/rk/rk1Features.ts）。
  extra.push(...rk1AddedUnitFeatures(state, _ownerId, instance, base));
  // RK-122 ホースオルフェノク格闘態【使途再生】（ホールド状態の自軍 S ユニットに「オルフェノク」。rules/rk/rk6Fields.ts）。
  extra.push(...rk6AddedFeatures(state, _ownerId, instance));
  // RK-250 サバイブ（「サバイブ」）・RK-242 クライマックス刑事（自軍のイマジンに「警察」）（rules/rk/rk12Fields.ts）。
  extra.push(...rk12AddedFeatures(state, _ownerId, instance, base));
  // クロスギャザー ザ・ジェットアクセル XG4-006 ドラゴンアーマー（「獣奏剣」）等（rules/xg4/xg4Fields.ts）。
  extra.push(...xg4AddedFeatures(state, _ownerId, instance));
  // RM-058 老師グル【昆虫の精】（自軍ラッシュエリアにある間、「メカ」のユニット・ビークルに「昆虫」。自軍だけ（ユーザー決定 2026-10-19）。
  // rules/rm/rm3Fields.ts）。
  if (rm3GuruAddsInsect(state, _ownerId, instance.cardId, [...base, ...extra])) extra.push("昆虫");
  // XG7-058 メタル・ドーパント ※（自軍ターン中、「メカ」。rules/xg7/xg7Fields.ts）。
  extra.push(...xg7AddedFeatures(state as Partial<Pick<GameState, "activePlayer">>, _ownerId, instance));
  // XG1-015 宇宙警察（OT の「警察」の自軍 S ユニットに「宇宙刑事」）・XG1-045【墨攻撃】（「ブラック」）（rules/xg1/xg1Fields.ts）。
  extra.push(...xg1AddedFeatures(state, _ownerId, instance.cardId, [...base, ...extra], instance.instanceId));
  if (extra.length === 0) return base;
  return [...new Set([...base, ...extra])];
}

const OWN_RUSH_PHASE_FEATURES_RE = /このユニットは、?自軍ラッシュフェイズ中、?特徴に((?:[「｢][^」｣]+[」｣])+)を追加される/;

/** 自軍ラッシュフェイズ中だけ追加される特徴（カードの文言による）。 */
export function phaseAddedFeatures(
  state: Pick<GameState, "players" | "definitions"> & Partial<Pick<GameState, "phase" | "activePlayer">>,
  ownerId: PlayerId,
  instance: Pick<CardInstance, "cardId">,
): string[] {
  if (state.phase !== "rush" || state.activePlayer !== ownerId) return [];
  const text = state.definitions[instance.cardId]?.text;
  if (!text) return [];
  let parsed = phaseFeatureCache.get(text);
  if (parsed === undefined) {
    const m = text.match(OWN_RUSH_PHASE_FEATURES_RE);
    parsed = m ? [...m[1]!.matchAll(/[「｢]([^」｣]+)[」｣]/g)].map((x) => x[1]!) : [];
    phaseFeatureCache.set(text, parsed);
  }
  return parsed;
}

const phaseFeatureCache = new Map<string, string[]>();

const OWN_BATTLE_AREA_FEATURES_RE = /これは自軍バトルエリアにある間、?特徴((?:[「｢][^」｣]+[」｣])+)が追加される/;
const battleFeatureCache = new Map<string, string[]>();

/** 自軍バトルエリアにある間だけ追加される特徴（カードの文言による）。 */
export function battleAreaAddedFeatures(
  state: Pick<GameState, "players" | "definitions">,
  ownerId: PlayerId,
  instance: Pick<CardInstance, "cardId" | "instanceId">,
): string[] {
  const text = state.definitions[instance.cardId]?.text;
  if (!text) return [];
  let parsed = battleFeatureCache.get(text);
  if (parsed === undefined) {
    const m = text.match(OWN_BATTLE_AREA_FEATURES_RE);
    parsed = m ? [...m[1]!.matchAll(/[「｢]([^」｣]+)[」｣]/g)].map((x) => x[1]!) : [];
    battleFeatureCache.set(text, parsed);
  }
  if (parsed.length === 0) return [];
  return state.players[ownerId].battle.some((c) => c.instanceId === instance.instanceId) ? parsed : [];
}
