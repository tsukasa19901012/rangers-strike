/**
 * カード別スペック: RK-085〜RK-091（ザ・マスクドライダーEXP vol.2 ガードベント〜ゾル大佐）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（RK-086 の読み替え）、grnrngr/faq-rider-2
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_2.html。RK-086・RK-087・RK-088・RK-089・RK-091 の Q&A、
 *     RK-142 欄の「イマジンとの契約を併用してください」）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md）
 *  3. docs/rules/*.md の一般ルール（R-BP-01、R-KW-COUNTER、R-TGT-01 等）・atwiki のコメント欄（コミュニティ Q&A）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「ノーマル／ノーマルレア」を N／NR として照合する。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-086 の読み替え後の本文、かわりにダメージにして1枚ドロー、1回のストライクに2枚目は使えない（Q1）
 *    — rulesSpec/08-errata.s1a-faq.test.ts R-ERR-RK086・errataCardEffects.test.ts
 *  - RK-088 Q（イマジンとの契約と J パワーを同じユニットに使うと2枚とも下に重なる）— cardSpec/RK1-001-021.b.test.ts RK-013
 *  - RK-091 Q（ラー・デウスで「戦闘員」を追加したダイナレッドはストライクの後にアタックできない）— cardSpec/RS4-201-221.a.test.ts RS-203（Q6 と同じ問い）
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  PLAIN_VEHICLE,
  act,
  attack,
  bpOf,
  canSkip,
  canUseCard,
  cardIn,
  choiceIds,
  confirm,
  deckCards,
  deckWithTen,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectOpStats,
  expectRarityIn,
  expectStats,
  inst,
  legal,
  mount,
  ncEnter,
  p1Battle,
  pick,
  played,
  powerCards,
  releasedCat,
  resolveAll,
  settle,
  skip,
  spOf,
  st,
  strike,
  sUnit,
  useCard,
  zoneIds,
  zoneOf,
} from "./RK5-085-105.helpers";

const MIRROR2 = sUnit("SPEC-MIRROR2", { category: "WB", bp: 2000, powerCost: 2, features: ["仮面ライダー", "ミラーライダー"] });
const MIRROR4P = sUnit("SPEC-MIRROR4P", { category: "WB", bp: 3000, powerCost: "4+", features: ["仮面ライダー", "ミラーライダー"] });
const KAMEN = sUnit("SPEC-KAMEN", { category: "MA", bp: 2000, powerCost: 4, features: ["仮面ライダー"] });
const ATK5 = sUnit("SPEC-ATK5", { bp: 9000, powerCost: 5 });
const E_COST1 = sUnit("SPEC-E1", { bp: 1000, powerCost: 1 });
const E_COST4 = sUnit("SPEC-E4", { bp: 4000, powerCost: 4 });
const E_COST5 = sUnit("SPEC-E5", { bp: 5000, powerCost: 5 });
const E_COST2_M = sUnit("SPEC-E2M", { bp: 3000, powerCost: 2, size: "M" });
/** 特徴「車両」を持つ M ユニット・S ユニット。 */
const TRAIN_M = sUnit("SPEC-TRAIN", { size: "M", bp: 5000, features: ["車両"] });
const CAR_S = sUnit("SPEC-CAR", { bp: 1000, features: ["車両"] });
const PLAIN_M = sUnit("SPEC-PLAIN-M", { size: "M", bp: 5000 });
/** 特徴「戦闘員」を持つ S ユニット（BP2000・3000、SP なし）と M ユニット。 */
const GRUNT2000 = sUnit("SPEC-GRUNT2000", { category: "DA", bp: 2000, sp: undefined, features: ["戦闘員"] });
const GRUNT3000 = sUnit("SPEC-GRUNT3000", { category: "DA", bp: 3000, sp: undefined, features: ["戦闘員"] });
const GRUNT_M = sUnit("SPEC-GRUNT-M", { category: "DA", bp: 2000, sp: undefined, size: "M", features: ["戦闘員"] });
const BIG = sUnit("SPEC-BIG", { bp: 13000 });
const EXTRA = [MIRROR2, MIRROR4P, KAMEN, ATK5, E_COST1, E_COST4, E_COST5, E_COST2_M, TRAIN_M, CAR_S, PLAIN_M, GRUNT2000, GRUNT3000, GRUNT_M, BIG, PLAIN_VEHICLE];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);
/** 敵軍（player2）バトルフェイズの盤面。 */
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
/** 自軍（player1）ラッシュフェイズの盤面。 */
const rushPhase = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);
/** 合法手に、指定プレイヤーが instanceId のカードを使う手があるか。 */
const usesCard = (s: GameState, playerId: "player1" | "player2", instanceId: string) =>
  legal(s).some((a) => a.playerId === playerId && JSON.stringify(a).includes(instanceId));

