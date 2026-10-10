/**
 * cardSpec RS-179〜RS-200（第4弾「四雄の覚醒」）用ヘルパー。
 * RS3-151-178.helpers.ts を写して拡張したもの（他の cardSpec ファイルには依存しない）。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { allCardsCatalog, getCardEffect, resolvePlayableCard } from "@rangers-strike/cards";
import { buildDefinitionMap, effectiveBp } from "../core/catalog";
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import type { GameAction } from "../types/actions";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import {
  MERGED_DEFINITIONS,
  createTestState,
  inst,
  type TestStateOptions,
} from "../testing/fixtures";

export { inst, effectiveBp };

/** エンジンが実ゲームで使う定義（createGame と同じ allCardsCatalog）＋テスト用定義。 */
export const DEFS: Record<string, CardDefinition> = {
  ...MERGED_DEFINITIONS,
  ...buildDefinitionMap([allCardsCatalog.cards]),
};

/**
 * 比較用の正規化（表記ゆれだけを吸収する）:
 * - NFKC（全角／半角）と空白の除去
 * - SP 表記の鉤括弧（「SP1」/SP1）、「SP!」/「!」の同一視
 * - カテゴリ略記（「OT」等）を正式名に揃える
 * - 「⇒」の前後と文末の「。」
 */
export function norm(text: string | undefined | null): string {
  let t = (text ?? "").normalize("NFKC").replace(/\s+/g, "");
  t = t.replace(/「(SP\d+)」/g, "$1").replace(/「SP!」/g, "「!」");
  t = t
    .replace(/「WB」/g, "「ワイルドビースト」")
    .replace(/「OT」/g, "「オーバーテクノロジー」")
    .replace(/「ET」/g, "「アーステクノロジー」")
    .replace(/「MA」/g, "「ミスティックアームズ」")
    .replace(/「DA」/g, "「ダークアライアンス」");
  t = t.replace(/。?⇒/g, "⇒").replace(/。$/, "");
  return t;
}

/** ゲームで使われる定義（DEFS）と resolvePlayableCard の両方のテキスト。 */
export function catalogTexts(id: string): string[] {
  const texts: string[] = [];
  const game = DEFS[id]?.text;
  texts.push(game ?? "");
  const playable = resolvePlayableCard(id)?.text;
  if (playable !== undefined) texts.push(playable);
  return texts;
}

/** カタログ本文が出典本文と（正規化後に）一致することを確認する。 */
export function expectCatalogText(id: string, source: string): void {
  expect(DEFS[id], `${id} の定義がない`).toBeDefined();
  for (const t of catalogTexts(id)) {
    expect(norm(t)).toBe(norm(source));
  }
}

export function effectMeta(id: string) {
  return getCardEffect(id);
}

export function sUnit(id: string, over: Partial<CardDefinition> = {}): CardDefinition {
  return {
    id,
    name: id,
    type: "unit",
    category: "WB",
    rarity: "N",
    expansion: "card-spec",
    powerCost: 0,
    bp: 1000,
    sp: 1,
    size: "S",
    ...over,
  } as CardDefinition;
}

export function st(
  options: Omit<TestStateOptions, "definitions"> = {},
  extra: CardDefinition[] = [],
): GameState {
  const definitions: Record<string, CardDefinition> = { ...DEFS };
  for (const d of extra) definitions[d.id] = d;
  return createTestState({ phase: "battle", activePlayer: "player1", ...options, definitions });
}

export function tryAct(
  s: GameState,
  action: GameAction,
): { ok: boolean; state: GameState; error?: string } {
  const r = applyAction(s, action);
  if (!r.ok) return { ok: false, state: s, error: r.error };
  return { ok: true, state: r.state };
}

/** アクションを適用（失敗なら例外）。 */
export function raw(s: GameState, action: GameAction): GameState {
  const r = applyAction(s, action);
  if (!r.ok) throw new Error(`${action.type} failed: ${r.error ?? "unknown"}`);
  return r.state;
}

/** アクション適用後、同じプレイヤーのコマンド支払いを先頭から自動で済ませる。 */
export function act(s: GameState, action: GameAction): GameState {
  let next = raw(s, action);
  for (let i = 0; i < 4; i += 1) {
    const pending = next.pendingCommandPayment;
    if (!pending) break;
    const ids = pending.validInstanceIds.slice(0, pending.totalNeeded);
    if (ids.length < pending.totalNeeded) break;
    next = raw(next, {
      type: "resolve_command_payment",
      playerId: pending.playerId,
      commandInstanceIds: ids,
    });
  }
  return next;
}

