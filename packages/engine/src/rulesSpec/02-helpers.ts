/**
 * 02-zones-cards ルールスペック用ヘルパー。
 * 公開 API（createTestState / applyAction / getLegalActions）の薄いラッパーのみを置く。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import { allCardsCatalog } from "@rangers-strike/cards";
import { buildDefinitionMap } from "../core/catalog";
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import { legendDefinitions } from "../testing/battleEntry";
import { createTestState, inst } from "../testing/fixtures";
import type { TestStateOptions } from "../testing/fixtures";
import type { GameAction } from "../types/actions";
import type { CardInstance, GameState, PlayerId } from "../types/game";

export { inst };

/** テスト用の追加カード定義（実カードで表現しにくい性質だけを持つ）。 */
export const EXTRA_DEFS: Record<string, CardDefinition> = {
  "SPEC-S-WB": {
    id: "SPEC-S-WB",
    name: "スペックS",
    type: "unit",
    category: "WB",
    rarity: "N",
    expansion: "test",
    powerCost: 0,
    bp: 1000,
    sp: 1,
    size: "S",
  },
  "SPEC-S-ET-3": {
    id: "SPEC-S-ET-3",
    name: "スペックET3",
    type: "unit",
    category: "ET",
    rarity: "N",
    expansion: "test",
    powerCost: 3,
    bp: 3000,
    sp: 1,
    size: "S",
  },
  "SPEC-M-WB": {
    id: "SPEC-M-WB",
    name: "スペックM",
    type: "unit",
    category: "WB",
    rarity: "N",
    expansion: "test",
    powerCost: 0,
    bp: 4000,
    sp: 1,
    size: "M",
  },
  "SPEC-SC-WB": {
    id: "SPEC-SC-WB",
    name: "スペックSC",
    type: "unit",
    category: "WB",
    rarity: "N",
    expansion: "test",
    powerCost: 0,
    bp: 6000,
    sp: 1,
    size: "SC",
  },
  "SPEC-RESIST": {
    id: "SPEC-RESIST",
    name: "スペックレジスト",
    type: "unit",
    category: "WB",
    rarity: "N",
    expansion: "test",
    powerCost: 0,
    bp: 2000,
    sp: 1,
    size: "S",
    features: ["レジスト"],
  },
  "SPEC-S-WB-5": {
    id: "SPEC-S-WB-5",
    name: "スペックS5",
    type: "unit",
    category: "WB",
    rarity: "N",
    expansion: "test",
    powerCost: 5,
    bp: 3000,
    sp: 1,
    size: "S",
  },
  "SPEC-BIG": {
    id: "SPEC-BIG",
    name: "スペック必要パワー12",
    type: "unit",
    category: "WB",
    rarity: "N",
    expansion: "test",
    powerCost: 12,
    bp: 20000,
    sp: 1,
    size: "L",
  },
  "SPEC-VEHICLE-S": {
    id: "SPEC-VEHICLE-S",
    name: "スペックビークルS",
    type: "vehicle",
    category: "ET",
    rarity: "N",
    expansion: "test",
    powerCost: 0,
    size: "S",
    features: ["車両"],
  },
  "SPEC-VEHICLE-L": {
    id: "SPEC-VEHICLE-L",
    name: "スペックビークルL",
    type: "vehicle",
    category: "ET",
    rarity: "N",
    expansion: "test",
    powerCost: 0,
    size: "L",
  },
  "SPEC-RIDER": {
    id: "SPEC-RIDER",
    name: "スペックライダー",
    type: "unit",
    category: "ET",
    rarity: "N",
    expansion: "test",
    powerCost: 0,
    bp: 2000,
    sp: 1,
    size: "S",
    comboNumber: "RC",
    features: ["男"],
  },
};

export const DEFS: Record<string, CardDefinition> = {
  ...buildDefinitionMap([allCardsCatalog.cards]),
  ...legendDefinitions,
  ...EXTRA_DEFS,
};

export function st(options: TestStateOptions = {}): GameState {
  return createTestState({
    ...options,
    definitions: { ...DEFS, ...(options.definitions ?? {}) },
  });
}

