/**
 * カード別スペック: RS-171〜RS-178（第3弾「三界の獅子」ボウケンジャーのゴーゴービークル・ガオナイト ほか）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-3（docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_3.html）
 *     ほか card_8（RS-524 呉越同舟）の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  attackTargets,
  bpOf,
  canStartRush,
  canStrike,
  choiceIds,
  deckCards,
  drain,
  endTurn,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  inst,
  legal,
  legalOfType,
  passEntry,
  powerCards,
  released,
  held,
  releasedN,
  rushFromHand,
  settle,
  st,
  strike,
  sUnit,
  substitutes,
  toPhase,
  useNinja,
  zoneIds,
  zoneOf,
} from "./RS3-151-178.helpers";
import type { GameState } from "../types/game";

type Def = ReturnType<typeof sUnit>;
const ET_L = sUnit("SPEC-ET-L", { size: "L", category: "ET", bp: 13000, powerCost: "7+" });
const ET_L16 = sUnit("SPEC-ET-L16", { size: "L", category: "ET", bp: 16000, powerCost: "7+" });
const WB_L = sUnit("SPEC-WB-L", { size: "L", category: "WB", bp: 13000, powerCost: "7+" });

/** 「追加条件：自軍Sユニットを1体コマンドゾーンに送るか捨札にする」の共通確認。 */
function rushWithSDestination(id: string, power: number, destination: "command" | "discard") {
  const s = st({
    phase: "rush",
    player1: { hand: [inst(id, "u")], rush: [inst("TST-UNIT-0", "s")], command: releasedN(2, "TST-OP-ET", "et"), power: powerCards(power) },
  });
  return rushFromHand(s, "player1", `${id}:u`, { destination });
}

function expectSendSCondition(id: string, power: number) {
  const toCmd = rushWithSDestination(id, power, "command");
  expect(toCmd.ok).toBe(true);
  expect(zoneOf(toCmd.state, "player1", `${id}:u`)).toBe("rush");
  expect(zoneOf(toCmd.state, "player1", "TST-UNIT-0:s")).toBe("command");
  const toDiscard = rushWithSDestination(id, power, "discard");
  expect(zoneOf(toDiscard.state, "player1", "TST-UNIT-0:s")).toBe("discard");
  const noS = st({ phase: "rush", player1: { hand: [inst(id, "u")], rush: [inst("TST-UNIT-2", "m")], command: releasedN(2, "TST-OP-ET", "et"), power: powerCards(power) } });
  expect(canStartRush(noS, "player1", `${id}:u`)).toBe(false);
}

/** L ユニット（左・バトルエリア）→ R ユニット（右）を出す。 */
function lThenR(rId: string, lId: string, extra: Def[] = [], p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) {
  let s = st(
    {
      player1: { battle: [inst(lId, "L")], rush: [inst(rId, "r")], deck: deckCards(5), ...p1 },
      player2: { power: powerCards(3, "e"), deck: deckCards(5, "e"), ...p2 },
    },
    extra,
  );
  s = enter(s, `${rId}:r`);
  return s;
}

/** 任意効果の提示を受ける（resolve or confirm）。 */
function accept(s0: GameState, effectId: string): GameState {
  let s = s0;
  if (s.pendingEffectChoice?.playerId === "player1" && s.pendingEffectChoice.effectId === effectId) {
    const id = s.pendingEffectChoice.validInstanceIds[0];
    s = id
      ? act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: id })
      : act(s, { type: "confirm_effect_choice", playerId: "player1" });
  }
  return s;
}