export function legal(s: GameState): GameAction[] {
  return getLegalActions(s);
}

export function legalOfType<T extends GameAction["type"]>(
  s: GameState,
  type: T,
): Extract<GameAction, { type: T }>[] {
  return getLegalActions(s).filter(
    (a): a is Extract<GameAction, { type: T }> => a.type === type,
  );
}

export function actLegal(s: GameState, pick: (a: GameAction) => boolean): GameState {
  const action = getLegalActions(s).find(pick);
  if (!action) {
    throw new Error(
      `no legal action matched; legal=${getLegalActions(s)
        .map((a) => a.type)
        .join(",")}`,
    );
  }
  return act(s, action);
}

export type Zone = "hand" | "discard" | "power" | "command" | "rush" | "battle" | "operation" | "deck";

export function zoneIds(s: GameState, playerId: PlayerId, zone: Zone): string[] {
  return s.players[playerId][zone].map((c) => c.instanceId);
}

export function zoneOf(s: GameState, playerId: PlayerId, instanceId: string): Zone | null {
  for (const zone of ["hand", "discard", "power", "command", "rush", "battle", "operation", "deck"] as const) {
    if (s.players[playerId][zone].some((c) => c.instanceId === instanceId)) return zone;
  }
  return null;
}

export function cardIn(s: GameState, playerId: PlayerId, instanceId: string): CardInstance | undefined {
  for (const zone of ["hand", "discard", "power", "command", "rush", "battle", "operation", "deck"] as const) {
    const c = s.players[playerId][zone].find((x) => x.instanceId === instanceId);
    if (c) return c;
  }
  return undefined;
}

export function released(cardId: string, suffix: string): CardInstance {
  return { ...inst(cardId, suffix), commandHeld: false };
}

export function held(cardId: string, suffix: string): CardInstance {
  return { ...inst(cardId, suffix), commandHeld: true };
}

export function releasedN(n: number, cardId = "TST-OP", prefix = "rc"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => released(cardId, `${prefix}${i}`));
}

export function heldN(n: number, cardId = "TST-OP", prefix = "hc"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => held(cardId, `${prefix}${i}`));
}

export function powerCards(n: number, prefix = "pw"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst("TST-P", `${prefix}${i}`));
}

export function deckCards(n: number, prefix = "dk"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst("TST-OP", `${prefix}${i}`));
}

/** SP1・BP1000 の S ユニット（TST-UNIT-0）を n 体。 */
export function fillers(n: number, prefix = "fill"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst("TST-UNIT-0", `${prefix}${i}`));
}

export function enter(s: GameState, instanceId: string, playerId: PlayerId = "player1"): GameState {
  return act(s, { type: "move_to_battle", playerId, instanceId });
}

export function canEnter(s: GameState, instanceId: string, playerId: PlayerId = "player1"): boolean {
  return legal(s).some(
    (a) =>
      (a.type === "move_to_battle" && a.playerId === playerId && a.instanceId === instanceId) ||
      (a.type === "initiate_command_payment" &&
        a.playerId === playerId &&
        a.kind === "battle_entry" &&
        a.sourceInstanceId === instanceId),
  );
}

export function attack(
  s: GameState,
  attackerInstanceId: string,
  defenderInstanceId: string,
  playerId: PlayerId = "player1",
): GameState {
  return act(s, { type: "battle", playerId, attackerInstanceId, defenderInstanceId });
}

export function strike(s: GameState, instanceId: string, playerId: PlayerId = "player1"): GameState {
  return act(s, { type: "strike", playerId, instanceId });
}

export function canStrike(s: GameState, instanceId: string, playerId: PlayerId = "player1"): boolean {
  return legal(s).some((a) => a.type === "strike" && a.playerId === playerId && a.instanceId === instanceId);
}

export function attackTargets(s: GameState, attacker: string, playerId: PlayerId = "player1"): string[] {
  return legal(s)
    .filter(
      (a): a is Extract<GameAction, { type: "battle" }> =>
        a.type === "battle" && a.playerId === playerId && a.attackerInstanceId === attacker,
    )
    .map((a) => a.defenderInstanceId);
}

