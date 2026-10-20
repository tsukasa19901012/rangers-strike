/**
 * cardSpec RS-627〜RS-647（第9弾「蒼九の翼」）用ヘルパー。
 * RS8-582-604.helpers.ts を写して拡張したもの（他の cardSpec ファイルには依存しない）。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { allCardsCatalog, getCardEffect, resolvePlayableCard } from "@rangers-strike/cards";
import { buildDefinitionMap, effectiveBp } from "../core/catalog";
import { applyAction } from "../core/applyAction";
import { strikeDamageFor } from "../rules/combo";
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
export { enterBattleByEffect } from "../testing/battleEntry";

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

/** 効果の選択（resolve_effect_choice）。 */
export function pick(s: GameState, instanceId: string): GameState {
  const p = s.pendingEffectChoice;
  if (!p) throw new Error("no pendingEffectChoice");
  return act(s, { type: "resolve_effect_choice", playerId: p.playerId, instanceId });
}

/** 任意の効果の選択を見送る（skip_effect_choice）。 */
export function skip(s: GameState): GameState {
  const p = s.pendingEffectChoice;
  if (!p) throw new Error("no pendingEffectChoice");
  return act(s, { type: "skip_effect_choice", playerId: p.playerId });
}

/** 見送り（skip_effect_choice）が合法か。 */
export function canSkip(s: GameState): boolean {
  return legal(s).some((a) => a.type === "skip_effect_choice");
}

/** 複数選択の確定（confirm_effect_choice）。 */
export function confirm(s: GameState): GameState {
  const p = s.pendingEffectChoice;
  if (!p) throw new Error("no pendingEffectChoice");
  return act(s, { type: "confirm_effect_choice", playerId: p.playerId });
}

/** ログに指定の文字列を含む行があるか。 */
export function logged(s: GameState, ...parts: string[]): boolean {
  return s.log.some((l) => parts.every((p) => l.includes(p)));
}

/** ウラ向き（ダメージ）のパワーカード n 枚。 */
export function damageCards(n: number, prefix = "dmg"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => ({ ...inst("TST-P", `${prefix}${i}`), faceDown: true }));
}

/** フェイズ終了を1回。 */
export function nextPhase(s: GameState): GameState {
  const a = legal(s).find((x) => x.type === "end_phase");
  if (!a) throw new Error(`no end_phase; legal=${legal(s).map((x) => x.type).join(",")}`);
  return act(s, a);
}

/** 現在の SP（ストライクで与えるダメージ。SP！で NC 未成立なら 0）。 */
export function spOf(s: GameState, playerId: PlayerId, instanceId: string): number {
  const c = cardIn(s, playerId, instanceId);
  if (!c) throw new Error(`no card ${instanceId}`);
  return strikeDamageFor(s.definitions, c, s, playerId);
}

/**
 * 手札からのラッシュを、合法手の initiate_command_payment（category_use）から選んで行う
 * （ゾードダウン等の素材を指定する形の合法手に対応）。prefer で候補を絞る。支払いは先頭の有効なコマンド。
 */
