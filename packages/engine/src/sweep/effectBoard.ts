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
import { COMMAND_ZONE_MAX, type CardInstance, type GameState, type PlayerId } from "../types/game";
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
/** 盤面に置くカード（instanceId は「カードID~通し番号」）。 */
export const mk = (cardId: string, extra: Partial<CardInstance> = {}): CardInstance => ({ instanceId: `${cardId}~${seq++}`, cardId, ...extra });
const units = all.filter((d) => real(d) && d.type === "unit");
const sUnitWithBp = (bp: number) => plainUnits.find((d) => d.bp === bp) ?? units.find((d) => d.size === "S" && d.bp === bp)!;
const sUnitWithFeature = (f: string) => units.find((d) => d.size === "S" && (d.features ?? []).includes(f))!;
const firstOfSize = (size: string) => units.find((d) => d.size === size)!;
const mixedCards = (n: number, offset: number) =>
  Array.from({ length: n }, (_, i) =>
    mk((i % 3 === 2 ? plainOperations[(i + offset) % plainOperations.length]! : units[(i * 37 + offset) % units.length]!).id),
  );

/**
 * 空いたコマンドゾーンを何で埋めるか。categories: カテゴリが重ならないオペレーション（オペレーションの支払い用）。
 * variety: リリース状態の M ユニットのカード・OT 2 枚・ホールド状態のオペレーション等（「リリース状態の M ユニットのカード」
 * 「OT の自軍コマンドを 2 つ」「自軍コマンドをリリース状態に戻す」等の対象）。
 */
export type CommandFill = "categories" | "variety";

function ownFill(fill: CommandFill): CardInstance[] {
  const op = (c: string, nth = 0) => plainOperations.filter((d) => d.category === c)[nth]!;
  const released = (d: CardDefinition) => mk(d.id, { commandHeld: false });
  const categories = ["WB", "MA", "OT", "ET", "DA"].map((c) => released(op(c)));
  if (fill === "categories") return categories;
  return [released(firstOfSize("M")), released(op("OT")), released(op("OT", 1)), mk(op("WB", 1).id, { commandHeld: true }), ...categories];
}

