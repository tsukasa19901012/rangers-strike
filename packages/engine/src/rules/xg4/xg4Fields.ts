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
import { cardCategories, isSameCardIdentity, type CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingBattle, PlayerId, PlayerState } from "../../types/game";
import { getPlayerModifiers } from "../../core/scopedModifiers";
import { isCostWindowSatisfied } from "../../core/costWindow";
import { isSmallUnit } from "../../core/catalog";
import { cardHasKeyword } from "../../keywords/cardKeywords";
import { rk12UnitHeldThisTurn } from "../rk/rk12Fields";

type View = Pick<GameState, "players" | "definitions">;

/** XG4-001【黒十字ハリケーン】の NC が成立した（payload: { instanceId }。このターン）。 */
export const XG4_HARIKEN_RULE = "xg4_001_hariken";
/** ラッシュフェイズ中に自分のカードが自軍捨札に置かれた（このターン。XG4-007 の※）。 */
export const XG4_RUSH_DISCARD_RULE = "xg4_rush_phase_discard";

export const DRAGON_ARMOR_CARD_ID = "XG4-006";
/** XG4-044【ランディックアックス】の NC が成立した（payload: { instanceId }。このターン）。 */
export const XG4_RANDIC_RULE = "xg4_044_randic";
/** XG4-054【ストレートフラッシュ】で除外したカードのカテゴリがすべて同じだった（payload: { instanceId }。このターン「SP1」）。 */
export const XG4_STRAIGHT_RULE = "xg4_054_straight";
/** XG4-060【フォトンブレイカー】の RC が成立した（payload: { instanceId }。このターン）。 */
export const XG4_PHOTON_RULE = "xg4_060_photon";
/** XG4-074【ライドルスティック】の RC が成立した（payload: { instanceId }。このターン）。 */
export const XG4_RIDOL_RULE = "xg4_074_ridol";
/** XG4-080【ハードショット】の RC が成立した（payload: { instanceId }。このターン）。 */
export const XG4_HARDSHOT_RULE = "xg4_080_hardshot";
/** XG4-081【ライトニングスラッシュ】で「2」と「6」を見せた（payload: { instanceId }。このターン BP+3000）。 */
export const XG4_LIGHTNING_RULE = "xg4_081_lightning";
/** XG4-083【アタックライド】の RC が成立した（payload: { instanceId }。このターン）。 */
export const XG4_ATTACKRIDE_RULE = "xg4_083_attackride";

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

function printedCategoriesOf(state: Pick<GameState, "definitions">, cardId: string): string[] {
  return cardCategories(state.definitions[cardId]) as string[];
}

function printedFeaturesOf(state: Pick<GameState, "definitions">, cardId: string): string[] {
  return (state.definitions[cardId] as { features?: string[] } | undefined)?.features ?? [];
}

/** 場のユニットがウイングを持つか（効果で得たウイングを含む。XG4-087）。 */
function fieldUnitHasWing(state: View, playerId: PlayerId, instance: CardInstance): boolean {
  return cardHasKeyword(state.definitions, instance.cardId, "wing", { state: state as GameState, playerId }) || xg4RiddenVehicleGrantsWing(state, playerId, instance);
}

/**
 * XG4-098【トリプルボンバー】「このユニットの両隣に特徴「女」を持つ自軍ユニットが並んでいる間」（バトルエリア。印刷の特徴）。
 */
