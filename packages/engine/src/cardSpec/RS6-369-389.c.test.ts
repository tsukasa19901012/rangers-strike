/**
 * カード別スペック: RS-382〜RS-389（第6弾「紅き六戦士の帰還」ビクトリーロボ〜ゴーブルー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-6
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_6.html。RS-386 Q、SR-004 の Q に RS-385）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール（R-ADD-04 コマンドゾーンに送るか捨札、R-ADD-06 合体、R-CN-02）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { enterBattleByEffect } from "../testing/battleEntry";
import {
  act,
  attackTargets,
  canSkip,
  canStartRush,
  choiceIds,
  confirm,
  deckCards,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  holdEffectOffered,
  inst,
  legal,
  nextPhase,
  passEntry,
  pick,
  powerCards,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  strike,
  sUnit,
  zoneIds,
  zoneOf,
} from "./RS6-369-389.helpers";
import type { GameState } from "../types/game";

const S_VEHICLE_UNIT = sUnit("SPEC-S-CAR", { features: ["車両"] });
const SPECS = [S_VEHICLE_UNIT];

/** ラッシュフェイズ: M ユニット id（追加条件「自軍Sユニットを1体コマンドゾーンに送るか捨札にする」）を素材 TST-UNIT-0:m で手札からラッシュする。 */
function rushGogo(
  id: string,
  power: number,
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  destination: "command" | "discard" = "discard",
) {
  const s = st(
    {
      phase: "rush",
      player1: {
        hand: [inst(id, "x")],
        command: releasedCat("ET", 1),
        power: powerCards(power),
        deck: deckCards(5),
        ...p1,
        rush: [inst("TST-UNIT-0", "m"), ...(p1.rush ?? [])],
      },
      player2: { deck: deckCards(5, "e"), ...p2 },
    },
    SPECS,
  );
  return rushFromHand(s, "player1", `${id}:x`, { materials: ["TST-UNIT-0:m"], destination });
}

