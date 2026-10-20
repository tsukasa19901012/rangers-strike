/**
 * クロスギャザー ザ・ギガンティックタイタン（XG6）の継続効果の判定（cardSpec XG6 の監査）。ほかの処理の場所から呼ぶ小さな判定だけを置く。
 *
 * - `xg6FieldBpBonus`: XG6-013 英雄タイタンの※（BP-1000）・XG6-021【激臨剣】の能力（BP+2000。rules/fieldAuras.ts）。
 * - `xg6EffectiveSp`: XG6-021【激臨剣】の能力（BP20000以上で「SP2」。rules/legend3/fieldEffects.ts）。
 * - `xg6CommandCategories` / `xg6CommandPowerBonus`: XG6-013【未来の戦士達へ】（core/catalog.ts・core/power.ts）。
 * - `xg6LoseDamageThreshold`: XG6-020【究極の大冒険】（core/createGame.ts）。
 * - `xg6BlocksAttack`: XG6-012 フラッシュタイタンの※（rules/legend3/restrictions.ts）。
 * - `xg6GrantsBlast`: XG6-004 フルブラスト・アクション（keywords/battleKeywords.ts）。
 * - ターン中の記録（`hasXg6Mark` 等。GameState.xg6）。
 */
import { cardCategories, isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../../types/game";
import { getPlayerModifiers, hasTurnRuleModifier } from "../../core/scopedModifiers";
import { cardHasKeyword } from "../../keywords/cardKeywords";

type Marks = NonNullable<NonNullable<GameState["xg6"]>["marks"]>;
type Mark = Marks[number];

export const XG6_BLAST_RULE_ID = "xg6_004_full_blast";

/** このターンの記録（key・playerId・instanceId が一致するもの）。 */
export function xg6Marks(state: Pick<GameState, "xg6" | "turn">, key: string, playerId?: PlayerId, instanceId?: string): Mark[] {
  return (state.xg6?.marks ?? []).filter(
    (m) => m.key === key && m.turn === state.turn && (!playerId || m.playerId === playerId) && (!instanceId || m.instanceId === instanceId),
  );
}

export function hasXg6Mark(state: Pick<GameState, "xg6" | "turn">, key: string, playerId?: PlayerId, instanceId?: string): boolean {
  return xg6Marks(state, key, playerId, instanceId).length > 0;
}

/** このターンの記録を足す（前のターンの記録は消す）。 */
export function addXg6Mark(state: GameState, mark: Omit<Mark, "turn">): GameState {
  const kept = (state.xg6?.marks ?? []).filter((m) => m.turn === state.turn);
  return { ...state, xg6: { ...state.xg6, marks: [...kept, { ...mark, turn: state.turn }] } };
}

export function removeXg6Marks(state: GameState, key: string, instanceId?: string): GameState {
  const marks = state.xg6?.marks ?? [];
  if (!marks.some((m) => m.key === key && (!instanceId || m.instanceId === instanceId))) return state;
  return { ...state, xg6: { ...state.xg6, marks: marks.filter((m) => !(m.key === key && (!instanceId || m.instanceId === instanceId))) } };
}

function printedCategories(state: Pick<GameState, "definitions">, cardId: string): string[] {
  return cardCategories(state.definitions[cardId]) as string[];
}

function fieldOf(player: Pick<PlayerState, "battle" | "rush">): CardInstance[] {
  return [...player.battle, ...player.rush];
}

/** 自軍捨札にあるカテゴリを2つ以上持つカードの枚数（XG6-021・XG6-022）。 */
export function xg6MultiCategoryDiscardCount(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId): number {
  return state.players[playerId].discard.filter((c) => printedCategories(state, c.cardId).length >= 2).length;
}

/** XG6-021【激臨剣】の能力を得ているユニットか（このターン）。 */
function hasGekirinken(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  return hasXg6Mark(state, "XG6-021", playerId, instanceId);
}

export function xg6FieldBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  let bonus = 0;
  // XG6-013 英雄タイタン「※これは、「OT」以外のカテゴリを持つコマンド1つにつきBP-1000される。」（両軍のコマンド。atwiki/page-2326）
  if (isSameCardIdentity(instance.cardId, "XG6-013")) {
    const count = (["player1", "player2"] as const).reduce(
      (sum, pid) =>
        sum +
        state.players[pid].command.filter((c) => xg6CommandCategories(c.cardId, printedCategories(state, c.cardId)).some((cat) => cat !== "OT")).length,
      0,
    );
    bonus -= 1000 * count;
  }
  // XG6-021【激臨剣】「これは、自軍捨札にあるカテゴリを2つ以上持つカード1枚につきBP+2000され」（atwiki/page-2351）
  if (hasGekirinken(state, playerId, instance.instanceId)) bonus += 2000 * xg6MultiCategoryDiscardCount(state, playerId);
  return bonus + xg6bFieldBpBonus(state, playerId, instance) + xg6cFieldBpBonus(state, playerId, instance);
}

