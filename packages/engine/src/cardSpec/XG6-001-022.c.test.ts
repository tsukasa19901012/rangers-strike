/**
 * カード別スペック: XG6-016〜XG6-022（クロスギャザー ザ・ギガンティックタイタン 爆竜アンキロベイルス〜リンカメレオン）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ（card_1〜9・card_plomo・rider_1〜4・rider.html）を「XG6-」とカード名で検索:
 *     本範囲のカードの項はない（同名の RS-234 アバレキラー・RS-117 ダイボウケンの項だけ）。atwiki に転載された公式 Q&A: XG6-018 Q1〜Q4
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XG6-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-ADD-06・R-ADD-07・R-STK-03・R-KW-WING・R-CAT-02）・atwiki のカード評価・コメント欄（コミュニティの記述）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XG6-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／レア／スーパーレア」を N／R／SR として照合する。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  accept,
  act,
  attackTargets,
  bpOf,
  canEnter,
  canSkip,
  cardIn,
  categoriesOf,
  choiceIds,
  deckCards,
  enemyAttacks,
  enemyTurn,
  enter,
  enterHold,
  expectCatalogText,
  expectChoiceFrom,
  expectRarityIn,
  expectRushCondition,
  expectUnit,
  faceDown,
  faceUp,
  fill,
  heldN,
  inst,
  legal,
  ncEnter,
  p1Battle,
  passEntry,
  pick,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  rushBoard,
  rushHand,
  settle,
  spOf,
  strike,
  sUnit,
  wingTests,
  withDamage,
  zoneOf,
} from "./XG6-001-022.helpers";

const E4K = sUnit("SPEC-E4K", { bp: 4000 });
const YEL = sUnit("SPEC-YEL", { category: "WB", bp: 1000, features: ["イエロー"] });
const WHITE = sUnit("SPEC-WHITE", { category: "WB", bp: 1000, features: ["ホワイト"] });
const RED = sUnit("SPEC-RED", { category: "WB", bp: 1000, features: ["レッド"] });
const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const EXTRA = [E4K, YEL, WHITE, RED, C1, C3];
const U28 = "（出典: 利用者の決定 2026-10-20・questions-all.md U-28）";

// ===========================================================================
describe("XG6-016 爆竜アンキロベイルス", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【爆竜必殺ダブルトルネード】これと同カテゴリのLユニットがこのユニットからコンビネーションするとき、次の効果を発動できる→コンビネーションしたユニットが持つ、効果名を持つテキスト中の「これがバトルエリアに出たとき」以降の効果を発動する。（この効果は1ターンにつき1回しか発動できない）";
  const PAGE = "atwiki/page-2303";

  it(`XG6-016: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-016", TEXT);
    expectUnit("XG6-016", { name: "爆竜アンキロベイルス", category: "WB", size: "M", bp: 5000, sp: "1/2", powerCost: 6, comboNumber: "L", features: ["恐竜"] });
    expectRarityIn("XG6-016", ["N"]);
  });

  it(`XG6-016: ※ リリース状態の自軍コマンドがなければバトルエリアに出られない（出典: ${PAGE}「※これは自軍コマンドを1つホールドしなければバトルエリアに出られない」・R-ADD-07）`, () => {
    expect(canEnter(p1Battle({ rush: [inst("XG6-016", "an")], command: heldN(1) }), "XG6-016:an")).toBe(false);
  });

  it(`XG6-016: SP1/2 — バトルエリアの2番目に並べば SP1、3番目なら SP を持たない（出典: ${PAGE}「SP：1/2」・R-STK-03）`, () => {
    const at = (n: number) => enterHold(p1Battle({ battle: fill(n - 1), rush: [inst("XG6-016", "an")], command: [released("TST-OP", "c")] }), "XG6-016:an");
    expect(spOf(at(2), "player1", "XG6-016:an")).toBe(1);
    expect(spOf(at(3), "player1", "XG6-016:an")).toBe(0);
  });

  /** アンキロベイルス（ホールドして出る）→ RS-050 アバレンオー（WB の L。バトルエリアに出たとき BP4000 以下の敵軍バトルエリアのユニットを1体撃破）。 */
  const doubleTornado = () => {
    let s = p1Battle({ rush: [inst("XG6-016", "an"), inst("RS-050", "ab")], command: [released("TST-OP", "c")] }, { battle: [inst("SPEC-E4K", "a"), inst("SPEC-E4K", "b"), inst("SPEC-E4K", "c")] }, EXTRA);
    s = passEntry(enterHold(s, "XG6-016:an"));
    return enter(s, "RS-050:ab");
  };

  it(
    `XG6-016: 【爆竜必殺ダブルトルネード】同カテゴリの L ユニット（アバレンオー）がこれからコンビネーションするとき、その L ユニットの「これがバトルエリアに出たとき」以降の効果をもう1度発動できる（BP4000 以下の敵軍ユニットを2体撃破できる）（出典: ${PAGE}「コンビネーションしたユニットが持つ、効果名を持つテキスト中の「これがバトルエリアに出たとき」以降の効果を発動する」・atwiki/page-2335 コメント「アンキロベイルスのJCで再度効果発動」）`,
    () => {
      let s = doubleTornado();
      const picked: string[] = [];
      for (let i = 0; i < 4 && s.pendingEffectChoice; i++) {
        const p = s.pendingEffectChoice;
        const id = p.validInstanceIds.find((x) => x.startsWith("SPEC-E4K") && !picked.includes(x));
        if (id) picked.push(id);
        s = settle(id ? pick(s, id) : accept(s));
      }
      expect(s.players.player2.discard).toHaveLength(2);
    },
  );

  it.todo(
    "XG6-016: （）内 — 【爆竜必殺ダブルトルネード】は1ターンに1回だけ — 同じターンに同じアンキロベイルスから2度目のコンビネーションを作る公開の手順がない（バトルエリアの並びを作り直す手段がない）",
  );
});

