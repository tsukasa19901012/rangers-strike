/**
 * ザ・マスクドライダーEXP vol.4 RK-316〜RK-335 の継続効果の判定（低い層から呼ぶ小さなモジュール。rules/rk/rk16UnitEffects.ts が記録を書く）。
 * core/catalog.ts を import しない（定義は state.definitions を直接見る。特徴は呼び出し側から関数で受け取る）。
 *
 * - `rk16MorphDiscardCost` / `rk16MorphEntryHolds`: RK-317【ポッドバッティング】・「ホールドしなければバトルエリアに出られない」ユニットのモーフ
 *   （keywords/morph.ts・keywords/morphReaction.ts）。
 * - `rk16FieldBpBonus`: RK-332 の※（rules/fieldAuras.ts）。
 * - `rk16EffectiveSp`: RK-325 の※（rules/legend3/fieldEffects.ts）。
 * - `rk16DefenderBlocksAttack`: RK-327 の※（rules/legend3/restrictions.ts）。
 * - `rk16NamedTextNegated`: RK-334 の※（効果名を持つテキストの無効。rules/legend1/set6NamedEffects348.ts namedTextNegated）。
 * - `rk16CanDeployFromCommand`: RK-320 の※（rules/keywordGapRuntime.ts canSelfRushFromZone）。
 * - `rk16NoteStrike` / `rk16StrikesReceived`: RK-320【ファイナルライジングブラスト】のストライクの回数（core/applyAction.ts）。
 */
import { getBattleEntryHoldCount, isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../../types/game";
import { getPlayerModifiers } from "../../core/scopedModifiers";

/** RK-320: このターンにストライクされた回数（payload: { count }。このターン）。 */
export const RK16_STRUCK_RULE = "rk320_struck_count";

type Defs = Pick<GameState, "definitions">;

function def(state: Defs, cardId: string) {
  return state.definitions[cardId];
}

function isUnit(state: Defs, card: Pick<CardInstance, "cardId">): boolean {
  return def(state, card.cardId)?.type === "unit";
}

function named(state: Defs, cardId: string, name: string): boolean {
  const n = def(state, cardId)?.name;
  return !!n && n === name;
}

/** 必要パワーの数字（「+」「-」を除く）。 */
export function rk16CostNumber(state: Defs, cardId: string): number {
  const raw = def(state, cardId)?.powerCost;
  if (typeof raw === "number") return raw;
  const m = String(raw ?? "").match(/\d+/);
  return m ? Number(m[0]) : Number.NaN;
}

function fieldCards(player: Pick<PlayerState, "battle" | "rush">): CardInstance[] {
  return [...player.battle, ...player.rush];
}

function commandHasCategory(state: Defs, cardId: string, category: string): boolean {
  const c = def(state, cardId)?.category as string | string[] | undefined;
  return Array.isArray(c) ? c.includes(category) : c === category;
}

/** リリース状態の自軍コマンド（exclude を除く）。 */
export function rk16ReleasedCommands(state: Pick<GameState, "players">, playerId: PlayerId, exclude: string[] = []): CardInstance[] {
  return state.players[playerId].command.filter((c) => !c.commandHeld && !exclude.includes(c.instanceId));
}

// ---------------------------------------------------------------------------
// RK-317 シュードラン【ポッドバッティング】
// 「これが自軍エリアにある間、モーフの効果で自軍コマンドゾーンか自軍パワーゾーンのオモテ向きのカードからユニットカードを選ぶとき、DAを持つ
//  自軍コマンドを2つ（自軍エリアに｢キャッスルドラン｣があれば1つ）ホールドしてもよい。そうしたとき、かわりに自軍捨札から選んでもよい。」
// （atwiki/page-1389）。捨札のカードを選んだときだけ、リリース状態の DA のコマンドを（先頭から）ホールドする。

/** 捨札から選ぶためにホールドする DA のコマンドの数（シュードランがなければ undefined）。 */
export function rk16MorphDiscardCost(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId): number | undefined {
  const own = fieldCards(state.players[playerId]);
  if (!own.some((c) => isSameCardIdentity(c.cardId, "RK-317"))) return undefined;
  return own.some((c) => isUnit(state, c) && named(state, c.cardId, "キャッスルドラン")) ? 1 : 2;
}

/** ホールドできるリリース状態の DA の自軍コマンド。 */
export function rk16ReleasedDaCommands(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId): CardInstance[] {
  return rk16ReleasedCommands(state, playerId).filter((c) => commandHasCategory(state, c.cardId, "DA"));
}

/** 捨札から選べるか（シュードランがあり、ホールドできる DA のコマンドが足りる）。 */
export function rk16CanMorphFromDiscard(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId): boolean {
  const cost = rk16MorphDiscardCost(state, playerId);
  return cost !== undefined && rk16ReleasedDaCommands(state, playerId).length >= cost;
}

/**
 * モーフでバトルエリアに出るとき、ホールドしなければならない自軍コマンドの数。
 * 「※これは自軍コマンドをNつホールドしなければバトルエリアに出られない」はモーフで出るときも働く（atwiki/page-1365 Q2・page-1346 Q1）。
 * 「（モーフで出るときは除く）」と書かれたカード（RK-330）は0。
 */
export function rk16MorphEntryHolds(state: Defs, cardId: string): number {
  const text = def(state, cardId)?.text ?? "";
  if (/モーフで出るときは除く/.test(text)) return 0;
  return getBattleEntryHoldCount(cardId);
}

// ---------------------------------------------------------------------------
// RK-332 仮面ライダー龍騎（2nd）※「これは特徴「ドラゴン」を持つ自軍ユニット1体につきBP+1000される。」（atwiki/page-1252）。
// ユニット（ビークル・ビークルとして扱っているものを除く）を数える。ゾーン・捨札でもオモテ向きなら有効で、ウラ向きなら無効（Q1）。

type FeaturesOf = (state: GameState, playerId: PlayerId, instance: CardInstance) => string[];
type ActsAsVehicle = (player: Pick<PlayerState, "battle" | "rush">, card: CardInstance) => boolean;

export function rk16FieldBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance, featuresOf: FeaturesOf, actsAsVehicle: ActsAsVehicle): number {
  if (!isSameCardIdentity(instance.cardId, "RK-332") || instance.faceDown) return 0;
  const p = state.players[playerId];
  const dragons = fieldCards(p).filter((c) => isUnit(state, c) && !actsAsVehicle(p, c) && featuresOf(state, playerId, c).includes("ドラゴン"));
  return dragons.length * 1000;
}