// ---------------------------------------------------------------------------
// XG6-023〜XG6-044 の継続効果

function isCardId(cardId: string, id: string): boolean {
  return isSameCardIdentity(cardId, id);
}

function enemyOf(playerId: PlayerId): PlayerId {
  return playerId === "player1" ? "player2" : "player1";
}

function isUnitCardId(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return state.definitions[cardId]?.type === "unit";
}

function fieldUnitsOf(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId): CardInstance[] {
  return fieldOf(state.players[playerId]).filter((c) => isUnitCardId(state, c.cardId));
}

/** 本来のカード名に含むアルファベット（A〜Z・a〜z。全角も数える。ギリシャ文字は数えない。XG6-041 Q1）の数。 */
function latinLetterCount(state: Pick<GameState, "definitions">, cardId: string): number {
  return ((state.definitions[cardId]?.name ?? "").normalize("NFKC").match(/[A-Za-z]/g) ?? []).length;
}

/** 場の XG6-041 仮面ライダーエターナルの数（両軍）。 */
function eternalCount(state: Pick<GameState, "players">): number {
  return (["player1", "player2"] as const).reduce((n, pid) => n + fieldOf(state.players[pid]).filter((c) => isCardId(c.cardId, "XG6-041")).length, 0);
}

/** XG6-035 仮面ライダーW・CJX「※これは自軍コマンドゾーンにあるカテゴリが追加される。」（atwiki/page-2317） */
export function xg6AddedCategories<T extends string>(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, instance: CardInstance): T[] {
  if (!isCardId(instance.cardId, "XG6-035")) return [];
  const cats = state.players[playerId].command.flatMap((c) => xg6CommandCategories(c.cardId, printedCategories(state, c.cardId)));
  return [...new Set(cats)] as T[];
}

function xg6bFieldBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  let bonus = 0;
  const enemyId = enemyOf(playerId);
  // XG6-023 データスハイパー【ハイパーパンチ】「敵軍Lユニットがあれば、これはBP+5000される。」（atwiki/page-2293）
  if (isCardId(instance.cardId, "XG6-023") && fieldUnitsOf(state, enemyId).some((c) => state.definitions[c.cardId]?.size === "L")) bonus += 5000;
  // XG6-029 強化スカイライダー「※これは特徴「仮面ライダー」を持つ自軍コマンド1つにつきBP+500される。」（atwiki/page-2323）
  if (isCardId(instance.cardId, "XG6-029")) {
    bonus += 500 * state.players[playerId].command.filter((c) => (state.definitions[c.cardId]?.features ?? []).includes("仮面ライダー")).length;
  }
  // XG6-032 巨大邪神14【絶対的な最強の力】「下にウラ向きで重ねたカードがあれば…敵軍ユニット1体につきBP+1000され」（atwiki/page-2288）
  if (isCardId(instance.cardId, "XG6-032") && (instance.stackedCards ?? []).some((c) => c.faceDown)) bonus += 1000 * fieldUnitsOf(state, enemyId).length;
  // XG6-035【ビッカーチャージブレイク】「これが持っているカテゴリ１つにつきBP＋2000される。」（atwiki/page-2317）
  if (isCardId(instance.cardId, "XG6-035")) {
    bonus += 2000 * new Set([...printedCategories(state, instance.cardId), ...xg6AddedCategories(state, playerId, instance)]).size;
  }
  // XG6-041【死神のパーティータイムだ】「本来のカード名にアルファベットを含むユニットはBP－1000され」（両軍。atwiki/page-2316）
  if (latinLetterCount(state, instance.cardId) > 0) bonus -= 1000 * eternalCount(state);
  // XG6-043【強き心と強き願い】「これはBP+3000され」（このターンの記録）
  if (hasXg6Mark(state, "XG6-043:bp", playerId, instance.instanceId)) bonus += 3000;
  return bonus;
}

