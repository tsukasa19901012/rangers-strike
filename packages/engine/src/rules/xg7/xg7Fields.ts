/**
 * クロスギャザー ザ・ベストパートナー XG7-001〜XG7-068 の継続効果の判定（低いレベルの関数だけ。選択や処理の続きは rules/xg7/xg7Effects.ts）。
 *
 * - `xg7FieldBpBonus`: 常時の BP 修正（rules/fieldAuras.ts passiveNamedFieldBpBonus）。
 * - `xg7AttackerBattleBonus` / `xg7DefenderBattleBonus`: バトル中の BP 修正（rules/namedUnitEffects.ts）。
 * - `xg7EffectiveSp`: SP（rules/legend3/fieldEffects.ts legend3EffectiveSp）。
 * - `xg7DefenderBlocksAttack`: アタックされない（rules/legend3/restrictions.ts canAttackDefender）。
 * - `xg7NotSelectable`: 相手に選ばれない（keywords/effectTargetability.ts isSelectableByOpponentEffect）。
 * - `xg7HandDeployCondition`: 「これが自分の手札にある間、…これを自軍ラッシュエリアに出してもよい」（rules/keywordGapRuntime.ts）。
 * - `xg7NcAnyNumberAt`: 「バトルエリアの2番目にコンビネーションするときは、ナンバーに関係なく発動する」（rules/numberComboEffects.ts）。
 * - `xg7CrossBonus`: このターン得たクロス（keywords/battleKeywords.ts crossShiftLeftOf）。
 * - `xg7UsableAsName`: 条件つきの「「X」として使える」（rules/leaveEffects.ts RS-426）。
 * - `xg7AdjustLeaveIntent`: 撃破したユニットを捨札にするかわりに除外する（rules/operationCounters.ts tryLeaveField）。
 */
import { getCardById, isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PendingLeave, PlayerId } from "../../types/game";
import { effectiveBp, getDefinition, unitEffectiveCategories, unitSizeOf } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { sameCardName } from "../../core/cardNames";
import { unitFeatures } from "../addedFeatures";
import { hasFlag } from "./xg7Registry";
import { isSameVehicleTextIdentity } from "../xg6/xg6dFields";

type Defs = Pick<GameState, "definitions">;

function isId(cardId: string, id: string): boolean {
  return isSameCardIdentity(cardId, id);
}