/** n 枚のパワーカード（オモテ向き）。 */
export function powerCards(n: number, prefix = "p"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst("TST-P", `${prefix}${i}`));
}

/** 山札用のフィラー。 */
export function deckCards(n: number, prefix = "d"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst("TST-OP", `${prefix}${i}`));
}

export function unwrap(result: ReturnType<typeof applyAction>): GameState {
  if (!result.ok) throw new Error(`illegal action: ${result.error}`);
  return result.state;
}

export function legal(state: GameState): GameAction[] {
  return getLegalActions(state);
}

export function hasLegal(
  state: GameState,
  pred: (a: GameAction) => boolean,
): boolean {
  return legal(state).some(pred);
}

/** 手札からの通常ラッシュ: カテゴリ支払い（コマンドのホールド）→ラッシュ。 */
export function payAndRush(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  commandInstanceIds: string[],
  extra: Partial<Extract<GameAction, { type: "initiate_command_payment" }>> = {},
): ReturnType<typeof applyAction> {
  const initiated = applyAction(state, {
    type: "initiate_command_payment",
    playerId,
    kind: "category_use",
    sourceInstanceId: instanceId,
    ...extra,
  });
  if (!initiated.ok) return initiated;
  return applyAction(initiated.state, {
    type: "resolve_command_payment",
    playerId,
    commandInstanceIds,
  });
}

/** 手札からの通常オペレーション使用: カテゴリ支払い→使用。 */
export function payAndPlayOperation(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  commandInstanceIds: string[],
  targetInstanceId?: string,
): ReturnType<typeof applyAction> {
  return payAndRush(state, playerId, instanceId, commandInstanceIds, { targetInstanceId });
}

export function zoneOf(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): string | null {
  const p = state.players[playerId] as unknown as Record<string, unknown>;
  for (const zone of [
    "deck",
    "hand",
    "discard",
    "power",
    "command",
    "rush",
    "battle",
    "operation",
    "exile",
    "commander",
  ]) {
    const cards = p[zone] as CardInstance[] | undefined;
    if (cards?.some((c) => c.instanceId === instanceId)) return zone;
  }
  return null;
}

export function cardIn(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): CardInstance | undefined {
  const p = state.players[playerId] as unknown as Record<string, unknown>;
  for (const zone of Object.keys(p)) {
    const cards = p[zone];
    if (!Array.isArray(cards)) continue;
    const found = (cards as CardInstance[]).find((c) => c?.instanceId === instanceId);
    if (found) return found;
  }
  return undefined;
}

type ZordOpts = {
  zordMaterialInstanceId?: string;
  zordMaterialDestination?: "command" | "discard";
  zordMothershipHoldInstanceIds?: string[];
};

/**
 * 追加条件（ゾードアップ素材）付きのラッシュ: begin_zord_setup → 行き先/素材の選択 → コマンド支払い。
 * 素材指定がなければ通常のカテゴリ支払いラッシュ。
 */
export function zordRush(
  state: GameState,
  playerId: PlayerId,
  unitInstanceId: string,
  commandInstanceId: string,
  zord: ZordOpts = {},
): ReturnType<typeof applyAction> {
  if (!zord.zordMaterialInstanceId) {
    return payAndRush(state, playerId, unitInstanceId, [commandInstanceId]);
  }
  let r = applyAction(state, { type: "begin_zord_setup", playerId, zordInstanceId: unitInstanceId });
  if (!r.ok) {
    // ゾードダウン等、セットアップ手順を持たない追加条件は支払い開始時に素材を指定する
    return payAndRush(state, playerId, unitInstanceId, [commandInstanceId], {
      zordMaterialInstanceId: zord.zordMaterialInstanceId,
      zordMaterialDestination: zord.zordMaterialDestination,
    });
  }
  if (r.state.pendingZordSetup?.step === "destination") {
    r = applyAction(r.state, {
      type: "resolve_zord_setup",
      playerId,
      destination: zord.zordMaterialDestination ?? "discard",
    });
    if (!r.ok) return r;
  }
  if (r.state.pendingZordSetup) {
    r = applyAction(r.state, {
      type: "resolve_zord_setup",
      playerId,
      materialInstanceId: zord.zordMaterialInstanceId,
    });
    if (!r.ok) return r;
  }
  for (let i = 0; i < 4 && r.ok && r.state.pendingCommandPayment?.playerId === playerId; i += 1) {
    r = applyAction(r.state, { type: "resolve_command_payment", playerId, commandInstanceIds: [commandInstanceId] });
  }
  return r;
}