/** XG6-030【唯一の弱点】「これは自軍コマンドがすべてホールド状態なら、敵軍Sユニットにアタックされない。」（コマンドが0枚なら発動しない） */
export function xg6DefenderBlocksAttack(
  state: Pick<GameState, "players" | "definitions">,
  attacker: CardInstance,
  defenderPlayerId: PlayerId,
  defenderInstanceId: string,
): boolean {
  const defender = fieldOf(state.players[defenderPlayerId]).find((c) => c.instanceId === defenderInstanceId);
  // XG6-065 サブマシーン【友情の証】「これは自軍Lユニットがあれば、敵軍ユニットにアタックされない。」（エリアを問わない）
  if (defender && isCardId(defender.cardId, "XG6-065")) return fieldUnitsOf(state, defenderPlayerId).some((c) => sizeOf(state, c) === "L");
  if (!defender || !isCardId(defender.cardId, "XG6-030")) return false;
  if (state.definitions[attacker.cardId]?.size !== "S") return false;
  const command = state.players[defenderPlayerId].command;
  return command.length > 0 && command.every((c) => c.commandHeld);
}

/** XG6-031「※これが自軍エリアにある間、本来のBPの下三桁が500でない自軍ユニットはラッシュできない。」 */
export function xg6BlocksRush(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, cardId: string): boolean {
  if (!fieldOf(state.players[playerId]).some((c) => isCardId(c.cardId, "XG6-031"))) return false;
  const def = state.definitions[cardId];
  if (def?.type !== "unit") return false;
  const bp = typeof def.bp === "number" ? def.bp : 0;
  return bp % 1000 !== 500;
}

/** XG6-029【大反転スカイキック】「その後、このターン、これはバトルエリアに出られない。」（このターンの記録） */
export function xg6BlocksBattleEntry(state: Pick<GameState, "xg6" | "turn">, playerId: PlayerId, unit: CardInstance): boolean {
  // XG6-054【帽子が似合う男になれ】「戻したユニットはこのターン、再びバトルエリアに出ることはできない。」も同じ記録の形。
  return hasXg6Mark(state, "XG6-029:no_entry", playerId, unit.instanceId) || hasXg6Mark(state, "XG6-054:no_entry", playerId, unit.instanceId);
}

/** XG6-041「含んだアルファベットが3文字以上あれば次の制限を受ける→これはストライクすることができない。」 */
export function xg6BlocksStrike(state: Pick<GameState, "players" | "definitions">, instance: CardInstance): boolean {
  return eternalCount(state) > 0 && latinLetterCount(state, instance.cardId) >= 3;
}

/** XG6-043「※特徴「女」を持つ自軍ユニットがあれば、これはレジストを得る。」 */
export function xg6GrantsRegister(
  state: Pick<GameState, "players" | "definitions">,
  playerId: PlayerId,
  instanceId: string,
  featuresOf: (card: CardInstance) => string[],
): boolean {
  const self = fieldOf(state.players[playerId]).find((c) => c.instanceId === instanceId);
  if (!self || !isCardId(self.cardId, "XG6-043")) return false;
  return fieldUnitsOf(state, playerId).some((c) => c.instanceId !== instanceId && featuresOf(c).includes("女"));
}

