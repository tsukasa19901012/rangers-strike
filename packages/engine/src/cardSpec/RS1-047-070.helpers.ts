/**
 * cardSpec RS-047〜RS-070（第1弾「英雄の再誕」）用ヘルパー。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 * rulesSpec/*-helpers.ts のパターンを写したもの（他エージェントの cardSpec には依存しない）。
 */
import { expect } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { allCardsCatalog, getCardEffect, resolvePlayableCard } from "@rangers-strike/cards";
import { buildDefinitionMap } from "../core/catalog";
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import type { GameAction } from "../types/actions";
import { rushReactorId } from "../core/helpers";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import {
  MERGED_DEFINITIONS,
  createTestState,
  inst,
  type TestStateOptions,
} from "../testing/fixtures";

export { inst };

/** エンジンが実ゲームで使う定義（createGame と同じ allCardsCatalog）＋テスト用定義。 */
export const DEFS: Record<string, CardDefinition> = {
  ...MERGED_DEFINITIONS,
  ...buildDefinitionMap([allCardsCatalog.cards]),
};

/** 全角／半角・空白の差だけを無視する正規化。 */
export function norm(text: string | undefined | null): string {
  return (text ?? "").normalize("NFKC").replace(/\s+/g, "");
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
    const defender: PlayerId = rushReactorId(next.pendingRush);
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
