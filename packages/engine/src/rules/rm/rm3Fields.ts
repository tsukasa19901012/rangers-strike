/**
 * スペシャルメタルエディション RM-043〜RM-062 の継続効果の判定（低いレベルの関数だけ。選択や処理の続きは rules/rm/rm3Effects.ts）。
 *
 * - `rm3GuruAddsInsect`: RM-058 老師グル【昆虫の精】（rules/addedFeatures.ts unitFeatures）。
 * - `rm3GuruInsectRide`: RM-058 で「昆虫」を追加された「メカ」の S ユニットのライド（keywords/ride.ts）。
 * - `rm3EffectiveSp` / `rm3FieldBpBonus` / `rm3GrantsResist`: RM-051 メガヘラクレス【メガビートフォーメーション】
 *   （rules/legend3/fieldEffects.ts・rules/fieldAuras.ts・rules/resist.ts）。
 * - `rm3StaysInBattleAtStart`: RM-052 ビートルーダー【マグネアタッチメント】（rules/startPhase.ts）。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import { listRideWithoutRcFeatures } from "../../dsl/promotedKeywordBridge";

type Defs = Pick<GameState, "definitions">;

export const GURU_CARD_ID = "RM-058";
export const MEGA_HERACLES_CARD_ID = "RM-051";
export const BEETRUDER_CARD_ID = "RM-052";

function nameOf(state: Defs, cardId: string): string | undefined {
  return state.definitions[cardId]?.name;
}

function areaCards(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

/** playerId の自軍エリア（バトルエリア・ラッシュエリア）に、カード名が name のカードがあるか。 */
export function rm3AreaHasName(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, name: string): boolean {
  return areaCards(state, playerId).some((c) => nameOf(state, c.cardId) === name);
}

/**
 * RM-058「これが自軍ラッシュエリアにある間、…特徴「メカ」を持つユニットと、特徴「メカ」を持つビークルに、特徴「昆虫」を追加する。」（atwiki/page-867）。
 * ownerId のラッシュエリアに老師グルがあるか（追加されるのは自軍のユニット・ビークルだけ。ユーザー決定 2026-10-19「自軍だけ」、
 * docs/rules/README.md §5.7 n。カード評価「相手にも特徴を追加できる」は採らない）。
 */
export function rm3GuruActive(state: Pick<GameState, "players">, ownerId: PlayerId): boolean {
  return state.players[ownerId].rush.some((c) => isSameCardIdentity(c.cardId, GURU_CARD_ID));
}

/** ownerId の features（今の特徴）を持つユニット・ビークルに、RM-058 で「昆虫」が追加されるか（自軍の老師グルだけを見る）。 */
export function rm3GuruAddsInsect(
  state: Pick<GameState, "players" | "definitions">,
  ownerId: PlayerId,
  cardId: string,
  features: string[],
): boolean {
  const type = state.definitions[cardId]?.type;
  if (type !== "unit" && type !== "vehicle") return false;
  return features.includes("メカ") && rm3GuruActive(state, ownerId);
}

/**
 * 「※特徴「昆虫」を持つSユニットは、…ＲＣを持っていなくてもこのビークルにライドできる。」のビークルに、RM-058 で「昆虫」を追加された
 * 「メカ」の S ユニットがライドできるか（カード評価（RM-053）「ビートマシンにライドするユニットは老師グルがいれば増やす事ができる」）。
 * riderOwnerId はライドするユニットの持ち主（その自軍ラッシュエリアの老師グルだけを見る）。
 */
export function rm3GuruInsectRide(
  state: Pick<GameState, "players" | "definitions">,
  riderOwnerId: PlayerId,
  vehicleCardId: string,
  riderCardId: string,
): boolean {
  const rider = state.definitions[riderCardId];
  if (rider?.type !== "unit" || rider.size !== "S") return false;
  if (!listRideWithoutRcFeatures(vehicleCardId).includes("昆虫")) return false;
  return rm3GuruAddsInsect(state, riderOwnerId, riderCardId, rider.features ?? []);
}

/** RM-051「自軍エリアに「ビートルーダー」があれば「SP1」になり」（atwiki/page-861）。 */
export function rm3EffectiveSp(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, instance: CardInstance, sp: number): number {
  if (!isSameCardIdentity(instance.cardId, MEGA_HERACLES_CARD_ID)) return sp;
  return rm3AreaHasName(state, playerId, "ビートルーダー") ? Math.max(sp, 1) : sp;
}

/** RM-051「「スタッガータンク」があればBP+3000され」（何台あっても+3000。カード評価）。 */
export function rm3FieldBpBonus(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, instance: CardInstance): number {
  if (!isSameCardIdentity(instance.cardId, MEGA_HERACLES_CARD_ID)) return 0;
  return rm3AreaHasName(state, playerId, "スタッガータンク") ? 3000 : 0;
}

/** RM-051「「レッドジャイロ」があればレジストを得る」。 */
export function rm3GrantsResist(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, instanceId: string): boolean {
  const card = areaCards(state, playerId).find((c) => c.instanceId === instanceId);
  if (!card || !isSameCardIdentity(card.cardId, MEGA_HERACLES_CARD_ID)) return false;
  return rm3AreaHasName(state, playerId, "レッドジャイロ");
}

/**
 * RM-052【マグネアタッチメント】「これがライドされている間、自軍エリアに「スタッガータンク」があれば、相手はスタートフェイズ中に自分自身のバトルエリアの
 * ユニットをラッシュエリアに戻すとき、特徴「メカ」を持つホールド状態のユニットは戻せない。」（atwiki/page-862）。
 * returningPlayerId のバトルエリアの instanceId が戻せないか。features は今の特徴（呼び出し側で求める）。
 */
export function rm3StaysInBattleAtStart(
  state: Pick<GameState, "players" | "definitions">,
  returningPlayerId: PlayerId,
  instanceId: string,
  featuresOf: (card: CardInstance) => string[],
): boolean {
  const card = state.players[returningPlayerId].battle.find((c) => c.instanceId === instanceId);
  if (!card?.commandHeld || state.definitions[card.cardId]?.type !== "unit") return false;
  const enemyId: PlayerId = returningPlayerId === "player1" ? "player2" : "player1";
  const area = areaCards(state, enemyId);
  const riddenBeetruder = area.some((v) => isSameCardIdentity(v.cardId, BEETRUDER_CARD_ID) && area.some((r) => r.mountedOnInstanceId === v.instanceId));
  if (!riddenBeetruder || !rm3AreaHasName(state, enemyId, "スタッガータンク")) return false;
  return featuresOf(card).includes("メカ");
}