function xg6bEffectiveSp(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  sp: number,
  bpOf: (state: GameState, playerId: PlayerId, instance: CardInstance) => number,
): number {
  // XG6-031【種の根絶】「ユニットがこれ1体だけなら、これは「SP3」になる。」（両軍の場のユニット。Q1 ラッシュしたターン以降も）
  if (isCardId(instance.cardId, "XG6-031")) {
    const all = [...fieldUnitsOf(state, "player1"), ...fieldUnitsOf(state, "player2")];
    if (all.length === 1 && all[0]!.instanceId === instance.instanceId) sp = Math.max(sp, 3);
  }
  // XG6-032「BP12000以上のときSP2になる」（下にウラ向きのカードがあるとき）
  if (isCardId(instance.cardId, "XG6-032") && (instance.stackedCards ?? []).some((c) => c.faceDown) && bpOf(state, playerId, instance) >= 12000) {
    sp = Math.max(sp, 2);
  }
  // XG6-040【ライダーキック】「そうしたとき、これはSP1になる。」・XG6-043「「SP2」になる」（このターンの記録）
  if (hasXg6Mark(state, "XG6-040:sp1", playerId, instance.instanceId)) sp = Math.max(sp, 1);
  if (hasXg6Mark(state, "XG6-043:sp2", playerId, instance.instanceId)) sp = Math.max(sp, 2);
  return sp;
}

export function xg6EffectiveSp(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  sp: number,
  bpOf: (state: GameState, playerId: PlayerId, instance: CardInstance) => number,
): number {
  // XG6-021【激臨剣】「BP20000以上のとき「SP2」になる」
  if (hasGekirinken(state, playerId, instance.instanceId) && bpOf(state, playerId, instance) >= 20000) sp = Math.max(sp, 2);
  return xg6cEffectiveSp(state, playerId, instance, xg6bEffectiveSp(state, playerId, instance, sp, bpOf));
}

/** XG6-013【未来の戦士達へ】「これが自軍コマンドゾーンにある間、このカードはカテゴリにWB、MA、ETが追加され」 */
export function xg6CommandCategories<T extends string>(cardId: string, printed: T[]): T[] {
  if (!isSameCardIdentity(cardId, "XG6-013")) return printed;
  return [...new Set([...printed, "WB", "MA", "ET"] as T[])];
}

/**
 * コマンドゾーンのカードが相手のパワーに足す数（マルチカテゴリの1を含む）。XG6-013 はカテゴリが追加されてマルチカテゴリになり（1）、
 * 「敵軍パワーは追加で2増える」（2）。それ以外は 0（呼び出し側の印刷のマルチカテゴリの判定に任せる）。
 */
export function xg6CommandPowerBonus(cardId: string): number {
  return isSameCardIdentity(cardId, "XG6-013") ? 3 : 0;
}

/** XG6-020【究極の大冒険】「これが自軍エリアにある間、自分はダメージが10点になるまでゲームに負けない。」 */
export function xg6LoseDamageThreshold(state: Pick<GameState, "players">, playerId: PlayerId): number {
  return fieldOf(state.players[playerId]).some((c) => isSameCardIdentity(c.cardId, "XG6-020")) ? 10 : 0;
}

/** XG6-012 フラッシュタイタン「※自軍「タイタンボーイ」があるとき、これはアタックすることができない。」 */
export function xg6BlocksAttack(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, attackerCardId: string): boolean {
  if (!isSameCardIdentity(attackerCardId, "XG6-012")) return false;
  return fieldOf(state.players[playerId]).some((c) => state.definitions[c.cardId]?.name === "タイタンボーイ");
}

/** XG6-004 フルブラスト・アクション: このターン、手札にあった BP16000 以下の L ユニットのカードはブラストを得る。 */
export function xg6GrantsBlast(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, cardId: string): boolean {
  const player = state.players[playerId];
  if (!hasTurnRuleModifier(player, XG6_BLAST_RULE_ID)) return false;
  const def = state.definitions[cardId];
  return def?.type === "unit" && def.size === "L" && typeof def.bp === "number" && def.bp <= 16000;
}

