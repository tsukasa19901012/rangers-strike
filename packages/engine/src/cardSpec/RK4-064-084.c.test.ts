/**
 * カード別スペック: RK-078〜RK-084（ザ・マスクドライダーEXP vol.1 クロックアップ〜vol.2 トリックベント）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-1（RK-021 欄。RK-078 と同じカード）、
 *     grnrngr/faq-rider-2（docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_2.html。RK-079・RK-080・RK-081 の Q&A）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md。RK-078 は RK-021 と同じ page-173）
 *  3. docs/rules/*.md の一般ルール（R-KW-PERM-01、R-KW-RC-01、R-START-06、R-ADD-01 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「メモリアルレア／ノーマル」を MR／N として照合する。
 *
 * RK-078 クロックアップは RK-021 と同名・同文の再録（スターター版）。RK-021 の照合（cardSpec/RK1-001-021.c.test.ts）の主な項目を ID を替えて確かめる。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-081 の重ねたカードが10枚以上のターン開始時の SP1（ホールド中のコマンドの有無によらない）— rulesSpec/03-turn.test.ts R-START-06・startPhaseBegin.test.ts
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import {
  PLAIN_VEHICLE,
  act,
  activateResident,
  attack,
  attackersOf,
  canActivateResident,
  canSkip,
  cardIn,
  choiceIds,
  confirm,
  deckCards,
  endTurn,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  fill,
  inst,
  legal,
  mount,
  nextPhase,
  p1Battle,
  passEntry,
  pick,
  played,
  powerCards,
  rcRideOff,
  releasedCat,
  resident,
  resolveAll,
  rideOff,
  settle,
  skip,
  spOf,
  st,
  stackedOn,
  sUnit,
  zoneIds,
  zoneOf,
} from "./RK4-064-084.helpers";

const ACCEL = sUnit("SPEC-ACCEL", { category: "OT", bp: 1000, features: ["加速"] });
const CN2 = sUnit("SPEC-CN2", { category: "ET", bp: 2000, comboNumber: 2 });
const CN2_M = sUnit("SPEC-CN2-M", { category: "ET", bp: 2000, comboNumber: 2, size: "M" });
const NONUM = sUnit("SPEC-NONUM", { category: "ET", bp: 2000 });
const NOSP = sUnit("SPEC-NOSP-U", { category: "DA", bp: 2000, sp: undefined });
const RC_S = sUnit("SPEC-RC", { category: "ET", bp: 2000, comboNumber: "RC" });
const AMADAM = sUnit("SPEC-AMADAM", { category: "MA", bp: 2000, powerCost: 2, features: ["仮面ライダー", "アマダム"] });
const AMADAM2 = sUnit("SPEC-AMADAM2", { category: "MA", bp: 4000, powerCost: 2, features: ["仮面ライダー", "アマダム"] });
const AMADAM5 = sUnit("SPEC-AMADAM5", { category: "MA", bp: 6000, powerCost: 5, features: ["仮面ライダー", "アマダム"] });
const KENJA = sUnit("SPEC-KENJA", { category: "MA", bp: 2000, powerCost: 2, features: ["仮面ライダー", "賢者の石"] });
const KENJA2 = sUnit("SPEC-KENJA2", { category: "MA", bp: 4000, powerCost: 2, features: ["仮面ライダー", "賢者の石"] });
const KAMEN = sUnit("SPEC-KAMEN", { category: "MA", bp: 2000, features: ["仮面ライダー"] });
const MIRROR2 = sUnit("SPEC-MIRROR2", { category: "WB", bp: 2000, powerCost: 2, features: ["仮面ライダー", "ミラーライダー"] });
const MIRROR4P = sUnit("SPEC-MIRROR4P", { category: "WB", bp: 3000, powerCost: "4+", features: ["仮面ライダー", "ミラーライダー"] });
const MIRROR7 = sUnit("SPEC-MIRROR7", { category: "WB", bp: 8000, powerCost: 7, features: ["仮面ライダー", "ミラーライダー"] });
const E_COST1 = sUnit("SPEC-E1", { bp: 1000, powerCost: 1 });
const E_COST3 = sUnit("SPEC-E3", { bp: 3000, powerCost: 3 });
const E_COST4 = sUnit("SPEC-E4", { bp: 4000, powerCost: 4 });
const E_COST5 = sUnit("SPEC-E5", { bp: 5000, powerCost: 5 });
const E_COST2_M = sUnit("SPEC-E2M", { bp: 3000, powerCost: 2, size: "M" });
const EXTRA = [E_COST1, NOSP, ACCEL, CN2, CN2_M, NONUM, RC_S, AMADAM, AMADAM2, AMADAM5, KENJA, KENJA2, KAMEN, MIRROR2, MIRROR4P, MIRROR7, E_COST3, E_COST4, E_COST5, E_COST2_M, PLAIN_VEHICLE];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
/** 敵軍（player2）バトルフェイズの盤面。 */
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
/** 自軍（player1）ラッシュフェイズの盤面。 */
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
const faceDown = (n: number, prefix: string): CardInstance[] => Array.from({ length: n }, (_, i) => ({ ...inst("TST-OP", `${prefix}${i}`), faceDown: true }));

