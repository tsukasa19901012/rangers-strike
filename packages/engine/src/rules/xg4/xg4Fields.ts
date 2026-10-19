/**
 * クロスギャザー ザ・ジェットアクセル XG4-001〜XG4-102 の継続効果の判定（低いレベルの関数だけ。選択や処理の続きは rules/xg4/xg4*Effects.ts）。
 * ほかのモジュールからはここの関数を1つずつ呼ぶ（呼び出し側は1行の追加だけにする）。
 *
 * - `xg4FieldBpBonus`: BP の増減（rules/fieldAuras.ts passiveNamedFieldBpBonus の "general"）。
 * - `xg4EffectiveSp`: SP の指定（rules/legend3/fieldEffects.ts）。
 * - `xg4AddedFeatures`: 特徴の追加（rules/addedFeatures.ts unitFeatures）。
 * - `xg4AttackerBattleBonus`: アタックするときの BP（rules/namedUnitEffects.ts）。
 * - `xg4BlocksBattleEntry`: バトルエリアに出られない（rules/restrictions.ts）。
 * - `xg4IsHandSubstituteMaterial` / `xg4HoldForHandSubstitute`: 手札のカードを追加条件のユニットにする（rules/zord.ts）。
 */
import { isSameCardIdentity, type CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PlayerId, PlayerState } from "../../types/game";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import { isCostWindowSatisfied } from "../../core/costWindow";

type View = Pick<GameState, "players" | "definitions">;

/** XG4-001【黒十字ハリケーン】の NC が成立した（payload: { instanceId }。このターン）。 */
export const XG4_HARIKEN_RULE = "xg4_001_hariken";
/** ラッシュフェイズ中に自分のカードが自軍捨札に置かれた（このターン。XG4-007 の※）。 */
export const XG4_RUSH_DISCARD_RULE = "xg4_rush_phase_discard";

export const DRAGON_ARMOR_CARD_ID = "XG4-006";

function hasTurnRecord(state: Pick<GameState, "players">, playerId: PlayerId, ruleId: string, instanceId?: string): boolean {
  return getPlayerModifiers(state.players[playerId]).some(
    (m) =>
      m.kind === "rule" &&
      m.ruleId === ruleId &&
      m.scope === "turn" &&
      (instanceId === undefined || ((m as { payload?: { instanceId?: string } }).payload?.instanceId === instanceId)),
  );
}

