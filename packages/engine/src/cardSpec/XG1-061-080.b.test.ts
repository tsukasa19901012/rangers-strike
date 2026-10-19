/**
 * カード別スペック: XG1-068〜XG1-074（クロスギャザー ザ・ファーストエンカウント ディケイド クウガMF〜仮面ライダーザビーRF）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に XG のカードの項はない。atwiki に転載された公式 Q&A:
 *     XG1-068 Q1（atwiki/page-1668。「○○としてつかえる」と RK-163 オルタナティブ・ゼロ）、XG1-069 Q1・XG1-072 Q1（XP-004 の【カメンライド】で置き換えたとき）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG1-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01、R-KW-MORPH、05-battle-strike-damage「1/N」の SP）・atwiki のカード評価・コメント
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG1-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの: XP-001-016.a（XG1-069・XG1-072 の XP-004 Q&A、XG1-068 をカメンライドの候補として使う）。本ファイルはカード自身の効果を見る。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attackUntilRegister,
  attackedInEnemyTurn,
  bpOf,
  canSkip,
  canStrike,
  choiceIds,
  confirm,
  enemyBoard,
  enteredFromRush,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnitStats,
  inst,
  isDamageCard,
  isHeldCard,
  legal,
  ncAt,
  p1Battle,
  pick,
  rcAt,
  registerOffered,
  releasedCat,
  resolveAll,
  rushPhaseBoard,
  rushResults,
  skip,
  spOf,
  strikeFlipping,
  sUnit,
  targetsOf,
  toTurnEnd,
  zoneOf,
} from "./XG1-061-080.helpers";
import type { GameState } from "../types/game";

const POL = sUnit("SPEC-POL", { features: ["警察"] });
const SL = sUnit("SPEC-SL", { size: "L" });
const C3 = sUnit("SPEC-C3", { powerCost: 3 });
const B4 = sUnit("SPEC-B4", { bp: 4000 });
const EXTRA = [POL, SL, C3, B4];

const DCD = ["仮面ライダー", "男", "ディケイドライバー"];

/** 自軍バトルフェイズの保留中の自軍コマンドの支払い（initiate_command_payment）を1つ進める。 */
function payCommands(s: GameState): GameState {
  const a = legal(s).find((x) => x.type === "initiate_command_payment" && x.playerId === "player1");
  if (!a) throw new Error("no command payment");
  return act(s, a);
}

// ===========================================================================
describe("XG1-068 ディケイド クウガMF", () => {
  const TEXT = "※モーフ ※これは「仮面ライダークウガMF」としてつかえる。 【アタックライド】このターン、これは特徴「警察」を持つ自軍ユニット1体につきBP+1000される。";

  it("XG1-068: カタログ本文・スペックが出典と一致（出典: atwiki/page-1668）", () => {
    expectCatalogText("XG1-068", TEXT);
    expectUnitStats("XG1-068", { name: "ディケイド クウガMF", category: "MA", size: "S", bp: 3000, sp: "1/3", powerCost: 4, comboNumber: "RC", features: DCD });
    expectRarityIn("XG1-068", ["R"]);
  });

  it.fails("XG1-068: 【アタックライド】RC — 特徴「警察」を持つ自軍ユニット（ラッシュエリア1体・バトルエリア1体）1体につき BP+1000 され、BP5000 になる（既知の不具合: CARD-XG1-068 BP が上がらない）（出典: atwiki/page-1668「特徴「警察」を持つ自軍ユニット1体につきBP+1000される」・カード評価「エリアを問わず警察持ちの自軍ユニットがいれば」）", () => {
    const s = resolveAll(rcAt("XG1-068:kg", { rush: [inst("SPEC-POL", "r")], battle: [inst("SPEC-POL", "b")] }, {}, EXTRA));
    expect(bpOf(s, "player1", "XG1-068:kg")).toBe(5000);
  });

  it("XG1-068: 特徴「警察」を持つ自軍ユニットがいなければ BP3000 のまま（出典: atwiki/page-1668）", () => {
    const s = resolveAll(rcAt("XG1-068:kg", { rush: [inst("TST-UNIT-0", "r")] }, {}, EXTRA));
    expect(bpOf(s, "player1", "XG1-068:kg")).toBe(3000);
  });

  it("XG1-068: 公式Q&A — 敵軍捨札の「仮面ライダークウガMF」（RK-029）を RK-163 の RC で選ぶと、敵軍ラッシュエリアの XG1-068 を撃破する候補にできる（出典: atwiki/page-1668 Q1「はい、撃破されます」）", () => {
    let s = rcAt("RK-163:az", {}, { discard: [inst("RK-029", "mf")], rush: [inst("XG1-068", "kg"), inst("TST-UNIT-0", "o")] }, EXTRA);
    s = pick(s, "RK-029:mf");
    expect(choiceIds(s)).toEqual(["XG1-068:kg"]);
    expect(zoneOf(pick(s, "XG1-068:kg"), "player2", "XG1-068:kg")).toBe("discard");
  });

  it("XG1-068: 公式Q&A — 逆に敵軍捨札の XG1-068 を選んでも、敵軍ラッシュエリアの「仮面ライダークウガMF」（RK-029）を撃破できる（出典: atwiki/page-1668 Q1「…がある場合でも同様です」）", () => {
    let s = rcAt("RK-163:az", {}, { discard: [inst("XG1-068", "kg")], rush: [inst("RK-029", "mf"), inst("TST-UNIT-0", "o")] }, EXTRA);
    s = pick(s, "XG1-068:kg");
    expect(choiceIds(s)).toEqual(["RK-029:mf"]);
    expect(zoneOf(pick(s, "RK-029:mf"), "player2", "RK-029:mf")).toBe("discard");
  });
});

