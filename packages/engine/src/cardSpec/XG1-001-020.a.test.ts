/**
 * カード別スペック: XG1-001〜XG1-007（クロスギャザー ザ・ファーストエンカウント バトルジャパン〜チェンジドラゴン）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）に XG のカードの項はない
 *     （「XG」・カード名で検索。同じカード名の RS 版の項があるだけ）。atwiki に転載された公式 Q&A（XG1-003 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG1-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-WING-01・02、R-KW-CALL-01、コマンドゾーンは5枚まで〈02-zones-cards〉）・atwiki のカード評価・コメント欄
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG1-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合と重なるもの: XG1-007 のナンバー（rulesSpec/07-scrum-takus-cross R-KW-CROSS-01・07-perm-tag-other R-KW-TERMS-01 が CN3 の NC で使う）。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  attackSettled,
  canSkip,
  cardIn,
  choiceIds,
  choicePlayer,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectUnitStats,
  faceDown,
  fullCommand,
  inst,
  isDamageCard,
  isHeldCard,
  ncAt,
  p1Battle,
  pick,
  powerCards,
  raw,
  releasedCat,
  resident,
  resolveAll,
  rushFromHand,
  rushPhaseBoard,
  skip,
  spOf,
  sUnit,
  targetsOf,
  wingAttack,
  wingTests,
  zoneOf,
} from "./XG1-001-020.helpers";

const C0 = sUnit("SPEC-C0", { category: "ET", bp: 1000, powerCost: 0 });
const C1 = sUnit("SPEC-C1", { category: "ET", bp: 1000, powerCost: 1 });
const C2 = sUnit("SPEC-C2", { category: "ET", bp: 1000, powerCost: 2 });
const C3 = sUnit("SPEC-C3", { category: "ET", bp: 1000, powerCost: 3 });
const M1 = sUnit("SPEC-M1", { category: "ET", bp: 3000, powerCost: 1, size: "M" });
const E500 = sUnit("SPEC-E500", { category: "ET", bp: 500, sp: undefined });
/** カード ID は違うがカード名が「SPEC-E500」のユニット。 */
const E500_ALT = sUnit("SPEC-E500-ALT", { name: "SPEC-E500", category: "ET", bp: 500, sp: undefined });
const OT_S = sUnit("SPEC-OT-S", { category: "OT", bp: 1000 });
const OT_M = sUnit("SPEC-OT-M", { category: "OT", bp: 3000, size: "M" });
const ET_S = sUnit("SPEC-ET-S", { category: "ET", bp: 1000 });
const EXTRA = [C0, C1, C2, C3, M1, E500, E500_ALT, OT_S, OT_M, ET_S];