/**
 * 敵軍ターンの終わりから自軍（player1）のスタートフェイズを始め（呼ぶ側が endTurn で始める）、スタートフェイズを終えるときの選択が開くか、チャージフェイズになるまで進める。
 * 開いた選択が sourceCardId のものなら、そこで止める。
 */
const toStartEnd = (s: GameState, sourceCardId: string, who: PlayerId = "player1") => {
  let n = s;
  for (let i = 0; i < 20; i++) {
    if (n.pendingEffectChoice?.sourceCardId === sourceCardId) return n;
    if (n.activePlayer === who && n.phase === "charge" && !n.pendingEffectChoice) return n;
    const acts = legal(n);
    const a = ["release_start_commands", "return_all_battle_to_rush", "draw", "skip_bonus_draw", "end_phase"]
      .map((t) => acts.find((x) => x.type === t && x.playerId === who && !("instanceId" in x && x.instanceId)))
      .find(Boolean);
    if (!a) break;
    n = act(n, a);
  }
  return n;
};

// ===========================================================================
describe("RK-078 クロックアップ（RK-021 の再録）", () => {
  const TEXT =
    "※常駐 これを配置するとき、自軍山札の上から自軍パワーゾーンのカード枚数と同じ枚数ひいて、これにウラ向きに重ねる。そして、特徴「加速」を持つ自軍ユニットがアタックされるたび、これに重ねたカードを1枚自軍山札の下に戻す。そうしたとき、バトルは行われない。これが常駐置き場を離れるとき、重ねたカードはすべて捨札になる。";

  const clock = (stacked: number) => resident("RK-078", "cu", faceDown(stacked, "stk"));
  const attacked = (defender: string, stacked = 2) => {
    const [did, dsuf] = defender.split(":") as [string, string];
    const s = enemyTurn({ operation: [clock(stacked)], battle: [inst(did, dsuf)], deck: deckCards(3) }, { battle: [inst("TST-UNIT-7", "atk")] });
    return settle(attack(s, "TST-UNIT-7:atk", defender, "player2"));
  };

  it("RK-078: カタログ本文・スペックが出典と一致（RK-021 と同文）（出典: atwiki/page-173）", () => {
    expectCatalogText("RK-078", TEXT);
    expectOpStats("RK-078", { name: "クロックアップ", category: "OT", powerCost: 4 });
    expectRarityIn("RK-078", ["MR", "N"]);
  });

  it("RK-078: 配置するとき、自軍パワーゾーンの枚数（4枚）と同じ枚数を山札の上からひいて、ウラ向きに重ねる（出典: atwiki/page-173）", () => {
    const s = resolveAll(played(rushPhase({ hand: [inst("RK-078", "cu")], command: releasedCat("OT", 1), power: powerCards(4), deck: deckCards(6) }), "RK-078:cu"));
    expect(stackedOn(s, "player1", "RK-078:cu")).toEqual(["TST-OP:dk0", "TST-OP:dk1", "TST-OP:dk2", "TST-OP:dk3"]);
    expect((s.players.player1.operation[0]?.stackedCards ?? []).every((c) => c.faceDown)).toBe(true);
  });

  it("RK-078: 特徴「加速」を持つ自軍ユニットがアタックされると、重ねたカードを1枚自軍山札の下に戻し、バトルは行われない（出典: atwiki/page-173）", () => {
    const s = attacked("SPEC-ACCEL:d");
    expect(zoneOf(s, "player1", "SPEC-ACCEL:d")).toBe("battle");
    expect(stackedOn(s, "player1", "RK-078:cu")).toHaveLength(1);
    expect(zoneIds(s, "player1", "deck")).toHaveLength(4);
  });

  it("RK-078: 「加速」を持たないユニットは通常どおりバトルする／重ねたカードがなければバトルする（出典: atwiki/page-173・grnrngr/faq-rider-1 RK-021 Q3）", () => {
    expect(zoneOf(attacked("TST-UNIT-0:d"), "player1", "TST-UNIT-0:d")).toBe("discard");
    const empty = attacked("SPEC-ACCEL:d", 0);
    expect(zoneOf(empty, "player1", "SPEC-ACCEL:d")).toBe("discard");
    expect(zoneOf(empty, "player1", "RK-078:cu")).toBe("operation");
  });

  it("RK-078: 常駐置き場を離れるとき、重ねたカードはすべて捨札になる（出典: atwiki/page-173・R-KW-PERM-01）", () => {
    let s = rushPhase({ operation: [clock(2)], hand: [inst("RK-014", "kd")], command: releasedCat("MA", 1), power: powerCards(2) });
    s = resolveAll(played(s, "RK-014:kd"));
    expect(zoneOf(s, "player1", "RK-078:cu")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP:stk0")).toBe("discard");
  });

  it.todo(
    "RK-078: 公式Q&A — 無限連鎖カードは常駐の効果を無効にするだけで、クロックアップと重ねたカードは常駐置き場に留まる（出典: atwiki/page-173 Q1・grnrngr/faq-rider-1 RK-021 Q1）— RK-021 の照合（RK1-001-021.c.test.ts）と同じく、RS-072 の常駐の無効化の手順を公開 API で組み立てられないため",
  );
  it.todo(
    "RK-078: 公式Q&A — 「加速」のユニットがアタックされたとき隠流忍術も使えるが、否定文優先でバトルは行われない（出典: atwiki/page-173 Q2・grnrngr/faq-rider-1 RK-021 Q2）— RK-021 の照合と同じく、強制の常駐の処理と隠流忍術の反応ウィンドウの順序を公開 API で観測できないため",
  );
});

// ===========================================================================
describe("RK-079 仮面ライダーの称号", () => {
  const TEXT =
    "ナンバーに数字を持つ自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。このカードに重ねたユニットのナンバーはＲＣになり、特徴「仮面ライダー」が追加される。重ねたユニットがユニットでなくなるとき、このカードは捨札になる。";

  const titled = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}, target = "SPEC-CN2:u") =>
    resolveAll(played(rushPhase({ hand: [inst("RK-079", "tt")], rush: [inst("SPEC-CN2", "u")], command: releasedCat("ET", 1), power: powerCards(5), ...p1 }, p2), "RK-079:tt"), [target]);

  it("RK-079: カタログ本文・スペックが出典と一致（出典: atwiki/page-661）", () => {
    expectCatalogText("RK-079", TEXT);
    expectOpStats("RK-079", { name: "仮面ライダーの称号", category: "ET", powerCost: 5 });
    expectRarityIn("RK-079", ["N"]);
  });

  it("RK-079: 選べるのはナンバーに数字を持つ自軍 S ユニットだけ（RC・ナンバーなし・M ユニットは選べない）（出典: atwiki/page-661「ナンバーに数字を持つ自軍Sユニットを1体選ぶ」）", () => {
    const s = played(
      rushPhase({ hand: [inst("RK-079", "tt")], rush: [inst("SPEC-CN2", "u"), inst("SPEC-RC", "rc"), inst("SPEC-NONUM", "nn"), inst("SPEC-CN2-M", "m")], command: releasedCat("ET", 1), power: powerCards(5) }),
      "RK-079:tt",
    );
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-079");
    expect(choiceIds(s)).toEqual(["SPEC-CN2:u"]);
  });

  it("RK-079: 選んだユニットはラッシュエリアに残り、このカードがその下に重なる（出典: atwiki/page-661「このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる」）", () => {
    const s = titled();
    expect(zoneOf(s, "player1", "SPEC-CN2:u")).toBe("rush");
    expect(zoneOf(s, "player1", "RK-079:tt")).toBeNull();
    expect((cardIn(s, "player1", "SPEC-CN2:u")?.stackedCards ?? []).map((c) => c.instanceId)).toEqual(["RK-079:tt"]);
  });

  it("RK-079: 重ねたユニットのナンバーは RC になる — RC のユニットだけがライドできるビークルにライドできる（出典: atwiki/page-661「ナンバーはＲＣになり」）", () => {
    const s = nextPhase(titled({ rush: [inst("SPEC-CN2", "u"), inst("SPEC-VEHICLE", "v")] }));
    expect(legal(s).some((a) => a.type === "mount_ride" && a.riderInstanceId === "SPEC-CN2:u" && a.vehicleInstanceId === "SPEC-VEHICLE:v")).toBe(true);
  });

  it("RK-079: ナンバーが RC になったユニットの効果は、ライドオフで発動する（2番目でなくても、キックホッパーの NC【ライダーキック】が発動）（出典: atwiki/page-661・R-KW-RC-01）", () => {
    let s = titled({ rush: [inst("RK-071", "kh"), inst("SPEC-VEHICLE", "v")] }, { rush: [inst("SPEC-E3", "r1")], battle: [inst("SPEC-E1", "b")] }, "RK-071:kh");
    s = rcRideOff(nextPhase(s), "RK-071:kh", "SPEC-VEHICLE:v");
    expectChoiceFrom(s, "player1", "RK-071");
  });

  it("RK-079: ナンバーが RC になったユニットは、ナンバーの数字の位置に出ても NC は成立しない（キックホッパーを2番目に出しても発動しない）（出典: atwiki/page-661「ナンバーはＲＣになり」・R-KW-RC-01「RC はナンバーを持つものとして扱うが数字ではない」）", () => {
    let s = titled({ rush: [inst("RK-071", "kh")], battle: fill(1) }, { rush: [inst("SPEC-E3", "r1")], battle: [inst("SPEC-E1", "b")] }, "RK-071:kh");
    s = enter(nextPhase(s), "RK-071:kh");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-071");
  });

  it("RK-079: 重ねたユニットに特徴「仮面ライダー」が追加される（ライダーマンの「これ以外の仮面ライダーがいれば敵軍 S ユニットにアタックされない」を満たす）（出典: atwiki/page-661「特徴「仮面ライダー」が追加される」・atwiki/page-131）", () => {
    let s = titled();
    s = { ...s, phase: "battle" as const, activePlayer: "player2" as const };
    s = {
      ...s,
      players: {
        ...s.players,
        player1: { ...s.players.player1, battle: [...s.players.player1.rush, inst("RK-074", "rm")], rush: [] },
        player2: { ...s.players.player2, battle: [inst("SPEC-E3", "atk")] },
      },
    };
    expect(attackersOf(s, "RK-074:rm")).toEqual([]);
  });

  it("RK-079: 重ねたユニットが撃破されてユニットでなくなるとき、このカードは捨札になる（出典: atwiki/page-661「重ねたユニットがユニットでなくなるとき、このカードは捨札になる」）", () => {
    let s = nextPhase(titled({}, { battle: [inst("TST-UNIT-7", "big")] }));
    s = enter(s, "SPEC-CN2:u");
    s = resolveAll(attack(s, "SPEC-CN2:u", "TST-UNIT-7:big"));
    expect(zoneOf(s, "player1", "SPEC-CN2:u")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-079:tt")).toBe("discard");
  });

  // faq-rider-2 RK-079 Q「はい、有効です。…「カードに表記された本来のナンバー」を参照しますので、ナンバーがRCになっていたとしても適用されることになります。」
  it("RK-079: 公式Q&A — レッドホーク（本来のナンバー5）のナンバーが RC になっていても、並び順が本来のナンバーと違えばターンを終えるとき手札に戻り、このカードは捨札になる（出典: grnrngr/faq-rider-2 RK-079 Q・atwiki/page-661 Q1）", () => {
    let s = titled({ rush: [inst("RS-280", "rh")] }, {}, "RS-280:rh");
    s = enter(nextPhase(s), "RS-280:rh");
    s = endTurn(passEntry(s));
    expect(zoneOf(s, "player1", "RS-280:rh")).toBe("hand");
    expect(zoneOf(s, "player1", "RK-079:tt")).toBe("discard");
  });
});