/** 反応ウィンドウとダメージ支払いをパスで進める。 */
export function settle(s: GameState, maxSteps = 30): GameState {
  let next = s;
  for (let i = 0; i < maxSteps; i++) {
    const actions = legal(next);
    const pass =
      actions.find((a) => a.type === "pass_battle_reaction") ??
      actions.find((a) => a.type === "pass_strike_reaction") ??
      actions.find((a) => a.type === "pass_leave_reaction") ??
      actions.find((a) => a.type === "pass_register") ??
      actions.find((a) => a.type === "pass_rush_reaction") ??
      actions.find((a) => a.type === "pass_morph_reaction") ??
      (next.pendingDamagePayment ? actions.find((a) => a.type === "resolve_damage_payment") : undefined);
    if (!pass) return next;
    next = act(next, pass);
  }
  return next;
}

/** 現在のアクティブプレイヤーのターンを終える。 */
export function endTurn(s: GameState): GameState {
  let next = settle(s);
  const start = next.activePlayer;
  for (let i = 0; i < 10 && next.activePlayer === start; i++) {
    const end = legal(next).find((a) => a.type === "end_phase");
    if (!end) break;
    next = act(next, end);
  }
  return next;
}

export function unitIn(s: GameState, playerId: PlayerId, instanceId: string): CardInstance | undefined {
  return s.players[playerId].battle.find((c) => c.instanceId === instanceId);
}

/**
 * 手札からの通常ラッシュ。ゾード（追加条件）手順があれば素材を順に選び（未指定なら先頭の候補）、
 * コマンド支払いは先頭の有効なリリース状態コマンドで済ませ、相手のラッシュ反応はパスする。
 */
export function rushFromHand(
  s: GameState,
  playerId: PlayerId,
  instanceId: string,
  opts: { materials?: string[]; destination?: "command" | "discard" } = {},
): { ok: boolean; state: GameState; error?: string } {
  let r = tryAct(s, { type: "begin_zord_setup", playerId, zordInstanceId: instanceId });
  if (!r.ok) {
    r = tryAct(s, { type: "initiate_command_payment", playerId, kind: "category_use", sourceInstanceId: instanceId });
    if (!r.ok) return r;
  }
  const mats = [...(opts.materials ?? [])];
  for (let i = 0; i < 12 && r.ok && r.state.pendingZordSetup; i += 1) {
    const setup = r.state.pendingZordSetup;
    if (setup.step === "destination") {
      r = tryAct(r.state, { type: "resolve_zord_setup", playerId, destination: opts.destination ?? "discard" });
    } else if (setup.step === "material") {
      const pick = mats.find((m) => setup.validInstanceIds.includes(m)) ?? setup.validInstanceIds[0];
      if (!pick) return { ok: false, state: s, error: "no_material" };
      mats.splice(mats.indexOf(pick), 1);
      r = tryAct(r.state, { type: "resolve_zord_setup", playerId, materialInstanceId: pick });
    } else {
      r = tryAct(r.state, { type: "resolve_zord_setup", playerId });
    }
  }
  if (!r.ok) return r;
  for (let i = 0; i < 6 && r.ok && r.state.pendingCommandPayment?.playerId === playerId; i += 1) {
    const p = r.state.pendingCommandPayment;
    r = tryAct(r.state, {
      type: "resolve_command_payment",
      playerId,
      commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded),
    });
  }
  if (!r.ok) return r;
  let next = r.state;
  for (let i = 0; i < 4 && next.pendingRush; i += 1) {
    const defender: PlayerId = next.pendingRush.rusherPlayerId === "player1" ? "player2" : "player1";
    const pass = tryAct(next, { type: "pass_rush_reaction", playerId: defender });
    if (!pass.ok) break;
    next = pass.state;
  }
  return { ok: true, state: next };
}

export function canStartRush(s: GameState, playerId: PlayerId, instanceId: string): boolean {
  return legal(s).some(
    (a) =>
      (a.type === "initiate_command_payment" &&
        a.kind === "category_use" &&
        a.playerId === playerId &&
        a.sourceInstanceId === instanceId) ||
      (a.type === "rush" && a.playerId === playerId && a.instanceId === instanceId) ||
      (a.type === "begin_zord_setup" && a.playerId === playerId && a.zordInstanceId === instanceId),
  );
}

