/**
 * RS 以外のライン（XG1〜7・XP・RM・SK …）のカード固有の名前付き効果と継続効果。
 * 対戦カタログ（full-playable）に入った実カードで RS の Q&A を再現したときに見つかった未接続の効果をここで扱う。
 *
 * - `tryOtherLinesCardEffect`: DSL の grant_keyword から呼ばれる起点（`other::cardId::name`）。
 * - `tryResolveOtherLinesChoice` / `trySkipOtherLinesChoice`: このモジュールが開いた選択の解決。
 * 構成は rules/legend1/set9NamedEffectsD.ts と同じ。
 */
import type { CardInstance, DeferredDestroyTrigger, GameState, PendingEffectChoice, PlayerId } from "../../types/game";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import { buildLogEntry } from "../../log/formatLog";
import { promoteDeferredBattleEntry } from "../battleEntry";
import { applyConfirmEffectChoice, applyUnitLeave, openEffectChoice } from "../pendingChoices";
import { isSmallUnitNow } from "./set6NamedEffectsB";
import { patchPlayer } from "../playerPatches";
import { namedTextNegated } from "./set6NamedEffects348";
import { cardCategories, cardName, effectiveBp, getDefinition } from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import { countJointLGrant } from "../jointComboGrants";
import { battleActBlocked } from "../keywordGapRuntime";
import { gomaPalaceForcesAttack } from "../juuKunDo";
import { addTurnRuleModifier, getPlayerModifiers } from "../../core/scopedModifiers";
import { recordSUnitRecoveredFromDiscardToHand } from "../turnRecoveryTracking";
import { startEffectRush } from "../effectRush";

// ---------------------------------------------------------------------------
// 共通（選択の解決）

type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;

const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};

export function isOtherLinesChoiceEffect(effectId: string): boolean {
  return effectId in CHOICE_RESOLVERS;
}

/** このモジュールが開いた選択なら解決する。対象外なら null。 */
export function tryResolveOtherLinesChoice(state: GameState, playerId: PlayerId, instanceId: string): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const resolver = CHOICE_RESOLVERS[pending.effectId];
  if (!resolver) return null;
  if (!pending.validInstanceIds.includes(instanceId)) return { error: "invalid_target" };
  return resolver(state, playerId, instanceId);
}

/** 任意の選択をしない（skip_effect_choice）。対象外なら null。 */
export function trySkipOtherLinesChoice(state: GameState, playerId: PlayerId): ChoiceOutcome | null {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.playerId !== playerId) return null;
  const skipper = CHOICE_SKIPPERS[pending.effectId];
  if (!skipper) return null;
  if (!pending.optional) return { error: "not_optional" };
  return skipper(state, playerId);
}

function logFor(state: GameState, playerId: PlayerId, cardId: string, detail: string): string {
  return buildLogEntry(playerId, "resolve_effect_choice", cardId, state.definitions, detail);
}

function skipLog(state: GameState, playerId: PlayerId, cardId: string, effectId: string): string {
  return buildLogEntry(playerId, "skip_effect_choice", cardId, state.definitions, `${effectId}:skipped`);
}

function appendResume(choice: PendingEffectChoice, next: PendingEffectChoice): PendingEffectChoice {
  return { ...choice, resumeChoice: choice.resumeChoice ? appendResume(choice.resumeChoice, next) : next };
}

/** 選択を閉じた state（resumeChoice はまだ開かない）。 */
function close(state: GameState, pending: PendingEffectChoice): GameState {
  return state.pendingEffectChoice === pending
    ? { ...state, pendingEffectChoice: undefined, activePlayer: pending.phasePlayerId }
    : state;
}

/** 効果の処理を終える（割り込みがなければ resumeChoice を開くかバトル進入を続ける）。 */
function proceed(state: GameState, pending: PendingEffectChoice): GameState {
  if (state.pendingEffectChoice) {
    return pending.resumeChoice ? { ...state, pendingEffectChoice: appendResume(state.pendingEffectChoice, pending.resumeChoice) } : state;
  }
  if (state.pendingLeave || state.pendingRegister || state.pendingDamagePayment) {
    if (!pending.resumeChoice) return state;
    const frame: DeferredDestroyTrigger = { kind: "open_choice", step: "after_discard", pending: pending.resumeChoice };
    return { ...state, deferredDestroyTriggers: [...(state.deferredDestroyTriggers ?? []), frame] };
  }
  if (pending.resumeChoice) return openEffectChoice(state, pending.resumeChoice);
  return promoteDeferredBattleEntry(state);
}

