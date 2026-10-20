/**
 * カード別スペック: RS-194〜RS-200（第4弾「四雄の覚醒」ダイナロボ／帝王アトン／バイオマン）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-4（RS-194・RS-196・RS-197 の Q）
 *     ほか card_1（RS-194 Q1）・card_2（RS-197 Q2）・card_3（RS-194 Q2）・card_5（RS-196 Q1、ダイナロボとグリーンサイの Q）・card_6（RS-199 の Q）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  canEnter,
  canStartRush,
  canStrike,
  choiceIds,
  damagedPower,
  declineEffect,
  deckCards,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  held,
  inst,
  legalOfType,
  lineUp,
  pickEffect,
  powerCards,
  released,
  releasedN,
  rushFromHand,
  settle,
  st,
  strike,
  sUnit,
  tryAct,
  zoneOf,
} from "./RS4-179-200.helpers";
import type { CardInstance, GameState, PlayerId } from "../types/game";

const fillIds = (n: number) => Array.from({ length: n }, (_, i) => `TST-UNIT-0:fill${i}`);

function atPosition(
  unit: CardInstance,
  before: number,
  p2: Partial<GameState["players"]["player2"]> = {},
  p1: Partial<GameState["players"]["player1"]> = {},
): GameState {
  let s = st({
    turn: 3,
    player1: { rush: [...fillers(before), unit], deck: deckCards(5), ...p1 },
    player2: { deck: deckCards(5, "e"), ...p2 },
  });
  s = lineUp(s, fillIds(before));
  return enter(s, unit.instanceId);
}

/**
 * ゾード（追加条件）手順を、素材ごとに行き先を指定して進めるラッシュ。
 * dests[i] は i 番目に選ぶ素材の行き先。
 */
function rushWithDests(
  s: GameState,
  playerId: PlayerId,
  instanceId: string,
  materials: string[],
  dests: ("command" | "discard")[],
): { ok: boolean; state: GameState; error?: string } {
  let r = tryAct(s, { type: "begin_zord_setup", playerId, zordInstanceId: instanceId });
  if (!r.ok) return r;
  let mi = 0;
  let di = 0;
  for (let i = 0; i < 16 && r.ok && r.state.pendingZordSetup; i++) {
    const setup = r.state.pendingZordSetup;
    if (setup.step === "destination") {
      r = tryAct(r.state, { type: "resolve_zord_setup", playerId, destination: dests[di++] ?? "discard" });
    } else if (setup.step === "material") {
      const pick = materials[mi++] ?? setup.validInstanceIds[0];
      r = tryAct(r.state, { type: "resolve_zord_setup", playerId, materialInstanceId: pick });
    } else {
      r = tryAct(r.state, { type: "resolve_zord_setup", playerId });
    }
  }
  if (!r.ok) return r;
  let next = r.state;
  for (let i = 0; i < 4 && next.pendingCommandPayment?.playerId === playerId; i++) {
    const p = next.pendingCommandPayment;
    const rr = tryAct(next, { type: "resolve_command_payment", playerId, commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded) });
    if (!rr.ok) return rr;
    next = rr.state;
  }
  for (let i = 0; i < 4 && next.pendingRush; i++) {
    const rr = tryAct(next, { type: "pass_rush_reaction", playerId: next.pendingRush.rusherPlayerId === "player1" ? "player2" : "player1" });
    if (!rr.ok) break;
    next = rr.state;
  }
  return { ok: true, state: next };
}