// ---------------------------------------------------------------------------
// XG6-045〜XG6-065 の継続効果

function sizeOf(state: Pick<GameState, "definitions">, card: CardInstance): string | undefined {
  return card.sizeOverride ?? state.definitions[card.cardId]?.size;
}

/** バトルエリアで、card の組（ライドしていればビークルから）の1つ前のユニット。 */
function previousInBattle(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, instanceId: string): CardInstance | undefined {
  const battle = state.players[playerId].battle;
  const idx = battle.findIndex((c) => c.instanceId === instanceId);
  const unit = battle[idx];
  if (!unit) return undefined;
  const start = unit.mountedOnInstanceId && battle[idx - 1]?.instanceId === unit.mountedOnInstanceId ? idx - 1 : idx;
  const prev = battle[start - 1];
  return prev && isUnitCardId(state, prev.cardId) ? prev : undefined;
}

/** XG6-045 テディ「このユニットからコンビネーションする「仮面ライダーNEW電王SF」」（バトルエリアでテディの次に並んだ XG6-044）。 */
export function xg6TeddyCombo(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, instanceId: string): boolean {
  const unit = state.players[playerId].battle.find((c) => c.instanceId === instanceId);
  if (!unit || !isCardId(unit.cardId, "XG6-044")) return false;
  const prev = previousInBattle(state, playerId, instanceId);
  return !!prev && isCardId(prev.cardId, "XG6-045");
}

/** XG6-053 仮面ライダーアーク「※これ以外のユニットがSユニットだけなら、これはLユニットになり」（両軍の場のユニット。Q1） */
export function xg6ArkIsLarge(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, instance: CardInstance): boolean {
  if (!isCardId(instance.cardId, "XG6-053")) return false;
  if (!fieldOf(state.players[playerId]).some((c) => c.instanceId === instance.instanceId)) return false;
  const others = [...fieldUnitsOf(state, "player1"), ...fieldUnitsOf(state, "player2")].filter((c) => c.instanceId !== instance.instanceId);
  return others.every((c) => sizeOf(state, c) === "S");
}

function xg6cFieldBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  let bonus = 0;
  // XG6-045「このコンビネーションが成立している間BP+2000される。」（XG6-044 のほう）
  if (xg6TeddyCombo(state, playerId, instance.instanceId)) bonus += 2000;
  // XG6-046 仮面ライダーディエンドCF「※これは特徴｢仮面ライダー｣を持つ自軍ユニット1体につきBP+1000される｡」（これ自身も数える）
  if (isCardId(instance.cardId, "XG6-046")) {
    bonus += 1000 * fieldUnitsOf(state, playerId).filter((c) => (state.definitions[c.cardId]?.features ?? []).includes("仮面ライダー")).length;
  }
  // XG6-053「これはLユニットになり、BP+2000される。」
  if (xg6ArkIsLarge(state, playerId, instance)) bonus += 2000;
  // XG6-054【帽子が似合う男になれ】「このユニットのBPに戻したユニットのBPを「+」する。」・XG6-055「出したユニットは、BP+2000され」
  for (const m of xg6Marks(state, "XG6-054:bp", playerId, instance.instanceId)) bonus += m.value ?? 0;
  if (hasXg6Mark(state, "XG6-055:bp", playerId, instance.instanceId)) bonus += 2000;
  // XG6-065【友情の証】「このユニットと隣り合うETを持つLユニットはBP+1000される。」（自軍バトルエリアの左右）
  if (sizeOf(state, instance) === "L" && printedCategories(state, instance.cardId).includes("ET")) {
    const battle = state.players[playerId].battle;
    const idx = battle.findIndex((c) => c.instanceId === instance.instanceId);
    if (idx >= 0) bonus += 1000 * [battle[idx - 1], battle[idx + 1]].filter((c) => c && isCardId(c.cardId, "XG6-065")).length;
  }
  return bonus;
}