// ===========================================================================
describe("XG1-001 バトルジャパン", () => {
  const TEXT = "【空手技】「SP1」レジストを持つ敵軍Sユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  it("XG1-001: カタログ本文・スペックが出典と一致（出典: atwiki/page-1544）", () => {
    expectCatalogText("XG1-001", TEXT);
    expectUnitStats("XG1-001", { name: "バトルジャパン", category: "ET", size: "S", bp: 3000, sp: "special", powerCost: 2, comboNumber: 5, features: ["レッド", "男"] });
    expectRarityIn("XG1-001", ["N"]);
  });

  // 敵軍: レジストを持つ S ユニット（XG1-041 仮面ライダーアマゾン〈バトルエリア〉・XG1-043 カメバズーカ〈ラッシュエリア〉）と、レジストを持たない S ユニット。
  const enemy = (p2: Partial<GameState["players"]["player2"]> = {}) => ({ battle: [inst("XG1-041", "am"), inst("SPEC-C2", "x")], rush: [inst("XG1-043", "kb")], ...p2 });
  const nc = (p2: Partial<GameState["players"]["player2"]> = {}) => ncAt("XG1-001:bj", 5, {}, enemy(p2), EXTRA);

  it("XG1-001: 「SP1」— 5番目に並んで NC が成立すると SP1 になる（出典: atwiki/page-1544「SP：！」「【空手技】「SP1」」）", () => {
    expect(spOf(nc(), "player1", "XG1-001:bj")).toBe(1);
  });

  it("XG1-001: NC が成立しなければ SP を持たない（1番目に出たとき）（出典: atwiki/page-1544「SP：！」・R-STK-03）", () => {
    expect(spOf(ncAt("XG1-001:bj", 1, {}, enemy(), EXTRA), "player1", "XG1-001:bj")).toBe(0);
  });

  it("XG1-001: 【空手技】NC — レジストを持つ敵軍 S ユニット（ラッシュエリア・バトルエリアを問わない）から1体を選ぶ。レジストを持たないユニットは選べない。見送れない（既知の不具合: CARD-XG1-001 【空手技】のユニットの選択が開かない）（出典: atwiki/page-1544「レジストを持つ敵軍Sユニットを1体選び」・カード評価「ラッシュエリアに届くのが強み」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG1-001");
    expect(choiceIds(s)).toEqual(["XG1-041:am", "XG1-043:kb"]);
    expect(canSkip(s)).toBe(false);
  });

  it("XG1-001: 選んだユニットは持ち主（敵軍）のコマンドゾーンにホールド状態で置かれる（既知の不具合: CARD-XG1-001）（出典: atwiki/page-1544「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(nc(), ["XG1-043:kb"]);
    expect(zoneOf(s, "player2", "XG1-043:kb")).toBe("command");
    expect(isHeldCard(s, "player2", "XG1-043:kb")).toBe(true);
    expect(zoneOf(s, "player2", "XG1-041:am")).toBe("battle");
  });

  it("XG1-001: 敵軍コマンドゾーンが5枚で置けなければ、選んだユニットは捨札になる（既知の不具合: CARD-XG1-001）（出典: atwiki/page-1544「置けなければ捨札にする」・02-zones-cards コマンドゾーンは5枚まで）", () => {
    const s = resolveAll(nc({ command: fullCommand(5) }), ["XG1-041:am"]);
    expect(zoneOf(s, "player2", "XG1-041:am")).toBe("discard");
    expect(s.players.player2.command).toHaveLength(5);
  });

  it("XG1-001: レジストを持つ敵軍 S ユニットがいなければ何も選ばない（出典: atwiki/page-1544）", () => {
    const s = resolveAll(ncAt("XG1-001:bj", 5, {}, { battle: [inst("SPEC-C2", "x")] }, EXTRA));
    expect(zoneOf(s, "player2", "SPEC-C2:x")).toBe("battle");
    expect(s.players.player2.command).toHaveLength(0);
  });
});

