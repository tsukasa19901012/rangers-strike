/**
 * クロスギャザー ザ・Wインパクト（XG3）の継続効果の判定（低いレベルの関数だけ。選択や処理の続きは rules/xg3/xg3*Effects.ts）。
 * ほかのモジュールから呼ばれるので、重いモジュールを import しない。
 *
 * - `isXg3StackedUnderUnitCard`: XG3-004 芋長の芋ヨーカン・XG3-010 ジークジェンヌ（ユニットの下に重ね、ユニットでなくなるとき捨札。rules/rk/rk1Features.ts）。
 * - `xg3FieldBpBonus`: BP の増減（rules/fieldAuras.ts）。
 */
import { hasNameOrAlias } from "../../core/cardNames";
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PlayerId } from "../../types/game";
import { cardHasKeyword } from "../../keywords/cardKeywords";
import { cardCategories, effectiveCommandCategories, getDefinition, isVehicle, unitEffectiveCategories, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { logicalBattlePosition } from "../battleLine";
import { isSameVehicleTextIdentity } from "../xg6/xg6dFields";

export const IMOYOKAN_CARD_ID = "XG3-004";
export const ZIEG_JENNE_CARD_ID = "XG3-010";
export const MAX_LINER_CARD_ID = "XG3-007";
export const JUMA_HUNTER_CARD_ID = "XG3-011";

type View = Pick<GameState, "players" | "definitions" | "activePlayer"> & Partial<Pick<GameState, "xg3" | "turn">>;

/** XG3-103 ライジンゴー【噛みつき】で、このターン S ユニットとして扱うか。 */
export function isXg3RaijingoUnit(state: View, card: Pick<CardInstance, "cardId" | "instanceId">): boolean {
  return isSameCardIdentity(card.cardId, "XG3-103") && (state.xg3?.raijingo ?? []).some((r) => r.instanceId === card.instanceId && r.turn === state.turn);
}

/** ユニットの下に重ね、重ねたユニットがユニットでなくなるとき捨札になるカード。 */
export function isXg3StackedUnderUnitCard(cardId: string): boolean {
  return isSameCardIdentity(cardId, IMOYOKAN_CARD_ID) || isSameCardIdentity(cardId, ZIEG_JENNE_CARD_ID);
}

function stackedCount(instance: Pick<CardInstance, "stackedCards">, cardId: string): number {
  return (instance.stackedCards ?? []).filter((c) => isSameCardIdentity(c.cardId, cardId)).length;
}

/**
 * BP の増減（role は rules/fieldAuras.ts の呼び分け。general は常に、attacking / defending はバトルのときだけ）。
 * - XG3-004「このカードに重ねたユニットは、BP+3000され」（重ねた枚数分）。
 * - XG3-007【マックスシャトル】ホールド状態の間 BP-2000（公式Q&A atwiki/page-1889 Q1）。
 * - XG3-011【ジークブラスター】本来の特徴に「獣」を持つ敵軍ユニットがあれば BP+2000。
 */
export function xg3FieldBpBonus(state: View, playerId: PlayerId, instance: CardInstance, role: "general" | "attacking" | "defending"): number {
  let bonus = 0;
  if (role === "general") {
    bonus += 3000 * stackedCount(instance, IMOYOKAN_CARD_ID);
    if (instance.commandHeld && isSameCardIdentity(instance.cardId, MAX_LINER_CARD_ID)) bonus -= 2000;
    if (isSameCardIdentity(instance.cardId, JUMA_HUNTER_CARD_ID) && enemyUnitPrinted(state, playerId, (d) => (d.features ?? []).includes("獣"))) bonus += 2000;
    bonus += abareMaxBonus(state, playerId, instance);
    for (const b of turnBuffsOf(state, instance.instanceId)) bonus += b.bp ?? 0;
    // XG3-051 仮面ライダー王蛇【ここが祭りの場所か】特徴「仮面ライダー」を持つオモテ向きの敵軍パワー1枚につき BP+1000（印刷の特徴。atwiki/page-1915）。
    if (isSameCardIdentity(instance.cardId, "XG3-051")) {
      bonus += 1000 * state.players[opponent(playerId)].power.filter((c) => !c.faceDown && (getDefinition(state.definitions, c.cardId)?.features ?? []).includes("仮面ライダー")).length;
    }
    // XG3-052 オックスオルフェノク【強力無双の怪腕】自軍ターン中 BP+2000（atwiki/page-1916）。
    if (isSameCardIdentity(instance.cardId, "XG3-052") && state.activePlayer === playerId) bonus += 2000;
    // XG3-085 邪甲神クワガタイタン【タイタニックフレア】自軍ターン中、WB を持つ自軍コマンド1つにつき BP+1000（リリース・ホールドを問わない。atwiki/page-1940）。
    if (isSameCardIdentity(instance.cardId, "XG3-085") && state.activePlayer === playerId) {
      const p = state.players[playerId];
      bonus += 1000 * p.command.filter((c) => (effectiveCommandCategories(p, state.definitions, c.cardId) as string[]).includes("WB")).length;
    }
    // XG3-094 カブタック【友情】これ以外の自軍バトルエリアの S ユニット1体につき BP+1000（atwiki/page-1947）。
    if (isSameCardIdentity(instance.cardId, "XG3-094")) {
      const p = state.players[playerId];
      if (p.battle.some((c) => c.instanceId === instance.instanceId)) {
        bonus += 1000 * p.battle.filter((c) => c.instanceId !== instance.instanceId && getDefinition(state.definitions, c.cardId)?.type === "unit" && unitSizeOf(state.definitions, c) === "S").length;
      }
    }
    // XG3-103 ライジンゴー【噛みつき】このターン「BP2000」の S ユニットとして扱う（ビークルの BP は 0）。
    if (isXg3RaijingoUnit(state, instance)) bonus += 2000;
  }
  void state;
  void playerId;
  return bonus;
}

/**
 * アタックされない（rules/legend3/restrictions.ts canAttackDefender）。
 * - XG3-007【マックスシャトル】ホールド状態の間「これはウイングを持たないユニットにアタックされない」。
 */
export function xg3DefenderBlocksAttack(
  state: GameState,
  attackerPlayerId: PlayerId,
  attacker: CardInstance,
  defenderPlayerId: PlayerId,
  defender: CardInstance,
): boolean {
  void defenderPlayerId;
  if (xg3NoAttackTextDisabled(state, defender.instanceId)) return false;
  if (defender.commandHeld && isSameCardIdentity(defender.cardId, MAX_LINER_CARD_ID)) {
    if (!cardHasKeyword(state.definitions, attacker.cardId, "wing", { state, playerId: attackerPlayerId })) return true;
  }
  // XG3-054 牛鬼【受け止める覚悟】「これはMAを持たない敵軍Sユニットにアタックされない」（いまのカテゴリ。atwiki/page-1918）。
  if (isSameCardIdentity(defender.cardId, "XG3-054") && unitSizeOf(state.definitions, attacker) === "S") {
    const zone = state.players[attackerPlayerId].battle.some((c) => c.instanceId === attacker.instanceId) ? "battle" : "rush";
    if (!(unitEffectiveCategories(state, attackerPlayerId, attacker, zone) as string[]).includes("MA")) return true;
  }
  // XG3-070 ズ・ザイン・ダ【車両への憎悪】敵軍バトルエリアに「車両」のユニット（ライドしているビークルを含む）があれば、そのユニットにアタックする。
  if (isSameCardIdentity(attacker.cardId, "XG3-070") && !isCarTarget(state, defenderPlayerId, defender)) {
    if (state.players[defenderPlayerId].battle.some((c) => isCarTarget(state, defenderPlayerId, c))) return true;
  }
  return false;
}

/**
 * アタックするユニットのバトルの BP（rules/namedUnitEffects.ts battleAttackerBpBonus）。
 * - XG3-070 ズ・ザイン・ダ【車両への憎悪】「車両」のユニット（ライドしているビークルを含む）にアタックしたとき BP+2000（atwiki/page-1930）。
 */
export function xg3AttackerBpBonus(state: View, pending: PendingBattle): number {
  const attacker = state.players[pending.attackerPlayerId].battle.find((c) => c.instanceId === pending.attackerInstanceId);
  if (!attacker || !isSameCardIdentity(attacker.cardId, "XG3-070")) return 0;
  const defender = state.players[pending.defenderPlayerId].battle.find((c) => c.instanceId === pending.defenderInstanceId);
  return defender && isCarTarget(state, pending.defenderPlayerId, defender) ? 2000 : 0;
}

/** 特徴「車両」を持つユニットか、特徴「車両」を持つビークルにライドしているユニット（印刷の特徴。XG3-070）。 */
function isCarTarget(state: View, ownerId: PlayerId, card: CardInstance): boolean {
  const d = getDefinition(state.definitions, card.cardId);
  if (d?.type !== "unit") return false;
  if ((d.features ?? []).includes("車両")) return true;
  if (!card.mountedOnInstanceId) return false;
  const p = state.players[ownerId];
  const vehicle = [...p.battle, ...p.rush].find((c) => c.instanceId === card.mountedOnInstanceId);
  return !!vehicle && (getDefinition(state.definitions, vehicle.cardId)?.features ?? []).includes("車両");
}

/**
 * 敵軍ラッシュエリアのユニットにアタックできる（rules/legend3/restrictions.ts）。
 * - XG3-077 アギトトルネイダー【ファイナルアタックライド】ライドされたままのこれからコンビネーションする S ユニット（並びのすぐ後ろ）。
 */
export function xg3AttackerCanAttackRush(state: View, attackerPlayerId: PlayerId, attacker: CardInstance): boolean {
  const battle = state.players[attackerPlayerId].battle;
  const i = battle.findIndex((c) => c.instanceId === attacker.instanceId);
  if (i <= 0 || attacker.mountedOnInstanceId || unitSizeOf(state.definitions, attacker) !== "S") return false;
  const prev = battle[i - 1]!;
  const vehicleId = isSameVehicleTextIdentity(prev.cardId, "XG3-077") ? prev.instanceId : prev.mountedOnInstanceId;
  if (!vehicleId) return false;
  const vehicle = battle.find((c) => c.instanceId === vehicleId);
  if (!vehicle || !isSameVehicleTextIdentity(vehicle.cardId, "XG3-077")) return false;
  return battle.some((c) => c.mountedOnInstanceId === vehicleId);
}

/**
 * ライドされていなくてもバトルエリアに出られるビークル（rules/vehicleRules.ts）。
 * - XG3-078 マシンハードボイルダー【リモコン操作】特徴「ダブルドライバー」を持つ自軍ユニットがあれば（印刷の特徴）。
 */
export function xg3VehicleMayEnterAlone(state: View, playerId: PlayerId, vehicle: CardInstance): boolean {
  // XG3-103 ライジンゴー【噛みつき】このターン S ユニットとして扱う（rules/xg3/xg3eEffects.ts）。
  if (isXg3RaijingoUnit(state, vehicle)) return true;
  if (!isSameCardIdentity(vehicle.cardId, "XG3-078")) return false;
  const p = state.players[playerId];
  return [...p.battle, ...p.rush].some((c) => {
    const d = getDefinition(state.definitions, c.cardId);
    return d?.type === "unit" && (d.features ?? []).includes("ダブルドライバー");
  });
}

type Def = NonNullable<ReturnType<typeof getDefinition>>;

/** 敵軍エリア（バトル・ラッシュ）に、印刷（本来）の値が pred を満たすユニットがあるか。 */
function enemyUnitPrinted(state: View, playerId: PlayerId, pred: (d: Def) => boolean): boolean {
  const enemy = state.players[opponent(playerId)];
  return [...enemy.battle, ...enemy.rush].some((c) => {
    const d = getDefinition(state.definitions, c.cardId);
    return d?.type === "unit" && pred(d);
  });
}

/**
 * SP（rules/legend3/fieldEffects.ts legend3EffectiveSp）。
 * - XG3-011【ジークブラスター】本来のカテゴリに DA を持つ敵軍ユニットがあれば「SP1」。
 */
export function xg3EffectiveSp(state: View, playerId: PlayerId, instance: CardInstance, sp: number): number {
  for (const b of turnBuffsOf(state, instance.instanceId)) if (b.sp !== undefined) sp = Math.max(sp, b.sp);
  if (gekiBlueApplies(state, playerId, instance)) sp = Math.max(sp, 1);
  // XG3-073 仮面ライダーJジャンボフォーメーション【とっておきのお宝】自軍「仮面ライダーディエンド」があれば「SP1/3」（atwiki/page-1932）。
  if (isSameCardIdentity(instance.cardId, "XG3-073")) {
    const p = state.players[playerId];
    const diend = [...p.battle, ...p.rush].some((c) => hasNameOrAlias(getDefinition(state.definitions, c.cardId), "仮面ライダーディエンド"));
    if (diend && logicalBattlePosition(p.battle, instance.instanceId) === 3) sp = Math.max(sp, 1);
  }
  // XG3-077 アギトトルネイダー ※「これにライドしているユニットは、「仮面ライダーディケイド」なら「SP1」になる」（atwiki/page-1935）。
  // 「※これは「仮面ライダーディケイド」…としてつかえる」（XG7-042）も含む（atwiki/page-1668 Q1）。
  if (instance.mountedOnInstanceId && hasNameOrAlias(getDefinition(state.definitions, instance.cardId), "仮面ライダーディケイド")) {
    const p = state.players[playerId];
    const vehicle = [...p.battle, ...p.rush].find((c) => c.instanceId === instance.mountedOnInstanceId);
    if (vehicle && isSameCardIdentity(vehicle.cardId, "XG3-077")) sp = Math.max(sp, 1);
  }
  if (isSameCardIdentity(instance.cardId, JUMA_HUNTER_CARD_ID) && enemyUnitPrinted(state, playerId, (d) => (cardCategories(d) as string[]).includes("DA"))) {
    return Math.max(sp, 1);
  }
  return sp;
}

export const ABARE_MAX_CARD_ID = "XG3-023";
export const URZARD_CARD_ID = "XG3-029";

function turnBuffsOf(state: View, instanceId: string) {
  return (state.xg3?.turnBuffs ?? []).filter((b) => b.instanceId === instanceId && b.turn === state.turn);
}

/**
 * XG3-023 アバレマックス【大気爆裂マックスフィールド】: 自軍バトルエリアのユニットがこれ1体だけなら、自軍バトルエリアのユニットは BP+2000、
 * 敵軍バトルエリアのユニットは BP-2000（BP0 以下の撃破は R-BP-02 のルールの撃破）。
 */
function abareMaxBonus(state: View, playerId: PlayerId, instance: CardInstance): number {
  const own = state.players[playerId].battle;
  if (!own.some((c) => c.instanceId === instance.instanceId)) return 0;
  const solo = (battle: CardInstance[]) => battle.length === 1 && isSameCardIdentity(battle[0]!.cardId, ABARE_MAX_CARD_ID);
  let bonus = 0;
  if (solo(own)) bonus += 2000;
  if (solo(state.players[opponent(playerId)].battle)) bonus -= 2000;
  return bonus;
}

/** XG3-031【宙宙斬】: そのターン、自軍バトルエリアの2番目に並ぶ、特徴「激気」を持つ M ユニットは「SP1」。 */
function gekiBlueApplies(state: View, playerId: PlayerId, instance: CardInstance): boolean {
  if (!(state.xg3?.gekiBlue ?? []).some((g) => g.ownerId === playerId && g.turn === state.turn)) return false;
  const battle = state.players[playerId].battle;
  if (battle[1]?.instanceId !== instance.instanceId) return false;
  if (unitSizeOf(state.definitions, instance) !== "M") return false;
  return (getDefinition(state.definitions, instance.cardId)?.features ?? []).includes("激気") || xg3AddedFeatures(state, instance).includes("激気");
}

function ownerOf(state: Pick<GameState, "players">, instanceId: string): PlayerId | null {
  for (const pid of ["player1", "player2"] as const) {
    const p = state.players[pid];
    if (p.battle.some((c) => c.instanceId === instanceId) || p.rush.some((c) => c.instanceId === instanceId)) return pid;
  }
  return null;
}

function hasOwnMVehicle(state: Pick<GameState, "players" | "definitions">, ownerId: PlayerId): boolean {
  const p = state.players[ownerId];
  return [...p.battle, ...p.rush].some((c) => isVehicle(getDefinition(state.definitions, c.cardId)) && unitSizeOf(state.definitions, c) === "M");
}

/** いまのサイズ（XG3-029 ※「自軍Mビークルがあれば、これはMユニットになり」）。変わらなければ undefined。 */
export function xg3SizeNow(state: Pick<GameState, "players" | "definitions">, instance: CardInstance): "M" | undefined {
  if (!isSameCardIdentity(instance.cardId, URZARD_CARD_ID)) return undefined;
  const owner = ownerOf(state, instance.instanceId);
  return owner && hasOwnMVehicle(state, owner) ? "M" : undefined;
}

/** 追加される特徴（XG3-029 ※「特徴「人型」が追加される」）。 */
export function xg3AddedFeatures(state: Pick<GameState, "players" | "definitions">, instance: Pick<CardInstance, "cardId" | "instanceId">): string[] {
  if (!isSameCardIdentity(instance.cardId, URZARD_CARD_ID)) return [];
  const owner = ownerOf(state, instance.instanceId);
  return owner && hasOwnMVehicle(state, owner) ? ["人型"] : [];
}

/** XG3-037【烏賊墨砲】: このターン、そのユニットの「アタックされない」という記述のあるテキストは無効。 */
export function xg3NoAttackTextDisabled(state: Partial<Pick<GameState, "xg3" | "turn">>, instanceId: string): boolean {
  return (state.xg3?.noAttackTextDisabled ?? []).some((d) => d.instanceId === instanceId && d.turn === state.turn);
}

/**
 * 追加条件つきのラッシュをユニットと同じ手順で行うビークル（core/legalActions.ts）。
 * - XG3-077 アギトトルネイダー「追加条件：自軍「仮面ライダーアギト」1体を手札に戻す」（atwiki/page-1935）。同じ形の XG2-074・XG4-056 は各シリーズの担当。
 */
export function isXg3ZordUpVehicle(cardId: string): boolean {
  return cardId === "XG3-077";
}
