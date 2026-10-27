/**
 * 全カードの効果の発動確認（effectsAllCards.test.ts）の盤面づくりと進め方。
 *
 * 効果の対象になりやすいものを両軍に一通り置いた盤面（いろいろな BP・大きさのユニット、
 * リリース／ホールドのコマンド、オモテ向きのパワー、手札・山札・捨札）でカードを使い、
 * 合法手だけで選択を進める。発動したかは、そのカードの選択が出たか、ログにそのカードの
 * 効果の行が残ったかで見る（状態の比較はしない）。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import { getActionPlayerId, getLegalActions } from "../core/legalActions";
import { applyAction } from "../core/applyAction";
import type { CardInstance, GameState } from "../types/game";
import type { GameAction } from "../types/actions";
import { all, base, buildRushBoard, plainOperations, plainUnits, real } from "./rushBoard";

/** 選択で自分（player1）がどれを選ぶか。相手は常にパス・見送りを選ぶ。 */
export type ChoicePolicy = "first" | "last" | "decline";

/**
 * prompted: そのカードの選択が出た／logged: ログにそのカードの効果の行がある／no-target: 発動したが対象が無かった（ログの no_targets）／
 * silent: どれも無い／not-offered: 使う・出す手が合法手に無い／error: 途中で止まった・断られた。
 */
export type EffectOutcome =
  | { kind: "prompted" | "logged" | "no-target" | "silent" | "not-offered" }
  | { kind: "error"; why: string };

let seq = 0;
const mk = (cardId: string, extra: Partial<CardInstance> = {}): CardInstance => ({ instanceId: `${cardId}~${seq++}`, cardId, ...extra });
const units = all.filter((d) => real(d) && d.type === "unit");
const sUnitWithBp = (bp: number) => plainUnits.find((d) => d.bp === bp) ?? units.find((d) => d.size === "S" && d.bp === bp)!;
const sUnitWithFeature = (f: string) => units.find((d) => d.size === "S" && (d.features ?? []).includes(f))!;
const firstOfSize = (size: string) => units.find((d) => d.size === size)!;
const mixedCards = (n: number, offset: number) =>
  Array.from({ length: n }, (_, i) =>
    mk((i % 3 === 2 ? plainOperations[(i + offset) % plainOperations.length]! : units[(i * 37 + offset) % units.length]!).id),
  );

/** 両軍に、効果の対象になりやすいカードを一通り足す。 */
export function enrichBoard(s: GameState): GameState {
  const p1 = s.players.player1;
  const p2 = s.players.player2;
  const released = (d: CardDefinition) => mk(d.id, { commandHeld: false });
  const ownCommands = [
    ...["WB", "MA", "OT", "ET", "DA"].flatMap((c) => plainOperations.filter((d) => d.category === c).slice(0, 2)).map(released),
    released(firstOfSize("M")),
    mk(plainOperations[7]!.id, { commandHeld: true }),
  ];
  const enemyBattle = [1000, 1500, 3000, 4500, 5000, 8000].map((bp) => mk(sUnitWithBp(bp).id));
  enemyBattle.push(mk(firstOfSize("M").id), mk(firstOfSize("L").id));
  const enemyCommands = [...plainOperations.slice(0, 3), firstOfSize("S"), firstOfSize("M")].map(released);
  enemyCommands.push(mk(plainOperations[4]!.id, { commandHeld: true }));
  return {
    ...s,
    players: {
      player1: {
        ...p1,
        command: [...p1.command, ...ownCommands],
        battle: [...p1.battle, mk(sUnitWithBp(3000).id), mk(sUnitWithBp(5000).id)],
        rush: [...p1.rush, ...["メカ", "恐竜", "男", "女"].map((f) => mk(sUnitWithFeature(f).id))],
        hand: [...p1.hand, ...mixedCards(3, 3)],
        deck: mixedCards(20, 1),
        discard: [...p1.discard, ...mixedCards(6, 2)],
      },
      player2: {
        ...p2,
        battle: [...p2.battle, ...enemyBattle],
        rush: [sUnitWithBp(2000), sUnitWithFeature("メカ"), sUnitWithFeature("女")].map((d) => mk(d.id)),
        command: enemyCommands,
        power: plainUnits.slice(5, 9).map((d) => mk(d.id, { faceDown: false })),
        hand: mixedCards(4, 4),
        deck: mixedCards(20, 5),
        discard: mixedCards(5, 6),
      },
    },
  };
}

