/**
 * カード別スペック: RS-361〜RS-368（第6弾「紅き六戦士の帰還」バルイーグル（2nd）〜レッドマスク）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-RS365 追加条件の読み換え）、grnrngr/faq-card-6（RS-363/364/365 の Q&A）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md）。ライブ写しは RS-365 のみ（pages/605.txt）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { validateDeckEntries } from "@rangers-strike/cards";
import {
  act,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  categoriesOf,
  choiceIds,
  deckCards,
  endTurn,
  enter,
  enterBattleByEffect,
  enterHold,
  expectCatalogText,
  expectStats,
  fillers,
  held,
  inst,
  legal,
  passEntry,
  pick,
  playOp,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushPhase,
  rushVia,
  skip,
  spOf,
  st,
  sUnit,
  toPhase,
  zoneOf,
} from "./RS6-348-368.helpers";
import type { CardInstance, GameState } from "../types/game";

const DA5000 = sUnit("SPEC-DA5000", { category: "DA", bp: 5000, sp: undefined });
const DA3000 = sUnit("SPEC-DA3000", { category: "DA", bp: 3000, sp: undefined });
const DAWB = sUnit("SPEC-DA-WB", { category: ["DA", "WB"] as never, bp: 5000, sp: undefined });
const ET1 = sUnit("SPEC-ET", { category: "ET", bp: 1000, sp: 1 });
const MECHA2 = sUnit("SPEC-MECHA2", { powerCost: 2, features: ["メカ"], sp: undefined });
const M4000 = sUnit("SPEC-M4000", { size: "M", bp: 4000, sp: undefined });
const S4000 = sUnit("SPEC-S4000", { bp: 4000, sp: undefined, powerCost: 4 });
const SPECS = [DA5000, DA3000, DAWB, ET1, MECHA2, M4000, S4000];

/** player1 のバトルフェイズ: before の後に id を出す。 */
function enterAfter(id: string, before: CardInstance[], p2: Partial<GameState["players"]["player2"]> = {}, p1: Partial<GameState["players"]["player1"]> = {}) {
  const s = st({ player1: { battle: before, rush: [inst(id, "x")], deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, SPECS);
  return enter(s, `${id}:x`);
}

/** 「※これはバトルエリアにあるとき、カテゴリにWBが追加される。」の共通テスト。 */
function wbInBattleTests(id: string, page: string) {
  it(`${id}: ※ バトルエリアにあるときはカテゴリに WB が追加される（出典: ${page}「カテゴリにWBが追加される」）`, () => {
    const s = st({ player1: { battle: [inst(id, "b")], deck: deckCards(5) } });
    expect(categoriesOf(s, "player1", `${id}:b`)).toEqual(["ET", "WB"]);
  });
  it(`${id}: ※ ラッシュエリアにあるときは ET のまま（出典: ${page}「バトルエリアにあるとき」）`, () => {
    const s = st({ player1: { rush: [inst(id, "r")], deck: deckCards(5) } });
    expect(categoriesOf(s, "player1", `${id}:r`)).toEqual(["ET"]);
  });
}

// ===========================================================================
describe("RS-361 バルイーグル（2nd）", () => {
  const TEXT = "※これはバトルエリアにあるとき、カテゴリにWBが追加される。【飛羽返し】「SP1」（この効果は、WBのユニットからコンビネーションするときは、ナンバーに関係なく発動する）";

  it("RS-361: カタログ本文・スペックが出典と一致（出典: atwiki/page-512）", () => {
    expectCatalogText("RS-361", TEXT);
    expectStats("RS-361", { name: "バルイーグル（2nd）", category: "ET", size: "S", bp: 4000, sp: "special", powerCost: 5, comboNumber: 5, features: ["レッド", "男", "2nd"] });
  });

  wbInBattleTests("RS-361", "atwiki/page-512");

  it("RS-361: 【飛羽返し】5番目に出て NC が成立すると「SP1」になる（出典: atwiki/page-512「CN：5」）", () => {
    const s = enterAfter("RS-361", fillers(4));
    expect(spOf(s, "player1", "RS-361:x")).toBe(1);
    expect(canStrike(s, "RS-361:x")).toBe(true);
  });

  it("RS-361: 【飛羽返し】WB のユニットからコンビネーションするときはナンバーに関係なく（2番目でも）「SP1」になる（出典: atwiki/page-512「WBのユニットからコンビネーションするときは、ナンバーに関係なく発動する」）", () => {
    const s = enterAfter("RS-361", [inst("TST-UNIT-0", "wb")]);
    expect(spOf(s, "player1", "RS-361:x")).toBe(1);
  });

  it("RS-361: 【飛羽返し】バトルエリアで WB が追加されたバルシャーク（2nd）からのコンビネーションでも発動する（出典: atwiki/page-512・同ページ※「カテゴリにWBが追加される」）", () => {
    const s = enterAfter("RS-361", [inst("TST-UNIT-0", "f"), inst("RS-362", "shark")]);
    expect(spOf(s, "player1", "RS-361:x")).toBe(1);
  });

  it("RS-361: WB でないユニットから2番目にコンビネーションしても SP！のまま（出典: atwiki/page-512「WBのユニットから」）", () => {
    const s = enterAfter("RS-361", [inst("SPEC-ET", "et")]);
    expect(spOf(s, "player1", "RS-361:x")).toBe(0);
    expect(canStrike(s, "RS-361:x")).toBe(false);
  });
});

// ===========================================================================
describe("RS-362 バルシャーク（2nd）", () => {
  const TEXT =
    "※これはバトルエリアにあるとき、カテゴリにWBが追加される。【シャークジョーズ】敵軍バトルエリアから、必要パワーの数字が3以下で特徴「メカ」を持たないユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置いてもよい。置けなければ捨札にする。";

  it("RS-362: カタログ本文・スペックが出典と一致（出典: atwiki/page-526）", () => {
    expectCatalogText("RS-362", TEXT);
    expectStats("RS-362", { name: "バルシャーク（2nd）", category: "ET", size: "S", bp: 2000, sp: undefined, powerCost: 3, comboNumber: 2, features: ["ブルー", "男", "2nd"] });
  });

  wbInBattleTests("RS-362", "atwiki/page-526");

  const enemy = { battle: [inst("TST-UNIT-0", "c0"), inst("RS-354", "c3"), inst("RS-361", "c5"), inst("SPEC-MECHA2", "mecha")], rush: [inst("TST-UNIT-2", "r2")] };

  // 既知の不具合: CARD-RS-362 【シャークジョーズ】の候補が「必要パワー3以下」「メカを持たない」の条件を見ていない
  it.fails("RS-362: 【シャークジョーズ】2番目に出て NC が成立すると、敵軍バトルエリアの必要パワー3以下・メカでないユニットだけを選べる（出典: atwiki/page-526）", () => {
    const s = enterAfter("RS-362", fillers(1), enemy);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-362");
    expect(choiceIds(s)).toEqual(["RS-354:c3", "TST-UNIT-0:c0"]);
  });

  it("RS-362: 【シャークジョーズ】選んだユニットを持ち主（敵軍）のコマンドゾーンにホールド状態で置く（出典: atwiki/page-526「持ち主のコマンドゾーンにホールド状態で置いて」）", () => {
    let s = enterAfter("RS-362", fillers(1), enemy);
    s = resolveAll(pick(s, "RS-354:c3"));
    const c = s.players.player2.command.find((x) => x.instanceId === "RS-354:c3");
    expect(c).toBeDefined();
    expect(c?.commandHeld).toBe(true);
  });

  // 既知の不具合: CARD-RS-362 【シャークジョーズ】が任意（「置いてもよい」）になっていない
  it.fails("RS-362: 【シャークジョーズ】「置いてもよい」— 置かないことも選べる（出典: atwiki/page-526「置いてもよい」）", () => {
    const s = enterAfter("RS-362", fillers(1), enemy);
    expect(canSkip(s)).toBe(true);
  });

  it("RS-362: 【シャークジョーズ】持ち主のコマンドゾーンが一杯（5枚）で置けなければ捨札にする（出典: atwiki/page-526「置けなければ捨札にする」・R-ZONE コマンド5枚）", () => {
    let s = enterAfter("RS-362", fillers(1), { ...enemy, command: [released("TST-OP", "e1"), released("TST-OP", "e2"), released("TST-OP", "e3"), released("TST-OP", "e4"), released("TST-OP", "e5")] });
    s = resolveAll(pick(s, "RS-354:c3"));
    expect(zoneOf(s, "player2", "RS-354:c3")).toBe("discard");
    expect(s.players.player2.command).toHaveLength(5);
  });

  it("RS-362: NC が成立しない（3番目）ときは発動しない（出典: atwiki/page-526「CN：2」・R-CN-02）", () => {
    const s = enterAfter("RS-362", fillers(2), enemy);
    expect(s.pendingEffectChoice).toBeUndefined();
  });
});

// ===========================================================================
describe("RS-363 バルパンサー（2nd）", () => {
  const TEXT = "※これはバトルエリアにあるとき、カテゴリにWBが追加される。【パンサークロー】このターン、敵軍コマンドゾーンにホールド状態でユニットカードが置かれたとき、それを捨札にしてもよい。";

  it("RS-363: カタログ本文・スペックが出典と一致（出典: atwiki/page-527）", () => {
    expectCatalogText("RS-363", TEXT);
    expectStats("RS-363", { name: "バルパンサー（2nd）", category: "ET", size: "S", bp: 3000, sp: undefined, powerCost: 2, comboNumber: 1, features: ["イエロー", "男", "2nd"] });
  });

  wbInBattleTests("RS-363", "atwiki/page-527");

  /** バルパンサー（1番目、NC）→ バルシャーク（2番目、NC）で敵軍ユニットを敵軍コマンドゾーンにホールド状態で置く。 */
  function pantherThenShark() {
    let s = st({
      player1: { rush: [inst("RS-363", "pan"), inst("RS-362", "shark")], deck: deckCards(5) },
      player2: { battle: [inst("RS-354", "c3")], deck: deckCards(5, "e") },
    });
    s = passEntry(resolveAll(enter(s, "RS-363:pan")));
    s = enter(s, "RS-362:shark");
    return pick(s, "RS-354:c3");
  }

  // 既知の不具合: CARD-RS-363 【パンサークロー】が未実装（NC が成立しても敵軍コマンドゾーンに置かれたユニットカードを捨札にできない）
  it.fails("RS-363: 【パンサークロー】1番目に出て NC が成立したターン、敵軍コマンドゾーンにホールド状態でユニットカードが置かれたとき、それを捨札にできる（出典: atwiki/page-527）", () => {
    let s = pantherThenShark();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-363");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(pick(s, "RS-354:c3"));
    expect(zoneOf(s, "player2", "RS-354:c3")).toBe("discard");
  });

  it("RS-363: 【パンサークロー】「捨札にしてもよい」— 捨札にしなければホールド状態のまま残る（出典: atwiki/page-527「捨札にしてもよい」）", () => {
    let s = pantherThenShark();
    if (s.pendingEffectChoice?.sourceCardId === "RS-363") s = skip(s);
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "RS-354:c3")).toBe("command");
  });

  it("RS-363: NC が成立していない（2番目）ときは、敵軍コマンドゾーンにユニットカードが置かれても何もしない（出典: atwiki/page-527「CN：1」・R-CN-02）", () => {
    // バルパンサー2番目（NC なし）→ バルシャーク3番目（NC なし）では置かれないため、バルシャーク2番目・パンサー3番目の順で確認する
    let s = st({
      player1: { battle: [inst("TST-UNIT-0", "f")], rush: [inst("RS-362", "shark"), inst("RS-363", "pan")], deck: deckCards(5) },
      player2: { battle: [inst("RS-354", "c3")], deck: deckCards(5, "e") },
    });
    s = enter(s, "RS-362:shark");
    s = passEntry(resolveAll(pick(s, "RS-354:c3")));
    s = resolveAll(enter(s, "RS-363:pan"));
    expect(zoneOf(s, "player2", "RS-354:c3")).toBe("command");
  });

  // grnrngr/faq-card-6 RS-363 Q1「この効果が発動した後に、敵軍コマンドゾーンにホールド状態で置かれたユニットカードのみが対象になります。」
  it("RS-363: 公式Q&A — 【パンサークロー】が発動する前から敵軍コマンドゾーンにホールド状態で置かれていたユニットカードは対象にならない（出典: grnrngr/faq-card-6 RS-363 Q1）", () => {
    let s = st({
      player1: { rush: [inst("RS-363", "pan")], deck: deckCards(5) },
      player2: { command: [held("RS-354", "old")], deck: deckCards(5, "e") },
    });
    s = resolveAll(enter(s, "RS-363:pan"));
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "RS-354:old")).toBe("command");
  });

  it.todo("RS-363: 公式Q&A — 敵軍ゴーゴーファイヤー【プロジェットカノン】との無限ループは、ターンプレイヤーが優先順を選んで処理を終える（捨札にしたままで終えられる）（出典: grnrngr/faq-card-6 RS-363 Q2）— 【パンサークロー】が未実装（上の it.fails）で前提が作れない");
});