// ===========================================================================
/** 超変身（RK-080）・オルタフォース（RK-082）の共通テスト。 */
function stackSwapTests(id: string, name: string, feature: string, page: string, unit: string, unit2: string, faq: string) {
  /** 自軍スタートフェイズを、常駐の id と手札 hand で始め、スタートフェイズを終えるときの選択まで進める。 */
  const start = (hand: CardInstance[], stacked: CardInstance[] = [], extra: Partial<GameState["players"]["player1"]> = {}) =>
    toStartEnd(
      endTurn(st({ activePlayer: "player2", player1: { operation: [resident(id, "op", stacked)], hand, deck: deckCards(6), ...extra }, player2: { deck: deckCards(5, "e") } }, EXTRA)),
      id,
    );

  it(`${id}: 自軍スタートフェイズを終えるとき、手札の特徴「${feature}」を持つユニットカードだけを選べる（任意）（出典: ${page}）`, () => {
    const s = start([inst(unit, "h1"), inst("SPEC-KAMEN", "k"), inst(unit2, "h2")]);
    expectChoiceFrom(s, "player1", id);
    expect(choiceIds(s)).toEqual([`${unit2}:h2`, `${unit}:h1`].sort());
    expect(canSkip(s)).toBe(true);
  });

  it(`${id}: 選んだカード（好きな枚数）はこれにオモテ向きに重ねて置き、置いた枚数（2枚）をドローする（出典: ${page}「手札から置いた枚数をドローする」）`, () => {
    let s = start([inst(unit, "h1"), inst("SPEC-KAMEN", "k"), inst(unit2, "h2")]);
    const handBefore = s.players.player1.hand.length;
    s = pick(s, `${unit}:h1`);
    s = pick(s, `${unit2}:h2`);
    if (s.pendingEffectChoice?.sourceCardId === id) s = confirm(s);
    s = settle(s);
    expect(stackedOn(s, "player1", `${id}:op`).sort()).toEqual([`${unit2}:h2`, `${unit}:h1`].sort());
    for (const c of s.players.player1.operation[0]?.stackedCards ?? []) expect(c.faceDown ?? false).toBe(false);
    expect(s.players.player1.hand).toHaveLength(handBefore);
    expect(zoneOf(s, "player1", "SPEC-KAMEN:k")).toBe("hand");
  });

  it(`${id}: 置かなくてもよい（そのときはドローしない）（出典: ${page}「置いてもよい。そうしたとき」）`, () => {
    let s = start([inst(unit, "h1")]);
    const deckBefore = s.players.player1.deck.length;
    s = settle(skip(s));
    expect(stackedOn(s, "player1", `${id}:op`)).toEqual([]);
    expect(s.players.player1.deck).toHaveLength(deckBefore);
    expect(zoneOf(s, "player1", `${unit}:h1`)).toBe("hand");
  });

  // faq-rider-2 RK-080 Q「「毎ターン1回ずつ発動できる」と考えてください。」
  it(`${id}: 公式Q&A — 「一度だけ」は毎ターン1回ずつ — 前のターンに使っていても、次の自軍スタートフェイズにまた置ける（出典: ${faq}）`, () => {
    const s = start([inst(unit, "h1")], [inst(unit2, "old")]);
    expectChoiceFrom(s, "player1", id);
  });

  /** 自軍ラッシュフェイズ。常駐に unit2（BP4000）を重ね、ラッシュエリアに unit（BP2000）がある。 */
  const swapBoard = (rush: CardInstance[], stacked: CardInstance[] = [inst(unit2, "s")], p1: Partial<GameState["players"]["player1"]> = {}) =>
    rushPhase({ rush, operation: [resident(id, "op", stacked)], power: powerCards(2), ...p1 });

  it(`${id}: 自軍ラッシュフェイズに、重ねたカードから1枚選び、本来の特徴に「${feature}」を持つ自軍ユニットと置き換えられる（出典: ${page}「本来の特徴に「${feature}」を持つ自軍ユニットと置き換えてもよい」）`, () => {
    let s = swapBoard([inst(unit, "u"), inst("SPEC-KAMEN", "k")]);
    expect(canActivateResident(s, `${id}:op`)).toBe(true);
    s = activateResident(s, `${id}:op`);
    expect(choiceIds(s)).toEqual([`${unit2}:s`]);
    s = pick(s, `${unit2}:s`);
    expect(choiceIds(s)).toEqual([`${unit}:u`]);
    s = resolveAll(pick(s, `${unit}:u`));
    expect(zoneOf(s, "player1", `${unit2}:s`)).toBe("rush");
    expect(zoneOf(s, "player1", `${unit}:u`)).not.toBe("rush");
  });

  it(`${id}: 置き換えには必要パワーを満たすこと — パワーが足りないカード（必要パワー5）とは置き換えられない（出典: ${page}「（必要パワーと追加条件は満たすこと）」）`, () => {
    const s = swapBoard([inst(unit, "u")], [inst(id === "RK-080" ? "SPEC-AMADAM5" : "RK-106", "big")]);
    expect(canActivateResident(s, `${id}:op`)).toBe(false);
  });

  it(`${id}: 自軍バトルフェイズには置き換えられない（出典: ${page}「自軍ラッシュフェイズに」）`, () => {
    const s = board({ rush: [inst(unit, "u")], operation: [resident(id, "op", [inst(unit2, "s")])], power: powerCards(2) });
    expect(canActivateResident(s, `${id}:op`)).toBe(false);
  });

  it(`${id}: 常駐置き場を離れるとき、重ねたカードはすべて捨札になる（出典: ${page}・R-KW-PERM-01）`, () => {
    let s = rushPhase({ operation: [resident(id, "op", [inst(unit2, "s")])], hand: [inst("RK-014", "kd")], command: releasedCat("MA", 1), power: powerCards(2) });
    s = resolveAll(played(s, "RK-014:kd"));
    expect(zoneOf(s, "player1", `${id}:op`)).toBe("discard");
    expect(zoneOf(s, "player1", `${unit2}:s`)).toBe("discard");
  });

  it(`${id}: 使うと常駐置き場に置かれる（※常駐）（出典: ${page}・R-KW-PERM-01）`, () => {
    const s = resolveAll(played(rushPhase({ hand: [inst(id, "new")], command: releasedCat("MA", 1), power: powerCards(2) }), `${id}:new`));
    expect(zoneOf(s, "player1", `${id}:new`)).toBe("operation");
  });
  void name;
}