// ===========================================================================
describe("XG1-069 ディケイド 響鬼", () => {
  const TEXT =
    "※モーフ ※レジスト ※これは「仮面ライダー響鬼」としてつかえる。 【アタックライド】自分の手札からオペレーションカードを1枚選び、捨札にしてもよい。そうしたとき、このターン、これは次の能力を得る⇒「SP1」になり、このターンを終えるときホールド状態なら、リリースしてもよい。";

  it("XG1-069: カタログ本文・スペックが出典と一致（出典: atwiki/page-1604。SP は「！」）", () => {
    expectCatalogText("XG1-069", TEXT);
    expectUnitStats("XG1-069", { name: "ディケイド 響鬼", category: "MA", size: "S", bp: 4000, sp: "special", powerCost: 5, comboNumber: 1, features: DCD });
    expectRarityIn("XG1-069", ["N"]);
  });

  it("XG1-069: ※レジスト — 敵軍ターンにバトルで撃破されるとき、レジストを使える（出典: atwiki/page-1604「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG1-069", "hb")] }, "XG1-069:hb"))).toBe(true);
  });

  const nc = () => ncAt("XG1-069:hb", 1, { hand: [inst("TST-OP", "op"), inst("TST-UNIT-0", "u")] }, {}, EXTRA);

  it("XG1-069: 【アタックライド】NC1 — 1番目に出たとき、手札のオペレーションを捨札にするかを選べる（任意）（出典: atwiki/page-1604「捨札にしてもよい」・CN1）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG1-069");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG1-069: 手札のオペレーションを捨札にすると「SP1」になる（ユニットカードは捨てられない）（既知の不具合: CARD-XG1-069 受けても何も捨札にならず SP も得ない）（出典: atwiki/page-1604「オペレーションカードを1枚選び、捨札にしてもよい。そうしたとき…「SP1」になり」）", () => {
    const s = resolveAll(confirm(nc()), ["TST-OP:op"]);
    expect(zoneOf(s, "player1", "TST-OP:op")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-0:u")).toBe("hand");
    expect(spOf(s, "player1", "XG1-069:hb")).toBe(1);
  });

  it.fails("XG1-069: 捨札にしたターン、ストライクしてホールド状態でターンを終えるとき、リリースしてもよい（既知の不具合: CARD-XG1-069 前提の捨札が動かず、リリースの機会もない）（出典: atwiki/page-1604「このターンを終えるときホールド状態なら、リリースしてもよい」）", () => {
    const s = resolveAll(confirm(nc()), ["TST-OP:op"]);
    expect(canStrike(s, "XG1-069:hb")).toBe(true);
    const t = toTurnEnd(settleStrike(s), "XG1-069");
    expectChoiceFrom(t, "player1", "XG1-069");
  });

  it("XG1-069: 捨札にしなければ SP を持たない（出典: atwiki/page-1604「そうしたとき」・SP「！」）", () => {
    const s = resolveAll(skip(nc()));
    expect(zoneOf(s, "player1", "TST-OP:op")).toBe("hand");
    expect(spOf(s, "player1", "XG1-069:hb")).toBe(0);
  });

  it("XG1-069: 1番目以外（2番目）に出たときは発動しない（出典: atwiki/page-1604 CN1）", () => {
    const s = ncAt("XG1-069:hb", 2, { hand: [inst("TST-OP", "op")] }, {}, EXTRA);
    expect(s.pendingEffectChoice).toBeFalsy();
    expect(spOf(s, "player1", "XG1-069:hb")).toBe(0);
  });
});

