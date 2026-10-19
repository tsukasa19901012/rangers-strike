/**
 * クロスギャザー XG2 の継続効果の判定（軽い・純粋な判定だけ。cardSpec XG2-* の監査）。
 * 選択を開く効果は rules/xg2/xg2aEffects.ts ほか。central のファイル（SP・BP・制限の計算）から呼ぶ。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PlayerId } from "../../types/game";
import type { CardDefinition, RushAdditionalCondition } from "@rangers-strike/cards";
import { resolveRushAdditionalCondition } from "@rangers-strike/cards";
import { cardName, getDefinition, unitEffectiveCategories, unitSizeOf } from "../../core/catalog";
import { hasAllRequiredFusionMaterials } from "../zord";

/** XG2-009【行動予測】で「ストライク」を宣言したユニットの、そのターンの制限（rules/keywordGapRuntime.ts battleActBlocked）。 */
export const XG2_NO_STRIKE_RESTRICTION = "xg2_no_strike_this_turn";

/** XG2-019 知恵の樹モークで M ユニットとして扱うビークルの定義の id の末尾（`<cardId>@xg2-019`）。 */
export const XG2_VEHICLE_UNIT_SUFFIX = "@xg2-019";

export function xg2IsVehicleUnitAlias(cardId: string): boolean {
  return cardId.endsWith(XG2_VEHICLE_UNIT_SUFFIX);
}

type Board = Pick<GameState, "players" | "definitions">;

function areaCards(state: Board, playerId: PlayerId): CardInstance[] {
  return [...state.players[playerId].rush, ...state.players[playerId].battle];
}

function hasInArea(state: Board, playerId: PlayerId, cardId: string): boolean {
  return areaCards(state, playerId).some((c) => isSameCardIdentity(c.cardId, cardId));
}

/** 印刷されたカテゴリ（1つなら文字列のこともある）。 */
function printedCategories(state: Board, cardId: string): string[] {
  const cat = getDefinition(state.definitions, cardId)?.category as string | string[] | undefined;
  return cat === undefined ? [] : Array.isArray(cat) ? cat : [cat];
}

/** カテゴリを2つ以上持つ自軍コマンド（ホールド・リリースを問わない。印刷されたカテゴリ）の数。 */
export function xg2MultiCategoryCommands(state: Board, playerId: PlayerId): number {
  return state.players[playerId].command.filter((c) => printedCategories(state, c.cardId).length >= 2).length;
}

/** XG2-004 ファイブロボ【超次元ソード】「カテゴリを2つ以上持つ自軍コマンドが2つ以上あれば「SP2」になる」（atwiki/page-1693）。 */
// XG2-028 サラマンデスドラゴン「これは下に重なっているウラ向きのカード1枚につき「SP+1」される」（atwiki/page-1797）。
// XG2-029 幽魔王サラマンデス【災魔ツリー】「BP8000以上のとき、…SP1を得る」（atwiki/page-1798。Lユニットになるのは未対応）。
export function xg2EffectiveSp(
  state: Board,
  playerId: PlayerId,
  instance: CardInstance,
  sp: number,
  bpOf?: (state: GameState, playerId: PlayerId, instance: CardInstance) => number,
): number {
  if (isSameCardIdentity(instance.cardId, "XG2-028")) return sp + xg2FaceDownStacked(instance).length;
  // XG2-067 仮面ライダー電王GF「※このユニットの下にオモテ向きの「リュウタロス」のカードが重なっている間、これは「SP1」になる。」（atwiki/page-1772）。
  if (isSameCardIdentity(instance.cardId, "XG2-067") && (instance.stackedCards ?? []).some((c) => !c.faceDown && cardName(state.definitions, c.cardId) === "リュウタロス")) return 1;
  if (isSameCardIdentity(instance.cardId, "XG2-029") && bpOf) {
    return bpOf(state as GameState, playerId, instance) >= 8000 ? Math.max(sp, 1) : sp;
  }
  if (!isSameCardIdentity(instance.cardId, "XG2-004")) return sp;
  return xg2MultiCategoryCommands(state, playerId) >= 2 ? Math.max(sp, 2) : sp;
}