/** フェイズ進行（ドロー・パス・フェイズ終了）を繰り返し、指定プレイヤーのバトルフェイズまで進める。 */
export function advanceToBattle(s: GameState, playerId: PlayerId, maxSteps = 40): GameState {
  let next = s;
  const order = [
    "pass_register",
    "pass_leave_reaction",
    "pass_rush_reaction",
    "pass_battle_reaction",
    "pass_strike_reaction",
    "return_all_battle_to_rush",
    "draw",
    "skip_bonus_draw",
    "release_start_commands",
    "pass_battle_entry",
    "end_phase",
  ];
  for (let i = 0; i < maxSteps; i += 1) {
    if (next.activePlayer === playerId && next.phase === "battle") return next;
    const acts = legal(next);
    const a = order.map((t) => acts.find((x) => x.type === t)).find(Boolean);
    if (!a) throw new Error(`advanceToBattle: stuck; legal=${acts.map((x) => x.type).join(",")}`);
    next = act(next, a);
  }
  throw new Error("advanceToBattle: step limit");
}

/** バトル進入直後の行動ウィンドウ（pendingBattleEntry）があればパスする。 */
export function passEntry(s: GameState, playerId: PlayerId = "player1"): GameState {
  const pass = legal(s).find((a) => a.type === "pass_battle_entry" && a.playerId === playerId);
  return pass ? act(s, pass) : s;
}

/** 手札のオペレーションを使う（カテゴリ支払い→使用。対象があれば指定）。 */
export function playOp(
  s: GameState,
  playerId: PlayerId,
  instanceId: string,
  targetInstanceId?: string,
): { ok: boolean; state: GameState; error?: string } {
  const direct = legal(s).find(
    (a) =>
      a.type === "play_operation" &&
      a.instanceId === instanceId &&
      (targetInstanceId === undefined || a.targetInstanceId === targetInstanceId),
  );
  if (direct) return tryAct(s, direct);
  let r = tryAct(s, {
    type: "initiate_command_payment",
    playerId,
    kind: "category_use",
    sourceInstanceId: instanceId,
    targetInstanceId,
  });
  if (!r.ok && targetInstanceId !== undefined) {
    r = tryAct(s, { type: "initiate_command_payment", playerId, kind: "category_use", sourceInstanceId: instanceId });
  }
  if (!r.ok) return r;
  let next = r.state;
  for (let i = 0; i < 4 && next.pendingCommandPayment?.playerId === playerId; i += 1) {
    const p = next.pendingCommandPayment;
    const rr = tryAct(next, {
      type: "resolve_command_payment",
      playerId,
      commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded),
    });
    if (!rr.ok) return rr;
    next = rr.state;
  }
  if (targetInstanceId !== undefined && next.pendingEffectChoice?.validInstanceIds?.includes(targetInstanceId)) {
    const rr = tryAct(next, { type: "resolve_effect_choice", playerId: next.pendingEffectChoice.playerId, instanceId: targetInstanceId });
    if (!rr.ok) return rr;
    next = rr.state;
  }
  return { ok: true, state: next };
}

/** 「ホールドしなければ出られない」ユニットをバトルエリアに出す（battle_entry 支払いを先頭のリリース状態コマンドで）。 */
export function enterHold(s: GameState, instanceId: string, playerId: PlayerId = "player1"): GameState {
  return act(s, { type: "initiate_command_payment", playerId, kind: "battle_entry", sourceInstanceId: instanceId });
}

/** 印刷スペック（BP・SP・必要パワー・CN・サイズ・カテゴリ・特徴）。 */
export function expectStats(
  id: string,
  stats: {
    name: string;
    category: string;
    size: string;
    bp: number;
    sp: number | "special" | undefined;
    powerCost: number | string;
    comboNumber?: number;
    features: string[];
    rushCondition?: string;
  },
): void {
  const d = DEFS[id]!;
  expect(d.name).toBe(stats.name);
  expect(d.type).toBe("unit");
  expect(d.category).toBe(stats.category);
  expect(d.powerCost).toBe(stats.powerCost);
  expect(d.size).toBe(stats.size);
  expect(d.bp).toBe(stats.bp);
  expect(d.sp ?? undefined).toBe(stats.sp);
  expect(d.comboNumber).toBe(stats.comboNumber);
  expect(d.features ?? []).toEqual(stats.features);
  expect(d.rushAdditionalCondition?.conditionId).toBe(stats.rushCondition);
}