/** ストライクして反応をパスし終える。 */
function settleStrike(s: GameState): GameState {
  const a = legal(s).find((x) => x.type === "strike" && x.playerId === "player1");
  if (!a) throw new Error("no strike");
  return resolveAll(act(s, a));
}

// ===========================================================================
describe("XG1-070 ディケイド カブトRF", () => {
  const TEXT =
    "※モーフ ※これは「仮面ライダーカブトRF」としてつかえる。 ※これは敵軍Sユニットにアタックされない。 【アタックライド】自軍ターン中、これがバトルエリアに出たとき、自軍コマンドを3つホールドしてもよい。そうしたとき、このターン、これは「SP1」になる。";

  it("XG1-070: カタログ本文・スペックが出典と一致（出典: atwiki/page-1602。SP は「！」）", () => {
    expectCatalogText("XG1-070", TEXT);
    expectUnitStats("XG1-070", { name: "ディケイド カブトRF", category: "OT", size: "S", bp: 2000, sp: "special", powerCost: 5, features: DCD });
    expectRarityIn("XG1-070", ["N"]);
  });

  it("XG1-070: 【アタックライド】自軍ターンにバトルエリアに出たとき、自軍コマンドを3つホールドするかを選べる（任意）（出典: atwiki/page-1602「自軍コマンドを3つホールドしてもよい」）", () => {
    const s = enteredFromRush("XG1-070:kb", { command: releasedCat("OT", 3) }, {}, EXTRA);
    expectChoiceFrom(s, "player1", "XG1-070");
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-070: 3つホールドすると、このターン「SP1」になる（出典: atwiki/page-1602「そうしたとき、このターン、これは「SP1」になる」）", () => {
    const s = payCommands(enteredFromRush("XG1-070:kb", { command: releasedCat("OT", 3) }, {}, EXTRA));
    expect(isHeldCard(s, "player1", "TST-OP-OT:cOT0")).toBe(true);
    expect(isHeldCard(s, "player1", "TST-OP-OT:cOT2")).toBe(true);
    expect(spOf(s, "player1", "XG1-070:kb")).toBe(1);
  });

  it("XG1-070: ホールドしなければ SP を持たない（出典: atwiki/page-1602）", () => {
    const s = skip(enteredFromRush("XG1-070:kb", { command: releasedCat("OT", 3) }, {}, EXTRA));
    expect(isHeldCard(s, "player1", "TST-OP-OT:cOT0")).toBe(false);
    expect(spOf(s, "player1", "XG1-070:kb")).toBe(0);
  });

  it("XG1-070: リリース状態の自軍コマンドが2つしかなければホールドできず、SP も持たない（出典: atwiki/page-1602「3つホールドしてもよい」）", () => {
    const s = enteredFromRush("XG1-070:kb", { command: releasedCat("OT", 2) }, {}, EXTRA);
    expect(spOf(resolveAll(s), "player1", "XG1-070:kb")).toBe(0);
  });

  it.fails("XG1-070: ホールドするコマンドのカテゴリは問わない（WB のコマンド3つでも SP1 になる）（既知の不具合: CARD-XG1-070 OT のコマンドしか選べない）（出典: atwiki/page-1602「自軍コマンドを3つ」・カード評価「能力で使用するコマンドもOT以外のカテゴリでも良くなる」）", () => {
    const s = enteredFromRush("XG1-070:kb", { command: releasedCat("WB", 3) }, {}, EXTRA);
    expectChoiceFrom(s, "player1", "XG1-070");
    expect(spOf(payCommands(s), "player1", "XG1-070:kb")).toBe(1);
  });

  it("XG1-070: ※ 敵軍 S ユニットにはアタックされない（L ユニットにはアタックされる）（出典: atwiki/page-1602「※これは敵軍Sユニットにアタックされない」）", () => {
    const s = enemyBoard({ battle: [inst("XG1-070", "kb"), inst("TST-UNIT-0", "o")] }, { battle: [inst("TST-UNIT-0", "a"), inst("SPEC-SL", "l")] }, EXTRA);
    expect(targetsOf(s, "TST-UNIT-0:a", "player2")).toEqual(["TST-UNIT-0:o"]);
    expect(targetsOf(s, "SPEC-SL:l", "player2")).toContain("XG1-070:kb");
  });
});