export function rushVia(
  s: GameState,
  playerId: PlayerId,
  instanceId: string,
  prefer: (a: Record<string, unknown>) => boolean = () => true,
): { ok: boolean; state: GameState; error?: string } {
  const cands = (legal(s) as unknown as Record<string, unknown>[]).filter(
    (a) =>
      a.type === "initiate_command_payment" &&
      a.kind === "category_use" &&
      a.playerId === playerId &&
      a.sourceInstanceId === instanceId,
  );
  const a = cands.find(prefer);
  if (!a) return { ok: false, state: s, error: "no_rush_action" };
  let r = tryAct(s, a as unknown as GameAction);
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

// ---------------------------------------------------------------------------
// 追加ヘルパー（RS-327〜RS-347 由来）

/** リリース状態のカテゴリ別コマンド n 枚。 */
export function releasedCat(cat: "WB" | "MA" | "OT" | "ET" | "DA", n: number, prefix = `c${cat}`): CardInstance[] {
  const id = cat === "WB" ? "TST-OP" : `TST-OP-${cat}`;
  return Array.from({ length: n }, (_, i) => released(id, `${prefix}${i}`));
}

/** 両プレイヤーの保留中の効果選択を、prefer を優先（無ければ先頭）して解決し続け、反応ウィンドウはパスする。 */
export function resolveAll(s: GameState, prefer: string[] = [], maxSteps = 12): GameState {
  let next = settle(s);
  for (let i = 0; i < maxSteps; i++) {
    const p = next.pendingEffectChoice;
    if (!p) break;
    const before = next;
    next = settle(drain(next, p.playerId, prefer));
    if (next === before) break;
  }
  return next;
}

/** 敵軍（player2）ターンに player2 の attackerId（既定は BP13000 の TST-UNIT-7）が player1 の targetId にアタックする（反応はパス）。 */
export function attackedInEnemyTurn(
  p1: Partial<GameState["players"]["player1"]>,
  targetId: string,
  p2: Partial<GameState["players"]["player2"]> = {},
  attacker = "TST-UNIT-7:atk",
  extra: CardDefinition[] = [],
): GameState {
  const s = st(
    {
      activePlayer: "player2",
      player1: { deck: deckCards(5), ...p1 },
      player2: { battle: [inst(attacker.split(":")[0]!, attacker.split(":")[1]!)], deck: deckCards(5, "e"), ...p2 },
    },
    extra,
  );
  return settle(attack(s, attacker, targetId, "player2"));
}

/** 上の続き。選択は prefer を優先して解決する。 */
export function destroyedInEnemyTurn(
  p1: Partial<GameState["players"]["player1"]>,
  targetId: string,
  p2: Partial<GameState["players"]["player2"]> = {},
  prefer: string[] = [],
): GameState {
  return resolveAll(attackedInEnemyTurn(p1, targetId, p2), prefer);
}

/** バトルログ（"battle|<attackerCardId>|…|<atkBp>vs<defBp>"）から、直近のアタック側 BP を読む。 */
export function lastBattleBps(s: GameState): { attacker: number; defender: number } | null {
  for (let i = s.log.length - 1; i >= 0; i--) {
    const m = s.log[i]!.match(/\|battle\|.*:(\d+)vs(\d+)$/);
    if (m) return { attacker: Number(m[1]), defender: Number(m[2]) };
  }
  return null;
}

/** SP なし（印刷「－」）・BP1000 の S ユニット（アタックしても撃破できない相手役）。 */
export const NOSP_ATTACKER = sUnit("SPEC-NOSP", { sp: undefined, bp: 1000 });

/** 撃破されて捨札になったときの ※ 効果（自軍捨札の指定名カードを自軍ラッシュエリアに出す）の共通テスト。 */
export function reanimateTests(id: string, partnerId: string, partnerName: string, page: string) {
  it(`${id}: ※ 撃破されて捨札になったとき、自軍捨札の「${partnerName}」を1枚選び自軍ラッシュエリアに出す（出典: ${page}）`, () => {
    const s = destroyedInEnemyTurn(
      { battle: [inst(id, "am")], discard: [inst("TST-UNIT-0", "other"), inst(partnerId, "p")] },
      `${id}:am`,
      {},
      [`${partnerId}:p`],
    );
    expect(zoneOf(s, "player1", `${id}:am`)).toBe("discard");
    expect(zoneOf(s, "player1", `${partnerId}:p`)).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:other")).toBe("discard");
  });

  it(`${id}: ※ 選べるのは「${partnerName}」のカードだけで、出さないことは選べない（強制）（出典: ${page}「「${partnerName}」のカードがあれば1枚選び、…出す」）`, () => {
    let s = attackedInEnemyTurn(
      { battle: [inst(id, "am")], discard: [inst("TST-UNIT-0", "other"), inst(partnerId, "p"), inst(partnerId, "p2")] },
      `${id}:am`,
    );
    expect(s.pendingEffectChoice?.sourceCardId).toBe(id);
    expect(choiceIds(s)).toEqual([`${partnerId}:p`, `${partnerId}:p2`]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, `${partnerId}:p2`));
    expect(zoneOf(s, "player1", `${partnerId}:p2`)).toBe("rush");
    expect(zoneOf(s, "player1", `${partnerId}:p`)).toBe("discard");
    expect(s.players.player1.rush).toHaveLength(1);
  });

  it(`${id}: ※ 自軍捨札に「${partnerName}」がなければ何も出さない（出典: ${page}「…があれば」）`, () => {
    const s = destroyedInEnemyTurn({ battle: [inst(id, "am")], discard: [inst("TST-UNIT-0", "other")] }, `${id}:am`);
    expect(zoneOf(s, "player1", `${id}:am`)).toBe("discard");
    expect(s.players.player1.rush).toHaveLength(0);
  });

  it(`${id}: ※ 敵軍の捨札にある「${partnerName}」は出さない（出典: ${page}「自軍捨札」）`, () => {
    const s = destroyedInEnemyTurn({ battle: [inst(id, "am")] }, `${id}:am`, { discard: [inst(partnerId, "ep")] });
    expect(zoneOf(s, "player2", `${partnerId}:ep`)).toBe("discard");
    expect(s.players.player1.rush).toHaveLength(0);
  });

  it(`${id}: ※ 撃破されずに場に残ったときは何も出さない（出典: ${page}「撃破されて捨札になったとき」）`, () => {
    const s = resolveAll(
      attackedInEnemyTurn({ battle: [inst(id, "am")], discard: [inst(partnerId, "p")] }, `${id}:am`, {}, "SPEC-NOSP:atk", [NOSP_ATTACKER]),
    );
    expect(zoneOf(s, "player1", `${id}:am`)).toBe("battle");
    expect(zoneOf(s, "player1", `${partnerId}:p`)).toBe("discard");
  });
}