// ---------------------------------------------------------------------------
// RK-325 パワードイクサー ※「これにライドしているユニットは、「仮面ライダーイクサBM」なら「SP1」になる。」（atwiki/page-1347）

export function rk16EffectiveSp(state: GameState, playerId: PlayerId, instance: CardInstance, sp: number): number {
  if (!instance.mountedOnInstanceId) return sp;
  const vehicle = fieldCards(state.players[playerId]).find((c) => c.instanceId === instance.mountedOnInstanceId);
  if (!vehicle || !isSameCardIdentity(vehicle.cardId, "RK-325")) return sp;
  return named(state, instance.cardId, "仮面ライダーイクサBM") ? 1 : sp;
}

// ---------------------------------------------------------------------------
// RK-327 バッシャー獣人態 ※「このユニットはホールド状態のとき、敵軍ユニットにアタックされない。」（atwiki/page-1352）

export function rk16DefenderBlocksAttack(defender: CardInstance): boolean {
  return isSameCardIdentity(defender.cardId, "RK-327") && defender.commandHeld === true;
}

// ---------------------------------------------------------------------------
// RK-334 仮面ライダー電王LF（2nd）※「これが自軍エリアにある間、必要パワーの数字が2以下のユニットはバトルエリアに出られず、効果名を持つテキストは
// 無効になり発動もできない。」（atwiki/page-1369）。自軍・敵軍のユニットとも（コメント欄の回答）。バトルエリアに出られない方は
// rules/errataCardEffects.ts errataBattleEntryBlocked。ここでは場のユニットの効果名を持つテキストの無効。

export function rk16NamedTextNegated(state: Pick<GameState, "players" | "definitions">, ownerId: PlayerId, card: Pick<CardInstance, "cardId" | "instanceId">): boolean {
  if (!isUnit(state, card)) return false;
  const onField = fieldCards(state.players[ownerId]).some((c) => c.instanceId === card.instanceId);
  if (!onField) return false;
  const n = rk16CostNumber(state, card.cardId);
  if (!Number.isFinite(n) || n > 2) return false;
  return (["player1", "player2"] as const).some((pid) =>
    fieldCards(state.players[pid]).some((c) => c.instanceId !== card.instanceId && isSameCardIdentity(c.cardId, "RK-334")),
  );
}

// ---------------------------------------------------------------------------
// RK-320 仮面ライダーライジングイクサ ※「これが自軍コマンドゾーンにある間、自軍ラッシュフェイズ中、必要パワーの数字が「1」「9」「3」の自軍コマンドが
// それぞれあれば、これを自軍ラッシュエリアに出してもよい。」（atwiki/page-1250）。これ以外の自軍コマンドで数える。ホールド・リリースは問わない。

export function rk16CanDeployFromCommand(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, card: CardInstance): boolean {
  if (!isSameCardIdentity(card.cardId, "RK-320")) return false;
  const costs = new Set(
    state.players[playerId].command.filter((c) => c.instanceId !== card.instanceId).map((c) => rk16CostNumber(state, c.cardId)),
  );
  return costs.has(1) && costs.has(9) && costs.has(3);
}

/** RK-320: このターンに defenderId がストライクされた回数。 */
export function rk16StrikesReceived(state: Pick<GameState, "players">, defenderId: PlayerId): number {
  for (const m of getPlayerModifiers(state.players[defenderId])) {
    if (m.kind === "rule" && m.ruleId === RK16_STRUCK_RULE && m.scope === "turn") return (m.payload as { count?: number } | undefined)?.count ?? 0;
  }
  return 0;
}

/** RK-320: ストライクを宣言されたら数える（core/applyAction.ts の strike）。 */
export function rk16NoteStrike(state: GameState, defenderId: PlayerId): GameState {
  const p = state.players[defenderId];
  const count = rk16StrikesReceived(state, defenderId) + 1;
  const modifiers = [
    ...getPlayerModifiers(p).filter((x) => !(x.kind === "rule" && x.ruleId === RK16_STRUCK_RULE)),
    { kind: "rule" as const, ruleId: RK16_STRUCK_RULE, scope: "turn" as const, sourceCardId: "RK-320", payload: { count } },
  ];
  return { ...state, players: { ...state.players, [defenderId]: { ...p, modifiers } } };
}