// ===========================================================================
describe("RS-171 ゴーゴードリル", () => {
  it("RS-171: カタログ本文・スペックが出典と一致（出典: atwiki/page-353）", () => {
    expectCatalogText(
      "RS-171",
      "【マキシマムペネトレーション】このユニットからコンビネーションする同カテゴリのLユニットは、次の能力を得る⇒自軍ターン中、BP+4000され、BP20000以上のとき敵軍ユニットを撃破したなら、相手に1点ダメージを与える。",
    );
    expectStats("RS-171", {
      name: "ゴーゴードリル",
      category: "ET",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: "4+",
      comboNumber: "L" as never,
      features: ["メカ", "車両"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  it("RS-171: 追加条件 — S ユニットをコマンドゾーンにも捨札にも送れ、S がなければラッシュできない（出典: atwiki/page-353）", () => {
    expectSendSCondition("RS-171", 4);
  });

  /** ドリル（左）→ L ユニット（右）。 */
  function drillThen(lId: string, extra: Def[], p2: Partial<GameState["players"]["player2"]> = {}) {
    let s = st(
      {
        player1: { rush: [inst("RS-171", "d"), inst(lId, "L")], deck: deckCards(5) },
        player2: { power: powerCards(3, "e"), deck: deckCards(5, "e"), ...p2 },
      },
      extra,
    );
    s = passEntry(enter(s, "RS-171:d"));
    s = enter(s, `${lId}:L`);
    return s;
  }

  // 「自軍ターン中、BP+4000され」
  it("RS-171: ドリルからコンビネーションした同カテゴリ（ET）の L ユニットは自軍ターン中 BP+4000（出典: atwiki/page-353）", () => {
    const s = drillThen("SPEC-ET-L", [ET_L]);
    expect(bpOf(s, "player1", "SPEC-ET-L:L")).toBe(17000);
  });

  it("RS-171: コンビネーションが成立しただけでは相手にダメージを与えない（出典: atwiki/page-353「敵軍ユニットを撃破したなら」）", () => {
    const s = drillThen("SPEC-ET-L", [ET_L]);
    expect(s.players.player2.damage).toBe(0);
  });

  it("RS-171: カテゴリが違う（WB）L ユニットは能力を得ない（出典: atwiki/page-353「同カテゴリのLユニット」）", () => {
    const s = drillThen("SPEC-WB-L", [WB_L]);
    expect(bpOf(s, "player1", "SPEC-WB-L:L")).toBe(13000);
  });

  // 「BP20000以上のとき敵軍ユニットを撃破したなら、相手に1点ダメージを与える」
  it("RS-171: BP20000 以上（16000+4000）の L ユニットが敵軍ユニットを撃破すると、相手に1点ダメージ（出典: atwiki/page-353）", () => {
    let s = drillThen("SPEC-ET-L16", [ET_L16], { battle: [inst("TST-UNIT-0", "e")] });
    s = settle(attack(s, "SPEC-ET-L16:L", "TST-UNIT-0:e"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-171: BP20000 未満（13000+4000）の L ユニットが撃破しても、ダメージは与えない（出典: atwiki/page-353「BP20000以上のとき」）", () => {
    let s = drillThen("SPEC-ET-L", [ET_L], { battle: [inst("TST-UNIT-0", "e")] });
    s = settle(attack(s, "SPEC-ET-L:L", "TST-UNIT-0:e"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(s.players.player2.damage).toBe(0);
  });

  // faq-card-3 RS-171 Q1（RS-440 バトルフィーバーロボ【武器換装】で再びコンビネーション）「はい、できます。」
  it.todo(
    "RS-171: 公式Q&A — 武器換装で戻して再び出し、もう一度ドリルとコンビネーションしたバトルフィーバーロボ（2nd）は、BP20000以上で撃破すると重複して2点与える（出典: atwiki/page-353 Q1）— RS-440 を BP20000 以上にする手段（JC の BP+4000 が適用されないことに加え、他の強化カード）を組み立てられない。単発の1点も上の it.fails のとおり発生しない",
  );
});

// ===========================================================================
describe("RS-172 ゴーゴーショベル", () => {
  it("RS-172: カタログ本文・スペックが出典と一致（出典: atwiki/page-354）", () => {
    expectCatalogText(
      "RS-172",
      "【ショベルディフェンス】これが同カテゴリのLユニットからコンビネーションするとき、次の効果を発動できる⇒このコンビネーションが成立している間、敵軍ユニットはストライクできない。",
    );
    expectStats("RS-172", {
      name: "ゴーゴーショベル",
      category: "ET",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: "4+",
      comboNumber: "R" as never,
      features: ["メカ", "車両"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  it("RS-172: 追加条件 — S ユニットをコマンドゾーンにも捨札にも送れ、S がなければラッシュできない（出典: atwiki/page-354）", () => {
    expectSendSCondition("RS-172", 4);
  });

  /** L（左）→ ショベル（右）を出してターンを終え、相手のバトルフェイズで S ユニットを出す。 */
  function shovelThenEnemyTurn(lId: string, extra: Def[] = [], acceptIt = true) {
    let s = lThenR("RS-172", lId, extra, {}, { rush: [inst("TST-UNIT-0", "st")] });
    if (acceptIt) s = accept(s, "shovel_defense");
    else if (s.pendingEffectChoice?.playerId === "player1") s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    s = endTurn(passEntry(s));
    s = toPhase(s, "player2", "battle");
    s = enter(s, "TST-UNIT-0:st", "player2");
    return s;
  }

  // 「このコンビネーションが成立している間、敵軍ユニットはストライクできない」
  it("RS-172: 同カテゴリの L ユニットからコンビネーションすると、敵軍ユニットはストライクできない（出典: atwiki/page-354）", () => {
    const s = shovelThenEnemyTurn("SPEC-ET-L", [ET_L]);
    expect(canStrike(s, "TST-UNIT-0:st", "player2")).toBe(false);
  });

  it("RS-172: 同カテゴリの L ユニットの右に出ると、【ショベルディフェンス】を発動するかの確認が提示され、見送れる（出典: atwiki/page-354「次の効果を発動できる」）", () => {
    const s = lThenR("RS-172", "SPEC-ET-L", [ET_L]);
    expect(s.pendingEffectChoice?.effectId).toBe("shovel_defense");
    expect(legal(s).some((a) => a.type === "skip_effect_choice")).toBe(true);
  });

  it("RS-172: 発動しても禁止されるのは敵軍ユニットのストライクだけで、自軍の L ユニットはストライクできる（出典: atwiki/page-354「敵軍ユニットは」）", () => {
    let s = accept(lThenR("RS-172", "SPEC-ET-L", [ET_L]), "shovel_defense");
    s = passEntry(s);
    expect(canStrike(s, "SPEC-ET-L:L")).toBe(true);
  });

  it("RS-172: 効果を発動しなければ敵軍ユニットはストライクできる（出典: atwiki/page-354「次の効果を発動できる」）", () => {
    const s = shovelThenEnemyTurn("SPEC-ET-L", [ET_L], false);
    expect(canStrike(s, "TST-UNIT-0:st", "player2")).toBe(true);
  });

  it("RS-172: カテゴリが違う（WB）L ユニットの右に出しても成立せず、敵軍はストライクできる（出典: atwiki/page-354「同カテゴリのLユニット」）", () => {
    const s = shovelThenEnemyTurn("SPEC-WB-L", [WB_L]);
    expect(canStrike(s, "TST-UNIT-0:st", "player2")).toBe(true);
  });

  // faq-card-3 RS-172 Q1（= RS-158 Q1）「すべて「RS-018 隠流忍術」の対象とすることができます」
  it("RS-172: 公式Q&A — JC したショベルのアタックに対し、隠流忍術でその L ユニットを選べる（出典: grnrngr/faq-card-3 RS-172 Q1）", () => {
    let s = lThenR("RS-172", "SPEC-ET-L", [ET_L], {}, {
      battle: [inst("TST-UNIT-0", "def")],
      hand: [inst("RS-018", "n")],
      command: releasedN(2, "TST-OP-MA", "ma"),
      power: powerCards(5, "e"),
    });
    if (s.pendingEffectChoice?.playerId === "player1") s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    s = attack(s, "RS-172:r", "TST-UNIT-0:def");
    expect(substitutes(s, "RS-018:n")).toContain("SPEC-ET-L:L");
  });

  it("RS-172: 公式Q&A — JC した L ユニットのアタックに対し、隠流忍術でそのショベルを選べる（出典: grnrngr/faq-card-3 RS-172 Q1）", () => {
    let s = lThenR("RS-172", "SPEC-ET-L", [ET_L], {}, {
      battle: [inst("TST-UNIT-0", "def")],
      hand: [inst("RS-018", "n")],
      command: releasedN(2, "TST-OP-MA", "ma"),
      power: powerCards(5, "e"),
    });
    if (s.pendingEffectChoice?.playerId === "player1") s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    s = passEntry(s);
    s = attack(s, "SPEC-ET-L:L", "TST-UNIT-0:def");
    expect(substitutes(s, "RS-018:n")).toContain("RS-172:r");
  });

  // faq-card-3 RS-172 Q2「自軍ユニットが撃破されたことによって間が詰まり、コンビネーションの条件通りにユニットが並んだとしても、その効果は発動しません」
  it("RS-172: 公式Q&A — L の右の1体目のショベルが撃破されて間が詰まっても、2体目のショベルの効果は発動せず、敵軍はストライクできる（出典: grnrngr/faq-card-3 RS-172 Q2）", () => {
    let s = st(
      {
        activePlayer: "player2",
        player1: { battle: [inst("SPEC-ET-L", "L"), inst("RS-172", "s1"), inst("RS-172", "s2")] },
        player2: { battle: [inst("SPEC-ET-L16", "big"), inst("TST-UNIT-0", "st")] },
      },
      [ET_L, ET_L16],
    );
    s = settle(attack(s, "SPEC-ET-L16:big", "RS-172:s1", "player2"));
    expect(zoneOf(s, "player1", "RS-172:s1")).toBe("discard");
    expect(canStrike(s, "TST-UNIT-0:st", "player2")).toBe(true);
  });

  // faq-card-8 RS-524 Q「ユニット同士のコンビネーションは成立していますので…【ショベルディフェンス】の効果は有効となります」
  it.todo(
    "RS-172: 公式Q&A — 呉越同舟で ET を追加した L ユニットからコンビネーションしたショベルの効果は、追加カテゴリが失われた次のターンも有効（出典: grnrngr/faq-card-8 RS-524 Q）— 【ショベルディフェンス】自体が未実装（上の it.fails）であり、呉越同舟の常駐・タッグ手順も組み立てていない",
  );
});

// ===========================================================================
describe("RS-173 ゴーゴーミキサー", () => {
  it("RS-173: カタログ本文・スペックが出典と一致（出典: atwiki/page-355）", () => {
    expectCatalogText(
      "RS-173",
      "【ウォールシュート】これが同カテゴリのLユニットからコンビネーションするとき、次の効果を発動できる⇒相手は自分自身のコマンドゾーンのカードを全て山札に戻してシャッフルする。その後、戻した枚数を山札の上からひいて、コマンドゾーンにホールド状態で置く。",
    );
    expectStats("RS-173", {
      name: "ゴーゴーミキサー",
      category: "ET",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: "4+",
      comboNumber: "R" as never,
      features: ["メカ", "車両"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  it("RS-173: 追加条件 — S ユニットをコマンドゾーンにも捨札にも送れ、S がなければラッシュできない（出典: atwiki/page-355）", () => {
    expectSendSCondition("RS-173", 4);
  });

  const enemyCmd = () => [released("TST-OP", "c1"), released("TST-OP", "c2"), held("TST-OP", "c3")];
  const bigDeck = () => Array.from({ length: 40 }, (_, i) => inst("TST-OP-DA", `deck${i}`));

  // 「相手は自分自身のコマンドゾーンのカードを全て山札に戻してシャッフルする。その後、戻した枚数を山札の上からひいて、コマンドゾーンにホールド状態で置く」
  it("RS-173: 発動すると、相手のコマンドは同じ枚数（3枚）のままですべてホールド状態になり、山札の枚数は変わらない（出典: atwiki/page-355）", () => {
    let s = lThenR("RS-173", "SPEC-ET-L", [ET_L], {}, { command: enemyCmd(), deck: bigDeck() });
    s = settle(accept(s, "wall_shoot"));
    expect(s.players.player2.command).toHaveLength(3);
    expect(s.players.player2.command.every((c) => c.commandHeld)).toBe(true);
    expect(s.players.player2.deck).toHaveLength(40);
  });

  it.fails("RS-173: 戻したカードは山札とシャッフルされるので、40枚の山札に戻した3枚がそのまま戻ってくることはまずない（出典: atwiki/page-355「山札に戻してシャッフルする」）", () => {
    // 既知の不具合: CARD-RS-173 コマンドを山札の上に置いてそのままひき直しており、シャッフルしない（同じカードがホールド状態で戻るだけ）
    let s = lThenR("RS-173", "SPEC-ET-L", [ET_L], {}, { command: enemyCmd(), deck: bigDeck() });
    s = settle(accept(s, "wall_shoot"));
    const back = zoneIds(s, "player2", "command").sort();
    expect(back).not.toEqual(["TST-OP:c1", "TST-OP:c2", "TST-OP:c3"]);
  });

  it.fails("RS-173: 効果を発動しない（任意）こともできる（出典: atwiki/page-355「次の効果を発動できる」）", () => {
    // 既知の不具合: CARD-RS-173 【ウォールシュート】が任意効果として提示されず、コンビネーション成立で強制的に処理される
    let s = lThenR("RS-173", "SPEC-ET-L", [ET_L], {}, { command: enemyCmd(), deck: bigDeck() });
    expect(legalOfType(s, "skip_effect_choice").some((a) => a.playerId === "player1")).toBe(true);
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(s.players.player2.command.filter((c) => c.commandHeld)).toHaveLength(1);
  });

  it("RS-173: カテゴリが違う（WB）L ユニットからでは発動しない（出典: atwiki/page-355「同カテゴリのLユニット」）", () => {
    const s = settle(lThenR("RS-173", "SPEC-WB-L", [WB_L], {}, { command: enemyCmd(), deck: bigDeck() }));
    expect(s.players.player2.command.filter((c) => c.commandHeld)).toHaveLength(1);
  });
});

// ===========================================================================
describe("RS-174 ゴーゴークレーン", () => {
  it("RS-174: カタログ本文・スペックが出典と一致（出典: atwiki/page-356）", () => {
    expectCatalogText(
      "RS-174",
      "【リフトアップ】これが同カテゴリのLユニットからコンビネーションするとき、次の効果を発動できる⇒自軍コマンドゾーンからカードを1枚選んで手札に戻す。その後、山札から1枚ひいて自軍コマンドゾーンに置く。",
    );
    expectStats("RS-174", {
      name: "ゴーゴークレーン",
      category: "ET",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: "3+",
      comboNumber: "R" as never,
      features: ["メカ", "車両"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  it("RS-174: 追加条件 — S ユニットをコマンドゾーンにも捨札にも送れ、S がなければラッシュできない（出典: atwiki/page-356）", () => {
    expectSendSCondition("RS-174", 3);
  });

  const craneDeck = () => [inst("TST-OP-DA", "top"), inst("TST-OP-DA", "second")];

  // 「自軍コマンドゾーンからカードを1枚選んで手札に戻す。その後、山札から1枚ひいて自軍コマンドゾーンに置く」
  it.fails("RS-174: 自軍コマンドを1枚選んで手札に戻し、山札の上から1枚をコマンドゾーンに置く（出典: atwiki/page-356）", () => {
    // 既知の不具合: CARD-RS-174 選んだコマンドは手札に戻るが、その後の「山札から1枚ひいて自軍コマンドゾーンに置く」が行われない
    let s = lThenR("RS-174", "SPEC-ET-L", [ET_L], { command: [held("TST-OP", "c1"), released("TST-OP", "c2")], deck: craneDeck() });
    expect(s.pendingEffectChoice?.effectId).toBe("lift_up");
    expect(choiceIds(s)).toEqual(expect.arrayContaining(["TST-OP:c1", "TST-OP:c2"]));
    s = settle(act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-OP:c1" }));
    expect(zoneOf(s, "player1", "TST-OP:c1")).toBe("hand");
    expect(zoneOf(s, "player1", "TST-OP-DA:top")).toBe("command");
    expect(zoneOf(s, "player1", "TST-OP-DA:second")).toBe("deck");
    expect(s.players.player1.command).toHaveLength(2);
  });

  it("RS-174: 効果を発動しない（任意）なら、コマンドを戻さず山札からも置かない（出典: atwiki/page-356「次の効果を発動できる」）", () => {
    let s = lThenR("RS-174", "SPEC-ET-L", [ET_L], { command: [held("TST-OP", "c1"), released("TST-OP", "c2")], deck: craneDeck() });
    expect(legalOfType(s, "skip_effect_choice").some((a) => a.playerId === "player1")).toBe(true);
    s = settle(act(s, { type: "skip_effect_choice", playerId: "player1" }));
    expect(zoneIds(s, "player1", "command")).toEqual(["TST-OP:c1", "TST-OP:c2"]);
    expect(zoneOf(s, "player1", "TST-OP-DA:top")).toBe("deck");
  });

  it("RS-174: 手札に戻すカードは、効果で新たに置く山札のカードではなく元のコマンドから選ぶ（「その後」ひいて置く）（出典: atwiki/page-356「その後、山札から1枚ひいて」）", () => {
    const s = lThenR("RS-174", "SPEC-ET-L", [ET_L], { command: [held("TST-OP", "c1"), released("TST-OP", "c2")], deck: craneDeck() });
    expect(choiceIds(s)).not.toContain("TST-OP-DA:top");
  });

  it("RS-174: カテゴリが違う（WB）L ユニットからでは発動しない（出典: atwiki/page-356「同カテゴリのLユニット」）", () => {
    const s = lThenR("RS-174", "SPEC-WB-L", [WB_L], { command: [held("TST-OP", "c1")], deck: craneDeck() });
    expect(s.pendingEffectChoice?.effectId).not.toBe("lift_up");
    expect(zoneIds(s, "player1", "command")).toEqual(["TST-OP:c1"]);
  });
});

// ===========================================================================
describe("RS-175 ガオナイト", () => {
  it("RS-175: カタログ本文・スペックが出典と一致（出典: atwiki/page-348）", () => {
    expectCatalogText(
      "RS-175",
      "合体―ガオコング＋ガオイーグル＋ガオシャーク＋ガオバイソン＋ガオタイガー＋ガオエレファント【森羅万象ビッグバンファイナル】これをラッシュしたとき、BP20000以下の敵軍ユニットを1体選んで撃破する。",
    );
    expectStats("RS-175", {
      name: "ガオナイト",
      category: "WB",
      size: "L",
      bp: 15000,
      sp: 1,
      powerCost: "8+",
      features: ["獣", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  const SIX = () => ["RS-159", "RS-153", "RS-154", "RS-155", "RS-156", "RS-158"].map((id) => inst(id, "m"));
  const BIG21 = sUnit("SPEC-BIG21", { size: "L", bp: 21000 });
  const BIG20 = sUnit("SPEC-BIG20", { size: "L", bp: 20000 });

  function rushKnight(rush = SIX(), p2: Partial<GameState["players"]["player2"]> = {}) {
    const s = st(
      {
        phase: "rush",
        player1: { hand: [inst("RS-175", "k")], rush, command: releasedN(2), power: powerCards(8) },
        player2: { battle: [inst("SPEC-BIG21", "b21"), inst("SPEC-BIG20", "b20")], rush: [inst("TST-UNIT-0", "r0")], ...p2 },
      },
      [BIG21, BIG20],
    );
    return rushFromHand(s, "player1", "RS-175:k");
  }

  it("RS-175: 合体ユニット6体をすべて捨札にしてラッシュでき、5体では満たせない（出典: atwiki/page-348・R-ADD-06）", () => {
    const r = rushKnight();
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-175:k")).toBe("rush");
    expect(r.state.players.player1.discard.filter((c) => c.cardId !== "RS-175")).toHaveLength(6);
    const five = st({ phase: "rush", player1: { hand: [inst("RS-175", "k")], rush: SIX().slice(0, 5), command: releasedN(2), power: powerCards(8) } });
    expect(canStartRush(five, "player1", "RS-175:k")).toBe(false);
  });

  // 「これをラッシュしたとき、BP20000以下の敵軍ユニットを1体選んで撃破する」
  it("RS-175: ラッシュしたとき、BP20000 以下の敵軍ユニット（バトル・ラッシュエリア）を1体選んで撃破する（BP21000 は選べない）（出典: atwiki/page-348）", () => {
    const r = rushKnight();
    let s = r.state;
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["SPEC-BIG20:b20", "TST-UNIT-0:r0"]);
    s = settle(act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-BIG20:b20" }));
    expect(zoneOf(s, "player2", "SPEC-BIG20:b20")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-BIG21:b21")).toBe("battle");
  });

  it.fails("RS-175: 「撃破する」は強制 — 対象がいれば選ばないことはできない（出典: atwiki/page-348「選んで撃破する」）", () => {
    // 既知の不具合: CARD-RS-175 【森羅万象ビッグバンファイナル】の選択に skip_effect_choice が出て、撃破しないことを選べてしまう
    const s = rushKnight().state;
    expect(legalOfType(s, "skip_effect_choice").some((a) => a.playerId === "player1")).toBe(false);
  });
});

// ===========================================================================
describe("RS-176 ダイタンケン", () => {
  it("RS-176: カタログ本文・スペックが出典と一致（出典: atwiki/page-342）", () => {
    expectCatalogText(
      "RS-176",
      "合体―ゴーゴードリル＋ゴーゴーショベル＋ゴーゴーミキサー＋ゴーゴークレーン＋ゴーゴージェット【大突撃】これをラッシュしたとき、敵軍Lユニットを1体選んで撃破してもよい。そうして撃破したLユニットが捨札になったとき、相手はそのLユニットの合体に必要なユニットのカードを捨札から探して手札に戻す。",
    );
    expectStats("RS-176", {
      name: "ダイタンケン",
      category: "ET",
      size: "L",
      bp: 12000,
      sp: 1,
      powerCost: "5+",
      features: ["メカ", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  const FIVE = () => ["RS-171", "RS-172", "RS-173", "RS-174", "RS-177"].map((id) => inst(id, "m"));

  function rushTanken(p2: Partial<GameState["players"]["player2"]>) {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-176", "t")], rush: FIVE(), command: releasedN(2, "TST-OP-ET", "et"), power: powerCards(5) },
      player2: p2,
    });
    return rushFromHand(s, "player1", "RS-176:t");
  }

  it("RS-176: 合体ユニット5体をすべて捨札にしてラッシュでき、4体では満たせない（出典: atwiki/page-342・R-ADD-06）", () => {
    const r = rushTanken({});
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-176:t")).toBe("rush");
    const four = st({ phase: "rush", player1: { hand: [inst("RS-176", "t")], rush: FIVE().slice(0, 4), command: releasedN(2, "TST-OP-ET", "et"), power: powerCards(5) } });
    expect(canStartRush(four, "player1", "RS-176:t")).toBe(false);
  });

  const kingField = () => ({
    battle: [inst("RS-151", "king"), inst("TST-UNIT-2", "m"), inst("TST-UNIT-7", "zordB")],
    rush: [inst("TST-UNIT-7", "zord")],
    discard: [inst("RS-152", "a"), inst("RS-153", "b"), inst("RS-154", "c"), inst("RS-155", "d"), inst("RS-156", "e"), inst("RS-153", "extra"), inst("TST-UNIT-0", "other")],
  });

  // 「敵軍Lユニットを1体選んで撃破してもよい」
  it.fails("RS-176: ラッシュしたとき、敵軍の L ユニット（バトル・ラッシュエリア）だけを選べる（出典: atwiki/page-342）", () => {
    // 既知の不具合: CARD-RS-176 【大突撃】の候補が敵軍バトルエリアの L ユニットだけで、敵軍ラッシュエリアの L ユニットを選べない
    const s = rushTanken(kingField()).state;
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["RS-151:king", "TST-UNIT-7:zord", "TST-UNIT-7:zordB"]);
  });

  // 「そうして撃破したLユニットが捨札になったとき、相手はそのLユニットの合体に必要なユニットのカードを捨札から探して手札に戻す」
  it("RS-176: 撃破した合体 L ユニット（ガオキング）が捨札になると、相手は合体に必要な5種を捨札から手札に戻す（同名の2枚目・無関係なカードは残る）（出典: atwiki/page-342）", () => {
    let s = rushTanken(kingField()).state;
    s = settle(act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-151:king" }));
    s = drain(s, "player2");
    expect(zoneOf(s, "player2", "RS-151:king")).toBe("discard");
    const handIds = s.players.player2.hand.map((c) => c.cardId).sort();
    expect(handIds).toEqual(["RS-152", "RS-153", "RS-154", "RS-155", "RS-156"]);
    expect(s.players.player2.discard.some((c) => c.cardId === "TST-UNIT-0")).toBe(true);
  });

  it("RS-176: 撃破しない（任意）ことを選べる（出典: atwiki/page-342「撃破してもよい」）", () => {
    let s = rushTanken(kingField()).state;
    expect(legalOfType(s, "skip_effect_choice").some((a) => a.playerId === "player1")).toBe(true);
    s = settle(act(s, { type: "skip_effect_choice", playerId: "player1" }));
    expect(zoneOf(s, "player2", "RS-151:king")).toBe("battle");
    expect(s.players.player2.hand).toHaveLength(0);
  });

  it("RS-176: 合体を必要としない L ユニットを撃破しても手札に戻るカードはない（出典: atwiki/page-342）", () => {
    let s = rushTanken(kingField()).state;
    s = settle(act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "TST-UNIT-7:zordB" }));
    s = drain(s, "player2");
    expect(zoneOf(s, "player2", "TST-UNIT-7:zordB")).toBe("discard");
    expect(s.players.player2.hand).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-177 ゴーゴージェット", () => {
  it("RS-177: カタログ本文・スペックが出典と一致（出典: atwiki/page-359）", () => {
    expectCatalogText(
      "RS-177",
      "【空輸】これをラッシュしたとき、次の効果を発動できる。自軍山札を見て、コンビネーションナンバーに「L」または「R」とあるカードがあれば1枚選んでラッシュエリアに出す。その後、山札をシャッフルする。",
    );
    expectStats("RS-177", {
      name: "ゴーゴージェット",
      category: "ET",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: "5+",
      features: ["メカ", "航空機"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  it("RS-177: 追加条件 — S ユニットをコマンドゾーンにも捨札にも送れ、S がなければラッシュできない（出典: atwiki/page-359）", () => {
    expectSendSCondition("RS-177", 5);
  });

  function rushJet() {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-177", "j")],
        rush: [inst("TST-UNIT-0", "s")],
        command: releasedN(2, "TST-OP-ET", "et"),
        power: powerCards(5),
        deck: [inst("TST-OP", "op"), inst("RS-153", "cn2"), inst("RS-171", "cnL"), inst("RS-158", "cnR"), inst("RS-151", "zord")],
      },
    });
    const r = rushFromHand(s, "player1", "RS-177:j");
    expect(r.ok).toBe(true);
    return r.state;
  }

  // 「コンビネーションナンバーに「L」または「R」とあるカードがあれば1枚選んでラッシュエリアに出す」
  it("RS-177: ラッシュしたとき、山札の CN「L」「R」のカードだけを選べる（出典: atwiki/page-359）", () => {
    const s = rushJet();
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["RS-158:cnR", "RS-171:cnL"]);
  });

  // faq-card-3 RS-170 Q1「「ラッシュエリアに出す」とある効果は…ラッシュの条件（追加条件、必要パワー）に関わらずラッシュエリアに出すことができる」
  it("RS-177: 選んだカードは、カテゴリ・追加条件に関わらずラッシュエリアに出る（WB のガオエレファント）（出典: atwiki/page-359・grnrngr/faq-card-3 RS-170 Q1）", () => {
    let s = rushJet();
    s = settle(act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-158:cnR" }));
    expect(zoneOf(s, "player1", "RS-158:cnR")).toBe("rush");
    expect(s.players.player1.deck).toHaveLength(4);
  });

  it("RS-177: 効果を発動しない（任意）こともできる（出典: atwiki/page-359「次の効果を発動できる」）", () => {
    let s = rushJet();
    expect(legalOfType(s, "skip_effect_choice").some((a) => a.playerId === "player1")).toBe(true);
    s = settle(act(s, { type: "skip_effect_choice", playerId: "player1" }));
    expect(s.players.player1.deck).toHaveLength(5);
    expect(zoneOf(s, "player1", "RS-171:cnL")).toBe("deck");
  });

  it.todo(
    "RS-177: 「その後、山札をシャッフルする」（出典: atwiki/page-359）— シャッフルの有無は乱数の結果でしか観測できず、確定的なテストにできない",
  );
});

// ===========================================================================
describe("RS-178 ボウケンシルバー", () => {
  it("RS-178: カタログ本文・スペックが出典と一致（出典: atwiki/page-31）", () => {
    expectCatalogText(
      "RS-178",
      "【サガスナイパー】自軍ターン中、これがユニットを撃破したとき、自軍山札からユニットのカードを1枚選び、相手に見せてから手札に加えてもよい（選べるカードの必要パワーの数字は、これが撃破したユニットの必要パワーの数字以下に限る）。その後、山札をシャッフルする。",
    );
    expectStats("RS-178", {
      name: "ボウケンシルバー",
      category: "ET",
      size: "S",
      bp: 4000,
      sp: undefined,
      powerCost: 5,
      features: ["シルバー", "男"],
    });
  });

  const PC4 = sUnit("SPEC-PC4", { powerCost: "4+", bp: 2000, size: "M", sp: undefined });
  const PC3B = sUnit("SPEC-PC3-4000", { powerCost: 3, bp: 4000, sp: undefined });
  const silverDeck = () => [inst("TST-OP", "op"), inst("TST-UNIT-2", "c2"), inst("RS-152", "c4"), inst("RS-153", "c4b"), inst("RS-156", "c5")];

  function silverAttacks(defender: string, p2: Partial<GameState["players"]["player2"]> = {}, p1: Partial<GameState["players"]["player1"]> = {}) {
    let s = st(
      {
        player1: { battle: [inst("RS-178", "sv")], deck: silverDeck(), ...p1 },
        player2: { battle: [inst("SPEC-PC4", "e4")], ...p2 },
      },
      [PC4, PC3B],
    );
    s = settle(attack(s, "RS-178:sv", defender));
    return s;
  }

  // 「自軍ターン中、これがユニットを撃破したとき、自軍山札からユニットのカードを1枚選び…（選べるカードの必要パワーの数字は、これが撃破したユニットの必要パワーの数字以下に限る）」
  it("RS-178: 自軍ターン中に必要パワー「4+」のユニットを撃破すると、山札の必要パワー4以下のユニットカードだけを選べる（出典: atwiki/page-31）", () => {
    const s = silverAttacks("SPEC-PC4:e4");
    expect(zoneOf(s, "player2", "SPEC-PC4:e4")).toBe("discard");
    expect(s.pendingEffectChoice?.effectId).toBe("sagas_sniper");
    expect(choiceIds(s)).toEqual(["RS-152:c4", "RS-153:c4b", "TST-UNIT-2:c2"]);
  });

  it("RS-178: 選んだカードを手札に加える（出典: atwiki/page-31）", () => {
    let s = silverAttacks("SPEC-PC4:e4");
    s = settle(act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-152:c4" }));
    if (s.pendingEffectChoice?.playerId === "player1" && legalOfType(s, "confirm_effect_choice").length > 0) {
      s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    }
    expect(zoneOf(s, "player1", "RS-152:c4")).toBe("hand");
    expect(s.players.player1.deck).toHaveLength(4);
  });

  it("RS-178: 手札に加えない（任意）こともできる（出典: atwiki/page-31「手札に加えてもよい」）", () => {
    let s = silverAttacks("SPEC-PC4:e4");
    expect(legalOfType(s, "skip_effect_choice").some((a) => a.playerId === "player1")).toBe(true);
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(s.players.player1.hand).toHaveLength(0);
    expect(s.players.player1.deck).toHaveLength(5);
  });

  it("RS-178: 敵軍ターン中にアタックしてきたユニットを撃破しても発動しない（出典: atwiki/page-31「自軍ターン中」）", () => {
    let s = st(
      { activePlayer: "player2", player1: { battle: [inst("RS-178", "sv")], deck: silverDeck() }, player2: { battle: [inst("SPEC-PC4", "e4")] } },
      [PC4],
    );
    s = settle(attack(s, "SPEC-PC4:e4", "RS-178:sv", "player2"));
    expect(zoneOf(s, "player2", "SPEC-PC4:e4")).toBe("discard");
    expect(s.pendingEffectChoice?.effectId).not.toBe("sagas_sniper");
    expect(s.players.player1.hand).toHaveLength(0);
  });

  // faq-card-3 RS-178 Q2「お互いに撃破となっても、ユニットを撃破したことには違いありませんので…発動させることができます」
  it.fails("RS-178: 公式Q&A — バトルで引き分け、お互いに撃破となっても発動する（出典: grnrngr/faq-card-3 RS-178 Q2）", () => {
    // 既知の不具合: CARD-RS-178 【サガスナイパー】がバトルに勝ったときにしか発動せず、引き分けで相打ちのときは発動しない
    const s = silverAttacks("SPEC-PC3-4000:e3", { battle: [inst("SPEC-PC3-4000", "e3")] });
    expect(zoneOf(s, "player1", "RS-178:sv")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-PC3-4000:e3")).toBe("discard");
    expect(s.pendingEffectChoice?.effectId).toBe("sagas_sniper");
    expect(choiceIds(s)).toEqual(["TST-UNIT-2:c2"]);
  });

  // faq-card-3 RS-178 Q1「「サガスナイパー」の効果は、撃破したユニットの持ち主に関わらず発動させることができます」
  it("RS-178: 公式Q&A — 隠流忍術でかわりにバトルした味方（自軍）のユニットをバトルで撃破したときも発動する（撃破したユニットの持ち主は問わない）（出典: grnrngr/faq-card-3 RS-178 Q1）", () => {
    let s = st(
      {
        player1: { battle: [inst("RS-178", "sv"), inst("TST-UNIT-2", "ally")], deck: silverDeck() },
        player2: {
          battle: [inst("TST-UNIT-0", "def")],
          hand: [inst("RS-018", "n")],
          command: releasedN(2, "TST-OP-MA", "ma"),
          power: powerCards(5, "e"),
        },
      },
      [PC3B],
    );
    s = attack(s, "RS-178:sv", "TST-UNIT-0:def");
    s = settle(useNinja(s, "RS-018:n", "TST-UNIT-2:ally"));
    expect(zoneOf(s, "player1", "TST-UNIT-2:ally")).toBe("discard");
    expect(s.pendingEffectChoice?.effectId).toBe("sagas_sniper");
    expect(choiceIds(s)).toEqual(["TST-UNIT-2:c2"]);
  });

  it.fails("RS-178: 公式Q&A — 隠流忍術で味方（自軍）のユニットとバトルさせられ、引き分けでお互いに撃破となっても発動する（出典: grnrngr/faq-card-3 RS-178 Q1）", () => {
    // 既知の不具合: CARD-RS-178 引き分け（相打ち）では【サガスナイパー】が発動しない（Q2 と同じ原因）
    let s = st(
      {
        player1: { battle: [inst("RS-178", "sv"), inst("SPEC-PC3-4000", "ally")], deck: silverDeck() },
        player2: {
          battle: [inst("TST-UNIT-0", "def")],
          hand: [inst("RS-018", "n")],
          command: releasedN(2, "TST-OP-MA", "ma"),
          power: powerCards(5, "e"),
        },
      },
      [PC3B],
    );
    s = attack(s, "RS-178:sv", "TST-UNIT-0:def");
    s = settle(useNinja(s, "RS-018:n", "SPEC-PC3-4000:ally"));
    expect(zoneOf(s, "player1", "SPEC-PC3-4000:ally")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-178:sv")).toBe("discard");
    expect(s.pendingEffectChoice?.effectId).toBe("sagas_sniper");
    expect(choiceIds(s)).toEqual(["TST-UNIT-2:c2"]);
  });
});

void [fillers, legal, strike, endTurn, attackTargets, toPhase, passEntry];