/** 場のユニットの下にウラ向きで重なっているカード（XG2-028・XG2-029）。 */
export function xg2FaceDownStacked(card: CardInstance): CardInstance[] {
  return (card.stackedCards ?? []).filter((c) => c.faceDown);
}

/**
 * XG2-029【災魔ツリー】「下に重なっているウラ向きのカード1枚につきBP+500」・XG2-031 デカマシン【宇宙警察のバックアップ】「これが自軍エリアにある間、
 * 特徴「警察」を持つユニットはBP+1000される」（自軍・敵軍を問わない。デカマシン1枚につき。atwiki/page-1799）。rules/fieldAuras.ts から呼ぶ。
 */
export function xg2FieldBpBonus(state: Board & Partial<Pick<GameState, "activePlayer" | "turn" | "xg2">>, playerId: PlayerId, instance: CardInstance): number {
  let bonus = 0;
  // XG2-046 仮面ライダースーパー1・PH【怪力】「自軍ターン中、これはBP+5000される。」（atwiki/page-1745）。
  if (isSameCardIdentity(instance.cardId, "XG2-046") && state.activePlayer === playerId) bonus += 5000;
  bonus += xg2TigerUndeadBonus(state, playerId, instance);
  // XG2-061 リョクオオザル「このターン、すべての自軍ユニットは、カテゴリを2つ以上持つ自軍コマンド1つにつきBP+1000される。」（使った回数分）。
  const ryoku = ((state.xg2?.[XG2_RYOKU_KEY] as Xg2TurnEntry[] | undefined) ?? []).filter((e) => e.ownerId === playerId && e.turn === state.turn).length;
  if (ryoku > 0) bonus += 1000 * ryoku * xg2MultiCategoryCommands(state, playerId);
  if (isSameCardIdentity(instance.cardId, "XG2-029")) bonus += 500 * xg2FaceDownStacked(instance).length;
  // XG2-080 リュウキドラグレッダー【ファイナルアタックライド】「このユニットからコンビネーションする、「仮面ライダーディケイド」または
  // 「仮面ライダーディエンド」は、次の能力を得る⇒BP+3000」（atwiki/page-1778）: 自軍バトルエリアでこれのすぐ次に並んでいるとき。
  if (XG2_DECADE_NAMES.includes(cardName(state.definitions, instance.cardId))) {
    const battle = state.players[playerId].battle;
    const i = battle.findIndex((c) => c.instanceId === instance.instanceId);
    if (i > 0 && isSameCardIdentity(battle[i - 1]!.cardId, "XG2-080")) bonus += 3000;
  }
  const machines = (["player1", "player2"] as const).reduce((n, pid) => n + areaCards(state, pid).filter((c) => isSameCardIdentity(c.cardId, "XG2-031")).length, 0);
  if (machines > 0) {
    const features = getDefinition(state.definitions, instance.cardId)?.features ?? [];
    if (features.includes("警察")) bonus += 1000 * machines;
  }
  return bonus;
}

/** XG2-038【真・水流の舞い】（NC）で敵軍ラッシュエリアのユニットにアタックできるか（rules/legend3/restrictions.ts）。 */
export const XG2_SUIRYU_MARK = "xg2_038_suiryu";

export function xg2AllowsRushAttack(_state: Board, attackerPlayerId: PlayerId, attacker: CardInstance, defenderPlayerId: PlayerId): boolean {
  if (attackerPlayerId === defenderPlayerId) return false;
  if (!isSameCardIdentity(attacker.cardId, "XG2-038")) return false;
  return (attacker.activatedNcEffects ?? []).includes(XG2_SUIRYU_MARK);
}

/** XG2-021 重騎士【騎乗】で選んだユニット（state.xg2[XG2_KIJOU_KEY]）。 */
export const XG2_KIJOU_KEY = "kijou";
export type Xg2KijouEntry = { ownerId: PlayerId; instanceId: string; turn: number };