/** 選択を開く。既に別の選択が開いていればその後に開く。 */
function openOrQueue(state: GameState, choice: PendingEffectChoice): GameState {
  if (state.pendingEffectChoice) return { ...state, pendingEffectChoice: appendResume(state.pendingEffectChoice, choice) };
  return openEffectChoice(state, choice);
}

function fieldUnits(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

function findField(state: GameState, playerId: PlayerId, instanceId: string): { zone: "battle" | "rush"; card: CardInstance } | undefined {
  for (const zone of ["battle", "rush"] as const) {
    const card = state.players[playerId][zone].find((c) => c.instanceId === instanceId);
    if (card) return { zone, card };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// XG3-036 ダイカイオーヒガシ【海老ばさみ本手返し】
// 「これをラッシュしたとき、そのターン中、これは、BP+3000される。」（atwiki/page-1873）
// ターン中の BP 修正（CardInstance.bpModifier。ターン終了時にクリア）。

export const EBI_BASAMI_EFFECT_ID = "xg3036_ebi_basami";

function applyEbiBasami(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const selfId = ctx.triggerSourceInstanceId;
  const found = selfId ? findField(state, ctx.playerId, selfId) : undefined;
  if (!found) return { state, detail: `${EBI_BASAMI_EFFECT_ID}:not_in_field` };
  const next = patchPlayer(state, ctx.playerId, (p) => ({
    ...p,
    [found.zone]: p[found.zone].map((c) => (c.instanceId === selfId ? { ...c, bpModifier: (c.bpModifier ?? 0) + 3000 } : c)),
  }));
  return { state: next, detail: EBI_BASAMI_EFFECT_ID };
}

// ---------------------------------------------------------------------------
// XG1-034 害気大臣キタネイダス【汚い大気】
// 「これが自軍エリアにある間、自分も相手も次の制限を受ける⇒バトルフェイズ中、パワーゾーンからカードが離れる処理を含む効果は
//  すべて無効になる。」（atwiki/page-1582）
// 他の選択肢を含む効果も（パワーゾーンのカードが動く可能性があれば）無効（Q6 Vレックスロボ・カード評価）。
// 適用箇所: RS-265【ラウンドレーダー】と※（Q3/Q4）、RS-235 ※（Q5）、RS-301【リボルバーミサイル】（Q6）、モーフ（Q2）、
// XG2-042 ※「その場に留まる」（Q1）、DSL の誘発効果でパワーゾーンのカードを選ぶもの。

export const FILTHY_AIR_CARD_ID = "XG1-034";

/** 【汚い大気】がいま有効か（バトルフェイズ中で、どちらかの自軍エリアにキタネイダスがあり、効果名のテキストが無効でない）。 */
export function filthyAirActive(state: Pick<GameState, "phase" | "players" | "definitions">): boolean {
  if (state.phase !== "battle") return false;
  for (const pid of ["player1", "player2"] as const) {
    for (const card of fieldUnits(state, pid)) {
      if (card.cardId !== FILTHY_AIR_CARD_ID) continue;
      if (!namedTextNegated(state, pid, card)) return true;
    }
  }
  return false;
}

/** DSL の効果がパワーゾーンのカードを選ぶ（＝パワーゾーンからカードが離れる処理を含む）か。 */
export function dslEffectSelectsPowerCards(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some(dslEffectSelectsPowerCards);
  const rec = node as Record<string, unknown>;
  if (rec.type === "zone" && rec.zone === "power") return true;
  return Object.values(rec).some(dslEffectSelectsPowerCards);
}

// ---------------------------------------------------------------------------
// XG3-034 恐竜折神【キョウリュウマル】（ジョイントコンビネーション L）
// 「このユニットからコンビネーションする特徴「侍」を持つユニットは、次の能力を得る⇒アタックするかわりに、敵軍バトルエリアの
//  ユニットを、BPの合計がこのユニットのBP以下になるように好きな数選び、撃破してもよい。」（atwiki/page-1907）
// 得た能力は rules/jointComboGrants.ts（kind "l"・effectId "kyouryuumaru"）。「アタックするかわりに」は use_juu_kun_do
// （R-ATK-05・R-REPL-03）で発動する。ルナジェル（RS-579）の制限下でも発動できる（page-1907 Q2・page-1194 Q1）。
// 「このユニットのBP」は能力を得た「侍」ユニットのいまの BP（修正後）。

export const KYOURYUUMARU_GRANT_ID = "kyouryuumaru";
export const KYOURYUUMARU_EFFECT_ID = "xg3034_kyouryuumaru";

export const KYOURYUUMARU_PICK_EFFECT_ID = "xg3034_kyouryuumaru_pick";

function fieldBp(state: GameState, instanceId: string): number {
  for (const pid of ["player1", "player2"] as const) {
    const card = state.players[pid].battle.find((c) => c.instanceId === instanceId);
    if (card) return effectiveBp(state, pid, card);
  }
  return Number.MAX_SAFE_INTEGER;
}

/** まだ選べる敵軍バトルエリアのユニット（選んだユニットとの BP の合計が budget 以下になるもの）。 */
function kyouryuumaruTargets(state: GameState, playerId: PlayerId, selected: string[], budget: number): string[] {
  const used = selected.reduce((sum, id) => sum + fieldBp(state, id), 0);
  return state.players[opponent(playerId)].battle
    .filter((c) => !selected.includes(c.instanceId))
    .filter((c) => isSelectableByOpponentEffect(state, playerId, c.instanceId, "XG3-034", playerId))
    .filter((c) => used + fieldBp(state, c.instanceId) <= budget)
    .map((c) => c.instanceId);
}

/** 選び終えた: 選んだユニットを撃破する（汎用の BP 合計選択の確定処理で、1体ずつ撃破と誘発を解決する）。 */
function finishKyouryuumaru(state: GameState, playerId: PlayerId, pending: PendingEffectChoice): ChoiceOutcome {
  const selected = pending.selectedInstanceIds ?? [];
  if (selected.length === 0) {
    return { state: proceed(close(state, pending), pending), log: skipLog(state, playerId, pending.sourceCardId, KYOURYUUMARU_EFFECT_ID) };
  }
  const confirming: PendingEffectChoice = {
    ...pending,
    effectId: KYOURYUUMARU_EFFECT_ID,
    kind: "select_units_bp_budget",
    validInstanceIds: selected,
  };
  return applyConfirmEffectChoice({ ...state, pendingEffectChoice: confirming }, playerId);
}

CHOICE_RESOLVERS[KYOURYUUMARU_PICK_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selected = [...(pending.selectedInstanceIds ?? []), instanceId];
  const remaining = kyouryuumaruTargets(state, playerId, selected, pending.bpBudget ?? 0);
  const updated: PendingEffectChoice = { ...pending, selectedInstanceIds: selected, validInstanceIds: remaining };
  if (remaining.length === 0) return finishKyouryuumaru(state, playerId, updated);
  return { state: { ...state, pendingEffectChoice: updated } };
};
// 「好きな数選び」— 選ぶのをやめる（それまでに選んだユニットを撃破する。1体も選んでいなければ何もしない）。
CHOICE_SKIPPERS[KYOURYUUMARU_PICK_EFFECT_ID] = (state, playerId) => finishKyouryuumaru(state, playerId, state.pendingEffectChoice!);

/** 【キョウリュウマル】で得た能力を「アタックするかわりに」いま発動できるか。 */
export function canUseKyouryuumaru(state: GameState, playerId: PlayerId, unitInstanceId: string): boolean {
  if (state.phase !== "battle" || state.activePlayer !== playerId) return false;
  if (state.pendingEffectChoice) return false;
  const player = state.players[playerId];
  const unit = player.battle.find((c) => c.instanceId === unitInstanceId);
  if (!unit || countJointLGrant(unit, KYOURYUUMARU_GRANT_ID) === 0) return false;
  if (!(unit.jointComboGrants ?? []).some((g) => g.kind === "l" && g.effectId === KYOURYUUMARU_GRANT_ID && g.sourceCardId === "XG3-034")) {
    return false;
  }
  // アタックする権利を失っていれば「かわりに」発動できない（R-REPL-03）。
  if (unit.battleActed || battleActBlocked(player, unit, "attack")) return false;
  // ゴーマ宮でアタックを強制されていれば使えない（R-ATK-05）。
  return !gomaPalaceForcesAttack(state, playerId, unitInstanceId);
}

/** 発動: アタックする権利を失い、BP の合計がこのユニットの BP 以下になるよう敵軍バトルエリアのユニットを選ぶ（任意）。 */
export function applyKyouryuumaru(state: GameState, playerId: PlayerId, unitInstanceId: string): GameState | null {
  if (!canUseKyouryuumaru(state, playerId, unitInstanceId)) return null;
  const unit = state.players[playerId].battle.find((c) => c.instanceId === unitInstanceId)!;
  const budget = effectiveBp(state, playerId, unit);
  const acted = patchPlayer(state, playerId, (p) => ({
    ...p,
    battle: p.battle.map((c) => (c.instanceId === unitInstanceId ? { ...c, battleActed: true } : c)),
  }));
  const targets = kyouryuumaruTargets(acted, playerId, [], budget);
  if (targets.length === 0) return acted;
  // 1体ずつ選ぶ（選べるユニットがなくなるか、選ぶのをやめたら撃破する）。
  return openEffectChoice(acted, {
    playerId,
    effectId: KYOURYUUMARU_PICK_EFFECT_ID,
    sourceCardId: "XG3-034",
    sourceInstanceId: unitInstanceId,
    phasePlayerId: playerId,
    kind: "select_unit",
    validInstanceIds: targets,
    bpBudget: budget,
    selectedInstanceIds: [],
    optional: true,
  });
}

// ---------------------------------------------------------------------------
// XP-026 仮面ライダーアクセル【アクセルグランツァー】
// 「これが自軍バトルエリアからラッシュエリアに戻るとき、自軍コマンドを1つ選び手札に戻してもよい。そうしたとき、戻したコマンドと
//  同じカテゴリを持たない、敵軍Sユニットまたはライドされていない敵軍Sビークルがあれば1体選び捨札にする。」（atwiki/page-2257）
// RS-118 ゴーゴーダンプの置きかえでラッシュエリアに移ったときも「戻った」として発動できる（atwiki/page-292 Q1）。
// 呼び出し元: スタートフェイズの「戻す」（rules/startPhase.ts）、RS-118 の置きかえ（rules/pendingChoices.ts swap_battle）。

export const ACCEL_GRANZER_EFFECT_ID = "xp026_accel_granzer";
export const ACCEL_GRANZER_DISCARD_EFFECT_ID = "xp026_accel_granzer_discard";

export function isOtherLinesBattleToRushTrigger(card: CardInstance): boolean {
  return card.cardId === "XP-026";
}

/** 自軍バトルエリアからラッシュエリアに戻ったユニットの誘発（戻った後に呼ぶ）。 */
export function tryOtherLinesBattleToRush(state: GameState, playerId: PlayerId, card: CardInstance, phasePlayerId: PlayerId): GameState {
  if (!isOtherLinesBattleToRushTrigger(card)) return state;
  const self = state.players[playerId].rush.find((c) => c.instanceId === card.instanceId);
  if (!self || namedTextNegated(state, playerId, self)) return state;
  const commands = state.players[playerId].command.map((c) => c.instanceId);
  if (commands.length === 0) return state;
  return openOrQueue(state, {
    playerId,
    effectId: ACCEL_GRANZER_EFFECT_ID,
    sourceCardId: card.cardId,
    sourceInstanceId: card.instanceId,
    phasePlayerId,
    kind: "select_commands",
    validInstanceIds: commands,
    selectedInstanceIds: [],
    selectCount: 1,
    optional: true,
  });
}

function accelGranzerTargets(state: GameState, playerId: PlayerId, categories: string[]): string[] {
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  const ridden = new Set(enemy.battle.map((c) => c.mountedOnInstanceId).filter((id): id is string => !!id));
  return [...enemy.battle, ...enemy.rush]
    .filter((c) => {
      const def = getDefinition(state.definitions, c.cardId);
      if (!def) return false;
      if (cardCategories(def).some((cat) => categories.includes(cat))) return false;
      if (def.type === "unit") return isSmallUnitNow(state, enemyId, c);
      return def.type === "vehicle" && def.size === "S" && !ridden.has(c.instanceId);
    })
    .filter((c) => isSelectableByOpponentEffect(state, playerId, c.instanceId, "XP-026", playerId))
    .map((c) => c.instanceId);
}

CHOICE_RESOLVERS[ACCEL_GRANZER_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const command = state.players[playerId].command.find((c) => c.instanceId === instanceId);
  if (!command) return { error: "invalid_target" };
  const categories = cardCategories(getDefinition(state.definitions, command.cardId));
  let next = close(state, pending);
  next = patchPlayer(next, playerId, (p) => ({
    ...p,
    command: p.command.filter((c) => c.instanceId !== instanceId),
    hand: [...p.hand, { instanceId: command.instanceId, cardId: command.cardId }],
  }));
  const log = logFor(state, playerId, pending.sourceCardId, `${ACCEL_GRANZER_EFFECT_ID}:${cardName(state.definitions, command.cardId)}`);
  // 「そうしたとき…あれば1体選び捨札にする」（強制）。
  const targets = accelGranzerTargets(next, playerId, categories);
  if (targets.length === 0) return { state: proceed(next, pending), log };
  return {
    state: openEffectChoice(next, {
      ...pending,
      effectId: ACCEL_GRANZER_DISCARD_EFFECT_ID,
      kind: "select_unit",
      validInstanceIds: targets,
      selectedInstanceIds: [],
      selectCount: 1,
      optional: false,
    }),
    log,
  };
};
CHOICE_SKIPPERS[ACCEL_GRANZER_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: proceed(close(state, pending), pending), log: skipLog(state, playerId, pending.sourceCardId, pending.effectId) };
};
CHOICE_RESOLVERS[ACCEL_GRANZER_DISCARD_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const closed = close(state, pending);
  const left = applyUnitLeave(closed, instanceId, "discard", pending.phasePlayerId);
  if ("error" in left) return left;
  const name = cardName(state.definitions, findField(state, opponent(playerId), instanceId)?.card.cardId ?? "");
  return { state: proceed(left.state, pending), log: logFor(state, playerId, pending.sourceCardId, `${ACCEL_GRANZER_DISCARD_EFFECT_ID}:${name}`) };
};

// XP-026 の※「これは、自分がターンを終えるときバトルエリアにあれば、特徴「加速」を持つ自軍コマンドをホールドしてラッシュエリアに
// 戻してよい。」— ホールドするコマンドを選ぶ（選ばなければ戻さない）。戻したら【アクセルグランツァー】が誘発する。

export const ACCEL_RETURN_EFFECT_ID = "xp026_accel_return";

function accelCommands(state: GameState, playerId: PlayerId): string[] {
  return state.players[playerId].command
    .filter((c) => !c.commandHeld && (getDefinition(state.definitions, c.cardId)?.features ?? []).includes("加速"))
    .map((c) => c.instanceId);
}

export function collectOtherLinesTurnEndQueue(state: GameState, endingPlayerId: PlayerId): string[] {
  return state.players[endingPlayerId].battle.filter((c) => c.cardId === "XP-026").map((c) => c.instanceId);
}

export function openOtherLinesTurnEndEntry(state: GameState, endingPlayerId: PlayerId, entry: string): GameState {
  if (!state.players[endingPlayerId].battle.some((c) => c.instanceId === entry)) return state;
  const ids = accelCommands(state, endingPlayerId);
  if (ids.length === 0) return state;
  return openEffectChoice(state, {
    playerId: endingPlayerId,
    phasePlayerId: endingPlayerId,
    sourceCardId: "XP-026",
    sourceInstanceId: entry,
    effectId: ACCEL_RETURN_EFFECT_ID,
    kind: "select_commands",
    validInstanceIds: ids,
    selectedInstanceIds: [],
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[ACCEL_RETURN_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const selfId = pending.sourceInstanceId;
  const self = state.players[playerId].battle.find((c) => c.instanceId === selfId);
  if (!self || !accelCommands(state, playerId).includes(instanceId)) return { error: "invalid_target" };
  // 乗っているビークルがあれば一緒に戻す（ライドした組はまとめて動く）。
  const groupIds = new Set([self.instanceId, ...(self.mountedOnInstanceId ? [self.mountedOnInstanceId] : [])]);
  const next = patchPlayer(close(state, pending), playerId, (p) => ({
    ...p,
    command: p.command.map((c) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c)),
    battle: p.battle.filter((c) => !groupIds.has(c.instanceId)),
    rush: [...p.rush, ...p.battle.filter((c) => groupIds.has(c.instanceId))],
  }));
  const log = logFor(state, playerId, "XP-026", `${ACCEL_RETURN_EFFECT_ID}:${cardName(state.definitions, state.players[playerId].command.find((c) => c.instanceId === instanceId)!.cardId)}`);
  return { state: tryOtherLinesBattleToRush(next, playerId, self, pending.phasePlayerId), log };
};
CHOICE_SKIPPERS[ACCEL_RETURN_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: close(state, pending), log: skipLog(state, playerId, "XP-026", ACCEL_RETURN_EFFECT_ID) };
};

// ---------------------------------------------------------------------------
// XG2-041 スーパーシンケンイエロー【真・土煙の舞い】（NC。CN：1）
// 「このターン、次に自軍Sユニットが撃破されて捨札になったとき、そのカードを手札に戻してもよい。そうしたとき、手札に戻したカードと
//  同名のカードを自分の手札から1枚選び、自軍ラッシュエリアに出してもよい。ただし、必要パワーと追加条件は満たすこと。」（atwiki/page-1758）
// 「次に」— 1回だけ（戻さなかった場合もそこで使い終わる。RS-678 シンケンイエローと同じ。page-1758 カード評価）。
// 手札に戻したカードは「自軍捨札から手札に加えた」として RS-382【人の命は地球の未来】に数える（page-541 Q1）。
// 段階 4「撃破されて捨札になったとき」（rules/leaveEffects.ts resolveAfterDiscardDestroyEffects から呼ぶ）。

const SHIN_TSUCHIKEMURI_RULE = "xg2041_shin_tsuchikemuri";
export const SHIN_TSUCHIKEMURI_EFFECT_ID = "xg2041_shin_tsuchikemuri";
export const SHIN_TSUCHIKEMURI_RUSH_EFFECT_ID = "xg2041_shin_tsuchikemuri_rush";

function applyShinTsuchikemuri(state: GameState, ctx: GrantKeywordContext): GrantKeywordResult {
  const next = patchPlayer(state, ctx.playerId, (p) =>
    addTurnRuleModifier(p, SHIN_TSUCHIKEMURI_RULE, { sourceCardId: "XG2-041", payload: { sourceInstanceId: ctx.triggerSourceInstanceId } }),
  );
  return { state: next, detail: SHIN_TSUCHIKEMURI_EFFECT_ID };
}

export function applyOtherLinesAfterDiscard(
  state: GameState,
  ctx: { ownerPlayerId: PlayerId; instanceId: string; cardId: string; phasePlayerId: PlayerId; destroyed?: boolean },
): GameState {
  if (ctx.destroyed === false) return state;
  const owner = state.players[ctx.ownerPlayerId];
  const isRule = (m: ReturnType<typeof getPlayerModifiers>[number]) =>
    m.kind === "rule" && m.ruleId === SHIN_TSUCHIKEMURI_RULE && m.scope === "turn";
  if (!getPlayerModifiers(owner).some(isRule)) return state;
  if (!owner.discard.some((c) => c.instanceId === ctx.instanceId)) return state;
  const def = getDefinition(state.definitions, ctx.cardId);
  if (def?.type !== "unit" || def.size !== "S") return state;
  const consumed = patchPlayer(state, ctx.ownerPlayerId, (p) => ({
    ...p,
    modifiers: getPlayerModifiers(p).filter((m) => !isRule(m)),
  }));
  return openOrQueue(consumed, {
    playerId: ctx.ownerPlayerId,
    phasePlayerId: ctx.phasePlayerId,
    sourceCardId: "XG2-041",
    effectId: SHIN_TSUCHIKEMURI_EFFECT_ID,
    kind: "select_unit",
    validInstanceIds: [ctx.instanceId],
    selectedInstanceIds: [],
    selectCount: 1,
    optional: true,
  });
}

CHOICE_RESOLVERS[SHIN_TSUCHIKEMURI_EFFECT_ID] = (state, playerId, instanceId) => {
  const pending = state.pendingEffectChoice!;
  const card = state.players[playerId].discard.find((c) => c.instanceId === instanceId);
  const cleared = close(state, pending);
  const log = logFor(state, playerId, "XG2-041", `${SHIN_TSUCHIKEMURI_EFFECT_ID}:${card ? cardName(state.definitions, card.cardId) : instanceId}`);
  if (!card) return { state: proceed(cleared, pending), log };
  let next = patchPlayer(cleared, playerId, (p) => ({
    ...p,
    discard: p.discard.filter((c) => c.instanceId !== instanceId),
    hand: [...p.hand, { instanceId: card.instanceId, cardId: card.cardId }],
  }));
  next = recordSUnitRecoveredFromDiscardToHand(next, playerId, card.cardId);
  // 「そうしたとき、同名のカードを手札から1枚選び、ラッシュエリアに出してもよい（必要パワーと追加条件は満たす）」。
  const name = cardName(state.definitions, card.cardId);
  const candidates = next.players[playerId].hand
    .filter((c) => cardName(next.definitions, c.cardId) === name)
    .map((c) => c.instanceId);
  const rushed = startEffectRush(next, {
    playerId,
    phasePlayerId: pending.phasePlayerId,
    effectId: SHIN_TSUCHIKEMURI_RUSH_EFFECT_ID,
    sourceCardId: "XG2-041",
    fromZone: "hand",
    candidates,
    maxCount: 1,
    requireConditions: true,
    alwaysAsk: true,
  });
  return { state: proceed(rushed, pending), log };
};
CHOICE_SKIPPERS[SHIN_TSUCHIKEMURI_EFFECT_ID] = (state, playerId) => {
  const pending = state.pendingEffectChoice!;
  return { state: proceed(close(state, pending), pending), log: skipLog(state, playerId, "XG2-041", pending.effectId) };
};

// ---------------------------------------------------------------------------
// DSL grant_keyword からの起点

export const OTHER_LINES_KEYWORD_PREFIX = "other::";

const OTHER_LINES_KEYWORDS: Record<string, (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult> = {
  "XG3-036::ebi_basami": applyEbiBasami,
  // 継続効果（filthyAirActive を各効果の側で参照する。ここでは何もしない）。
  // 誘発（バトルエリアからラッシュエリアに戻ったとき）は tryOtherLinesBattleToRush で扱う（ここでは何もしない）。
  "XP-026::accel_granzer": (state) => ({ state, detail: ACCEL_GRANZER_EFFECT_ID }),
  // ※（自分がターンを終えるとき）は rules/turnEndingEffects.ts から openOtherLinesTurnEndEntry で扱う。
  "XP-026::accel_return": (state) => ({ state, detail: ACCEL_RETURN_EFFECT_ID }),
  "XG2-041::shin_tsuchikemuri": applyShinTsuchikemuri,
  "XG1-034::filthy_air": (state) => ({ state, detail: "xg1034_filthy_air" }),
};

export function tryOtherLinesCardEffect(state: GameState, ctx: GrantKeywordContext, keyword: string): GrantKeywordResult | null {
  if (!keyword.startsWith(OTHER_LINES_KEYWORD_PREFIX)) return null;
  const handler = OTHER_LINES_KEYWORDS[keyword.slice(OTHER_LINES_KEYWORD_PREFIX.length)];
  return handler ? handler(state, ctx) : { state, detail: keyword };
}

// ---------------------------------------------------------------------------
// CPU（ai/helpers.ts pickEffectChoice から呼ぶ）

type Action = import("../../types/actions").GameAction;

/** このモジュールが開いた選択の CPU の手。対象外なら null。 */
export function pickOtherLinesCpuChoice(state: GameState, pending: PendingEffectChoice, actions: Action[]): Action | null {
  if (!(pending.effectId in CHOICE_RESOLVERS)) return null;
  const picks = actions.filter((a) => a.type === "resolve_effect_choice");
  return picks[0] ?? actions.find((a) => a.type === "skip_effect_choice") ?? null;
}