// ===========================================================================
describe("XG1-071 ディケイド 電王SF", () => {
  const TEXT =
    "※モーフ ※これは「仮面ライダー電王SF」としてつかえる。 ※敵軍バトルエリアにユニットがあるとき、これはストライクできない。 【アタックライド】「SP1」これがストライクして相手がパワーゾーンのカードをウラ返すとき、ウラ返すカードと必要パワーの数字が同じ敵軍ユニットを1体選び撃破する。";

  it("XG1-071: カタログ本文・スペックが出典と一致（出典: atwiki/page-1600。SP は「！」）", () => {
    expectCatalogText("XG1-071", TEXT);
    expectUnitStats("XG1-071", { name: "ディケイド 電王SF", category: "OT", size: "S", bp: 4000, sp: "special", powerCost: 3, comboNumber: "RC", features: DCD });
    expectRarityIn("XG1-071", ["NR"]);
  });

  const rc = (p2: Partial<GameState["players"]["player2"]> = {}) =>
    rcAt("XG1-071:dn", {}, { power: [inst("SPEC-C3", "p3"), inst("TST-P", "p0")], rush: [inst("SPEC-C3", "r3"), inst("TST-UNIT-0", "r0")], ...p2 }, EXTRA);

  it("XG1-071: 【アタックライド】RC — 「SP1」を得てストライクできる（撃破できる敵軍ユニットがなくてもよい）（出典: atwiki/page-1600「「SP1」」・コメント「ライドオフした時点でRCが発動しSP1になる」）", () => {
    const s = resolveAll(rc());
    expect(spOf(s, "player1", "XG1-071:dn")).toBe(1);
    expect(canStrike(s, "XG1-071:dn")).toBe(true);
  });

  it("XG1-071: ※ 敵軍バトルエリアにユニットがあるときはストライクできない（出典: atwiki/page-1600「※敵軍バトルエリアにユニットがあるとき、これはストライクできない」）", () => {
    expect(canStrike(resolveAll(rc({ battle: [inst("TST-UNIT-0", "b")] })), "XG1-071:dn")).toBe(false);
  });

  it("XG1-071: ライドせずに出たとき（RC なし）は SP を持たない（出典: atwiki/page-1600 SP「！」・R-KW-RC-01）", () => {
    expect(spOf(enteredFromRush("XG1-071:dn", {}, {}, EXTRA), "player1", "XG1-071:dn")).toBe(0);
  });

  it.fails("XG1-071: ストライクで相手が必要パワー3のカードをウラ返すと、必要パワー3の敵軍ユニット（ラッシュエリア）を撃破する（既知の不具合: CARD-XG1-071 撃破されない）（出典: atwiki/page-1600「ウラ返すカードと必要パワーの数字が同じ敵軍ユニットを1体選び撃破する」）", () => {
    const s = resolveAll(strikeFlipping(resolveAll(rc()), "XG1-071:dn", "SPEC-C3:p3"), ["SPEC-C3:r3"]);
    expect(zoneOf(s, "player2", "SPEC-C3:r3")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:r0")).toBe("rush");
  });

  it("XG1-071: ウラ返すカードと必要パワーの数字が同じ敵軍ユニットがなければ、何も撃破しない（出典: atwiki/page-1600）", () => {
    const s = resolveAll(strikeFlipping(resolveAll(rc()), "XG1-071:dn", "TST-P:p0"));
    expect(zoneOf(s, "player2", "SPEC-C3:r3")).toBe("rush");
    expect(s.players.player2.damage).toBe(1);
  });
});

// ===========================================================================
describe("XG1-072 ディケイド キバ", () => {
  const TEXT =
    "※モーフ ※これは「仮面ライダーキバ」としてつかえる。 【アタックライド】自軍ターン中、これがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、敵軍バトルエリアからSユニットを1体選び、持ち主のパワーゾーンにダメージにして置く。";

  it("XG1-072: カタログ本文・スペックが出典と一致（出典: atwiki/page-1601）", () => {
    expectCatalogText("XG1-072", TEXT);
    expectUnitStats("XG1-072", { name: "ディケイド キバ", category: "MA", size: "S", bp: 2000, sp: undefined, powerCost: 6, features: DCD });
    expectRarityIn("XG1-072", ["N"]);
  });

  const entered = () => enteredFromRush("XG1-072:kv", {}, { battle: [inst("TST-UNIT-0", "a")], rush: [inst("TST-UNIT-0", "r")] }, EXTRA);

  it.fails("XG1-072: 【アタックライド】自軍ターンにバトルエリアに出たとき、これをホールドするかを選べる（任意）（既知の不具合: CARD-XG1-072 選択が開かない）（出典: atwiki/page-1601「これをホールドしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG1-072");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XG1-072: ホールドすると、敵軍バトルエリアの S ユニットを1体（ラッシュエリアは選べない）持ち主のパワーゾーンにダメージにして置く（既知の不具合: CARD-XG1-072）（出典: atwiki/page-1601「敵軍バトルエリアからSユニットを1体選び、持ち主のパワーゾーンにダメージにして置く」・カード評価「効果の対象は本家とは違いバトルエリア限定」）", () => {
    let s = resolveAll(entered(), ["accept"]);
    expect(isHeldCard(s, "player1", "XG1-072:kv")).toBe(true);
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:a"]);
    s = resolveAll(pick(s, "TST-UNIT-0:a"));
    expect(isDamageCard(s, "player2", "TST-UNIT-0:a")).toBe(true);
  });
});