/** 自軍ターン・チャージ済みの空の盤面に player1 の各ゾーンを置き、enrichBoard する。 */
function ownTurnBoard(phase: GameState["phase"], zones: Partial<GameState["players"]["player1"]>, powerCount: number): GameState {
  const p1 = base.players.player1;
  return enrichBoard({
    ...base,
    turn: 5,
    phase,
    activePlayer: "player1",
    log: [],
    players: {
      ...base.players,
      player1: {
        ...p1,
        hand: [],
        power: Array.from({ length: powerCount }, (_, i) => mk(plainUnits[i % plainUnits.length]!.id, { faceDown: false })),
        command: [],
        rush: [],
        battle: [],
        discard: [],
        operation: [],
        exile: [],
        hasChargedThisTurn: true,
        ...zones,
      },
    },
  });
}

const costNumber = (cost: unknown) => Number(/\d+/.exec(String(cost ?? 0))?.[0] ?? 0);
const NEVER_PICK = /cancel|end_phase|end_turn/;
const DECLINE = /^skip_|^pass_|decline/;
const PLAIN_LOG = /^player\d\|(rush|move_to_battle|zord_setup_pending|command_payment_pending|pass_battle_entry|end_phase)\b/;

function pendingKeys(s: GameState): string[] {
  return Object.entries(s)
    .filter(([k, v]) => k.startsWith("pending") && v != null && !(Array.isArray(v) && v.length === 0))
    .map(([k]) => k);
}

function choose(s: GameState, actions: GameAction[], actor: string, policy: ChoicePolicy): GameAction | undefined {
  if (actor === "player2") return actions.find((a) => DECLINE.test(a.type)) ?? actions[0];
  // バトルエリアに出たときの「アタック／ストライク／何もしない」は何もしない
  if (s.pendingBattleEntry) return actions.find((a) => a.type === "pass_battle_entry") ?? actions[0];
  const use = actions.filter((a) => !DECLINE.test(a.type));
  if (policy === "decline") return actions.find((a) => /^skip_effect/.test(a.type)) ?? use[0] ?? actions[0];
  if (policy === "last") return use[use.length - 1] ?? actions[actions.length - 1];
  return use[0] ?? actions[0];
}

/** first を適用し、保留中の選択・支払い・反応が無くなるまで合法手で進める。 */
function drive(start: GameState, first: GameAction, card: CardInstance, policy: ChoicePolicy): EffectOutcome & { state?: GameState } {
  const r0 = applyAction(start, first);
  if (!r0.ok) return { kind: "error", why: `${first.type} refused: ${r0.error}` };
  let s = r0.state!;
  let prompted = false;
  for (let step = 0; step < 80; step++) {
    const choice = s.pendingEffectChoice as { sourceCardId?: string; sourceInstanceId?: string } | undefined;
    if (choice && (choice.sourceCardId === card.cardId || choice.sourceInstanceId === card.instanceId)) prompted = true;
    const keys = pendingKeys(s);
    if (keys.length === 0) {
      const lines = s.log.filter((l) => l.includes(`|${card.cardId}|`) && !PLAIN_LOG.test(l));
      const kind = prompted ? "prompted" : lines.some((l) => /no_target/.test(l)) ? "no-target" : lines.length > 0 ? "logged" : "silent";
      return { kind, state: s };
    }
    const actor = getActionPlayerId(s);
    const actions = getLegalActions(s).filter((a) => a.playerId === actor && !NEVER_PICK.test(a.type));
    const next = choose(s, actions, actor, policy);
    if (!next) return { kind: "error", why: `stuck at ${keys.join(",")} (${actor} has no action)` };
    const r = applyAction(s, next);
    if (!r.ok) return { kind: "error", why: `${next.type} refused: ${r.error}` };
    s = r.state!;
  }
  return { kind: "error", why: "did not settle in 80 steps" };
}

function guarded(run: () => EffectOutcome): EffectOutcome {
  try {
    return run();
  } catch (e) {
    return { kind: "error", why: `throw: ${String(e).slice(0, 200)}` };
  }
}

