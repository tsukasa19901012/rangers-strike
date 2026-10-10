/**
 * cardSpec RS-024〜RS-046（第1弾「英雄の再誕」）用ヘルパー。
 * rulesSpec/*-helpers.ts のパターンを写したもの。公開 API（createTestState / applyAction /
 * getLegalActions）の薄いラッパーだけを置く。
 */
import { expect } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import {
  fullPlayableCatalog,
  getCardEffect,
  getExtendedCardById,
  resolvePlayableCard,
} from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "../index";
import type { GameAction } from "../types/actions";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import {
  TEST_DEFINITIONS,
  createTestState,
  inst,
  type TestStateOptions,
} from "../testing/fixtures";

export { inst, applyAction, getLegalActions };
export type { GameAction, GameState, CardInstance, PlayerId };

/** テスト専用カード（実カードで作りにくい性質だけを持つ）。 */
export const SPEC_DEFS: Record<string, CardDefinition> = {
  "SPEC-S-1000": unitDef("SPEC-S-1000", { bp: 1000, size: "S" }),
  "SPEC-S-3000": unitDef("SPEC-S-3000", { bp: 3000, size: "S" }),
  "SPEC-S-5000": unitDef("SPEC-S-5000", { bp: 5000, size: "S" }),
  "SPEC-S-6000": unitDef("SPEC-S-6000", { bp: 6000, size: "S" }),
  "SPEC-S-8000": unitDef("SPEC-S-8000", { bp: 8000, size: "S" }),
  "SPEC-S-9000": unitDef("SPEC-S-9000", { bp: 9000, size: "S" }),
  "SPEC-M-4000": unitDef("SPEC-M-4000", { bp: 4000, size: "M" }),
  "SPEC-M-5000": unitDef("SPEC-M-5000", { bp: 5000, size: "M" }),
  "SPEC-M-6000": unitDef("SPEC-M-6000", { bp: 6000, size: "M" }),
  "SPEC-M-8000": unitDef("SPEC-M-8000", { bp: 8000, size: "M" }),
  "SPEC-L-8000": unitDef("SPEC-L-8000", { bp: 8000, size: "L" }),
  "SPEC-L-12000": unitDef("SPEC-L-12000", { bp: 12000, size: "L" }),
  "SPEC-S-ET": unitDef("SPEC-S-ET", { bp: 1000, size: "S", category: "ET" }),
  "SPEC-S-OT": unitDef("SPEC-S-OT", { bp: 1000, size: "S", category: "OT" }),
  "SPEC-S-OT-3000": unitDef("SPEC-S-OT-3000", { bp: 3000, size: "S", category: "OT" }),
  "SPEC-M-OT-5000": unitDef("SPEC-M-OT-5000", { bp: 5000, size: "M", category: "OT" }),
  "SPEC-M-ET-5000": unitDef("SPEC-M-ET-5000", { bp: 5000, size: "M", category: "ET" }),
  "SPEC-M-WB-4000": unitDef("SPEC-M-WB-4000", { bp: 4000, size: "M", category: "WB", sp: undefined }),
  "SPEC-S-WB-4000": unitDef("SPEC-S-WB-4000", { bp: 4000, size: "S", category: "WB" }),
  "SPEC-S-P7": unitDef("SPEC-S-P7", { bp: 1000, size: "S", powerCost: 7 }),
};

export function unitDef(id: string, options: Partial<CardDefinition> = {}): CardDefinition {
  return {
    id,
    name: id,
    type: "unit",
    category: "WB",
    rarity: "N",
    expansion: "test",
    powerCost: 0,
    bp: 1000,
    sp: 1,
    size: "S",
    ...options,
  } as CardDefinition;
}

/** エンジンが実ゲームで使う全プレイアブルカード + テスト用カード。 */
export const DEFS: Record<string, CardDefinition> = {
  ...Object.fromEntries(fullPlayableCatalog.cards.map((c) => [c.id, c])),
  ...TEST_DEFINITIONS,
  ...SPEC_DEFS,
};

export function mk(options: TestStateOptions = {}): GameState {
  return createTestState({
    phase: "rush",
    activePlayer: "player1",
    ...options,
    definitions: { ...DEFS, ...(options.definitions ?? {}) },
  });
}

// ---------------------------------------------------------------------------
// テキスト比較
// ---------------------------------------------------------------------------

/** エンジンが使うカード定義。 */
export function cardDef(id: string): CardDefinition | undefined {
  return resolvePlayableCard(id) ?? getExtendedCardById(id);
}

/** エンジンが使うカードテキスト（定義の text、なければ効果メタの text）。 */
export function engineText(id: string): string {
  const def = cardDef(id);
  if (def?.text?.trim()) return def.text;
  return getCardEffect(id)?.text ?? "";
}