describe("RK-080 超変身", () => {
  const TEXT =
    "※常駐 自軍スタートフェイズを終えるとき、一度だけ自分の手札から特徴「アマダム」を持つユニットカードを好きな枚数選び、相手に見せてからこれに重ねて置いてもよい。そうしたとき、手札から置いた枚数をドローする。自軍ラッシュフェイズに重ねたカードから1枚選び、本来の特徴に「アマダム」を持つ自軍ユニットと置き換えてもよい（必要パワーと追加条件は満たすこと）。これが常駐置き場を離れるとき、重ねたカードはすべて捨札になる。";

  it("RK-080: カタログ本文・スペックが出典と一致（出典: atwiki/page-684）", () => {
    expectCatalogText("RK-080", TEXT);
    expectOpStats("RK-080", { name: "超変身", category: "MA", powerCost: 2 });
    expectRarityIn("RK-080", ["N"]);
  });

  stackSwapTests("RK-080", "超変身", "アマダム", "atwiki/page-684", "SPEC-AMADAM", "SPEC-AMADAM2", "grnrngr/faq-rider-2 RK-080 Q・atwiki/page-684 Q1");
});

describe("RK-082 オルタフォース", () => {
  const TEXT =
    "※常駐 自軍スタートフェイズを終えるとき、一度だけ自分の手札から特徴「賢者の石」を持つユニットカードを好きな枚数選び、相手に見せてからこれに重ねて置いてもよい。そうしたとき、手札から置いた枚数をドローする。自軍ラッシュフェイズに重ねたカードから１枚選び、本来の特徴に「賢者の石」を持つ自軍ユニットと置き換えてもよい（必要パワーと追加条件は満たすこと）。これが常駐置き場を離れるとき、重ねたカードはすべて捨札になる。";

  it("RK-082: カタログ本文・スペックが出典と一致（出典: atwiki/page-621）", () => {
    expectCatalogText("RK-082", TEXT);
    expectOpStats("RK-082", { name: "オルタフォース", category: "MA", powerCost: 2 });
    expectRarityIn("RK-082", ["N"]);
  });

  stackSwapTests("RK-082", "オルタフォース", "賢者の石", "atwiki/page-621", "SPEC-KENJA", "SPEC-KENJA2", "grnrngr/faq-rider-2 RK-080 Q（RK-082 を含む）");
});

