/**
 * カード別スペック: PM-001 ジライヤ・SM-001 3人の宇宙刑事・SK-000〜SK-004（シークレットレア 仮面ライダー龍騎ブランク体〜仮面ライダークウガUF）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「PM-」「SM-」「SK-」とカード名で検索:
 *     rider_2 SK-002 Q1・Q2 だけ（PM・SM・ほかの SK の項はない）。atwiki に転載された公式 Q&A: atwiki/page-665 SK-002 Q1・Q2（＝rider_2）、
 *     atwiki/page-1411 SK-004 Q1〜Q3
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XX-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール・atwiki のカード評価（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XX-NNN …」）で残す。
 * レアリティは atwiki の「プロモーションレア」を PR、「シークレットレア」を SC として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - SK-004 Q2（RS-322 ベン・G【人身略取】で捨札にするときも【凄まじき戦士】で留まる）— cardSpec/RS5-306-326.c.test.ts RS-322
 *  - PM-001 を素材にする RM-039 の追加条件・※ — cardSpec/RM2-022-042.c.test.ts RM-039
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  act,
  attack,
  attackTargets,
  attackedInEnemyTurn,
  battleBoard,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  deckCards,
  enemyBattle,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectStats,
  faceUpPower,
  heldN,
  inst,
  pick,
  played,
  powerCards,
  releasedCat,
  resolveAll,
  rushBoardWith,
  rushVia,
  settle,
  shadowMoonTests,
  skip,
  sUnit,
  v3Tests,
  withStacked,
  zoneOf,
} from "./PROMO1-PK-SK.helpers";

const F2 = sUnit("SPEC-F2", { bp: 1000, features: ["獣", "人型"] });
const F3 = sUnit("SPEC-F3", { bp: 1000, features: ["獣", "人型", "メカ"] });
const F1 = sUnit("SPEC-F1", { bp: 1000, features: ["獣"] });
const BEAST = sUnit("SPEC-BEAST", { bp: 1000, features: ["獣"] });
const HUMAN = sUnit("SPEC-HUMAN", { bp: 1000, features: ["人型"] });
const BIG = sUnit("SPEC-BIG", { bp: 9000, sp: 1, features: ["獣", "人型"] });
const MALE = sUnit("SPEC-MALE", { bp: 1000, sp: 1, features: ["男"] });
const MALE_M = sUnit("SPEC-MALE-M", { bp: 1000, sp: 1, size: "M", features: ["男"] });
const FEMALE = sUnit("SPEC-FEMALE", { bp: 1000, sp: 1, features: ["女"] });
const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const COP = sUnit("SPEC-COP", { category: "OT", bp: 1000, features: ["宇宙刑事"] });
const OPDA = { id: "SPEC-OPDA", name: "SPEC-OPDA", type: "operation", category: "DA", rarity: "N", expansion: "card-spec", powerCost: 1 } as unknown as CardDefinition;
const OPMADA = { id: "SPEC-OPMADA", name: "SPEC-OPMADA", type: "operation", category: ["MA", "DA"], rarity: "N", expansion: "card-spec", powerCost: 1 } as unknown as CardDefinition;
const EXTRA: CardDefinition[] = [PLAIN_VEHICLE, F2, F3, F1, BEAST, HUMAN, BIG, MALE, MALE_M, FEMALE, C1, COP, OPDA, OPMADA];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => battleBoard(EXTRA, p1, p2);
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => enemyBattle(EXTRA, p1, p2);
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => rushBoardWith(EXTRA, p1, p2);

// ===========================================================================
describe("PM-001 ジライヤ", () => {
  const TEXT =
    "【真っ向両断】自軍ターン中、これがユニットを撃破したとき、そのユニットの持つ本来の特徴の数が2つなら、その2つの特徴を先頭から順に特徴1、特徴2として、次の効果を発動できる⇒敵軍パワーゾーンのオモテ向きのカードから、特徴1と同じ特徴を持つユニットカードを1枚選び、ウラ向きにしてダメージにする。そして、敵軍バトルエリアから、特徴2と同じ特徴を持つユニットを1体選び、持ち主の手札に戻す。";

  it("PM-001: カタログ本文・スペックが出典と一致（出典: atwiki/page-743）", () => {
    expectCatalogText("PM-001", TEXT);
    expectStats("PM-001", { name: "ジライヤ", category: "MA", size: "S", bp: 4000, sp: "1/3", powerCost: 5, features: ["戸隠流", "男", "忍者"] });
    expectRarityIn("PM-001", ["PR"]);
  });

  /** ジライヤがアタックして target（敵軍バトルエリア）を撃破する。敵軍パワーゾーンにオモテ向きの「獣」「人型」のユニットカード、敵軍バトルエリアに「人型」「獣」のユニット。 */
  const slash = (target: CardInstance, p2: Partial<GameState["players"]["player2"]> = {}) =>
    settle(
      attack(
        board(
          { battle: [inst("PM-001", "j")] },
          { battle: [target, inst("SPEC-HUMAN", "h"), inst("SPEC-BEAST", "b")], power: [faceUpPower("SPEC-BEAST", "pb"), faceUpPower("SPEC-HUMAN", "ph"), faceUpPower("TST-OP", "po")], ...p2 },
        ),
        "PM-001:j",
        target.instanceId,
      ),
    );

  it("PM-001: 【真っ向両断】自軍ターン中、本来の特徴が2つ（獣／人型）のユニットを撃破したとき、敵軍パワーゾーンのオモテ向きのカードから特徴1「獣」を持つユニットカードを1枚選べる（「人型」だけのカード・オペレーションは選べない）（出典: atwiki/page-743「特徴1と同じ特徴を持つユニットカードを1枚選び」）", () => {
    const s = slash(inst("SPEC-F2", "t"));
    expect(zoneOf(s, "player2", "SPEC-F2:t")).toBe("discard");
    expectChoiceFrom(s, "player1", "PM-001");
    expect(choiceIds(s)).toEqual(["SPEC-BEAST:pb"]);
  });

  it("PM-001: 【真っ向両断】選んだカードはウラ向きのダメージになり、続けて敵軍バトルエリアの特徴2「人型」を持つユニットを1体選び、持ち主の手札に戻す（出典: atwiki/page-743「ウラ向きにしてダメージにする。そして、敵軍バトルエリアから、特徴2と同じ特徴を持つユニットを1体選び、持ち主の手札に戻す」）", () => {
    let s = pick(slash(inst("SPEC-F2", "t")), "SPEC-BEAST:pb");
    expect(cardIn(s, "player2", "SPEC-BEAST:pb")?.faceDown).toBe(true);
    expectChoiceFrom(s, "player1", "PM-001");
    expect(choiceIds(s)).toEqual(["SPEC-HUMAN:h"]);
    s = resolveAll(pick(s, "SPEC-HUMAN:h"));
    expect(zoneOf(s, "player2", "SPEC-HUMAN:h")).toBe("hand");
    expect(zoneOf(s, "player2", "SPEC-BEAST:b")).toBe("battle");
  });

  it("PM-001: 【真っ向両断】は発動するかを選べる（「発動できる」）（出典: atwiki/page-743「次の効果を発動できる」）", () => {
    const s = slash(inst("SPEC-F2", "t"));
    expect(s.pendingEffectChoice?.sourceCardId).toBe("PM-001");
    expect(canSkip(s)).toBe(true);
  });

  it("PM-001: 撃破したユニットの本来の特徴が3つ・1つなら発動しない（出典: atwiki/page-743「本来の特徴の数が2つなら」・カード評価「持っている特徴が３つ以上だと効果が発動しない」）", () => {
    for (const t of [inst("SPEC-F3", "t"), inst("SPEC-F1", "t")]) {
      const s = slash(t);
      expect(zoneOf(s, "player2", t.instanceId)).toBe("discard");
      expect(s.pendingEffectChoice?.sourceCardId).not.toBe("PM-001");
      expect(cardIn(s, "player2", "SPEC-BEAST:pb")?.faceDown ?? false).toBe(false);
    }
  });

  it("PM-001: 敵軍ターン中にアタックされて撃破したときは発動しない（出典: atwiki/page-743「自軍ターン中、」）", () => {
    let s = enemyTurn({ battle: [inst("PM-001", "j")] }, { battle: [inst("SPEC-F2", "t"), inst("SPEC-HUMAN", "h")], power: [faceUpPower("SPEC-BEAST", "pb")] });
    s = settle(attack(s, "SPEC-F2:t", "PM-001:j", "player2"));
    expect(zoneOf(s, "player2", "SPEC-F2:t")).toBe("discard");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("PM-001");
  });
});