/**
 * 比較用の正規化:
 * - NFKC（全角／半角）と空白の除去
 * - キーワード注釈「※カウンター（…）」「※常駐（…）」の括弧書き（注釈文）を落とす
 *   （キーワード自体の有無はタグで別途確認する）
 * - 「⇒」「→」は区切り記号として「。」と同一視し、「。。」を1つにまとめる
 * - SP 表記の鉤括弧（「SP1」/SP1）の有無を同一視
 * - カテゴリ略記（「WB」「OT」「ET」「MA」「DA」）を正式名に揃える
 */
export function norm(text: string | undefined | null): string {
  let t = (text ?? "").normalize("NFKC").replace(/\s+/g, "");
  t = t.replace(/※(カウンター|常駐)\([^)]*\)/g, "※$1");
  t = t.replace(/^※(カウンター|常駐)/, "");
  t = t.replace(/[⇒→]/g, "。").replace(/。+/g, "。");
  t = t.replace(/「(SP\d+)」/g, "$1");
  t = t
    .replace(/「WB」/g, "「ワイルドビースト」")
    .replace(/「OT」/g, "「オーバーテクノロジー」")
    .replace(/「ET」/g, "「アーステクノロジー」")
    .replace(/「MA」/g, "「ミスティックアームズ」")
    .replace(/「DA」/g, "「ダークアライアンス」");
  return t;
}

export function expectTextMatches(id: string, source: string): void {
  expect(cardDef(id), `${id} のカード定義がない`).toBeDefined();
  expect(norm(engineText(id))).toBe(norm(source));
}

// ---------------------------------------------------------------------------
// アクション
// ---------------------------------------------------------------------------

export function unwrap(result: ReturnType<typeof applyAction>): GameState {
  if (!result.ok) throw new Error(`action failed: ${result.error}`);
  return result.state;
}

export function act(state: GameState, action: GameAction): GameState {
  return unwrap(applyAction(state, action));
}

export function legal(state: GameState): GameAction[] {
  return getLegalActions(state);
}

export function legalOf<T extends GameAction["type"]>(
  state: GameState,
  type: T,
): Extract<GameAction, { type: T }>[] {
  return legal(state).filter((a) => a.type === type) as Extract<GameAction, { type: T }>[];
}

/** n 枚の表向きパワー。 */
export function powers(n: number, prefix = "pw"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst("TST-P", `${prefix}${i}`));
}

/** n 枚の山札用カード。 */
export function deck(n: number, prefix = "dk"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst("TST-OP", `${prefix}${i}`));
}

export function released(cardId: string, suffix: string): CardInstance {
  return { ...inst(cardId, suffix), commandHeld: false };
}

export function held(cardId: string, suffix: string): CardInstance {
  return { ...inst(cardId, suffix), commandHeld: true };
}

/** カテゴリ別のコマンド用カード ID。 */
export const CMD = {
  WB: "TST-OP",
  ET: "TST-OP-ET",
  OT: "TST-OP-OT",
  MA: "TST-OP-MA",
  DA: "TST-OP-DA",
} as const;

/**
 * カテゴリホールド支払い込みでカード（オペレーション／カウンター／ラッシュ）を使う。
 * commandInstanceIds 省略時は有効なコマンドを先頭から必要数選ぶ。
 */
export function tryPayAndUse(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  extra: Partial<Extract<GameAction, { type: "initiate_command_payment" }>> = {},
  commandInstanceIds?: string[],
): ReturnType<typeof applyAction> {
  const initiated = applyAction(state, {
    type: "initiate_command_payment",
    playerId,
    kind: "category_use",
    sourceInstanceId,
    ...extra,
  });
  if (!initiated.ok) return initiated;
  let next = initiated.state;
  for (let i = 0; i < 6; i += 1) {
    const pending = next.pendingCommandPayment;
    if (!pending || pending.playerId !== playerId) break;
    const ids = commandInstanceIds
      ? commandInstanceIds.splice(0, pending.totalNeeded)
      : pending.validInstanceIds.slice(0, pending.totalNeeded);
    const r = applyAction(next, { type: "resolve_command_payment", playerId, commandInstanceIds: ids });
    if (!r.ok) return r;
    next = r.state;
  }
  return { ok: true, state: next } as ReturnType<typeof applyAction>;
}

export function payAndUse(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  extra: Partial<Extract<GameAction, { type: "initiate_command_payment" }>> = {},
  commandInstanceIds?: string[],
): GameState {
  return unwrap(tryPayAndUse(state, playerId, sourceInstanceId, extra, commandInstanceIds));
}

/** sourceInstanceId を使う合法手（支払い開始／直接使用）があるか。 */
export function canUse(state: GameState, playerId: PlayerId, sourceInstanceId: string): boolean {
  return (legal(state) as unknown as Record<string, unknown>[]).some(
    (a) =>
      a.playerId === playerId &&
      (a.sourceInstanceId === sourceInstanceId || a.instanceId === sourceInstanceId) &&
      ["initiate_command_payment", "play_operation", "play_counter", "rush"].includes(
        a.type as string,
      ),
  );
}