// ===========================================================================
describe("RK-081 ゲゲル", () => {
  const TEXT =
    "※常駐 自軍バトルフェイズに敵軍ユニットを1体撃破するたび、自軍山札の上から1枚ひいて、ウラ向きのままこれに重ねてもよい。自軍スタートフェイズに重ねたカードが10枚以上あれば、そのターン中、自軍SユニットはすべてSP1になり、そのターンを終えるとき、これを捨札にする。これが常駐置き場を離れるとき、重ねたカードはすべて捨札になる。";

  it("RK-081: カタログ本文・スペックが出典と一致（出典: atwiki/page-709）", () => {
    expectCatalogText("RK-081", TEXT);
    expectOpStats("RK-081", { name: "ゲゲル", category: "DA", powerCost: 0 });
    expectRarityIn("RK-081", ["N"]);
  });

  /** 自軍バトルフェイズに、バトルエリアの TST-UNIT-7（BP13000）で敵軍の TST-UNIT-0 にアタックして撃破する（ゲゲルの選択は残す）。 */
  const killed = (stacked = 0) => {
    const s = board({ operation: [resident("RK-081", "gg", faceDown(stacked, "st"))], battle: [inst("TST-UNIT-7", "atk")] }, { battle: [inst("TST-UNIT-0", "e")] });
    return settle(attack(s, "TST-UNIT-7:atk", "TST-UNIT-0:e"));
  };

  it("RK-081: 自軍バトルフェイズに敵軍ユニットを撃破したとき、山札の上から1枚ひいて重ねるかを選べる（任意）（出典: atwiki/page-709）", () => {
    const s = killed();
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expectChoiceFrom(s, "player1", "RK-081");
    expect(canSkip(s)).toBe(true);
  });

  // faq-rider-2 RK-081 Q「いいえ、できません。「ウラ向きのまま」とありますので、カードのオモテは見ずに、ウラ向きのまま…重ねてください。」
  it("RK-081: 重ねると、山札の一番上のカードがウラ向きのまま重なる（出典: atwiki/page-709・grnrngr/faq-rider-2 RK-081 Q）", () => {
    const s = settle(confirm(killed()));
    expect(stackedOn(s, "player1", "RK-081:gg")).toEqual(["TST-OP:dk0"]);
    expect(s.players.player1.operation[0]?.stackedCards?.[0]?.faceDown).toBe(true);
    expect(s.players.player1.deck).toHaveLength(4);
  });

  it("RK-081: 重ねなくてもよい（出典: atwiki/page-709「重ねてもよい」）", () => {
    const s = settle(skip(killed()));
    expect(stackedOn(s, "player1", "RK-081:gg")).toEqual([]);
    expect(s.players.player1.deck).toHaveLength(5);
  });

  it("RK-081: 敵軍ターンに敵軍ユニットを撃破しても重ねられない（出典: atwiki/page-709「自軍バトルフェイズに」）", () => {
    let s = enemyTurn({ operation: [resident("RK-081", "gg")], battle: [inst("TST-UNIT-7", "def")] }, { battle: [inst("TST-UNIT-0", "e")] });
    s = settle(attack(s, "TST-UNIT-0:e", "TST-UNIT-7:def", "player2"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-081");
  });

  const startWith = (stacked: number) =>
    toStartEnd(
      endTurn(st({ activePlayer: "player2", player1: { operation: [resident("RK-081", "gg", faceDown(stacked, "st"))], rush: [inst("SPEC-NOSP-U", "u")], deck: deckCards(6) }, player2: { deck: deckCards(5, "e") } }, EXTRA)),
      "RK-081",
    );

  it("RK-081: 自軍スタートフェイズに重ねたカードが10枚なら自軍 S ユニットは SP1 になり、9枚ならならない（SP「－」のユニットで確かめる）（出典: atwiki/page-709「10枚以上あれば、そのターン中、自軍SユニットはすべてSP1になり」）", () => {
    expect(spOf(startWith(10), "player1", "SPEC-NOSP-U:u")).toBe(1);
    expect(spOf(startWith(9), "player1", "SPEC-NOSP-U:u")).toBe(0);
  });

  it("RK-081: 10枚以上あったターンを終えるとき、これを捨札にし、重ねたカードもすべて捨札になる（出典: atwiki/page-709「そのターンを終えるとき、これを捨札にする」・「重ねたカードはすべて捨札になる」）", () => {
    let s = startWith(10);
    s = endTurn(s);
    expect(s.activePlayer).toBe("player2");
    expect(zoneOf(s, "player1", "RK-081:gg")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP:st0")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP:st9")).toBe("discard");
  });

  it("RK-081: 9枚のターンを終えても、これは常駐置き場に残る（出典: atwiki/page-709）", () => {
    const s = endTurn(startWith(9));
    expect(zoneOf(s, "player1", "RK-081:gg")).toBe("operation");
  });

  it("RK-081: 常駐置き場を離れるとき、重ねたカードはすべて捨札になる（出典: atwiki/page-709・R-KW-PERM-01）", () => {
    let s = rushPhase({ operation: [resident("RK-081", "gg", faceDown(2, "st"))], hand: [inst("RK-014", "kd")], command: releasedCat("MA", 1), power: powerCards(2) });
    s = resolveAll(played(s, "RK-014:kd"));
    expect(zoneOf(s, "player1", "RK-081:gg")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP:st0")).toBe("discard");
  });
});

// ===========================================================================
describe("RK-083 ストライクベント", () => {
  const TEXT =
    "特徴「ミラーライダー」を持つ自軍ユニットを1体選び、必要パワーの数字を見る。その後、敵軍バトルエリアから、その数字以下の必要パワーの数字を持つSユニットを1体選び、撃破する。";

  const vent = (rush: CardInstance[], p2: Partial<GameState["players"]["player2"]> = {}) =>
    played(rushPhase({ hand: [inst("RK-083", "sv")], rush, command: releasedCat("WB", 1), power: powerCards(3) }, p2), "RK-083:sv");
  const enemy = { battle: [inst("SPEC-E3", "c3"), inst("SPEC-E4", "c4"), inst("SPEC-E5", "c5"), inst("SPEC-E2M", "m")], rush: [inst("SPEC-E3", "r3")] };

  it("RK-083: カタログ本文・スペックが出典と一致（出典: atwiki/page-624）", () => {
    expectCatalogText("RK-083", TEXT);
    expectOpStats("RK-083", { name: "ストライクベント", category: "WB", powerCost: 3 });
    expectRarityIn("RK-083", ["N"]);
  });

  it("RK-083: まず特徴「ミラーライダー」を持つ自軍ユニットを選ぶ（出典: atwiki/page-624「特徴「ミラーライダー」を持つ自軍ユニットを1体選び」）", () => {
    const s = vent([inst("SPEC-MIRROR4P", "a"), inst("SPEC-MIRROR2", "b"), inst("SPEC-KAMEN", "k")], enemy);
    expectChoiceFrom(s, "player1", "RK-083");
    expect(choiceIds(s)).toEqual(["SPEC-MIRROR2:b", "SPEC-MIRROR4P:a"]);
  });

  it("RK-083: 選んだユニットの必要パワーの数字（「4+」は 4）以下の、敵軍バトルエリアの S ユニットを選んで撃破する（ラッシュエリア・M は対象外）（出典: atwiki/page-624「その数字以下の必要パワーの数字を持つSユニットを1体選び、撃破する」）", () => {
    let s = pick(vent([inst("SPEC-MIRROR4P", "a"), inst("SPEC-MIRROR2", "b")], enemy), "SPEC-MIRROR4P:a");
    expectChoiceFrom(s, "player1", "RK-083");
    expect(choiceIds(s)).toEqual(["SPEC-E3:c3", "SPEC-E4:c4"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "SPEC-E4:c4"));
    expect(zoneOf(s, "player2", "SPEC-E4:c4")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E3:c3")).toBe("battle");
  });

  it("RK-083: 必要パワーの数字が小さいミラーライダー（2）を選ぶと、それ以下の S ユニットがいなければ撃破しない（出典: atwiki/page-624）", () => {
    const s = resolveAll(pick(vent([inst("SPEC-MIRROR4P", "a"), inst("SPEC-MIRROR2", "b")], enemy), "SPEC-MIRROR2:b"));
    expect(s.players.player2.discard).toHaveLength(0);
  });

  it("RK-083: 自軍にミラーライダーがいなければ、数字がないので撃破しない（オペレーションは捨札になる）（出典: atwiki/page-624「必要パワーの数字を見る。その後、…その数字以下の」）", () => {
    const s = resolveAll(vent([inst("SPEC-KAMEN", "k")], enemy));
    expect(s.players.player2.discard).toHaveLength(0);
    expect(zoneOf(s, "player1", "RK-083:sv")).toBe("discard");
  });

  it("RK-083: 必要パワー7のミラーライダーなら、必要パワー5の S ユニットも撃破できる（出典: atwiki/page-624）", () => {
    const s = pick(vent([inst("SPEC-MIRROR7", "a")], enemy), "SPEC-MIRROR7:a");
    expect(choiceIds(s)).toEqual(["SPEC-E3:c3", "SPEC-E4:c4", "SPEC-E5:c5"]);
  });

  it.todo(
    "RK-083: 特徴「アドベントカード」を持つ（出典: atwiki/page-624「特徴：アドベントカード」）— カタログがオペレーションの特徴を持たない（全オペレーションで未収録）ため照合できない",
  );
});

// ===========================================================================
describe("RK-084 トリックベント", () => {
  const TEXT =
    "自軍山札の上から3枚をオモテにする。その中から特徴「ミラーライダー」を持つユニットカードをすべて自軍ラッシュエリアに出す。ただし、追加条件は満たすこと（必要パワーは満たさなくてもよい）。その後、それ以外のオモテにしたカードはすべて捨札になる。";

  const trick = (deck: CardInstance[], p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    resolveAll(played(rushPhase({ hand: [inst("RK-084", "tv")], command: releasedCat("WB", 1), power: powerCards(4), deck, ...p1 }, p2), "RK-084:tv"));

  it("RK-084: カタログ本文・スペックが出典と一致（出典: atwiki/page-642）", () => {
    expectCatalogText("RK-084", TEXT);
    expectOpStats("RK-084", { name: "トリックベント", category: "WB", powerCost: 4 });
    expectRarityIn("RK-084", ["N"]);
  });

  it("RK-084: 山札の上から3枚のうち、ミラーライダーのユニットカードはすべて自軍ラッシュエリアに出る（必要パワー7でもよい）（出典: atwiki/page-642「必要パワーは満たさなくてもよい」）", () => {
    const s = trick([inst("SPEC-MIRROR7", "a"), inst("SPEC-KAMEN", "k"), inst("SPEC-MIRROR2", "b"), inst("SPEC-MIRROR2", "c")]);
    expect(zoneOf(s, "player1", "SPEC-MIRROR7:a")).toBe("rush");
    expect(zoneOf(s, "player1", "SPEC-MIRROR2:b")).toBe("rush");
  });

  it("RK-084: その後、それ以外のオモテにしたカードはすべて捨札になり、4枚目は山札に残る（出典: atwiki/page-642「その後、それ以外のオモテにしたカードはすべて捨札になる」）", () => {
    const s = trick([inst("SPEC-MIRROR7", "a"), inst("SPEC-KAMEN", "k"), inst("TST-OP", "op"), inst("SPEC-MIRROR2", "c")]);
    expect(zoneOf(s, "player1", "SPEC-KAMEN:k")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP:op")).toBe("discard");
    expect(zoneIds(s, "player1", "deck")).toEqual(["SPEC-MIRROR2:c"]);
  });

  it("RK-084: ミラーライダーがなければ、3枚とも捨札になる（出典: atwiki/page-642）", () => {
    const s = trick([inst("SPEC-KAMEN", "k"), inst("TST-OP", "op"), inst("TST-UNIT-0", "u"), inst("SPEC-MIRROR2", "c")]);
    expect(s.players.player1.discard.map((c) => c.instanceId).sort()).toEqual(["RK-084:tv", "SPEC-KAMEN:k", "TST-OP:op", "TST-UNIT-0:u"].sort());
    expect(s.players.player1.rush).toHaveLength(0);
  });

  it("RK-084: 追加条件は満たすこと — 満たせないミラーライダー（仮面ライダーオーディン: 捨札の合計11枚以上）は出ずに捨札になる（出典: atwiki/page-642「ただし、追加条件は満たすこと」・カード評価「オーディンの追加条件が満たせなかった場合、そのまま捨札になってしまう」）", () => {
    const s = trick([inst("RK-286", "od"), inst("SPEC-MIRROR2", "b"), inst("TST-OP", "op")]);
    expect(zoneOf(s, "player1", "RK-286:od")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-MIRROR2:b")).toBe("rush");
  });

  it("RK-084: 追加条件を満たしていれば（捨札の合計11枚以上）仮面ライダーオーディンも出る（出典: atwiki/page-642・atwiki の RK-286「自分と相手の捨札の合計が11枚以上ある」）", () => {
    // 自軍パワーを6枚にする（4枚だと、出たオーディン自身が【戦いのリセット】で撃破される。RK14-274-294.b の RK-286）。
    const s = trick([inst("RK-286", "od"), inst("TST-OP", "op"), inst("TST-OP", "op2")], { discard: deckCards(6, "d1"), power: powerCards(6) }, { discard: deckCards(5, "d2") });
    expect(zoneOf(s, "player1", "RK-286:od")).toBe("rush");
  });

  it.todo(
    "RK-084: 特徴「アドベントカード」を持つ（出典: atwiki/page-642「特徴：アドベントカード」）— カタログがオペレーションの特徴を持たない（全オペレーションで未収録）ため照合できない",
  );
});

// 未使用の import を避けるための参照。
void mount;
void rideOff;
