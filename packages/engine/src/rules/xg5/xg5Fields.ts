/**
 * クロスギャザー XG5 の継続効果の判定（低い層から呼ぶ小さなモジュール。カードの効果そのものは rules/xg5/xg5aEffects.ts 等）。
 * core/catalog.ts を import しない（定義は state.definitions を直接見る）。
 *
 * - `xg5GrantsScrum`: XG5-001 ゴーグルレッド ※・XG5-041 ゴセイイエロー【兄妹の絆】（keywords/battleKeywords.ts scrumBlocksAttack）。
 * - `xg5CostNumber`: 必要パワーの数字（XG5-003 ゴーグルブルー【ブルージェットダッシュ】で敵軍ユニットは1少なくなる）。
 * - `isXg5StackedUnderUnitOperation`: XG5-012 ゴレムカード・XG5-015 スティライザー（ユニットの下に重ね、ユニットでなくなるとき捨札。rules/rk/rk1Features.ts）。
 * - `xg5BlocksOwnTurnHold`: XG5-025【上空からの牽制】（keywords/battleKeywords.ts のウイング）。
 * - `xg5ForcesAttack`: XG5-031【ガゼル脚】（core/legalActions.ts）。
 * - `xg5FieldBpBonus`: XG5-034 ※（rules/fieldAuras.ts）。
 * - `xg5EndTurnChoice`: XG5-032【ジェットボード】・XG5-050【語る背中】（rules/legend3/endTurnEffects.ts）。
 * - `xg5RequiresBattleEntry`: XG5-059【暴走する本能】（rules/restrictions.ts）。
 * - `xg5NotSelectable`: XG5-041【兄妹の絆】（keywords/effectTargetability.ts）。
 * - `xg5EffectiveSp`: XG5-051 ※・XG5-054【歩く完全ライダー図鑑】（rules/legend3/fieldEffects.ts）。
 */
import { isSameCardIdentity, normalizeSameCardName } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import type { Xg5Flag } from "./xg5Types";
import { hasTurnRuleModifier } from "../../core/scopedModifiers";

type Defs = Pick<GameState, "definitions">;

function opp(playerId: PlayerId): PlayerId {
  return playerId === "player1" ? "player2" : "player1";
}

export function xg5Flags(state: Pick<GameState, "xg5">, kind: string): Xg5Flag[] {
  return (state.xg5?.flags ?? []).filter((f) => f.kind === kind);
}

export function hasXg5Flag(state: Pick<GameState, "xg5" | "turn">, kind: string, playerId: PlayerId): boolean {
  return xg5Flags(state, kind).some((f) => f.playerId === playerId && f.turn === state.turn);
}