/** 対象付きで使う合法手があるか（targetInstanceId 一致）。 */
export function canUseOn(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  targetInstanceId: string,
): boolean {
  return (legal(state) as unknown as Record<string, unknown>[]).some(
    (a) =>
      a.playerId === playerId &&
      (a.sourceInstanceId === sourceInstanceId || a.instanceId === sourceInstanceId) &&
      a.targetInstanceId === targetInstanceId,
  );
}

/** 保留中の選択で instanceId を選ぶ。 */
export function choose(state: GameState, playerId: PlayerId, instanceId: string): GameState {
  return act(state, { type: "resolve_effect_choice", playerId, instanceId });
}

/** 保留中の選択で可能な選択肢（resolve_effect_choice の instanceId 一覧）。 */
export function choiceOptions(state: GameState, playerId?: PlayerId): string[] {
  return legalOf(state, "resolve_effect_choice")
    .filter((a) => !playerId || a.playerId === playerId)
    .map((a) => a.instanceId);
}

export function zoneIds(
  state: GameState,
  playerId: PlayerId,
  zone: "hand" | "deck" | "discard" | "power" | "command" | "rush" | "battle" | "operation",
): string[] {
  return state.players[playerId][zone].map((c) => c.instanceId);
}

export function zoneOf(state: GameState, playerId: PlayerId, instanceId: string): string | null {
  const p = state.players[playerId];
  for (const zone of [
    "hand",
    "deck",
    "discard",
    "power",
    "command",
    "rush",
    "battle",
    "operation",
  ] as const) {
    if (p[zone]?.some((c) => c.instanceId === instanceId)) return zone;
  }
  return null;
}

export function findCard(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): CardInstance | undefined {
  const p = state.players[playerId];
  for (const zone of ["hand", "deck", "discard", "power", "command", "rush", "battle", "operation"] as const) {
    const c = p[zone]?.find((x) => x.instanceId === instanceId);
    if (c) return c;
  }
  return undefined;
}

export function heldCount(state: GameState, playerId: PlayerId): number {
  return state.players[playerId].command.filter((c) => c.commandHeld).length;
}

/** 保留中の反応窓を、指定プレイヤーがパスして閉じる（最大 n 回）。 */
export function passReactions(state: GameState, maxSteps = 6): GameState {
  const passTypes = [
    "pass_rush_reaction",
    "pass_leave_reaction",
    "pass_battle_reaction",
    "pass_strike_reaction",
    "pass_register",
    "pass_morph_reaction",
  ];
  let s = state;
  for (let i = 0; i < maxSteps; i += 1) {
    const pass = legal(s).find((a) => passTypes.includes(a.type));
    if (!pass) break;
    s = act(s, pass);
  }
  return s;
}

/** ターンプレイヤーが end_phase を繰り返してターンを終える（保留中の選択は先頭の合法手で進める）。 */
export function endTurn(state: GameState): GameState {
  const player = state.activePlayer;
  let s = state;
  for (let i = 0; i < 30 && s.activePlayer === player && !s.winner; i += 1) {
    const actions = legal(s);
    const end = actions.find((a) => a.type === "end_phase" && a.playerId === player);
    const next = end ?? actions[0];
    if (!next) break;
    s = act(s, next);
  }
  return s;
}

/**
 * 手札から通常ラッシュ（カテゴリ支払い込み）。追加条件付きはウィザード（begin_zord_setup）経由。
 */
export function tryRush(
  state: GameState,
  playerId: PlayerId,
  unitInstanceId: string,
  material?: string,
): ReturnType<typeof applyAction> {
  if (!material) return tryPayAndUse(state, playerId, unitInstanceId);
  let r = applyAction(state, { type: "begin_zord_setup", playerId, zordInstanceId: unitInstanceId });
  if (!r.ok) {
    return tryPayAndUse(state, playerId, unitInstanceId, { zordMaterialInstanceId: material });
  }
  let next = r.state;
  for (let i = 0; i < 6 && next.pendingZordSetup; i += 1) {
    const setup = next.pendingZordSetup;
    if (setup.step === "destination") {
      r = applyAction(next, { type: "resolve_zord_setup", playerId, destination: "discard" });
    } else if (setup.step === "material") {
      r = applyAction(next, { type: "resolve_zord_setup", playerId, materialInstanceId: material });
    } else {
      r = applyAction(next, { type: "resolve_zord_setup", playerId });
    }
    if (!r.ok) return r;
    next = r.state;
  }
  for (let i = 0; i < 6; i += 1) {
    const pending = next.pendingCommandPayment;
    if (!pending || pending.playerId !== playerId) break;
    r = applyAction(next, {
      type: "resolve_command_payment",
      playerId,
      commandInstanceIds: pending.validInstanceIds.slice(0, pending.totalNeeded),
    });
    if (!r.ok) return r;
    next = r.state;
  }
  return { ok: true, state: next } as ReturnType<typeof applyAction>;
}

