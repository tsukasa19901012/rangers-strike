/**
 * カード別スペック: XG1-075〜XG1-080（クロスギャザー ザ・ファーストエンカウント 仮面ライダーダークキバ〜仮面ライダーアビス）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ に XG のカードの項はない。atwiki に転載された公式 Q&A:
 *     XG1-078 Q1・Q2（atwiki/page-1608。効果の優先順・JC の効果を書き換えたとき）、XG1-080 Q1（atwiki/page-1563。マルチカテゴリのラッシュ）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG1-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01、R-KW-MORPH、05-battle-strike-damage「1/N」の SP、ラッシュのコマンドのカテゴリ）・atwiki のカード評価・コメント
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG1-NNN …」）で残す。
 * カタログの誤りは「既知の不具合: CARD-XG1-NNN カタログ …」と書く。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import {
  DEFS,
  act,
  advanceToBattle,
  attackUntilRegister,
  canSkip,
  choiceIds,
  deckCards,
  deckIds,
  enteredFromRush,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectUnitStats,
  heldUnit,
  inst,
  isDamageCard,
  isHeldCard,
  legal,
  p1Battle,
  pick,
  powerCards,
  rcAt,
  rcRideOff,
  registerOffered,
  releasedCat,
  resolveAll,
  rushPhaseBoard,
  rushResults,
  skip,
  sUnit,
  targetsOf,
  useCard,
  zoneOf,
  PLAIN_VEHICLE,
} from "./XG1-061-080.helpers";
import type { GameState } from "../types/game";

const C3 = sUnit("SPEC-C3", { powerCost: 3 });
const C6 = sUnit("SPEC-C6", { powerCost: 6 });
const MM = sUnit("SPEC-MM", { bp: 2000, features: ["ミラーモンスター"] });
const B3 = sUnit("SPEC-B3", { bp: 3000 });
const B35 = sUnit("SPEC-B35", { bp: 3500 });
const B45 = sUnit("SPEC-B45", { bp: 4500 });
const B15 = sUnit("SPEC-B15", { bp: 1500 });
const DAS = sUnit("SPEC-DAS", { category: "DA" });
const WBDA = sUnit("SPEC-WBDA", { category: ["WB", "DA"] });
const EXTRA = [PLAIN_VEHICLE, C3, C6, MM, B3, B35, B45, B15, DAS, WBDA];

const DCD = ["仮面ライダー", "男", "ディケイドライバー"];

// ===========================================================================
describe("XG1-075 仮面ライダーダークキバ", () => {
  const TEXT =
    "※レジスト 【キングスバーストエンド】自軍ターン中、これがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、敵軍パワーゾーンのオモテ向きのカードを1枚選び、選んだカードの必要パワーの数字と同じ必要パワーの数字を持つ敵軍Sユニットがあればすべて撃破する。このとき、1体以上撃破したなら、選んだカードをダメージにする。";

  it("XG1-075: カタログ本文・スペックが出典と一致（出典: atwiki/page-1662）", () => {
    expectCatalogText("XG1-075", TEXT);
    expectUnitStats("XG1-075", { name: "仮面ライダーダークキバ", category: ["MA", "DA"], size: "S", bp: 4000, sp: undefined, powerCost: 6, features: ["仮面ライダー", "男", "ファンガイア"] });
    expectRarityIn("XG1-075", ["SR"]);
  });

  it("XG1-075: ※レジスト — 敵軍ターンにバトルで撃破されるとき、レジストを使える（出典: atwiki/page-1662「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XG1-075", "dk")] }, "XG1-075:dk"))).toBe(true);
  });

  const entered = (power = [inst("SPEC-C3", "p3"), inst("TST-P", "p0")]) =>
    enteredFromRush("XG1-075:dk", {}, { power, battle: [inst("SPEC-C3", "b3"), inst("TST-UNIT-0", "o")], rush: [inst("SPEC-C3", "r3")] }, EXTRA);

  it("XG1-075: 【キングスバーストエンド】自軍ターンにバトルエリアに出たとき、これをホールドするかを選べる（任意）（既知の不具合: CARD-XG1-075 選択が開かない）（出典: atwiki/page-1662「これをホールドしてもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG1-075");
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-075: ホールドして敵軍パワーゾーンのオモテ向きの必要パワー3のカードを選ぶと、必要パワー3の敵軍 S ユニット（バトルエリア・ラッシュエリア）をすべて撃破し、選んだカードをダメージにする（既知の不具合: CARD-XG1-075）（出典: atwiki/page-1662「同じ必要パワーの数字を持つ敵軍Sユニットがあればすべて撃破する。このとき、1体以上撃破したなら、選んだカードをダメージにする」）", () => {
    const s = resolveAll(entered(), ["accept", "SPEC-C3:p3"]);
    expect(isHeldCard(s, "player1", "XG1-075:dk")).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-C3:b3")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C3:r3")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:o")).toBe("battle");
    expect(isDamageCard(s, "player2", "SPEC-C3:p3")).toBe(true);
  });

  it("XG1-075: 同じ必要パワーの敵軍 S ユニットがないカード（必要パワー6）を選ぶと、何も撃破せず、そのカードもダメージにしない（既知の不具合: CARD-XG1-075 選択が開かない）（出典: atwiki/page-1662「1体以上撃破したなら」）", () => {
    const s0 = entered([inst("SPEC-C6", "p6")]);
    expectChoiceFrom(s0, "player1", "XG1-075");
    const s = resolveAll(s0, ["accept", "SPEC-C6:p6"]);
    expect(zoneOf(s, "player2", "SPEC-C3:b3")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:o")).toBe("battle");
    expect(isDamageCard(s, "player2", "SPEC-C6:p6")).toBe(false);
  });
});

// ===========================================================================
describe("XG1-076 ディケイドライバー", () => {
  const TEXT =
    "次の効果から1つ選び発動する⇒ ◎自軍山札を見て、「仮面ライダーディケイド」のカードを1枚選び、自軍ラッシュエリアに出してもよい。その後山札をシャッフルする。 ◎自軍山札を見て、特徴「ディケイドライバー」を持つユニットカードを1枚選び、自軍パワーゾーンに置いてもよい。その後山札をシャッフルする。";

  it("XG1-076: カタログ本文・スペックが出典と一致（出典: atwiki/page-1616）", () => {
    expectCatalogText("XG1-076", TEXT);
    expectOpStats("XG1-076", { name: "ディケイドライバー", category: "OT", powerCost: 1 });
    expectRarityIn("XG1-076", ["N"]);
  });

  const used = () =>
    useCard(
      rushPhaseBoard({ hand: [inst("XG1-076", "dd")], command: releasedCat("OT", 1), power: powerCards(1), deck: [inst("TST-OP", "x"), inst("XG1-077", "dc"), inst("XG1-064", "ag"), ...deckCards(3)] }, {}, EXTRA),
      "player1",
      "XG1-076:dd",
    );

  it("XG1-076: ◎1つ目 — 山札の「仮面ライダーディケイド」（XG1-077）を1枚選び自軍ラッシュエリアに出せる（既知の不具合: CARD-XG1-076 何も起きずに終わる）（出典: atwiki/page-1616「「仮面ライダーディケイド」のカードを1枚選び、自軍ラッシュエリアに出してもよい」・コメント「なにで出そうが場に出たら「ラッシュ」扱い」）", () => {
    const s = used();
    expectChoiceFrom(s, "player1", "XG1-076");
    const t = resolveAll(s, ["XG1-077:dc"]);
    expect(zoneOf(t, "player1", "XG1-077:dc")).toBe("rush");
  });

  it("XG1-076: ◎1つ目 — 「※これは「仮面ライダーディケイド」または「仮面ライダークウガ」としてつかえる」XG7-042 も選べる（出典: atwiki/page-1616「「仮面ライダーディケイド」のカードを1枚選び」・atwiki/page-1668 Q1「としてつかえる」は全ての場で常に有効）", () => {
    const s = useCard(
      rushPhaseBoard({ hand: [inst("XG1-076", "dd")], command: releasedCat("OT", 1), power: powerCards(1), deck: [inst("TST-OP", "x"), inst("XG7-042", "kd"), ...deckCards(3)] }, {}, EXTRA),
      "player1",
      "XG1-076:dd",
    );
    const t = resolveAll(s, ["XG7-042:kd"]);
    expect(zoneOf(t, "player1", "XG7-042:kd")).toBe("rush");
  });

  it("XG1-076: ◎2つ目 — 山札の特徴「ディケイドライバー」を持つユニットカード（XG1-064）を1枚選び自軍パワーゾーンに置ける（オペレーションは選べない）（既知の不具合: CARD-XG1-076 何も起きずに終わる）（出典: atwiki/page-1616「特徴「ディケイドライバー」を持つユニットカードを1枚選び、自軍パワーゾーンに置いてもよい」）", () => {
    const s = used();
    expectChoiceFrom(s, "player1", "XG1-076");
    const t = resolveAll(s, ["mode_2", "XG1-064:ag"]);
    expect(zoneOf(t, "player1", "XG1-064:ag")).toBe("power");
    expect(zoneOf(t, "player1", "TST-OP:x")).toBe("deck");
  });
});

// ===========================================================================
describe("XG1-077 仮面ライダーディケイド", () => {
  const TEXT =
    "※モーフ ※これはリリース状態のユニットにアタックすることができない。 【ライドブッカー】自軍山札の上から3枚をオモテにしてもよい。そうしたとき、オモテにしたカードの中から、特徴「仮面ライダー」を持つユニットカードを1枚選び、自軍パワーゾーンに置く。その後、それ以外のカードは好きな順で山札の下に戻す。";

  it("XG1-077: カタログ本文・スペックが出典と一致（出典: atwiki/page-1542）", () => {
    expectCatalogText("XG1-077", TEXT);
    expectUnitStats("XG1-077", { name: "仮面ライダーディケイド", category: "OT", size: "S", bp: 5000, sp: undefined, powerCost: 2, comboNumber: "RC", features: DCD });
    expectRarityIn("XG1-077", ["SR"]);
  });

  it("XG1-077: ※ リリース状態のユニットにはアタックできず、ホールド状態のユニットにはアタックできる（出典: atwiki/page-1542「※これはリリース状態のユニットにアタックすることができない」）", () => {
    const s = enteredFromRush("XG1-077:dc", {}, { battle: [inst("TST-UNIT-0", "r"), heldUnit("TST-UNIT-0", "h")] }, EXTRA);
    expect(targetsOf(s, "XG1-077:dc")).toEqual(["TST-UNIT-0:h"]);
  });

  const rc = () => rcAt("XG1-077:dc", { deck: [inst("TST-OP", "d0"), inst("XG1-064", "ag"), inst("XG1-066", "fz"), ...deckCards(2)] }, {}, EXTRA);

  it("XG1-077: 【ライドブッカー】RC — 山札の上から3枚をオモテにするかを選べる（任意）（出典: atwiki/page-1542「自軍山札の上から3枚をオモテにしてもよい」）", () => {
    const s = rc();
    expectChoiceFrom(s, "player1", "XG1-077");
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-077: 選べるのはオモテにした3枚のうち特徴「仮面ライダー」を持つユニットカードだけ（オペレーションは選べない）（既知の不具合: CARD-XG1-077 オペレーションも候補に入る）（出典: atwiki/page-1542「特徴「仮面ライダー」を持つユニットカードを1枚選び」）", () => {
    expect([...choiceIds(rc())].sort()).toEqual(["XG1-064:ag", "XG1-066:fz"]);
  });

  it("XG1-077: 選んだカードは自軍パワーゾーンに置き、それ以外の2枚は山札の下に戻す（既知の不具合: CARD-XG1-077 選んだカードが山札の上に残り、ほかのカードが捨札になる）（出典: atwiki/page-1542「自軍パワーゾーンに置く。その後、それ以外のカードは好きな順で山札の下に戻す」）", () => {
    const s = resolveAll(rc(), ["XG1-064:ag"]);
    expect(zoneOf(s, "player1", "XG1-064:ag")).toBe("power");
    const deck = deckIds(s);
    expect(deck).toHaveLength(4);
    expect(deck.slice(0, 2)).toEqual(["TST-OP:dk0", "TST-OP:dk1"]);
    expect([...deck.slice(2)].sort()).toEqual(["TST-OP:d0", "XG1-066:fz"]);
  });

  it("XG1-077: それ以外の2枚を山札の下に戻す順を選べ、オモテにした3枚は公開表示に出る（出典: atwiki/page-1542「それ以外のカードは好きな順で山札の下に戻す」）", () => {
    let s = act(rc(), { type: "resolve_effect_choice", playerId: "player1", instanceId: "XG1-064:ag" });
    expect(s.lastReveal?.cards.map((c) => [c.instanceId, c.destination])).toEqual([
      ["TST-OP:d0", "deck_bottom"],
      ["XG1-064:ag", "power"],
      ["XG1-066:fz", "deck_bottom"],
    ]);
    expect(s.pendingEffectChoice?.effectId).toBe("xg1_077_ride_booker_order");
    expect([...(s.pendingEffectChoice?.validInstanceIds ?? [])].sort()).toEqual(["TST-OP:d0", "XG1-066:fz"]);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "XG1-066:fz" });
    expect(s.pendingEffectChoice?.selectedInstanceIds).toEqual(["XG1-066:fz", "TST-OP:d0"]);
    s = resolveAll(act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "order_done" }));
    expect(deckIds(s)).toEqual(["TST-OP:dk0", "TST-OP:dk1", "XG1-066:fz", "TST-OP:d0"]);
  });

  it("XG1-077: 特徴「仮面ライダー」のユニットカードがなくても、オモテにした3枚が公開表示に出て、3枚を山札の下に戻す順を選べる（出典: atwiki/page-1542「それ以外のカードは好きな順で山札の下に戻す」）", () => {
    let s = rcAt("XG1-077:dc", { deck: [inst("TST-OP", "x0"), inst("TST-OP", "x1"), inst("TST-OP", "x2"), ...deckCards(2)] }, {}, EXTRA);
    expect(choiceIds(s)).toEqual(["accept"]);
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "accept" });
    expect(s.lastReveal?.cards.map((c) => c.instanceId)).toEqual(["TST-OP:x0", "TST-OP:x1", "TST-OP:x2"]);
    expect(s.lastReveal?.cards.every((c) => c.destination === "deck_bottom")).toBe(true);
    expect([...(s.pendingEffectChoice?.validInstanceIds ?? [])].sort()).toEqual(["TST-OP:x0", "TST-OP:x1", "TST-OP:x2"]);
    for (const id of ["TST-OP:x2", "TST-OP:x0", "order_done"]) s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: id });
    s = resolveAll(s);
    expect(deckIds(s)).toEqual(["TST-OP:dk0", "TST-OP:dk1", "TST-OP:x2", "TST-OP:x0", "TST-OP:x1"]);
  });

  it("XG1-077: オモテにしなければ山札はそのまま（出典: atwiki/page-1542「してもよい」）", () => {
    const s = resolveAll(skip(rc()));
    expect(deckIds(s)).toEqual(["TST-OP:d0", "XG1-064:ag", "XG1-066:fz", "TST-OP:dk0", "TST-OP:dk1"]);
  });
});

// ===========================================================================
describe("XG1-078 コピーベント", () => {
  const TEXT =
    "Sユニットを2体選ぶ。このターン、1体目に選んだユニットの効果名を持つ効果は、2体目に選んだユニットの効果名を持つ効果になる。ただし、1体目がナンバーを持たないなら2体目もナンバーを持たないユニットしか選べず、1体目がナンバーを持つなら、2体目もナンバーを持つユニットしか選べない。";

  it("XG1-078: カタログ本文・スペックが出典と一致（出典: atwiki/page-1608）", () => {
    expectCatalogText("XG1-078", TEXT);
    expectOpStats("XG1-078", { name: "コピーベント", category: "WB", powerCost: 5 });
    expectRarityIn("XG1-078", ["N"]);
  });

  it("XG1-078: 特徴「アドベントカード」を持つ（既知の不具合: CARD-XG1-078 カタログ の特徴が空）（出典: atwiki/page-1608「特徴：アドベントカード」・カード評価「特徴「アドベントカード」を持つオペレーション」）", () => {
    expect(DEFS["XG1-078"]!.features ?? []).toEqual(["アドベントカード"]);
  });

  const used = (rush: ReturnType<typeof inst>[], p2: Partial<GameState["players"]["player2"]> = {}) =>
    useCard(rushPhaseBoard({ hand: [inst("XG1-078", "cv")], rush, command: releasedCat("WB", 1), power: powerCards(5) }, p2, EXTRA), "player1", "XG1-078:cv");

  it("XG1-078: S ユニットを2体選ぶ選択が開く（見送れない）（出典: atwiki/page-1608「Sユニットを2体選ぶ」）", () => {
    const s = used([inst("XG1-064", "a"), inst("XG1-066", "b")]);
    expectChoiceFrom(s, "player1", "XG1-078");
    expect(canSkip(s)).toBe(false);
    expect(choiceIds(s)).toEqual(expect.arrayContaining(["XG1-064:a", "XG1-066:b"]));
  });

  it("XG1-078: 1体目がナンバー（RC）を持つなら、2体目もナンバーを持つユニットしか選べない（ナンバーを持たない XG1-072 は選べない）（出典: atwiki/page-1608「1体目がナンバーを持つなら、2体目もナンバーを持つユニットしか選べない」・カード評価「JCやRCもナンバーであるため」）", () => {
    const s = pick(used([inst("XG1-072", "k"), inst("XG1-064", "a"), inst("XG1-066", "b")]), "XG1-064:a");
    expect(choiceIds(s)).toContain("XG1-066:b");
    expect(choiceIds(s)).not.toContain("XG1-072:k");
  });

  it("XG1-078: 1体目がナンバーを持たないなら、2体目もナンバーを持たないユニットしか選べない（RC の XG1-066 は選べない）（出典: atwiki/page-1608「1体目がナンバーを持たないなら2体目もナンバーを持たないユニットしか選べず」）", () => {
    const s = pick(used([inst("XG1-072", "k"), inst("XG1-079", "al"), inst("XG1-066", "b")]), "XG1-072:k");
    expect(choiceIds(s)).toContain("XG1-079:al");
    expect(choiceIds(s)).not.toContain("XG1-066:b");
  });

  it("XG1-078: このターン、1体目（XG1-064）の【アタックライド】は2体目（XG1-066）の【アタックライド】になり、RC で BP の下三桁が500 のユニットを撃破する（出典: atwiki/page-1608「1体目に選んだユニットの効果名を持つ効果は、2体目に選んだユニットの効果名を持つ効果になる」）", () => {
    let s = used([inst("SPEC-VEHICLE", "v"), inst("XG1-064", "a"), inst("XG1-066", "b")], { battle: [inst("SPEC-B15", "x"), inst("SPEC-DAS", "d")] });
    s = pick(pick(s, "XG1-064:a"), "XG1-066:b");
    s = rcRideOff(advanceToBattle(s, "player1"), "XG1-064:a", "SPEC-VEHICLE:v");
    expectChoiceFrom(s, "player1", "XG1-066");
    s = resolveAll(pick(s, "SPEC-B15:x"));
    expect(zoneOf(s, "player2", "SPEC-B15:x")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-DAS:d")).toBe("battle");
  });
});

// ===========================================================================
describe("XG1-079 アビスラッシャー", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【高圧の水流】自軍ターン中、これがバトルエリアに出たとき、敵軍バトルエリアからBP3000以下のSユニットを好きな数選びホールドしてもよい。";

  it("XG1-079: カタログ本文・スペックが出典と一致（出典: atwiki/page-1588）", () => {
    expectCatalogText("XG1-079", TEXT);
    expectUnitStats("XG1-079", { name: "アビスラッシャー", category: "WB", size: "S", bp: 3000, sp: "1/2", powerCost: 3, features: ["ミラーモンスター", "獣"] });
    expectRarityIn("XG1-079", ["N"]);
  });

  it("XG1-079: ※ 自軍コマンドを1つホールドしなければバトルエリアに出られない（リリース状態のコマンドがなければ出られない）（出典: atwiki/page-1588「※これは自軍コマンドを1つホールドしなければバトルエリアに出られない」）", () => {
    const none = p1Battle({ rush: [inst("XG1-079", "al")] }, {}, EXTRA);
    expect(legal(none).some((a) => (a.type === "move_to_battle" || a.type === "initiate_command_payment") && JSON.stringify(a).includes("XG1-079:al"))).toBe(false);
    const one = p1Battle({ rush: [inst("XG1-079", "al")], command: releasedCat("WB", 1) }, {}, EXTRA);
    expect(legal(one).some((a) => a.type === "initiate_command_payment" && a.kind === "battle_entry" && a.sourceInstanceId === "XG1-079:al")).toBe(true);
  });

  const entered = () => {
    const s = p1Battle({ rush: [inst("XG1-079", "al")], command: releasedCat("WB", 1) }, { battle: [inst("SPEC-B3", "a"), inst("SPEC-B35", "b"), inst("TST-UNIT-0", "c")], rush: [inst("TST-UNIT-0", "r")] }, EXTRA);
    const a = legal(s).find((x) => x.type === "initiate_command_payment" && x.kind === "battle_entry");
    if (!a) throw new Error("no battle_entry payment");
    return act(s, a);
  };

  it("XG1-079: 【高圧の水流】自軍ターンにバトルエリアに出たとき、敵軍 S ユニットを選ぶ選択が開く（任意）（出典: atwiki/page-1588「好きな数選びホールドしてもよい」）", () => {
    const s = entered();
    expect(zoneOf(s, "player1", "XG1-079:al")).toBe("battle");
    expectChoiceFrom(s, "player1", "XG1-079");
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-079: 候補は敵軍バトルエリアの BP3000 以下の S ユニットだけ（BP3500・ラッシュエリアのユニットは選べない）（既知の不具合: CARD-XG1-079 BP3500 も候補に入る）（出典: atwiki/page-1588「敵軍バトルエリアからBP3000以下のSユニット」）", () => {
    expect([...choiceIds(entered())].sort()).toEqual(["SPEC-B3:a", "TST-UNIT-0:c"]);
  });

  it("XG1-079: 選んだユニットは好きな数（2体）その場でホールドする（既知の不具合: CARD-XG1-079 1体しか選べず、選んだユニットが敵軍コマンドゾーンに移る）（出典: atwiki/page-1588「好きな数選びホールドしてもよい」）", () => {
    const s = resolveAll(pick(entered(), "SPEC-B3:a"), ["TST-UNIT-0:c"]);
    expect(zoneOf(s, "player2", "SPEC-B3:a")).toBe("battle");
    expect(isHeldCard(s, "player2", "SPEC-B3:a")).toBe(true);
    expect(isHeldCard(s, "player2", "TST-UNIT-0:c")).toBe(true);
  });
});

// ===========================================================================
describe("XG1-080 仮面ライダーアビス", () => {
  const TEXT =
    "【アビスダイブ】自軍ターン中、これがバトルエリアに出たとき、自軍ラッシュエリアから、特徴「ミラーモンスター」を持つ自軍ユニットを2体選んでもよい。そうしたとき、選んだ2体のBPの合計以下のBPを持つ敵軍Sユニットを1体選び撃破する。";

  it("XG1-080: カタログ本文・スペックが出典と一致（出典: atwiki/page-1563）", () => {
    expectCatalogText("XG1-080", TEXT);
    expectUnitStats("XG1-080", { name: "仮面ライダーアビス", category: ["WB", "DA"], size: "S", bp: 3000, sp: "1/2", powerCost: 2, features: ["仮面ライダー", "男", "ミラーライダー"] });
    expectRarityIn("XG1-080", ["R"]);
  });

  it("XG1-080: 公式Q&A — WB と DA のマルチカテゴリなので、WB だけのコマンドではラッシュできず、WB と DA を持つコマンドならラッシュできる（出典: atwiki/page-1563 Q1「自軍コマンドゾーンにWBとDAを持ったカードがなければいけません」）", () => {
    const wb = rushResults(rushPhaseBoard({ hand: [inst("XG1-080", "ab")], command: releasedCat("WB", 1), power: powerCards(2) }, {}, EXTRA), "player1", "XG1-080:ab");
    expect(wb.some((s) => zoneOf(s, "player1", "XG1-080:ab") === "rush")).toBe(false);
    const wbda = rushResults(rushPhaseBoard({ hand: [inst("XG1-080", "ab")], command: [inst("SPEC-WBDA", "c")], power: powerCards(2) }, {}, EXTRA), "player1", "XG1-080:ab");
    expect(wbda.some((s) => zoneOf(s, "player1", "XG1-080:ab") === "rush")).toBe(true);
  });

  const entered = (rush = [inst("SPEC-MM", "m1"), inst("SPEC-MM", "m2"), inst("TST-UNIT-0", "o")]) =>
    enteredFromRush("XG1-080:ab", { rush }, { battle: [inst("SPEC-B45", "x"), inst("SPEC-B3", "y")], rush: [inst("SPEC-B3", "r"), inst("SPEC-B45", "r2")] }, EXTRA);

  it("XG1-080: 【アビスダイブ】自軍ターンにバトルエリアに出たとき、まず自軍ラッシュエリアの特徴「ミラーモンスター」を持つユニット2体を選ぶ（任意）（既知の不具合: CARD-XG1-080 自軍ユニットを選ぶ段がなく、すぐに敵軍ユニットの選択が開く）（出典: atwiki/page-1563「特徴「ミラーモンスター」を持つ自軍ユニットを2体選んでもよい」）", () => {
    const s = entered();
    expectChoiceFrom(s, "player1", "XG1-080");
    expect(canSkip(s)).toBe(true);
    expect([...choiceIds(s)].sort()).toEqual(["SPEC-MM:m1", "SPEC-MM:m2"]);
  });

  it("XG1-080: 選んだ2体の BP の合計（4000）以下の敵軍 S ユニットを、バトルエリア・ラッシュエリアから1体選び撃破する（BP4500 は選べない）（既知の不具合: CARD-XG1-080 ラッシュエリアのユニットしか候補にならず、BP も見ない）（出典: atwiki/page-1563「選んだ2体のBPの合計以下のBPを持つ敵軍Sユニットを1体選び撃破する」・カード評価「ラッシュエリアにも届く」）", () => {
    const s = pick(pick(entered(), "SPEC-MM:m1"), "SPEC-MM:m2");
    expect([...choiceIds(s)].sort()).toEqual(["SPEC-B3:r", "SPEC-B3:y"]);
    expect(zoneOf(resolveAll(pick(s, "SPEC-B3:y")), "player2", "SPEC-B3:y")).toBe("discard");
  });

  it("XG1-080: 特徴「ミラーモンスター」を持つ自軍ユニットが1体しかなければ、選べず何も撃破しない（既知の不具合: CARD-XG1-080 選択が開き、撃破できる）（出典: atwiki/page-1563「2体選んでもよい。そうしたとき」）", () => {
    const s = entered([inst("SPEC-MM", "m1"), inst("TST-UNIT-0", "o")]);
    expect(s.pendingEffectChoice?.sourceCardId === "XG1-080").toBe(false);
  });
});