function fieldOf(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

/**
 * XG5-001 ゴーグルレッド ※「これが自軍エリアにある間、ナンバーに数字を持つ自軍ユニットは次の能力を得る⇒スクラム」（atwiki/page-2180）。
 * XG5-041 ゴセイイエロー【兄妹の絆】「これは次の相手ターン終了時まで、次の能力を得る⇒「BP+3000｣「スクラム」」（flags の xg5-041）。
 */
export function xg5GrantsScrum(state: Pick<GameState, "players" | "definitions" | "xg5" | "turn">, playerId: PlayerId, defender: CardInstance): boolean {
  if (typeof state.definitions[defender.cardId]?.comboNumber === "number" && fieldOf(state, playerId).some((c) => isSameCardIdentity(c.cardId, "XG5-001"))) {
    return true;
  }
  return xg5Flags(state, "xg5-041").some((f) => f.target === defender.instanceId && f.turn >= state.turn);
}

/** 必要パワーの数字（「+」「-」を除く）。 */
export function printedCostNumber(state: Defs, cardId: string): number {
  const raw = state.definitions[cardId]?.powerCost;
  if (typeof raw === "number") return raw;
  const m = String(raw ?? "").match(/\d+/);
  return m ? Number(m[0]) : Number.NaN;
}

/**
 * viewerId の効果が見る、ownerId のユニット card の必要パワーの数字。
 * XG5-003【ブルージェットダッシュ】「このターン、敵軍ユニットの必要パワーの数字は1少なくなる」（atwiki/page-2185。0より少なくならない＝Q1）。
 */
export function xg5CostNumber(state: Pick<GameState, "definitions" | "players">, viewerId: PlayerId, ownerId: PlayerId, cardId: string): number {
  const n = printedCostNumber(state, cardId);
  if (!Number.isFinite(n)) return n;
  // NC の効果そのものは rules/promotedNcEffects.ts（enemy_power_cost_minus のターンのルール）。
  const minus = ownerId === opp(viewerId) && hasTurnRuleModifier(state.players[viewerId], "enemy_power_cost_minus") ? 1 : 0;
  return Math.max(0, n - minus);
}

/** いまのターンのプレイヤー（処理の途中は、その処理のフェイズのプレイヤー）。 */
export function xg5TurnPlayer(state: Pick<GameState, "pendingStrike" | "pendingBattle" | "pendingRush" | "pendingLeave" | "pendingEffectChoice" | "activePlayer">): PlayerId {
  if (state.pendingStrike) return state.pendingStrike.battlePhasePlayer;
  if (state.pendingBattle) return state.pendingBattle.phasePlayerId;
  if (state.pendingRush) return state.pendingRush.phasePlayerId;
  if (state.pendingLeave) return state.pendingLeave.phasePlayerId;
  if (state.pendingEffectChoice) return state.pendingEffectChoice.phasePlayerId;
  return state.activePlayer;
}

/**
 * XG5-025 ボウケンブルーAT【上空からの牽制】「これが自軍エリアにある間、リリース状態の敵軍ユニットは次の制限を受ける⇒これは、自分自身のターン中、
 * ホールドすることができない。」（atwiki/page-2265）。playerId のユニットがいまホールドできないか（keywords/battleKeywords.ts のウイング）。
 */
export function xg5BlocksOwnTurnHold(state: GameState, playerId: PlayerId): boolean {
  if (xg5TurnPlayer(state) !== playerId) return false;
  return fieldOf(state, opp(playerId)).some((c) => isSameCardIdentity(c.cardId, "XG5-025"));
}

/** XG5-031 ゲキガゼル【ガゼル脚】「アタックかストライクを選ぶとき、可能なら敵軍ユニットにアタックする」を得たユニットか（core/legalActions.ts）。 */
export function xg5ForcesAttack(state: Pick<GameState, "xg5" | "turn" | "players">, playerId: PlayerId, instanceId: string): boolean {
  if (xg5Flags(state, "xg5-031").some((f) => f.playerId === playerId && f.turn === state.turn && f.target === instanceId)) return true;
  // XG5-059 仮面ライダーカリス【暴走する本能】（手札が1枚以下のとき）。
  const card = fieldOf(state, playerId).find((c) => c.instanceId === instanceId);
  return !!card && isSameCardIdentity(card.cardId, "XG5-059") && state.players[playerId].hand.length <= 1;
}

/**
 * XG5-059 仮面ライダーカリス【暴走する本能】「これは、自分の手札が1枚以下のとき、BP+3000され、次の能力を得る⇒これは毎ターン可能ならバトルエリアに出る。
 * また、これはアタックかストライクを選ぶとき、可能なら敵軍ユニットにアタックする。」（atwiki/page-2172）。rules/restrictions.ts findMandatoryBattleEntries。
 */
export function xg5RequiresBattleEntry(state: Pick<GameState, "players">, playerId: PlayerId, card: CardInstance): boolean {
  return isSameCardIdentity(card.cardId, "XG5-059") && state.players[playerId].hand.length <= 1;
}

/**
 * 相手の効果に選ばれないか（keywords/effectTargetability.ts isSelectableByOpponentEffect）。
 * XG5-041 ゴセイイエロー【兄妹の絆】「（自分の手札が1枚以下なら、追加で次の能力を得る⇒これはアタックされる以外では相手に選ばれない）」（atwiki/page-2232）。
 * 手札の枚数は NC の効果を処理したときに見る（flags の xg5-041 の n）。
 */
export function xg5NotSelectable(state: Pick<GameState, "xg5" | "turn">, ownerId: PlayerId, instanceId: string): boolean {
  return xg5Flags(state, "xg5-041").some((f) => f.playerId === ownerId && f.target === instanceId && f.n === 1 && f.turn >= state.turn);
}

function nameOf(state: Defs, cardId: string): string {
  return state.definitions[cardId]?.name ?? "";
}

/**
 * SP（rules/legend3/fieldEffects.ts legend3EffectiveSp）。
 * - XG5-051 仮面ライダーカブトHF ※「これは、カード名に「カブト」「ザビー」「ドレイク」「サソード」を含むオモテ向きの自軍パワーがそれぞれあれば、SP1になる。」（atwiki/page-2258）。
 * - XG5-054 仮面ライダーディケイドCF【歩く完全ライダー図鑑】「これは、自軍パワーゾーンのオモテ向きのカードに、特徴「仮面ライダー」を持つ同名のカードが3枚以上
 *   あれば、「SP1」になる。」（atwiki/page-2244）。
 */
export function xg5EffectiveSp(state: Pick<GameState, "players" | "definitions">, playerId: PlayerId, instance: CardInstance, sp: number): number {
  const faceUp = state.players[playerId].power.filter((c) => !c.faceDown);
  if (isSameCardIdentity(instance.cardId, "XG5-051")) {
    const names = faceUp.map((c) => nameOf(state, c.cardId));
    if (["カブト", "ザビー", "ドレイク", "サソード"].every((k) => names.some((n) => n.includes(k)))) return Math.max(sp, 1);
  }
  if (isSameCardIdentity(instance.cardId, "XG5-054")) {
    const counts = new Map<string, number>();
    for (const c of faceUp) {
      if (!(state.definitions[c.cardId]?.features ?? []).includes("仮面ライダー")) continue;
      const key = normalizeSameCardName(nameOf(state, c.cardId));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if ([...counts.values()].some((n) => n >= 3)) return Math.max(sp, 1);
  }
  return sp;
}

/**
 * 場のユニットの BP の増減（rules/fieldAuras.ts passiveNamedFieldBpBonus）。
 * XG5-034 シンケンレッド ※「これは自軍ターン中、これ以外の特徴「侍」を持つSユニット1体につきBP+2000される。」（atwiki/page-2263）。数えるのは自軍の場の S ユニット。
 */
export function xg5FieldBpBonus(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  return xg5SamuraiBp(state, playerId, instance) + xg5FlagBp(state, playerId, instance);
}

/**
 * 期間つきの BP の増減と、手札の枚数による BP。
 * - XG5-041【兄妹の絆】BP+3000（次の相手ターン終了時まで）・XG5-049【アポロマグナム】BP+4000（次の相手ターン終了時まで）。
 * - XG5-050【語る背中】BP+3000（そのターン中。ラッシュフェイズを終えるたびに得る＝atwiki/page-2254 Q1）。
 * - XG5-059【暴走する本能】自分の手札が1枚以下のとき BP+3000。
 */
function xg5FlagBp(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  let bonus = 0;
  for (const f of state.xg5?.flags ?? []) {
    if (f.playerId !== playerId || f.target !== instance.instanceId) continue;
    if (f.kind === "xg5-041" && f.turn >= state.turn) bonus += 3000;
    if (f.kind === "xg5-049" && f.turn >= state.turn) bonus += 4000;
    if (f.kind === "xg5-050" && f.turn === state.turn) bonus += 3000;
  }
  if (isSameCardIdentity(instance.cardId, "XG5-059") && state.players[playerId].hand.length <= 1) bonus += 3000;
  return bonus;
}

function xg5SamuraiBp(state: GameState, playerId: PlayerId, instance: CardInstance): number {
  if (!isSameCardIdentity(instance.cardId, "XG5-034") || xg5TurnPlayer(state) !== playerId) return 0;
  const n = fieldOf(state, playerId).filter((c) => {
    if (c.instanceId === instance.instanceId) return false;
    const d = state.definitions[c.cardId];
    return d?.type === "unit" && d.size === "S" && (d.features ?? []).includes("侍");
  }).length;
  return 2000 * n;
}

/**
 * XG5-032 ゲキペンギン【ジェットボード】「自分がターンを終えるとき、このユニットがバトルエリアにあれば、自軍ラッシュエリアに戻してもよい。」（atwiki/page-2200）。
 * エンドフェイズの選択（rules/legend3/endTurnEffects.ts tryOpenEndTurnEffectsMenu）。まだ尋ねていないこれがあれば、尋ねた印を付けた state と確認の選択を返す。
 */
export const XG5_JET_BOARD = "xg5_032_jet_board";
export function xg5EndTurnChoice(state: GameState, playerId: PlayerId): { state: GameState; choice: PendingEffectChoice } | null {
  const asked = new Set(xg5Flags(state, "xg5-032").filter((f) => f.turn === state.turn).map((f) => f.target));
  const card = state.players[playerId].battle.find((c) => isSameCardIdentity(c.cardId, "XG5-032") && !asked.has(c.instanceId));
  if (!card) return xg5KataruEndTurnChoice(state, playerId);
  const flag: Xg5Flag = { kind: "xg5-032", playerId, turn: state.turn, target: card.instanceId };
  return {
    state: { ...state, xg5: { ...state.xg5, flags: [...(state.xg5?.flags ?? []), flag] } },
    choice: {
      playerId,
      phasePlayerId: playerId,
      effectId: XG5_JET_BOARD,
      sourceCardId: card.cardId,
      sourceInstanceId: card.instanceId,
      kind: "confirm",
      validInstanceIds: [],
      selectedInstanceIds: [],
      optional: true,
      mayConfirm: true,
    },
  };
}

/**
 * XG5-050 仮面ライダー装甲響鬼【語る背中】「⇒BP+3000され、このターンを終えるときホールド状態なら、リリースしてもよい。」（atwiki/page-2254）。
 * そのターンに能力を得た（flags の xg5-050）ホールド状態のこれごとに1度だけ、持ち主にリリースするかを確認する（相手のターンに得たものも）。
 */
export const XG5_KATARU = "xg5_050_kataru_senaka";
function xg5KataruEndTurnChoice(state: GameState, turnPlayerId: PlayerId): { state: GameState; choice: PendingEffectChoice } | null {
  const asked = new Set(xg5Flags(state, "xg5-050-asked").filter((f) => f.turn === state.turn).map((f) => f.target));
  for (const flag of xg5Flags(state, "xg5-050")) {
    if (flag.turn !== state.turn || !flag.target || asked.has(flag.target)) continue;
    const card = fieldOf(state, flag.playerId).find((c) => c.instanceId === flag.target);
    if (!card?.commandHeld) continue;
    const mark: Xg5Flag = { kind: "xg5-050-asked", playerId: flag.playerId, turn: state.turn, target: card.instanceId };
    return {
      state: { ...state, xg5: { ...state.xg5, flags: [...(state.xg5?.flags ?? []), mark] } },
      choice: {
        playerId: flag.playerId,
        phasePlayerId: turnPlayerId,
        effectId: XG5_KATARU,
        sourceCardId: card.cardId,
        sourceInstanceId: card.instanceId,
        kind: "confirm",
        validInstanceIds: [],
        selectedInstanceIds: [],
        optional: true,
        mayConfirm: true,
      },
    };
  }
  return null;
}

/** XG5-012 ゴレムカード・XG5-015 スティライザー（ユニットの下に重ね、重ねたユニットがユニットでなくなるとき捨札になる）。 */
export function isXg5StackedUnderUnitOperation(cardId: string): boolean {
  return isSameCardIdentity(cardId, "XG5-012") || isSameCardIdentity(cardId, "XG5-015");
}