// ===========================================================================
describe("RS-364 ヘルサターン総統", () => {
  const TEXT =
    "【黒き太陽神への忠誠】これが自軍エリアにある間、自軍ユニットがすべてDAなら、「ヘルサターン総統」以外の自軍Sユニットは次の効果を得る⇒「これは自軍コマンドを1つホールドしなければバトルエリアに出られない。」と書かれているかのように扱い、BP＋3000され、BP8000以上のとき「SP1」になる。";

  it("RS-364: カタログ本文・スペックが出典と一致（出典: atwiki/page-576）", () => {
    expectCatalogText("RS-364", TEXT);
    expectStats("RS-364", { name: "ヘルサターン総統", category: "DA", size: "S", bp: 4000, sp: undefined, powerCost: 6, features: ["メカ", "人型", "総統"] });
  });

  const hs = (units: CardInstance[], extraRush: CardInstance[] = [inst("RS-364", "hs")]) =>
    st({ player1: { battle: units, rush: extraRush, deck: deckCards(5) } }, SPECS);

  it("RS-364: 自軍ユニットがすべて DA なら、他の自軍 S ユニットは BP+3000 され、BP8000以上で「SP1」になる（出典: atwiki/page-576）", () => {
    const s = hs([inst("SPEC-DA5000", "a"), inst("SPEC-DA3000", "b")]);
    expect(bpOf(s, "player1", "SPEC-DA5000:a")).toBe(8000);
    expect(spOf(s, "player1", "SPEC-DA5000:a")).toBe(1);
    expect(bpOf(s, "player1", "SPEC-DA3000:b")).toBe(6000);
    expect(spOf(s, "player1", "SPEC-DA3000:b")).toBe(0);
  });

  it("RS-364: 「ヘルサターン総統」自身は BP+3000 されない（出典: atwiki/page-576「「ヘルサターン総統」以外の」）", () => {
    const s = hs([inst("SPEC-DA5000", "a")]);
    expect(bpOf(s, "player1", "RS-364:hs")).toBe(4000);
  });

  it("RS-364: DA でない自軍ユニットが1体でもあれば効果は得られない（出典: atwiki/page-576「自軍ユニットがすべてDAなら」）", () => {
    const s = hs([inst("SPEC-DA5000", "a"), inst("SPEC-ET", "et")]);
    expect(bpOf(s, "player1", "SPEC-DA5000:a")).toBe(5000);
  });

  it("RS-364: ヘルサターン総統が自軍エリアになければ効果はない（出典: atwiki/page-576「これが自軍エリアにある間」）", () => {
    const s = hs([inst("SPEC-DA5000", "a")], []);
    expect(bpOf(s, "player1", "SPEC-DA5000:a")).toBe(5000);
  });

  it("RS-364: 「自軍コマンドを1つホールドしなければバトルエリアに出られない」— コマンドをホールドせずには出られず、ホールドすれば出られる（出典: atwiki/page-576「と書かれているかのように扱い」）", () => {
    const base = (command: CardInstance[]) => st({ player1: { rush: [inst("RS-364", "hs"), inst("SPEC-DA5000", "a")], command, deck: deckCards(5) } }, SPECS);
    const s = base([released("TST-OP-DA", "d")]);
    expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === "SPEC-DA5000:a")).toBe(false);
    const t = enterHold(s, "SPEC-DA5000:a");
    expect(zoneOf(t, "player1", "SPEC-DA5000:a")).toBe("battle");
    expect(t.players.player1.command[0]?.commandHeld).toBe(true);
    expect(canEnter(base([]), "SPEC-DA5000:a")).toBe(false);
  });

  // grnrngr/faq-card-6 RS-364 Q1「はい、BP+3000されてSP1になります。」
  // 既知の不具合: CARD-RS-364 総統の BP+3000 がティラノレンジャー【龍撃剣】の「BP5000以上のとき SP1」の判定に反映されない（BP6000 なのに SP！のまま）
  it.fails("RS-364: 公式Q&A — 闇のヤイバで DA が追加されたティラノレンジャーが NC を発動したとき、BP+3000 されて「SP1」になる（出典: grnrngr/faq-card-6 RS-364 Q1）", () => {
    // ティラノレンジャー（CN4）を4番目に出すため、DA の S ユニット3体を先に並べる
    let s = st({ player1: { battle: [inst("SPEC-DA3000", "a"), inst("SPEC-DA3000", "b"), inst("SPEC-DA3000", "c")], rush: [inst("RS-364", "hs"), inst("RS-339", "yaiba"), inst("RS-081", "tyr")], command: [released("TST-OP-DA", "d")], deck: deckCards(5) } }, SPECS);
    s = enterHold(s, "RS-081:tyr");
    expect(bpOf(s, "player1", "RS-081:tyr")).toBe(6000);
    expect(spOf(s, "player1", "RS-081:tyr")).toBe(1);
  });

  it.todo("RS-364: 公式Q&A — 【ゴレンジャーハリケーン】は発動時点で BP8000以下のユニットだけが対象で、総統を先に撃破したとみなして残りを撃破することはできない（出典: grnrngr/faq-card-6 RS-364 Q2）— モモ〜アカレンジャーの5体の順のコンビネーションを敵軍の総統環境で組むのが API 上困難");

  // grnrngr/faq-card-6 RS-364 Q3「はい、その通りです。」
  it("RS-364: 公式Q&A — 自軍エリアに2体あれば効果は重複し、BP+6000 される（出典: grnrngr/faq-card-6 RS-364 Q3）", () => {
    const s = hs([inst("SPEC-DA3000", "b")], [inst("RS-364", "h1"), inst("RS-364", "h2")]);
    expect(bpOf(s, "player1", "SPEC-DA3000:b")).toBe(9000);
  });

  // grnrngr/faq-card-6 RS-364 Q4「はい、できます。」
  it("RS-364: 公式Q&A — 得た「ホールドしなければバトルエリアに出られない」は獣奏剣で無効化できる（出典: grnrngr/faq-card-6 RS-364 Q4）", () => {
    let s = rushPhase({ hand: [inst("RS-243", "jyuso")], rush: [inst("RS-364", "hs"), inst("SPEC-DA5000", "a")], command: releasedCat("WB", 1), power: powerCards(3) }, {}, SPECS);
    const r = playOp(s, "player1", "RS-243:jyuso");
    expect(r.ok).toBe(true);
    s = toPhase(r.state, "player1", "battle");
    expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === "SPEC-DA5000:a")).toBe(true);
  });

  // grnrngr/faq-card-6 RS-364 Q5「…ホールドする数は1つになります。」
  it("RS-364: 公式Q&A — 自軍エリアに2体あっても、バトルエリアに出るときにホールドするコマンドは1つ（出典: grnrngr/faq-card-6 RS-364 Q5）", () => {
    const s = st({ player1: { rush: [inst("RS-364", "h1"), inst("RS-364", "h2"), inst("SPEC-DA5000", "a")], command: [released("TST-OP-DA", "d1"), released("TST-OP-DA", "d2")], deck: deckCards(5) } }, SPECS);
    const t = enterHold(s, "SPEC-DA5000:a");
    expect(zoneOf(t, "player1", "SPEC-DA5000:a")).toBe("battle");
    expect(t.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(1);
  });

  // grnrngr/faq-card-6 RS-364 Q6「はい、発動します。」
  it("RS-364: 公式Q&A — DA を含むマルチカテゴリのユニットや、闇のヤイバで DA が追加されたユニットがいても発動する（出典: grnrngr/faq-card-6 RS-364 Q6）", () => {
    const a = hs([inst("SPEC-DA-WB", "multi"), inst("SPEC-DA3000", "b")]);
    expect(bpOf(a, "player1", "SPEC-DA3000:b")).toBe(6000);
    expect(bpOf(a, "player1", "SPEC-DA-WB:multi")).toBe(8000);
    // ヤイバ（DA）と、ヤイバで DA が追加された特徴「男」の ET ユニット（デンジレッドは OT）
    const b = hs([inst("RS-354", "red"), inst("SPEC-DA3000", "b")], [inst("RS-364", "hs"), inst("RS-339", "yaiba")]);
    expect(bpOf(b, "player1", "SPEC-DA3000:b")).toBe(6000);
    expect(bpOf(b, "player1", "RS-354:red")).toBe(6000);
  });

  it.todo("RS-364: 公式Q&A — 幽魔王サラマンデスとのループはターンプレイヤーがどちらかの効果を優先して処理する（出典: grnrngr/faq-card-6 RS-364 Q7）— XG2-029 と災魔ツリーの組み合わせを API で組めない");
});

