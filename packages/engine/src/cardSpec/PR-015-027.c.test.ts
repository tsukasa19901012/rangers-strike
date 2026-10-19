/**
 * カード別スペック: PR-024〜PR-027（プロモーションカード デカブレイク〜黒獅子リオ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr/faq-card-plomo には本範囲の項はない。
 *     本文が元カード（RS-405・RS-526・RS-572・RS-431）と同じなので、元カードの公式Q&A（faq-card-8 RS-572 Q1）を同じく当てはめる。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-PR-NNN.md。ライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-CN-02・R-KW-RC-01）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-PR-NNN …」）で残す。
 * 元カードの cardSpec（RS6-390-410.c・RS8-516-537.a・RS8-560-581.b・RS6-411-431.c）と同じ確かめ方をする。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attackTargets,
  bpOf,
  canEnter,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  deckCards,
  destroyedInEnemyTurn,
  enter,
  enterBattleByEffect,
  enterNext,
  expectCatalogText,
  expectOp,
  expectUnit,
  fillers,
  inst,
  nextPhase,
  pick,
  playOp,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushPhase,
  rushVia,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./PR-015-027.helpers";

const PLAIN3 = sUnit("SPEC-PLAIN3", { bp: 3000 });
const ENGINE_M = sUnit("SPEC-ENGINE-M", { category: "OT", size: "M", bp: 3000, features: ["炎神"] } as never);
const ENGINE_S = sUnit("SPEC-ENGINE-S", { category: "OT", size: "S", bp: 3000, features: ["炎神"] });
const PLAIN_M = sUnit("SPEC-PLAIN-M", { category: "OT", size: "M", bp: 9000 } as never);
const S3000 = sUnit("SPEC-S3000", { bp: 3000 });
const S3500 = sUnit("SPEC-S3500", { bp: 3500 });
const EXTRA = [PLAIN3, ENGINE_M, ENGINE_S, PLAIN_M, S3000, S3500];

// ===========================================================================
describe("PR-024 デカブレイク", () => {
  it("PR-024: カタログ本文・スペックが出典と一致（出典: atwiki/page-1094）", () => {
    expectCatalogText("PR-024", "※これはBP1000以下のユニットにアタックできない。 【光速拳ライトニングフィスト】相手に1点ダメージを与える。(この効果はライドオフしたとき、ナンバーに関係なく発動する)");
    expectUnit("PR-024", { name: "デカブレイク", category: "OT", size: "S", bp: 4000, sp: undefined, powerCost: 4, comboNumber: 6, features: ["男", "警察", "特キョウ"], rarity: "PR" });
  });

  it("PR-024: ※ BP1000 以下のユニット（BP1000・BP500）にはアタックできず、BP3000 にはアタックできる（出典: atwiki/page-1094）", () => {
    const s = st({ player1: { battle: [inst("PR-024", "x")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "k"), inst("RS-404", "half"), inst("SPEC-PLAIN3", "big")], deck: deckCards(3, "e") } }, EXTRA);
    expect(attackTargets(s, "PR-024:x")).toEqual(["SPEC-PLAIN3:big"]);
  });

  it("PR-024: 【光速拳ライトニングフィスト】6番目に出て NC が成立すると相手に1点ダメージ／5番目では与えない（出典: atwiki/page-1094「CN：6」・R-CN-02）", () => {
    expect(resolveAll(enterNext("PR-024", fillers(5), { deck: deckCards(3, "e") })).players.player2.damage).toBe(1);
    expect(resolveAll(enterNext("PR-024", fillers(4), { deck: deckCards(3, "e") })).players.player2.damage).toBe(0);
  });

  const viaBoxer = (rideOff: boolean) => {
    let s = st({ player1: { rush: [inst("RS-406", "v"), inst("PR-024", "x")], deck: deckCards(5) }, player2: { deck: deckCards(5, "e") } }, EXTRA);
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "PR-024:x", vehicleInstanceId: "RS-406:v" });
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff });
    return resolveAll(s);
  };

  it("PR-024: マシンボクサーからライドオフ（2番目）すると、ナンバーに関係なく相手に1点ダメージ（出典: atwiki/page-1094「この効果はライドオフしたとき、ナンバーに関係なく発動する」）", () => {
    expect(viaBoxer(true).players.player2.damage).toBe(1);
  });

  it("PR-024: ライドオフしなければダメージを与えない（出典: atwiki/page-1094「ライドオフしたとき」）", () => {
    expect(viaBoxer(false).players.player2.damage).toBe(0);
  });
});

// ===========================================================================
describe("PR-025 スーパーハイウェイバスター", () => {
  const use = () =>
    playOp(
      rushPhase(
        { hand: [inst("PR-025", "hb")], command: releasedCat("OT", 1), power: powerCards(2), deck: [inst("TST-OP", "d0"), inst("SPEC-ENGINE-M", "en"), inst("SPEC-ENGINE-S", "es"), inst("SPEC-PLAIN-M", "pm")] },
        { rush: [inst("SPEC-S3000", "e3")], battle: [inst("SPEC-S3500", "e35"), inst("TST-UNIT-2", "em")] },
        EXTRA,
      ),
      "player1",
      "PR-025:hb",
    );

  it("PR-025: カタログ本文・スペックが出典と一致（出典: atwiki/page-1095）", () => {
    expectCatalogText("PR-025", "自軍山札を見て、特徴「炎神」を持つMユニットのカードを1枚選び、自軍パワーゾーンに置いてもよい。そうしたとき、山札をシャッフルした後で、置いたユニットカードのBP以下の敵軍Sユニットを1体選び、持ち主のパワーゾーンに送る。");
    expectOp("PR-025", { name: "スーパーハイウェイバスター", category: "OT", powerCost: 2, rarity: "PR" });
  });

  it.fails("PR-025: 山札から選べるのは特徴「炎神」を持つ M ユニットのカードだけ（出典: atwiki/page-1095「特徴「炎神」を持つMユニットのカードを1枚選び」） — 既知の不具合: CARD-PR-025 再録（RS-526）の効果（山札から炎神 M ユニットをパワーゾーンに置き、BP 以下の敵軍 S ユニットをパワーゾーンに送る）が未実装", () => {
    const r = use();
    expect(r.ok, r.error).toBe(true);
    expect(choiceIds(r.state)).toEqual(["SPEC-ENGINE-M:en"]);
  });

  it.fails("PR-025: 炎神の M ユニットを自軍パワーゾーンに置くと、その BP（3000）以下の敵軍 S ユニット（ラッシュエリアも可）を1体選び持ち主のパワーゾーンに送る（出典: atwiki/page-1095） — 既知の不具合: CARD-PR-025 再録（RS-526）の効果（山札から炎神 M ユニットをパワーゾーンに置き、BP 以下の敵軍 S ユニットをパワーゾーンに送る）が未実装", () => {
    let s = pick(use().state, "SPEC-ENGINE-M:en");
    expect(zoneOf(s, "player1", "SPEC-ENGINE-M:en")).toBe("power");
    expect(choiceIds(s)).toEqual(["SPEC-S3000:e3"]);
    s = resolveAll(pick(s, "SPEC-S3000:e3"));
    expect(zoneOf(s, "player2", "SPEC-S3000:e3")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-S3000:e3")?.faceDown).not.toBe(true);
    expect(zoneOf(s, "player2", "SPEC-S3500:e35")).toBe("battle");
  });

  it.fails("PR-025: 「置いてもよい」— 置かなければ敵軍ユニットは送られない（出典: atwiki/page-1095「置いてもよい。そうしたとき」） — 既知の不具合: CARD-PR-025 再録（RS-526）の効果（山札から炎神 M ユニットをパワーゾーンに置き、BP 以下の敵軍 S ユニットをパワーゾーンに送る）が未実装", () => {
    let s = use().state;
    expect(canSkip(s)).toBe(true);
    s = resolveAll(act(s, { type: "skip_effect_choice", playerId: "player1" }));
    expect(zoneOf(s, "player1", "SPEC-ENGINE-M:en")).toBe("deck");
    expect(zoneOf(s, "player2", "SPEC-S3000:e3")).toBe("rush");
  });
});

// ===========================================================================
describe("PR-026 デカマスター", () => {
  const ID = "PR-026";
  const DOGGIE = "RS-318";

  it("PR-026: カタログ本文・スペックが出典と一致（出典: atwiki/page-1396）", () => {
    expectCatalogText(ID, "※これが撃破されて捨札になったとき、自軍捨札に「ドギー・クルーガー」のカードがあれば1枚選び、自軍ラッシュエリアに出す。 【ディーソードベガ】自軍ターン中、これがバトルエリアに出たとき、相手は1点ダメージを受けるか、自分自身のユニットを1体選び撃破するかを選ぶ。");
    expectUnit(ID, { name: "デカマスター", category: "OT", size: "S", bp: 6500, sp: undefined, powerCost: "7-", features: ["男", "警察", "2nd"], rushCondition: "zord_down_discard_named", rarity: "PR" });
  });

  it("PR-026: 追加条件 — 自軍「ドギー・クルーガー」1体を捨札にすれば必要パワー0でラッシュできる（出典: atwiki/page-1396）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst(ID, "am")], rush: [inst(DOGGIE, "p")], command: releasedCat("OT", 1), power: [], deck: deckCards(3) } });
    const r = rushVia(s, "player1", `${ID}:am`, (a) => a.zordMaterialInstanceId === `${DOGGIE}:p`);
    expect(r.ok, r.error).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", `${ID}:am`)).toBe("rush");
    expect(zoneOf(t, "player1", `${DOGGIE}:p`)).toBe("discard");
  });

  it("PR-026: 追加条件を使わなければ必要パワー7でラッシュする（パワー7で通常のラッシュができる）（出典: atwiki/page-1396「必要パワー：7-」）", () => {
    const r = rushFromHand(st({ phase: "rush", player1: { hand: [inst(ID, "am")], command: releasedCat("OT", 1), power: powerCards(7), deck: deckCards(3) } }), "player1", `${ID}:am`);
    expect(r.ok, r.error).toBe(true);
  });

  it("PR-026: ※ 撃破されて捨札になったとき、自軍捨札の「ドギー・クルーガー」を1枚選び自軍ラッシュエリアに出す（出典: atwiki/page-1396）", () => {
    const s = destroyedInEnemyTurn({ battle: [inst(ID, "am")], discard: [inst("TST-UNIT-0", "other"), inst(DOGGIE, "p")] }, `${ID}:am`, {}, [`${DOGGIE}:p`]);
    expect(zoneOf(s, "player1", `${ID}:am`)).toBe("discard");
    expect(zoneOf(s, "player1", `${DOGGIE}:p`)).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:other")).toBe("discard");
  });

  const entered = (enemyBattle = [inst("TST-UNIT-0", "e1")]) => enter(st({ player1: { rush: [inst(ID, "dm")], deck: deckCards(3) }, player2: { battle: enemyBattle, deck: deckCards(3, "e") } }), `${ID}:dm`);

  it.fails("PR-026: 【ディーソードベガ】選ぶのは相手 — 撃破を選べば自分自身のユニットを1体撃破し、ダメージは受けない（出典: atwiki/page-1396「相手は…を選ぶ」） — 既知の不具合: CARD-PR-026 再録（RS-572）の【ディーソードベガ】で相手が「自分のユニットを撃破」を選べない（ダメージ側だけ働く）", () => {
    let s = entered();
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    s = resolveAll(s, ["TST-UNIT-0:e1"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("discard");
    expect(s.players.player2.damage).toBe(0);
  });

  it("PR-026: 公式Q&A（RS-572 と同じ本文）— 相手のユニットが1体もいなければ、自動的に1点ダメージを受ける（出典: grnrngr/faq-card-8 RS-572 Q1）", () => {
    const s = entered([]);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player2.damage).toBe(1);
    expect(s.players.player1.damage).toBe(0);
  });

  it("PR-026: 【ディーソードベガ】敵軍ターン中にバトルエリアに出ても発動しない（出典: atwiki/page-1396「自軍ターン中、」）", () => {
    const s0 = st({ activePlayer: "player2", player1: { rush: [inst(ID, "dm")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e1")], deck: deckCards(3, "e") } });
    const s = enterBattleByEffect(s0, "player1", `${ID}:dm`);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player2.damage).toBe(0);
  });
});

// ===========================================================================
describe("PR-027 黒獅子リオ", () => {
  const ID = "PR-027";

  it("PR-027: カタログ本文・スペックが出典と一致（出典: atwiki/page-1397）", () => {
    expectCatalogText(ID, "※これはラッシュしたターンにバトルエリアに出られない。 ※これは自軍コマンドが１つ以上あるときストライクできない。 【剛勇吼波】これは敵軍Sユニット1体につきBP+1000される。");
    expectUnit(ID, { name: "黒獅子リオ", category: "DA", size: "S", bp: 2000, sp: 1, powerCost: 1, features: ["男", "臨気"], rarity: "PR" });
  });

  it("PR-027: ※ ラッシュしたターンにはバトルエリアに出られない／ラッシュしたターンでなければ出られる（出典: atwiki/page-1397）", () => {
    const r = rushFromHand(st({ phase: "rush", player1: { hand: [inst(ID, "ri")], command: releasedCat("DA", 1), power: powerCards(1), deck: deckCards(3) } }), "player1", `${ID}:ri`);
    expect(r.ok, r.error).toBe(true);
    const t = nextPhase(resolveAll(r.state));
    expect(t.phase).toBe("battle");
    expect(canEnter(t, `${ID}:ri`)).toBe(false);
    expect(canEnter(st({ player1: { rush: [inst(ID, "ri")], deck: deckCards(3) } }), `${ID}:ri`)).toBe(true);
  });

  it.fails("PR-027: ※ 自軍コマンドが1つ以上あるとき（リリース状態でも）ストライクできない／なければ SP1 でストライクできる（出典: atwiki/page-1397） — 既知の不具合: CARD-PR-027 再録（RS-431）の※（自軍コマンドがあるとストライク不可）と【剛勇吼波】が未実装", () => {
    const withCmd = st({ player1: { battle: [inst(ID, "ri")], command: [released("TST-OP", "c")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e1")], deck: deckCards(3, "e") } });
    expect(canStrike(withCmd, `${ID}:ri`)).toBe(false);
    const none = st({ player1: { battle: [inst(ID, "ri")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e1")], deck: deckCards(3, "e") } });
    expect(canStrike(none, `${ID}:ri`)).toBe(true);
    expect(spOf(none, "player1", `${ID}:ri`)).toBe(1);
  });

  it.fails("PR-027: 【剛勇吼波】敵軍 S ユニット（バトル・ラッシュエリア）1体につき BP+1000（L・M ユニット・自軍 S ユニットは数えない）（出典: atwiki/page-1397） — 既知の不具合: CARD-PR-027 再録（RS-431）の※（自軍コマンドがあるとストライク不可）と【剛勇吼波】が未実装", () => {
    const s = st({
      player1: { battle: [inst(ID, "ri"), inst("TST-UNIT-0", "mine")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-7", "el")], rush: [inst("RS-341", "e2"), inst("TST-UNIT-2", "em")], deck: deckCards(3, "e") },
    });
    expect(bpOf(s, "player1", `${ID}:ri`)).toBe(4000);
  });

  it("PR-027: 【剛勇吼波】敵軍 S ユニットがなければ BP2000（出典: atwiki/page-1397）", () => {
    const s = st({ player1: { battle: [inst(ID, "ri")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-7", "el")], deck: deckCards(3, "e") } });
    expect(bpOf(s, "player1", `${ID}:ri`)).toBe(2000);
  });
});