/** 【騎乗】で選んだユニットは、このターン、バトルエリアに出るとき自軍コマンドをホールドしない（rules/restrictions.ts requiredBattleEntryHolds）。 */
export function xg2KijouReplacesEntryHold(state: GameState, playerId: PlayerId, unit: CardInstance): boolean {
  const entries = (state.xg2?.[XG2_KIJOU_KEY] as Xg2KijouEntry[] | undefined) ?? [];
  return entries.some((e) => e.ownerId === playerId && e.instanceId === unit.instanceId && e.turn === state.turn);
}

/**
 * XG2-006 キャリアベータ【ベータランチャー】「これが自軍エリアにある間、自分も相手も次の制限を受ける⇒自分自身のバトルエリアのユニットは、
 * 自分自身のスタートフェイズ中と対戦相手のターン中以外はラッシュエリアに戻せない。」（atwiki/page-1788）。
 * どちらかのエリアにキャリアベータがあり、playerId のターンでスタートフェイズ以外なら true。
 */
export function xg2ReturnToRushBlocked(state: Pick<GameState, "players" | "definitions" | "activePlayer" | "phase">, playerId: PlayerId): boolean {
  if (state.activePlayer !== playerId || state.phase === "start") return false;
  return hasInArea(state, "player1", "XG2-006") || hasInArea(state, "player2", "XG2-006");
}

/**
 * XG2-007 ランドガンマ【ガンマカノン砲】「これが自軍エリアにある間、カテゴリを2つ以上持つ自軍Mユニットは次の能力を得る⇒アタックされるとき、
 * カテゴリを2つ以上持つ自軍コマンド1つにつきBP＋3000される。」（atwiki/page-1789）。ランドガンマが何枚あっても1回分（同じ能力を重ねて得ない）。
 * かわりにバトルするユニットはアタックされていないので上がらない。
 */
export function xg2DefenderBattleBonus(state: GameState, pending: PendingBattle, owner: PlayerId, defender: CardInstance): number {
  if (pending.substituteInstanceId && pending.substituteInstanceId === defender.instanceId) return 0;
  if (!hasInArea(state, owner, "XG2-007")) return 0;
  if (getDefinition(state.definitions, defender.cardId)?.type !== "unit" || unitSizeOf(state.definitions, defender) !== "M") return 0;
  const zone = state.players[owner].rush.some((c) => c.instanceId === defender.instanceId) ? "rush" : "battle";
  if ((unitEffectiveCategories(state, owner, defender, zone) as string[]).length < 2) return 0;
  return 3000 * xg2MultiCategoryCommands(state, owner);
}

/** 「自軍合体ユニットまたは自軍「X」1体を捨札にする」（XG2-012 牙大王・XG2-017 大連王）。 */
const FUSION_OR_NAMED = /^自軍合体ユニットまたは自軍[「｢]([^」｣]+)[」｣]1体を捨て?札にする。?$/;

export function xg2HasFusionOrNamedCondition(definition: CardDefinition | undefined): boolean {
  if (!definition) return false;
  // 評価中の定義に付けた変更（rushAdditionalConditionOverride）は見ない。
  const { rushAdditionalConditionOverride: _override, ...original } = definition as CardDefinition & { rushAdditionalConditionOverride?: unknown };
  const base = resolveRushAdditionalCondition(definition.id, original as CardDefinition);
  return base?.conditionId === "discard_fusion_unit" && FUSION_OR_NAMED.test((base.text ?? "").normalize("NFKC").trim());
}

/**
 * 「自軍合体ユニットまたは自軍「X」1体を捨札にする」: 合体のユニットがそろわず、自軍エリアに「X」があれば「自軍「X」1体を捨札にする」として扱う
 * （atwiki/page-1145・1824）。合体のユニットがそろっていれば合体（元の追加条件）。対象外なら undefined。
 */