export function xg4FlankedByWomen(state: View, playerId: PlayerId, instanceId: string): boolean {
  const battle = state.players[playerId].battle;
  const idx = battle.findIndex((c) => c.instanceId === instanceId);
  if (idx <= 0 || idx >= battle.length - 1) return false;
  return [battle[idx - 1]!, battle[idx + 1]!].every((c) => isUnit(state, c.cardId) && printedFeaturesOf(state, c.cardId).includes("女"));
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
  // XG4-044【ランディックアックス】「このターン、これは、リリース状態の自軍コマンド1つにつきBP+1000される。」（atwiki/page-2096）。
  if (isSameCardIdentity(instance.cardId, "XG4-044") && hasTurnRecord(state, playerId, XG4_RANDIC_RULE, instance.instanceId)) {
    bonus += state.players[playerId].command.filter((c) => !c.commandHeld).length * 1000;
  }
  // XG4-046「※これはホールド状態のときBP-3000される。」（atwiki/page-2149）。
  if (isSameCardIdentity(instance.cardId, "XG4-046") && instance.commandHeld) bonus -= 3000;
  // XG4-081【ライトニングスラッシュ】「見せたカードの必要パワーの数字が「2」と「6」なら、このターン、このユニットのBPを+3000する。」（atwiki/page-2072）。
  if (isSameCardIdentity(instance.cardId, "XG4-081") && hasTurnRecord(state, playerId, XG4_LIGHTNING_RULE, instance.instanceId)) bonus += 3000;
  // XG4-087【スカイキック】「これが自軍エリアにある間、ウイングを持たないSユニットはBP-500される。」（atwiki/page-2063）。敵軍・自軍の S ユニット。
  // スカイライダーは1枚につき（どちらの場にあっても）。
  if (isUnit(state, instance.cardId) && isSmallUnit(state.definitions, instance)) {
    const skyriders = (["player1", "player2"] as const).reduce((n, pid) => n + fieldOf(state, pid).filter((c) => isSameCardIdentity(c.cardId, "XG4-087")).length, 0);
    if (skyriders > 0 && !fieldUnitHasWing(state, playerId, instance)) bonus -= skyriders * 500;
  }
  // XG4-098【トリプルボンバー】「このユニットの両隣に特徴「女」を持つ自軍ユニットが並んでいる間、このユニットはBP+2000され」（atwiki/page-2119）。
  if (isSameCardIdentity(instance.cardId, "XG4-098") && xg4FlankedByWomen(state, playerId, instance.instanceId)) bonus += 2000;
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
  // XG4-054【ストレートフラッシュ】「このターン、これは「SP1」になる」（除外したカードのカテゴリがすべて同じだったとき）。
  if (isSameCardIdentity(instance.cardId, "XG4-054") && hasTurnRecord(state, playerId, XG4_STRAIGHT_RULE, instance.instanceId)) sp = Math.max(sp, 1);
  // XG4-057「※これは常駐置場にカードが1枚もなければ、「SP1」になる。」（atwiki/page-2135）。常駐置場は自軍・敵軍の両方を見る。
  if (isSameCardIdentity(instance.cardId, "XG4-057") && (["player1", "player2"] as const).every((pid) => (state.players[pid].operation ?? []).length === 0)) {
    sp = Math.max(sp, 1);
  }
  // XG4-097【ヘレンカッター】「これは、BP5000以上の、OTを持ち特徴「男」を持つSユニットと隣り合っている間、次の能力を得る⇒SP1」（atwiki/page-2058）。
  // 隣り合うのはバトルエリアの自軍ユニット。BP はいまの BP、カテゴリ・特徴は印刷のもの。
  if (isSameCardIdentity(instance.cardId, "XG4-097")) {
    const battle = state.players[playerId].battle;
    const idx = battle.findIndex((c) => c.instanceId === instance.instanceId);
    const neighbors = idx < 0 ? [] : [battle[idx - 1], battle[idx + 1]].filter((c): c is CardInstance => !!c);
    const partner = neighbors.some(
      (c) =>
        isUnit(state, c.cardId) &&
        isSmallUnit(state.definitions, c) &&
        printedCategoriesOf(state, c.cardId).includes("OT") &&
        printedFeaturesOf(state, c.cardId).includes("男") &&
        bpOf(state, playerId, c) >= 5000,
    );
    if (partner) sp = Math.max(sp, 1);
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
export function xg4AttackerBattleBonus(
  state: View,
  pending: Pick<PendingBattle, "attackerPlayerId" | "attackerInstanceId"> & Partial<Pick<PendingBattle, "defenderPlayerId" | "defenderInstanceId">>,
  featuresOf: FeaturesOf,
): number {
  const attacker = findOnField(state, pending.attackerPlayerId, pending.attackerInstanceId);
  if (!attacker) return 0;
  let bonus = 0;
  // XG4-007【獣奏剣】「これが自軍エリアにある間、特徴「恐竜」を持つすべての自軍ユニットは、アタックするときBP+2000される。」（1枚につき）。
  const dragons = fieldOf(state, pending.attackerPlayerId).filter((c) => isSameCardIdentity(c.cardId, "XG4-007")).length;
  if (dragons > 0 && featuresOf(state, pending.attackerPlayerId, attacker).includes("恐竜")) bonus += dragons * 2000;
  // XG4-063【お前の罪を数えろ】「これは自軍捨札にSユニットのカードが5枚以上あるとき、次の効果を得る⇒アタックするときBP+3000される。」（atwiki/page-2124）。
  if (isSameCardIdentity(attacker.cardId, "XG4-063")) {
    const sCards = state.players[pending.attackerPlayerId].discard.filter((c) => {
      const d = state.definitions[c.cardId] as { type?: string; size?: string } | undefined;
      return d?.type === "unit" && d.size === "S";
    }).length;
    if (sCards >= 5) bonus += 3000;
  }
  // XG4-092【JANPERSON FOR JUSTICE】「これはカテゴリにDAを持つユニットにアタックするとき、BP+2000される。」（atwiki/page-2140。印刷のカテゴリ）。
  if (isSameCardIdentity(attacker.cardId, "XG4-092") && pending.defenderPlayerId && pending.defenderInstanceId) {
    const defender = findOnField(state, pending.defenderPlayerId, pending.defenderInstanceId);
    if (defender && printedCategoriesOf(state, defender.cardId).includes("DA")) bonus += 2000;
  }
  return bonus;
}

/** バトルエリアに出られないか。 */
export function xg4BlocksBattleEntry(state: View, playerId: PlayerId, unit: Pick<CardInstance, "cardId" | "instanceId">): boolean {
  // XG4-007「※これはラッシュフェイズ中に自分のカードが捨札に置かれたターンにしかバトルエリアに出られない。」（atwiki/page-2132）。
  if (isSameCardIdentity(unit.cardId, "XG4-007") && !hasTurnRecord(state, playerId, XG4_RUSH_DISCARD_RULE)) return true;
  // XG4-084「※これは自軍ユニットがホールドされたターンにしかバトルエリアに出られない。」（atwiki/page-2150。RK-247 と同じ記録。rules/rk/rk12Fields.ts）。
  if (isSameCardIdentity(unit.cardId, "XG4-084") && !rk12UnitHeldThisTurn(state, playerId)) return true;
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
  info?: { hasResist: (card: CardInstance) => boolean; bpOf: (card: CardInstance) => number },
): boolean {
  if (attackerPlayerId === defenderPlayerId) return false;
  // XG4-092「※これは、カテゴリにDAを持たない、特徴「男」または「女」を持つユニットにアタックできない。」（atwiki/page-2140。印刷のカテゴリ・特徴）。
  if (isSameCardIdentity(attacker.cardId, "XG4-092") && !printedCategoriesOf(state, defender.cardId).includes("DA")) {
    const feats = printedFeaturesOf(state, defender.cardId);
    if (feats.includes("男") || feats.includes("女")) return true;
  }
  // XG4-046「※これはレジストを持たないBP3000以下のユニットにアタックできない。」（atwiki/page-2149）。いまの BP。
  if (info && isSameCardIdentity(attacker.cardId, "XG4-046") && !info.hasResist(defender) && info.bpOf(defender) <= 3000) return true;
  // XG4-013「※これはライド中、ウイングを持たないユニットにアタックされない。」（atwiki/page-2092）。
  if (isSameCardIdentity(defender.cardId, "XG4-013") && defender.mountedOnInstanceId && !hasWing(attacker)) return true;
  // XG4-034【風の電子モヂカラ】「これが自軍バトルエリアにある間、これ以外のLユニットとMユニットは、敵軍ユニットにアタックされない。」（atwiki/page-2104）。
  // 守られるのはこれの持ち主の自軍ユニットだけ（同 Q1）。
  const defenderSize = defender.sizeOverride ?? (state.definitions[defender.cardId] as { size?: string } | undefined)?.size;
  if (
    (defenderSize === "L" || defenderSize === "M") &&
    state.players[defenderPlayerId].battle.some((c) => isSameCardIdentity(c.cardId, "XG4-034") && c.instanceId !== defender.instanceId)
  ) {
    return true;
  }
  // XG4-058【忠実な愛機】「これが自軍バトルエリアの最後に並んでいる間、これ以外の自軍Sユニットはアタックされない。」（atwiki/page-2114）。
  const lastInBattle = state.players[defenderPlayerId].battle.at(-1);
  if (defenderSize === "S" && lastInBattle && isSameCardIdentity(lastInBattle.cardId, "XG4-058") && lastInBattle.instanceId !== defender.instanceId) return true;
  return false;
}

/**
 * ライドされていなくてもバトルエリアに出られるビークルか（rules/vehicleRules.ts）。
 * XG4-049【光機動生命体】「これはライドされていなくてもバトルエリアに出ることができる。」（atwiki/page-2076）・
 * XG4-062「※これは、ライドされていなくてもバトルエリアに出ることができる。」（atwiki/page-2139）。
 */
export function xg4VehicleEntersWithoutRide(cardId: string): boolean {
  return isSameCardIdentity(cardId, "XG4-049") || isSameCardIdentity(cardId, "XG4-062");
}

/**
 * 「（この効果はライドしている自軍ユニットからコンビネーションするときはナンバーに関係なく発動する）」の NC（rules/numberComboEffects.ts）。
 * XG4-047 シンケンレッド【車上の赤き侍】（atwiki/page-2108）。直前のユニット（左隣。ビークルは数えない）が、いまビークルにライドしている
 * 自軍ユニットなら、並び順に関係なく成立する。左隣より前にライドしているユニットがいても数えない（利用者の決定 2026-10-20・questions-all.md U-22）。
 */
export function xg4NcAnyNumberFromLeft(state: Pick<GameState, "definitions">, cardId: string, battleBeforeEnter: readonly CardInstance[]): boolean {
  if (!isSameCardIdentity(cardId, "XG4-047")) return false;
  const left = [...battleBeforeEnter].reverse().find((c) => state.definitions[c.cardId]?.type === "unit");
  return !!left?.mountedOnInstanceId;
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
  // XG4-027「※特徴「魔法」を持つ自軍Sユニットは、自軍コマンドを1つホールドすればＲＣを持っていなくてもこのビークルにライドできる。」（atwiki/page-2086）。
  if (isSameCardIdentity(vehicleCardId, "XG4-027")) {
    const d = state.definitions[rider.cardId] as { type?: string; features?: string[] } | undefined;
    return d?.type === "unit" && riderSize === "S" && (d.features ?? []).includes("魔法");
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

/**
 * XG4-039 サムライハオー「※自軍捨札に合体ユニットと同名のカードがあれば、そのユニットは捨札にしなくてもよい。」（atwiki/page-2125）。
 * 合体の素材 slot（どれか1枚）が場にないとき、自軍捨札に同名のカードがあればその素材を省けるか（rules/zord.ts matchFusionCombination）。
 * matchesPartner は捨札のカードが素材 partnerId と同名か（rules/zord.ts fieldCardMatchesPartner）。
 */
export function xg4FusionSlotWaived(
  player: PlayerState,
  rushingInstanceId: string,
  slot: string[],
  matchesPartner: (card: CardInstance, partnerId: string) => boolean,
): boolean {
  const rushing = [...player.hand, ...player.rush, ...player.battle].find((c) => c.instanceId === rushingInstanceId);
  if (!rushing || !isSameCardIdentity(rushing.cardId, "XG4-039")) return false;
  return player.discard.some((c) => slot.some((id) => matchesPartner(c, id)));
}

/**
 * XG4-065 マシンハードタービュラー【飛行】「これにライドしているユニットは次の能力を得る⇒「ウイング」」（atwiki/page-2040）。
 * keywords/battleKeywords.ts のウイングの判定から呼ぶ。
 */
export function xg4RiddenVehicleGrantsWing(state: Pick<GameState, "players">, playerId: PlayerId, unit: Pick<CardInstance, "mountedOnInstanceId">): boolean {
  const vehicleId = unit.mountedOnInstanceId;
  if (!vehicleId) return false;
  const vehicle = findOnField(state, playerId, vehicleId);
  return !!vehicle && isSameCardIdentity(vehicle.cardId, "XG4-065");
}

/**
 * XG4-072 タブー・ドーパント【光弾】「これが自軍エリアにある間、すべてのオペレーションカードは、必要パワーの数字が2増える。（この効果は重複しない）」
 * （atwiki/page-2066）。どちらかの場にあれば +2（core/catalog.ts・rules/operationProcedure.ts のオペレーションの必要パワー）。
 */
export function xg4OperationCostIncrease(state: Pick<GameState, "players">): number {
  return (["player1", "player2"] as const).some((pid) => fieldOf(state, pid).some((c) => isSameCardIdentity(c.cardId, "XG4-072"))) ? 2 : 0;
}

/**
 * レジストを得るか（rules/resist.ts canOfferRegister）。
 * XG4-099【バリア】「これにライドしている特徴「メカ」を持つユニットは、次の能力を得る⇒「レジスト」」（atwiki/page-2120。印刷の特徴）。
 */
export function xg4GrantsResist(state: Pick<GameState, "players" | "definitions">, ownerId: PlayerId, instanceId: string): boolean {
  const unit = findOnField(state, ownerId, instanceId);
  if (!unit?.mountedOnInstanceId || !printedFeaturesOf(state, unit.cardId).includes("メカ")) return false;
  const vehicle = findOnField(state, ownerId, unit.mountedOnInstanceId);
  return !!vehicle && isSameCardIdentity(vehicle.cardId, "XG4-099");
}