/** ナンバーコンビネーションのログが出たか。 */
export function ncLogged(s: GameState, cardId: string): boolean {
  return s.log.some((l) => l.includes("number_combo") && l.includes(cardId));
}

/** バトル進入のホールド支払いを指定コマンドで行う。 */
export function enterWithHold(
  s: GameState,
  instanceId: string,
  commandInstanceIds: string[],
  playerId: PlayerId = "player1",
): GameState {
  let next = raw(s, { type: "initiate_command_payment", playerId, kind: "battle_entry", sourceInstanceId: instanceId });
  if (next.pendingCommandPayment) {
    next = raw(next, {
      type: "resolve_command_payment",
      playerId,
      commandInstanceIds: commandInstanceIds.slice(0, next.pendingCommandPayment.totalNeeded),
    });
  }
  return next;
}

/** pendingEffectChoice の候補。 */
export function choiceIds(s: GameState): string[] {
  return [...(s.pendingEffectChoice?.validInstanceIds ?? [])].sort();
}

export function bpOf(s: GameState, playerId: PlayerId, instanceId: string): number {
  const c = cardIn(s, playerId, instanceId);
  if (!c) throw new Error(`no card ${instanceId}`);
  return effectiveBp(s, playerId, c);
}

/** 手札などのカード（オペレーション・カウンター）を使う（支払いは先頭の有効コマンド）。 */
export function useCard(
  s: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  extra: { targetInstanceId?: string; substituteInstanceId?: string } = {},
): GameState {
  const matches = (a: Record<string, unknown>) =>
    (extra.targetInstanceId === undefined || a.targetInstanceId === extra.targetInstanceId) &&
    (extra.substituteInstanceId === undefined || a.substituteInstanceId === extra.substituteInstanceId);
  const actions = legal(s) as unknown as Record<string, unknown>[];
  const pays = actions.filter(
    (a) => a.type === "initiate_command_payment" && a.playerId === playerId && a.sourceInstanceId === sourceInstanceId,
  );
  const pay = pays.find(matches) ?? (pays[0] ? { ...pays[0], ...extra } : undefined);
  if (pay) {
    let next = raw(s, pay as unknown as GameAction);
    const pending = next.pendingCommandPayment;
    if (pending && pending.playerId === playerId) {
      next = raw(next, {
        type: "resolve_command_payment",
        playerId,
        commandInstanceIds: pending.validInstanceIds.slice(0, pending.totalNeeded),
      });
    }
    return next;
  }
  const directs = actions.filter(
    (a) =>
      (a.type === "play_operation" || a.type === "play_counter") &&
      a.playerId === playerId &&
      a.instanceId === sourceInstanceId,
  );
  const direct = directs.find(matches) ?? (directs[0] ? { ...directs[0], ...extra } : undefined);
  if (!direct) throw new Error(`no legal use of ${sourceInstanceId}`);
  return raw(s, direct as unknown as GameAction);
}

export function canUseCard(s: GameState, playerId: PlayerId, sourceInstanceId: string): boolean {
  return (legal(s) as unknown as Record<string, unknown>[]).some(
    (a) =>
      a.playerId === playerId &&
      (a.sourceInstanceId === sourceInstanceId || a.instanceId === sourceInstanceId) &&
      ["initiate_command_payment", "play_operation", "play_counter"].includes(a.type as string),
  );
}

/** 指定プレイヤーの指定フェイズまで進める（ドロー・戻し・フェイズ終了）。 */
export function toPhase(s: GameState, playerId: PlayerId, phase: GameState["phase"], maxSteps = 30): GameState {
  let next = s;
  const order = [
    "pass_register",
    "pass_leave_reaction",
    "pass_rush_reaction",
    "pass_battle_reaction",
    "pass_strike_reaction",
    "return_all_battle_to_rush",
    "draw",
    "skip_bonus_draw",
    "release_start_commands",
    "pass_battle_entry",
    "end_phase",
  ];
  for (let i = 0; i < maxSteps; i += 1) {
    if (next.activePlayer === playerId && next.phase === phase) return next;
    const acts = legal(next);
    const a = order.map((t) => acts.find((x) => x.type === t)).find(Boolean);
    if (!a) throw new Error(`toPhase: stuck; legal=${acts.map((x) => x.type).join(",")}`);
    next = act(next, a);
  }
  throw new Error("toPhase: step limit");
}