// ===========================================================================
describe("XG1-002 デンジレッド", () => {
  const TEXT =
    "【デンジスティック】敵軍常駐置き場にカードが2枚以上あれば、その中から1枚選んでもよい（ウラ向きのカードはウラ向きのまま選ぶ）。そうしたとき、選んだカードを持ち主のパワーゾーンに置く。このとき、選んだカードがウラ向きだったなら、ダメージにして置く。";

  it("XG1-002: カタログ本文・スペックが出典と一致（出典: atwiki/page-1597）", () => {
    expectCatalogText("XG1-002", TEXT);
    expectUnitStats("XG1-002", { name: "デンジレッド", category: "OT", size: "S", bp: 3000, sp: undefined, powerCost: 1, comboNumber: 2, features: ["レッド", "男"] });
    expectRarityIn("XG1-002", ["N"]);
  });

  const nc = (operation = [inst("XG1-015", "o1"), inst("RS-244", "o2")]) => ncAt("XG1-002:dr", 2, {}, { operation }, EXTRA);

  it("XG1-002: 【デンジスティック】NC — 敵軍常駐置き場にカードが2枚あれば、その中から1枚選べる（任意）（出典: atwiki/page-1597「敵軍常駐置き場にカードが2枚以上あれば、その中から1枚選んでもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG1-002");
    expect(choiceIds(s)).toEqual(["RS-244:o2", "XG1-015:o1"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-002: 選んだオモテ向きのカードは持ち主（敵軍）のパワーゾーンにオモテ向きで置かれる。もう1枚は常駐置き場に残る（既知の不具合: CARD-XG1-002 候補は出るが、選ぶ手〈resolve_effect_choice〉が不正な手になり選べない）（出典: atwiki/page-1597「選んだカードを持ち主のパワーゾーンに置く」）", () => {
    const s = resolveAll(pick(nc(), "XG1-015:o1"));
    expect(zoneOf(s, "player2", "XG1-015:o1")).toBe("power");
    expect(isDamageCard(s, "player2", "XG1-015:o1")).toBe(false);
    expect(zoneOf(s, "player2", "RS-244:o2")).toBe("operation");
  });

  it("XG1-002: 選ばなければ何も起きない（出典: atwiki/page-1597「選んでもよい」）", () => {
    const s = resolveAll(skip(nc()));
    expect(s.players.player2.operation).toHaveLength(2);
    expect(s.players.player2.power).toHaveLength(0);
  });

  it("XG1-002: 敵軍常駐置き場のカードが1枚なら発動しない（出典: atwiki/page-1597「カードが2枚以上あれば」）", () => {
    const s = nc([inst("XG1-015", "o1")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XG1-002");
  });

  it("XG1-002: 常駐に重ねられたウラ向きのカードも「常駐置き場のカード」としてウラ向きのまま選べ、選べば持ち主のパワーゾーンにダメージ（ウラ向き）として置かれる（既知の不具合: CARD-XG1-002 重ねたウラ向きのカードが候補にない）（出典: atwiki/page-1597「（ウラ向きのカードはウラ向きのまま選ぶ）」「選んだカードがウラ向きだったなら、ダメージにして置く」・カード評価「カードをウラ向きで重ねる常駐オペレーションは闇の戒律やゲゲル、クロックアップなど」）", () => {
    const s0 = nc([resident("TST-OP", "res", [faceDown("TST-OP", "fd")]), inst("XG1-015", "o1")]);
    expect(choiceIds(s0)).toContain("TST-OP:fd");
    const s = resolveAll(pick(s0, "TST-OP:fd"));
    expect(zoneOf(s, "player2", "TST-OP:fd")).toBe("power");
    expect(isDamageCard(s, "player2", "TST-OP:fd")).toBe(true);
  });
});

// ===========================================================================
describe("XG1-003 バルイーグル", () => {
  const TEXT =
    "※ウイング 【新飛羽返し】SP1これがバトルで敵軍ユニットを撃破したとき、これが撃破したユニットと同じカード名の敵軍ユニットをすべて撃破する。（この効果はこれがウイングでアタックするときはナンバーに関係なく発動する）";

  it("XG1-003: カタログ本文・スペックが出典と一致（出典: atwiki/page-1594）", () => {
    expectCatalogText("XG1-003", TEXT);
    expectUnitStats("XG1-003", { name: "バルイーグル", category: "ET", size: "S", bp: 3000, sp: "special", powerCost: 2, comboNumber: 5, features: ["レッド", "男"] });
    expectRarityIn("XG1-003", ["N"]);
  });

  wingTests("XG1-003", "atwiki/page-1594");

  // 敵軍: 同じカード名（SPEC-E500。うち1体はカード ID の違う SPEC-E500-ALT）のユニットがバトルエリアとラッシュエリアに、違うカード名のユニットが1体。
  const enemy = { battle: [inst("SPEC-E500", "a"), inst("SPEC-C2", "other")], rush: [inst("SPEC-E500", "b"), inst("SPEC-E500-ALT", "c")] };

  it("XG1-003: 「SP1」— 5番目に並んで NC が成立すると SP1 になる（既知の不具合: CARD-XG1-003 NC が成立しても SP を持たない）（出典: atwiki/page-1594「SP：！」「【新飛羽返し】SP1」）", () => {
    expect(spOf(ncAt("XG1-003:be", 5, {}, enemy, EXTRA), "player1", "XG1-003:be")).toBe(1);
  });

  it("XG1-003: NC — これがバトルで敵軍ユニットを撃破したとき、同じカード名の敵軍ユニット（エリアを問わない）をすべて撃破する。違うカード名のユニットは残る（既知の不具合: CARD-XG1-003 【新飛羽返し】の撃破が起きない）（出典: atwiki/page-1594「これが撃破したユニットと同じカード名の敵軍ユニットをすべて撃破する」）", () => {
    const s = resolveAll(attackSettled(ncAt("XG1-003:be", 5, {}, enemy, EXTRA), "XG1-003:be", "SPEC-E500:a"));
    expect(zoneOf(s, "player2", "SPEC-E500:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E500:b")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E500-ALT:c")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C2:other")).toBe("battle");
  });

  it("XG1-003: ウイングでアタックするときは、ナンバーに関係なく【新飛羽返し】が発動する（ラッシュエリアからのアタックで撃破したときも同名のユニットをすべて撃破する）（既知の不具合: CARD-XG1-003）（出典: atwiki/page-1594「（この効果はこれがウイングでアタックするときはナンバーに関係なく発動する）」・カード評価「ラッシュエリアから単体で効果が使えるのが強み」）", () => {
    const s0 = p1Battle({ rush: [inst("XG1-003", "w")] }, enemy, EXTRA);
    const s = resolveAll(wingAttack(s0, "XG1-003:w", "SPEC-E500:a"));
    expect(zoneOf(s, "player2", "SPEC-E500:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E500:b")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-C2:other")).toBe("battle");
  });

  it("XG1-003: NC が成立せず（1番目）ウイングでもないアタックで撃破したときは、同名のユニットは撃破しない（出典: atwiki/page-1594「SP：！」・ナンバーコンビネーションの効果）", () => {
    const s = resolveAll(attackSettled(ncAt("XG1-003:be", 1, {}, enemy, EXTRA), "XG1-003:be", "SPEC-E500:a"));
    expect(zoneOf(s, "player2", "SPEC-E500:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E500:b")).toBe("rush");
  });

  it("XG1-003: 公式Q&A — ウイングでアタックするときでも NC 自体は発動していないので、「NCもRCも発動していないSユニットにアタックされない」XG1-096 ビーファイタークワガーにはアタックできない（出典: atwiki/page-1594 Q1「いいえ、それはできません」）", () => {
    const s0 = p1Battle({ rush: [inst("XG1-003", "w")] }, { battle: [inst("XG1-096", "kw"), inst("SPEC-C2", "other")] }, EXTRA);
    const s = act(s0, { type: "hold_for_wing", playerId: "player1", instanceId: "XG1-003:w" });
    expect(targetsOf(s, "XG1-003:w")).not.toContain("XG1-096:kw");
    expect(targetsOf(s, "XG1-003:w")).toContain("SPEC-C2:other");
  });
});

// ===========================================================================
describe("XG1-004 ゴーグルレッド", () => {
  const TEXT =
    "【レッドルビームチ】敵軍コマンドゾーンからSユニットのカードを1枚選んでもよい。そうしたとき、相手は選ばれたカードをラッシュエリアかバトルエリアに出す。このときバトルエリアに出したなら、相手は自分自身の山札の上から1枚引いて、自分自身のコマンドゾーンに置く。";

  it("XG1-004: カタログ本文・スペックが出典と一致（出典: atwiki/page-1680）", () => {
    expectCatalogText("XG1-004", TEXT);
    expectUnitStats("XG1-004", { name: "ゴーグルレッド", category: "ET", size: "S", bp: 4000, sp: undefined, powerCost: 3, comboNumber: 3, features: ["レッド", "男"] });
    expectRarityIn("XG1-004", ["SR"]);
  });

  // 敵軍コマンドゾーン: S ユニットのカード・M ユニットのカード・オペレーションのカード。
  const nc = () => ncAt("XG1-004:gr", 3, {}, { command: [inst("SPEC-C2", "cu"), inst("SPEC-M1", "cm"), inst("TST-OP", "co")] }, EXTRA);

  it("XG1-004: 【レッドルビームチ】NC — 敵軍コマンドゾーンの S ユニットのカードから1枚選べる（M ユニット・オペレーションのカードは選べない。任意）（既知の不具合: CARD-XG1-004 【レッドルビームチ】の選択が開かない）（出典: atwiki/page-1680「敵軍コマンドゾーンからSユニットのカードを1枚選んでもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG1-004");
    expect(choiceIds(s)).toEqual(["SPEC-C2:cu"]);
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-004: 選ぶと、ラッシュエリアかバトルエリアかは相手が選ぶ（既知の不具合: CARD-XG1-004）（出典: atwiki/page-1680「相手は選ばれたカードをラッシュエリアかバトルエリアに出す」・カード評価「どのエリアに出すのか決めるのが自分では無い」）", () => {
    const s = pick(nc(), "SPEC-C2:cu");
    expect(choicePlayer(s)).toBe("player2");
  });

  it("XG1-004: 相手がラッシュエリアを選べば、そのカードは敵軍ラッシュエリアに出て、コマンドの補充はない（既知の不具合: CARD-XG1-004）（出典: atwiki/page-1680「このときバトルエリアに出したなら」）", () => {
    const s = resolveAll(nc(), ["SPEC-C2:cu", "rush"]);
    expect(zoneOf(s, "player2", "SPEC-C2:cu")).toBe("rush");
    expect(s.players.player2.command).toHaveLength(2);
    expect(s.players.player2.deck).toHaveLength(5);
  });

  it("XG1-004: 相手がバトルエリアを選べば、そのカードは敵軍バトルエリアに出て、相手は山札の上から1枚引いてリリース状態でコマンドゾーンに置く（既知の不具合: CARD-XG1-004）（出典: atwiki/page-1680「相手は自分自身の山札の上から1枚引いて、自分自身のコマンドゾーンに置く」・カード評価「補充されるコマンドはリリース状態で置かれる」）", () => {
    const s = resolveAll(nc(), ["SPEC-C2:cu", "battle"]);
    expect(zoneOf(s, "player2", "SPEC-C2:cu")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-OP:e0")).toBe("command");
    expect(isHeldCard(s, "player2", "TST-OP:e0")).toBe(false);
  });
});

// ===========================================================================
describe("XG1-005 ダイナレッド", () => {
  const TEXT =
    "【ドリームギャラクシー】自軍コマンドのカテゴリの数を数えて、その数以下の必要パワーの数字を持つ敵軍Sユニットを１体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  it("XG1-005: カタログ本文・スペックが出典と一致（出典: atwiki/page-1595）", () => {
    expectCatalogText("XG1-005", TEXT);
    expectUnitStats("XG1-005", { name: "ダイナレッド", category: "ET", size: "S", bp: 2000, sp: undefined, powerCost: 2, comboNumber: 3, features: ["レッド", "男"] });
    expectRarityIn("XG1-005", ["N"]);
  });

  // 敵軍: 必要パワー0（ラッシュエリア）・2・3 の S ユニットと、必要パワー1 の M ユニット。
  const enemy = (p2: Partial<GameState["players"]["player2"]> = {}) => ({ battle: [inst("SPEC-C2", "b"), inst("SPEC-C3", "c"), inst("SPEC-M1", "m")], rush: [inst("SPEC-C0", "z")], ...p2 });
  const nc = (command = [...releasedCat("ET", 1), ...releasedCat("OT", 1)], p2: Partial<GameState["players"]["player2"]> = {}) =>
    ncAt("XG1-005:dn", 3, { command }, enemy(p2), EXTRA);

  it("XG1-005: 【ドリームギャラクシー】NC — 自軍コマンドのカテゴリの数（ET・OT の2）以下の必要パワーの数字を持つ敵軍 S ユニット（エリアを問わない。M は対象外）から1体選ぶ。見送れない（既知の不具合: CARD-XG1-005 ラッシュエリアのユニットが候補にない・数より大きい必要パワーのユニットが候補に入る）（出典: atwiki/page-1595「その数以下の必要パワーの数字を持つ敵軍Sユニットを１体選び」・コメント欄「エリア無視とはいえ1体しか除去出来ない」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG1-005");
    expect(choiceIds(s)).toEqual(["SPEC-C0:z", "SPEC-C2:b"]);
    expect(canSkip(s)).toBe(false);
  });

  it("XG1-005: 選んだユニットは持ち主（敵軍）のコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-1595「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = resolveAll(pick(nc(), "SPEC-C2:b"));
    expect(zoneOf(s, "player2", "SPEC-C2:b")).toBe("command");
    expect(isHeldCard(s, "player2", "SPEC-C2:b")).toBe(true);
  });

  it("XG1-005: 敵軍コマンドゾーンが5枚なら、選んだユニットは捨札になる（出典: atwiki/page-1595「置けなければ捨札にする」）", () => {
    const s = resolveAll(pick(nc(undefined, { command: fullCommand(5) }), "SPEC-C2:b"));
    expect(zoneOf(s, "player2", "SPEC-C2:b")).toBe("discard");
  });

  it("XG1-005: 数えるのはカテゴリの種類の数（ET のコマンドが3枚でも1）（既知の不具合: CARD-XG1-005）（出典: atwiki/page-1595「自軍コマンドのカテゴリの数を数えて」）", () => {
    const s = nc(releasedCat("ET", 3));
    expect(choiceIds(s)).toEqual(["SPEC-C0:z"]);
  });

  it("XG1-005: マルチカテゴリのコマンドは持つカテゴリをそれぞれ数える（WB／ET のコマンド1枚で2）（既知の不具合: CARD-XG1-005）（出典: atwiki/page-1595・コメント欄「カテゴリ跨ぎのモーフ持ち…を使ってコマンドのカテゴリの合計数が多くなる様に」）", () => {
    const s = nc([{ ...inst("TST-OP-WB-ET", "mc"), commandHeld: false }]);
    expect(choiceIds(s)).toEqual(["SPEC-C0:z", "SPEC-C2:b"]);
  });
});

