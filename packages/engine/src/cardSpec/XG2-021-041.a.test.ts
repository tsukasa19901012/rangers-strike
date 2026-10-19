/**
 * カード別スペック: XG2-021〜XG2-027（クロスギャザー ザ・ドラゴンタイガー 重騎士〜ギンガイエロー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に本範囲のカードの項はない
 *     （「XG2-021」〜「XG2-027」とカード名で検索。「ギンガレッド」等は RS の同名カードの項）。atwiki に転載された公式 Q&A（XG2-025 Q1・Q2、XG2-026 Q1、XG2-027 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG2-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-CN-01・R-KW-RESIST-01）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG2-NNN …」）で残す。
 * レアリティは atwiki の「スーパーレア／レア／ノーマルレア／ノーマル」を SR／R／NR／N として照合する。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  accept,
  act,
  attack,
  attackUntilRegister,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  enter,
  enterWithHold,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnit,
  exiled,
  fill,
  handN,
  held,
  inst,
  legal,
  ncEnter,
  nextPhase,
  p1Battle,
  passEntry,
  pick,
  powerCards,
  registerOffered,
  released,
  releasedCat,
  resolveAll,
  ridesOn,
  rushBoard,
  rushFromHand,
  settle,
  skip,
  spOf,
  sUnit,
  zoneOf,
} from "./XG2-021-041.helpers";

const MECHA_S = sUnit("SPEC-MECHA-S", { bp: 1000, features: ["メカ"] });
const MECHA_M = sUnit("SPEC-MECHA-M", { bp: 3000, size: "M", features: ["メカ"] });
const NONUM_M = sUnit("SPEC-NONUM-M", { bp: 3000, size: "M" });
const EXTRA = [MECHA_S, MECHA_M, NONUM_M];

const heldCount = (s: GameState, p: "player1" | "player2") => s.players[p].command.filter((c) => c.commandHeld).length;

// ===========================================================================
describe("XG2-021 重騎士", () => {
  const TEXT =
    "※レジスト 【騎乗】自軍ターン中、これがバトルエリアに出たとき、「これは自軍コマンドを1つホールドしなければバトルエリアに出られない」と書かれている自軍ユニットを1体選んでもよい。このターン、選んだユニットをバトルエリアに出すとき、自軍コマンドを1つホールドするかわりに、相手は自分自身のコマンドを1つ選びホールドする。";

  it("XG2-021: カタログ本文・スペックが出典と一致（出典: atwiki/page-1192）", () => {
    expectCatalogText("XG2-021", TEXT);
    expectUnit("XG2-021", { name: "重騎士", category: "WB", size: "M", bp: 6000, sp: "1/2", powerCost: "5+", features: ["ブラック", "男", "人型"], rushCondition: "discard_named_unit" });
    expectRarityIn("XG2-021", ["R"]);
  });

  const board = (rush: ReturnType<typeof inst>[], power = 5) =>
    rushBoard({ hand: [inst("XG2-021", "h")], rush, power: powerCards(power), command: releasedCat("WB", 1) });

  it("XG2-021: 追加条件 — 自軍「黒騎士ブルブラック」（XG2-023）1体を捨札にしてパワー5でラッシュできる。パワー4ではできない（出典: atwiki/page-1192「必要パワー：5+」「追加条件：自軍「黒騎士ブルブラック」1体を捨札にする」）", () => {
    const r = rushFromHand(board([inst("XG2-023", "bb")]), "player1", "XG2-021:h");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "XG2-021:h")).toBe("rush");
    expect(zoneOf(r.state, "player1", "XG2-023:bb")).toBe("discard");
    expect(canStartRush(board([inst("XG2-023", "bb")], 4), "player1", "XG2-021:h")).toBe(false);
  });

  it("XG2-021: 追加条件 — 「黒騎士ブルブラック」がいなければラッシュできない（出典: atwiki/page-1192）", () => {
    expect(canStartRush(board([inst("TST-UNIT-0", "u")]), "player1", "XG2-021:h")).toBe(false);
  });

  it("XG2-021: ※レジスト — 敵軍ターン中にバトルで撃破されるとき、レジストを使える（出典: atwiki/page-1192「※レジスト」・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG2-021", "k")] }, "XG2-021:k"))).toBe(true);
  });

  const kijou = () =>
    enter(
      p1Battle({ rush: [inst("XG2-021", "k"), inst("XG2-022", "g"), inst("TST-UNIT-0", "u")], command: releasedCat("WB", 2) }, { command: releasedCat("WB", 2, "e") }),
      "XG2-021:k",
    );

  it.fails("XG2-021: 【騎乗】自軍ターン中にバトルエリアに出たとき、「ホールドしなければバトルエリアに出られない」と書かれた自軍ユニット（XG2-022 重星獣・ゴウタウラス）を1体選べる。書かれていないユニットは選べない。任意（出典: atwiki/page-1192「…と書かれている自軍ユニットを1体選んでもよい」） 既知の不具合: CARD-XG2-021 【騎乗】で選ぶ選択が開かない（選ばずに自動で適用される）", () => {
    const s = kijou();
    expectChoiceFrom(s, "player1", "XG2-021");
    expect(choiceIds(s)).toEqual(["XG2-022:g"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG2-021: 【騎乗】選んだユニットをこのターンにバトルエリアに出すとき、自軍コマンドをホールドするかわりに、相手が自分自身のコマンドを1つホールドする（出典: atwiki/page-1192「自軍コマンドを1つホールドするかわりに、相手は自分自身のコマンドを1つ選びホールドする」・カード評価「【騎乗】からの重星獣・ゴウタウラスが強力」） 既知の不具合: CARD-XG2-021 【騎乗】で選んだ XG2-022 を出しても、自軍コマンドがホールドされ、相手のコマンドはホールドされない", () => {
    let s = kijou();
    s = resolveAll(pick(s, "XG2-022:g"));
    const direct = legal(s).find((a) => a.type === "move_to_battle" && a.playerId === "player1" && a.instanceId === "XG2-022:g");
    s = direct ? act(s, direct) : enterWithHold(s, "XG2-022:g", ["TST-OP:cWB0"]);
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "XG2-022:g")).toBe("battle");
    expect(heldCount(s, "player1")).toBe(0);
    expect(heldCount(s, "player2")).toBe(1);
  });
});

// ===========================================================================
describe("XG2-022 重星獣・ゴウタウラス", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【騎獣激突】自軍コマンドを1つ選びホールドしてもよい。そうしたとき、ホールド状態の敵軍コマンドを1つ選び捨札にする。（この効果は、特徴「人型」を持つMユニットからコンビネーションするときはナンバーに関係なく発動する）";

  it("XG2-022: カタログ本文・スペックが出典と一致（出典: atwiki/page-1794）", () => {
    expectCatalogText("XG2-022", TEXT);
    expectUnit("XG2-022", { name: "重星獣・ゴウタウラス", category: "WB", size: "M", bp: 5000, sp: undefined, powerCost: 5, comboNumber: 5, features: ["獣"] });
    expectRarityIn("XG2-022", ["N"]);
  });

  it("XG2-022: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（ホールドなしの移動はなく、リリース状態のコマンドがなければ出られない）（出典: atwiki/page-1794 ※）", () => {
    const s = p1Battle({ rush: [inst("XG2-022", "g")], command: releasedCat("WB", 1) });
    expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === "XG2-022:g")).toBe(false);
    expect(canEnter(s, "XG2-022:g")).toBe(true);
    const t = enterWithHold(s, "XG2-022:g", ["TST-OP:cWB0"]);
    expect(zoneOf(t, "player1", "XG2-022:g")).toBe("battle");
    expect(cardIn(t, "player1", "TST-OP:cWB0")?.commandHeld).toBe(true);
    expect(canEnter(p1Battle({ rush: [inst("XG2-022", "g")], command: [held("TST-OP", "h")] }), "XG2-022:g")).toBe(false);
  });

  const enemyCmd = () => ({ command: [held("TST-OP", "eh"), released("TST-OP", "er")] });
  const nc5 = () => enterWithHold(p1Battle({ battle: fill(4), rush: [inst("XG2-022", "g")], command: releasedCat("WB", 3) }, enemyCmd()), "XG2-022:g", ["TST-OP:cWB0"]);

  it.fails("XG2-022: 【騎獣激突】NC（バトルエリアの5番目）で、自軍コマンドを1つホールドするかを選べる（任意）（出典: atwiki/page-1794「自軍コマンドを1つ選びホールドしてもよい」・R-CN-01） 既知の不具合: CARD-XG2-022 【騎獣激突】の選択が開かない", () => {
    const s = nc5();
    expectChoiceFrom(s, "player1", "XG2-022");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG2-022: 【騎獣激突】ホールドしたとき、ホールド状態の敵軍コマンド（リリース状態のものは選べない）を1つ選び捨札にする（出典: atwiki/page-1794「そうしたとき、ホールド状態の敵軍コマンドを1つ選び捨札にする」） 既知の不具合: CARD-XG2-022 【騎獣激突】がなく、敵軍コマンドを捨札にできない", () => {
    let s = nc5();
    expectChoiceFrom(s, "player1", "XG2-022");
    s = settle(accept(s));
    expect(heldCount(s, "player1")).toBe(2);
    expect(choiceIds(s)).toEqual(["TST-OP:eh"]);
    s = resolveAll(s, ["TST-OP:eh"]);
    expect(zoneOf(s, "player2", "TST-OP:eh")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-OP:er")).toBe("command");
  });

  it.fails("XG2-022: 【騎獣激突】特徴「人型」を持つ M ユニット（XG2-021 重騎士）からコンビネーションするときは、ナンバーに関係なく（2番目でも）発動する（出典: atwiki/page-1794「特徴「人型」を持つMユニットからコンビネーションするときはナンバーに関係なく発動する」・カード評価「現在WBでは重騎士からしかこの効果が使えない」） 既知の不具合: CARD-XG2-022 【騎獣激突】の選択が開かない", () => {
    const s = enterWithHold(p1Battle({ battle: [inst("XG2-021", "k")], rush: [inst("XG2-022", "g")], command: releasedCat("WB", 3) }, enemyCmd()), "XG2-022:g", ["TST-OP:cWB0"]);
    expectChoiceFrom(s, "player1", "XG2-022");
  });

  it("XG2-022: 【騎獣激突】NC せず、「人型」の M ユニットからのコンビネーションでもなければ（S ユニットの次の2番目）発動しない（出典: atwiki/page-1794・R-CN-01）", () => {
    const s = resolveAll(enterWithHold(p1Battle({ battle: fill(1), rush: [inst("XG2-022", "g")], command: releasedCat("WB", 3) }, enemyCmd()), "XG2-022:g", ["TST-OP:cWB0"]));
    expect(zoneOf(s, "player2", "TST-OP:eh")).toBe("command");
    expect(heldCount(s, "player1")).toBe(1);
  });
});

// ===========================================================================
describe("XG2-023 黒騎士ブルブラック", () => {
  const TEXT =
    "※レジスト 【黒の一撃】敵軍バトルエリアからナンバーを持たないSユニットを1体選び、撃破してもよい。また、DAを持つ自軍コマンドを1つホールドしてもよい。そうしたとき、このターン、これは「SP1」になる。";

  it("XG2-023: カタログ本文・スペックが出典と一致（出典: atwiki/page-1795）", () => {
    expectCatalogText("XG2-023", TEXT);
    expectUnit("XG2-023", { name: "黒騎士ブルブラック", category: "WB", size: "S", bp: 3000, sp: "special", powerCost: 4, comboNumber: 3, features: ["ブラック", "男"] });
    expectRarityIn("XG2-023", ["NR"]);
  });

  const enemy = () => ({ battle: [inst("TST-UNIT-0", "x"), inst("XG2-001", "cn"), inst("SPEC-NONUM-M", "m")], rush: [inst("TST-UNIT-0", "r")] });

  it.fails("XG2-023: 【黒の一撃】NC で、敵軍バトルエリアのナンバーを持たない S ユニットから1体選べる（ナンバーを持つユニット・M ユニット・ラッシュエリアのユニットは選べない）。任意（出典: atwiki/page-1795「敵軍バトルエリアからナンバーを持たないSユニットを1体選び、撃破してもよい」） 既知の不具合: CARD-XG2-023 【黒の一撃】の候補にナンバーを持つ S ユニット（XG2-001 ファイブレッド CN5）と M ユニットが入る", () => {
    const s = ncEnter("XG2-023:b", 2, {}, enemy(), EXTRA);
    expectChoiceFrom(s, "player1", "XG2-023");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:x"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG2-023: 【黒の一撃】選んだユニットを撃破する（出典: atwiki/page-1795） 既知の不具合: CARD-XG2-023 【黒の一撃】で選んだユニットが撃破されず、敵軍のコマンドゾーンに置かれる", () => {
    const s = resolveAll(pick(ncEnter("XG2-023:b", 2, {}, enemy(), EXTRA), "TST-UNIT-0:x"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:x")).toBe("discard");
  });

  it.fails("XG2-023: 【黒の一撃】DA を持つ自軍コマンドを1つホールドすると、このターン「SP1」になる（出典: atwiki/page-1795「DAを持つ自軍コマンドを1つホールドしてもよい。そうしたとき、このターン、これは「SP1」になる」） 既知の不具合: CARD-XG2-023 【黒の一撃】で DA を持つ自軍コマンドをホールドする選択が開かず、「SP1」にならない", () => {
    const s = resolveAll(ncEnter("XG2-023:b", 2, { command: releasedCat("DA", 1) }, {}), ["TST-OP-DA:cDA0"]);
    expect(cardIn(s, "player1", "TST-OP-DA:cDA0")?.commandHeld).toBe(true);
    expect(spOf(s, "player1", "XG2-023:b")).toBe(1);
  });

  it("XG2-023: 【黒の一撃】DA を持つ自軍コマンドがなければ（WB のコマンドだけ）ホールドできず、「SP1」にならない（出典: atwiki/page-1795「DAを持つ自軍コマンド」）", () => {
    const s = resolveAll(ncEnter("XG2-023:b", 2, { command: releasedCat("WB", 1) }, {}));
    expect(cardIn(s, "player1", "TST-OP:cWB0")?.commandHeld).toBe(false);
    expect(spOf(s, "player1", "XG2-023:b")).toBe(0);
  });

  it("XG2-023: NC しなければ（バトルエリアの1番目）発動せず、SP は「！」のまま（ストライクで与えるダメージ0）（出典: atwiki/page-1795・R-CN-01）", () => {
    const s = ncEnter("XG2-023:b", 0, { command: releasedCat("DA", 1) }, enemy(), EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG2-023");
    expect(spOf(settle(s), "player1", "XG2-023:b")).toBe(0);
  });

  it("XG2-023: ※レジスト — 敵軍ターン中にバトルで撃破されるとき、レジストを使える（出典: atwiki/page-1795「※レジスト」・R-KW-RESIST-01）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG2-023", "b")] }, "XG2-023:b"))).toBe(true);
  });
});

// ===========================================================================
describe("XG2-024 剣将ブドー", () => {
  const TEXT = "【一騎打ち】敵軍バトルエリアのユニットが1体だけなら、これのBPを+4000してもよい。そうしたとき、自軍バトルフェイズ終了時にこれを撃破する。";

  it("XG2-024: カタログ本文・スペックが出典と一致（出典: atwiki/page-1741）", () => {
    expectCatalogText("XG2-024", TEXT);
    expectUnit("XG2-024", { name: "剣将ブドー", category: "DA", size: "S", bp: 5000, sp: undefined, powerCost: 4, comboNumber: 1, features: ["宇宙海賊", "男", "侍"] });
    expectRarityIn("XG2-024", ["N"]);
  });

  const one = () => ncEnter("XG2-024:b", 0, {}, { battle: [inst("TST-UNIT-0", "x")] });

  it.fails("XG2-024: 【一騎打ち】NC で、敵軍バトルエリアのユニットが1体だけなら BP+4000 するかを選べ（任意）、すると BP9000 になる（出典: atwiki/page-1741「これのBPを+4000してもよい」・カード評価「BPが9000にまで上昇する」） 既知の不具合: CARD-XG2-024 【一騎打ち】の選択が開かず、BP が上がらない", () => {
    let s = one();
    expectChoiceFrom(s, "player1", "XG2-024");
    expect(canSkip(s)).toBe(true);
    s = settle(accept(s));
    expect(bpOf(s, "player1", "XG2-024:b")).toBe(9000);
  });

  it.fails("XG2-024: 【一騎打ち】BP+4000 したときは、自軍バトルフェイズ終了時にこれを撃破する（出典: atwiki/page-1741「そうしたとき、自軍バトルフェイズ終了時にこれを撃破する」） 既知の不具合: CARD-XG2-024 【一騎打ち】がなく、バトルフェイズ終了時に撃破されない", () => {
    let s = settle(accept(one()));
    s = resolveAll(nextPhase(passEntry(s)));
    expect(zoneOf(s, "player1", "XG2-024:b")).toBe("discard");
  });

  it("XG2-024: 【一騎打ち】BP を上げなければ、BP5000 のままでバトルフェイズ終了時にも撃破されない（出典: atwiki/page-1741「してもよい。そうしたとき」）", () => {
    let s = one();
    if (s.pendingEffectChoice?.sourceCardId === "XG2-024") s = skip(s);
    s = settle(s);
    expect(bpOf(s, "player1", "XG2-024:b")).toBe(5000);
    s = resolveAll(nextPhase(passEntry(s)));
    expect(zoneOf(s, "player1", "XG2-024:b")).toBe("battle");
  });

  it("XG2-024: 【一騎打ち】敵軍バトルエリアのユニットが2体なら発動しない（BP5000 のまま）（出典: atwiki/page-1741「1体だけなら」）", () => {
    const s = ncEnter("XG2-024:b", 0, {}, { battle: [inst("TST-UNIT-0", "x"), inst("TST-UNIT-0", "y")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG2-024");
    expect(bpOf(settle(s), "player1", "XG2-024:b")).toBe(5000);
  });
});

// ===========================================================================
/** ギンガレッド・ギンガブルー・ギンガイエロー（XG2）の ※「これをラッシュしたとき、ライドされていない自軍ビークルを1体選び、これの下に重ねてもよい。」の共通テスト。 */
function stackTests(id: string, page: string, cost: number) {
  const board = (command = [...releasedCat("MA", 1), ...releasedCat("WB", 2)]) =>
    rushBoard({ hand: [inst(id, "h")], rush: [inst("RS-466", "v"), inst("RS-470", "gt"), inst("RS-570", "db"), inst("TST-UNIT-0", "u")], power: powerCards(cost), command });
  const rushed = () => {
    const r = rushFromHand(board(), "player1", `${id}:h`);
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it(`${id}: マルチカテゴリ（WB／MA）— 自軍コマンドゾーンに WB と MA のコマンドがあれば、MA のコマンドをホールドしてラッシュできる。WB のコマンドだけではラッシュできない（出典: ${page}「カテゴリ：ワイルドビースト／ミスティックアームズ」・R-CAT-02・カード評価「どちらのカテゴリのコマンドからもラッシュできる」）`, () => {
    const s = rushed();
    expect(zoneOf(s, "player1", `${id}:h`)).toBe("rush");
    expect(cardIn(s, "player1", "TST-OP-MA:cMA0")?.commandHeld).toBe(true);
    expect(canStartRush(board(releasedCat("WB", 2)), "player1", `${id}:h`)).toBe(false);
  });

  it(`${id}: ※ ラッシュしたとき、ライドされていない自軍ビークルを1体選べる（ビークルでないユニットは選べない）。任意。公式Q&A: ライドに制限のあるビークル（RS-570 デカバイク）や、ホールドが必要なビークル（RS-470 ギンガット）も選べる（出典: ${page}「ライドされていない自軍ビークルを1体選び、これの下に重ねてもよい」・Q1「はい、すべてできます。「ライド」ではなく「重ねる」です」）`, () => {
    const s = rushed();
    expectChoiceFrom(s, "player1", id);
    expect(choiceIds(s)).toEqual(["RS-466:v", "RS-470:gt", "RS-570:db"]);
    expect(canSkip(s)).toBe(true);
  });

  it(`${id}: ※ 選んだビークルをこれの下に重ねる（ライドしている状態）。ギンガットでもコマンドをホールドしない（出典: ${page} Q1「コマンドをホールドせずに…重ねることはできますか？」「はい、すべてできます」）`, () => {
    const s = resolveAll(pick(rushed(), "RS-470:gt"));
    expect(ridesOn(s, "player1", `${id}:h`, "RS-470:gt")).toBe(true);
    expect(heldCount(s, "player1")).toBe(1);
  });

  it(`${id}: ※ 重ねなくてもよい（ビークルはラッシュエリアに別に残る）（出典: ${page}「重ねてもよい」）`, () => {
    let s = rushed();
    if (s.pendingEffectChoice?.sourceCardId === id) s = skip(s);
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-466:v")).toBe("rush");
    expect(ridesOn(s, "player1", `${id}:h`, "RS-466:v")).toBe(false);
  });
}

// ===========================================================================
describe("XG2-025 ギンガレッド", () => {
  const TEXT =
    "※これをラッシュしたとき、ライドされていない自軍ビークルを1体選び、これの下に重ねてもよい。 【二刃一閃】自分も相手も次のようにする⇒自分自身のエリアに同名ユニットが2体以上あれば、1体選びゲームから除外する";

  it("XG2-025: カタログ本文・スペックが出典と一致（出典: atwiki/page-1233）", () => {
    expectCatalogText("XG2-025", TEXT);
    expectUnit("XG2-025", { name: "ギンガレッド", category: ["WB", "MA"], size: "S", bp: 3000, sp: undefined, powerCost: 2, comboNumber: 1, features: ["レッド", "男"] });
    expectRarityIn("XG2-025", ["R"]);
  });

  stackTests("XG2-025", "atwiki/page-1233", 2);

  it("XG2-025: 公式Q&A — XG4-009 オートスライダー【緊急出動】で重ねてラッシュエリアに出たときは、ビークルを重ねられない（出典: atwiki/page-1233 Q2「いいえ、それはできません。ビークルとビークルを重ねるのはルール上不適切だからです」）", () => {
    const r = rushFromHand(
      rushBoard({ hand: [inst("XG4-009", "as")], rush: [inst("RS-466", "v")], power: powerCards(4), command: [released("XG2-025", "cmd"), ...releasedCat("ET", 1)] }),
      "player1",
      "XG4-009:as",
    );
    expect(r.ok, r.error).toBe(true);
    let s = r.state;
    for (let i = 0; i < 4 && s.pendingEffectChoice && s.pendingEffectChoice.sourceCardId !== "XG2-025"; i++) s = settle(accept(s, s.pendingEffectChoice.validInstanceIds.includes("XG2-025:cmd") ? "XG2-025:cmd" : undefined));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG2-025");
    expect(ridesOn(s, "player1", "XG2-025:cmd", "RS-466:v")).toBe(false);
  });

  const nc = (p2battle: ReturnType<typeof inst>[]) => ncEnter("XG2-025:r", 0, { rush: [inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b")] }, { battle: p2battle });

  it.fails("XG2-025: 【二刃一閃】NC で、自分も相手も、自分のエリア（ラッシュエリア・バトルエリア）に同名ユニットが2体以上あれば1体選びゲームから除外する（出典: atwiki/page-1233「自分も相手も次のようにする⇒自分自身のエリアに同名ユニットが2体以上あれば、1体選びゲームから除外する」・カード評価「自軍にも効果が及ぶ」） 既知の不具合: CARD-XG2-025 【二刃一閃】がなく、同名ユニットが除外されない", () => {
    const s = resolveAll(nc([inst("TST-UNIT-0", "c"), inst("TST-UNIT-0", "d")]));
    expect(["TST-UNIT-0:a", "TST-UNIT-0:b"].filter((id) => exiled(s, "player1", id))).toHaveLength(1);
    expect(["TST-UNIT-0:c", "TST-UNIT-0:d"].filter((id) => exiled(s, "player2", id))).toHaveLength(1);
  });

  it("XG2-025: 【二刃一閃】同名ユニットが1体ずつなら除外しない（出典: atwiki/page-1233「2体以上あれば」）", () => {
    const s = resolveAll(ncEnter("XG2-025:r", 0, { rush: [inst("TST-UNIT-0", "a")] }, { battle: [inst("TST-UNIT-0", "c"), inst("TST-UNIT-7", "d")] }));
    expect(exiled(s, "player1", "TST-UNIT-0:a")).toBe(false);
    expect(zoneOf(s, "player2", "TST-UNIT-0:c")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-7:d")).toBe("battle");
  });
});

// ===========================================================================
describe("XG2-026 ギンガブルー", () => {
  const TEXT = "※これをラッシュしたとき、ライドされていない自軍ビークルを1体選び、これの下に重ねてもよい。 【激流一刀】「SP1」これが敵軍ユニットをバトルで撃破したとき、1枚ドローしてもよい。";

  it("XG2-026: カタログ本文・スペックが出典と一致（出典: atwiki/page-1749）", () => {
    expectCatalogText("XG2-026", TEXT);
    expectUnit("XG2-026", { name: "ギンガブルー", category: ["WB", "MA"], size: "S", bp: 3000, sp: "special", powerCost: 3, comboNumber: 2, features: ["ブルー", "男"] });
    expectRarityIn("XG2-026", ["N"]);
  });

  stackTests("XG2-026", "atwiki/page-1749", 3);

  it("XG2-026: 【激流一刀】NC（バトルエリアの2番目）で「SP1」を得る。NC しなければ（1番目）SP は「！」のまま（出典: atwiki/page-1749「「SP1」」・R-CN-01）", () => {
    expect(spOf(settle(ncEnter("XG2-026:b", 1)), "player1", "XG2-026:b")).toBe(1);
    expect(spOf(settle(ncEnter("XG2-026:b", 0)), "player1", "XG2-026:b")).toBe(0);
  });

  it.fails("XG2-026: 【激流一刀】NC したターン、これが敵軍ユニットをバトルで撃破したとき、1枚ドローするかを選べ（任意）、ドローすると手札が1枚増える（出典: atwiki/page-1749「これが敵軍ユニットをバトルで撃破したとき、1枚ドローしてもよい」） 既知の不具合: CARD-XG2-026 【激流一刀】のドローがない（撃破しても選択が開かずドローしない）", () => {
    let s = settle(attack(settle(ncEnter("XG2-026:b", 1, {}, { battle: [inst("TST-UNIT-0", "x")] })), "XG2-026:b", "TST-UNIT-0:x"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:x")).toBe("discard");
    expectChoiceFrom(s, "player1", "XG2-026");
    expect(canSkip(s)).toBe(true);
    const before = handN(s);
    s = resolveAll(accept(s));
    expect(handN(s)).toBe(before + 1);
  });

  it("XG2-026: 【激流一刀】バトルで撃破できなければ（相手が BP13000）ドローしない（出典: atwiki/page-1749「撃破したとき」）", () => {
    const s = resolveAll(attack(settle(ncEnter("XG2-026:b", 1, {}, { battle: [inst("TST-UNIT-7", "x")] })), "XG2-026:b", "TST-UNIT-7:x"));
    expect(zoneOf(s, "player2", "TST-UNIT-7:x")).toBe("battle");
    expect(handN(s)).toBe(0);
  });

  it("XG2-026: 【激流一刀】NC していなければ（1番目）撃破してもドローしない（出典: atwiki/page-1749・R-CN-01）", () => {
    const s = resolveAll(attack(settle(ncEnter("XG2-026:b", 0, {}, { battle: [inst("TST-UNIT-0", "x")] })), "XG2-026:b", "TST-UNIT-0:x"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:x")).toBe("discard");
    expect(handN(s)).toBe(0);
  });
});

// ===========================================================================
describe("XG2-027 ギンガイエロー", () => {
  const TEXT =
    "※これをラッシュしたとき、ライドされていない自軍ビークルを1体選び、これの下に重ねてもよい。 【雷一掃】「SP1」特徴「メカ」を持つ敵軍Sユニットを好きな数選びホールドしてもよい。ただし、選べるユニットの数は、リリース状態の自軍コマンドの数までとする。";

  it("XG2-027: カタログ本文・スペックが出典と一致（出典: atwiki/page-1796）", () => {
    expectCatalogText("XG2-027", TEXT);
    expectUnit("XG2-027", { name: "ギンガイエロー", category: ["WB", "MA"], size: "S", bp: 500, sp: "special", powerCost: 1, comboNumber: 3, features: ["イエロー", "男"] });
    expectRarityIn("XG2-027", ["N"]);
  });

  stackTests("XG2-027", "atwiki/page-1796", 1);

  const enemy = () => ({ battle: [inst("SPEC-MECHA-S", "m1"), inst("SPEC-MECHA-S", "m2"), inst("SPEC-MECHA-M", "mm"), inst("TST-UNIT-0", "p")], rush: [inst("SPEC-MECHA-S", "r")] });
  const nc = (cmds = 2) => ncEnter("XG2-027:y", 2, { command: releasedCat("WB", cmds) }, enemy(), EXTRA);

  it("XG2-027: 【雷一掃】NC（バトルエリアの3番目）で「SP1」を得る（出典: atwiki/page-1796「「SP1」」・R-CN-01）", () => {
    let s = nc();
    if (s.pendingEffectChoice?.sourceCardId === "XG2-027") s = skip(s);
    expect(spOf(settle(s), "player1", "XG2-027:y")).toBe(1);
  });

  it.fails("XG2-027: 【雷一掃】NC で、特徴「メカ」を持つ敵軍 S ユニット（ラッシュエリア・バトルエリア）を選べる。M ユニット・「メカ」を持たないユニットは選べない。任意（出典: atwiki/page-1796「特徴「メカ」を持つ敵軍Sユニットを好きな数選びホールドしてもよい」） 既知の不具合: CARD-XG2-027 【雷一掃】の選択が開かない（「SP1」だけ得る）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG2-027");
    expect(choiceIds(s)).toEqual(["SPEC-MECHA-S:m1", "SPEC-MECHA-S:m2", "SPEC-MECHA-S:r"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG2-027: 【雷一掃】選べる数はリリース状態の自軍コマンドの数まで（2つなら2体）。選んだユニットはホールド状態になる（出典: atwiki/page-1796「ただし、選べるユニットの数は、リリース状態の自軍コマンドの数までとする」） 既知の不具合: CARD-XG2-027 【雷一掃】がなく、敵軍ユニットをホールドできない", () => {
    let s = nc(2);
    expectChoiceFrom(s, "player1", "XG2-027");
    expect(s.pendingEffectChoice?.selectCount).toBe(2);
    s = resolveAll(s, ["SPEC-MECHA-S:m1", "SPEC-MECHA-S:r"]);
    expect(cardIn(s, "player2", "SPEC-MECHA-S:m1")?.commandHeld).toBe(true);
    expect(cardIn(s, "player2", "SPEC-MECHA-S:r")?.commandHeld).toBe(true);
    expect(cardIn(s, "player2", "SPEC-MECHA-S:m2")?.commandHeld ?? false).toBe(false);
  });
});