/** 保留中の効果選択を、指定（無ければ先頭）で解決し続ける。 */
export function drain(s: GameState, playerId: PlayerId, prefer: string[] = []): GameState {
  let next = s;
  for (let i = 0; i < 8; i++) {
    const p = next.pendingEffectChoice;
    if (!p || p.playerId !== playerId) break;
    const pick = prefer.find((id) => p.validInstanceIds.includes(id)) ?? p.validInstanceIds[0];
    if (!pick) break;
    const r = tryAct(next, { type: "resolve_effect_choice", playerId, instanceId: pick });
    if (!r.ok) break;
    next = r.state;
  }
  return next;
}

/** カウンター（隠流忍術等）の「かわりにバトルさせる」候補。 */
export function substitutes(s: GameState, counter: string): string[] {
  return legal(s)
    .filter(
      (a) =>
        (a.type === "initiate_command_payment" && a.sourceInstanceId === counter) ||
        (a.type === "play_counter" && a.instanceId === counter),
    )
    .map((a) => ("substituteInstanceId" in a ? a.substituteInstanceId : undefined))
    .filter((x): x is string => typeof x === "string");
}

/** 隠流忍術（RS-018）を使って sub をかわりにバトルさせる。 */
export function useNinja(s: GameState, counter: string, sub: string): GameState {
  let n = s;
  const pay = legal(n).find(
    (a) => a.type === "initiate_command_payment" && a.sourceInstanceId === counter && a.substituteInstanceId === sub,
  );
  if (pay) n = act(n, pay);
  const play = legal(n).find((a) => a.type === "play_counter" && a.instanceId === counter && a.substituteInstanceId === sub);
  if (play) n = act(n, play);
  return n;
}

/** 合法手のうち、指定ユニットのストライク・アタックを含むものの有無（敵軍視点の制限確認用）。 */
export function hasAction(s: GameState, pick: (a: GameAction) => boolean): boolean {
  return legal(s).some(pick);
}

/** オペレーションの印刷スペック（種類・カテゴリ・必要パワー）。 */
export function expectOpStats(id: string, stats: { name: string; category: string; powerCost: number }): void {
  const d = DEFS[id]!;
  expect(d.name).toBe(stats.name);
  expect(d.type).toBe("operation");
  expect(d.category).toBe(stats.category);
  expect(d.powerCost).toBe(stats.powerCost);
}

/**
 * 効果の選択を「行う」側で進める汎用手順（実装の窓口の形に依存しないように）:
 * confirm（任意効果の確認）があれば確認し、pick が候補にあればそれを選ぶ。最後に確定（confirm_effect_choice）があれば確定。
 */
export function pickEffect(s: GameState, playerId: PlayerId, picks: string[] = []): GameState {
  let next = s;
  const queue = [...picks];
  for (let i = 0; i < 12; i++) {
    const p = next.pendingEffectChoice;
    if (!p || p.playerId !== playerId) break;
    const acts = legal(next);
    const want = queue.find((id) => p.validInstanceIds.includes(id));
    if (want) {
      const r = tryAct(next, { type: "resolve_effect_choice", playerId, instanceId: want });
      if (!r.ok) break;
      queue.splice(queue.indexOf(want), 1);
      next = r.state;
      continue;
    }
    const confirm = acts.find((a) => a.type === "confirm_effect_choice" && a.playerId === playerId);
    if (confirm) {
      next = act(next, confirm);
      continue;
    }
    break;
  }
  return next;
}

/** 保留中の任意効果を断る（skip_effect_choice）。 */
export function declineEffect(s: GameState, playerId: PlayerId): GameState {
  const r = tryAct(s, { type: "skip_effect_choice", playerId });
  return r.ok ? r.state : s;
}

/** ダメージ（ウラ向きのパワー）を n 枚持つパワーゾーン。 */
export function damagedPower(n: number, prefix = "dmg"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => ({ ...inst("TST-P", `${prefix}${i}`), faceDown: true }));
}

/** 指定プレイヤーのバトルエリアに fillers を順に出して（行動はパス）並び順を作る。 */
export function lineUp(s: GameState, ids: string[], playerId: PlayerId = "player1"): GameState {
  let next = s;
  for (const id of ids) {
    next = enter(next, id, playerId);
    next = passEntry(next, playerId);
  }
  return next;
}