// ===========================================================================
describe("SM-001 3人の宇宙刑事", () => {
  const TEXT =
    "特徴「宇宙刑事」を持つ自軍ユニットが1体もなければ、自軍山札を見て、特徴「宇宙刑事」を持つユニットカードを3枚まで選び、選んだカードを自軍ラッシュエリアに出してもよい。ただし、この効果でカードを選ぶとき、同じカード名のユニットカードを2枚以上選ぶことはできない。その後、山札をシャッフルする。";

  it("SM-001: カタログ本文・スペックが出典と一致（出典: atwiki/page-898）", () => {
    expectCatalogText("SM-001", TEXT);
    expectOpStats("SM-001", { name: "3人の宇宙刑事", category: "OT", powerCost: 7 });
    expectRarityIn("SM-001", ["SC"]);
  });

  const DECK = () => [inst("RM-018", "g1"), inst("XG2-083", "g2"), inst("RM-025", "sh"), inst("XG1-083", "sd"), inst("XG7-068", "x"), inst("TST-UNIT-0", "u"), ...deckCards(3)];
  const used = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    played(rushPhase({ hand: [inst("SM-001", "op")], command: releasedCat("OT", 1), power: powerCards(7), deck: DECK(), ...p1 }), "SM-001:op");

  it("SM-001: 自軍に「宇宙刑事」のユニットがなければ、自軍山札の特徴「宇宙刑事」を持つユニットカードから選べる（任意。宇宙刑事でないカードは選べない）（出典: atwiki/page-898「自軍山札を見て、特徴「宇宙刑事」を持つユニットカードを3枚まで選び、…出してもよい」）", () => {
    const s = used();
    expectChoiceFrom(s, "player1", "SM-001");
    expect(choiceIds(s)).toEqual(["RM-018:g1", "RM-025:sh", "XG1-083:sd", "XG2-083:g2", "XG7-068:x"]);
    expect(canSkip(s)).toBe(true);
  });

  it("SM-001: 選んだカード（3枚まで）は自軍ラッシュエリアに出る（出典: atwiki/page-898「選んだカードを自軍ラッシュエリアに出してもよい」・カード評価「追加条件を無視して宇宙刑事シャリバン×ギャバン×シャイダーをラッシュできる」）", () => {
    let s = used();
    for (const id of ["RM-018:g1", "RM-025:sh", "XG7-068:x"]) if (s.pendingEffectChoice?.validInstanceIds.includes(id)) s = pick(s, id);
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "RM-018:g1")).toBe("rush");
    expect(zoneOf(s, "player1", "RM-025:sh")).toBe("rush");
    expect(zoneOf(s, "player1", "XG7-068:x")).toBe("rush");
    expect(s.players.player1.deck).toHaveLength(DECK().length - 3);
  });

  it("SM-001: 同じカード名のユニットカードを2枚以上選べない（「宇宙刑事ギャバン」RM-018 を選んだら XG2-083 は選べない）（出典: atwiki/page-898「同じカード名のユニットカードを2枚以上選ぶことはできない」）", () => {
    const s = pick(used(), "RM-018:g1");
    expect(choiceIds(s)).not.toContain("XG2-083:g2");
    expect(choiceIds(s)).toContain("RM-025:sh");
  });

  it("SM-001: 特徴「宇宙刑事」を持つ自軍ユニットがあれば、何も出さない（出典: atwiki/page-898「特徴「宇宙刑事」を持つ自軍ユニットが1体もなければ」）", () => {
    const s = resolveAll(used({ rush: [inst("SPEC-COP", "cop")] }));
    expect(s.players.player1.rush.map((c) => c.instanceId)).toEqual(["SPEC-COP:cop"]);
    expect(zoneOf(s, "player1", "RM-018:g1")).toBe("deck");
  });
});