// ===========================================================================
describe("XG6-017 ヤツデンワニ", () => {
  const TEXT =
    "※これが自分の手札にある間、自軍ラッシュフェイズ中、特徴「イエロー」または「ホワイト」を持つ自軍ユニットがあれば、これを自軍ラッシュエリアに出してもよい。 【どこにでも繋がる電話】自軍ゾーンのオモテ向きのカードから1枚選び、手札に加えてもよい。そうしたとき、このユニットをそのカードがあった場所に置く。";
  const PAGE = "atwiki/page-2290";

  it(`XG6-017: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-017", TEXT);
    expectUnit("XG6-017", { name: "ヤツデンワニ", category: "DA", size: "S", bp: 1000, sp: undefined, powerCost: 8, comboNumber: 2, features: ["獣", "植物", "怪人"] });
    expectRarityIn("XG6-017", ["N"]);
  });

  const rushPhase = (rush: CardInstance[]) => rushBoard({ hand: [inst("XG6-017", "w")], rush }, {}, EXTRA);

  it(
    `XG6-017: ※ 手札にある間、自軍ラッシュフェイズ中に特徴「イエロー」か「ホワイト」を持つ自軍ユニットがあれば、必要パワー・コマンドなしで自軍ラッシュエリアに出せる（出典: ${PAGE}「これを自軍ラッシュエリアに出してもよい」・カード評価「パワーを無視してラッシュ出来る。コマンドのホールドも必要ない」）`,
    () => {
      for (const u of [inst("SPEC-YEL", "y"), inst("SPEC-WHITE", "wh")]) {
        const s = rushPhase([u]);
        const a = legal(s).find((x) => x.playerId === "player1" && x.type !== "end_phase");
        expect(a).toBeDefined();
        const t = resolveAll(act(s, a!));
        expect(zoneOf(t, "player1", "XG6-017:w")).toBe("rush");
      }
    },
  );

  it(`XG6-017: ※ 「イエロー」「ホワイト」の自軍ユニットがなければ出せない（ラッシュフェイズの行動はフェイズ終了だけ）（出典: ${PAGE}「特徴「イエロー」または「ホワイト」を持つ自軍ユニットがあれば」）`, () => {
    const s = rushPhase([inst("SPEC-RED", "r")]);
    expect(legal(s).filter((a) => a.playerId === "player1").map((a) => a.type)).toEqual(["end_phase"]);
  });

  /** 2番目に出て NC が成立する。自軍コマンドに TST-OP、オモテ向きのパワーに TST-P、ダメージ1点。 */
  const phone = () => ncEnter("XG6-017:w", 1, { command: [released("TST-OP", "c")], power: [faceUp("TST-P", "p"), faceDown("TST-P", "d")], damage: 1 });

  it(
    `XG6-017: 【どこにでも繋がる電話】（NC）自軍ゾーンのオモテ向きのカード（コマンド・オモテ向きのパワー）から1枚選んで手札に加えるかを選べる（任意。ダメージは選べない）（出典: ${PAGE}「自軍ゾーンのオモテ向きのカードから1枚選び、手札に加えてもよい」）`,
    () => {
      const s = phone();
      expectChoiceFrom(s, "player1", "XG6-017");
      expect(choiceIds(s)).toEqual(["TST-OP:c", "TST-P:p"]);
      expect(canSkip(s)).toBe(true);
    },
  );

  it(
    `XG6-017: 【どこにでも繋がる電話】手札に加えたら、このユニットをそのカードがあった場所（コマンドゾーン）に置く（出典: ${PAGE}「そうしたとき、このユニットをそのカードがあった場所に置く」）`,
    () => {
      const s = resolveAll(pick(phone(), "TST-OP:c"));
      expect(zoneOf(s, "player1", "TST-OP:c")).toBe("hand");
      expect(zoneOf(s, "player1", "XG6-017:w")).toBe("command");
    },
  );
});

// ===========================================================================
describe("XG6-018 アバレキラー", () => {
  const TEXT =
    "※自軍Lユニットがなければ、これは「爆竜トップゲイラー＋爆竜ステゴスライドン」としてつかえる。 【ゲームはここまでだ】「SP1」自分の手札から特徴「恐竜」を持つユニットカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、追加条件は満たすこと。そうしたとき、これを捨札にする。";
  const PAGE = "atwiki/page-2334";

  it(`XG6-018: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-018", TEXT);
    expectUnit("XG6-018", { name: "アバレキラー", category: "WB", size: "S", bp: 4000, sp: "special", powerCost: 5, comboNumber: 2, features: ["ホワイト", "男"] });
    expectRarityIn("XG6-018", ["SR"]);
  });

  it(`XG6-018: ※ 自軍 L ユニットがなければ「爆竜トップゲイラー＋爆竜ステゴスライドン」として使える（RS-226 キラーオーの合体ユニットとして、これ1体を捨札にしてラッシュできる）（出典: ${PAGE}「※自軍Lユニットがなければ、これは「爆竜トップゲイラー＋爆竜ステゴスライドン」としてつかえる」・Q1「Ａ＋Ｂであり、Ａでもあり、Ｂでもある」）`, () => {
    const r = rushHand("RS-226:ko", { rush: [inst("XG6-018", "ak")], command: releasedCat("WB", 1), power: powerCards(6) });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG6-018:ak")).toBe("discard");
    expect(zoneOf(r.state, "player1", "RS-226:ko")).toBe("rush");
  });

  it(`XG6-018: ※ 自軍 L ユニットがあれば合体ユニットとして使えない（キラーオーをラッシュできない）（出典: ${PAGE}「自軍Lユニットがなければ」・Q3）`, () => {
    expect(rushHand("RS-226:ko", { rush: [inst("XG6-018", "ak"), inst("TST-UNIT-7", "L")], command: releasedCat("WB", 1), power: powerCards(6) }).ok).toBe(false);
  });

  /** 2番目に出て NC が成立する。手札に RS-227 爆竜トップゲイラー（恐竜・追加条件なし）・RS-050 アバレンオー（恐竜・合体）・SPEC-RED（恐竜でない）。 */
  const gameOver = () => ncEnter("XG6-018:k", 1, { hand: [inst("RS-227", "tg"), inst("RS-050", "ab"), inst("SPEC-RED", "r")] }, {}, EXTRA);

  it(`XG6-018: 【ゲームはここまでだ】（NC）「SP1」— NC が成立すれば SP1 になる（出典: ${PAGE}「「SP1」」）`, () => {
    expect(spOf(gameOver(), "player1", "XG6-018:k")).toBe(1);
  });

  it(
    `XG6-018: 【ゲームはここまでだ】（NC）手札の特徴「恐竜」を持つユニットカードのうち、追加条件を満たせるものから1枚選んで自軍ラッシュエリアに出せる（任意。合体ユニットのないアバレンオー・恐竜でないカードは選べない）（出典: ${PAGE}「自分の手札から特徴「恐竜」を持つユニットカードを1枚選び、自軍ラッシュエリアに出してもよい。ただし、追加条件は満たすこと」）`,
    () => {
      const s = gameOver();
      expectChoiceFrom(s, "player1", "XG6-018");
      expect(choiceIds(s)).toEqual(["RS-227:tg"]);
      expect(canSkip(s)).toBe(true);
    },
  );

  it(
    `XG6-018: 【ゲームはここまでだ】出したら、これを捨札にする（出典: ${PAGE}「そうしたとき、これを捨札にする」）`,
    () => {
      const s = resolveAll(pick(gameOver(), "RS-227:tg"));
      expect(zoneOf(s, "player1", "RS-227:tg")).toBe("rush");
      expect(zoneOf(s, "player1", "XG6-018:k")).toBe("discard");
    },
  );
});