function fieldOf(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

function findOnField(state: Pick<GameState, "players">, playerId: PlayerId, instanceId: string): CardInstance | undefined {
  return fieldOf(state, playerId).find((c) => c.instanceId === instanceId);
}

function isUnit(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return state.definitions[cardId]?.type === "unit";
}

/** XG4-006 ドラゴンアーマーを重ねたユニットか。 */
export function hasDragonArmor(card: Pick<CardInstance, "stackedCards"> | undefined): number {
  return (card?.stackedCards ?? []).filter((c) => isSameCardIdentity(c.cardId, DRAGON_ARMOR_CARD_ID)).length;
}

type FeaturesOf = (state: View, playerId: PlayerId, instance: CardInstance) => string[];

/** BP の増減（"general"）。featuresOf はいまの特徴（呼び出し側から渡す）。 */
export function xg4FieldBpBonus(state: View, playerId: PlayerId, instance: CardInstance, featuresOf: FeaturesOf): number {
  let bonus = 0;
  // XG4-001【黒十字ハリケーン】「このターン、このユニットは、特徴「戦闘員」を持つ自軍ユニット1体につきBP+1000され」（atwiki/page-2102）。
  if (isSameCardIdentity(instance.cardId, "XG4-001") && hasTurnRecord(state, playerId, XG4_HARIKEN_RULE, instance.instanceId)) {
    const grunts = fieldOf(state, playerId).filter((c) => isUnit(state, c.cardId) && featuresOf(state, playerId, c).includes("戦闘員")).length;
    bonus += grunts * 1000;
  }
  // XG4-006「このカードに重ねたユニットはBP+1000され」（atwiki/page-2061）。
  bonus += hasDragonArmor(instance) * 1000;
  return bonus;
}

/** SP の指定。bpOf はいまの BP。 */
export function xg4EffectiveSp(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  sp: number,
  bpOf: (state: GameState, playerId: PlayerId, instance: CardInstance) => number,
): number {
  // XG4-001「BP8000以上のときSP2になる」（NC が成立したターンだけ）。
  if (isSameCardIdentity(instance.cardId, "XG4-001") && hasTurnRecord(state, playerId, XG4_HARIKEN_RULE, instance.instanceId) && bpOf(state, playerId, instance) >= 8000) {
    sp = Math.max(sp, 2);
  }
  return sp;
}

/** 特徴の追加。 */
export function xg4AddedFeatures(state: View, ownerId: PlayerId, instance: Pick<CardInstance, "cardId" | "instanceId">): string[] {
  const card = findOnField(state, ownerId, instance.instanceId);
  // XG4-006「特徴「獣奏剣」が追加される」。
  if (hasDragonArmor(card) > 0) return ["獣奏剣"];
  return [];
}

/** アタックするときの BP（rules/namedUnitEffects.ts）。featuresOf はいまの特徴。 */
export function xg4AttackerBattleBonus(state: View, pending: Pick<PendingBattle, "attackerPlayerId" | "attackerInstanceId">, featuresOf: FeaturesOf): number {
  const attacker = findOnField(state, pending.attackerPlayerId, pending.attackerInstanceId);
  if (!attacker) return 0;
  let bonus = 0;
  // XG4-007【獣奏剣】「これが自軍エリアにある間、特徴「恐竜」を持つすべての自軍ユニットは、アタックするときBP+2000される。」（1枚につき）。
  const dragons = fieldOf(state, pending.attackerPlayerId).filter((c) => isSameCardIdentity(c.cardId, "XG4-007")).length;
  if (dragons > 0 && featuresOf(state, pending.attackerPlayerId, attacker).includes("恐竜")) bonus += dragons * 2000;
  return bonus;
}

/** バトルエリアに出られないか。 */
export function xg4BlocksBattleEntry(state: View, playerId: PlayerId, unit: Pick<CardInstance, "cardId" | "instanceId">): boolean {
  // XG4-007「※これはラッシュフェイズ中に自分のカードが捨札に置かれたターンにしかバトルエリアに出られない。」（atwiki/page-2132）。
  if (isSameCardIdentity(unit.cardId, "XG4-007") && !hasTurnRecord(state, playerId, XG4_RUSH_DISCARD_RULE)) return true;
  return false;
}

/**
 * アタックされないか（rules/legend3/restrictions.ts）。hasWing はアタックするユニットがウイングを持つか（呼び出し側で判定）。
 */
export function xg4DefenderBlocksAttack(
  state: View,
  attackerPlayerId: PlayerId,
  attacker: CardInstance,
  defenderPlayerId: PlayerId,
  defender: CardInstance,
  hasWing: (card: CardInstance) => boolean,
): boolean {
  void state;
  if (attackerPlayerId === defenderPlayerId) return false;
  // XG4-013「※これはライド中、ウイングを持たないユニットにアタックされない。」（atwiki/page-2092）。
  if (isSameCardIdentity(defender.cardId, "XG4-013") && defender.mountedOnInstanceId && !hasWing(attacker)) return true;
  return false;
}

/**
 * RC を持たないユニットが、自軍コマンドを1つホールドすればこのビークルにライドできるか（keywords/ride.ts）。
 * XG4-018「※WBを持つSユニットは、自軍コマンドを1つホールドすればRCを持っていなくてもこのビークルにライドできる。」（atwiki/page-2098）。
 * リリース状態のコマンドがあるかは呼び出し側で見る。
 */
export function xg4HoldRideAllowed(state: View, vehicleCardId: string, rider: Pick<CardInstance, "cardId">, riderSize: string | undefined): boolean {
  if (isSameCardIdentity(vehicleCardId, "XG4-018")) {
    const d = state.definitions[rider.cardId];
    const cats = (Array.isArray(d?.category) ? d.category : d?.category ? [d.category] : []) as string[];
    return d?.type === "unit" && riderSize === "S" && cats.includes("WB");
  }
  return false;
}

function categoriesOfDef(def: CardDefinition | undefined): string[] {
  const c = (def as { category?: string | string[] } | undefined)?.category;
  return Array.isArray(c) ? c : c ? [c] : [];
}

function releasedEtCommands(player: PlayerState, definitions: Record<string, CardDefinition>): CardInstance[] {
  return player.command.filter((c) => !c.commandHeld && categoriesOfDef(definitions[c.cardId]).includes("ET"));
}

/**
 * XG4-008 メガシルバー【I.N.E.T.特別開発班チーフ】「これが自軍エリアにある間、特徴「メカ」をもつETのLユニットをラッシュするとき、自軍Lユニットが
 * 1体もなければ次の効果を発動できる⇒ETの自軍コマンドを1つホールドしてから、自分の手札からそのLユニットの追加条件を満たすために必要なユニットの
 * カードを1枚選び捨札にすれば、必要なユニットの1体を捨札にしたことにできる。」（atwiki/page-2137）。
 * 手札の card が追加条件の素材の代わりになるか。isFieldMaterial は場のユニットとして素材になるか（rules/zord.ts の判定）。
 * ホールドする ET のコマンドは、ラッシュのカテゴリのホールド（まだなら1つ）とは別に1つ要る。
 */
export function xg4IsHandSubstituteMaterial(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
  card: CardInstance,
  isFieldMaterial: (card: CardInstance) => boolean,
): boolean {
  const field = [...player.battle, ...player.rush];
  if (!field.some((c) => isSameCardIdentity(c.cardId, "XG4-008"))) return false;
  if (field.some((c) => definitions[c.cardId]?.type === "unit" && (c.sizeOverride ?? definitions[c.cardId]?.size) === "L")) return false;
  const rushing = definitions[rushingCardId];
  if (rushing?.type !== "unit" || rushing.size !== "L") return false;
  if (!categoriesOfDef(rushing).includes("ET") || !((rushing as { features?: string[] }).features ?? []).includes("メカ")) return false;
  if (definitions[card.cardId]?.type !== "unit" || !isFieldMaterial(card)) return false;
  const categoryPending = !isCostWindowSatisfied(player, "rush_category");
  return releasedEtCommands(player, definitions).length >= (categoryPending ? 2 : 1);
}

/** 手札のカードを素材にしたとき、ET の自軍コマンドを1つホールドする（xg4IsHandSubstituteMaterial のとき）。 */
export function xg4HoldForHandSubstitute(player: PlayerState, definitions: Record<string, CardDefinition>): PlayerState {
  const target = releasedEtCommands(player, definitions)[0];
  if (!target) return player;
  return { ...player, command: player.command.map((c) => (c.instanceId === target.instanceId ? { ...c, commandHeld: true } : c)) };
}