export function xg2FusionOrNamedCondition(
  state: Board,
  playerId: PlayerId,
  card: CardInstance,
  definition: CardDefinition,
): RushAdditionalCondition | undefined {
  if (!xg2HasFusionOrNamedCondition(definition)) return undefined;
  const base = resolveRushAdditionalCondition(definition.id, definition)!;
  const name = FUSION_OR_NAMED.exec((base.text ?? "").normalize("NFKC").trim())![1]!;
  const player = state.players[playerId];
  if (hasAllRequiredFusionMaterials(player, state.definitions, card.cardId, card.instanceId)) return undefined;
  if (!areaCards(state, playerId).some((c) => c.instanceId !== card.instanceId && cardName(state.definitions, c.cardId) === name)) return undefined;
  return { conditionId: "discard_named_unit", text: base.text, partnerName: name, unitCount: 1 } as RushAdditionalCondition;
}

/** XG2-016 天空気殿 ※「カード名に「X」を含む自軍ユニットがある」（rules/rushAdditionalCondition.ts の条件）。 */
export function xg2NameContainsGate(state: Board, playerId: PlayerId, gateText: string): boolean | null {
  // XG2-044 仮面ライダーW・HM「特徴「メカ」を持つ自軍コマンドがある」（atwiki/page-1815）。
  const cmd = /^特徴[「｢]([^」｣]+)[」｣]を持つ自軍コマンドがある$/.exec(gateText);
  if (cmd) return state.players[playerId].command.some((c) => (getDefinition(state.definitions, c.cardId)?.features ?? []).includes(cmd[1]!));
  const m = /^カード名に[「｢]([^」｣]+)[」｣]を含む自軍ユニットがある$/.exec(gateText);
  if (!m) return null;
  return areaCards(state, playerId).some((c) => getDefinition(state.definitions, c.cardId)?.type === "unit" && cardName(state.definitions, c.cardId).includes(m[1]!));
}

/** その場の効果で記録した、ターン限定のユニット（XG2-042・XG2-055 で出したユニット、XG2-061 を使ったプレイヤー）。 */
export type Xg2TurnEntry = { ownerId: PlayerId; instanceId: string; turn: number };
export const XG2_FAR_KEY = "far";
export const XG2_HENSHIN_KEY = "henshin";
export const XG2_RYOKU_KEY = "ryoku";

/**
 * XG2-058 タイガーアンデッド ※「これが自軍捨札にある間、自軍「仮面ライダーレンゲル」はBP+1000される。（この効果は重複しない）」・
 * 【種のための戦い】「これは、これと同じ特徴を1つ以上持つ、これ以外の自軍バトルエリアのユニット1体につき、BP+1000される。」（atwiki/page-1766）。
 */
function xg2TigerUndeadBonus(state: Board, playerId: PlayerId, instance: CardInstance): number {
  let bonus = 0;
  const player = state.players[playerId];
  if (cardName(state.definitions, instance.cardId) === "仮面ライダーレンゲル" && player.discard.some((c) => isSameCardIdentity(c.cardId, "XG2-058"))) bonus += 1000;
  if (isSameCardIdentity(instance.cardId, "XG2-058")) {
    const own = getDefinition(state.definitions, instance.cardId)?.features ?? [];
    const others = player.battle.filter((c) => {
      if (c.instanceId === instance.instanceId || getDefinition(state.definitions, c.cardId)?.type !== "unit") return false;
      return (getDefinition(state.definitions, c.cardId)?.features ?? []).some((f) => own.includes(f));
    });
    bonus += 1000 * others.length;
  }
  return bonus;
}

/**
 * XG2-042【ファイナルアタックライド】で出したユニットは、このターン、ナンバーの数字が「2」になる（rules/numberComboEffects.ts ncEffectiveNumber。
 * RC のユニットはコンビネーションの判定で扱う。rules/xg2/xg2cEffects.ts）。対象外なら undefined。
 */
export function xg2ComboNumberOverride(state: Pick<GameState, "xg2" | "turn">, playerId: PlayerId, card: CardInstance): number | undefined {
  const entries = (state.xg2?.[XG2_FAR_KEY] as Xg2TurnEntry[] | undefined) ?? [];
  return entries.some((e) => e.ownerId === playerId && e.instanceId === card.instanceId && e.turn === state.turn) ? 2 : undefined;
}