function areaCards(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

function isUnit(state: Defs, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function areaUnits(state: GameState, playerId: PlayerId): CardInstance[] {
  return areaCards(state, playerId).filter((c) => isUnit(state, c.cardId));
}

function ownTurn(state: Pick<GameState, "activePlayer">, playerId: PlayerId): boolean {
  return state.activePlayer === playerId;
}

/** バトルエリアのアタックしたユニット（ウイングのアタックならラッシュエリア）。 */
function attackerOf(state: GameState, pending: PendingBattle): { card: CardInstance; zone: "battle" | "rush" } | null {
  const p = state.players[pending.attackerPlayerId];
  const inBattle = p.battle.find((c) => c.instanceId === pending.attackerInstanceId);
  if (inBattle) return { card: inBattle, zone: "battle" };
  const inRush = p.rush.find((c) => c.instanceId === pending.attackerInstanceId);
  return inRush ? { card: inRush, zone: "rush" } : null;
}

// ---------------------------------------------------------------------------
// 常時の BP 修正

/**
 * - XG7-007【龍撃剣＆獣奏剣】「これは自軍ターン中、特徴「恐竜」を持つユニット1体につきBP+1000され」（自軍・敵軍のユニットを数える。XG7-questions Q1）。
 * - XG7-007 ※「これが自軍捨札にある間、特徴「恐竜」を持つ自軍Mユニットは、アタックするとき、BP+1000される。」（捨札の枚数分）。
 * - XG7-008【アースの戦士】「これは自軍ターン中、リリース状態の自軍コマンド1つにつきBP+1000される。」
 * - XG7-031【サイクロンアタック】「これにライドしているユニットはBP+1000され」。
 * - XG7-043 ※「これ以外の自軍ユニットがあれば、これはBP-6000され」。
 */
export function xg7FieldBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance, role: "general" | "attacking" | "defending"): number {
  let bonus = 0;
  if (role === "general") {
    if (isId(instance.cardId, "XG7-007") && ownTurn(state, playerId)) {
      const dinos = (["player1", "player2"] as const).reduce(
        (n, pid) => n + areaUnits(state, pid).filter((c) => unitFeatures(state, pid, c).includes("恐竜")).length,
        0,
      );
      bonus += 1000 * dinos;
    }
    if (isId(instance.cardId, "XG7-008") && ownTurn(state, playerId)) {
      bonus += 1000 * state.players[playerId].command.filter((c) => !c.commandHeld).length;
    }
    if (ridingOn(state, playerId, instance, "XG7-031")) bonus += 1000;
    if (xg7043Restricted(state, playerId, instance)) bonus -= 6000;
    // XG7-049 ※「これはカード名に「ガタ」を含む自軍ユニット1体につきBP+500される。」（これ自身も数える）。
    if (isId(instance.cardId, "XG7-049")) {
      bonus += 500 * areaUnits(state, playerId).filter((c) => (getDefinition(state.definitions, c.cardId)?.name ?? "").includes("ガタ")).length;
    }
    // XG7-053 ※「これは、自分と相手の手札1枚につきBP+500される。」
    if (isId(instance.cardId, "XG7-053")) bonus += 500 * (state.players.player1.hand.length + state.players.player2.hand.length);
  }
  if (role === "attacking") {
    const copies = state.players[playerId].discard.filter((c) => isId(c.cardId, "XG7-007")).length;
    if (copies > 0 && unitSizeOf(state.definitions, instance) === "M" && unitFeatures(state, playerId, instance).includes("恐竜")) {
      bonus += 1000 * copies;
    }
  }
  return bonus;
}

/**
 * バトル中のアタックしたユニットの BP 修正。
 * - XG7-019【スカイコンビブレイク】「このターン、自軍ユニットは、ウイングでアタックしたとき、そのバトル中、BP+2000される。」
 *   （ウイングのアタック＝ラッシュエリアからのアタック。NC・これ自身のウイングのアタックで記録する。rules/xg7/xg7aEffects.ts）。
 * - XG7-034【天が呼ぶ、地が呼ぶ、人が呼ぶ】「これは、DAを持つかSPが空欄ではないユニットにアタックするとき、BP+2000される。」
 */
export function xg7AttackerBattleBonus(state: GameState, pending: PendingBattle): number {
  if (pending.effectBattle) return 0;
  const attacker = attackerOf(state, pending);
  if (!attacker) return 0;
  let bonus = 0;
  if (attacker.zone === "rush") {
    const skyCombi = (state.xg7?.flags ?? []).filter((f) => f.key === "xg7019_sky_combi" && f.playerId === pending.attackerPlayerId && f.turn === state.turn);
    bonus += 2000 * new Set(skyCombi.map((f) => f.instanceId)).size;
  }
  // XG7-047【カマキリソード】「これは敵軍Sユニットにアタックするとき、BP+5000される。」
  if (isId(attacker.card.cardId, "XG7-047")) {
    const defender = areaCards(state, pending.defenderPlayerId).find((c) => c.instanceId === pending.defenderInstanceId);
    if (defender && isUnit(state, defender.cardId) && unitSizeOf(state.definitions, defender) === "S") bonus += 5000;
  }
  // XG7-052 ※「これは、ウイングでアタックするときBP+2000される。」（ラッシュエリアからのアタック）。
  if (attacker.zone === "rush" && isId(attacker.card.cardId, "XG7-052")) bonus += 2000;
  // XG7-058【鋼鉄のマッチョボディ】「これはホールド状態なら、アタックするときBP+2000される。」
  if (isId(attacker.card.cardId, "XG7-058") && attacker.card.commandHeld) bonus += 2000;
  if (isId(attacker.card.cardId, "XG7-034")) {
    const defender = areaCards(state, pending.defenderPlayerId).find((c) => c.instanceId === pending.defenderInstanceId);
    const sp = defender ? getDefinition(state.definitions, defender.cardId)?.sp : undefined;
    const hasDa = defender ? unitEffectiveCategories(state, pending.defenderPlayerId, defender, "battle").includes("DA") : false;
    if (defender && (hasDa || (sp !== undefined && sp !== null))) bonus += 2000;
  }
  return bonus;
}

export function xg7DefenderBattleBonus(_state: GameState, _pending: PendingBattle, _ownerId: PlayerId, _card: CardInstance): number {
  return 0;
}

// ---------------------------------------------------------------------------
// SP

/** XG7-007【龍撃剣＆獣奏剣】「BP8000以上のときSP1になる」。 */
export function xg7EffectiveSp(state: GameState, playerId: PlayerId, instance: CardInstance, sp: number): number {
  if (isId(instance.cardId, "XG7-007") && effectiveBp(state, playerId, instance) >= 8000) return Math.max(sp, 1);
  return sp;
}

// ---------------------------------------------------------------------------
// アタック・選ばれない

/** XG7-009【受け継いだもの】「これは自軍Lユニットがあれば、敵軍ユニットにアタックされない。」 */
export function xg7DefenderBlocksAttack(state: GameState, attackerPlayerId: PlayerId, _attacker: CardInstance, defenderPlayerId: PlayerId, defender: CardInstance): boolean {
  if (attackerPlayerId === defenderPlayerId) return false;
  if (isId(defender.cardId, "XG7-009") && areaUnits(state, defenderPlayerId).some((c) => unitSizeOf(state.definitions, c) === "L")) return true;
  return false;
}

/**
 * 相手に選ばれない（selectorPlayerId が ownerId の相手のとき）。
 * - XG7-009【受け継いだもの】「このユニットと隣り合うOTを持つLユニットはアタックされる以外では相手に選ばれない。」（バトルエリアの並びで両隣）。
 */
export function xg7NotSelectable(state: GameState, selectorPlayerId: PlayerId, ownerId: PlayerId, card: CardInstance): boolean {
  if (selectorPlayerId === ownerId) return false;
  const battle = state.players[ownerId].battle;
  const index = battle.findIndex((c) => c.instanceId === card.instanceId);
  if (index >= 0 && unitSizeOf(state.definitions, card) === "L" && unitEffectiveCategories(state, ownerId, card, "battle").includes("OT")) {
    const neighbors = [battle[index - 1], battle[index + 1]].filter((c): c is CardInstance => !!c);
    if (neighbors.some((c) => isId(c.cardId, "XG7-009"))) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 手札から出す

/**
 * 「※これが自分の手札にある間、自軍ラッシュフェイズ中、＜条件＞あれば、これを自軍ラッシュエリアに出してもよい。」の条件。
 * 対象外のカードは null。
 * - XG7-006 ギンガピンク「特徴「獣」を持つ自軍ビークルか、特徴「ブラック」を持つ自軍ユニットがあれば」。
 */
export function xg7HandDeployCondition(state: GameState, playerId: PlayerId, cardId: string): boolean | null {
  if (isId(cardId, "XG7-006")) {
    return areaCards(state, playerId).some((c) => {
      const type = getDefinition(state.definitions, c.cardId)?.type;
      const features = unitFeatures(state, playerId, c);
      return (type === "vehicle" && features.includes("獣")) || (type === "unit" && features.includes("ブラック"));
    });
  }
  return null;
}

// ---------------------------------------------------------------------------
// コンビネーション・クロス

/**
 * 「ナンバーに関係なく発動する」。
 * - XG7-013・XG7-016「（この効果はバトルエリアの2番目にコンビネーションするときは、ナンバーに関係なく発動する）」。
 * - XG7-067【ヘビーサイクロン】「（この効果は「ドラフトブルース」または「ドラフトキース」からコンビネーションするときはナンバーに関係なく発動する）」
 *   （すぐ前に並んだユニット）。
 */
export function xg7NcAnyNumberAt(cardId: string, battlePosition: number, state?: Defs, battleBeforeEnter: readonly CardInstance[] = []): boolean {
  if (battlePosition === 2 && (isId(cardId, "XG7-013") || isId(cardId, "XG7-016"))) return true;
  if (state && isId(cardId, "XG7-067")) {
    const left = battleBeforeEnter.at(-1);
    const name = left ? getDefinition(state.definitions, left.cardId)?.name : undefined;
    return sameCardName(name, "ドラフトブルース") || sameCardName(name, "ドラフトキース");
  }
  return false;
}

/** このターン得たクロスの値（XG7-015【ボウケンジャーになれ】等）。 */
export function xg7CrossBonus(card: Pick<CardInstance, "xg7Turn">): number {
  return card.xg7Turn?.cross ?? 0;
}

// ---------------------------------------------------------------------------
// カード名

/**
 * 条件つきの「「X」として使える」。
 * - XG7-016 黒獅子リオ×スーパーゲキレッド「※自軍Lユニットが無ければ、これは「ゲキレッド+黒獅子リオ」として使える。」
 */
export function xg7UsableAsName(state: GameState, ownerId: PlayerId, cardId: string, name: string): boolean {
  if (isId(cardId, "XG7-016") && (sameCardName(name, "ゲキレッド") || sameCardName(name, "黒獅子リオ"))) {
    return !areaUnits(state, ownerId).some((c) => unitSizeOf(state.definitions, c) === "L");
  }
  return false;
}

// ---------------------------------------------------------------------------
// 離場

/**
 * XG7-008【アースの戦士】「BP7000以上のとき、次の能力を得る⇒これがバトルで敵軍ユニットを撃破したとき、捨札にするかわりにゲームから除外する。」
 * バトルで撃破されて捨札になる離場を、捨札のかわりに除外する離場にする。
 */
export function xg7AdjustLeaveIntent(state: GameState, intent: PendingLeave): PendingLeave {
  if (intent.xg7Exile || intent.toZone !== "discard" || intent.notDestruction || !intent.battleOpponentInstanceId) return intent;
  const enemyId = opponent(intent.ownerPlayerId);
  const by = areaCards(state, enemyId).find((c) => c.instanceId === intent.battleOpponentInstanceId);
  if (!by || !isId(by.cardId, "XG7-008")) return intent;
  if (effectiveBp(state, enemyId, by) < 7000) return intent;
  return { ...intent, xg7Exile: true };
}

/** このターンの記録があるか（xg7Registry.hasFlag の再輸出。fields だけを読み込む呼び出し側のため）。 */
export const xg7HasFlag = hasFlag;

// ---------------------------------------------------------------------------
// XG7-024〜XG7-046

/** instance がライドしているビークルが vehicleId か（同じプレイヤーのエリア）。 */
function ridingOn(state: Pick<GameState, "players">, playerId: PlayerId, instance: CardInstance, vehicleId: string): boolean {
  const mounted = instance.mountedOnInstanceId;
  if (!mounted) return false;
  const vehicle = areaCards(state, playerId).find((c) => c.instanceId === mounted);
  return !!vehicle && isSameVehicleTextIdentity(vehicle.cardId, vehicleId);
}

/** XG7-043 ※「これ以外の自軍ユニットがあれば、これはBP-6000されストライクできない。」 */
function xg7043Restricted(state: GameState, playerId: PlayerId, instance: CardInstance): boolean {
  if (!isId(instance.cardId, "XG7-043")) return false;
  const p = state.players[playerId];
  if (![...p.battle, ...p.rush].some((c) => c.instanceId === instance.instanceId)) return false;
  return areaUnits(state, playerId).some((c) => c.instanceId !== instance.instanceId);
}

/** ストライクできない（rules/combo.ts canStrikeUnit）。XG7-043。 */
export function xg7BlocksStrike(state: GameState, playerId: PlayerId, instance: CardInstance): boolean {
  return xg7043Restricted(state, playerId, instance);
}

/** XG7-032【ライダーダブルキック】「これがアタックするとき、バトル相手のユニットのBPをカードに表記された本来の値としてバトルし」（RC で得たこのターンの記録）。 */
export function xg7UsePrintedDefenderBp(state: GameState, pending: Pick<PendingBattle, "attackerPlayerId" | "attackerInstanceId" | "effectBattle">): boolean {
  if (pending.effectBattle) return false;
  return hasFlag(state, "xg7032_double_kick", pending.attackerPlayerId, pending.attackerInstanceId);
}

/** XG7-032【ライダーダブルキック】「自分が次の行動を宣言するまで、すべての敵軍ユニットはホールドすることができない。」— そのバトルで撃破された敵軍ユニットはレジストを使えない。 */
export function xg7BlocksResist(state: GameState, pending: Pick<PendingBattle, "attackerPlayerId" | "attackerInstanceId" | "effectBattle">): boolean {
  return xg7UsePrintedDefenderBp(state, pending);
}

/** XG7-025 ※「このユニットのナンバーの数字は、リリース状態の自軍コマンド1つにつき1少なくなる。」（rules/numberComboEffects.ts ncEffectiveNumber）。 */
export function xg7ComboNumberDelta(state: GameState, playerId: PlayerId, card: CardInstance): number {
  if (!isId(card.cardId, "XG7-025")) return 0;
  return -state.players[playerId].command.filter((c) => !c.commandHeld).length;
}

/**
 * XG7-031 新サイクロン号 ※「これにライドしているユニットは、「仮面ライダー1号」または「仮面ライダー2号」ならクロス1を得る。」
 * バトルエリアの index のカードが持つクロス（keywords/battleKeywords.ts crossShiftLeftOf）。
 */
export function xg7RiderCross(battle: readonly CardInstance[], index: number): number {
  const card = battle[index];
  if (!card?.mountedOnInstanceId) return 0;
  const vehicle = battle.find((c) => c.instanceId === card.mountedOnInstanceId);
  if (!vehicle || !isId(vehicle.cardId, "XG7-031")) return 0;
  const name = getCardById(card.cardId)?.name;
  return sameCardName(name, "仮面ライダー1号") || sameCardName(name, "仮面ライダー2号") ? 1 : 0;
}

// ---------------------------------------------------------------------------
// XG7-047〜XG7-068

/** XG7-058 ※「これは自軍エリアまたは自軍ゾーンにある間、自軍ターン中、特徴「メカ」を得る。」（rules/addedFeatures.ts unitFeatures）。 */
export function xg7AddedFeatures(state: Partial<Pick<GameState, "activePlayer">>, ownerId: PlayerId, instance: Pick<CardInstance, "cardId">): string[] {
  if (isId(instance.cardId, "XG7-058") && state.activePlayer === ownerId) return ["メカ"];
  return [];
}

/**
 * XG7-068【蒸着・赤射・焼結】「これが自軍パワーゾーンでオモテ向きになっている間、自軍ラッシュフェイズ中、特徴「宇宙刑事」を持つ自軍ユニットがなければ、
 * 自軍コマンドゾーンからオペレーションカードを3枚選びホールドしてもよい。」（rules/keywordGapRuntime.ts canSelfRushFromZone。ホールドできるのはリリース状態のもの）。
 */
export function xg7CanDeployFromPower(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  if (!isId(card.cardId, "XG7-068") || card.faceDown) return false;
  if (areaUnits(state, playerId).some((c) => unitFeatures(state, playerId, c).includes("宇宙刑事"))) return false;
  return state.players[playerId].command.filter((c) => !c.commandHeld && getDefinition(state.definitions, c.cardId)?.type === "operation").length >= 3;
}

/** XG7-054 ◎2「このターン、次に自分が手札から使用するカードの必要パワーの数字は、3少なくなる。」（core/power.ts effectivePowerCost）。 */
export function xg7NextCardCostReduction(state: Pick<GameState, "activePlayer">, playerId: PlayerId): number {
  const full = state as Partial<GameState>;
  if (full.activePlayer !== playerId || full.turn === undefined) return 0;
  return hasFlag(full as GameState, "xg7054_cost_minus3", playerId) ? 3 : 0;
}
