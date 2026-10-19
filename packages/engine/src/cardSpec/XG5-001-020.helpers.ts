/**
 * cardSpec XG5-001〜XG5-020（クロスギャザー XG5 ザ・チケットブレイカー ゴーグルレッド〜ボウケンレッド）用ヘルパー。
 * BK1-001-019.helpers.ts（RS・RK・RM・BK のヘルパーを含む）をそのまま再エクスポートし、リード・スクラム・コマンドゾーンの効果の確認用の小さな手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { act, attackTargets, deckCards, inst, legal, st, tryAct } from "./BK1-001-019.helpers";

export * from "./BK1-001-019.helpers";

/**
 * 手札のオペレーション（またはカウンター）の使用を始めたとき、コマンドの支払いに選べるカード（pendingCommandPayment.validInstanceIds）。
 * 使用を始められなければ undefined。リードを持つユニットが支払いに選べるかの確認用（rulesSpec/07-call-read の payableFor と同じ考え方）。
 */
export function payableFor(s: GameState, sourceInstanceId: string, playerId: PlayerId = "player1"): string[] | undefined {
  const start = legal(s).find(
    (a) => a.type === "initiate_command_payment" && a.playerId === playerId && "sourceInstanceId" in a && a.sourceInstanceId === sourceInstanceId,
  );
  if (!start) return undefined;
  const r = tryAct(s, start);
  if (!r.ok) return undefined;
  return [...(r.state.pendingCommandPayment?.validInstanceIds ?? [])].sort();
}

/**
 * 敵軍（player2）のバトルフェイズに、player2 の TST-UNIT-7（BP13000）がアタックできる player1 のユニット。
 * battle は player1 のバトルエリア（並び順のまま）、rush は player1 のラッシュエリア。
 */
export function enemyAttackTargets(
  p1: Partial<GameState["players"]["player1"]>,
  extra: CardDefinition[] = [],
  p2: Partial<GameState["players"]["player2"]> = {},
): string[] {
  const s = st(
    {
      activePlayer: "player2",
      player1: { deck: deckCards(5), ...p1 },
      player2: { deck: deckCards(5, "e"), ...p2, battle: [inst("TST-UNIT-7", "atk"), ...(p2.battle ?? [])] },
    },
    extra,
  );
  return attackTargets(s, "TST-UNIT-7:atk", "player2").sort();
}

/** 場のユニットを効果で動かさずに、ターンを1つ進める（反応・任意の選択は見送る）ときの、スタート〜バトルフェイズの手順。 */
export function passTurnTo(s: GameState, playerId: PlayerId, phase: GameState["phase"]): GameState {
  let n = s;
  const order = [
    "pass_register",
    "pass_leave_reaction",
    "pass_rush_reaction",
    "pass_battle_reaction",
    "pass_strike_reaction",
    "pass_morph_reaction",
    "skip_effect_choice",
    "release_start_commands",
    "return_all_battle_to_rush",
    "draw",
    "skip_bonus_draw",
    "pass_battle_entry",
    "end_phase",
  ];
  for (let i = 0; i < 60; i++) {
    if (n.activePlayer === playerId && n.phase === phase && !n.pendingEffectChoice) return n;
    const acts = legal(n);
    const a = order.map((t) => acts.find((x) => x.type === t)).find(Boolean);
    if (!a) throw new Error(`passTurnTo: stuck; legal=${acts.map((x) => x.type).join(",")}`);
    n = act(n, a);
  }
  throw new Error("passTurnTo: step limit");
}

/** コマンドゾーンのカードの状態（"held" / "released"。なければ undefined）。 */
export function commandState(s: GameState, playerId: PlayerId, instanceId: string): "held" | "released" | undefined {
  const c = s.players[playerId].command.find((x) => x.instanceId === instanceId);
  if (!c) return undefined;
  return c.commandHeld ? "held" : "released";
}

/** 同じカードの CardInstance（ホールド状態）。 */
export function heldCard(cardId: string, suffix: string): CardInstance {
  return { ...inst(cardId, suffix), commandHeld: true };
}