// ===========================================================================
describe("XG1-073 仮面ライダーザビーMF", () => {
  const TEXT = "※これはアタックされるときBP+3000される。";

  it("XG1-073: カタログ本文・スペックが出典と一致（出典: atwiki/page-1569）", () => {
    expectCatalogText("XG1-073", TEXT);
    expectUnitStats("XG1-073", { name: "仮面ライダーザビーMF", category: "OT", size: "S", bp: 2000, sp: undefined, powerCost: 0, features: ["仮面ライダー", "男"] });
    expectRarityIn("XG1-073", ["N"]);
  });

  it("XG1-073: ※ アタックされるとき BP+3000（BP5000）になり、BP4000 のアタッカーに撃破されない（出典: atwiki/page-1569「※これはアタックされるときBP+3000される」）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("XG1-073", "mf")] }, "XG1-073:mf", {}, "SPEC-B4:atk", EXTRA);
    expect(zoneOf(s, "player1", "XG1-073:mf")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-B4:atk")).toBe("discard");
  });

  it("XG1-073: アタックされていないときは BP2000 のまま（出典: atwiki/page-1569）", () => {
    expect(bpOf(p1Battle({ battle: [inst("XG1-073", "mf")] }), "player1", "XG1-073:mf")).toBe(2000);
  });
});

