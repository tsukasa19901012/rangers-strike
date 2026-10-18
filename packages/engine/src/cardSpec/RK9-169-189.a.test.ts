/**
 * カード別スペック: RK-169〜RK-175（ザ・マスクドライダーEXP vol.2〜vol.3 仮面ライダーゼロノスVF〜仮面ライダー新1号）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-2
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_2.html。RK-169 欄・RK-089 欄・RK-096 欄の RK-169 の Q&A）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）・atwiki/page-1413（置き換え）
 *  3. docs/rules/*.md の一般ルール（R-KW-RESIST、R-KW-TAG-01、R-ADD-06 等）・atwiki のコメント欄（コミュニティ Q&A）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア／レア／スーパーレア」を N／NR／R／SR として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-170 ※タッグ（常駐は2枚まで）— rulesSpec/07-perm-tag-other.test.ts R-KW-TAG-01
 *  - RK-089 Q1・Q2（乗車拒否で6枚から9枚）— cardSpec/RK5-085-105.a.test.ts RK-089（本バッチで it.todo から実テストにした）
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import { KW } from "../rulesSpec/07-helpers";
import {
  PLAIN_VEHICLE,
  act,
  attack,
  attackUntilRegister,
  bpOf,
  canConfirm,
  canSkip,
  canStartRush,
  cardIn,
  chargePower,
  choiceIds,
  confirm,
  damageOf,
  deckCards,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectStats,
  faceDown,
  faceUp,
  fill,
  inst,
  legal,
  p1Battle,
  passEntry,
  pick,
  playOp,
  powerCards,
  rcRideOff,
  registerOffered,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  st,
  sUnit,
  targetsOf,
  toPhase,
  zoneOf,
} from "./RK9-169-189.helpers";

const KW_MORPH = KW.morph;
const MORPH = sUnit("SPEC-MORPH", { bp: 2000, powerCost: 1, features: ["仮面ライダー", "男"], text: KW_MORPH } as never);
const MORPH_T = sUnit("SPEC-MORPH-T", { bp: 6000, powerCost: 5, features: ["仮面ライダー", "男"] });
const ENEMY = sUnit("SPEC-ENEMY", { category: "WB", bp: 1000, powerCost: 1 });
/** ミラーモンスター（本来の特徴）。 */
const MM = sUnit("SPEC-MM", { category: "WB", bp: 1000, powerCost: 1, features: ["ミラーモンスター", "獣"] });
/** 特徴「ミラーモンスター」を持たないユニット。 */
const NOT_MM = sUnit("SPEC-NOT-MM", { category: "WB", bp: 1000, powerCost: 1, features: ["獣"] });
/** ミラーライダー（本来の特徴）。 */
const MR = sUnit("SPEC-MR", { category: "WB", bp: 1000, powerCost: 1, features: ["仮面ライダー", "ミラーライダー"] });
const ATK3 = sUnit("SPEC-ATK3", { bp: 9000, powerCost: 3 });
const ATK7 = sUnit("SPEC-ATK7", { bp: 9000, powerCost: "7+" as never, size: "L" });
const C1 = sUnit("SPEC-C1", { bp: 1000, powerCost: 1 });
const C3 = sUnit("SPEC-C3", { bp: 1000, powerCost: 3 });
const C5 = sUnit("SPEC-C5", { bp: 1000, powerCost: 5 });
const OP2 = { id: "SPEC-OP2", name: "SPEC-OP2", type: "operation", category: "WB", rarity: "N", expansion: "card-spec", powerCost: 2 } as never;
const OP4 = { id: "SPEC-OP4", name: "SPEC-OP4", type: "operation", category: "WB", rarity: "N", expansion: "card-spec", powerCost: 4 } as never;
const SCRUM1 = sUnit("SPEC-SCRUM1", { bp: 1000, comboNumber: 1, text: KW.scrum } as never);
const CN2 = sUnit("SPEC-CN2", { bp: 1000, comboNumber: 2 });
const BIG = sUnit("SPEC-BIG", { bp: 13000, powerCost: 3 });
const CHASER = sUnit("SPEC-CHASER", { bp: 2000, comboNumber: "RC", text: KW.chase } as never);
const EXTRA = [PLAIN_VEHICLE, MORPH, MORPH_T, ENEMY, MM, NOT_MM, MR, ATK3, ATK7, C1, C3, C5, OP2, OP4, SCRUM1, CN2, BIG, CHASER];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
/** 敵軍（player2）のターンの盤面。 */
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
/** 自軍（player1）ラッシュフェイズの盤面。 */
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
/** 自軍（player1）チャージフェイズの盤面。 */
const chargePhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "charge", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("RK-169 仮面ライダーゼロノスVF", () => {
  const TEXT =
    "合体―仮面ライダーゼロノスAF＋デネブ ※レジスト(これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい) 【グランドストライク】これが自軍エリアにある間、自軍パワーゾーンのカードが8枚になったとき、次の効果を発動できる⇒相手に1点ダメージを与える。";

  it("RK-169: カタログ本文・スペックが出典と一致（出典: atwiki/page-683）", () => {
    expectCatalogText("RK-169", TEXT);
    expectStats("RK-169", { name: "仮面ライダーゼロノスVF", category: "OT", size: "S", bp: 6000, sp: 1, powerCost: "4+", features: ["仮面ライダー", "男"], rushCondition: "discard_fusion_unit" });
    expectRarityIn("RK-169", ["R"]);
  });

  it("RK-169: ※レジスト — バトルで撃破されたとき、ホールドしてその場に留められる（出典: atwiki/page-683「※レジスト」）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("RK-169", "vf")] }, "RK-169:vf"))).toBe(true);
  });

  const rushBoard = (rush: ReturnType<typeof inst>[], power = 4) =>
    rushPhase({ hand: [inst("RK-169", "vf")], rush, command: releasedCat("OT", 1), power: powerCards(power) });

  it("RK-169: 追加条件（合体）— 仮面ライダーゼロノスAF とデネブを自軍エリアから捨札にし、パワー4でラッシュできる（出典: atwiki/page-683「合体―仮面ライダーゼロノスAF＋デネブ」「必要パワー：4+」・R-ADD-06）", () => {
    const r = rushFromHand(rushBoard([inst("RK-139", "af"), inst("RK-146", "dn")]), "player1", "RK-169:vf");
    expect(r.ok, r.error).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RK-169:vf")).toBe("rush");
    expect(zoneOf(s, "player1", "RK-139:af")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-146:dn")).toBe("discard");
  });

  it("RK-169: 合体のユニットが1体でも足りなければラッシュできない（出典: atwiki/page-683・R-ADD-06）", () => {
    expect(canStartRush(rushBoard([inst("RK-139", "af")]), "player1", "RK-169:vf")).toBe(false);
  });

  // 「自軍パワーゾーンのカードが8枚になったとき、次の効果を発動できる⇒相手に1点ダメージを与える」
  const charged = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    chargePower(chargePhase({ rush: [inst("RK-169", "vf")], hand: [inst("TST-OP", "h")], power: powerCards(7), ...p1 }, { power: powerCards(3, "ep"), ...p2 }), "TST-OP:h");

  it("RK-169: 【グランドストライク】自軍パワーゾーンのカードが7枚から8枚になったとき、発動するかを選べる（任意）（出典: atwiki/page-683「8枚になったとき、次の効果を発動できる」）", () => {
    const s = charged();
    expect(s.players.player1.power).toHaveLength(8);
    expectChoiceFrom(s, "player1", "RK-169");
    expect(canConfirm(s)).toBe(true);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-169: 【グランドストライク】発動すると相手に1点ダメージを与える（出典: atwiki/page-683「相手に1点ダメージを与える」）", () => {
    const s = settle(confirm(charged()));
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RK-169: 【グランドストライク】発動しなければダメージはない（出典: atwiki/page-683「発動できる」）", () => {
    const s = settle(skip(charged()));
    expect(damageOf(s, "player2")).toBe(0);
  });

  it("RK-169: 【グランドストライク】8枚から9枚になったときは発動しない（出典: atwiki/page-683「8枚になったとき」）", () => {
    const s = charged({ power: powerCards(8) });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-169");
  });

  it("RK-169: 【グランドストライク】自軍エリアになければ（手札）発動しない（出典: atwiki/page-683「これが自軍エリアにある間」）", () => {
    const s = charged({ rush: [], hand: [inst("TST-OP", "h"), inst("RK-169", "vf")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-169");
  });

  it("RK-169: 【グランドストライク】相手のパワーゾーンが8枚になっても発動しない（出典: atwiki/page-683「自軍パワーゾーンのカードが」）", () => {
    const s = charged({ rush: [] }, { rush: [inst("RK-169", "evf")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-169");
  });

  it("RK-169: 【グランドストライク】2体あればそれぞれ発動し、2点ダメージを与えられる（出典: atwiki/page-683 カード評価「効果は重複する」）", () => {
    let s = charged({ rush: [inst("RK-169", "vf"), inst("RK-169", "vf2")] });
    expectChoiceFrom(s, "player1", "RK-169");
    s = settle(confirm(s));
    expectChoiceFrom(s, "player1", "RK-169");
    s = settle(confirm(s));
    expect(damageOf(s, "player2")).toBe(2);
  });

  // faq-rider-2 RK-169 Q「はい、発動します。すべてのカード操作は、同時に複数枚に対して行う場合でも、1枚ごとに実行しているものとして扱います。」
  it("RK-169: 公式Q&A — パワーゾーン9枚のとき RS-043 パトストライカー【ジャッジメントソード】で2枚捨札にすると、8枚の状態を経過したとして発動する（出典: grnrngr/faq-rider-2 RK-169 Q・atwiki/page-683 Q1）", () => {
    let s = board({ rush: [inst("RS-043", "pa"), inst("RK-169", "vf")], power: powerCards(9) }, { power: powerCards(3, "ep") });
    s = enter(s, "RS-043:pa");
    expectChoiceFrom(s, "player1", "RS-043");
    s = pick(pick(s, "TST-P:pw0"), "TST-P:pw1");
    expect(s.players.player1.power).toHaveLength(7);
    expectChoiceFrom(s, "player1", "RK-169");
    s = settle(confirm(s));
    expect(damageOf(s, "player2")).toBe(1);
  });

  // atwiki/page-683 Q2「いいえ、発動しません。《モーフ》による置き換えはカードの移動が同時に行われるため、パワーゾーンのカードの増減は起こらないものとし…」
  it("RK-169: 公式Q&A — パワーゾーン8枚のとき、モーフでパワーゾーンのカードと置き換えても発動しない（出典: atwiki/page-683 Q2・atwiki/page-1413「枚数の変化は起こっていないものとして扱う」）", () => {
    // player1 のラッシュに、player2 のモーフ持ちがパワーゾーンのカードと置き換える（player2 のパワーゾーンは8枚のまま）。
    let s = rushPhase(
      { hand: [inst("SPEC-ENEMY", "e")], command: releasedCat("WB", 1), power: powerCards(3) },
      { rush: [inst("RK-169", "evf"), inst("SPEC-MORPH", "m")], power: [...powerCards(7, "ep"), faceUp("SPEC-MORPH-T", "t")] },
    );
    const r = rushFromHand(s, "player1", "SPEC-ENEMY:e");
    expect(r.ok, r.error).toBe(true);
    s = r.state;
    expect(s.pendingEffectChoice?.effectId).toBe("morph_replacement");
    s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "SPEC-MORPH-T:t" });
    expect(zoneOf(s, "player2", "SPEC-MORPH:m")).toBe("power");
    expect(s.players.player2.power).toHaveLength(8);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-169");
  });

  it.todo(
    "RK-169: 1回の処理の中で8枚を2回経過するとき（7枚で XG のジェットデルタをラッシュし、追加条件でパワーに送ってからラッシュ時の効果でパワーを捨札にする）は2回発動する（出典: atwiki/page-683 カード評価）— ジェットデルタは本範囲外のカード",
  );
  it.todo(
    "RK-169: パワー9枚から仮面ライダーディケイドCF の効果でパワーからラッシュしても発動しない（出典: atwiki/page-683 コメント欄の回答）— ディケイドCF は本範囲外のカードで、回答の理由（「使用した段階でパワーが8」）も公式 Q（1枚ごとに経過）と食い違って見えるため照合しない",
  );
});

// ===========================================================================
describe("RK-170 プロジェクトG4", () => {
  const TEXT =
    "※常駐 ※タッグ（これは他の自軍常駐と合わせて2枚まで配置でき、太字部分を実行するかわりに、他の自軍常駐の太字部分を実行できる） 自軍エンドフェイズ中、自軍バトルエリアに特徴「メカ」を持つユニットがあれば、『MAを持つ自軍コマンドを1つホールドする』を実行してもよい。そうしたとき、自軍バトルエリアから特徴「メカ」を持つSユニットを1体選び、自軍ラッシュエリアに戻す。";

  it("RK-170: カタログ本文・スペックが出典と一致（出典: atwiki/page-905）", () => {
    expectCatalogText("RK-170", TEXT);
    expectOpStats("RK-170", { name: "プロジェクトG4", category: "ET", powerCost: 2 });
    expectRarityIn("RK-170", ["N"]);
  });

  it("RK-170: ※常駐 — 使うと常駐置き場に置かれる（出典: atwiki/page-905「※常駐」・R-KW-PERM-01）", () => {
    const r = playOp(rushPhase({ hand: [inst("RK-170", "g4")], command: releasedCat("ET", 1), power: powerCards(2) }), "player1", "RK-170:g4");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "RK-170:g4")).toBe("operation");
  });

  it.todo(
    "RK-170: 自軍エンドフェイズ中、自軍バトルエリアに特徴「メカ」を持つユニットがあれば、MA の自軍コマンドを1つホールドして、自軍バトルエリアの特徴「メカ」の S ユニットを1体ラッシュエリアに戻せる（何度でも。コメント欄「太字部分の実行さえ出来れば可能」）（出典: atwiki/page-905）— ※タッグの常駐の扱いがユーザー確認中のため、常駐自身の効果を足していない（docs/verification/review-items-2026-10.md B-11）",
  );
  it.todo(
    "RK-170: 呉越同舟（RS-524）とのタッグで、太字部分のかわりに呉越同舟の太字部分（手札を1枚見せる）を実行して特徴「メカ」の S ユニットを戻す「プロジェクト呉越」（出典: atwiki/page-905 カード評価・コメント欄）— 上と同じく ※タッグの常駐の扱いがユーザー確認中のため",
  );
});

// ===========================================================================
describe("RK-171 コントラクト", () => {
  const TEXT =
    "本来の特徴に「ミラーライダー」を持つ自軍ユニットを1体選ぶ。このターン、選んだユニットは、指定されたユニットからコンビネーションしたときに発動できる効果名を持つ効果を、指定されたユニットのかわりに、本来の特徴に「ミラーモンスター」を持つユニットからコンビネーションすれば、その効果を発動できる。";

  it("RK-171: カタログ本文・スペックが出典と一致（出典: atwiki/page-902）", () => {
    expectCatalogText("RK-171", TEXT);
    expectOpStats("RK-171", { name: "コントラクト", category: "WB", powerCost: 0 });
    expect(cardIn(st({ player1: { hand: [inst("RK-171", "c")] } }), "player1", "RK-171:c")).toBeDefined();
    expectRarityIn("RK-171", ["N"]);
  });

  const used = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) => {
    const r = playOp(rushPhase({ hand: [inst("RK-171", "c")], command: releasedCat("WB", 1), ...p1 }, p2), "player1", "RK-171:c");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("RK-171: 本来の特徴に「ミラーライダー」を持つ自軍ユニットだけから1体選ぶ（ラッシュエリア・バトルエリア。敵軍・ミラーライダーでないものは対象外。選ばないことはできない）（出典: atwiki/page-902「本来の特徴に「ミラーライダー」を持つ自軍ユニットを1体選ぶ」）", () => {
    const s = used({ rush: [inst("RK-067", "kn"), inst("SPEC-MM", "mm")], battle: [inst("SPEC-MR", "mr")] }, { rush: [inst("RK-038", "eg")] });
    expectChoiceFrom(s, "player1", "RK-171");
    expect(choiceIds(s)).toEqual(["RK-067:kn", "SPEC-MR:mr"]);
    expect(canSkip(s)).toBe(false);
  });

  /** コントラクトをナイト（RK-067）に使い、バトルフェイズに partner → ナイトの順に出す（ナイトの進入直後の状態）。 */
  const knightAfter = (partner: string, contract = true) => {
    let s = contract
      ? pick(used({ rush: [inst("RK-067", "kn"), inst(partner, "p")] }), "RK-067:kn")
      : rushPhase({ rush: [inst("RK-067", "kn"), inst(partner, "p")] });
    s = toPhase(settle(s), "player1", "battle");
    s = passEntry(enter(s, `${partner}:p`));
    return enter(s, "RK-067:kn");
  };

  it("RK-171: このターン、選んだユニット（RK-067 仮面ライダーナイト）は、「ダークウイング」のかわりに本来の特徴に「ミラーモンスター」を持つユニットからコンビネーションしても【飛翔斬】を発動できる（出典: atwiki/page-902・カード評価「ミラーモンスターであれば何であっても能力が発動できるようになる」）", () => {
    const s = knightAfter("SPEC-MM");
    expectChoiceFrom(s, "player1", "RK-067");
  });

  it("RK-171: コントラクトを使っていなければ、ダークウイング以外のミラーモンスターからでは【飛翔斬】は発動しない（出典: RK-067 本文「「ダークウイング」からコンビネーションしたとき発動できる」）", () => {
    const s = knightAfter("SPEC-MM", false);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-067");
  });

  it("RK-171: 本来の特徴に「ミラーモンスター」を持たないユニットからのコンビネーションでは発動しない（出典: atwiki/page-902「本来の特徴に「ミラーモンスター」を持つユニットからコンビネーションすれば」）", () => {
    const s = knightAfter("SPEC-NOT-MM");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-067");
  });

  it("RK-171: 選んでいない別のミラーライダーには効かない（出典: atwiki/page-902「選んだユニットは」）", () => {
    let s = pick(used({ rush: [inst("RK-067", "kn"), inst("SPEC-MR", "mr"), inst("SPEC-MM", "p"), inst("RK-067", "kn2")] }), "SPEC-MR:mr");
    s = toPhase(settle(s), "player1", "battle");
    s = passEntry(enter(s, "SPEC-MM:p"));
    s = enter(s, "RK-067:kn");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-067");
  });

  it("RK-171: 特徴で指定されたユニット（RK-033 仮面ライダー龍騎「特徴「ドラゴン」を持つユニットから」）も、ミラーモンスターから SP1 を得る（出典: atwiki/page-902「指定されたユニットからコンビネーションしたときに発動できる効果名を持つ効果」・カード評価「ドラグレッダーなどの補助効果が高いミラーモンスターとコンビネーションしたい場合」）", () => {
    let s = pick(used({ rush: [inst("RK-033", "ry"), inst("SPEC-MM", "p")] }), "RK-033:ry");
    s = toPhase(settle(s), "player1", "battle");
    s = passEntry(enter(s, "SPEC-MM:p"));
    s = enter(s, "RK-033:ry");
    expect(legal(s).some((a) => a.type === "strike" && a.instanceId === "RK-033:ry")).toBe(true);
  });
});

// ===========================================================================
describe("RK-172 ルリオオカミ", () => {
  const TEXT =
    "※カウンター これは自軍ユニットがアタックされたとき発動できる⇒自軍山札の上から3枚オモテにする。そして、オモテにしたカードの中から、アタックしてきたユニットの必要パワーの数字以上の必要パワーの数字を持つカードをすべて自分の手札に加え、それ以外は山札に戻してシャッフルする。この効果で1枚以上のカードを手札に加えたなら、そのバトルは行われない。";

  it("RK-172: カタログ本文・スペックが出典と一致（出典: atwiki/page-906）", () => {
    expectCatalogText("RK-172", TEXT);
    expectOpStats("RK-172", { name: "ルリオオカミ", category: "MA", powerCost: 5 });
    expectRarityIn("RK-172", ["N"]);
  });

  /** 敵軍ターン、player2 の attacker が player1 の TST-UNIT-0:t にアタックした直後（反応窓）。 */
  const attacked = (deck: ReturnType<typeof inst>[], attacker = "SPEC-ATK3") => {
    const s = enemyTurn(
      { battle: [inst("TST-UNIT-0", "t")], hand: [inst("RK-172", "rw")], command: releasedCat("MA", 1), power: powerCards(5), deck },
      { battle: [inst(attacker, "atk")] },
    );
    return attack(s, `${attacker}:atk`, "TST-UNIT-0:t", "player2");
  };
  const use = (s: GameState) => {
    const a = legal(s).find((x) => x.playerId === "player1" && ((x.type === "play_counter" && x.instanceId === "RK-172:rw") || (x.type === "initiate_command_payment" && "sourceInstanceId" in x && x.sourceInstanceId === "RK-172:rw")));
    expect(a, "ルリオオカミが使えない").toBeDefined();
    return act(s, a!);
  };
  const DECK = [inst("SPEC-C1", "d1"), inst("SPEC-C3", "d3"), inst("SPEC-OP4", "d4"), inst("SPEC-C5", "d5")];

  it("RK-172: ※カウンター — 敵軍ターン中、自軍ユニットがアタックされたとき使える（出典: atwiki/page-906「これは自軍ユニットがアタックされたとき発動できる」）", () => {
    const s = attacked(DECK);
    expect(legal(s).some((a) => a.playerId === "player1" && ((a.type === "play_counter" && a.instanceId === "RK-172:rw") || (a.type === "initiate_command_payment" && "sourceInstanceId" in a && a.sourceInstanceId === "RK-172:rw")))).toBe(true);
  });

  it("RK-172: 山札の上から3枚をオモテにし、アタックしてきたユニットの必要パワーの数字（3）以上のカード（オペレーションを含む）をすべて手札に加え、残りは山札に戻す（出典: atwiki/page-906「アタックしてきたユニットの必要パワーの数字以上の必要パワーの数字を持つカードをすべて自分の手札に加え、それ以外は山札に戻してシャッフルする」）", () => {
    const s = resolveAll(use(attacked(DECK)));
    expect(zoneOf(s, "player1", "SPEC-C3:d3")).toBe("hand");
    expect(zoneOf(s, "player1", "SPEC-OP4:d4")).toBe("hand");
    expect(zoneOf(s, "player1", "SPEC-C1:d1")).toBe("deck");
    expect(zoneOf(s, "player1", "SPEC-C5:d5")).toBe("deck");
    expect(s.players.player1.deck).toHaveLength(2);
  });

  it("RK-172: 1枚以上手札に加えたなら、そのバトルは行われない（アタックされたユニットは撃破されない）（出典: atwiki/page-906「この効果で1枚以上のカードを手札に加えたなら、そのバトルは行われない」）", () => {
    const s = resolveAll(use(attacked(DECK)));
    expect(zoneOf(s, "player1", "TST-UNIT-0:t")).toBe("battle");
    expect(zoneOf(s, "player1", "RK-172:rw")).toBe("discard");
  });

  it("RK-172: 1枚も手札に加えなければ、オモテにしたカードは山札に戻り、バトルは行われる（出典: atwiki/page-906・カード評価「一枚も手札を増やせずにバトルも続行という結果になりかねない」）", () => {
    const s = resolveAll(use(attacked([inst("SPEC-C1", "d1"), inst("SPEC-OP2", "d2"), inst("SPEC-C3", "d3"), inst("SPEC-C5", "d5")], "SPEC-ATK7")));
    expect(s.players.player1.deck).toHaveLength(4);
    expect(zoneOf(s, "player1", "TST-UNIT-0:t")).toBe("discard");
  });

  it("RK-172: 必要パワー「7+」のユニットにアタックされたときは、必要パワーの数字7以上のカードだけを手札に加える（出典: atwiki/page-906「必要パワーの数字」）", () => {
    const s = resolveAll(use(attacked([inst("SPEC-C5", "d5"), inst("SPEC-ATK7", "d7"), inst("SPEC-C1", "d1")], "SPEC-ATK7")));
    expect(zoneOf(s, "player1", "SPEC-ATK7:d7")).toBe("hand");
    expect(zoneOf(s, "player1", "SPEC-C5:d5")).toBe("deck");
    expect(zoneOf(s, "player1", "TST-UNIT-0:t")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-173 鬼の鎧", () => {
  const TEXT =
    "自軍Sユニットを選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。このカードに重ねたユニットは、敵軍ターン中、リリース状態の自軍コマンド1つにつきBP+1000される。重ねたユニットがユニットでなくなるとき、このカードは捨札になる。";

  it("RK-173: カタログ本文・スペックが出典と一致（出典: atwiki/page-907）", () => {
    expectCatalogText("RK-173", TEXT);
    expectOpStats("RK-173", { name: "鬼の鎧", category: "MA", powerCost: 1 });
    expectRarityIn("RK-173", ["N"]);
  });

  const armored = (p1: Partial<GameState["players"]["player1"]> = {}) => {
    const r = playOp(rushPhase({ hand: [inst("RK-173", "oy")], rush: [inst("TST-UNIT-0", "u"), inst("TST-UNIT-2", "m")], command: releasedCat("MA", 1), power: powerCards(1), ...p1 }), "player1", "RK-173:oy");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("RK-173: 自軍 S ユニットだけから1体選ぶ（M ユニットは対象外。選ばないことはできない）（出典: atwiki/page-907「自軍Sユニットを選ぶ」）", () => {
    const s = armored();
    expectChoiceFrom(s, "player1", "RK-173");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:u"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-173: 選んだユニットをこのカードに重ねる（鬼の鎧はユニットの下に置かれ、捨札にならない）（出典: atwiki/page-907「このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる」・RK-013 Jパワーと同じ扱い）", () => {
    const s = settle(pick(armored(), "TST-UNIT-0:u"));
    expect((cardIn(s, "player1", "TST-UNIT-0:u")?.stackedCards ?? []).map((c) => c.cardId)).toEqual(["RK-173"]);
    expect(zoneOf(s, "player1", "RK-173:oy")).toBeNull();
  });

  /** 鬼の鎧を重ねたユニット（バトルエリア）と、player1 のコマンド。 */
  const withArmor = (activePlayer: "player1" | "player2", command = releasedCat("MA", 3), count = 1) => {
    const stacked = Array.from({ length: count }, (_, i) => inst("RK-173", `oy${i}`));
    return st({ activePlayer, player1: { battle: [{ ...inst("TST-UNIT-0", "u"), stackedCards: stacked }], command, deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }, EXTRA);
  };

  it("RK-173: 重ねたユニットは、敵軍ターン中、リリース状態の自軍コマンド1つにつき BP+1000 される（出典: atwiki/page-907「敵軍ターン中、リリース状態の自軍コマンド1つにつきBP+1000される」）", () => {
    const s = withArmor("player2", [...releasedCat("MA", 2), { ...inst("TST-OP", "h"), commandHeld: true }]);
    expect(bpOf(s, "player1", "TST-UNIT-0:u")).toBe(3000);
  });

  it("RK-173: 自軍ターン中は BP が上がらない（出典: atwiki/page-907「敵軍ターン中」）", () => {
    const s = withArmor("player1");
    expect(bpOf(s, "player1", "TST-UNIT-0:u")).toBe(1000);
  });

  it("RK-173: 1体のユニットに2枚重ねると、効果も2つ分になる（出典: atwiki/page-907 コメント欄「つけられる」）", () => {
    const s = withArmor("player2", releasedCat("MA", 2), 2);
    expect(bpOf(s, "player1", "TST-UNIT-0:u")).toBe(5000);
  });

  it("RK-173: 重ねたユニットがユニットでなくなる（撃破される）とき、このカードは捨札になる（出典: atwiki/page-907「重ねたユニットがユニットでなくなるとき、このカードは捨札になる」）", () => {
    let s = st({ activePlayer: "player2", player1: { battle: [{ ...inst("TST-UNIT-0", "u"), stackedCards: [inst("RK-173", "oy")] }], deck: deckCards(3) }, player2: { battle: [inst("SPEC-BIG", "atk")], deck: deckCards(3, "e") } }, EXTRA);
    s = resolveAll(attack(s, "SPEC-BIG:atk", "TST-UNIT-0:u", "player2"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:u")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-173:oy")).toBe("discard");
  });

  // atwiki/page-907 Q1（= atwiki/page-1350 Q1）「…ターンプレイヤーの任意の順番で解決して下さい。なお、「RK-250 サバイブ」の効果を先に解決した場合、
  // そのユニットは場に留まることになり…「RK-173 鬼の鎧」の「ユニットでなくなるとき」の効果は解決できなくなります。」
  it.fails("RK-173: 公式Q&A — 鬼の鎧と RK-250 サバイブを重ねたユニットがユニットでなくなるとき、ターンプレイヤーが処理順を選び、サバイブを先に解決すると留まるので鬼の鎧は捨札にならない（出典: atwiki/page-907 Q1）", () => {
    let s = st({ activePlayer: "player2", player1: { battle: [{ ...inst("TST-UNIT-0", "u"), stackedCards: [inst("RK-173", "oy"), inst("RK-250", "sv")] }], deck: deckCards(3) }, player2: { battle: [inst("SPEC-BIG", "atk")], deck: deckCards(3, "e") } }, EXTRA);
    s = settle(attack(s, "SPEC-BIG:atk", "TST-UNIT-0:u", "player2"));
    expectChoiceFrom(s, "player2", "RK-250");
    s = resolveAll(pick(s, "RK-250:sv"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:u")).toBe("battle");
    expect((cardIn(s, "player1", "TST-UNIT-0:u")?.stackedCards ?? []).map((c) => c.instanceId)).toEqual(["RK-173:oy"]);
    expect(zoneOf(s, "player1", "RK-250:sv")).toBe("discard");
  });
});

// ===========================================================================
describe("RK-174 プットオン", () => {
  const TEXT =
    "カード名に「RF（ライダーフォーム）」を含む自軍ユニットを1体選び、手札に戻してもよい。そうしたとき、自軍パワーゾーンのオモテ向きのカードから、カード名に「MF（マスクドフォーム）」を含むユニットカードを1枚選び、自軍ラッシュエリアに出す。その後、このカードを自軍パワーゾーンに置く。";

  it("RK-174: カタログ本文・スペックが出典と一致（出典: atwiki/page-908）", () => {
    expectCatalogText("RK-174", TEXT);
    expectOpStats("RK-174", { name: "プットオン", category: "OT", powerCost: 3 });
    expectRarityIn("RK-174", ["N"]);
  });

  const putOn = (p1: Partial<GameState["players"]["player1"]> = {}) => {
    const r = playOp(
      rushPhase({
        hand: [inst("RK-174", "po")],
        rush: [inst("RK-054", "grf"), inst("RK-053", "gmf")],
        battle: [inst("RK-057", "zrf")],
        command: releasedCat("OT", 1),
        power: [faceUp("RK-056", "zmf"), faceUp("RK-053", "gmf2"), faceDown("RK-070", "kmf"), ...powerCards(1)],
        ...p1,
      }),
      "player1",
      "RK-174:po",
    );
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };

  it("RK-174: カード名に「RF」を含む自軍ユニット（ラッシュエリア・バトルエリア）だけから選ぶ（任意）（出典: atwiki/page-908「カード名に「RF（ライダーフォーム）」を含む自軍ユニットを1体選び、手札に戻してもよい」）", () => {
    const s = putOn();
    expectChoiceFrom(s, "player1", "RK-174");
    expect(choiceIds(s)).toEqual(["RK-054:grf", "RK-057:zrf"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-174: 戻したら、自軍パワーゾーンのオモテ向きの「MF」を含むユニットカードから1枚選ぶ（ウラ向きは対象外。戻した RF と別のライダーでもよい）（出典: atwiki/page-908・カード評価「同じユニットのものでなくてもいい」）", () => {
    const s = pick(putOn(), "RK-057:zrf");
    expect(zoneOf(s, "player1", "RK-057:zrf")).toBe("hand");
    expectChoiceFrom(s, "player1", "RK-174");
    expect(choiceIds(s)).toEqual(["RK-053:gmf2", "RK-056:zmf"]);
  });

  it("RK-174: 選んだ MF のカードを自軍ラッシュエリアに出し、その後このカードを自軍パワーゾーンに置く（パワーゾーンの枚数は減らない）（出典: atwiki/page-908「自軍ラッシュエリアに出す。その後、このカードを自軍パワーゾーンに置く」・カード評価「パワーの減少はない」）", () => {
    const s = resolveAll(pick(pick(putOn(), "RK-057:zrf"), "RK-053:gmf2"));
    expect(zoneOf(s, "player1", "RK-053:gmf2")).toBe("rush");
    expect(zoneOf(s, "player1", "RK-174:po")).toBe("power");
    expect(s.players.player1.power).toHaveLength(4);
  });

  it("RK-174: RF を戻さなければ効果はそこで終わり、このカードはパワーゾーンに置かれない（出典: atwiki/page-908 コメント欄「ユーザーレベルFAQの確認済みの項…オペの空打ちになり、途中で効果が終わる」）", () => {
    const s = resolveAll(skip(putOn()));
    expect(zoneOf(s, "player1", "RK-174:po")).toBe("discard");
    expect(s.players.player1.power).toHaveLength(4);
  });
});

// ===========================================================================
describe("RK-175 仮面ライダー新1号", () => {
  const TEXT =
    "※これは「仮面ライダー1号」としてつかえる。 【ライダーキック】このターン、敵軍ユニットのレジストとスクラムとチェイスの効果は無効になる。また、これがアタックしなかったとき、このユニットの次にコンビネーションするSユニットのBPは、このユニットのBPを「＋」した値になる。";

  it("RK-175: カタログ本文・スペックが出典と一致（出典: atwiki/page-1084）", () => {
    expectCatalogText("RK-175", TEXT);
    expectStats("RK-175", { name: "仮面ライダー新1号", category: "ET", size: "S", bp: 4000, sp: "1/5", powerCost: 5, comboNumber: "RC", features: ["仮面ライダー", "男", "改造人間"] });
    expectRarityIn("RK-175", ["R"]);
  });

  /** 新1号がライドオフして RC を発動した直後（バトル進入のウィンドウ）。 */
  const rc = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    settle(rcRideOff(board({ ...p1, rush: [inst("RK-175", "s1"), inst("SPEC-VEHICLE", "v"), ...(p1.rush ?? [])] }, p2), "RK-175:s1", "SPEC-VEHICLE:v"));

  it("RK-175: RC — このターン、敵軍ユニットのレジストは無効になる（撃破された敵軍のレジスト持ちはホールドして留まれない）（出典: atwiki/page-1084「このターン、敵軍ユニットのレジスト…の効果は無効になる」）", () => {
    let s = rc({}, { battle: [inst("RK-186", "j")] });
    s = attack(s, "RK-175:s1", "RK-186:j");
    expect(registerOffered(s, "player2")).toBe(false);
    s = resolveAll(s);
    expect(zoneOf(s, "player2", "RK-186:j")).toBe("discard");
  });

  it("RK-175: RC を発動していなければ、敵軍のレジストは使える（出典: R-KW-RESIST・atwiki/page-1084）", () => {
    let s = board({ rush: [inst("RK-175", "s1")] }, { battle: [inst("RK-186", "j")] });
    s = attack(enter(s, "RK-175:s1"), "RK-175:s1", "RK-186:j");
    expect(registerOffered(s, "player2")).toBe(true);
  });

  it("RK-175: RC — このターン、敵軍ユニットのスクラムは無効になる（CN が1多いユニットが次に並んでいてもアタックできる）（出典: atwiki/page-1084「スクラム…の効果は無効になる」・R-KW-SCRUM-01）", () => {
    const enemy = { battle: [inst("SPEC-SCRUM1", "sc"), inst("SPEC-CN2", "cn")] };
    expect(targetsOf(rc({}, enemy), "RK-175:s1")).toContain("SPEC-SCRUM1:sc");
    const plain = enter(board({ rush: [inst("RK-175", "s1")] }, enemy), "RK-175:s1");
    expect(targetsOf(plain, "RK-175:s1")).not.toContain("SPEC-SCRUM1:sc");
  });

  it("RK-175: RC — これがアタックしなかったとき、次にコンビネーションする S ユニットの BP は「そのユニットの BP＋新1号の BP」になる（出典: atwiki/page-1084「このユニットの次にコンビネーションするSユニットのBPは、このユニットのBPを「＋」した値になる」）", () => {
    let s = rc({ rush: [inst("TST-UNIT-0", "next")] });
    s = enter(passEntry(s), "TST-UNIT-0:next");
    expect(bpOf(s, "player1", "TST-UNIT-0:next")).toBe(5000);
  });

  it("RK-175: RC — 新1号がアタックしたときは、次のユニットの BP は変わらない（出典: atwiki/page-1084「これがアタックしなかったとき」）", () => {
    let s = rc({ rush: [inst("TST-UNIT-0", "next")] }, { battle: [inst("SPEC-ENEMY", "e")] });
    s = resolveAll(attack(s, "RK-175:s1", "SPEC-ENEMY:e"));
    s = enter(passEntry(s), "TST-UNIT-0:next");
    expect(bpOf(s, "player1", "TST-UNIT-0:next")).toBe(1000);
  });

  it("RK-175: RC — BP が上がるのは次の1体だけ（その次のユニットは変わらない）（出典: atwiki/page-1084「このユニットの次にコンビネーションするSユニット」）", () => {
    let s = rc({ rush: [inst("TST-UNIT-0", "next"), inst("TST-UNIT-0", "after")] });
    s = passEntry(enter(passEntry(s), "TST-UNIT-0:next"));
    s = enter(s, "TST-UNIT-0:after");
    expect(bpOf(s, "player1", "TST-UNIT-0:after")).toBe(1000);
  });

  it("RK-175: 「値になる」ので、その後の BP の増減は受けない（出典: atwiki/page-1084 カード評価「BPを「＋」した値になる」・atwiki/page-1000 コメント欄「新1号のテキストは値に「なる」だから変動しなくなる」・R-BP-01）", () => {
    let s = rc({ rush: [inst("TST-UNIT-0", "next")] });
    s = enter(passEntry(s), "TST-UNIT-0:next");
    const boosted = { ...s, players: { ...s.players, player1: { ...s.players.player1, battle: s.players.player1.battle.map((c) => (c.instanceId === "TST-UNIT-0:next" ? { ...c, bpModifier: -2000 } : c)) } } };
    expect(bpOf(boosted, "player1", "TST-UNIT-0:next")).toBe(5000);
  });

  it.todo(
    "RK-175: 公式Q&A — BK-001 タイフーン（1号）で、山札から新1号を「仮面ライダー1号」として選んで手札に加えられる（出典: atwiki/page-1084 Q1）— BK-001 は本範囲外のカード（「仮面ライダー1号」として使えることは RK-176 の（）書きで確かめる）",
  );
  it("RK-175: RC — このターン、敵軍ユニットのチェイスは無効になる（ライド中に撃破されても乗り換えられない）（出典: atwiki/page-1084「チェイスの効果は無効になる」・R-KW-CHASE-01）", () => {
    const chaser = { ...inst("SPEC-CHASER", "c"), mountedOnInstanceId: "SPEC-VEHICLE:ev1" };
    const enemy = { battle: [inst("SPEC-VEHICLE", "ev1"), chaser], rush: [inst("SPEC-VEHICLE", "ev2")] };
    const chaseOffered = (s: GameState) => legal(s).some((a) => a.type === "resolve_chase" && a.playerId === "player2");
    let s = rc({ rush: [inst("SPEC-BIG", "big")] }, enemy);
    s = attack(enter(passEntry(s), "SPEC-BIG:big"), "SPEC-BIG:big", "SPEC-CHASER:c");
    expect(chaseOffered(s)).toBe(false);
    let plain = board({ rush: [inst("SPEC-BIG", "big")] }, enemy);
    plain = attack(enter(plain, "SPEC-BIG:big"), "SPEC-BIG:big", "SPEC-CHASER:c");
    expect(chaseOffered(plain)).toBe(true);
  });
});