// ===========================================================================
describe("XG6-019 ダイボウケン", () => {
  const TEXT =
    "合体―ゴーゴーダンプ＋ゴーゴーフォーミュラ＋ゴーゴージャイロ＋ゴーゴードーザー＋ゴーゴーマリン ※このカードの追加条件は、自軍捨札が7枚以上あるとき、次のように変更される→ 特徴「イエロー」を持つ自軍Sユニット1体を捨札にする 【奥の手】これが自軍バトルエリアにある間、敵軍ユニットがアタックまたはストライクをするとき、 これをホールドしてもよい。そうしたとき、そのアタックまたはストライクは無効になる。";
  const PAGE = "atwiki/page-2328";

  it(`XG6-019: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-019", TEXT);
    expectUnit("XG6-019", { name: "ダイボウケン", category: "ET", size: "L", bp: 9000, sp: 1, powerCost: "5+", features: ["メカ", "人型"] });
    expectRushCondition("XG6-019", "discard_fusion_unit", "自軍合体ユニットを捨札にする");
    expectRarityIn("XG6-019", ["R"]);
  });

  const rushWith = (rush: CardInstance[], discard: CardInstance[] = []) => rushHand("XG6-019:db", { rush, discard, command: releasedCat("ET", 1), power: powerCards(5) }, {}, EXTRA);

  it(`XG6-019: 追加条件 — ゴーゴーダンプ・フォーミュラ・ジャイロ・ドーザー・マリンを捨札にしてラッシュできる（出典: ${PAGE}「合体―ゴーゴーダンプ＋…＋ゴーゴーマリン」・R-ADD-06）`, () => {
    const parts = [inst("RS-118", "a"), inst("RS-119", "b"), inst("RS-120", "c"), inst("RS-121", "d"), inst("RS-122", "e")];
    const r = rushWith(parts);
    expect(r.ok).toBe(true);
    for (const p of parts) expect(zoneOf(r.state, "player1", p.instanceId)).toBe("discard");
  });

  it(
    `XG6-019: ※ 自軍捨札が7枚以上なら、追加条件は「特徴「イエロー」を持つ自軍 S ユニット1体を捨札にする」になる（出典: ${PAGE}「自軍捨札が7枚以上あるとき、次のように変更される→ 特徴「イエロー」を持つ自軍Sユニット1体を捨札にする」）`,
    () => {
      const r = rushWith([inst("SPEC-YEL", "y")], deckCards(7, "dd"));
      expect(r.ok).toBe(true);
      expect(zoneOf(r.state, "player1", "SPEC-YEL:y")).toBe("discard");
    },
  );

  it(`XG6-019: ※ 自軍捨札が6枚なら、イエローの S ユニットだけではラッシュできない（出典: ${PAGE}「自軍捨札が7枚以上あるとき」）`, () => {
    expect(rushWith([inst("SPEC-YEL", "y")], deckCards(6, "dd")).ok).toBe(false);
  });

  const enemyBoard = () => enemyTurn({ battle: [inst("XG6-019", "db"), inst("SPEC-RED", "r")] }, { battle: [inst("TST-UNIT-7", "atk")] }, EXTRA);

  it(
    `XG6-019: 【奥の手】自軍バトルエリアにある間、敵軍ユニットがアタックするとき、これをホールドしてアタックを無効にできる（アタックされたユニットは撃破されない）（出典: ${PAGE}「敵軍ユニットがアタックまたはストライクをするとき、 これをホールドしてもよい。そうしたとき、そのアタックまたはストライクは無効になる」）`,
    () => {
      let s = enemyAttacks(enemyBoard(), "TST-UNIT-7:atk", "SPEC-RED:r");
      expectChoiceFrom(s, "player1", "XG6-019");
      expect(canSkip(s)).toBe(true);
      s = resolveAll(accept(s));
      expect(cardIn(s, "player1", "XG6-019:db")?.commandHeld).toBe(true);
      expect(zoneOf(s, "player1", "SPEC-RED:r")).toBe("battle");
    },
  );

  it(
    `XG6-019: 【奥の手】敵軍ユニットがストライクするときも、これをホールドしてストライクを無効にできる（ダメージを受けない）（出典: ${PAGE}「アタックまたはストライク」・カード評価「ユニットサイズを問わずストライクまたはアタックを無効にできる」）`,
    () => {
      let s = strike(enemyBoard(), "TST-UNIT-7:atk", "player2");
      expectChoiceFrom(s, "player1", "XG6-019");
      s = resolveAll(accept(s));
      expect(s.players.player1.damage).toBe(0);
    },
  );
});

// ===========================================================================
describe("XG6-020 アルティメットダイボウケン", () => {
  const TEXT =
    "合体―ダイボウケン（または、ゴーゴーダンプ＋ゴーゴーフォーミュラ＋ゴーゴージャイロ＋ゴーゴードーザー＋ゴーゴーマリン）＋ダイタンケン（または、ゴーゴードリル＋ゴーゴーショベル＋ゴーゴーミキサー＋ゴーゴークレーン＋ゴーゴージェット） ※ウイング 【究極の大冒険】これが自軍エリアにある間、自分はダメージが10点になるまでゲームに負けない。";
  const PAGE = "atwiki/page-2325";

  it(`XG6-020: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-020", TEXT);
    expectUnit("XG6-020", { name: "アルティメットダイボウケン", category: "ET", size: "L", bp: 24000, sp: 3, powerCost: "10+", features: ["メカ", "人型"] });
    expectRushCondition("XG6-020", "discard_fusion_unit", "自軍合体ユニットを捨札にする");
    expectRarityIn("XG6-020", ["SR"]);
  });

  const rushWith = (rush: CardInstance[]) => rushHand("XG6-020:u", { rush, command: releasedCat("ET", 1), power: powerCards(10) });

  it(`XG6-020: 追加条件 — 自軍のダイボウケンとダイタンケンを捨札にしてラッシュできる（出典: ${PAGE}「合体―ダイボウケン（または…）＋ダイタンケン（または…）」・R-ADD-06）`, () => {
    const r = rushWith([inst("XG6-019", "db"), inst("XG6-006", "dt")]);
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XG6-019:db")).toBe("discard");
    expect(zoneOf(r.state, "player1", "XG6-006:dt")).toBe("discard");
  });

  it(
    `XG6-020: 追加条件 — ダイボウケンのかわりにゴーゴーダンプ〜ゴーゴーマリンの5体を捨札にしてもよい（出典: ${PAGE}「ダイボウケン（または、ゴーゴーダンプ＋ゴーゴーフォーミュラ＋ゴーゴージャイロ＋ゴーゴードーザー＋ゴーゴーマリン）」）`,
    () => {
      expect(rushWith([inst("RS-118", "a"), inst("RS-119", "b"), inst("RS-120", "c"), inst("RS-121", "d"), inst("RS-122", "e"), inst("XG6-006", "dt")]).ok).toBe(true);
    },
  );

  wingTests("XG6-020", PAGE);

  /** 敵軍ターン、自軍ダメージ dmg 点（オモテ向きのパワー1枚）。自軍エリアに units。敵軍の TST-UNIT-0（SP1）がストライクする。 */
  const struck = (dmg: number, units: CardInstance[]) =>
    settle(strike(enemyTurn({ rush: units, ...withDamage(dmg, powerCards(1)) }, { battle: [inst("TST-UNIT-0", "atk")] }), "TST-UNIT-0:atk", "player2"));

  it(
    `XG6-020: 【究極の大冒険】これが自軍エリア（ラッシュエリア）にある間、ダメージ7点になってもゲームに負けない（出典: ${PAGE}「自分はダメージが10点になるまでゲームに負けない」）`,
    () => {
      const s = struck(6, [inst("XG6-020", "u")]);
      expect(s.players.player1.damage).toBe(7);
      expect(s.winner ?? null).toBeNull();
    },
  );

  it(`XG6-020: 【究極の大冒険】これが自軍エリアにあっても、ダメージ10点になれば負ける（出典: ${PAGE}「ダメージが10点になるまで」）`, () => {
    const s = struck(9, [inst("XG6-020", "u")]);
    expect(s.winner).toBe("player2");
  });

  it(`XG6-020: 【究極の大冒険】これが自軍エリアになければ、ダメージ7点で負ける（出典: ${PAGE}「これが自軍エリアにある間」）`, () => {
    const s = struck(6, [inst("TST-UNIT-0", "x")]);
    expect(s.winner).toBe("player2");
  });
});