// ===========================================================================
describe("RS-194 ダイナロボ", () => {
  const TEXT =
    "合体―ダイナマッハ＋ダイナモビル＋ダイナギャリー【ビートハンマー】自軍ターン中、これがバトルエリアに出たとき、敵軍コマンドゾーンからユニットのカードを1枚選び、敵軍バトルエリアに出す。このとき出したユニットの効果は発動しない。";

  /** 自軍バトルフェイズにダイナロボをバトルエリアに出した直後。 */
  function robo(p2: Partial<GameState["players"]["player2"]>, p1: Partial<GameState["players"]["player1"]> = {}): GameState {
    let s = st({
      turn: 3,
      player1: { rush: [inst("RS-194", "robo")], deck: deckCards(5), ...p1 },
      player2: { deck: deckCards(5, "e"), power: powerCards(3, "ep"), ...p2 },
    });
    s = enter(s, "RS-194:robo");
    return s;
  }

  it("RS-194: カタログ本文・スペックが出典と一致（出典: atwiki/page-396）", () => {
    expectCatalogText("RS-194", TEXT);
    expectStats("RS-194", {
      name: "ダイナロボ",
      category: "ET",
      size: "L",
      bp: 8000,
      sp: 2,
      powerCost: "5+",
      features: ["メカ", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  // 「合体―ダイナマッハ＋ダイナモビル＋ダイナギャリー」「追加条件：自軍合体ユニットを捨札にする」
  it("RS-194: 合体ユニット3体（マッハ・モビル・ギャリー）を捨札にしてラッシュでき、2体では満たせない（出典: atwiki/page-396・R-ADD-06）", () => {
    const parts = [inst("RS-195", "mach"), inst("RS-196", "mob"), inst("RS-197", "gal")];
    const mk = (rush: CardInstance[]) =>
      st({ phase: "rush", turn: 3, player1: { hand: [inst("RS-194", "robo")], rush, command: releasedN(1, "TST-OP-ET"), power: powerCards(5) } });
    expect(canStartRush(mk(parts.slice(0, 2)), "player1", "RS-194:robo")).toBe(false);
    const r = rushFromHand(mk(parts), "player1", "RS-194:robo");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-194:robo")).toBe("rush");
    expect(r.state.players.player1.discard.map((c) => c.cardId).sort()).toEqual(["RS-195", "RS-196", "RS-197"]);
  });

  it("RS-194: 必要パワー5+ — パワー4枚ではラッシュできない（出典: atwiki/page-396）", () => {
    const parts = [inst("RS-195", "mach"), inst("RS-196", "mob"), inst("RS-197", "gal")];
    const s = st({ phase: "rush", turn: 3, player1: { hand: [inst("RS-194", "robo")], rush: parts, command: releasedN(1, "TST-OP-ET"), power: powerCards(4) } });
    expect(rushFromHand(s, "player1", "RS-194:robo").ok).toBe(false);
  });

  it("RS-194: SP2 — ストライクで2点ダメージ（出典: atwiki/page-396）", () => {
    let s = robo({});
    s = settle(strike(s, "RS-194:robo"));
    expect(s.players.player2.damage).toBe(2);
  });

  // 「自軍ターン中、これがバトルエリアに出たとき、敵軍コマンドゾーンからユニットのカードを1枚選び、敵軍バトルエリアに出す」
  it("RS-194: バトルエリアに出たとき、敵軍コマンドゾーンのユニットのカード（リリース・ホールドとも）から1枚選び、敵軍バトルエリアに出す（オペレーションは選べない）（出典: atwiki/page-396）", () => {
    let s = robo({ command: [released("RS-189", "c1"), held("RS-190", "c2"), released("TST-OP", "op")] });
    expect(choiceIds(s)).toEqual(["RS-189:c1", "RS-190:c2"]);
    s = pickEffect(s, "player1", ["RS-189:c1"]);
    expect(zoneOf(s, "player2", "RS-189:c1")).toBe("battle");
    expect(zoneOf(s, "player2", "RS-190:c2")).toBe("command");
  });

  // 「選び、…出す」— 任意ではない（「してもよい」がない）。
  it("RS-194: 選ぶことは強制 — 選ばずに終えることはできない（出典: atwiki/page-396「1枚選び、敵軍バトルエリアに出す」）", () => {
    const s = robo({ command: [released("RS-189", "c1")] });
    expect(s.pendingEffectChoice?.optional ?? false).toBe(false);
    expect(tryAct(s, { type: "skip_effect_choice", playerId: "player1" }).ok).toBe(false);
  });

  // 「このとき出したユニットの効果は発動しない」— 出したガオバイソン【鋼の角】（バトルエリアに出たとき撃破）は発動しない。
  it("RS-194: このとき出したユニットの効果は発動しない（敵軍のガオバイソン【鋼の角】は発動しない）（出典: atwiki/page-396・R-RUSH-24）", () => {
    let s = robo(
      { command: [released("RS-155", "bison"), released("TST-OP", "h")] },
      { battle: [inst("TST-UNIT-0", "mine")] },
    );
    s = pickEffect(s, "player1", ["RS-155:bison"]);
    expect(zoneOf(s, "player2", "RS-155:bison")).toBe("battle");
    expect(s.pendingEffectChoice?.playerId === "player2").toBe(false);
    s = settle(s);
    expect(zoneOf(s, "player1", "TST-UNIT-0:mine")).toBe("battle");
    expect(zoneOf(s, "player1", "RS-194:robo")).toBe("battle");
    // 対照: ガオバイソンが持ち主のバトルフェイズに自分で出たときは【鋼の角】の選択が出る
    let c = st({
      turn: 4,
      activePlayer: "player2",
      player1: { battle: [inst("TST-UNIT-0", "mine")], deck: deckCards(3) },
      player2: { rush: [inst("RS-155", "bison")], command: [released("TST-OP", "h")], deck: deckCards(3, "e") },
    });
    c = act(c, { type: "initiate_command_payment", playerId: "player2", kind: "battle_entry", sourceInstanceId: "RS-155:bison" });
    expect(c.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(c)).toContain("TST-UNIT-0:mine");
  });

  // 「自軍ターン中」
  it.todo(
    "RS-194: 敵軍ターン中にバトルエリアに出たとき（ファイブテクター等）は発動しない（出典: atwiki/page-396「自軍ターン中」）— L ユニットのダイナロボを敵軍ターン中にバトルエリアに出す手段（ファイブテクターは S ユニットのみ）が収録カードにない",
  );

  // grnrngr/faq-card-4 RS-194 Q1（grnrngr/faq-card-1 にも同じ Q）「「選ぶことはできるが、あえてそれを選んだ場合は何も起こらない」」
  it("RS-194: パトシグナーがあるとき BP5000 以上の M ユニットのカードは選べるが、選んでも何も起こらない（出典: grnrngr/faq-card-4 RS-194 Q1）", () => {
    let s = robo({ command: [released("RS-152", "lion"), released("TST-OP", "h")], battle: [inst("RS-047", "pat")] });
    expect(choiceIds(s)).toContain("RS-152:lion");
    s = settle(pickEffect(s, "player1", ["RS-152:lion"]));
    expect(zoneOf(s, "player2", "RS-152:lion")).toBe("command");
  });

  // grnrngr/faq-card-4 RS-194 Q2（grnrngr/faq-card-3 にも同じ Q）「はい、その通りです。」
  it("RS-194: 超電子レーダーが配置されていれば、出された S ユニットの持ち主は、パワーゾーンのダメージ以外のカードを1枚手札に戻す（出典: grnrngr/faq-card-4 RS-194 Q2・R-RUSH-02）", () => {
    let s = robo(
      { command: [released("RS-189", "c1")], power: [...powerCards(2, "ep"), ...damagedPower(1, "ed")], damage: 1 },
      { operation: [inst("RS-124", "radar")] },
    );
    s = pickEffect(s, "player1", ["RS-189:c1"]);
    s = pickEffect(s, "player2", ["TST-P:ep0"]);
    s = settle(s);
    expect(zoneOf(s, "player2", "RS-189:c1")).toBe("battle");
    expect(s.players.player2.hand.map((c) => c.instanceId)).toContain("TST-P:ep0");
    expect(s.players.player2.power).toHaveLength(2);
  });

  // grnrngr/faq-card-4 RS-194 Q3「「バトルエリアに出られない」とあるユニットのカードを選ぶことができない」
  it("RS-194: 「※これはバトルエリアに出られない」ユニットのカード（童鬼ドロップ）は選べない（出典: grnrngr/faq-card-4 RS-194 Q3）", () => {
    const s = robo({ command: [released("RS-093", "drop"), released("RS-189", "c1")] });
    expect(choiceIds(s)).toEqual(["RS-189:c1"]);
  });

  // 同 Q3「ホールドできるコマンドが別にあれば、コマンドを1つホールドしてバトルエリアに出してください」
  it("RS-194: 「ホールドしなければ出られない」ユニットのカード（ガオライオン）は、ホールドできるコマンドが別にあれば1つホールドして出す（出典: grnrngr/faq-card-4 RS-194 Q3）", () => {
    let s = robo({ command: [released("RS-152", "lion"), released("TST-OP", "h")] });
    expect(choiceIds(s)).toContain("RS-152:lion");
    s = settle(pickEffect(s, "player1", ["RS-152:lion"]));
    expect(zoneOf(s, "player2", "RS-152:lion")).toBe("battle");
    expect(s.players.player2.command.find((c) => c.instanceId === "TST-OP:h")?.commandHeld).toBe(true);
  });

  it("RS-194: 「ホールドしなければ出られない」ユニットのカードは、ホールドできるコマンドが別になければバトルエリアに出ない（出典: grnrngr/faq-card-4 RS-194 Q1・Q3）", () => {
    let s = robo({ command: [released("RS-152", "lion"), held("TST-OP", "h")] });
    if (choiceIds(s).includes("RS-152:lion")) s = pickEffect(s, "player1", ["RS-152:lion"]);
    s = settle(s);
    expect(zoneOf(s, "player2", "RS-152:lion")).toBe("command");
    expect(s.players.player2.command.find((c) => c.instanceId === "RS-152:lion")?.commandHeld ?? false).toBe(false);
  });

  // grnrngr/faq-card-5「はい、撃破できます。」（グリーンサイ【サイカッター】の後にダイナロボで出したユニット）
  it("RS-194: グリーンサイの【サイカッター】の後、ビートハンマーで出した BP4000 以下の敵軍ユニットは撃破される（出典: grnrngr/faq-card-5 ダイナロボ・グリーンサイの Q）", () => {
    let s = st({
      turn: 3,
      player1: { rush: [inst("RS-279", "sai"), inst("RS-194", "robo")], deck: deckCards(5) },
      player2: { command: [released("RS-189", "c1")], deck: deckCards(5, "e"), power: powerCards(3, "ep") },
    });
    s = lineUp(s, ["RS-279:sai"]);
    s = enter(s, "RS-194:robo");
    s = settle(pickEffect(s, "player1", ["RS-189:c1"]));
    expect(zoneOf(s, "player2", "RS-189:c1")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-195 ダイナマッハ", () => {
  it("RS-195: カタログ本文（なし）・スペックが出典と一致（出典: atwiki/page-397）", () => {
    expectCatalogText("RS-195", "なし");
    expectStats("RS-195", {
      name: "ダイナマッハ",
      category: "ET",
      size: "M",
      bp: 2000,
      sp: 1,
      powerCost: "5+",
      features: ["メカ", "航空機"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  // 「追加条件：自軍Sユニットを1体コマンドゾーンに送るか捨札にする」
  it("RS-195: 自軍 S ユニットを1体コマンドゾーンに送ってラッシュできる（出典: atwiki/page-397・R-ADD-04）", () => {
    const s = st({ phase: "rush", turn: 3, player1: { hand: [inst("RS-195", "m")], rush: [inst("TST-UNIT-0", "s")], command: releasedN(1, "TST-OP-ET"), power: powerCards(5) } });
    const r = rushWithDests(s, "player1", "RS-195:m", ["TST-UNIT-0:s"], ["command"]);
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-195:m")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:s")).toBe("command");
  });

  it("RS-195: 捨札にしてもよい（出典: atwiki/page-397「コマンドゾーンに送るか捨札にする」）", () => {
    const s = st({ phase: "rush", turn: 3, player1: { hand: [inst("RS-195", "m")], rush: [inst("TST-UNIT-0", "s")], command: releasedN(1, "TST-OP-ET"), power: powerCards(5) } });
    const r = rushWithDests(s, "player1", "RS-195:m", ["TST-UNIT-0:s"], ["discard"]);
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:s")).toBe("discard");
  });

  it("RS-195: 自軍 S ユニットがいなければラッシュできない（出典: atwiki/page-397）", () => {
    const s = st({ phase: "rush", turn: 3, player1: { hand: [inst("RS-195", "m")], rush: [inst("TST-UNIT-2", "m2")], command: releasedN(1, "TST-OP-ET"), power: powerCards(5) } });
    expect(canStartRush(s, "player1", "RS-195:m")).toBe(false);
  });

  it("RS-195: SP1 — M ユニットだがストライクで1点ダメージを与えられる（出典: atwiki/page-397）", () => {
    let s = st({ turn: 3, player1: { rush: [inst("RS-195", "m")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e"), power: powerCards(2, "ep") } });
    s = enter(s, "RS-195:m");
    s = settle(strike(s, "RS-195:m"));
    expect(s.players.player2.damage).toBe(1);
  });
});

// ===========================================================================
describe("RS-196 ダイナモビル", () => {
  const TEXT =
    "【迎撃モビルミサイル】これが自軍ラッシュエリアにある間、相手にストライクされたとき次の効果を発動できる⇒ストライクしてきたユニットのサイズを見て、Lユニットなら4つ、Mユニットなら3つ、Sユニットなら2つ、ETの自軍コマンドをホールドする。そうしたとき、敵軍のストライクは無効になる。";

  /** 敵軍ターン：ダイナモビルが自軍ラッシュエリア（zone）にあり、敵軍の striker がストライクしてきた直後。 */
  function struckBy(striker: CardInstance, cmds: CardInstance[], zone: "rush" | "battle" = "rush"): GameState {
    let s = st({
      turn: 4,
      activePlayer: "player2",
      player1: { [zone]: [inst("RS-196", "mob")], command: cmds, power: powerCards(4), deck: deckCards(3) },
      player2: { battle: [striker], deck: deckCards(3, "e") },
    });
    s = strike(s, striker.instanceId, "player2");
    return s;
  }

  it("RS-196: カタログ本文・スペックが出典と一致（出典: atwiki/page-398）", () => {
    expectCatalogText("RS-196", TEXT);
    expectStats("RS-196", {
      name: "ダイナモビル",
      category: "ET",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: "5+",
      features: ["メカ", "車両", "航空機"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  // 「追加条件：自軍Sユニット2体をそれぞれコマンドゾーンに送るか捨札にする」
  it("RS-196: 自軍 S ユニット2体を（1体はコマンド、1体は捨札に）送ってラッシュでき、1体では満たせない（出典: atwiki/page-398・R-ADD-04）", () => {
    const mk = (rush: CardInstance[]) =>
      st({ phase: "rush", turn: 3, player1: { hand: [inst("RS-196", "mob")], rush, command: releasedN(1, "TST-OP-ET"), power: powerCards(5) } });
    expect(canStartRush(mk([inst("TST-UNIT-0", "a")]), "player1", "RS-196:mob")).toBe(false);
    const r = rushWithDests(mk([inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b")]), "player1", "RS-196:mob", ["TST-UNIT-0:a", "TST-UNIT-0:b"], ["command", "discard"]);
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-196:mob")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:a")).toBe("command");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:b")).toBe("discard");
  });

  // grnrngr/faq-card-4 RS-196 Q2「「それぞれ」について「コマンドゾーンに送るか捨札にする」を選ぶという意味になります。」
  it("RS-196: 1体目をコマンドゾーンに送っても、2体目もコマンドゾーンに送れる（出典: grnrngr/faq-card-4 RS-196 Q2）", () => {
    const s = st({
      phase: "rush",
      turn: 3,
      player1: { hand: [inst("RS-196", "mob")], rush: [inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b")], command: releasedN(1, "TST-OP-ET"), power: powerCards(5) },
    });
    const r = rushWithDests(s, "player1", "RS-196:mob", ["TST-UNIT-0:a", "TST-UNIT-0:b"], ["command", "command"]);
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:a")).toBe("command");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:b")).toBe("command");
  });

  // 「相手にストライクされたとき…Sユニットなら2つ、ETの自軍コマンドをホールドする。そうしたとき、敵軍のストライクは無効になる」
  it("RS-196: S ユニットにストライクされたとき、ET のコマンドを2つホールドしてストライクを無効にできる（出典: atwiki/page-398）", () => {
    let s = struckBy(inst("TST-UNIT-0", "s"), releasedN(3, "TST-OP-ET"));
    s = pickEffect(s, "player1", ["TST-OP-ET:rc0", "TST-OP-ET:rc1"]);
    for (let i = 0; i < 3 && s.pendingCommandPayment; i++) {
      s = act(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: s.pendingCommandPayment.validInstanceIds.slice(0, s.pendingCommandPayment.totalNeeded) });
    }
    s = settle(s);
    expect(s.players.player1.damage).toBe(0);
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });

  // 「Lユニットなら4つ、Mユニットなら3つ」
  it("RS-196: M ユニットのストライクは ET コマンド3つ（2つでは足りない）（出典: atwiki/page-398）", () => {
    const M = inst("TST-UNIT-2", "m");
    const three = struckBy(M, releasedN(3, "TST-OP-ET"));
    expect(three.pendingEffectChoice?.sourceCardId).toBe("RS-196");
    let s = pickEffect(three, "player1", ["TST-OP-ET:rc0", "TST-OP-ET:rc1", "TST-OP-ET:rc2"]);
    s = settle(s);
    expect(s.players.player1.damage).toBe(0);
    const two = struckBy(inst("TST-UNIT-2", "m2"), releasedN(2, "TST-OP-ET"));
    expect(two.pendingEffectChoice?.sourceCardId === "RS-196").toBe(false);
  });

  // 「ETの自軍コマンド」
  it("RS-196: ET 以外のコマンドではホールドできない（ET が2つあれば発動できる）（出典: atwiki/page-398「ETの自軍コマンド」）", () => {
    const wb = struckBy(inst("TST-UNIT-0", "s"), releasedN(3, "TST-OP"));
    expect(wb.pendingEffectChoice?.sourceCardId === "RS-196").toBe(false);
    const et = struckBy(inst("TST-UNIT-0", "s"), releasedN(2, "TST-OP-ET"));
    expect(et.pendingEffectChoice?.sourceCardId).toBe("RS-196");
  });

  // 「発動できる」
  it("RS-196: 発動は任意 — 発動しなければストライクは通る（出典: atwiki/page-398「発動できる」）", () => {
    let s = struckBy(inst("TST-UNIT-0", "s"), releasedN(2, "TST-OP-ET"));
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-196");
    s = settle(declineEffect(s, "player1"));
    expect(s.players.player1.damage).toBe(1);
  });

  // 「これが自軍ラッシュエリアにある間」
  it("RS-196: バトルエリアにあるときは発動しない（ラッシュエリアなら発動する）（出典: atwiki/page-398「自軍ラッシュエリアにある間」）", () => {
    const inBattle = struckBy(inst("TST-UNIT-0", "s"), releasedN(2, "TST-OP-ET"), "battle");
    expect(inBattle.pendingEffectChoice?.sourceCardId === "RS-196").toBe(false);
    const inRush = struckBy(inst("TST-UNIT-0", "s"), releasedN(2, "TST-OP-ET"), "rush");
    expect(inRush.pendingEffectChoice?.sourceCardId).toBe("RS-196");
  });

  // grnrngr/faq-card-5 RS-196 Q1「はい、発動できます。」（ピンクフラッシュ【プリズムブーツ】の後でも）
  it("RS-196: ピンクフラッシュの【プリズムブーツ】が発動したターンでも【迎撃モビルミサイル】を発動できる（出典: grnrngr/faq-card-5 RS-196 Q1）", () => {
    let s = st({
      turn: 4,
      activePlayer: "player2",
      player1: { rush: [inst("RS-196", "mob")], command: [...releasedN(2, "TST-OP-ET"), held("TST-OP-ET", "h")], power: powerCards(4), deck: deckCards(3) },
      player2: { rush: [inst("RS-270", "pf"), inst("TST-UNIT-0", "s")], deck: deckCards(3, "e") },
    });
    // 1番目のピンクフラッシュ（CN1）で【プリズムブーツ】を発動し、続く S ユニットでストライクする
    s = lineUp(s, ["RS-270:pf"], "player2");
    s = enter(s, "TST-UNIT-0:s", "player2");
    s = strike(s, "TST-UNIT-0:s", "player2");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-196");
  });
});

// ===========================================================================
describe("RS-197 ダイナギャリー", () => {
  const TEXT =
    "【パーツキャリアー】これが自軍バトルエリアに出たとき、自軍コマンドゾーンからリリース状態のMユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。ただしラッシュのための必要パワーと追加条件は満たすこと。";

  /** ダイナギャリーをバトルエリアに出した直後。 */
  function gally(p1: Partial<GameState["players"]["player1"]>): GameState {
    let s = st({
      turn: 3,
      player1: { deck: deckCards(5), power: powerCards(5), ...p1, rush: [inst("RS-197", "g"), ...(p1.rush ?? [])] },
      player2: { deck: deckCards(5, "e"), command: [released("TST-OP", "eh0"), held("TST-OP", "eh1")] },
    });
    return enter(s, "RS-197:g");
  }

  /** パーツキャリアーでマッハを選び、追加条件（S ユニットの行き先）を進める。 */
  function carry(s: GameState, pick: string, materials: string[], dest: "command" | "discard"): GameState {
    let n = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: pick });
    for (let i = 0; i < 12; i++) {
      const setup = n.pendingZordSetup;
      if (setup) {
        if (setup.step === "destination") n = act(n, { type: "resolve_zord_setup", playerId: "player1", destination: dest });
        else if (setup.step === "material") {
          const m = materials.find((x) => setup.validInstanceIds.includes(x)) ?? setup.validInstanceIds[0]!;
          n = act(n, { type: "resolve_zord_setup", playerId: "player1", materialInstanceId: m });
        } else n = act(n, { type: "resolve_zord_setup", playerId: "player1" });
        continue;
      }
      const p = n.pendingEffectChoice;
      if (p?.playerId === "player1") {
        const m = materials.find((x) => p.validInstanceIds.includes(x));
        if (m) {
          n = act(n, { type: "resolve_effect_choice", playerId: "player1", instanceId: m });
          continue;
        }
        const d = p.validInstanceIds.find((x) => x === dest);
        if (d) {
          n = act(n, { type: "resolve_effect_choice", playerId: "player1", instanceId: d });
          continue;
        }
      }
      break;
    }
    return settle(n);
  }

  it("RS-197: カタログ本文・スペックが出典と一致（出典: atwiki/page-399）", () => {
    expectCatalogText("RS-197", TEXT);
    expectStats("RS-197", {
      name: "ダイナギャリー",
      category: "ET",
      size: "M",
      bp: 6000,
      sp: undefined,
      powerCost: "4+",
      features: ["メカ", "車両"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  it("RS-197: 自軍 S ユニット2体を送ってラッシュできる（必要パワー4+）（出典: atwiki/page-399・R-ADD-04）", () => {
    const mk = (power: number) =>
      st({
        phase: "rush",
        turn: 3,
        player1: { hand: [inst("RS-197", "g")], rush: [inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b")], command: releasedN(1, "TST-OP-ET"), power: powerCards(power) },
      });
    expect(rushWithDests(mk(3), "player1", "RS-197:g", ["TST-UNIT-0:a", "TST-UNIT-0:b"], ["discard", "discard"]).ok).toBe(false);
    const r = rushWithDests(mk(4), "player1", "RS-197:g", ["TST-UNIT-0:a", "TST-UNIT-0:b"], ["discard", "discard"]);
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-197:g")).toBe("rush");
  });

  // 「自軍コマンドゾーンからリリース状態のMユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。ただしラッシュのための必要パワーと追加条件は満たすこと」
  it("RS-197: バトルエリアに出たとき、自軍コマンドゾーンのリリース状態の M ユニット（ダイナマッハ）を、追加条件を満たしてラッシュエリアに出せる（出典: atwiki/page-399）", () => {
    let s = gally({ rush: [inst("TST-UNIT-0", "s1")], command: [released("RS-195", "mach"), released("TST-OP-ET", "c")] });
    expect(choiceIds(s)).toEqual(["RS-195:mach"]);
    s = carry(s, "RS-195:mach", ["TST-UNIT-0:s1"], "discard");
    expect(zoneOf(s, "player1", "RS-195:mach")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:s1")).toBe("discard");
  });

  it("RS-197: ホールド状態の M ユニット・S ユニット・敵軍コマンドの M は選べない（出典: atwiki/page-399「リリース状態のMユニットのカード」）", () => {
    const s = gally({ rush: [inst("TST-UNIT-0", "s1")], command: [held("RS-195", "hmach"), released("RS-189", "ks"), released("RS-195", "mach")] });
    expect(choiceIds(s)).toEqual(["RS-195:mach"]);
  });

  it("RS-197: 出すのは任意 — 出さないことも選べる（出典: atwiki/page-399「出してもよい」）", () => {
    let s = gally({ rush: [inst("TST-UNIT-0", "s1")], command: [released("RS-195", "mach")] });
    expect(s.pendingEffectChoice?.optional).toBe(true);
    s = declineEffect(s, "player1");
    expect(zoneOf(s, "player1", "RS-195:mach")).toBe("command");
    expect(zoneOf(s, "player1", "TST-UNIT-0:s1")).toBe("rush");
  });

  it("RS-197: 必要パワーを満たさなければ出せない（パワー4ではダイナマッハ（5+）は候補にならない）（出典: atwiki/page-399「必要パワー…は満たすこと」）", () => {
    const ok = gally({ rush: [inst("TST-UNIT-0", "s1")], command: [released("RS-195", "mach")], power: powerCards(5) });
    expect(choiceIds(ok)).toContain("RS-195:mach");
    const ng = gally({ rush: [inst("TST-UNIT-0", "s1")], command: [released("RS-195", "mach")], power: powerCards(4) });
    expect(choiceIds(ng)).not.toContain("RS-195:mach");
  });

  it("RS-197: 追加条件を満たせなければ出せない（S ユニットがいなければダイナマッハは候補にならない）（出典: atwiki/page-399「追加条件は満たすこと」）", () => {
    const ok = gally({ rush: [inst("TST-UNIT-0", "s1")], command: [released("RS-195", "mach")] });
    expect(choiceIds(ok)).toContain("RS-195:mach");
    const ng = gally({ rush: [inst("TST-UNIT-2", "m")], command: [released("RS-195", "mach")] });
    expect(choiceIds(ng)).not.toContain("RS-195:mach");
  });

  // grnrngr/faq-card-4 RS-197 Q1・Q3「はい、発動します。」
  it("RS-197: パーツキャリアーで出した M ユニットの「ラッシュしたとき」の効果は発動する（守護獣プテラノドン【プテラビーム】）（出典: grnrngr/faq-card-4 RS-197 Q1・Q3・R-RUSH-22）", () => {
    let s = gally({ command: [released("RS-039", "ptera")], power: powerCards(5) });
    s = carry(s, "RS-039:ptera", [], "discard");
    expect(zoneOf(s, "player1", "RS-039:ptera")).toBe("rush");
    s = settle(pickEffect(s, "player1", ["TST-OP:eh1"]));
    expect(zoneOf(s, "player2", "TST-OP:eh1")).toBe("discard");
  });

  // grnrngr/faq-card-4 RS-197 Q2（grnrngr/faq-card-2 にも同じ Q）「はい、出来ます。」
  it("RS-197: ジャガーバルカンの【母艦】で、選んだダイナマッハ自身をホールドして追加条件のかわりにできる（出典: grnrngr/faq-card-4 RS-197 Q2）", () => {
    let s = gally({ rush: [inst("RS-076", "jag")], command: [released("RS-195", "mach")] });
    expect(choiceIds(s)).toContain("RS-195:mach");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-195:mach" });
    for (let i = 0; i < 8; i++) {
      const setup = s.pendingZordSetup;
      if (setup) {
        const r =
          tryAct(s, { type: "resolve_zord_setup", playerId: "player1", paymentPath: "mothership" }).ok
            ? tryAct(s, { type: "resolve_zord_setup", playerId: "player1", paymentPath: "mothership" })
            : tryAct(s, { type: "resolve_zord_setup", playerId: "player1", materialInstanceId: setup.validInstanceIds[0] });
        if (!r.ok) break;
        s = r.state;
        continue;
      }
      if (s.pendingCommandPayment) {
        s = act(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["RS-195:mach"] });
        continue;
      }
      if (s.pendingEffectChoice?.validInstanceIds.includes("RS-195:mach")) {
        s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-195:mach" });
        continue;
      }
      break;
    }
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-195:mach")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-076:jag")).toBe("rush");
  });

  // grnrngr/faq-card-4 RS-197 Q4「いいえ、その場合はＳユニットは捨札にしなければなりません。」
  it("RS-197: 自軍コマンドが5つあるときは、コマンドゾーンから出す M ユニットの追加条件の S ユニットはコマンドゾーンに送れず捨札にする（出典: grnrngr/faq-card-4 RS-197 Q4・R-RUSH-11）", () => {
    let s = gally({
      rush: [inst("TST-UNIT-0", "s1")],
      command: [released("RS-195", "mach"), ...releasedN(4, "TST-OP-ET")],
    });
    expect(s.players.player1.command).toHaveLength(5);
    s = carry(s, "RS-195:mach", ["TST-UNIT-0:s1"], "command");
    expect(zoneOf(s, "player1", "RS-195:mach")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:s1")).toBe("discard");
  });

  // grnrngr/faq-card-4 RS-197 Q5「はい、その通りです。」
  it("RS-197: 追加条件の S ユニット2体は、1体目をコマンドゾーンに送っても2体目もコマンドゾーンに送れる（出典: grnrngr/faq-card-4 RS-197 Q5）", () => {
    const s = st({
      phase: "rush",
      turn: 3,
      player1: { hand: [inst("RS-197", "g")], rush: [inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b")], command: releasedN(1, "TST-OP-ET"), power: powerCards(4) },
    });
    const r = rushWithDests(s, "player1", "RS-197:g", ["TST-UNIT-0:a", "TST-UNIT-0:b"], ["command", "command"]);
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:a")).toBe("command");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:b")).toBe("command");
  });
});

// ===========================================================================
describe("RS-198 帝王アトン", () => {
  const TEXT =
    "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。【帝王剣の呪い】これが自軍エリアにある間、すべての敵軍Sユニットは、毎ターン、可能ならバトルエリアに出る。";
  const BLANK_S = sUnit("SPEC-BLANK-S", { sp: undefined, bp: 1000 });

  it("RS-198: カタログ本文・スペックが出典と一致（出典: atwiki/page-382）", () => {
    expectCatalogText("RS-198", TEXT);
    expectStats("RS-198", {
      name: "帝王アトン",
      category: "DA",
      size: "S",
      bp: 7000,
      sp: 1,
      powerCost: 8,
      features: ["皇帝", "有尾人一族", "男"],
    });
  });

  // 「※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される」
  it("RS-198: ※ 敵軍ターン中に SP1 のユニットにアタックされると、バトルに勝っても撃破される（出典: atwiki/page-382）", () => {
    let s = st({
      turn: 4,
      activePlayer: "player2",
      player1: { battle: [inst("RS-198", "aton")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "sp1")], deck: deckCards(3, "e") },
    });
    s = settle(attack(s, "TST-UNIT-0:sp1", "RS-198:aton", "player2"));
    expect(zoneOf(s, "player1", "RS-198:aton")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:sp1")).toBe("discard");
  });

  it("RS-198: ※ SP が空欄のユニットとのバトルでは撃破されない（出典: atwiki/page-382「「SP1」以上のユニット」）", () => {
    let s = st(
      {
        turn: 4,
        activePlayer: "player2",
        player1: { battle: [inst("RS-198", "aton")], deck: deckCards(3) },
        player2: { battle: [inst("SPEC-BLANK-S", "b")], deck: deckCards(3, "e") },
      },
      [BLANK_S],
    );
    s = settle(attack(s, "SPEC-BLANK-S:b", "RS-198:aton", "player2"));
    expect(zoneOf(s, "player1", "RS-198:aton")).toBe("battle");
  });

  it("RS-198: ※ 自軍ターン中に SP1 のユニットにアタックして勝っても撃破されない（出典: atwiki/page-382「敵軍ターン中」）", () => {
    let s = st({
      turn: 3,
      player1: { battle: [inst("RS-198", "aton")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "sp1")], deck: deckCards(3, "e") },
    });
    s = settle(attack(s, "RS-198:aton", "TST-UNIT-0:sp1"));
    expect(zoneOf(s, "player1", "RS-198:aton")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:sp1")).toBe("discard");
  });

  it("RS-198: 必要パワー8・SP1 — ストライクで1点（出典: atwiki/page-382）", () => {
    let s = st({ turn: 3, player1: { rush: [inst("RS-198", "aton")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e"), power: powerCards(2, "ep") } });
    s = enter(s, "RS-198:aton");
    s = settle(strike(s, "RS-198:aton"));
    expect(s.players.player2.damage).toBe(1);
  });

  // 「【帝王剣の呪い】これが自軍エリアにある間、すべての敵軍Sユニットは、毎ターン、可能ならバトルエリアに出る」
  it("RS-198: 帝王アトンがあると、敵軍 S ユニットは可能ならバトルエリアに出なければならない（出さずにバトルフェイズを終えられない）（出典: atwiki/page-382・R-BA-04）", () => {
    const s = st({
      turn: 4,
      activePlayer: "player2",
      player1: { battle: [inst("RS-198", "aton")], deck: deckCards(3) },
      player2: { rush: [inst("TST-UNIT-0", "s")], deck: deckCards(3, "e") },
    });
    expect(legalOfType(s, "end_phase")).toHaveLength(0);
    expect(canEnter(s, "TST-UNIT-0:s", "player2")).toBe(true);
  });

  // 「すべての敵軍Sユニット」— M ユニットは義務を負わない。
  it("RS-198: 敵軍の M ユニットだけなら出さずに終えられる（S ユニットがいれば終えられない）（出典: atwiki/page-382「すべての敵軍Sユニット」）", () => {
    const onlyM = st({
      turn: 4,
      activePlayer: "player2",
      player1: { battle: [inst("RS-198", "aton")], deck: deckCards(3) },
      player2: { rush: [inst("TST-UNIT-2", "m")], deck: deckCards(3, "e") },
    });
    expect(legalOfType(onlyM, "end_phase")).toHaveLength(1);
    const withS = st({
      turn: 4,
      activePlayer: "player2",
      player1: { battle: [inst("RS-198", "aton")], deck: deckCards(3) },
      player2: { rush: [inst("TST-UNIT-2", "m"), inst("TST-UNIT-0", "s")], deck: deckCards(3, "e") },
    });
    expect(legalOfType(withS, "end_phase")).toHaveLength(0);
  });

  // 「これが自軍エリアにある間」— ラッシュエリアにあるときも有効、自軍（帝王アトンの持ち主）の S ユニットには及ばない。
  it("RS-198: 帝王アトンがラッシュエリアにあっても有効で、持ち主自身の S ユニットには義務がない（出典: atwiki/page-382）", () => {
    const enemyTurn = st({
      turn: 4,
      activePlayer: "player2",
      player1: { rush: [inst("RS-198", "aton")], deck: deckCards(3) },
      player2: { rush: [inst("TST-UNIT-0", "s")], deck: deckCards(3, "e") },
    });
    expect(legalOfType(enemyTurn, "end_phase")).toHaveLength(0);
    const ownTurn = st({ turn: 3, player1: { rush: [inst("RS-198", "aton"), inst("TST-UNIT-0", "mine")], deck: deckCards(3) } });
    expect(legalOfType(ownTurn, "end_phase")).toHaveLength(1);
  });
});

// ===========================================================================
describe("RS-199 グリーンツー", () => {
  const TEXT =
    "【ブレイクアクション】「SP1」これがストライクして相手がパワーゾーンのカードをウラ返すとき、ウラ返すカードと必要パワーの数字が同じ敵軍ユニットをすべて撃破してもよい。";

  /** NC（4番目）で出たグリーンツーがストライクし、相手が flip を指定してウラ返した直後。 */
  function brokeWith(flip: string, p2: Partial<GameState["players"]["player2"]>): GameState {
    let s = atPosition(inst("RS-199", "g"), 3, p2);
    s = strike(s, "RS-199:g");
    s = act(s, { type: "resolve_damage_payment", playerId: "player2", instanceId: flip });
    return s;
  }
  const enemyField = {
    battle: [inst("RS-189", "cost3"), inst("RS-193", "cost0")],
    rush: [inst("RS-191", "cost3r")],
    power: [inst("RS-181", "pw5"), inst("TST-OP", "pw3"), inst("RS-179", "pw2")],
  };

  it("RS-199: カタログ本文・スペックが出典と一致（出典: atwiki/page-407）", () => {
    expectCatalogText("RS-199", TEXT);
    expectStats("RS-199", {
      name: "グリーンツー",
      category: "OT",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 3,
      comboNumber: 4,
      features: ["グリーン", "男"],
    });
  });

  it("RS-199: NC（4番目）で SP1 になりストライクできる。NC 不成立ではストライクできない（出典: atwiki/page-407・R-STK-02）", () => {
    expect(canStrike(atPosition(inst("RS-199", "g"), 3), "RS-199:g")).toBe(true);
    expect(canStrike(atPosition(inst("RS-199", "g"), 0), "RS-199:g")).toBe(false);
  });

  // 「ウラ返すカードと必要パワーの数字が同じ敵軍ユニットをすべて撃破してもよい」
  it("RS-199: ウラ返したカードと必要パワーの数字が同じ敵軍ユニット（バトル・ラッシュエリアとも）をすべて撃破できる（出典: atwiki/page-407）", () => {
    let s = brokeWith("TST-OP:pw3", enemyField);
    s = settle(pickEffect(s, "player1"));
    expect(zoneOf(s, "player2", "RS-189:cost3")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-191:cost3r")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-193:cost0")).toBe("battle");
  });

  // 「撃破してもよい」
  it("RS-199: 撃破は任意 — 選択が出て、断れば撃破しない（出典: atwiki/page-407「撃破してもよい」）", () => {
    let s = brokeWith("TST-OP:pw3", enemyField);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-199");
    s = settle(declineEffect(s, "player1"));
    expect(zoneOf(s, "player2", "RS-189:cost3")).toBe("battle");
  });

  // 一般ルール R-TGT-04 ではなく本文が「敵軍ユニット」に限定 — 自軍の同じ必要パワーのユニットは撃破しない。
  it("RS-199: 撃破するのは敵軍ユニットだけ（自軍の必要パワー3のグリーンツー自身は残る）（出典: atwiki/page-407「敵軍ユニットをすべて」）", () => {
    let s = brokeWith("TST-OP:pw3", enemyField);
    s = settle(pickEffect(s, "player1"));
    expect(zoneOf(s, "player2", "RS-189:cost3")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-199:g")).toBe("battle");
  });

  // R-TIME-01（atwiki/page-1828）「～するとき」→「～されるとき」→ 実際の行動 →「～したとき」→「～されたとき」。
  // atwiki/page-407 のコメント「ウラ返すとき＝ウラ返す前」— 効果の解決中、ウラ返すカードはまだオモテ向きでパワーゾーンにある。
  it("RS-199: 「ウラ返すとき」はウラ返す前に解決する — 選択中はウラ返すカードがまだオモテでダメージも増えていない（出典: atwiki/page-407・atwiki/page-1828 R-TIME-01）", () => {
    let s = brokeWith("TST-OP:pw3", enemyField);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-199");
    const before = s.players.player2;
    expect(before.power.find((c) => c.instanceId === "TST-OP:pw3")?.faceDown ?? false).toBe(false);
    expect(before.damage).toBe(0);
    s = settle(pickEffect(s, "player1"));
    // 撃破 → そのあとでウラ返してダメージになる。
    expect(zoneOf(s, "player2", "RS-189:cost3")).toBe("discard");
    expect(s.players.player2.power.find((c) => c.instanceId === "TST-OP:pw3")?.faceDown).toBe(true);
    expect(s.players.player2.damage).toBe(1);
    expect(s.pendingStrike).toBeUndefined();
  });

  // 「撃破してもよい」— 断ってもウラ返し（ダメージ）は行う。
  it("RS-199: 断ったときも、そのあとでカードをウラ返してダメージになる（出典: atwiki/page-407）", () => {
    let s = brokeWith("TST-OP:pw3", enemyField);
    s = settle(declineEffect(s, "player1"));
    expect(s.players.player2.power.find((c) => c.instanceId === "TST-OP:pw3")?.faceDown).toBe(true);
    expect(s.players.player2.damage).toBe(1);
    expect(s.pendingStrike).toBeUndefined();
  });

  // R-TIME-01: 「ウラ返すとき」は、ウラ返した結果で起きる誘発（RS-112「敵軍ダメージが6点になったとき」）より前。
  it("RS-199: 「ウラ返すとき」の選択は、ウラ返して6点目になったときの誘発（RS-112 ウルカイザー）より先に開く（出典: atwiki/page-407・atwiki/page-1828 R-TIME-01）", () => {
    let s = st({
      turn: 3,
      player1: {
        battle: [inst("RS-112", "urz")],
        rush: [...fillers(2), inst("RS-199", "g")],
        deck: deckCards(5),
      },
      player2: {
        deck: deckCards(5, "e"),
        damage: 5,
        power: [...damagedPower(5, "d"), inst("TST-OP", "pw3"), inst("RS-179", "pw2")],
        battle: [inst("RS-189", "cost3")],
      },
    });
    s = lineUp(s, fillIds(2));
    s = enter(s, "RS-199:g");
    s = strike(s, "RS-199:g");
    s = act(s, { type: "resolve_damage_payment", playerId: "player2", instanceId: "TST-OP:pw3" });
    // ウラ返す前: 6点目はまだ。ウルカイザーはバトルエリアに残っている。
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-199");
    expect(s.players.player2.damage).toBe(5);
    expect(zoneOf(s, "player1", "RS-112:urz")).toBe("battle");
    s = settle(pickEffect(s, "player1"));
    expect(zoneOf(s, "player2", "RS-189:cost3")).toBe("discard");
    // ウラ返したあとで6点 → ウルカイザーは手札に戻る。
    expect(s.players.player2.damage).toBe(6);
    expect(zoneOf(s, "player1", "RS-112:urz")).toBe("hand");
  });

  // grnrngr/faq-card-6「はい、対象になります。」（メディテーションで2枚ウラ返したとき）
  it("RS-199: 相手がメディテーションで2枚ウラ返したとき、その2枚とも対象になる（出典: grnrngr/faq-card-6 RS-199 の Q）", () => {
    let s = atPosition(inst("RS-199", "g"), 3, {
      operation: [inst("RS-348", "med")],
      battle: [inst("RS-189", "cost3")],
      rush: [inst("RS-200", "cost1")],
      power: [inst("TST-OP", "pw3"), inst("TST-OP-ET", "pw1"), inst("RS-179", "pw2")],
    });
    s = strike(s, "RS-199:g");
    s = act(s, { type: "resolve_damage_payment", playerId: "player2", instanceId: "TST-OP:pw3" });
    if (s.pendingDamagePayment) s = act(s, { type: "resolve_damage_payment", playerId: "player2", instanceId: "TST-OP-ET:pw1" });
    s = settle(pickEffect(s, "player1"));
    expect(zoneOf(s, "player2", "RS-189:cost3")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-200:cost1")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-200 ブルースリー", () => {
  const TEXT =
    "【超電子イヤー】「SP1」自軍ダメージの数を数えてから、自軍パワーゾーンのダメージになっているカードをすべてオモテにしてもよい。そうしたとき、元のダメージの数と同じになるまで、自軍パワーゾーンのカードを選びダメージにする。";
  /** ダメージ2点（d0・d1 がウラ）＋オモテのパワー2枚。 */
  const damaged = { power: [...damagedPower(2, "d"), inst("TST-P", "p0"), inst("TST-P", "p1")], damage: 2 };

  it("RS-200: カタログ本文・スペックが出典と一致（出典: atwiki/page-408）", () => {
    expectCatalogText("RS-200", TEXT);
    expectStats("RS-200", {
      name: "ブルースリー",
      category: "OT",
      size: "S",
      bp: 2000,
      sp: "special",
      powerCost: 1,
      comboNumber: 4,
      features: ["ブルー", "男"],
    });
  });

  it("RS-200: NC（4番目）で SP1 になりストライクできる。NC 不成立ではストライクできない（出典: atwiki/page-408・R-STK-02）", () => {
    expect(canStrike(atPosition(inst("RS-200", "b"), 3), "RS-200:b")).toBe(true);
    expect(canStrike(atPosition(inst("RS-200", "b"), 0), "RS-200:b")).toBe(false);
  });

  // 「自軍パワーゾーンのダメージになっているカードをすべてオモテにしてもよい。そうしたとき、元のダメージの数と同じになるまで、自軍パワーゾーンのカードを選びダメージにする」
  it("RS-200: ダメージをすべてオモテにし、選んだカードを元の数（2点）だけダメージにし直せる（出典: atwiki/page-408）", () => {
    let s = atPosition(inst("RS-200", "b"), 3, {}, damaged);
    s = pickEffect(s, "player1", ["TST-P:p0", "TST-P:p1"]);
    const power = s.players.player1.power;
    expect(power.find((c) => c.instanceId === "TST-P:d0")?.faceDown ?? false).toBe(false);
    expect(power.find((c) => c.instanceId === "TST-P:d1")?.faceDown ?? false).toBe(false);
    expect(power.find((c) => c.instanceId === "TST-P:p0")?.faceDown).toBe(true);
    expect(power.find((c) => c.instanceId === "TST-P:p1")?.faceDown).toBe(true);
    expect(s.players.player1.damage).toBe(2);
  });

  // 「オモテにしてもよい」
  it("RS-200: 入れ替えは任意 — 選択が出て、断ればダメージはそのまま（出典: atwiki/page-408「オモテにしてもよい」）", () => {
    let s = atPosition(inst("RS-200", "b"), 3, {}, damaged);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-200");
    s = declineEffect(s, "player1");
    expect(s.players.player1.power.find((c) => c.instanceId === "TST-P:d0")?.faceDown).toBe(true);
    expect(s.players.player1.damage).toBe(2);
  });

  it("RS-200: NC 不成立（1番目）ではダメージの入れ替えはできない（NC 成立ならできる）（出典: atwiki/page-408・R-CN-02）", () => {
    const plain = atPosition(inst("RS-200", "b"), 0, {}, damaged);
    expect(plain.pendingEffectChoice?.sourceCardId === "RS-200").toBe(false);
    const nc = atPosition(inst("RS-200", "b"), 3, {}, damaged);
    expect(nc.pendingEffectChoice?.sourceCardId).toBe("RS-200");
  });
});