// ===========================================================================
describe("SK-000 仮面ライダー龍騎ブランク体", () => {
  it("SK-000: カタログ本文・スペックが出典と一致（テキストなし・SP なし）（出典: atwiki/page-20「テキスト：なし」「SP:なし」）", () => {
    expectCatalogText("SK-000", "なし");
    expectStats("SK-000", { name: "仮面ライダー龍騎ブランク体", category: "WB", size: "S", bp: 500, sp: undefined, powerCost: 4, features: ["仮面ライダー", "男", "ミラーライダー"] });
    expectRarityIn("SK-000", ["SC"]);
  });

  it("SK-000: SP を持たないので、バトルエリアに出てもストライクできない（出典: atwiki/page-20「SP:なし」・カード評価「BP500のSP・能力なし」）", () => {
    const s = enter(board({ rush: [inst("SK-000", "b")] }), "SK-000:b");
    expect(zoneOf(s, "player1", "SK-000:b")).toBe("battle");
    expect(canStrike(s, "SK-000:b")).toBe(false);
  });
});

// ===========================================================================
describe("SK-001 シャドームーン", () => {
  shadowMoonTests(
    "SK-001",
    "atwiki/page-43",
    "SC",
    "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。 【サタンサーベル】敵軍バトルエリアからSビークルを1体選ぶ。選んだビークルにライドしているユニットがあれば、それを撃破する。その後、選んだビークルを捨札にする。",  );
});