/** 追加条件「特徴「X」を持つ自軍ユニット1体をパワーゾーンに送る」の X（XG2-042・XP-005。rules/zord.ts）。 */
export function xg2PowerPartnerFeature(text: string | undefined): string | undefined {
  return /^特徴[「｢]([^」｣]+)[」｣]を持つ自軍ユニット1体をパワーゾーンに送る。?$/.exec((text ?? "").normalize("NFKC").trim())?.[1];
}

/** 「仮面ライダーディケイド」または「仮面ライダーディエンド」（XG2-075・076・078・080 のかっこ書き）。 */
export const XG2_DECADE_NAMES = ["仮面ライダーディケイド", "仮面ライダーディエンド"];

/**
 * 「自軍「X」1枚をパワーゾーンに送る」（XG2-065 仮面ライダーカブトHF atwiki/page-895。rules/zord.ts の「1体」の形と同じに扱う）。
 */
export function xg2NamedPowerPartner(text: string | undefined): string | undefined {
  return /^自軍[「｢]([^」｣]+)[」｣]1枚をパワーゾーンに送る。?$/.exec((text ?? "").normalize("NFKC").trim())?.[1];
}

/** 常駐置き場のカードの枚数（常駐オペレーションに重ねたカードも数える。XG2-questions Q6）。 */
function residentZoneCount(state: Board, playerId: PlayerId): number {
  return state.players[playerId].operation.reduce((n, c) => n + 1 + (c.stackedCards ?? []).length, 0);
}

/**
 * アタックされないか（dsl/promotedKeywordBridge.ts promotedDefenderBlocksAttack）。
 * XG2-065 仮面ライダーカブトHF【ハイパークロックアップ】「これは、自軍常駐置き場にカードが5枚以上あるとき、次の能力を得る⇒
 * 特徴「加速」を持たないユニットにアタックされない。」（atwiki/page-895）。
 */
export function xg2DefenderBlocksAttack(state: Board, attackerPlayerId: PlayerId, attacker: CardInstance, defenderPlayerId: PlayerId, defender: CardInstance): boolean {
  if (!isSameCardIdentity(defender.cardId, "XG2-065") || residentZoneCount(state, defenderPlayerId) < 5) return false;
  void attackerPlayerId;
  return !(getDefinition(state.definitions, attacker.cardId)?.features ?? []).includes("加速");
}

/**
 * XG2-068 リュウタロス【憑依】で重ねたユニットの能力「これが自軍バトルエリアにある間、すべての敵軍Sユニットは、可能ならバトルエリアに出る。」
 * （atwiki/page-1773。rules/restrictions.ts findMandatoryBattleEntries）。
 */
export function xg2RequiresBattleEntry(state: Board, playerId: PlayerId, card: CardInstance): boolean {
  if (unitSizeOf(state.definitions, card) !== "S" || getDefinition(state.definitions, card.cardId)?.type !== "unit") return false;
  const enemy: PlayerId = playerId === "player1" ? "player2" : "player1";
  return state.players[enemy].battle.some((c) => (c.stackedCards ?? []).some((u) => !u.faceDown && isSameCardIdentity(u.cardId, "XG2-068")));
}

/**
 * XG2-074 クウガゴウラム「※これは、自軍「仮面ライダーディケイド」があれば、ライドされていなくてもバトルエリアに出ることができる。」
 * （atwiki/page-1775。rules/vehicleRules.ts canVehicleEnterBattleFromRush）。
 */
export function xg2VehicleMayEnterUnridden(state: Board, playerId: PlayerId, vehicle: CardInstance): boolean {
  if (!isSameCardIdentity(vehicle.cardId, "XG2-074")) return false;
  return areaCards(state, playerId).some((c) => c.instanceId !== vehicle.instanceId && cardName(state.definitions, c.cardId) === "仮面ライダーディケイド");
}