// ===========================================================================
describe("RK-085 ガードベント", () => {
  const TEXT =
    "※カウンター（これは敵軍ターン中にのみ使用できる） 特徴「ミラーライダー」を持つ自軍ユニットがアタックされたとき発動できる⇒そのバトルは行われない。そして、アタックされたユニットの必要パワーの数字を見て、その数字以下の必要パワーの数字を持つ敵軍ユニットを1体選び撃破する。";

  it("RK-085: カタログ本文・スペックが出典と一致（出典: atwiki/page-643）", () => {
    expectCatalogText("RK-085", TEXT);
    expectOpStats("RK-085", { name: "ガードベント", category: "WB", powerCost: 3 });
    expectRarityIn("RK-085", ["N"]);
  });

  /** 敵軍（player2）の BP9000・必要パワー5 のユニットが、自軍の defender にアタックする（反応の窓は残す）。 */
  const attacked = (defender: CardInstance, p2: Partial<GameState["players"]["player2"]> = {}, p1: Partial<GameState["players"]["player1"]> = {}) =>
    attack(
      enemyTurn(
        { battle: [defender], hand: [inst("RK-085", "gv")], command: releasedCat("WB", 1), power: powerCards(3), ...p1 },
        { battle: [inst("SPEC-ATK5", "a"), ...(p2.battle ?? [])], rush: p2.rush ?? [] },
      ),
      "SPEC-ATK5:a",
      defender.instanceId,
      "player2",
    );
  const enemyUnits = { battle: [inst("SPEC-E2M", "m"), inst("SPEC-E5", "c5")], rush: [inst("SPEC-E4", "c4"), inst("SPEC-E1", "c1")] };

  it("RK-085: 特徴「ミラーライダー」を持つ自軍ユニットがアタックされたとき使える（出典: atwiki/page-643「特徴「ミラーライダー」を持つ自軍ユニットがアタックされたとき発動できる」）", () => {
    expect(canUseCard(attacked(inst("SPEC-MIRROR4P", "d")), "player1", "RK-085:gv")).toBe(true);
  });

  it("RK-085: ミラーライダーでない自軍ユニットがアタックされたときは使えない（出典: atwiki/page-643）", () => {
    expect(canUseCard(attacked(inst("SPEC-KAMEN", "d")), "player1", "RK-085:gv")).toBe(false);
  });

  it("RK-085: 使うとそのバトルは行われない（アタックしたユニットもされたユニットも撃破されない）（出典: atwiki/page-643「そのバトルは行われない」）", () => {
    const s = resolveAll(useCard(attacked(inst("SPEC-MIRROR4P", "d")), "player1", "RK-085:gv"));
    expect(zoneOf(s, "player1", "SPEC-MIRROR4P:d")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-ATK5:a")).toBe("battle");
    expect(zoneOf(s, "player1", "RK-085:gv")).toBe("discard");
  });

  it("RK-085: そして、アタックされたユニットの必要パワーの数字（「4+」は 4）以下の敵軍ユニットを、エリア・サイズを問わず選ぶ（選ばないことはできない）（出典: atwiki/page-643「その数字以下の必要パワーの数字を持つ敵軍ユニットを1体選び撃破する」・カード評価「撃破する対象のサイズ制限が無い」）", () => {
    const s = settle(useCard(attacked(inst("SPEC-MIRROR4P", "d"), enemyUnits), "player1", "RK-085:gv"));
    expectChoiceFrom(s, "player1", "RK-085");
    expect(choiceIds(s)).toEqual(["SPEC-E1:c1", "SPEC-E2M:m", "SPEC-E4:c4"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-085: 選んだ敵軍ユニットを撃破する（出典: atwiki/page-643）", () => {
    let s = settle(useCard(attacked(inst("SPEC-MIRROR4P", "d"), enemyUnits), "player1", "RK-085:gv"));
    s = resolveAll(pick(s, "SPEC-E2M:m"));
    expect(zoneOf(s, "player2", "SPEC-E2M:m")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E4:c4")).toBe("rush");
  });

  it("RK-085: 必要パワー2のミラーライダーなら、必要パワー2以下の敵軍ユニットだけを選べる（出典: atwiki/page-643）", () => {
    const s = settle(useCard(attacked(inst("SPEC-MIRROR2", "d"), enemyUnits), "player1", "RK-085:gv"));
    expect(choiceIds(s)).toEqual(["SPEC-E1:c1", "SPEC-E2M:m"]);
  });

  it("RK-085: 撃破できる敵軍ユニットがなくても、バトルは行われない（出典: atwiki/page-643「そのバトルは行われない。そして、」）", () => {
    const s = resolveAll(useCard(attacked(inst("SPEC-MIRROR2", "d")), "player1", "RK-085:gv"));
    expect(zoneOf(s, "player1", "SPEC-MIRROR2:d")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-ATK5:a")).toBe("battle");
  });

  it.todo(
    "RK-085: 特徴「アドベントカード」を持つ（出典: atwiki/page-643「特徴：アドベントカード」）— カタログがオペレーションの特徴を持たない（全オペレーションで未収録）ため照合できない",
  );
});

// ===========================================================================
describe("RK-086 アカネタカ", () => {
  it("RK-086: スペックが出典と一致（本文は読み替え後の本文で照合済み）（出典: atwiki/page-626・grnrngr/faq-rider-2 RK-086 Q1）", () => {
    expectOpStats("RK-086", { name: "アカネタカ", category: "MA", powerCost: 0 });
    expectRarityIn("RK-086", ["N"]);
  });

  /** 自軍（player1）の SP1 のユニットがストライクする。player2 がアカネタカを持つ。 */
  const struck = (p2: Partial<GameState["players"]["player2"]>) =>
    strike(
      st(
        {
          player1: { battle: [inst("TST-UNIT-0", "st")], deck: deckCards(3) },
          player2: { hand: [inst("RK-086", "a1")], command: releasedCat("MA", 1), deck: deckCards(4, "e"), ...p2 },
        },
        EXTRA,
      ),
      "TST-UNIT-0:st",
    );

  it("RK-086: パワーゾーンにオモテ向きのカードがなく、山札の上からひいたカードをダメージにするときも使える（出典: atwiki/page-626「自軍パワーゾーンのオモテ向きのカードか自軍山札の上からひいたカードをダメージにするとき」）", () => {
    let s = struck({ power: [] });
    expect(usesCard(s, "player2", "RK-086:a1")).toBe(true);
    s = act(s, legal(s).find((a) => a.playerId === "player2" && JSON.stringify(a).includes("RK-086:a1"))!);
    s = settle(s);
    expect(zoneOf(s, "player2", "RK-086:a1")).toBe("power");
    expect(s.players.player2.damage).toBe(1);
    expect(s.players.player2.hand).toHaveLength(1);
  });

  it("RK-086: ストライク以外（効果）でダメージを受けるときは使えない（出典: atwiki/page-626「敵軍ユニットにストライクされて」・カード評価「能力でダメージを与えられた時には使えない」）", () => {
    // デカブレイク（PR-024・CN6）の NC【光速拳ライトニングフィスト】「相手に1点ダメージを与える。」
    const s = ncEnter("PR-024:db", 5, {}, { hand: [inst("RK-086", "a1")], command: releasedCat("MA", 1), power: powerCards(2) }, EXTRA);
    expect(s.pendingDamagePayment?.playerId).toBe("player2");
    expect(usesCard(s, "player2", "RK-086:a1")).toBe(false);
  });

  // grnrngr/faq-rider-2 RK-086「はい、可能です。…「RK-086アカネタカ」のカード自体をダメージにする効果ですので、ストライク以外の方法でダメージを受けたことになります。」
  it.fails("RK-086: 公式Q&A — アカネタカをダメージにしたことは「ストライク以外の方法でダメージを受けた」ことになり、仮面ライダーオーガ（RK-204）【オーガ・ストラッシュ】を発動できる（出典: grnrngr/faq-rider-2 RK-086 Q2・atwiki/page-1077 Q1）", () => {
    let s = struck({ power: [], battle: [inst("RK-204", "og")], command: [...releasedCat("MA", 1), ...releasedCat("DA", 1)] });
    s = act(s, legal(s).find((a) => a.playerId === "player2" && JSON.stringify(a).includes("RK-086:a1"))!);
    s = settle(s);
    expect(zoneOf(s, "player2", "RK-086:a1")).toBe("power");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-204");
    s = settle(act(s, s.pendingEffectChoice!.kind === "confirm" ? { type: "confirm_effect_choice", playerId: "player2" } : { type: "resolve_effect_choice", playerId: "player2", instanceId: s.pendingEffectChoice!.validInstanceIds[0]! }));
    expect(s.players.player1.damage).toBe(1);
  });
});

// ===========================================================================
describe("RK-087 ゼクトマイザー", () => {
  const TEXT =
    "敵軍ラッシュエリアにあるすべてのSユニットをバトルエリアに出してもよい（出す順番は自分が選ぶ）。その後、敵軍バトルエリアのユニットを、好きな順に並べ替える。";

  it("RK-087: カタログ本文・スペックが出典と一致（出典: atwiki/page-666）", () => {
    expectCatalogText("RK-087", TEXT);
    expectOpStats("RK-087", { name: "ゼクトマイザー", category: "OT", powerCost: 3 });
    expectRarityIn("RK-087", ["N"]);
  });

  const zecto = (p2: Partial<GameState["players"]["player2"]>) =>
    played(rushPhase({ hand: [inst("RK-087", "zm")], command: releasedCat("OT", 1), power: powerCards(3) }, p2), "RK-087:zm");

  it("RK-087: 敵軍ラッシュエリアの S ユニットをバトルエリアに出すかを選べる（任意）（出典: atwiki/page-666「出してもよい」）", () => {
    const s = zecto({ rush: [inst("SPEC-E1", "a"), inst("SPEC-E4", "b")] });
    expectChoiceFrom(s, "player1", "RK-087");
    expect(canSkip(s)).toBe(true);
  });

  it("RK-087: 出すなら、出す順番を自分が選び、敵軍ラッシュエリアの S ユニットがすべてバトルエリアに出る（M ユニットは残る）（出典: atwiki/page-666「すべてのSユニットをバトルエリアに出してもよい（出す順番は自分が選ぶ）」・コメント欄「すべて自分で出す順番を決めて、1体ずつ順々に出していきます」）", () => {
    let s = confirm(zecto({ rush: [inst("SPEC-E1", "a"), inst("SPEC-E4", "b"), inst("SPEC-E2M", "m")] }));
    expectChoiceFrom(s, "player1", "RK-087");
    expect(choiceIds(s)).toEqual(["SPEC-E1:a", "SPEC-E4:b"]);
    s = resolveAll(pick(s, "SPEC-E4:b"));
    expect(zoneOf(s, "player2", "SPEC-E1:a")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-E4:b")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-E2M:m")).toBe("rush");
  });

  it("RK-087: その後、敵軍バトルエリアのユニットを好きな順に並べ替える（出典: atwiki/page-666「その後、敵軍バトルエリアのユニットを、好きな順に並べ替える」）", () => {
    let s = confirm(zecto({ battle: [inst("SPEC-E5", "x")], rush: [inst("SPEC-E1", "a"), inst("SPEC-E4", "b")] }));
    s = pick(s, "SPEC-E4:b");
    expectChoiceFrom(s, "player1", "RK-087");
    expect(choiceIds(s)).toEqual(["SPEC-E1:a", "SPEC-E4:b", "SPEC-E5:x"]);
    s = settle(pick(pick(s, "SPEC-E1:a"), "SPEC-E5:x"));
    expect(zoneIds(s, "player2", "battle")).toEqual(["SPEC-E1:a", "SPEC-E5:x", "SPEC-E4:b"]);
    expect(zoneOf(s, "player1", "RK-087:zm")).toBe("discard");
  });

  // 公式 Q1「いいえ。否定文がもっとも優先されるルールにより、バトルエリアに出すことのできないユニットはバトルエリアに出すことはできません。」
  // 公式 Q2「可能な限り解決するようにしてください。」
  it("RK-087: 公式Q&A — 「これはバトルエリアに出られない」（タック）や「コマンドを2つホールドしなければ出られない」（クウガTF）ユニットは出せず、出せるユニットだけを出す（出典: grnrngr/faq-rider-2 RK-087 Q1・Q2）", () => {
    const s = resolveAll(confirm(zecto({ rush: [inst("RS-223", "tak"), inst("RK-104", "tf"), inst("SPEC-E1", "a")] })));
    expect(zoneOf(s, "player2", "SPEC-E1:a")).toBe("battle");
    expect(zoneOf(s, "player2", "RS-223:tak")).toBe("rush");
    expect(zoneOf(s, "player2", "RK-104:tf")).toBe("rush");
  });

  it("RK-087: 出さないことを選んでも、敵軍バトルエリアのユニットの並べ替えは行う（出典: atwiki/page-666「その後、」・コメント欄「そうしたときの絡むプットオンと違って、その後以下が独立してるから」）", () => {
    let s = skip(zecto({ battle: [inst("SPEC-E5", "x"), inst("SPEC-E4", "y")], rush: [inst("SPEC-E1", "a")] }));
    expectChoiceFrom(s, "player1", "RK-087");
    expect(choiceIds(s)).toEqual(["SPEC-E4:y", "SPEC-E5:x"]);
    s = settle(pick(s, "SPEC-E4:y"));
    expect(zoneIds(s, "player2", "battle")).toEqual(["SPEC-E4:y", "SPEC-E5:x"]);
    expect(zoneOf(s, "player2", "SPEC-E1:a")).toBe("rush");
  });

  it("RK-087: 「アタックされる以外では相手に選ばれない」ユニット（カブトRF）も、選ぶ効果ではないので出せる（出典: atwiki/page-666 コメント欄「どちらも選ぶ効果じゃないから可能」）", () => {
    const s = resolveAll(confirm(zecto({ rush: [inst("RK-065", "rf"), inst("SPEC-E1", "a")] })));
    expect(zoneOf(s, "player2", "RK-065:rf")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-E1:a")).toBe("battle");
  });

  it.todo(
    "RK-087: 出した敵軍ユニットの「バトルエリアに出たとき」の効果が発動するか（出典: atwiki/page-666 カード評価「バトルエリアに出た時に効果が発動する能力を持ったカードには注意」）— 出典はカード評価の注意書きだけで、相手のターンに効果で出たユニットの進入時の効果をどう扱うかの公式の出典がないため（エンジンは発動させない）",
  );
});

// ===========================================================================
describe("RK-088 イマジンとの契約", () => {
  const TEXT =
    "特徴「イマジン」を持たない自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。重ねたユニットが自軍エリアにある間、特徴「イマジン」を持つ自軍ユニットは、「これはバトルエリアに出たとき撃破される」と書かれていても、そのテキストは無効になる。重ねたユニットがユニットでなくなるとき、このカードは捨札になる。";

  it("RK-088: カタログ本文・スペックが出典と一致（出典: atwiki/page-710）", () => {
    expectCatalogText("RK-088", TEXT);
    expectOpStats("RK-088", { name: "イマジンとの契約", category: "DA", powerCost: 0 });
    expectRarityIn("RK-088", ["N"]);
  });

  const contract = (p1: Partial<GameState["players"]["player1"]>) =>
    played(rushPhase({ hand: [inst("RK-088", "ct")], command: releasedCat("DA", 1), ...p1 }), "RK-088:ct");

  it("RK-088: 特徴「イマジン」を持たない自軍 S ユニットを、ラッシュエリア・バトルエリアから選ぶ（イマジン・M ユニットは選べない。選ばないことはできない）（出典: atwiki/page-710「特徴「イマジン」を持たない自軍Sユニットを1体選ぶ」）", () => {
    const s = contract({ rush: [inst("TST-UNIT-0", "u"), inst("RK-142", "mo"), inst("SPEC-PLAIN-M", "m")], battle: [inst("SPEC-E1", "b")] });
    expectChoiceFrom(s, "player1", "RK-088");
    expect(choiceIds(s)).toEqual(["SPEC-E1:b", "TST-UNIT-0:u"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RK-088: このカードは選んだユニットの下に重なる（捨札にならない）（出典: atwiki/page-710「このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる」・grnrngr/faq-rider-2 RK-088 Q「そのユニットの下には…重ねる」）", () => {
    const s = resolveAll(pick(contract({ rush: [inst("TST-UNIT-0", "u"), inst("RK-142", "mo")] }), "TST-UNIT-0:u"));
    expect((cardIn(s, "player1", "TST-UNIT-0:u")?.stackedCards ?? []).map((c) => c.cardId)).toEqual(["RK-088"]);
    expect(zoneOf(s, "player1", "RK-088:ct")).toBeNull();
    expect(zoneOf(s, "player1", "TST-UNIT-0:u")).toBe("rush");
  });

  // 公式 Q（RK-142 欄）「バトルエリアに出たとき撃破されないようにするためには、「RK-088 イマジンとの契約」を併用してください。」
  const contracted = { ...inst("TST-UNIT-0", "u"), stackedCards: [inst("RK-088", "ct")] };

  it("RK-088: 重ねたユニットが自軍エリアにある間、特徴「イマジン」を持つ自軍ユニット（モモタロス）はバトルエリアに出ても撃破されない（出典: atwiki/page-710「そのテキストは無効になる」・grnrngr/faq-rider-2 RK-142 Q「「RK-088 イマジンとの契約」を併用してください」）", () => {
    const s = settle(enter(board({ rush: [contracted, inst("RK-142", "mo")] }), "RK-142:mo"));
    expect(zoneOf(s, "player1", "RK-142:mo")).toBe("battle");
  });

  it("RK-088: 契約がなければ、モモタロスはバトルエリアに出たとき撃破される（出典: atwiki/page-710・grnrngr/faq-rider-2 RK-142 Q「バトルエリアに出た時点ですぐに撃破されます」）", () => {
    const s = settle(enter(board({ rush: [inst("TST-UNIT-0", "u"), inst("RK-142", "mo")] }), "RK-142:mo"));
    expect(zoneOf(s, "player1", "RK-142:mo")).toBe("discard");
  });

  it("RK-088: 敵軍の契約は、自軍のイマジンには効かない（出典: atwiki/page-710「特徴「イマジン」を持つ自軍ユニットは」）", () => {
    const s = settle(enter(board({ rush: [inst("RK-142", "mo")] }, { rush: [{ ...inst("TST-UNIT-0", "eu"), stackedCards: [inst("RK-088", "ect")] }] }), "RK-142:mo"));
    expect(zoneOf(s, "player1", "RK-142:mo")).toBe("discard");
  });

  it("RK-088: 重ねたユニットがユニットでなくなる（撃破される）と、このカードは捨札になり、その後のイマジンは撃破される（出典: atwiki/page-710「重ねたユニットがユニットでなくなるとき、このカードは捨札になる」）", () => {
    let s = board({ battle: [contracted], rush: [inst("RK-142", "mo")] }, { battle: [inst("SPEC-BIG", "big")] });
    s = resolveAll(attack(s, "TST-UNIT-0:u", "SPEC-BIG:big"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:u")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-088:ct")).toBe("discard");
    s = settle(enter(s, "RK-142:mo"));
    expect(zoneOf(s, "player1", "RK-142:mo")).toBe("discard");
  });
});

// ===========================================================================
describe("RK-089 乗車拒否", () => {
  const TEXT =
    "次の効果を、相手、自分の順に行う。 自分自身の山札の上から3枚をオモテにして相手に見せる。その中から特徴「車両」を持つMユニットのカードをすべて自分自身のパワーゾーンに置き、それ以外は好きな順で自分自身の山札の下に戻す。";

  it("RK-089: カタログ本文・スペックが出典と一致（出典: atwiki/page-667）", () => {
    expectCatalogText("RK-089", TEXT);
    expectOpStats("RK-089", { name: "乗車拒否", category: "OT", powerCost: 1 });
    expectRarityIn("RK-089", ["N"]);
  });

  const refuse = (myDeck: CardInstance[], enemyDeck: CardInstance[]) =>
    played(rushPhase({ hand: [inst("RK-089", "jk")], command: releasedCat("OT", 1), power: powerCards(1), deck: myDeck }, { deck: enemyDeck }), "RK-089:jk");
  const ENEMY_DECK = [inst("SPEC-TRAIN", "et"), inst("TST-OP", "e1"), inst("TST-OP", "e2"), inst("TST-OP", "e3")];
  const MY_DECK = [inst("SPEC-CAR", "car"), inst("SPEC-TRAIN", "t"), inst("RK-095", "veh"), inst("TST-OP", "d3")];

  it("RK-089: まず相手が、山札の上から3枚のうち特徴「車両」を持つ M ユニットのカードを自分自身のパワーゾーンに置き、残りを山札の下に戻す順番を相手が選ぶ（出典: atwiki/page-667「次の効果を、相手、自分の順に行う」「好きな順で自分自身の山札の下に戻す」）", () => {
    const s = refuse(MY_DECK, ENEMY_DECK);
    expect(zoneOf(s, "player2", "SPEC-TRAIN:et")).toBe("power");
    expectChoiceFrom(s, "player2", "RK-089");
    expect(choiceIds(s)).toEqual(["TST-OP:e1", "TST-OP:e2"]);
    expect(zoneOf(s, "player1", "SPEC-TRAIN:t")).toBe("deck");
  });

  it("RK-089: 戻す順番は、先に選んだカードから山札の下に置く（出典: atwiki/page-667「それ以外は好きな順で自分自身の山札の下に戻す」）", () => {
    const s = pick(refuse(MY_DECK, ENEMY_DECK), "TST-OP:e2");
    expect(zoneIds(s, "player2", "deck")).toEqual(["TST-OP:e3", "TST-OP:e2", "TST-OP:e1"]);
  });

  it("RK-089: その後、自分も同じようにする — M ユニットでない「車両」（S ユニット・ビークル）は山札の下に戻る（出典: atwiki/page-667「特徴「車両」を持つMユニットのカードをすべて」）", () => {
    let s = pick(refuse(MY_DECK, ENEMY_DECK), "TST-OP:e1");
    expect(zoneOf(s, "player1", "SPEC-TRAIN:t")).toBe("power");
    expectChoiceFrom(s, "player1", "RK-089");
    expect(choiceIds(s)).toEqual(["RK-095:veh", "SPEC-CAR:car"]);
    s = settle(pick(s, "RK-095:veh"));
    expect(zoneIds(s, "player1", "deck")).toEqual(["TST-OP:d3", "RK-095:veh", "SPEC-CAR:car"]);
    expect(zoneOf(s, "player1", "RK-089:jk")).toBe("discard");
  });

  it("RK-089: 特徴「車両」を持たない M ユニットはパワーゾーンに置かない（出典: atwiki/page-667）", () => {
    const s = resolveAll(refuse([inst("SPEC-PLAIN-M", "pm"), inst("TST-OP", "d1")], [inst("TST-OP", "e1")]));
    expect(zoneOf(s, "player1", "SPEC-PLAIN-M:pm")).toBe("deck");
    expect(s.players.player1.power).toHaveLength(1);
  });

  // grnrngr/faq-rider-2 RK-089 Q1「はい、発動します。すべてのカード操作は、同時に複数枚に対して行う場合でも、1枚ごとに実行しているものとして扱います。」
  // Q2「…２枚のカードを自軍パワーゾーンに置くことが決定したのち、その２枚のカードを１枚ずつパワーゾーンに置いてゆく」
  it("RK-089: 公式Q&A — 乗車拒否で自軍パワーゾーンが6枚から9枚になるとき、8枚の状態を経過したとして RK-169 仮面ライダーゼロノスVF【グランドストライク】が発動する（出典: grnrngr/faq-rider-2 RK-089 Q1・Q2）", () => {
    let s = played(
      rushPhase(
        { hand: [inst("RK-089", "jk")], rush: [inst("RK-169", "vf")], command: releasedCat("OT", 1), power: powerCards(6), deck: [inst("SPEC-TRAIN", "t1"), inst("SPEC-TRAIN", "t2"), inst("SPEC-TRAIN", "t3"), inst("TST-OP", "d4")] },
        { deck: [inst("TST-OP", "e1")], power: powerCards(3, "epw") },
      ),
      "RK-089:jk",
    );
    s = settle(s);
    expect(s.players.player1.power).toHaveLength(9);
    expectChoiceFrom(s, "player1", "RK-169");
    s = resolveAll(confirm(s));
    expect(s.players.player2.damage).toBe(1);
  });
});

// ===========================================================================
describe("RK-090 ショッカー戦闘員", () => {
  it("RK-090: カタログ本文・スペックが出典と一致（出典: atwiki/page-700）", () => {
    expectCatalogText("RK-090", "※このカードはデッキに好きな枚数入れてもよい。");
    expectStats("RK-090", { name: "ショッカー戦闘員", category: "DA", size: "S", bp: 500, sp: undefined, powerCost: 2, features: ["ショッカー", "男", "戦闘員"] });
    expectRarityIn("RK-090", ["N"]);
  });

  it("RK-090: ※ デッキに好きな枚数入れてもよい（10枚入れたデッキが構築ルールを満たす）（出典: atwiki/page-700）", () => {
    expect(deckWithTen("RK-090", "ショッカー戦闘員")).toBe(true);
  });
});

// ===========================================================================
describe("RK-091 ゾル大佐", () => {
  const TEXT =
    "【戦闘員の統率】これが自軍エリアにある間、自軍バトルエリアにある特徴「戦闘員」を持つ自軍SユニットのBPは、自軍バトルエリアにある特徴「戦闘員」を持つ自軍Sユニットの本来のBPをすべて「＋」した値になる。また、特徴「戦闘員」を持つ自軍Sユニットは、BP3000のとき「SP1」になる。";

  it("RK-091: カタログ本文・スペックが出典と一致（出典: atwiki/page-699）", () => {
    expectCatalogText("RK-091", TEXT);
    expectStats("RK-091", { name: "ゾル大佐", category: "DA", size: "S", bp: 3000, sp: undefined, powerCost: 4, features: ["ショッカー", "男", "改造人間"] });
    expectRarityIn("RK-091", ["NR"]);
  });

  it("RK-091: 自軍バトルエリアの「戦闘員」の S ユニットの BP は、それらの本来の BP の合計になる（ゾル大佐がラッシュエリアにいてもよい）（出典: atwiki/page-699「これが自軍エリアにある間」「本来のBPをすべて「＋」した値になる」）", () => {
    const s = board({ battle: [inst("RK-090", "g1"), inst("RK-090", "g2")], rush: [inst("RK-091", "zol")] });
    expect(bpOf(s, "player1", "RK-090:g1")).toBe(1000);
    expect(bpOf(s, "player1", "RK-090:g2")).toBe(1000);
  });

  it("RK-091: ラッシュエリアの「戦闘員」は数えず、その BP も変わらない。「戦闘員」でないユニット・M ユニット・敵軍の「戦闘員」も変わらない（出典: atwiki/page-699「自軍バトルエリアにある特徴「戦闘員」を持つ自軍Sユニット」）", () => {
    const s = board(
      { battle: [inst("RK-091", "zol"), inst("RK-090", "g1"), inst("SPEC-GRUNT-M", "gm")], rush: [inst("RK-090", "r1")] },
      { battle: [inst("RK-090", "e1"), inst("RK-090", "e2")] },
    );
    expect(bpOf(s, "player1", "RK-090:g1")).toBe(500);
    expect(bpOf(s, "player1", "RK-090:r1")).toBe(500);
    expect(bpOf(s, "player1", "RK-091:zol")).toBe(3000);
    expect(bpOf(s, "player1", "SPEC-GRUNT-M:gm")).toBe(2000);
    expect(bpOf(s, "player2", "RK-090:e1")).toBe(500);
  });

  it("RK-091: ゾル大佐が自軍エリアになければ BP は変わらない（出典: atwiki/page-699）", () => {
    const s = board({ battle: [inst("RK-090", "g1"), inst("RK-090", "g2")] }, { rush: [inst("RK-091", "ezol")] });
    expect(bpOf(s, "player1", "RK-090:g1")).toBe(500);
  });

  it("RK-091: 合計するのは本来の BP で、「～になる」が優先されるのでビークルの BP+1000 は加わらない（出典: atwiki/page-699「本来のBP」・R-BP-01「指定の値になる」を最も優先し計算は行われない・atwiki/page-701 カード評価）", () => {
    const s = board({ battle: [inst("RK-098", "cr"), { ...inst("RK-094", "b1"), mountedOnInstanceId: "RK-098:cr" }, inst("RK-090", "g1")], rush: [inst("RK-091", "zol")] });
    expect(bpOf(s, "player1", "RK-094:b1")).toBe(2000);
    expect(bpOf(s, "player1", "RK-090:g1")).toBe(2000);
  });

  it("RK-091: 「戦闘員」の S ユニットは BP3000 のとき「SP1」になる（バイク部隊2体で 1500＋1500）（出典: atwiki/page-699「BP3000のとき「SP1」になる」・atwiki/page-701 カード評価「ゾル大佐の能力を使えば2体でSP1に早変わり」）", () => {
    const s = board({ battle: [inst("RK-094", "b1"), inst("RK-094", "b2")], rush: [inst("RK-091", "zol")] });
    expect(bpOf(s, "player1", "RK-094:b2")).toBe(3000);
    expect(spOf(s, "player1", "RK-094:b2")).toBe(1);
    expect(spOf(s, "player1", "RK-094:b1")).toBe(1);
  });

  it("RK-091: BP が 3000 ちょうどでなければ（3500）「SP1」にならない（出典: atwiki/page-699「BP3000のとき」・カード評価「SP1になるのはBPが3000ピッタリの時」）", () => {
    const s = board({ battle: [inst("RK-094", "b1"), inst("SPEC-GRUNT2000", "g")], rush: [inst("RK-091", "zol")] });
    expect(bpOf(s, "player1", "SPEC-GRUNT2000:g")).toBe(3500);
    expect(spOf(s, "player1", "SPEC-GRUNT2000:g")).toBe(0);
  });

  it("RK-091: 本来の BP が 3000 の「戦闘員」1体だけでも「SP1」になる。ゾル大佐がいなければならない（出典: atwiki/page-699）", () => {
    expect(spOf(board({ battle: [inst("SPEC-GRUNT3000", "g")], rush: [inst("RK-091", "zol")] }), "player1", "SPEC-GRUNT3000:g")).toBe(1);
    expect(spOf(board({ battle: [inst("SPEC-GRUNT3000", "g")] }), "player1", "SPEC-GRUNT3000:g")).toBe(0);
  });

});

// 未使用の import を避けるための参照。
void mount;