// ===========================================================================
describe("SK-002 仮面ライダーV3", () => {
  v3Tests(
    "SK-002",
    "atwiki/page-665",
    "SC",
    "※レジスト(これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい) 【ダブルタイフーン】自軍コマンドゾーンから「仮面ライダー1号」か「仮面ライダー2号」のカードを1枚選びホールドしてもよい。そうしたとき、ホールドしたユニットカードのＲＣの効果を、このユニットの効果として発動する。",
  );
});

// ===========================================================================
describe("SK-003 仮面ライダーファム", () => {
  const TEXT =
    "【復讐の女詐欺師】これが自軍バトルエリアにある間、敵軍バトルフェイズ中、ホールド状態の敵軍コマンドが1つ以上あれば、特徴「男」を持つ敵軍Sユニットは、次の制限を受ける⇒アタックもストライクもすることができない。";

  it("SK-003: カタログ本文・スペックが出典と一致（出典: atwiki/page-1083。カード名の「（2nd）」は区別の表記）", () => {
    expectCatalogText("SK-003", TEXT);
    expectStats("SK-003", { name: "仮面ライダーファム", category: "WB", size: "S", bp: 2000, sp: "1/2", powerCost: 4, features: ["仮面ライダー", "女", "ミラーライダー", "2nd"] });
    expectRarityIn("SK-003", ["SC"]);
  });

  /** 敵軍（player2）バトルフェイズ。自軍バトルエリアにファム。敵軍バトルエリアに男の S（m）・男の M（mm）・女の S（f）。 */
  const locked = (p1: Partial<GameState["players"]["player1"]> = { battle: [inst("SK-003", "fm")] }, enemyCommand: CardInstance[] = heldN(1, "TST-OP", "eh")) =>
    enemyTurn(p1, { battle: [inst("SPEC-MALE", "m"), inst("SPEC-MALE-M", "mm"), inst("SPEC-FEMALE", "f")], command: enemyCommand });

  it("SK-003: 【復讐の女詐欺師】ホールド状態の敵軍コマンドがあれば、特徴「男」を持つ敵軍 S ユニットはアタックもストライクもできない（出典: atwiki/page-1083「特徴「男」を持つ敵軍Sユニットは、…アタックもストライクもすることができない」）", () => {
    const s = locked();
    expect(attackTargets(s, "SPEC-MALE:m", "player2")).toEqual([]);
    expect(canStrike(s, "SPEC-MALE:m", "player2")).toBe(false);
  });

  it("SK-003: 【復讐の女詐欺師】特徴「男」を持たない S ユニット・M ユニットは制限されない（出典: atwiki/page-1083「特徴「男」を持つ敵軍Sユニットは」・カード評価「ミラーモンスターやイマジンは男を持たないので普通にアタックできる」）", () => {
    const s = locked();
    expect(attackTargets(s, "SPEC-FEMALE:f", "player2")).toContain("SK-003:fm");
    expect(attackTargets(s, "SPEC-MALE-M:mm", "player2")).toContain("SK-003:fm");
  });

  it("SK-003: 【復讐の女詐欺師】ホールド状態の敵軍コマンドがなければ制限しない（出典: atwiki/page-1083「ホールド状態の敵軍コマンドが1つ以上あれば」・カード評価「男でもコマンドをホールドしなければアタックが可能」）", () => {
    const s = locked(undefined, releasedCat("WB", 1, "er"));
    expect(attackTargets(s, "SPEC-MALE:m", "player2")).toContain("SK-003:fm");
  });

  it("SK-003: 【復讐の女詐欺師】ファムが自軍ラッシュエリアにあるときは制限しない（出典: atwiki/page-1083「これが自軍バトルエリアにある間」）", () => {
    const s = locked({ rush: [inst("SK-003", "fm")], battle: [inst("SPEC-C1", "c")] });
    expect(attackTargets(s, "SPEC-MALE:m", "player2")).toContain("SPEC-C1:c");
  });
});