// ===========================================================================
describe("XG1-074 仮面ライダーザビーRF", () => {
  const TEXT =
    "※レジスト ※これはアタックされる以外では相手に選ばれない。 【俺はもっと大事なものを見つけた】これが自軍エリアにある間、これ以外の自軍ラッシュエリアのユニットはアタックされない。";

  it("XG1-074: カタログ本文・スペックが出典と一致（出典: atwiki/page-1570）", () => {
    expectCatalogText("XG1-074", TEXT);
    expectUnitStats("XG1-074", { name: "仮面ライダーザビーRF", category: "OT", size: "S", bp: 3000, sp: "1/4", powerCost: "3+", features: ["仮面ライダー", "男", "加速"], rushCondition: "send_s_unit_to_power" });
    expectRarityIn("XG1-074", ["N"]);
  });

  it("XG1-074: 追加条件 — 自軍「仮面ライダーザビーMF」1体をパワーゾーンに送ってラッシュできる（出典: atwiki/page-1570「追加条件：自軍「仮面ライダーザビーMF」1体をパワーゾーンに送る」）", () => {
    const r = rushResults(rushPhaseBoard({ hand: [inst("XG1-074", "zr")], rush: [inst("XG1-073", "mf")], command: releasedCat("OT", 1), power: [inst("TST-P", "a"), inst("TST-P", "b"), inst("TST-P", "c")] }), "player1", "XG1-074:zr");
    expect(r.some((s) => zoneOf(s, "player1", "XG1-074:zr") === "rush" && zoneOf(s, "player1", "XG1-073:mf") === "power")).toBe(true);
  });

  it("XG1-074: 「仮面ライダーザビーMF」がいなければラッシュできない（出典: atwiki/page-1570・R-ADD-01）", () => {
    const r = rushResults(rushPhaseBoard({ hand: [inst("XG1-074", "zr")], rush: [inst("TST-UNIT-0", "o")], command: releasedCat("OT", 1), power: [inst("TST-P", "a"), inst("TST-P", "b"), inst("TST-P", "c")] }), "player1", "XG1-074:zr");
    expect(r.some((s) => zoneOf(s, "player1", "XG1-074:zr") === "rush")).toBe(false);
  });

  it("XG1-074: ※レジスト — 敵軍ターンにバトルで撃破されるとき、レジストを使える（出典: atwiki/page-1570「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG1-074", "zr")] }, "XG1-074:zr"))).toBe(true);
  });

  it.fails("XG1-074: ※ アタックされる以外では相手に選ばれない（敵軍 XG1-048 の RC【エレキ光線】の候補に入らない）（既知の不具合: CARD-XG1-074 候補に入る）（出典: atwiki/page-1570「※これはアタックされる以外では相手に選ばれない」）", () => {
    const s = rcAt("XG1-048:s1", {}, { battle: [inst("XG1-074", "zr"), inst("TST-UNIT-0", "o")] }, EXTRA);
    expectChoiceFrom(s, "player1", "XG1-048");
    expect(choiceIds(s)).not.toContain("XG1-074:zr");
  });

  it("XG1-074: 【俺はもっと大事なものを見つけた】これ以外の自軍ラッシュエリアのユニットは、ラッシュエリアにアタックできる敵軍ユニット（RS-675）にもアタックされない（出典: atwiki/page-1570「これ以外の自軍ラッシュエリアのユニットはアタックされない」）", () => {
    const s = enemyBoard({ rush: [inst("XG1-074", "zr"), inst("TST-UNIT-0", "o")] }, { battle: [inst("RS-675", "bl")] }, EXTRA);
    expect(targetsOf(s, "RS-675:bl", "player2")).not.toContain("TST-UNIT-0:o");
  });

  it.todo(
    "XG1-074: 対照 — ザビーRF がなければ、ラッシュエリアの同じユニットは RS-675 にアタックされる（組めない: RS-675【ウォーターアロー】でラッシュエリアにアタックする手がエンジンに出ないため、ザビーRF の有無で差を見られない）（出典: atwiki/page-1570・RS-675 本文）",
  );
});