function xg6cEffectiveSp(state: GameState, playerId: PlayerId, instance: CardInstance, sp: number): number {
  // XG6-063 ワンエイト【全弾発射】「このターン、これはSP1/5になり、…1と8だったなら、SP1になる。」
  if (hasXg6Mark(state, "XG6-063:sp1", playerId, instance.instanceId)) sp = Math.max(sp, 1);
  if (hasXg6Mark(state, "XG6-063:sp1_5", playerId, instance.instanceId)) {
    const pos = state.players[playerId].battle.findIndex((c) => c.instanceId === instance.instanceId) + 1;
    if (pos >= 5) sp = Math.max(sp, 1);
  }
  return sp;
}

/** XG6-060 カンドロイド◎「このターン、宣言したカテゴリを選んだコマンドに追加する。」（持ち主のこのターンの記録） */
export const XG6_CANDROID_RULE_ID = "xg6_060_candroid_category";

export function xg6TurnCommandCategories<T extends string>(player: PlayerState, cardId: string): T[] {
  return getPlayerModifiers(player)
    .filter((m) => m.kind === "rule" && m.ruleId === XG6_CANDROID_RULE_ID && m.scope === "turn")
    .map((m) => (m as { payload?: { cardId?: string; category?: string } }).payload)
    .filter((p) => !!p && p.cardId === cardId && !!p.category)
    .map((p) => p!.category as T);
}

function commandHasDa(state: Pick<GameState, "players" | "definitions">, pid: PlayerId): boolean {
  const player = state.players[pid];
  return player.command.some((c) => [...xg6CommandCategories(c.cardId, printedCategories(state, c.cardId)), ...xg6TurnCommandCategories(player, c.cardId)].includes("DA"));
}

/**
 * アタックできないユニット（rules/legend3/restrictions.ts）。
 * - XG6-056【忍ばせた大鎌】「そうしたとき、このターン、これはアタックすることができない。」（このターンの記録）
 * - XG6-063「※これはDAを持つコマンドがないとき、アタックすることができない。」（両軍のコマンド）
 */
export function xg6AttackerBlocked(state: Pick<GameState, "players" | "definitions" | "xg6" | "turn">, playerId: PlayerId, attacker: CardInstance): boolean {
  if (hasXg6Mark(state, "XG6-056:no_attack", playerId, attacker.instanceId)) return true;
  if (isCardId(attacker.cardId, "XG6-063")) return !commandHasDa(state, "player1") && !commandHasDa(state, "player2");
  return false;
}

/** XG6-049 仮面ライダーオーガ「※これはウイングを持つユニットとバトルしたときバトルに勝っても撃破される。」（自軍ターンでも。カード評価） */
export function xg6WinButDestroyed(state: GameState, selfCard: CardInstance, opponentCard: CardInstance, opponentOwner: PlayerId): boolean {
  if (!isCardId(selfCard.cardId, "XG6-049")) return false;
  return cardHasKeyword(state.definitions, opponentCard.cardId, "wing", { state, playerId: opponentOwner });
}

/**
 * XG6-052 仮面ライダーコーカサス【ハイパークロックアップ】「自軍ターン中、これが自軍バトルエリアにある間、敵軍バトルエリアにあるSユニットの
 * 効果名を持たないテキストは無効になり、発動もできない。」— card（ownerId の場）の※が無効か。
 */
export function xg6NegatesUnnamedText(state: Pick<GameState, "players" | "definitions" | "activePlayer">, ownerId: PlayerId, card: CardInstance): boolean {
  const enemyId = enemyOf(ownerId);
  if (state.activePlayer !== enemyId) return false;
  if (!state.players[ownerId].battle.some((c) => c.instanceId === card.instanceId) || sizeOf(state, card) !== "S") return false;
  return state.players[enemyId].battle.some((c) => isCardId(c.cardId, "XG6-052"));
}