export function rush(
  state: GameState,
  playerId: PlayerId,
  unitInstanceId: string,
  material?: string,
): GameState {
  return unwrap(tryRush(state, playerId, unitInstanceId, material));
}

/**
 * バトルエリアへ出す（battle_entry のホールド支払いを試し、なければ move_to_battle）。
 */
export function tryEnterBattle(
  input: GameState,
  playerId: PlayerId,
  unitInstanceId: string,
): ReturnType<typeof applyAction> {
  const state = passEntry(input, playerId);
  const initiated = applyAction(state, {
    type: "initiate_command_payment",
    playerId,
    kind: "battle_entry",
    sourceInstanceId: unitInstanceId,
  });
  if (initiated.ok && initiated.state.pendingCommandPayment) {
    let next = initiated.state;
    for (let i = 0; i < 4; i += 1) {
      const pending = next.pendingCommandPayment;
      if (!pending || pending.playerId !== playerId) break;
      const r = applyAction(next, {
        type: "resolve_command_payment",
        playerId,
        commandInstanceIds: pending.validInstanceIds.slice(0, pending.totalNeeded),
      });
      if (!r.ok) return r;
      next = r.state;
    }
    return { ok: true, state: next } as ReturnType<typeof applyAction>;
  }
  return applyAction(state, { type: "move_to_battle", playerId, instanceId: unitInstanceId });
}

/**
 * 直前にバトルエリアに出たユニットの行動窓（pendingBattleEntry: そのままアタック／ストライク）を
 * 何もせずに閉じる（R-BA-01「なにもしない」）。
 */
export function passEntry(state: GameState, playerId: PlayerId = state.activePlayer): GameState {
  if (state.pendingBattleEntry?.playerId !== playerId) return state;
  if (state.pendingEffectChoice) return state;
  const pass = legal(state).find((a) => a.type === "pass_battle_entry" && a.playerId === playerId);
  return pass ? act(state, pass) : state;
}

export function enterBattle(state: GameState, playerId: PlayerId, unitInstanceId: string): GameState {
  return unwrap(tryEnterBattle(state, playerId, unitInstanceId));
}

/** バトル進入のために要求されるホールド枚数（不要なら 0、出られなければ null）。 */
export function battleEntryHoldsRequired(
  state: GameState,
  playerId: PlayerId,
  unitInstanceId: string,
): number | null {
  const initiated = applyAction(state, {
    type: "initiate_command_payment",
    playerId,
    kind: "battle_entry",
    sourceInstanceId: unitInstanceId,
  });
  if (initiated.ok && initiated.state.pendingCommandPayment) {
    return initiated.state.pendingCommandPayment.totalNeeded;
  }
  const direct = legal(state).some(
    (a) => a.type === "move_to_battle" && a.playerId === playerId && a.instanceId === unitInstanceId,
  );
  return direct ? 0 : null;
}

/** アタック（battle）を宣言する（反応窓は開いたまま返す）。 */
export function attack(
  state: GameState,
  playerId: PlayerId,
  attackerInstanceId: string,
  defenderInstanceId: string,
): GameState {
  return act(state, { type: "battle", playerId, attackerInstanceId, defenderInstanceId });
}

/** アタックを宣言し、開いた反応窓をすべてパスしてバトルを解決する。 */
export function attackAndResolve(
  state: GameState,
  playerId: PlayerId,
  attackerInstanceId: string,
  defenderInstanceId: string,
): GameState {
  return passReactions(attack(state, playerId, attackerInstanceId, defenderInstanceId));
}

/**
 * 効果によるコマンドのホールド選択（kind: "effect_hold"）を、有効なコマンドの先頭から解決する。
 * playerId を指定するとそのプレイヤーの選択だけを進める。
 */
export function resolveEffectHolds(state: GameState, playerId?: PlayerId): GameState {
  let s = state;
  for (let i = 0; i < 8; i += 1) {
    const pending = s.pendingCommandPayment;
    if (pending && pending.kind === "effect_hold" && (!playerId || pending.playerId === playerId)) {
      s = act(s, {
        type: "resolve_command_payment",
        playerId: pending.playerId,
        commandInstanceIds: pending.validInstanceIds.slice(0, pending.totalNeeded),
      });
      continue;
    }
    const start = legal(s).find(
      (a) =>
        a.type === "initiate_command_payment" &&
        a.kind === "effect_hold" &&
        (!playerId || a.playerId === playerId),
    );
    if (!start) break;
    s = act(s, start);
  }
  return s;
}