/** 「自軍「X」1体を捨札にすれば必要パワー0になる」（必要パワー7-）の追加条件の共通テスト。 */
export function zordDownTests(
  id: string,
  partnerId: string,
  partnerName: string,
  page: string,
  cat: "WB" | "MA" | "OT" | "ET" | "DA",
) {
  it(`${id}: 追加条件 — 自軍「${partnerName}」1体を捨札にすれば必要パワー0でラッシュできる（出典: ${page}）`, () => {
    const s = st({ phase: "rush", player1: { hand: [inst(id, "am")], rush: [inst(partnerId, "p")], command: releasedCat(cat, 1), power: [], deck: deckCards(3) } });
    const r = rushVia(s, "player1", `${id}:am`, (a) => a.zordMaterialInstanceId === `${partnerId}:p`);
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", `${id}:am`)).toBe("rush");
    expect(zoneOf(t, "player1", `${partnerId}:p`)).toBe("discard");
  });

  it(`${id}: 必要パワー7- — 「${partnerName}」がいなければパワー7でラッシュでき、6ではラッシュできない（出典: ${page}・R-ADD-02）`, () => {
    const mk = (n: number) => st({ phase: "rush", player1: { hand: [inst(id, "am")], command: releasedCat(cat, 1), power: powerCards(n), deck: deckCards(3) } });
    expect(canStartRush(mk(6), "player1", `${id}:am`)).toBe(false);
    const r = rushFromHand(mk(7), "player1", `${id}:am`);
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", `${id}:am`)).toBe("rush");
  });
}

// ---------------------------------------------------------------------------
// RS-538〜RS-559 用の追加ヘルパー

/** 自軍バトルフェイズに、ids を順にバトルエリアへ出す（各進入後の行動ウィンドウはパス）。 */
export function enterSeq(s: GameState, ids: string[], playerId: PlayerId = "player1"): GameState {
  let next = s;
  for (const id of ids) next = passEntry(enter(passEntry(next, playerId), id, playerId), playerId);
  return next;
}

/** TST-UNIT-0（CN なし・SP1・BP1000）を n 体。 */
export function fill(n: number, prefix = "f"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst("TST-UNIT-0", `${prefix}${i}`));
}

/** ホールド状態のユニット。 */
export function heldUnit(cardId: string, suffix: string): CardInstance {
  return { ...inst(cardId, suffix), commandHeld: true };
}

/** レジスト（use_register）が提示されているか。 */
export function registerOffered(s: GameState, playerId: PlayerId = "player1"): boolean {
  return legal(s).some((a) => a.type === "use_register" && a.playerId === playerId);
}

/** フェイズ終了（end_phase）が合法か。 */
export function canEndPhase(s: GameState, playerId: PlayerId = "player1"): boolean {
  return legal(s).some((a) => a.type === "end_phase" && a.playerId === playerId);
}

/** 敵軍（player2）ターンに player2 の attacker が player1 の targetId にアタックし、レジストの提示まで進める（レジストはパスしない）。 */
export function attackUntilRegister(
  p1: Partial<GameState["players"]["player1"]>,
  targetId: string,
  p2: Partial<GameState["players"]["player2"]> = {},
  attacker = "TST-UNIT-7:atk",
  extra: CardDefinition[] = [],
): GameState {
  const [aid, asuf] = attacker.split(":") as [string, string];
  let s = attack(
    st(
      {
        activePlayer: "player2",
        player1: { deck: deckCards(5), ...p1 },
        player2: { battle: [inst(aid, asuf)], deck: deckCards(5, "e"), ...p2 },
      },
      extra,
    ),
    attacker,
    targetId,
    "player2",
  );
  for (let i = 0; i < 6 && !legal(s).some((a) => a.type === "use_register"); i++) {
    const p = legal(s).find((a) => a.type === "pass_battle_reaction" || a.type === "pass_leave_reaction");
    if (!p) break;
    s = act(s, p);
  }
  return s;
}