/** 母艦（ジャガーバルカン等）経路でのゾードアップラッシュ。holdQueue の順にコマンド支払いへ充てる。 */
export function mothershipRush(
  state: GameState,
  playerId: PlayerId,
  unitInstanceId: string,
  holdQueue: string[],
): ReturnType<typeof applyAction> {
  let r = applyAction(state, { type: "begin_zord_setup", playerId, zordInstanceId: unitInstanceId });
  if (!r.ok) return r;
  r = applyAction(r.state, { type: "resolve_zord_setup", playerId, paymentPath: "mothership" });
  if (!r.ok) return r;
  if (r.state.pendingZordSetup) {
    r = applyAction(r.state, { type: "resolve_zord_setup", playerId });
    if (!r.ok) return r;
  }
  const queue = [...holdQueue];
  for (let i = 0; i < 4 && r.ok && r.state.pendingCommandPayment; i += 1) {
    const need = r.state.pendingCommandPayment.totalNeeded;
    const ids = queue.splice(0, need);
    r = applyAction(r.state, { type: "resolve_command_payment", playerId, commandInstanceIds: ids });
  }
  return r;
}

/** RS-013 シーロンの光: 発動→相手が手札から1枚選ぶ→公開確認。 */
export function shironReveal(
  state: GameState,
  playerId: PlayerId,
  operationInstanceId: string,
  pickedHandInstanceId: string,
): GameState {
  const opp: PlayerId = playerId === "player1" ? "player2" : "player1";
  let s = unwrap(applyAction(state, { type: "shiron_light", playerId, operationInstanceId }));
  s = unwrap(applyAction(s, { type: "resolve_effect_choice", playerId: opp, instanceId: pickedHandInstanceId }));
  s = unwrap(applyAction(s, { type: "confirm_shiron_reveal", playerId: opp }));
  return s;
}

/**
 * 公開アクションだけでゲームを進める（パス・フェイズ終了・必須ドロー等を優先順に選ぶ）。
 * stop が true を返した時点の状態を返す。
 */
export function advanceUntil(
  state: GameState,
  stop: (s: GameState) => boolean,
  maxSteps = 60,
): GameState {
  const order = [
    "pass_register",
    "pass_leave_reaction",
    "pass_rush_reaction",
    "pass_battle_reaction",
    "pass_strike_reaction",
    "pass_battle_entry",
    "return_all_battle_to_rush",
    "draw",
    "skip_bonus_draw",
    "release_start_commands",
    "end_phase",
    // 「可能ならバトルエリアに出る」等でフェイズを終えられないときのみ
    "move_to_battle",
  ];
  let s = state;
  for (let i = 0; i < maxSteps; i += 1) {
    if (stop(s)) return s;
    const acts = legal(s);
    const next = order.map((t) => acts.find((a) => a.type === t)).find(Boolean);
    if (!next) throw new Error(`advanceUntil: no progress action in ${JSON.stringify(acts)}`);
    s = unwrap(applyAction(s, next));
  }
  throw new Error("advanceUntil: step limit");
}

/**
 * 効果ラッシュ（ランドバルカン等「出してもよい」）で、出せる候補を順にすべて選んで出す。
 * 任意効果なので候補が上限以下でも選択が開く（atwiki/page-249、grnrngr/faq-card-1 RS-005 Q1）。
 */
export function pickAllEffectRushCandidates(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < 10 && s.pendingEffectChoice?.effectId === "effect_rush_pick"; i += 1) {
    const choice = s.pendingEffectChoice;
    const id = choice.validInstanceIds[0];
    if (!id) break;
    const r = applyAction(s, { type: "resolve_effect_choice", playerId: choice.playerId, instanceId: id });
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  return s;
}