/** 両軍に、効果の対象になりやすいカードを一通り足す。 */
export function enrichBoard(s: GameState, fill: CommandFill = "categories"): GameState {
  const p1 = s.players.player1;
  const p2 = s.players.player2;
  const released = (d: CardDefinition) => mk(d.id, { commandHeld: false });
  // コマンドゾーンは 5 枚まで（R-ZONE-08）。超えた盤面では「ホールドする」等が置き場所を失って捨札になった。
  const ownCommands = ownFill(fill)
    .filter((c) => !p1.command.some((x) => x.cardId === c.cardId))
    .slice(0, Math.max(0, COMMAND_ZONE_MAX - p1.command.length));
  // ホールド状態のユニット（「ホールド状態のユニットを撃破する」等の対象）も置く
  const enemyBattle = [1000, 1500, 3000, 4500, 5000, 8000].map((bp) => mk(sUnitWithBp(bp).id, bp === 4500 ? { commandHeld: true } : {}));
  // M は特徴「メカ」（「特徴「メカ」を持つ敵軍Mユニット」の対象）
  enemyBattle.push(mk((units.find((d) => d.size === "M" && (d.features ?? []).includes("メカ")) ?? firstOfSize("M")).id), mk(firstOfSize("L").id));
  // コマンドゾーンは 1 枚空けておく（「持ち主のコマンドゾーンに置く」の置き場所）
  const enemyCommands = [...plainOperations.slice(0, 2), firstOfSize("S")].map(released);
  enemyCommands.push(mk(plainOperations[4]!.id, { commandHeld: true }));
  return {
    ...s,
    players: {
      player1: {
        ...p1,
        command: [...p1.command, ...ownCommands],
        battle: [...p1.battle, mk(sUnitWithBp(3000).id), mk(sUnitWithBp(5000).id)],
        // 「女」はホールド状態（「ホールド状態の自軍ユニット」「リリースする」等の対象）
        rush: [...p1.rush, ...["メカ", "恐竜", "男", "女"].map((f) => mk(sUnitWithFeature(f).id, f === "女" ? { commandHeld: true } : {}))],
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

/** 支払い・追加条件の素材を指すアクションのキー（効果の対象を指す targetInstanceId 等は入れない）。 */
const PAYMENT_KEYS = /^(sourceInstanceId|substituteInstanceId|commandInstanceIds|instanceIds|materialInstanceIds|zord\w*|extraHold\w*|holdInstanceIds)$/;

export type DriveResult = EffectOutcome & {
  state?: GameState;
  start?: GameState;
  excluded?: Set<string>;
  source?: string;
  /** branch を指定したとき、分けた選択の候補の数（その選択が出なければ 0）と、選んだ手。 */
  branches?: number;
  picked?: GameAction;
  /** 分けた選択が出たときの盤面（分岐ごとの動きはここから比べる）。 */
  branchState?: GameState;
  /** そのカードの効果の選択が最初に出たときの盤面（支払いで動かしたカードを効果が選ぶこともあるので、ここからも比べる）。 */
  promptState?: GameState;
  /** そのカードの選択のどれかで、山札の全部（1枚以上）が候補か見るだけのカードに出た軍（「山札を見て」。sweep/deckLookAllCards.test.ts）。 */
  wholeDeckShown?: PlayerId[];
};

/** 選択の候補と見るだけのカードで、山札の全部が見えている軍（選ぶ人の山札だけを見る）。 */
export function wholeDeckShownTo(s: GameState): PlayerId | null {
  const c = s.pendingEffectChoice;
  if (!c || c.revealGate) return null;
  const shown = new Set([...c.validInstanceIds, ...(c.viewedInstanceIds ?? []), ...(c.deckLookInstanceIds ?? [])]);
  const deck = s.players[c.playerId].deck;
  return deck.length > 0 && deck.every((x) => shown.has(x.instanceId)) ? c.playerId : null;
}

/** 盤面を組んだ後に手を加える（条件を満たす／満たさない盤面）。 */
export type Tweak = (s: GameState) => GameState;
const same: Tweak = (s) => s;

/** そのカードの効果の、actor の最初の選択だけ、候補の index 番目を選ぶ（分岐の確認。残りは policy で選ぶ）。 */
export type Branch = { actor: "player1" | "player2"; index: number };

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
function drive(start: GameState, first: GameAction, card: CardInstance, policy: ChoicePolicy, branch?: Branch): DriveResult {
  // 使ったカード自身と、効果の前の支払い・追加条件で動かしたカードは、結果の確認で比べない。
  const excluded = new Set<string>([card.instanceId]);
  const exclude = (a: GameAction) => {
    for (const [k, v] of Object.entries(a)) {
      if (!PAYMENT_KEYS.test(k)) continue;
      for (const id of Array.isArray(v) ? v : [v]) if (typeof id === "string") excluded.add(id);
    }
  };
  exclude(first);
  const r0 = applyAction(start, first);
  if (!r0.ok) return { kind: "error", why: `${first.type} refused: ${r0.error}` };
  let s = r0.state!;
  let prompted = false;
  let branches: number | undefined = branch ? 0 : undefined;
  let picked: GameAction | undefined;
  let branchState: GameState | undefined;
  let promptState: GameState | undefined;
  const wholeDeckShown = new Set<PlayerId>();
  for (let step = 0; step < 80; step++) {
    const choice = s.pendingEffectChoice as { sourceCardId?: string; sourceInstanceId?: string; effectId?: string } | undefined;
    // 「…を捨札にしなければバトルエリアに出られない」の支払い（battle_entry_*）は効果ではない
    const ownChoice =
      !!choice &&
      (choice.sourceCardId === card.cardId || choice.sourceInstanceId === card.instanceId) &&
      !/^battle_entry/.test(choice.effectId ?? "");
    if (ownChoice && !prompted) promptState = s;
    if (ownChoice) prompted = true;
    const shownTo = ownChoice ? wholeDeckShownTo(s) : null;
    if (shownTo) wholeDeckShown.add(shownTo);
    const keys = pendingKeys(s);
    if (keys.length === 0) {
      const lines = s.log.filter((l) => l.includes(`|${card.cardId}|`) && !PLAIN_LOG.test(l));
      const kind = prompted ? "prompted" : lines.some((l) => /no_target/.test(l)) ? "no-target" : lines.length > 0 ? "logged" : "silent";
      return { kind, state: s, start, excluded, source: card.instanceId, branches, picked, branchState, promptState, wholeDeckShown: [...wholeDeckShown] };
    }
    const actor = getActionPlayerId(s);
    const actions = getLegalActions(s).filter((a) => a.playerId === actor && !NEVER_PICK.test(a.type));
    let next: GameAction | undefined;
    if (branch && branches === 0 && ownChoice && actor === branch.actor) {
      branches = actions.length;
      next = actions[branch.index];
      picked = next;
      branchState = s;
      if (!next) return { kind: "error", why: `branch ${branch.index} out of ${actions.length}` };
    } else {
      next = choose(s, actions, actor, policy);
    }
    if (!next) return { kind: "error", why: `stuck at ${keys.join(",")} (${actor} has no action)` };
    if (!prompted && (s.pendingCommandPayment || s.pendingZordSetup)) exclude(next);
    const r = applyAction(s, next);
    if (!r.ok) return { kind: "error", why: `${next.type} refused: ${r.error}` };
    s = r.state!;
  }
  return { kind: "error", why: "did not settle in 80 steps" };
}

function guarded(run: () => DriveResult): DriveResult {
  try {
    return run();
  } catch (e) {
    return { kind: "error", why: `throw: ${String(e).slice(0, 200)}` };
  }
}

/** ユニットを手札からラッシュする（「これをラッシュしたとき」）。 */
export function checkOnRush(unit: CardDefinition, policy: ChoicePolicy, branch?: Branch, tweak?: Tweak): DriveResult {
  return guarded(() => {
    const s = (tweak ?? same)(enrichBoard(buildRushBoard(unit, { commands: "operation", extraPower: 2, minimalCommands: true }), "variety"));
    const card = s.players.player1.hand[0]!;
    const first = getLegalActions(s).find(
      (a) => ("sourceInstanceId" in a && a.sourceInstanceId === card.instanceId) || ("zordInstanceId" in a && a.zordInstanceId === card.instanceId),
    );
    return first ? drive(s, first, card, policy, branch) : { kind: "not-offered" };
  });
}

/** 自軍バトルフェイズに、ラッシュエリアのユニットをバトルエリアに出す（「これがバトルエリアに出たとき」）。 */
export function checkEnterBattle(unit: CardDefinition, policy: ChoicePolicy, branch?: Branch, tweak?: Tweak): DriveResult {
  return guarded(() => {
    const b = buildRushBoard(unit, { commands: "operation", extraPower: 2 });
    const card = mk(unit.id);
    const s = (tweak ?? same)(enrichBoard({
      ...b,
      phase: "battle",
      players: {
        ...b.players,
        player1: { ...b.players.player1, command: [], hand: b.players.player1.hand.slice(1), rush: [card, ...b.players.player1.rush] },
      },
    }, "variety"));
    // 「コマンドを1つホールドしなければバトルエリアに出られない」ものは支払いから入る
    const first = getLegalActions(s).find(
      (a) =>
        (a.type === "move_to_battle" && a.instanceId === card.instanceId) ||
        (a.type === "initiate_command_payment" && a.sourceInstanceId === card.instanceId),
    );
    if (!first) return { kind: "not-offered" };
    // 「…を捨札にしなければ出られない」は、捨てるカードを選んだらそのままバトルエリアに出る
    return drive(s, first, card, policy, branch);
  });
}

/** 自軍ラッシュフェイズに、手札のオペレーションを使う（常駐は配置する）。 */
export function checkOperation(op: CardDefinition, policy: ChoicePolicy, branch?: Branch, tweak?: Tweak): DriveResult {
  return guarded(() => {
    const card = mk(op.id);
    const s = (tweak ?? same)(ownTurnBoard("rush", { hand: [card] }, costNumber(op.powerCost) + 3));
    const first = getLegalActions(s).find(
      (a) => a.playerId === "player1" && JSON.stringify(a).includes(`"${card.instanceId}"`),
    );
    if (!first) return { kind: "not-offered" };
    const out = drive(s, first, card, policy, branch);
    if (out.kind !== "error" && out.state?.players.player1.hand.some((c) => c.instanceId === card.instanceId)) {
      return { kind: "error", why: "the operation stayed in hand" };
    }
    return out;
  });
}

/** ラッシュエリア／バトルエリアのユニット・ビークルの起動効果を、ラッシュフェイズとバトルフェイズで全部試す。 */
export function checkActivations(card: CardDefinition, policy: ChoicePolicy, tweak?: Tweak): Array<{ where: string; outcome: DriveResult }> {
  const out: Array<{ where: string; outcome: DriveResult }> = [];
  for (const zone of ["rush", "battle"] as const) {
    for (const phase of ["rush", "battle"] as const) {
      const inst = mk(card.id);
      const s = (tweak ?? same)(ownTurnBoard(phase, { [zone]: [inst] }, 8));
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