// ===========================================================================
describe("XG6-021 リンライオン", () => {
  const TEXT =
    "※これは自軍バトルフェイズ中、カテゴリにWBが追加される。 【激臨剣】このユニットからコンビネーションする同カテゴリのLユニットは、このターン、次の能力を得る⇒これは、自軍捨札にあるカテゴリを2つ以上持つカード1枚につきBP+2000され、BP20000以上のとき「SP2」になる。";
  const PAGE = "atwiki/page-2351";

  it(`XG6-021: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-021", TEXT);
    expectUnit("XG6-021", { name: "リンライオン", category: "DA", size: "M", bp: 6500, sp: "1/2", powerCost: "3+", comboNumber: "L", features: ["臨気"] });
    expectRushCondition("XG6-021", "state_gate", "特徴「臨気」と「男」を持つ自軍ユニットがある");
    expectRarityIn("XG6-021", ["R"]);
  });

  it(
    `XG6-021: 追加条件 — 特徴「臨気」と「男」を持つ自軍ユニット（RS-431 黒獅子リオ）があればラッシュできる（出典: ${PAGE}「追加条件：特徴「臨気」と「男」を持つ自軍ユニットがある」）`,
    () => {
      const r = rushHand("XG6-021:r", { rush: [inst("RS-431", "rio")], command: releasedCat("DA", 1), power: powerCards(3) });
      expect(r.ok).toBe(true);
      expect(zoneOf(r.state, "player1", "RS-431:rio")).toBe("rush");
    },
  );

  it(`XG6-021: 追加条件 — 「臨気」と「女」のユニット（RS-504 獣人メレ）だけではラッシュできない（出典: ${PAGE}「「臨気」と「男」を持つ」）`, () => {
    expect(rushHand("XG6-021:r", { rush: [inst("RS-504", "mele")], command: releasedCat("DA", 1), power: powerCards(3) }).ok).toBe(false);
  });

  it(`XG6-021: ※ 自軍バトルフェイズ中はカテゴリに WB が追加される（ラッシュフェイズは DA だけ）（出典: ${PAGE}「※これは自軍バトルフェイズ中、カテゴリにWBが追加される」）`, () => {
    expect(categoriesOf(p1Battle({ battle: [inst("XG6-021", "r")] }), "player1", "XG6-021:r")).toEqual(["DA", "WB"]);
    expect(categoriesOf(rushBoard({ battle: [inst("XG6-021", "r")] }), "player1", "XG6-021:r")).toEqual(["DA"]);
  });

  /** リンライオン（1番目）→ XG6-007 ゲキリントージャ（WB／DA の L。2番目）。自軍捨札に multi 枚のマルチカテゴリのカード（XG6-048 WB／DA）。 */
  const jc = (multi: number) => {
    let s = p1Battle({ rush: [inst("XG6-021", "r"), inst("XG6-007", "gk")], discard: [...Array.from({ length: multi }, (_, i) => inst("XG6-048", `m${i}`)), inst("TST-OP", "single")] });
    s = passEntry(enter(s, "XG6-021:r"));
    s = enter(s, "XG6-007:gk");
    while (s.pendingEffectChoice?.sourceCardId === "XG6-007" && canSkip(s)) s = settle(skipChoice(s));
    return s;
  };
  function skipChoice(s: GameState): GameState {
    return act(s, { type: "skip_effect_choice", playerId: s.pendingEffectChoice!.playerId });
  }

  it(
    `XG6-021: 【激臨剣】これからコンビネーションした同カテゴリ（WB／DA）の L ユニットは、このターン、自軍捨札のカテゴリを2つ以上持つカード1枚につき BP+2000（2枚で 14000→18000）（出典: ${PAGE}「自軍捨札にあるカテゴリを2つ以上持つカード1枚につきBP+2000され」）`,
    () => {
      expect(bpOf(jc(2), "player1", "XG6-007:gk")).toBe(18000);
    },
  );

  it(
    `XG6-021: 【激臨剣】BP20000 以上のとき「SP2」になる（3枚で BP20000・SP2）（出典: ${PAGE}「BP20000以上のとき「SP2」になる」）`,
    () => {
      const s = jc(3);
      expect(bpOf(s, "player1", "XG6-007:gk")).toBe(20000);
      expect(spOf(s, "player1", "XG6-007:gk")).toBe(2);
    },
  );

  /** リンライオン（バトルフェイズ中は DA／WB）→ カテゴリ cat の L ユニット（BP10000）。自軍捨札にマルチカテゴリのカード2枚。 */
  const jcWith = (cat: string | string[]) => {
    const LU = sUnit("SPEC-LU", { category: cat as never, size: "L", bp: 10000, powerCost: 5 });
    let s = p1Battle({ rush: [inst("XG6-021", "r"), inst("SPEC-LU", "l")], discard: [inst("XG6-048", "m0"), inst("XG6-048", "m1")] }, {}, [...EXTRA, LU]);
    s = passEntry(enter(s, "XG6-021:r"));
    return enter(s, "SPEC-LU:l");
  };

  it(`XG6-021: 【激臨剣】「同カテゴリ」はカテゴリを1つでも共有すればよい — DA だけの L ユニットも能力を得る（BP10000→14000）${U28}`, () => {
    expect(bpOf(jcWith("DA"), "player1", "SPEC-LU:l")).toBe(14000);
  });

  it(`XG6-021: 【激臨剣】DA も WB も持たない L ユニット（MA／OT）は能力を得ない（BP10000 のまま）${U28}`, () => {
    expect(bpOf(jcWith(["MA", "OT"]), "player1", "SPEC-LU:l")).toBe(10000);
  });
});

// ===========================================================================
describe("XG6-022 リンカメレオン", () => {
  const TEXT =
    "※これは自軍バトルフェイズ中、カテゴリにWBが追加される。 ※これは敵軍ユニットにアタックされない。 【リンギ・がんじがため】これが同カテゴリのLユニットからコンビネーションするとき、次の効果を発動できる⇒敵軍ユニットを1体選ぶ。そうしたとき、選んだユニットがリリース状態ならホールドし、ホールド状態なら撃破する。ただし、必要パワーの数字が、自軍捨札にあるカテゴリを2つ以上持つカードの枚数以下のユニットしか選べない。";
  const PAGE = "atwiki/page-2306";

  it(`XG6-022: カタログ本文・スペックが出典と一致（出典: ${PAGE}）`, () => {
    expectCatalogText("XG6-022", TEXT);
    expectUnit("XG6-022", { name: "リンカメレオン", category: "DA", size: "M", bp: 2500, sp: undefined, powerCost: "2+", comboNumber: "R", features: ["臨気"] });
    expectRushCondition("XG6-022", "state_gate", "特徴「臨気」と「女」を持つ自軍ユニットがある");
    expectRarityIn("XG6-022", ["N"]);
  });

  it(
    `XG6-022: 追加条件 — 特徴「臨気」と「女」を持つ自軍ユニット（RS-504 獣人メレ）があればラッシュできる（出典: ${PAGE}「追加条件：特徴「臨気」と「女」を持つ自軍ユニットがある」）`,
    () => {
      expect(rushHand("XG6-022:c", { rush: [inst("RS-504", "mele")], command: releasedCat("DA", 1), power: powerCards(2) }).ok).toBe(true);
    },
  );

  it(`XG6-022: ※ 自軍バトルフェイズ中はカテゴリに WB が追加される（出典: ${PAGE}「※これは自軍バトルフェイズ中、カテゴリにWBが追加される」）`, () => {
    expect(categoriesOf(p1Battle({ battle: [inst("XG6-022", "c")] }), "player1", "XG6-022:c")).toEqual(["DA", "WB"]);
    expect(categoriesOf(rushBoard({ battle: [inst("XG6-022", "c")] }), "player1", "XG6-022:c")).toEqual(["DA"]);
  });

  it(`XG6-022: ※ 敵軍ユニットにアタックされない（出典: ${PAGE}「※これは敵軍ユニットにアタックされない」）`, () => {
    const s = enemyTurn({ battle: [inst("XG6-022", "c"), inst("SPEC-RED", "r")] }, { battle: [inst("TST-UNIT-7", "atk")] }, EXTRA);
    expect(attackTargets(s, "TST-UNIT-7:atk", "player2")).toEqual(["SPEC-RED:r"]);
  });

  /** XG6-007 ゲキリントージャ（WB／DA の L）の次にリンカメレオンを出す。自軍捨札にマルチカテゴリのカード multi 枚。 */
  const ganjigarame = (multi: number, enemy: CardInstance[]) =>
    enter(
      p1Battle(
        { battle: [inst("XG6-007", "gk")], rush: [inst("XG6-022", "c")], discard: Array.from({ length: multi }, (_, i) => inst("XG6-048", `m${i}`)) },
        { battle: enemy },
        EXTRA,
      ),
      "XG6-022:c",
    );

  it(
    `XG6-022: 【リンギ・がんじがため】同カテゴリの L ユニットからコンビネーションするとき、必要パワーの数字が自軍捨札のマルチカテゴリのカードの枚数（1）以下の敵軍ユニットから1体選べる（必要パワー3のユニットは選べない）（出典: ${PAGE}「必要パワーの数字が、自軍捨札にあるカテゴリを2つ以上持つカードの枚数以下のユニットしか選べない」）`,
    () => {
      const s = ganjigarame(1, [inst("SPEC-C1", "e1"), inst("SPEC-C3", "e3")]);
      expectChoiceFrom(s, "player1", "XG6-022");
      expect(choiceIds(s)).toEqual(["SPEC-C1:e1"]);
    },
  );

  it(
    `XG6-022: 【リンギ・がんじがため】選んだユニットがリリース状態ならホールドし、ホールド状態なら撃破する（出典: ${PAGE}「選んだユニットがリリース状態ならホールドし、ホールド状態なら撃破する」）`,
    () => {
      let s = resolveAll(pick(ganjigarame(1, [inst("SPEC-C1", "e1")]), "SPEC-C1:e1"));
      expect(cardIn(s, "player2", "SPEC-C1:e1")?.commandHeld).toBe(true);
      s = ganjigarame(1, [{ ...inst("SPEC-C1", "e1"), commandHeld: true }]);
      s = resolveAll(pick(s, "SPEC-C1:e1"));
      expect(zoneOf(s, "player2", "SPEC-C1:e1")).toBe("discard");
    },
  );

  /** カテゴリ cat の L ユニットの次にリンカメレオンを出す。自軍捨札にマルチカテゴリのカード1枚。 */
  const ganjiFrom = (cat: string | string[]) => {
    const LU = sUnit("SPEC-LU", { category: cat as never, size: "L", bp: 10000, powerCost: 5 });
    return enter(
      p1Battle({ battle: [inst("SPEC-LU", "l")], rush: [inst("XG6-022", "c")], discard: [inst("XG6-048", "m0")] }, { battle: [inst("SPEC-C1", "e1")] }, [...EXTRA, LU]),
      "XG6-022:c",
    );
  };

  it(`XG6-022: 【リンギ・がんじがため】「同カテゴリ」はカテゴリを1つでも共有すればよい — WB だけの L ユニットからコンビネーションしても発動できる${U28}`, () => {
    const s = ganjiFrom("WB");
    expectChoiceFrom(s, "player1", "XG6-022");
    expect(choiceIds(s)).toEqual(["SPEC-C1:e1"]);
  });

  it(`XG6-022: 【リンギ・がんじがため】DA も WB も持たない L ユニット（MA／OT）からでは発動しない${U28}`, () => {
    expect(ganjiFrom(["MA", "OT"]).pendingEffectChoice?.sourceCardId).not.toBe("XG6-022");
  });
});