// ===========================================================================
describe("SK-004 仮面ライダークウガUF", () => {
  const TEXT =
    "【凄まじき戦士】これをラッシュしたとき、この追加条件で捨札にしたカードを見て、DAを持たないカードをすべてこれの下に好きな順でウラ向きに重ねる。このとき、ウラ向きに4枚重ねなかったなら、「仮面ライダークウガUF」以外の自軍ユニットをすべて捨札にする。また、これがユニットでなくなるとき、これにウラ向きで重ねたカードをウラ向きのまま1枚選び捨札にして、これをその場に留める。";

  it("SK-004: カタログ本文・スペックが出典と一致（出典: atwiki/page-1411）", () => {
    expectCatalogText("SK-004", TEXT);
    expectStats("SK-004", { name: "仮面ライダークウガUF", category: "MA", size: "S", bp: 5000, sp: 1, powerCost: "7+", features: ["仮面ライダー", "男", "アマダム"], rushCondition: "discard_operation_cards" });
    expectRarityIn("SK-004", ["SC"]);
  });

  const ops = (n: number, cardId = "TST-OP") => Array.from({ length: n }, (_, i) => inst(cardId, `o${i}`));
  /** 常駐置き場の ops（4枚）を追加条件で捨札にして、クウガUF をラッシュする。 */
  const ultimate = (operation: CardInstance[], others: Partial<GameState["players"]["player1"]> = {}) => {
    const s = rushPhase({ operation, hand: [inst("SK-004", "uf")], command: releasedCat("MA", 1), power: powerCards(7), ...others });
    const r = rushVia(s, "player1", "SK-004:uf");
    expect(r.ok, r.error).toBe(true);
    return resolveAll(r.state);
  };
  const stacked = (s: GameState) => (cardIn(s, "player1", "SK-004:uf")?.stackedCards ?? []).map((c) => c.instanceId).sort();

  it("SK-004: 追加条件・【凄まじき戦士】— 常駐置き場のカード4枚を捨札にしてラッシュし、DA を持たないカード4枚をすべてこれの下にウラ向きで重ねる（4枚なら他の自軍ユニットは残る）（出典: atwiki/page-1411）", () => {
    const s = ultimate(ops(4), { battle: [inst("SPEC-C1", "b")] });
    expect(zoneOf(s, "player1", "SK-004:uf")).toBe("rush");
    expect(stacked(s)).toEqual(ops(4).map((c) => c.instanceId).sort());
    expect((cardIn(s, "player1", "SK-004:uf")?.stackedCards ?? []).every((c) => c.faceDown)).toBe(true);
    expect(zoneOf(s, "player1", "SPEC-C1:b")).toBe("battle");
  });

  it("SK-004: DA を持つカード（MA と DA のマルチカテゴリも）は重ねず捨札に残り、ウラ向きに4枚重ねなかったなら「仮面ライダークウガUF」以外の自軍ユニットをすべて捨札にする（出典: atwiki/page-1411「DAを持たないカードをすべて…ウラ向きに4枚重ねなかったなら、「仮面ライダークウガUF」以外の自軍ユニットをすべて捨札にする」）", () => {
    const s = ultimate([...ops(2), inst("SPEC-OPDA", "da"), inst("SPEC-OPMADA", "mada")], { battle: [inst("SPEC-C1", "b")], rush: [inst("SPEC-MALE", "r")] });
    expect(stacked(s)).toEqual(["TST-OP:o0", "TST-OP:o1"]);
    expect(zoneOf(s, "player1", "SPEC-OPDA:da")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-OPMADA:mada")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-C1:b")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-MALE:r")).toBe("discard");
    expect(zoneOf(s, "player1", "SK-004:uf")).toBe("rush");
  });

  const stackedUF = () => withStacked(inst("SK-004", "uf"), ops(3).map((c) => ({ ...c, faceDown: true })));

  it("SK-004: これがユニットでなくなるとき（バトルで撃破される）、ウラ向きで重ねたカードを1枚選んで捨札にし、これはその場に留まる（見送れない）（出典: atwiki/page-1411「これにウラ向きで重ねたカードをウラ向きのまま1枚選び捨札にして、これをその場に留める」・Q2「【凄まじき戦士】の効果は強制」）", () => {
    let s = attackedInEnemyTurn({ battle: [stackedUF()] }, "SK-004:uf");
    expectChoiceFrom(s, "player1", "SK-004");
    expect(choiceIds(s)).toEqual(["TST-OP:o0", "TST-OP:o1", "TST-OP:o2"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "TST-OP:o1"));
    expect(zoneOf(s, "player1", "SK-004:uf")).toBe("battle");
    expect(zoneOf(s, "player1", "TST-OP:o1")).toBe("discard");
    expect(stacked(s)).toEqual(["TST-OP:o0", "TST-OP:o2"]);
  });

  it("SK-004: ウラ向きで重ねたカードがなければ、撃破されて捨札になる（出典: atwiki/page-1411「これにウラ向きで重ねたカードを…1枚選び」）", () => {
    const s = resolveAll(attackedInEnemyTurn({ battle: [inst("SK-004", "uf")] }, "SK-004:uf"));
    expect(zoneOf(s, "player1", "SK-004:uf")).toBe("discard");
  });

  // atwiki/page-1411 Q1「「追加条件で捨札にしたカード」を0枚として参照し、処理を続行してください。」
  it("SK-004: 公式Q&A — 敵軍ターン中、敵軍ユニット（RK-275 ゴ・ガドル・バ【ザバギンバシグラ】）の効果で自軍パワーゾーンから自軍ラッシュエリアに出たときは、追加条件で捨札にしたカードを0枚として処理を続ける（4枚重ねなかったので、ほかの自軍ユニットはすべて捨札）（出典: atwiki/page-1411 Q1）", () => {
    let s = enemyTurn({ power: [faceUpPower("SK-004", "uf")], battle: [inst("SPEC-C1", "b")] }, { rush: [inst("RK-275", "gd")] });
    s = act(s, { type: "move_to_battle", playerId: "player2", instanceId: "RK-275:gd" });
    expectChoiceFrom(s, "player2", "RK-275");
    s = pick(s, "SK-004:uf");
    // RK-275 の後半「相手は…パワーゾーンに置いてもよい」は自分（player1）の確認。置かない（PROMO-judgments.md「実装」）。
    expectChoiceFrom(s, "player1", "RK-275");
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player1", "SK-004:uf")).toBe("rush");
    expect(stacked(s)).toEqual([]);
    expect(zoneOf(s, "player1", "SPEC-C1:b")).toBe("discard");
  });

  it.todo(
    "SK-004: 公式Q&A — 敵軍の XG7-059 トリガードーパント【ゲームスタート……】で【凄まじき戦士】の前半を無効にしても、「また」以降（ユニットでなくなるときに留まる）は無効にならない（出典: atwiki/page-1411 Q3「「また」で続く効果は、それ以前の効果とは独立した効果」）— XG7-059 は本範囲外のカードで、ラッシュしたときの効果に割り込んで無効にする盤面を本範囲のテストで作っていない",
  );
});