// ===========================================================================
describe("XG1-006 レッドワン", () => {
  const TEXT = "【バイオソード】「SP1」カテゴリを1つ宣言してもよい。そうしたとき、宣言したカテゴリを持つSユニットを相手に1体選ばせ、持ち主のパワーゾーンに送る。";

  it("XG1-006: カタログ本文・スペックが出典と一致（出典: atwiki/page-1598）", () => {
    expectCatalogText("XG1-006", TEXT);
    expectUnitStats("XG1-006", { name: "レッドワン", category: "OT", size: "S", bp: 3000, sp: "special", powerCost: 3, comboNumber: 4, features: ["レッド", "男"] });
    expectRarityIn("XG1-006", ["N"]);
  });

  // 自軍ラッシュエリアに OT の S ユニット、敵軍に OT の S ユニット（バトルエリア・ラッシュエリア）・OT の M ユニット・ET の S ユニット。
  const nc = () =>
    ncAt("XG1-006:r1", 4, { rush: [inst("SPEC-OT-S", "own")] }, { battle: [inst("SPEC-OT-S", "eb"), inst("SPEC-OT-M", "em"), inst("SPEC-ET-S", "et")], rush: [inst("SPEC-OT-S", "er")] }, EXTRA);

  it("XG1-006: 「SP1」— 4番目に並んで NC が成立すると SP1 になる（出典: atwiki/page-1598「SP：！」「【バイオソード】「SP1」」）", () => {
    expect(spOf(nc(), "player1", "XG1-006:r1")).toBe(1);
  });

  it("XG1-006: 【バイオソード】NC — カテゴリを1つ宣言するかを選べる（任意）（既知の不具合: CARD-XG1-006 カテゴリの宣言が開かない）（出典: atwiki/page-1598「カテゴリを1つ宣言してもよい」）", () => {
    const s = nc();
    expectChoiceFrom(s, "player1", "XG1-006");
    expect(canSkip(s)).toBe(true);
  });

  it("XG1-006: 宣言すると、宣言したカテゴリ（OT）を持つ S ユニット（自軍のユニットも含む。M・ほかのカテゴリは対象外）の中から相手が1体選ぶ（既知の不具合: CARD-XG1-006）（出典: atwiki/page-1598「宣言したカテゴリを持つSユニットを相手に1体選ばせ」・コメント欄「相手と自分が同じカテゴリのカードを使ってたら自爆させられる」）", () => {
    const s = pick(nc(), "OT");
    expectChoiceFrom(s, "player2", "XG1-006");
    // これ自身（OT の S ユニット）も宣言したカテゴリを持つ S ユニットなので候補に入る（XG1-judgments 実装時の判断）。
    expect(choiceIds(s)).toEqual(["SPEC-OT-S:eb", "SPEC-OT-S:er", "SPEC-OT-S:own", "XG1-006:r1"]);
  });

  it("XG1-006: 相手が選んだユニットは持ち主のパワーゾーンに送られる（相手が自軍のユニットを選べば自軍パワーゾーン）（既知の不具合: CARD-XG1-006）（出典: atwiki/page-1598「持ち主のパワーゾーンに送る」）", () => {
    const s = resolveAll(nc(), ["OT", "SPEC-OT-S:own"]);
    expect(zoneOf(s, "player1", "SPEC-OT-S:own")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-OT-S:eb")).toBe("battle");
  });
});

// ===========================================================================
describe("XG1-007 チェンジドラゴン", () => {
  const TEXT = "※コールET 【チェンジソード】「SP1」";

  it("XG1-007: カタログ本文・スペックが出典と一致（出典: atwiki/page-1643）", () => {
    expectCatalogText("XG1-007", TEXT);
    expectUnitStats("XG1-007", { name: "チェンジドラゴン", category: ["MA", "ET"], size: "S", bp: 3000, sp: "special", powerCost: 2, comboNumber: 3, features: ["レッド", "男", "ドラゴン"] });
    expectRarityIn("XG1-007", ["NR"]);
  });

  it("XG1-007: 【チェンジソード】— 3番目に並んで NC が成立すると SP1 になる（出典: atwiki/page-1643「【チェンジソード】「SP1」」）", () => {
    expect(spOf(ncAt("XG1-007:cd", 3, {}, {}, EXTRA), "player1", "XG1-007:cd")).toBe(1);
  });

  it("XG1-007: NC が成立しなければ（2番目）SP を持たない（出典: atwiki/page-1643「SP：！」）", () => {
    expect(spOf(ncAt("XG1-007:cd", 2, {}, {}, EXTRA), "player1", "XG1-007:cd")).toBe(0);
  });

  it("XG1-007: ※コールET — 自軍ラッシュエリアのこれを、ET のユニットをラッシュするためのコマンドとしてホールドできる（出典: atwiki/page-1643「※コールET」・R-KW-CALL-01）", () => {
    let s = rushPhaseBoard({ hand: [inst("SPEC-ET-S", "h")], rush: [inst("XG1-007", "cd")], power: powerCards(3) }, {}, EXTRA);
    s = raw(s, { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: "SPEC-ET-S:h" });
    expect(s.pendingCommandPayment?.validInstanceIds).toContain("XG1-007:cd");
    s = raw(s, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: ["XG1-007:cd"] });
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "SPEC-ET-S:h")).toBe("rush");
    expect(cardIn(s, "player1", "XG1-007:cd")?.commandHeld).toBe(true);
  });

  it("XG1-007: ※コールET は OT のユニットのラッシュには使えない（出典: atwiki/page-1643「※コールET」・R-KW-CALL-01）", () => {
    const s = rushPhaseBoard({ hand: [inst("SPEC-OT-S", "h")], rush: [inst("XG1-007", "cd")], power: powerCards(3) }, {}, EXTRA);
    const r = rushFromHand(s, "player1", "SPEC-OT-S:h");
    expect(r.ok && zoneOf(r.state, "player1", "SPEC-OT-S:h") === "rush").toBe(false);
  });
});