// ===========================================================================
describe("RS-382 ビクトリーロボ", () => {
  const TEXT =
    "合体―レッドラダー＋ブルースローワー＋グリーンホバー＋イエローアーマー＋ピンクエイダー 【人の命は地球の未来】これはストライクするとき、このターン中に自軍捨札から手札に加えたSユニットのカード1枚につきSP+1される。";

  it("RS-382: カタログ本文・スペックが出典と一致（出典: atwiki/page-541）", () => {
    expectCatalogText("RS-382", TEXT);
    expectStats("RS-382", {
      name: "ビクトリーロボ",
      category: "ET",
      size: "L",
      bp: 12000,
      sp: 1,
      powerCost: "7+",
      comboNumber: undefined,
      features: ["メカ", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  const FIVE = () => [inst("RS-383", "rl"), inst("RS-384", "bs"), inst("RS-385", "gh"), inst("RS-386", "ya"), inst("RS-387", "pe")];
  const robo = (rush: ReturnType<typeof inst>[], power = 7) =>
    st({ phase: "rush", player1: { hand: [inst("RS-382", "vr")], rush, command: releasedCat("ET", 1), power: powerCards(power), deck: deckCards(5) } });

  it("RS-382: 追加条件 — 合体の5体を自軍エリアから捨札にしてラッシュできる（出典: atwiki/page-541「合体―…」・R-ADD-06）", () => {
    const r = rushFromHand(robo(FIVE()), "player1", "RS-382:vr");
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RS-382:vr")).toBe("rush");
    for (const id of ["RS-383:rl", "RS-384:bs", "RS-385:gh", "RS-386:ya", "RS-387:pe"]) expect(zoneOf(s, "player1", id)).toBe("discard");
  });

  it("RS-382: 追加条件 — 合体ユニットが自軍エリアに1体もなければラッシュできない（出典: atwiki/page-541「追加条件：自軍合体ユニットを捨札にする」）", () => {
    expect(canStartRush(robo([]), "player1", "RS-382:vr")).toBe(false);
  });

  it("RS-382: 必要パワー7+ — パワー6ではラッシュできない（出典: atwiki/page-541「必要パワー：7+」）", () => {
    expect(canStartRush(robo(FIVE(), 6), "player1", "RS-382:vr")).toBe(false);
  });

  /**
   * ラッシュフェイズにブルバルカン（RS-075【救助活動】: ラッシュしたとき自軍捨札からメカのユニットカードを1枚手札に加える）を
   * n 回ラッシュしてタック（RS-223、メカの S ユニット）を n 枚手札に加え、バトルフェイズにビクトリーロボでストライクし、敵軍のダメージ数を返す。
   * （RS-383【救出作業】は CARD-RS-383 の不具合で手札に加わらないため、捨札回収はブルバルカンで行う。）
   */
  function roboStrike(n: number) {
    const hand = Array.from({ length: n }, (_, i) => inst("RS-075", `bv${i}`));
    const mats = Array.from({ length: 2 * n }, (_, i) => inst("TST-UNIT-0", `m${i}`));
    let s = st({
      phase: "rush",
      player1: {
        hand,
        rush: [...mats, inst("RS-382", "vr")],
        discard: [inst("RS-223", "t0"), inst("RS-223", "t1")],
        command: releasedCat("ET", 2),
        power: powerCards(7),
        deck: deckCards(5),
      },
      player2: { deck: deckCards(8, "e") },
    });
    for (let i = 0; i < n; i++) {
      const r = rushFromHand(s, "player1", `RS-075:bv${i}`, { materials: [`TST-UNIT-0:m${2 * i}`, `TST-UNIT-0:m${2 * i + 1}`], destination: "command" });
      expect(r.ok).toBe(true);
      s = resolveAll(pick(r.state, `RS-223:t${i}`));
      expect(zoneOf(s, "player1", `RS-223:t${i}`)).toBe("hand");
    }
    s = nextPhase(s);
    expect(s.phase).toBe("battle");
    s = enter(s, "RS-382:vr");
    s = settle(strike(s, "RS-382:vr"));
    return s.players.player2.power.filter((c) => c.faceDown).length;
  }

  it("RS-382: 【人の命は地球の未来】このターン捨札から手札に加えた S ユニットがなければ SP1 のまま（1点）（出典: atwiki/page-541「SP：1」）", () => {
    expect(roboStrike(0)).toBe(1);
  });

  it.fails("RS-382: 【人の命は地球の未来】このターン自軍捨札から手札に加えた S ユニットのカード1枚につき SP+1（1枚で2点、2枚で3点）（出典: atwiki/page-541）", () => {
    // 既知の不具合: CARD-RS-382 SP 加算が NC 効果（victory_robo_strike）の発動を条件にしており、ナンバーを持たないビクトリーロボでは発動しない
    expect(roboStrike(1)).toBe(2);
    expect(roboStrike(2)).toBe(3);
  });

  // grnrngr/faq-card-6 / atwiki/page-541 Q1「はい、できます。」（XG2-041 スーパーシンケンイエローで繰り返し）
  it.todo(
    "RS-382: Q&A — スーパーシンケンイエロー【真・土煙の舞い】で同じカードを繰り返し捨札から手札に加えれば、その都度 SP+1 を得る（出典: atwiki/page-541 Q1）— XG2-041 がエンジンのカタログにないため駆動できない",
  );

  // atwiki/page-541 Q2「はい、できます。」
  it.todo(
    "RS-382: Q&A — レッドラダー・グリーンホバー・ビクトリーウォーカー（XG3-006）の3体を捨札にしてラッシュできる（出典: atwiki/page-541 Q2）— XG3-006 がエンジンのカタログにないため駆動できない",
  );
});

// ===========================================================================
describe("RS-383 レッドラダー", () => {
  const TEXT = "【救出作業】これをラッシュしたとき、自軍捨札から、Sユニットのカードを2枚まで選び手札に加えてもよい。";

  it("RS-383: カタログ本文・スペックが出典と一致（出典: atwiki/page-528）", () => {
    expectCatalogText("RS-383", TEXT);
    expectStats("RS-383", {
      name: "レッドラダー",
      category: "ET",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: "7+",
      comboNumber: undefined,
      features: ["メカ", "車両"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  it("RS-383: 追加条件 — 自軍 S ユニット1体をコマンドゾーンに送ってラッシュできる（リリース状態で置く）（出典: atwiki/page-528・R-ADD-04）", () => {
    const r = rushGogo("RS-383", 7, {}, {}, "command");
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RS-383:x")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:m")).toBe("command");
    expect(s.players.player1.command.find((c) => c.instanceId === "TST-UNIT-0:m")?.commandHeld ?? false).toBe(false);
  });

  it("RS-383: 追加条件 — 捨札にすることも選べる（出典: atwiki/page-528「コマンドゾーンに送るか捨札にする」・R-ADD-04）", () => {
    const r = rushGogo("RS-383", 7);
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:m")).toBe("discard");
  });

  it("RS-383: 追加条件 — 自軍 S ユニットがいなければラッシュできない／必要パワー7+ はパワー6では不可（出典: atwiki/page-528）", () => {
    const noMat = st({ phase: "rush", player1: { hand: [inst("RS-383", "x")], command: releasedCat("ET", 1), power: powerCards(7), deck: deckCards(3) } });
    expect(canStartRush(noMat, "player1", "RS-383:x")).toBe(false);
    const low = st({ phase: "rush", player1: { hand: [inst("RS-383", "x")], rush: [inst("TST-UNIT-0", "m")], command: releasedCat("ET", 1), power: powerCards(6), deck: deckCards(3) } });
    expect(canStartRush(low, "player1", "RS-383:x")).toBe(false);
  });

  const DISCARD = () => [inst("RS-376", "s1"), inst("RS-377", "s2"), inst("RS-378", "s3"), inst("RS-384", "mu"), inst("TST-OP", "op")];

  it("RS-383: 【救出作業】ラッシュしたとき、自軍捨札の S ユニットのカードだけが候補（M ユニット・オペレーションは不可）（出典: atwiki/page-528「Sユニットのカード」）", () => {
    const r = rushGogo("RS-383", 7, { discard: DISCARD() }, {}, "command");
    expect(choiceIds(r.state)).toEqual(["RS-376:s1", "RS-377:s2", "RS-378:s3"]);
  });

  it.fails("RS-383: 【救出作業】2枚まで選んで手札に加える（出典: atwiki/page-528「2枚まで選び手札に加えてもよい」）", () => {
    // 既知の不具合: CARD-RS-383 2枚目を選ぶと効果が「見送り（skipped）」で終わり、選んだカードが手札に加わらない
    let s = rushGogo("RS-383", 7, { discard: DISCARD() }, {}, "command").state;
    s = pick(pick(s, "RS-376:s1"), "RS-378:s3");
    if (s.pendingEffectChoice?.sourceCardId === "RS-383") s = confirm(s);
    s = resolveAll(s);
    expect(zoneIds(s, "player1", "hand").sort()).toEqual(["RS-376:s1", "RS-378:s3"]);
    expect(zoneOf(s, "player1", "RS-377:s2")).toBe("discard");
  });

  it("RS-383: 【救出作業】は任意 — 加えないこともできる（出典: atwiki/page-528「手札に加えてもよい」）", () => {
    let s = rushGogo("RS-383", 7, { discard: DISCARD() }, {}, "command").state;
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it("RS-383: 【救出作業】捨札の敵軍の S ユニットは選べない（出典: atwiki/page-528「自軍捨札から」）", () => {
    const r = rushGogo("RS-383", 7, { discard: [inst("RS-376", "s1")] }, { discard: [inst("RS-377", "es")] }, "command");
    expect(choiceIds(r.state)).toEqual(["RS-376:s1"]);
  });
});

// ===========================================================================
describe("RS-384 ブルースローワー", () => {
  const TEXT =
    "【放水作業】これをラッシュしたとき、敵軍コマンドの数が自軍コマンドの数より多ければ、同じ数になるまで、以下の手順を行ってもよい⇒自軍山札の上から1枚ひいて、そのカードを自軍コマンドゾーンにホールド状態で置く。";

  it("RS-384: カタログ本文・スペックが出典と一致（出典: atwiki/page-529）", () => {
    expectCatalogText("RS-384", TEXT);
    expectStats("RS-384", {
      name: "ブルースローワー",
      category: "ET",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: "4+",
      comboNumber: undefined,
      features: ["メカ", "車両"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  it("RS-384: 追加条件・必要パワー4+ — 自軍 S ユニットを捨札にしてパワー4でラッシュでき、パワー3ではできない（出典: atwiki/page-529）", () => {
    const r = rushGogo("RS-384", 4);
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state, [], 0), "player1", "RS-384:x")).toBe("rush");
    const low = st({ phase: "rush", player1: { hand: [inst("RS-384", "x")], rush: [inst("TST-UNIT-0", "m")], command: releasedCat("ET", 1), power: powerCards(3), deck: deckCards(3) } });
    expect(canStartRush(low, "player1", "RS-384:x")).toBe(false);
  });

  it.fails("RS-384: 【放水作業】敵軍コマンド4・自軍コマンド1なら、自軍山札の上から3枚をホールド状態で自軍コマンドゾーンに置き、同じ数にできる（出典: atwiki/page-529）", () => {
    // 既知の不具合: CARD-RS-384 「敵軍コマンドを1つ選んでホールドする」別の処理になっている（自軍山札からコマンドを置かない）
    let s = rushGogo("RS-384", 4, {}, { command: releasedCat("WB", 4, "ec") }).state;
    if (s.pendingEffectChoice?.sourceCardId === "RS-384" && legal(s).some((a) => a.type === "confirm_effect_choice")) s = confirm(s);
    s = resolveAll(s);
    expect(s.players.player1.command).toHaveLength(4);
    expect(s.players.player1.command.filter((c) => c.instanceId.startsWith("TST-OP:dk")).every((c) => c.commandHeld)).toBe(true);
    expect(s.players.player1.deck).toHaveLength(2);
    expect(s.players.player2.command.every((c) => !c.commandHeld)).toBe(true);
  });

  it.fails("RS-384: 【放水作業】は任意 — 行わないこともできる（出典: atwiki/page-529「以下の手順を行ってもよい」）", () => {
    // 既知の不具合: CARD-RS-384 見送れない「敵軍コマンドを1つ選んでホールドする」選択が出る
    let s = rushGogo("RS-384", 4, {}, { command: releasedCat("WB", 4, "ec") }).state;
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(s.players.player1.command).toHaveLength(1);
    expect(s.players.player2.command.every((c) => !c.commandHeld)).toBe(true);
  });

  it.fails("RS-384: 【放水作業】敵軍コマンドの数が自軍コマンドの数より多くなければ何もしない（素材をコマンドゾーンに送って同数になった場合も）（出典: atwiki/page-529「敵軍コマンドの数が自軍コマンドの数より多ければ」）", () => {
    // 既知の不具合: CARD-RS-384 敵軍コマンドがあれば数に関係なく「敵軍コマンドを1つ選んでホールドする」選択が出る
    const s = rushGogo("RS-384", 4, {}, { command: releasedCat("WB", 2, "ec") }, "command").state;
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player1.command).toHaveLength(2);
    expect(s.players.player1.deck).toHaveLength(5);
    expect(s.players.player2.command.every((c) => !c.commandHeld)).toBe(true);
  });
});

// ===========================================================================
describe("RS-385 グリーンホバー", () => {
  const TEXT =
    "※これは、特徴「航空機」を持たないユニットにアタックされない。 【特殊消化弾】これが自軍ラッシュエリアにある間、自軍コマンドゾーンにホールド状態でカードを置くとき、かわりにリリース状態で置いてもよい。";

  it("RS-385: カタログ本文・スペックが出典と一致（出典: atwiki/page-530）", () => {
    expectCatalogText("RS-385", TEXT);
    expectStats("RS-385", {
      name: "グリーンホバー",
      category: "ET",
      size: "M",
      bp: 2000,
      sp: undefined,
      powerCost: "4+",
      comboNumber: undefined,
      features: ["メカ", "航空機"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  it("RS-385: 追加条件・必要パワー4+ — 自軍 S ユニットを送ってパワー4でラッシュできる（出典: atwiki/page-530）", () => {
    const r = rushGogo("RS-385", 4);
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-385:x")).toBe("rush");
  });

  it("RS-385: ※ 特徴「航空機」を持たないユニットにアタックされない（出典: atwiki/page-530）", () => {
    let s = st({ player1: { rush: [inst("TST-UNIT-7", "a")], deck: deckCards(3) }, player2: { battle: [inst("RS-385", "gh"), inst("TST-UNIT-0", "e")] } });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: "TST-UNIT-7:a" });
    expect(attackTargets(s, "TST-UNIT-7:a")).not.toContain("RS-385:gh");
    expect(attackTargets(s, "TST-UNIT-7:a")).toContain("TST-UNIT-0:e");
  });

  it("RS-385: ※ 特徴「航空機」を持つユニット（ジェットファルコン）にはアタックされる（出典: atwiki/page-530「「航空機」を持たないユニットに」）", () => {
    const s = st({ player1: { battle: [inst("RS-135", "jf")], deck: deckCards(3) }, player2: { battle: [inst("RS-385", "gh")] } });
    expect(attackTargets(s, "RS-135:jf")).toContain("RS-385:gh");
  });

  it.fails("RS-385: 【特殊消化弾】自軍ラッシュエリアにある間、自軍コマンドゾーンにホールド状態で置くカード（ブルースローワー【放水作業】）をリリース状態で置ける（出典: atwiki/page-530）", () => {
    // 既知の不具合: CARD-RS-385 【特殊消化弾】が働かない（CARD-RS-384 【放水作業】も未実装）
    let s = rushGogo("RS-384", 4, { rush: [inst("RS-385", "gh")] }, { command: releasedCat("WB", 3, "ec") }).state;
    for (let i = 0; i < 6 && s.pendingEffectChoice?.playerId === "player1"; i++) {
      s = legal(s).some((a) => a.type === "confirm_effect_choice") ? confirm(s) : pick(s, s.pendingEffectChoice.validInstanceIds[0]!);
    }
    s = resolveAll(s);
    const placed = s.players.player1.command.filter((c) => c.instanceId.startsWith("TST-OP:dk"));
    expect(placed).toHaveLength(2);
    expect(placed.every((c) => !c.commandHeld)).toBe(true);
  });

  // grnrngr/faq-card-6 SR-004「リリース状態で置いた後、「SR-004 へドリアン女王(２nd)」の効果でホールド状態になります。」
  it.fails("RS-385: 公式Q&A — 敵軍にヘドリアン女王（2nd）があるとき、チャージフェイズに置く ET のカードはリリース状態で置いた後ホールド状態になる（出典: grnrngr/faq-card-6 SR-004 Q）", () => {
    // 既知の不具合: CARD-SR-004 【妖魔力】が働かず、チャージした ET のカードがリリース状態のまま（グリーンホバーの有無に関係ない）
    let s = st({
      phase: "charge",
      player1: { rush: [inst("RS-385", "gh")], hand: [inst("TST-OP-ET", "ch")], deck: deckCards(3) },
      player2: { rush: [inst("SR-004", "hd")] },
    });
    s = act(s, { type: "charge_command", playerId: "player1", instanceId: "TST-OP-ET:ch" });
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "TST-OP-ET:ch")).toBe("command");
    expect(s.players.player1.command.find((c) => c.instanceId === "TST-OP-ET:ch")?.commandHeld).toBe(true);
  });
});

// ===========================================================================
describe("RS-386 イエローアーマー", () => {
  const TEXT =
    "※これはアタックすることができない。 【ショベルアーム】自軍ターン中、これがバトルエリアに出たとき、自軍捨札から特徴「車両」を持つMユニットのカードを1枚選び、自軍ラッシュエリアに出してもよい。このとき出したユニットの効果は発動しない。";

  it("RS-386: カタログ本文・スペックが出典と一致（出典: atwiki/page-531）", () => {
    expectCatalogText("RS-386", TEXT);
    expectStats("RS-386", {
      name: "イエローアーマー",
      category: "ET",
      size: "M",
      bp: 9000,
      sp: undefined,
      powerCost: "6+",
      comboNumber: undefined,
      features: ["メカ", "車両"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  it("RS-386: 追加条件・必要パワー6+ — パワー6でラッシュでき、5ではできない（出典: atwiki/page-531）", () => {
    const r = rushGogo("RS-386", 6);
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-386:x")).toBe("rush");
    const low = st({ phase: "rush", player1: { hand: [inst("RS-386", "x")], rush: [inst("TST-UNIT-0", "m")], command: releasedCat("ET", 1), power: powerCards(5), deck: deckCards(3) } });
    expect(canStartRush(low, "player1", "RS-386:x")).toBe(false);
  });

  const DISCARD = () => [inst("RS-383", "rl"), inst("RS-385", "gh"), inst("SPEC-S-CAR", "sc"), inst("TST-UNIT-2", "m2")];
  const enterYA = (discard = DISCARD()) =>
    act(st({ player1: { rush: [inst("RS-386", "ya")], discard, deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e")] } }, SPECS), {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: "RS-386:ya",
    });

  it("RS-386: ※ アタックすることができない（出典: atwiki/page-531）", () => {
    let s = enterYA([]);
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "RS-386:ya")).toBe("battle");
    expect(attackTargets(s, "RS-386:ya")).toEqual([]);
  });

  it("RS-386: 【ショベルアーム】自軍ターン中にバトルエリアに出たとき、候補は自軍捨札の特徴「車両」の M ユニットのカードだけ（航空機・S ユニット・特徴なしは不可）（出典: atwiki/page-531）", () => {
    const s = enterYA();
    expect(choiceIds(s)).toEqual(["RS-383:rl"]);
  });

  it("RS-386: 【ショベルアーム】選んだカードを自軍ラッシュエリアに出す（出典: atwiki/page-531「自軍ラッシュエリアに出してもよい」）", () => {
    const s = resolveAll(pick(enterYA(), "RS-383:rl"));
    expect(zoneOf(s, "player1", "RS-383:rl")).toBe("rush");
  });

  it("RS-386: 【ショベルアーム】は任意 — 出さないこともできる（出典: atwiki/page-531「出してもよい」）", () => {
    let s = enterYA();
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player1", "RS-383:rl")).toBe("discard");
  });

  // grnrngr/faq-card-6 RS-386「「発動しない効果」とは「これをラッシュしたとき」という条件で発動する効果を指します」
  it.fails("RS-386: 公式Q&A — 出したユニットの「これをラッシュしたとき」の効果（レッドラダー【救出作業】）は発動しない（出典: grnrngr/faq-card-6 RS-386 Q）", () => {
    // 既知の不具合: CARD-RS-386 【ショベルアーム】で出したレッドラダーの【救出作業】（ラッシュしたとき）が発動する
    const s = resolveAll(pick(enterYA([inst("RS-383", "rl"), inst("RS-376", "s1")]), "RS-383:rl"));
    expect(zoneOf(s, "player1", "RS-383:rl")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-376:s1")).toBe("discard");
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  it("RS-386: 公式Q&A — 「発動しない」のはラッシュエリアに出したときの効果だけで、出したユニットのそれ以外のテキストは有効（グリーンホバー相当の ※ を持たないため、出したブルースローワーの本文が残ることをカタログ上で確認）（出典: grnrngr/faq-card-6 RS-386 Q「前者の解釈で間違いありません」）", () => {
    const s = resolveAll(pick(enterYA([inst("RS-384", "bs")]), "RS-384:bs"));
    expect(zoneOf(s, "player1", "RS-384:bs")).toBe("rush");
    expect(s.players.player1.command).toHaveLength(0);
  });

  it("RS-386: 【ショベルアーム】敵軍ターン中にバトルエリアに出されたときは発動しない（出典: atwiki/page-531「自軍ターン中、」）", () => {
    let s = st({ activePlayer: "player2", player1: { rush: [inst("RS-386", "ya")], discard: [inst("RS-383", "rl")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    s = enterBattleByEffect(s, "player1", "RS-386:ya");
    expect(zoneOf(s, "player1", "RS-386:ya")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-386");
    expect(zoneOf(s, "player1", "RS-383:rl")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-387 ピンクエイダー", () => {
  const TEXT = "【緊急車両誘導】これをラッシュしたとき、ライドされていないSビークルがあれば、すべて持ち主の山札の下に好きな順で戻してもよい。";

  it("RS-387: カタログ本文・スペックが出典と一致（出典: atwiki/page-532）", () => {
    expectCatalogText("RS-387", TEXT);
    expectStats("RS-387", {
      name: "ピンクエイダー",
      category: "ET",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: "3+",
      comboNumber: undefined,
      features: ["メカ", "車両"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  it("RS-387: 追加条件・必要パワー3+ — パワー3でラッシュでき、2ではできない（出典: atwiki/page-532）", () => {
    const r = rushGogo("RS-387", 3);
    expect(r.ok).toBe(true);
    const low = st({ phase: "rush", player1: { hand: [inst("RS-387", "x")], rush: [inst("TST-UNIT-0", "m")], command: releasedCat("ET", 1), power: powerCards(2), deck: deckCards(3) } });
    expect(canStartRush(low, "player1", "RS-387:x")).toBe(false);
  });

  it("RS-387: 【緊急車両誘導】ライドされていない S ビークルを（自軍・敵軍とも）すべて持ち主の山札の下に戻す（出典: atwiki/page-532）", () => {
    let s = rushGogo("RS-387", 3, { rush: [inst("RK-045", "v1")] }, { rush: [inst("RS-381", "v2")] }).state;
    s = resolveAll(confirm(s));
    expect(zoneOf(s, "player1", "RK-045:v1")).toBe("deck");
    expect(s.players.player1.deck.at(-1)?.instanceId).toBe("RK-045:v1");
    expect(zoneOf(s, "player2", "RS-381:v2")).toBe("deck");
    expect(s.players.player2.deck.at(-1)?.instanceId).toBe("RS-381:v2");
  });

  it("RS-387: 【緊急車両誘導】ライドされているビークルは戻さない（出典: atwiki/page-532「ライドされていないSビークル」）", () => {
    let s = rushGogo("RS-387", 3, {}, { rush: [inst("RS-381", "v2"), { ...inst("RS-376", "rider"), mountedOnInstanceId: "RS-381:v2" }, inst("RK-045", "v3")] }).state;
    s = resolveAll(confirm(s));
    expect(zoneOf(s, "player2", "RS-381:v2")).toBe("rush");
    expect(zoneOf(s, "player2", "RK-045:v3")).toBe("deck");
  });

  it("RS-387: 【緊急車両誘導】は任意 — 戻さないこともできる（出典: atwiki/page-532「戻してもよい」）", () => {
    let s = rushGogo("RS-387", 3, { rush: [inst("RK-045", "v1")] }, { rush: [inst("RS-381", "v2")] }).state;
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player1", "RK-045:v1")).toBe("rush");
    expect(zoneOf(s, "player2", "RS-381:v2")).toBe("rush");
  });

  it.fails("RS-387: 【緊急車両誘導】同じ持ち主の山札の下に戻す順は自分が選べる（出典: atwiki/page-532「好きな順で戻してもよい」）", () => {
    // 既知の不具合: CARD-RS-387 戻す順を選ぶ手段がなく、場の並び順で自動的に戻す
    let s = rushGogo("RS-387", 3, {}, { rush: [inst("RS-381", "v2"), inst("RK-045", "v3")] }).state;
    s = confirm(s);
    expect(choiceIds(s)).toEqual(["RK-045:v3", "RS-381:v2"]);
    s = resolveAll(pick(s, "RK-045:v3"));
    expect(s.players.player2.deck.slice(-2).map((c) => c.instanceId)).toEqual(["RK-045:v3", "RS-381:v2"]);
  });
});

// ===========================================================================
describe("RS-388 ゴーレッド（2nd）", () => {
  const TEXT = "【ブイランサー】「SP1」（この効果は、このターン、自軍捨札からSユニットのカードを1枚以上手札に加えていればナンバーに関係なく発動する）";

  it("RS-388: カタログ本文・スペックが出典と一致（出典: atwiki/page-537）", () => {
    expectCatalogText("RS-388", TEXT);
    expectStats("RS-388", { name: "ゴーレッド（2nd）", category: "ET", size: "S", bp: 3000, sp: "special", powerCost: 4, comboNumber: 5, features: ["レッド", "男", "2nd"] });
  });

  it("RS-388: 【ブイランサー】NC 成立（5番目）で SP1（出典: atwiki/page-537「「SP1」」）", () => {
    const s = act(st({ player1: { rush: [inst("RS-388", "x")], battle: fillers(4), deck: deckCards(3) } }), { type: "move_to_battle", playerId: "player1", instanceId: "RS-388:x" });
    expect(spOf(s, "player1", "RS-388:x")).toBe(1);
  });

  it("RS-388: NC 不成立（1番目）で、このターン捨札から S ユニットを手札に加えていなければ SP はない（出典: atwiki/page-537・R-CN-02）", () => {
    const s = act(st({ player1: { rush: [inst("RS-388", "x")], deck: deckCards(3) } }), { type: "move_to_battle", playerId: "player1", instanceId: "RS-388:x" });
    expect(spOf(s, "player1", "RS-388:x")).toBe(0);
  });

  /** ラッシュフェイズにブルバルカン（RS-075【救助活動】）をラッシュし、rescue なら捨札のタック（S ユニット）を手札に加え、バトルフェイズにゴーレッド（2nd）を1番目に出す。 */
  function afterRescue(rescue: boolean) {
    let s = st({
      phase: "rush",
      player1: {
        hand: rescue ? [inst("RS-075", "bv")] : [],
        rush: [inst("TST-UNIT-0", "m0"), inst("TST-UNIT-0", "m1"), inst("RS-388", "x")],
        discard: [inst("RS-223", "t0")],
        command: releasedCat("ET", 1),
        power: powerCards(7),
        deck: deckCards(5),
      },
      player2: { deck: deckCards(5, "e") },
    });
    if (rescue) {
      const r = rushFromHand(s, "player1", "RS-075:bv", { materials: ["TST-UNIT-0:m0", "TST-UNIT-0:m1"], destination: "command" });
      s = resolveAll(pick(r.state, "RS-223:t0"));
      expect(zoneOf(s, "player1", "RS-223:t0")).toBe("hand");
    }
    s = nextPhase(s);
    return act(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-388:x" });
  }

  it.fails("RS-388: 【ブイランサー】このターン自軍捨札から S ユニットのカードを手札に加えていれば、ナンバーに関係なく（1番目でも）SP1（出典: atwiki/page-537「ナンバーに関係なく発動する」）", () => {
    // 既知の不具合: CARD-RS-388 「捨札から S ユニットを手札に加えていればナンバーに関係なく発動」の条件がなく、NC 不成立なら SP0
    const s = afterRescue(true);
    expect(spOf(s, "player1", "RS-388:x")).toBe(1);
  });

  it("RS-388: 【ブイランサー】捨札から手札に加えなかったターンは、1番目では SP はない（出典: atwiki/page-537「…手札に加えていれば」）", () => {
    const s = afterRescue(false);
    expect(spOf(s, "player1", "RS-388:x")).toBe(0);
  });
});

// ===========================================================================
describe("RS-389 ゴーブルー", () => {
  const TEXT =
    "【人命検索】自軍捨札をすべてウラ向きにしてシャッフルしてもよい。そうしたとき、その中から相手にウラ向きのまま1枚選ばせてから、すべてオモテにする。相手の選んだカードがSユニットのカードだったなら、そのユニットカードを自分の手札に加える。";

  it("RS-389: カタログ本文・スペックが出典と一致（出典: atwiki/page-533）", () => {
    expectCatalogText("RS-389", TEXT);
    expectStats("RS-389", { name: "ゴーブルー", category: "ET", size: "S", bp: 2000, sp: undefined, powerCost: 1, comboNumber: 3, features: ["ブルー", "男"] });
  });

  const enterGB = (discard: ReturnType<typeof inst>[], cn = 3) =>
    act(st({ player1: { rush: [inst("RS-389", "x")], battle: fillers(cn - 1), discard, deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }), {
      type: "move_to_battle",
      playerId: "player1",
      instanceId: "RS-389:x",
    });

  it.fails("RS-389: 【人命検索】NC 成立（3番目）で、捨札をシャッフルしたら相手が自軍捨札から1枚選ぶ（候補は自軍捨札のカード）（出典: atwiki/page-533）", () => {
    // 既知の不具合: CARD-RS-389 自軍山札の上を見て1枚手札に加える別の処理になっている（捨札・相手の選択がない）
    let s = enterGB([inst("TST-UNIT-0", "s"), inst("TST-OP", "op"), inst("TST-UNIT-2", "mu")]);
    if (s.pendingEffectChoice?.playerId === "player1" && legal(s).some((a) => a.type === "confirm_effect_choice")) s = confirm(s);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-OP:op", "TST-UNIT-0:s", "TST-UNIT-2:mu"]);
  });

  it.fails("RS-389: 【人命検索】相手の選んだカードが S ユニットのカードなら手札に加える（出典: atwiki/page-533）", () => {
    // 既知の不具合: CARD-RS-389 捨札・相手の選択がない
    let s = enterGB([inst("TST-UNIT-0", "s"), inst("TST-OP", "op")]);
    if (s.pendingEffectChoice?.playerId === "player1" && legal(s).some((a) => a.type === "confirm_effect_choice")) s = confirm(s);
    s = resolveAll(act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "TST-UNIT-0:s" }));
    expect(zoneOf(s, "player1", "TST-UNIT-0:s")).toBe("hand");
    expect(zoneOf(s, "player1", "TST-OP:op")).toBe("discard");
  });

  it.fails("RS-389: 【人命検索】相手の選んだカードが S ユニットでなければ（オペレーション・M ユニット）手札に加えず、捨札はすべてオモテに戻る（出典: atwiki/page-533）", () => {
    // 既知の不具合: CARD-RS-389 捨札・相手の選択がない
    let s = enterGB([inst("TST-UNIT-0", "s"), inst("TST-OP", "op")]);
    if (s.pendingEffectChoice?.playerId === "player1" && legal(s).some((a) => a.type === "confirm_effect_choice")) s = confirm(s);
    s = resolveAll(act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "TST-OP:op" }));
    expect(s.players.player1.hand).toHaveLength(0);
    expect(zoneIds(s, "player1", "discard").sort()).toEqual(["TST-OP:op", "TST-UNIT-0:s"]);
    expect(s.players.player1.discard.every((c) => !c.faceDown)).toBe(true);
  });

  it("RS-389: 【人命検索】は任意 — シャッフルしなければ何も起きない（出典: atwiki/page-533「シャッフルしてもよい」）", () => {
    let s = enterGB([inst("TST-UNIT-0", "s"), inst("TST-OP", "op")]);
    if (s.pendingEffectChoice?.sourceCardId === "RS-389") s = skip(s);
    s = resolveAll(s);
    expect(s.players.player1.hand).toHaveLength(0);
    expect(zoneIds(s, "player1", "discard").sort()).toEqual(["TST-OP:op", "TST-UNIT-0:s"]);
  });

  it("RS-389: NC 不成立（1番目）なら【人命検索】は発動しない（出典: atwiki/page-533「CN：3」・R-CN-02）", () => {
    const s = enterGB([inst("TST-UNIT-0", "s"), inst("TST-OP", "op")], 1);
    expect(holdEffectOffered(s, "RS-389:x")).toBe(false);
  });

  // atwiki/page-533 Q1「捨札が1枚しかない場合は、シャッフルすることができないため、…効果は発動できません」
  it.fails("RS-389: Q&A — 自軍捨札が1枚しかなければシャッフルできないため、【人命検索】は発動できない（出典: atwiki/page-533 Q1）", () => {
    // 既知の不具合: CARD-RS-389 捨札の枚数に関係なく（山札を見る）選択が出る
    const s = enterGB([inst("TST-UNIT-0", "s")]);
    expect(holdEffectOffered(s, "RS-389:x")).toBe(false);
    expect(zoneOf(resolveAll(s), "player1", "TST-UNIT-0:s")).toBe("discard");
  });

  it.fails("RS-389: Q&A — 自軍捨札が0枚でも発動できない（出典: atwiki/page-533 Q1「2枚以上のカードをランダムに混ぜて」）", () => {
    // 既知の不具合: CARD-RS-389 捨札の枚数に関係なく（山札を見る）選択が出る
    const s = enterGB([]);
    expect(holdEffectOffered(s, "RS-389:x")).toBe(false);
  });
});