// ---------------------------------------------------------------------------
// RS-627〜RS-647 用の追加ヘルパー

/** 印刷レアリティ（atwiki「レアリティ」行。ノーマル=N、ノーマルレア=NR、レア=R、スーパーレア=SR）。 */
export function rarityOf(id: string): string | undefined {
  return (DEFS[id] as { rarity?: string } | undefined)?.rarity;
}

/** ウイング（hold_for_wing）が合法か。 */
export function canWing(s: GameState, instanceId: string, playerId: PlayerId = "player1"): boolean {
  return legal(s).some((a) => a.type === "hold_for_wing" && a.playerId === playerId && a.instanceId === instanceId);
}

/**
 * ※ウイング の共通テスト（R-KW-WING-01・02、grnrngr/faq-card-9「ウイング」）。
 * 自軍バトルフェイズにラッシュエリアでホールドして敵軍ユニットにアタックでき、そのターンはバトルエリアに出られない。
 */
export function wingTests(id: string, page: string): void {
  // 敵: BP500 の S ユニット（どのウイング持ちでも勝てる）。
  const ENEMY = sUnit("SPEC-WING-ENEMY", { bp: 500, sp: undefined });
  const board = (phase: GameState["phase"] = "battle") =>
    st(
      {
        phase,
        player1: { rush: [inst(id, "w")], deck: deckCards(3) },
        player2: { battle: [inst("SPEC-WING-ENEMY", "e")], deck: deckCards(3, "e") },
      },
      [ENEMY],
    );

  it(`${id}: ※ウイング — 自軍バトルフェイズにラッシュエリアでホールドし、ラッシュエリアから敵軍ユニットにアタックできる（出典: ${page}、grnrngr/faq-card-9 ウイング A1・R-KW-WING-01）`, () => {
    let s = board();
    expect(canWing(s, `${id}:w`)).toBe(true);
    s = act(s, { type: "hold_for_wing", playerId: "player1", instanceId: `${id}:w` });
    expect(cardIn(s, "player1", `${id}:w`)?.commandHeld).toBe(true);
    expect(attackTargets(s, `${id}:w`)).toContain("SPEC-WING-ENEMY:e");
    s = settle(attack(s, `${id}:w`, "SPEC-WING-ENEMY:e"));
    expect(zoneOf(s, "player2", "SPEC-WING-ENEMY:e")).toBe("discard");
    expect(zoneOf(s, "player1", `${id}:w`)).toBe("rush");
  });

  it(`${id}: ※ウイング — 発動したターンはバトルエリアに出られない（出典: grnrngr/faq-card-9 ウイング Q4「いいえ、できません」）`, () => {
    let s = board();
    s = act(s, { type: "hold_for_wing", playerId: "player1", instanceId: `${id}:w` });
    expect(canEnter(s, `${id}:w`)).toBe(false);
  });

  it(`${id}: ※ウイング — 自軍バトルフェイズ以外（ラッシュフェイズ）には発動できない（出典: grnrngr/faq-card-9 ウイング Q3「いいえ、できません」）`, () => {
    expect(canWing(board("rush"), `${id}:w`)).toBe(false);
  });

  it(`${id}: ※ウイング — ラッシュエリア以外（バトルエリア）からは発動できない（出典: grnrngr/faq-card-9 ウイング Q5）`, () => {
    const s = st(
      { player1: { battle: [inst(id, "w")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-WING-ENEMY", "e")] } },
      [ENEMY],
    );
    expect(canWing(s, `${id}:w`)).toBe(false);
  });

  it(`${id}: ※ウイング — ホールドしてもストライクはできない（出典: grnrngr/faq-card-9 ウイング Q6「いいえ、できません」）`, () => {
    const s = act(board(), { type: "hold_for_wing", playerId: "player1", instanceId: `${id}:w` });
    expect(canStrike(s, `${id}:w`)).toBe(false);
  });
}

/** 自軍バトルフェイズの盤面（player1）。 */
export function p1Battle(
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  return st({ player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, extra);
}

/** ids を順にバトルエリアへ出す。最後のユニットの進入直後の行動ウィンドウ（ストライク・アタック）はパスせずに残す。 */
export function enterKeep(s: GameState, ids: string[], playerId: PlayerId = "player1"): GameState {
  let next = s;
  ids.forEach((id, i) => {
    next = enter(passEntry(next, playerId), id, playerId);
    if (i < ids.length - 1) next = passEntry(next, playerId);
  });
  return next;
}