// ===========================================================================
describe("RS-365 イナズマギンガー", () => {
  const TEXT =
    "【帝国の掌握】自軍ターン中、これがバトルエリアに出たとき、自分の手札をすべて相手に見せる。そして、見せた手札と同じカード名の敵軍ユニットを全て撃破する。その後、自分の手札をすべて捨札にし、この効果で撃破した敵軍ユニット1体につき、このターン、これはSP+1される。";

  it("RS-365: カタログ本文（追加条件は読み換え後）・スペックが出典と一致（出典: 08-errata R-ERR-RS365・atwiki/page-605）", () => {
    expectCatalogText("RS-365", TEXT);
    expectStats("RS-365", { name: "イナズマギンガー", category: "DA", size: "S", bp: 7000, sp: "special", powerCost: "0+", features: ["宇宙海賊", "男"], rushCondition: "discard_all_hand" });
    expect(DEFS_TEXT()).toBe("これ以外の自分の手札を全て捨札にする");
  });

  const rushState = (hand: CardInstance[]) => rushPhase({ hand: [inst("RS-365", "ig"), ...hand], command: releasedCat("DA", 1), power: powerCards(0) });

  it("RS-365: 追加条件 — これ以外の自分の手札を全て捨札にしてラッシュできる（出典: grnrngr/faq-card-6 RS-365 Q3「「これ以外の自分の手札を全て捨札にする」と読み換えて」）", () => {
    const r = rushVia(rushState([inst("TST-OP", "h1"), inst("RS-354", "h2")]), "player1", "RS-365:ig");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-365:ig")).toBe("rush");
    expect(zoneOf(t, "player1", "TST-OP:h1")).toBe("discard");
    expect(zoneOf(t, "player1", "RS-354:h2")).toBe("discard");
    expect(t.players.player1.hand).toHaveLength(0);
  });

  // grnrngr/faq-card-6 RS-365 Q2「はい、その通りです。1枚もなければ「すべて捨札にする」という行為を達成することができず、追加条件が満たせないからです。」
  it("RS-365: 公式Q&A — これ以外の手札が1枚もなければラッシュできない（出典: grnrngr/faq-card-6 RS-365 Q2）", () => {
    expect(canStartRush(rushState([]), "player1", "RS-365:ig")).toBe(false);
  });

  /** 自軍バトルフェイズに手札 hand を持ってイナズマギンガーを出す。 */
  const entered = (hand: CardInstance[], p2: Partial<GameState["players"]["player2"]>) =>
    resolveAll(enter(st({ player1: { rush: [inst("RS-365", "ig")], hand, deck: deckCards(5) }, player2: { deck: deckCards(5, "e"), ...p2 } }, SPECS), "RS-365:ig"));

  const enemy = { battle: [inst("RS-354", "e1"), inst("TST-UNIT-0", "e2")], rush: [inst("RS-354", "e3"), inst("RS-357", "e4")] };

  it("RS-365: 【帝国の掌握】自軍ターン中に出たとき、手札と同じカード名の敵軍ユニット（バトル・ラッシュエリア）を全て撃破する（出典: atwiki/page-605「見せた手札と同じカード名の敵軍ユニットを全て撃破する」）", () => {
    const s = entered([inst("RS-354", "h1")], enemy);
    expect(zoneOf(s, "player2", "RS-354:e1")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-354:e3")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e2")).toBe("battle");
    expect(zoneOf(s, "player2", "RS-357:e4")).toBe("rush");
  });

  it("RS-365: 【帝国の掌握】その後、自分の手札をすべて捨札にする（出典: atwiki/page-605「その後、自分の手札をすべて捨札にし」）", () => {
    const s = entered([inst("RS-354", "h1"), inst("TST-OP", "h2")], enemy);
    expect(s.players.player1.hand).toHaveLength(0);
    expect(zoneOf(s, "player1", "TST-OP:h2")).toBe("discard");
  });

  it("RS-365: 【帝国の掌握】撃破した敵軍ユニット1体につき、このターン SP+1（2体撃破で SP2）（出典: atwiki/page-605「撃破した敵軍ユニット1体につき、このターン、これはSP+1される」）", () => {
    const s = entered([inst("RS-354", "h1")], enemy);
    expect(spOf(s, "player1", "RS-365:ig")).toBe(2);
    expect(canStrike(s, "RS-365:ig")).toBe(true);
  });

  it("RS-365: 【帝国の掌握】撃破しなければ SP は増えず SP！のまま（出典: atwiki/page-605「SP：！」）", () => {
    const s = entered([inst("TST-OP", "h1")], enemy);
    expect(spOf(s, "player1", "RS-365:ig")).toBe(0);
  });

  // 既知の不具合: CARD-RS-365 【帝国の掌握】の SP+1 がターンを越えて残る（instance の spModifier が消えない）
  it.fails("RS-365: 【帝国の掌握】SP+1 は「このターン」だけ — 次の自軍ターンには SP！に戻る（出典: atwiki/page-605「このターン」）", () => {
    let s = entered([inst("RS-354", "h1")], enemy);
    s = endTurn(endTurn(s));
    s = toPhase(s, "player1", "battle");
    const ig = s.players.player1.battle.find((c) => c.instanceId === "RS-365:ig") ?? s.players.player1.rush.find((c) => c.instanceId === "RS-365:ig");
    expect(ig).toBeDefined();
    expect(spOf(s, "player1", "RS-365:ig")).toBe(0);
  });

  it("RS-365: 【帝国の掌握】敵軍ターン中にバトルエリアに出ても発動しない（出典: atwiki/page-605「自軍ターン中」）", () => {
    let s = st({ activePlayer: "player2", player1: { rush: [inst("RS-365", "ig")], hand: [inst("RS-354", "h1")], deck: deckCards(5) }, player2: { ...enemy, deck: deckCards(5, "e") } }, SPECS);
    s = resolveAll(enterBattleByEffect(s, "player1", "RS-365:ig"));
    expect(zoneOf(s, "player1", "RS-365:ig")).toBe("battle");
    expect(zoneOf(s, "player2", "RS-354:e1")).toBe("battle");
    expect(zoneOf(s, "player1", "RS-354:h1")).toBe("hand");
  });

  // grnrngr/faq-card-6 RS-365 Q1「はい、できます。」
  it("RS-365: 公式Q&A — 手札が0枚でも自軍ターン中にバトルエリアに出られる（出典: grnrngr/faq-card-6 RS-365 Q1）", () => {
    const s = entered([], enemy);
    expect(zoneOf(s, "player1", "RS-365:ig")).toBe("battle");
    expect(s.players.player2.discard).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-366 グランギズモ", () => {
  const TEXT =
    "【総員搭乗】これが自軍ラッシュエリアにある間、自軍ラッシュフェイズ中、特徴「戦闘員」を持つ自軍ユニットを1体捨札にして次の効果を発動できる⇒自軍山札から、追加条件に「自軍Sユニットを1体捨札にする」とあるDAのMユニットのカードを1枚選び、ラッシュエリアに出してもよい。その後、山札をシャッフルする。";

  it("RS-366: カタログ本文・スペックが出典と一致（出典: atwiki/page-606）", () => {
    expectCatalogText("RS-366", TEXT);
    expectStats("RS-366", { name: "グランギズモ", category: "DA", size: "XL", bp: 4000, sp: undefined, powerCost: 3, features: ["メカ", "母艦"] });
  });

  const OTHER_M = sUnit("SPEC-DA-M-OTHER", {
    category: "DA",
    size: "M",
    powerCost: "2+",
    rushAdditionalCondition: { conditionId: "send_s_unit_to_power", text: "自軍Sユニットを1体パワーゾーンに送る", unitCount: 1 } as never,
  });
  const gizmo = (rush: CardInstance[], deck: CardInstance[]) =>
    rushPhase({ rush: [inst("RS-366", "gg"), ...rush], deck, command: releasedCat("DA", 1), power: powerCards(0) }, {}, [OTHER_M]);

  /** 【総員搭乗】の起動（合法手から RS-366 を発生源とするものを探す）。 */
  const NOT_ACTIVATION = ["end_phase", "move_to_battle", "battle", "strike", "pass_battle_entry"];
  const activation = (s: GameState) =>
    legal(s).find(
      (a) =>
        JSON.stringify(a).includes("RS-366:gg") &&
        !NOT_ACTIVATION.includes(a.type) &&
        !(a.type === "initiate_command_payment" && (a as { kind?: string }).kind === "battle_entry"),
    );

  // 既知の不具合: CARD-RS-366 【総員搭乗】が未実装（起動する手段がない）
  it.fails("RS-366: 【総員搭乗】自軍ラッシュフェイズ中、「戦闘員」の自軍ユニット（ゾロー兵）を捨札にして、山札の該当 DA の M ユニット（メラージュ戦闘機）をラッシュエリアに出せる（出典: atwiki/page-606）", () => {
    let s = gizmo([inst("RS-367", "zo")], [inst("TST-OP", "o"), inst("RS-261", "mel"), inst("SPEC-DA-M-OTHER", "oth")]);
    const a = activation(s);
    expect(a).toBeDefined();
    s = act(s, a!);
    s = resolveAll(s, ["RS-367:zo", "RS-261:mel"]);
    expect(zoneOf(s, "player1", "RS-367:zo")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-261:mel")).toBe("rush");
  });

  it("RS-366: 「戦闘員」のユニットがいなければ起動できない（出典: atwiki/page-606「特徴「戦闘員」を持つ自軍ユニットを1体捨札にして」）", () => {
    const s = gizmo([inst("TST-UNIT-0", "f")], [inst("RS-261", "mel")]);
    expect(activation(s)).toBeUndefined();
  });

  it("RS-366: 自軍ラッシュフェイズ以外（バトルフェイズ）には起動できない（出典: atwiki/page-606「自軍ラッシュフェイズ中」）", () => {
    const s = st({ player1: { rush: [inst("RS-366", "gg"), inst("RS-367", "zo")], deck: [inst("RS-261", "mel")] } });
    expect(activation(s)).toBeUndefined();
  });

  it.todo("RS-366: 追加条件が「自軍Sユニットを1体捨札にする」でない DA の M ユニットは選べない（出典: atwiki/page-606）— 【総員搭乗】が未実装（上の it.fails）で選択の段階まで進めない");
});

// ===========================================================================
describe("RS-367 ゾロー兵", () => {
  const TEXT =
    "※このカードはデッキに好きな枚数入れてもよい。【軍隊アリの遺伝子】このユニットをラッシュしたとき、自軍Sユニットの数が5体以下なら、自軍山札の上から1枚をオモテにしてもよい。オモテにしたカードが「ゾロー兵」なら自軍ラッシュエリアに出し、それ以外なら捨札にする。";

  it("RS-367: カタログ本文・スペックが出典と一致（出典: atwiki/page-575）", () => {
    expectCatalogText("RS-367", TEXT);
    expectStats("RS-367", { name: "ゾロー兵", category: "DA", size: "S", bp: 500, sp: undefined, powerCost: 1, features: ["戦闘員"] });
  });

  it("RS-367: ※ デッキに好きな枚数（12枚）入れてもよい（出典: atwiki/page-575「デッキに好きな枚数入れてもよい」・R-DECK-03）", () => {
    const r = validateDeckEntries([{ cardId: "RS-367", count: 12 }, { cardId: "RS-338", count: 38 }]);
    expect(r.errors.filter((e) => e.includes("ゾロー兵"))).toEqual([]);
  });

  const rushZolo = (rush: CardInstance[], deck: CardInstance[]) => {
    const s = rushPhase({ hand: [inst("RS-367", "z")], rush, command: releasedCat("DA", 1), power: powerCards(1), deck });
    const r = rushFromHand(s, "player1", "RS-367:z");
    expect(r.ok).toBe(true);
    return r.state;
  };

  it("RS-367: 【軍隊アリの遺伝子】山札の上をオモテにし、「ゾロー兵」なら自軍ラッシュエリアに出す（出典: atwiki/page-575）", () => {
    let s = rushZolo([], [inst("RS-367", "top"), inst("TST-OP", "o")]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-367");
    s = resolveAll(s, ["RS-367:top"]);
    expect(zoneOf(s, "player1", "RS-367:top")).toBe("rush");
  });

  it("RS-367: 【軍隊アリの遺伝子】オモテにしたカードが「ゾロー兵」以外なら捨札にする（出典: atwiki/page-575「それ以外なら捨札にする」）", () => {
    let s = rushZolo([], [inst("TST-OP", "top"), inst("RS-367", "second")]);
    s = resolveAll(s, ["TST-OP:top"]);
    expect(zoneOf(s, "player1", "TST-OP:top")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-367:second")).toBe("deck");
  });

  it("RS-367: 【軍隊アリの遺伝子】「オモテにしてもよい」— しないことも選べ、山札は変わらない（出典: atwiki/page-575「オモテにしてもよい」）", () => {
    let s = rushZolo([], [inst("TST-OP", "top")]);
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player1", "TST-OP:top")).toBe("deck");
  });

  it("RS-367: 【軍隊アリの遺伝子】境界 — ラッシュしたゾロー兵を含めて自軍 S ユニットがちょうど5体なら発動する（出典: atwiki/page-575「5体以下なら」）", () => {
    const s = resolveAll(rushZolo(fillers(4), [inst("TST-OP", "top")]), ["TST-OP:top"]);
    expect(zoneOf(s, "player1", "TST-OP:top")).toBe("discard");
  });

  it("RS-367: 【軍隊アリの遺伝子】境界 — ゾロー兵を含めて6体なら発動しない（出典: atwiki/page-575「5体以下なら」）", () => {
    const s = resolveAll(rushZolo(fillers(5), [inst("TST-OP", "top")]), ["TST-OP:top"]);
    expect(zoneOf(s, "player1", "TST-OP:top")).toBe("deck");
  });

  it("RS-367: 【軍隊アリの遺伝子】自軍 S ユニットが6体以上（ゾロー兵を含め7体）なら発動しない（出典: atwiki/page-575「自軍Sユニットの数が5体以下なら」）", () => {
    const s = resolveAll(rushZolo(fillers(6), [inst("RS-367", "top")]), ["RS-367:top"]);
    expect(zoneOf(s, "player1", "RS-367:top")).toBe("deck");
  });

  it("RS-367: 連鎖 — 効果でラッシュエリアに出たゾロー兵にも「ラッシュしたとき」の【軍隊アリの遺伝子】が発動する（出典: atwiki/page-575・R-RUSH-22「効果でラッシュしたユニットにも「ラッシュしたとき」の効果は発動」）", () => {
    const s = resolveAll(rushZolo([], [inst("RS-367", "top"), inst("RS-367", "second"), inst("TST-OP", "third")]), ["RS-367:top", "RS-367:second", "TST-OP:third"]);
    expect(zoneOf(s, "player1", "RS-367:top")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-367:second")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-OP:third")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-368 レッドマスク", () => {
  const TEXT =
    "※これは、ラッシュしたターンにバトルエリアに出られない(この制限は自軍ダメージが4点以上あれば無効になる)。【ゴッドハンド】敵軍バトルエリアから、BP4000の敵軍Sユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい。";

  it("RS-368: カタログ本文・スペックが出典と一致（出典: atwiki/page-569）", () => {
    expectCatalogText("RS-368", TEXT);
    expectStats("RS-368", { name: "レッドマスク", category: "MA", size: "S", bp: 3000, sp: undefined, powerCost: 2, comboNumber: 4, features: ["レッド", "男"] });
  });

  const rushedThisTurn = (damage: number) => {
    const s = rushPhase({ hand: [inst("RS-368", "rm")], command: releasedCat("MA", 1), power: powerCards(2), damage });
    const r = rushFromHand(s, "player1", "RS-368:rm");
    expect(r.ok).toBe(true);
    return toPhase(r.state, "player1", "battle");
  };

  it("RS-368: ※ 自軍ダメージ3点ではラッシュしたターンにバトルエリアに出られない（出典: atwiki/page-569「ラッシュしたターンにバトルエリアに出られない」）", () => {
    expect(canEnter(rushedThisTurn(3), "RS-368:rm")).toBe(false);
  });

  it("RS-368: ※ 自軍ダメージが4点以上あれば制限は無効で、ラッシュしたターンに出られる（出典: atwiki/page-569「自軍ダメージが4点以上あれば無効になる」）", () => {
    expect(canEnter(rushedThisTurn(4), "RS-368:rm")).toBe(true);
  });

  const enemy = { battle: [inst("RS-351", "s4"), inst("SPEC-S4000", "s4b"), inst("RS-354", "s3"), inst("SPEC-M4000", "m4")], rush: [inst("RS-351", "r4")], power: powerCards(2, "e") };

  it("RS-368: 【ゴッドハンド】4番目に出て NC が成立すると、敵軍バトルエリアの BP4000 の S ユニットだけを選べる（出典: atwiki/page-569）", () => {
    const s = enterAfter("RS-368", fillers(3), enemy);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-368");
    expect(choiceIds(s)).toEqual(["RS-351:s4", "SPEC-S4000:s4b"]);
  });

  it("RS-368: 【ゴッドハンド】選んだユニットを持ち主のパワーゾーンにダメージ（ウラ向き）にして置く（相手のダメージ+1）（出典: atwiki/page-569「持ち主のパワーゾーンにダメージにして置いて」）", () => {
    let s = enterAfter("RS-368", fillers(3), enemy);
    s = resolveAll(pick(s, "RS-351:s4"));
    const c = s.players.player2.power.find((x) => x.instanceId === "RS-351:s4");
    expect(c?.faceDown).toBe(true);
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-368: 【ゴッドハンド】「置いてもよい」— 置かないことも選べる（出典: atwiki/page-569「置いてもよい」）", () => {
    let s = enterAfter("RS-368", fillers(3), enemy);
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player2", "RS-351:s4")).toBe("battle");
    expect(s.players.player2.damage).toBe(0);
  });

  it("RS-368: NC が成立しない（3番目）ときは発動しない（出典: atwiki/page-569「CN：4」・R-CN-02）", () => {
    const s = enterAfter("RS-368", fillers(2), enemy);
    expect(s.pendingEffectChoice).toBeUndefined();
  });
});

function DEFS_TEXT(): string | undefined {
  return (st().definitions["RS-365"]?.rushAdditionalCondition as { text?: string } | undefined)?.text;
}