/** ユニットを手札からラッシュする（「これをラッシュしたとき」）。 */
export function checkOnRush(unit: CardDefinition, policy: ChoicePolicy): EffectOutcome {
  return guarded(() => {
    const s = enrichBoard(buildRushBoard(unit, { commands: "operation", extraPower: 2 }));
    const card = s.players.player1.hand[0]!;
    const first = getLegalActions(s).find(
      (a) => ("sourceInstanceId" in a && a.sourceInstanceId === card.instanceId) || ("zordInstanceId" in a && a.zordInstanceId === card.instanceId),
    );
    return first ? drive(s, first, card, policy) : { kind: "not-offered" };
  });
}

/** 自軍バトルフェイズに、ラッシュエリアのユニットをバトルエリアに出す（「これがバトルエリアに出たとき」）。 */
export function checkEnterBattle(unit: CardDefinition, policy: ChoicePolicy): EffectOutcome {
  return guarded(() => {
    const b = buildRushBoard(unit, { commands: "operation", extraPower: 2 });
    const card = mk(unit.id);
    const s = enrichBoard({
      ...b,
      phase: "battle",
      players: { ...b.players, player1: { ...b.players.player1, hand: b.players.player1.hand.slice(1), rush: [card, ...b.players.player1.rush] } },
    });
    // 「コマンドを1つホールドしなければバトルエリアに出られない」ものは支払いから入る
    const first = getLegalActions(s).find(
      (a) =>
        (a.type === "move_to_battle" && a.instanceId === card.instanceId) ||
        (a.type === "initiate_command_payment" && a.sourceInstanceId === card.instanceId),
    );
    return first ? drive(s, first, card, policy) : { kind: "not-offered" };
  });
}

/** 自軍ラッシュフェイズに、手札のオペレーションを使う（常駐は配置する）。 */
export function checkOperation(op: CardDefinition, policy: ChoicePolicy): EffectOutcome {
  return guarded(() => {
    const card = mk(op.id);
    const s = ownTurnBoard("rush", { hand: [card] }, costNumber(op.powerCost) + 3);
    const first = getLegalActions(s).find(
      (a) => a.playerId === "player1" && JSON.stringify(a).includes(`"${card.instanceId}"`),
    );
    if (!first) return { kind: "not-offered" };
    const out = drive(s, first, card, policy);
    if (out.kind !== "error" && out.state?.players.player1.hand.some((c) => c.instanceId === card.instanceId)) {
      return { kind: "error", why: "the operation stayed in hand" };
    }
    return out;
  });
}

/** ラッシュエリア／バトルエリアのユニット・ビークルの起動効果を、ラッシュフェイズとバトルフェイズで全部試す。 */
export function checkActivations(card: CardDefinition, policy: ChoicePolicy): Array<{ where: string; outcome: EffectOutcome }> {
  const out: Array<{ where: string; outcome: EffectOutcome }> = [];
  for (const zone of ["rush", "battle"] as const) {
    for (const phase of ["rush", "battle"] as const) {
      const inst = mk(card.id);
      const s = ownTurnBoard(phase, { [zone]: [inst] }, 8);
      for (const a of getLegalActions(s)) {
        if (a.type !== "activate_field_unit_ability" || a.unitInstanceId !== inst.instanceId) continue;
        out.push({ where: `${zone}/${phase}`, outcome: guarded(() => drive(s, a, inst, policy)) });
      }
    }
  }
  return out;
}

/** 本文から「これをラッシュしたとき」「これがバトルエリアに出たとき」を持つか。 */
export function hasOnRushTrigger(card: CardDefinition): boolean {
  return /(これ|このユニット)をラッシュした(とき|時)/.test((card.text ?? "").normalize("NFKC"));
}
export function hasEnterBattleTrigger(card: CardDefinition): boolean {
  return /(これ|このユニット)がバトルエリアに出(た|る)(とき|時)/.test((card.text ?? "").normalize("NFKC"));
}

export const allEffectUnits: CardDefinition[] = units;
export const allOperations: CardDefinition[] = all.filter((d) => real(d) && d.type === "operation");
export const allFieldCards: CardDefinition[] = all.filter((d) => real(d) && (d.type === "unit" || d.type === "vehicle"));
