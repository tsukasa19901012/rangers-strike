/**
 * カード別スペック: RS-598〜RS-604（第8弾「究極の八神」シシノシン〜蛮機兵ウガッツ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-RS603 蛮機獣ボンベバンキの読み替え）、grnrngr/faq-card-8
 *     （RS-600 Q1、RS-602 Q1〜Q3、RS-603 Q1、RS-604 Q1〜Q2）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写しは pages/1208.txt だけ）
 *  3. docs/rules/*.md の一般ルール（R-CN-02、R-DECK-03 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { validateDeckEntries } from "@rangers-strike/cards";
import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import {
  attack,
  attackedInEnemyTurn,
  attackTargets,
  canEndPhase,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  confirm,
  damageCards,
  deckCards,
  enter,
  expectCatalogText,
  expectStats,
  fill,
  held,
  inst,
  legal,
  ncLogged,
  pick,
  powerCards,
  raw,
  rushVia,
  releasedCat,
  resolveAll,
  rushFromHand,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./RS8-582-604.helpers";

function canAttackAny(s: GameState, attacker: string, playerId: PlayerId = "player1"): boolean {
  return legal(s).some(
    (a): a is Extract<GameAction, { type: "battle" }> => a.type === "battle" && a.playerId === playerId && a.attackerInstanceId === attacker,
  );
}

// ===========================================================================
describe("RS-598 シシノシン", () => {
  const TEXT =
    "※これは毎ターン、可能ならバトルエリアに出る。 ※敵軍ターン中、これが撃破されて捨札になったとき、自軍パワーゾーンにおいてもよい。 【正義の出陣】敵軍コマンドを1つ選びリリースしてもよい。そうしたとき、特徴「炎神」を持つMユニットのカードを、自軍パワーのオモテ向きのカードから1枚選び、ラッシュエリアに出す。";

  it("RS-598: カタログ本文・スペックが出典と一致（出典: atwiki/page-1206）", () => {
    expectCatalogText("RS-598", TEXT);
    expectStats("RS-598", {
      name: "シシノシン",
      category: "OT",
      size: "M",
      bp: 3000,
      sp: undefined,
      powerCost: 4,
      comboNumber: 3,
      features: ["車両", "炎神", "侍"],
    });
  });

  it("RS-598: ※ 毎ターン、可能ならバトルエリアに出る（出典: atwiki/page-1206・R-BA-04）", () => {
    expect(canEndPhase(st({ player1: { rush: [inst("RS-598", "s")], deck: deckCards(3) } }))).toBe(false);
  });

  it("RS-598: ※ 敵軍ターン中に撃破されて捨札になったとき、自軍パワーゾーンに置ける（出典: atwiki/page-1206）", () => {
    let s = attackedInEnemyTurn({ battle: [inst("RS-598", "s")] }, "RS-598:s");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-598");
    s = resolveAll(pick(s, "place_in_power"));
    expect(zoneOf(s, "player1", "RS-598:s")).toBe("power");
  });

  const ncBoard = (o: { enemyCmd?: ReturnType<typeof inst>[]; power?: ReturnType<typeof inst>[]; nth?: number } = {}) =>
    st({
      player1: {
        battle: fill((o.nth ?? 3) - 1),
        rush: [inst("RS-598", "s")],
        power: o.power ?? [inst("RS-597", "fm"), inst("RS-591", "fl"), { ...inst("RS-599", "down"), faceDown: true }, inst("TST-UNIT-2", "nm")],
        deck: deckCards(3),
      },
      player2: { command: o.enemyCmd ?? [held("TST-OP", "eh")], deck: deckCards(3, "e") },
    });

  // 既知の不具合: CARD-RS-598 【正義の出陣】が未実装（確認を受けても敵軍コマンドはリリースされず、パワーのカードもラッシュエリアに出ない）
  it.fails("RS-598: 【正義の出陣】NC（3番目）— 敵軍のホールド状態のコマンドを1つリリースすると、自軍パワーのオモテ向きの炎神 M ユニットのカードをラッシュエリアに出す（出典: atwiki/page-1206）", () => {
    let s = enter(ncBoard(), "RS-598:s");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-598");
    s = resolveAll(s.pendingEffectChoice?.kind === "confirm" ? confirm(s) : s, ["TST-OP:eh", "RS-597:fm"]);
    expect(s.players.player2.command.find((c) => c.instanceId === "TST-OP:eh")?.commandHeld).toBe(false);
    expect(zoneOf(s, "player1", "RS-597:fm")).toBe("rush");
  });

  // 既知の不具合: CARD-RS-598 【正義の出陣】が未実装
  it.fails("RS-598: 【正義の出陣】出せるのはオモテ向きの「炎神」の M ユニットだけ（L の炎神・ウラ向き・炎神でない M は選べない）（出典: atwiki/page-1206「特徴「炎神」を持つMユニットのカードを、自軍パワーのオモテ向きのカードから」）", () => {
    let s = enter(ncBoard(), "RS-598:s");
    s = s.pendingEffectChoice?.kind === "confirm" ? confirm(s) : s;
    s = resolveAll(s, ["TST-OP:eh"]);
    // 炎神 M の候補が1枚だけなので、強制で選ばれてラッシュエリアに出る
    expect(zoneOf(s, "player1", "RS-597:fm")).toBe("rush");
    expect(zoneOf(s, "player1", "RS-591:fl")).toBe("power");
    expect(zoneOf(s, "player1", "RS-599:down")).toBe("power");
    expect(zoneOf(s, "player1", "TST-UNIT-2:nm")).toBe("power");
  });

  it("RS-598: 【正義の出陣】任意 — リリースしなければ何も出さない（出典: atwiki/page-1206「リリースしてもよい」）", () => {
    let s = enter(ncBoard(), "RS-598:s");
    if (s.pendingEffectChoice?.sourceCardId === "RS-598") {
      expect(canSkip(s)).toBe(true);
      s = skip(s);
    }
    s = resolveAll(s);
    expect(s.players.player2.command[0]?.commandHeld).toBe(true);
    expect(zoneOf(s, "player1", "RS-597:fm")).toBe("power");
  });

  it("RS-598: 【正義の出陣】敵軍にホールド状態のコマンドがなければリリースできず、何も出さない（出典: atwiki/page-1206「リリースしてもよい。そうしたとき」）", () => {
    let s = enter(ncBoard({ enemyCmd: releasedCat("WB", 1, "er") }), "RS-598:s");
    s = resolveAll(s.pendingEffectChoice?.kind === "confirm" ? confirm(s) : s, ["RS-597:fm"]);
    expect(zoneOf(s, "player1", "RS-597:fm")).toBe("power");
  });

  it("RS-598: 【正義の出陣】NC が成立しない（2番目）と何も起きない（出典: R-CN-02）", () => {
    const s = resolveAll(enter(ncBoard({ nth: 2 }), "RS-598:s"), ["TST-OP:eh", "RS-597:fm"]);
    expect(s.players.player2.command[0]?.commandHeld).toBe(true);
    expect(zoneOf(s, "player1", "RS-597:fm")).toBe("power");
  });
});

// ===========================================================================
describe("RS-599 ツキノワ", () => {
  const TEXT =
    "※これは毎ターン、可能ならバトルエリアに出る。 ※敵軍ターン中、これが撃破されて捨札になったとき、自軍パワーゾーンにおいてもよい。 【取り戻す炎心】自軍パワーのダメージになっているカードをウラ向きのまま1枚選び、手札に加えてもよい。そうしたとき、自軍山札の上から1枚ひいて自軍パワーゾーンにウラ向きに置く。";

  it("RS-599: カタログ本文・スペックが出典と一致（出典: atwiki/page-1207）", () => {
    expectCatalogText("RS-599", TEXT);
    expectStats("RS-599", {
      name: "ツキノワ",
      category: "OT",
      size: "M",
      bp: 2000,
      sp: undefined,
      powerCost: 2,
      comboNumber: 2,
      features: ["車両", "炎神", "侍"],
    });
  });

  it("RS-599: ※ 毎ターン、可能ならバトルエリアに出る（出典: atwiki/page-1207・R-BA-04）", () => {
    expect(canEndPhase(st({ player1: { rush: [inst("RS-599", "t")], deck: deckCards(3) } }))).toBe(false);
  });

  const ncBoard = (power: ReturnType<typeof inst>[], nth = 2) =>
    st({ player1: { battle: fill(nth - 1), rush: [inst("RS-599", "t")], power, deck: [inst("TST-OP", "top"), inst("TST-OP", "next")] } });

  // 既知の不具合: CARD-RS-599 【取り戻す炎心】が未実装（damage_action のパッシブ登録だけで選択が開かない）
  it.fails("RS-599: 【取り戻す炎心】NC（2番目）— ダメージのカードを1枚手札に加え、山札の上から1枚をパワーゾーンにウラ向きで置く（出典: atwiki/page-1207）", () => {
    let s = enter(ncBoard([...damageCards(2), inst("TST-P", "up")]), "RS-599:t");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-599");
    expect(choiceIds(s)).toEqual(["TST-P:dmg0", "TST-P:dmg1"]);
    s = resolveAll(pick(s, "TST-P:dmg1"));
    expect(zoneOf(s, "player1", "TST-P:dmg1")).toBe("hand");
    expect(zoneOf(s, "player1", "TST-OP:top")).toBe("power");
    expect(s.players.player1.power).toHaveLength(3);
  });

  // 既知の不具合: CARD-RS-599 【取り戻す炎心】が未実装
  it.fails("RS-599: Q&A — 山札からパワーゾーンに置くカードはウラ向き（オモテを見ない）（出典: atwiki/page-1207 Q1「いいえ、それはできません」）", () => {
    const s = resolveAll(enter(ncBoard(damageCards(1)), "RS-599:t"), ["TST-P:dmg0"]);
    const placed = s.players.player1.power.find((c) => c.instanceId === "TST-OP:top");
    expect(placed?.faceDown).toBe(true);
  });

  it("RS-599: 【取り戻す炎心】オモテ向きのカードは選べず、ダメージがなければ何も起きない（出典: atwiki/page-1207「ダメージになっているカード」）", () => {
    const s = resolveAll(enter(ncBoard([inst("TST-P", "up")]), "RS-599:t"), ["TST-P:up"]);
    expect(zoneOf(s, "player1", "TST-P:up")).toBe("power");
    expect(s.players.player1.hand).toHaveLength(0);
    expect(s.players.player1.deck).toHaveLength(2);
  });

  it("RS-599: 【取り戻す炎心】任意 — 加えなければ山札からも置かない（出典: atwiki/page-1207「手札に加えてもよい。そうしたとき」）", () => {
    let s = enter(ncBoard(damageCards(1)), "RS-599:t");
    if (s.pendingEffectChoice?.sourceCardId === "RS-599") s = skip(s);
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "TST-P:dmg0")).toBe("power");
    expect(s.players.player1.deck).toHaveLength(2);
  });

  it("RS-599: 【取り戻す炎心】NC が成立しない（3番目）と何も起きない（出典: R-CN-02）", () => {
    const s = resolveAll(enter(ncBoard(damageCards(1), 3), "RS-599:t"), ["TST-P:dmg0"]);
    expect(zoneOf(s, "player1", "TST-P:dmg0")).toBe("power");
    expect(s.players.player1.deck).toHaveLength(2);
  });
});

// ===========================================================================
describe("RS-600 ゴーオンシルバー", () => {
  const TEXT =
    "※コールOT（このユニットはOTのユニットをラッシュするためのコマンドとしてホールドできる） 【ミッション1 バーニング】このターン、このユニットの次にコンビネーションするCN4を持つ自軍Sユニットは、そのＮＣの効果を発動する。ただし、ストライクはできない。";

  it("RS-600: カタログ本文・スペックが出典と一致（出典: atwiki/page-1143）", () => {
    expectCatalogText("RS-600", TEXT);
    expectStats("RS-600", {
      name: "ゴーオンシルバー",
      category: "OT",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 4,
      comboNumber: 1,
      features: ["シルバー", "女"],
    });
  });

  // レツタカ（RS-597。OT・必要パワー1）を、コマンドゾーンに OT のコマンドがない状態でラッシュする。
  const callBoard = (hand: ReturnType<typeof inst>, p2: Partial<GameState["players"]["player2"]> = {}) =>
    st({
      phase: "rush",
      player1: { hand: [hand], rush: [inst("RS-600", "sv")], command: releasedCat("WB", 1), power: powerCards(5), deck: deckCards(3) },
      player2: { deck: deckCards(3, "e"), ...p2 },
    });

  it("RS-600: ※コールOT — OT のユニットをラッシュするとき、このユニットをコマンドとしてホールドできる（出典: atwiki/page-1143）", () => {
    const s = callBoard(inst("RS-597", "t"));
    expect(canStartRush(s, "player1", "RS-597:t")).toBe(true);
    const r = rushFromHand(s, "player1", "RS-597:t");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-597:t")).toBe("rush");
    expect(r.state.players.player1.rush.find((c) => c.instanceId === "RS-600:sv")?.commandHeld).toBe(true);
  });

  it("RS-600: ※コールOT — OT でないユニット（ET）のラッシュには使えない（出典: atwiki/page-1143「OTのユニットをラッシュするための」）", () => {
    const s = callBoard(inst("RS-583", "red"));
    expect(canStartRush(s, "player1", "RS-583:red")).toBe(false);
  });

  it("RS-600: 公式Q&A — 敵軍に魔女バンドーラがある状態でコールOT で Vレックス（恐竜）をラッシュすると、ゴーオンシルバーは捨札になる（出典: grnrngr/faq-card-8 RS-600 Q1「はい、捨札になります」）", () => {
    const s = callBoard(inst("RS-302", "vr"), { rush: [inst("RS-374", "bd")] });
    const r = rushFromHand(s, "player1", "RS-302:vr");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-302:vr")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-600:sv")).toBe("discard");
  });

  // ゴーゴールド（RS-601。CN4・SP！。NC【ミッション6 フルパワー】「SP1」…）を、シルバーの次（2番目）に出す。
  const ncBoard = (silverFirst: boolean) =>
    st({
      player1: { battle: silverFirst ? [] : fill(1), rush: [inst("RS-600", "sv"), inst("RS-601", "gd")], deck: deckCards(3) },
      player2: { deck: deckCards(3, "e") },
    });
  function applyPass(s: GameState): GameState {
    const pass = legal(s).find((a) => a.type === "pass_battle_entry");
    return pass ? resolveAll(raw(s, pass)) : s;
  }
  /** シルバーを出して行動ウィンドウをパスし、続けてゴールドを出す（ゴールドの行動ウィンドウは残す）。 */
  const enterBoth = (s: GameState) => resolveAll(enter(applyPass(resolveAll(enter(s, "RS-600:sv"))), "RS-601:gd"));

  // 既知の不具合: CARD-RS-600 【ミッション1 バーニング】が未実装（combo_action のパッシブ登録だけ）
  it.fails("RS-600: 【ミッション1 バーニング】NC（1番目）— 次にコンビネーションする CN4 の S ユニット（2番目のゴーオンゴールド）は NC の効果を発動する（出典: atwiki/page-1143）", () => {
    const s = enterBoth(ncBoard(true));
    expect(ncLogged(s, "RS-601")).toBe(true);
  });

  // 既知の不具合: CARD-RS-600 【ミッション1 バーニング】が未実装（NC が発動しないので、ストライク制限も確かめられない）
  it.fails("RS-600: 【ミッション1 バーニング】発動した CN4 の S ユニットはストライクできない（出典: atwiki/page-1143「ただし、ストライクはできない」）", () => {
    const s = enterBoth(ncBoard(true));
    expect(ncLogged(s, "RS-601")).toBe(true);
    expect(canStrike(s, "RS-601:gd")).toBe(false);
  });

  it("RS-600: 【ミッション1 バーニング】シルバーの NC が成立しない（2番目）なら、次（3番目）の CN4 は NC を発動しない（出典: R-CN-02）", () => {
    const s = enterBoth(ncBoard(false));
    expect(ncLogged(s, "RS-601")).toBe(false);
  });
});


// ===========================================================================
describe("RS-601 ゴーオンゴールド", () => {
  const TEXT =
    "※これはBP2000以下のユニットにアタックできない。 【ミッション6 フルパワー】「SP1」敵軍コマンドを3つまで選びリリースしてもよい。そうしたとき、リリースしたコマンドの数以下の必要パワーの数字を持つ敵軍ユニットを1体選び撃破する。";
  const BP2000 = sUnit("SPEC-BP2000", { bp: 2000, powerCost: 2 });
  const BP2500 = sUnit("SPEC-BP2500", { bp: 2500, powerCost: 3 });
  const P4 = sUnit("SPEC-P4", { bp: 5000, powerCost: 4 });

  it("RS-601: カタログ本文・スペックが出典と一致（出典: atwiki/page-1144）", () => {
    expectCatalogText("RS-601", TEXT);
    expectStats("RS-601", {
      name: "ゴーオンゴールド",
      category: "OT",
      size: "S",
      bp: 4000,
      sp: "special",
      powerCost: 3,
      comboNumber: 4,
      features: ["ゴールド", "男"],
    });
  });

  it("RS-601: ※ BP2000 のユニットにはアタックできず、BP2500 にはアタックできる（出典: atwiki/page-1144）", () => {
    const s = st(
      { player1: { battle: [inst("RS-601", "gd")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-BP2000", "a"), inst("SPEC-BP2500", "b")], deck: deckCards(3, "e") } },
      [BP2000, BP2500],
    );
    expect(attackTargets(s, "RS-601:gd").sort()).toEqual(["SPEC-BP2500:b"]);
  });

  const ncBoard = (cmds: ReturnType<typeof inst>[], nth = 4) =>
    st(
      {
        player1: { battle: fill(nth - 1), rush: [inst("RS-601", "gd")], deck: deckCards(3) },
        player2: { command: cmds, battle: [inst("TST-UNIT-0", "p0"), inst("SPEC-BP2000", "p2"), inst("SPEC-BP2500", "p3")], rush: [inst("SPEC-P4", "p4")], deck: deckCards(3, "e") },
      },
      [BP2000, BP2500, P4],
    );
  const heldCmds = (n: number) => Array.from({ length: n }, (_, i) => held("TST-OP", `eh${i}`));

  it("RS-601: 【ミッション6 フルパワー】NC（4番目）で SP1（出典: atwiki/page-1144「「SP1」」）", () => {
    let s = enter(ncBoard([]), "RS-601:gd");
    if (s.pendingEffectChoice?.sourceCardId === "RS-601") s = skip(s);
    expect(spOf(resolveAll(s), "player1", "RS-601:gd")).toBe(1);
  });

  it("RS-601: 【ミッション6 フルパワー】NC が成立しない（3番目）と SP0（出典: R-CN-02）", () => {
    expect(spOf(resolveAll(enter(ncBoard([], 3), "RS-601:gd")), "player1", "RS-601:gd")).toBe(0);
  });

  // 既知の不具合: CARD-RS-601 【ミッション6 フルパワー】のコマンドのリリースと撃破が未実装（「SP1」だけ）
  it.fails("RS-601: 【ミッション6 フルパワー】敵軍コマンドを2つリリースすると、必要パワー2以下の敵軍ユニットを1体選び撃破する（出典: atwiki/page-1144）", () => {
    let s = enter(ncBoard(heldCmds(2)), "RS-601:gd");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-601");
    s = resolveAll(s, ["TST-OP:eh0", "TST-OP:eh1", "SPEC-BP2000:p2"]);
    expect(s.players.player2.command.every((c) => !c.commandHeld)).toBe(true);
    expect(zoneOf(s, "player2", "SPEC-BP2000:p2")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-601 【ミッション6 フルパワー】が未実装
  it.fails("RS-601: 【ミッション6 フルパワー】リリースした数より必要パワーが大きい敵軍ユニットは撃破できない（2つなら必要パワー3・4は候補外）（出典: atwiki/page-1144「リリースしたコマンドの数以下の必要パワー」）", () => {
    let s = enter(ncBoard(heldCmds(2)), "RS-601:gd");
    s = resolveAll(s, ["TST-OP:eh0", "TST-OP:eh1", "SPEC-BP2500:p3", "SPEC-P4:p4"]);
    expect(zoneOf(s, "player2", "SPEC-BP2500:p3")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-P4:p4")).toBe("rush");
    expect([zoneOf(s, "player2", "TST-UNIT-0:p0"), zoneOf(s, "player2", "SPEC-BP2000:p2")]).toContain("discard");
  });

  // 既知の不具合: CARD-RS-601 【ミッション6 フルパワー】が未実装
  it.fails("RS-601: 【ミッション6 フルパワー】リリースできるのは3つまで — 4つあっても3つで、必要パワー4のユニットは撃破できない（出典: atwiki/page-1144「3つまで」）", () => {
    let s = enter(ncBoard(heldCmds(4)), "RS-601:gd");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-601");
    s = resolveAll(s, ["TST-OP:eh0", "TST-OP:eh1", "TST-OP:eh2", "TST-OP:eh3", "SPEC-P4:p4", "SPEC-BP2500:p3"]);
    expect(s.players.player2.command.filter((c) => c.commandHeld)).toHaveLength(1);
    expect(zoneOf(s, "player2", "SPEC-P4:p4")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-BP2500:p3")).toBe("discard");
  });

  it("RS-601: 【ミッション6 フルパワー】任意 — リリースしなければ敵軍ユニットは撃破されない（出典: atwiki/page-1144「リリースしてもよい」）", () => {
    let s = enter(ncBoard(heldCmds(2)), "RS-601:gd");
    if (s.pendingEffectChoice?.sourceCardId === "RS-601") s = skip(s);
    s = resolveAll(s);
    expect(s.players.player2.command.every((c) => c.commandHeld)).toBe(true);
    expect(s.players.player2.battle).toHaveLength(3);
  });
});

// ===========================================================================
describe("RS-602 害水大臣ケガレシア", () => {
  const TEXT =
    "【汚染された水】これが自軍エリアにある間、特徴「メカ」を持たない敵軍ユニットは次の効果を受ける⇒そのカード名の平仮名と片仮名のうち、カ行、サ行、タ行、ハ行の文字に濁点を追加する。ただし、促音（小さい“ッ”）とルビには追加されない。（例：ズピードル、蛮機兵ウガッヅ）";

  it("RS-602: カタログ本文・スペックが出典と一致（出典: atwiki/page-1231）", () => {
    expectCatalogText("RS-602", TEXT);
    expectStats("RS-602", {
      name: "害水大臣ケガレシア",
      category: "DA",
      size: "S",
      bp: 5000,
      sp: undefined,
      powerCost: 3,
      features: ["メカ", "人型"],
    });
  });

  // 敵軍（player2）がバルカ＋ガンパード＋キャリゲーター（いずれも「メカ」なし）を合体させてガンバルオーをラッシュする。
  // カード名が「バルガ」「ギャリゲーダー」等になれば「合体―バルカ＋ガンパード＋キャリゲーター」を満たさない
  // （grnrngr/faq-card-8 RS-602 Q2: 濁点はカード名だけに付き、テキストの名前には付かない）。
  const fusionBoard = (keg: "enemy" | "own" | "none") =>
    st({
      activePlayer: "player2",
      phase: "rush",
      player1: { rush: keg === "enemy" ? [inst("RS-602", "k")] : [], deck: deckCards(3) },
      player2: {
        hand: [inst("RS-591", "gb")],
        rush: [inst("RS-593", "a"), inst("RS-594", "b"), inst("RS-595", "c"), ...(keg === "own" ? [inst("RS-602", "own")] : [])],
        command: releasedCat("OT", 1, "eo"),
        power: powerCards(7, "ep"),
        deck: deckCards(3, "e"),
      },
    });

  // 既知の不具合: CARD-RS-602 【汚染された水】が未実装（カード名が変わらず、合体の名前の参照に影響しない）
  it.fails("RS-602: 【汚染された水】敵軍の「メカ」を持たないユニットはカード名に濁点が付き、元の名前を参照する合体（ガンバルオー）の素材にならない（出典: atwiki/page-1231・grnrngr/faq-card-8 RS-602 Q2）", () => {
    expect(canStartRush(fusionBoard("enemy"), "player2", "RS-591:gb")).toBe(false);
  });

  it("RS-602: 【汚染された水】ケガレシアが場になければ名前は変わらず合体できる（出典: atwiki/page-1231「これが自軍エリアにある間」）", () => {
    expect(canStartRush(fusionBoard("none"), "player2", "RS-591:gb")).toBe(true);
  });

  it("RS-602: 【汚染された水】自軍（ケガレシアと同じ側）のユニットの名前は変わらない（出典: atwiki/page-1231「敵軍ユニット」）", () => {
    expect(canStartRush(fusionBoard("own"), "player2", "RS-591:gb")).toBe(true);
  });

  // RS-602 Q1/Q3・RS-604 Q1/Q2: 特徴「メカ」を持つ「蛮機兵ウガッツ」は効果を受けない。
  // 名前を参照する組み合わせとして、「メカ」のユニット（コスモバルカン＋ブルバルカン）によるサンバルカンロボの合体で確かめる。
  it("RS-602: 公式Q&A — 特徴「メカ」を持つユニット（蛮機兵ウガッツと同様）は効果を受けず、名前どおり合体できる（出典: grnrngr/faq-card-8 RS-602 Q1・Q3「効果を受けません」）", () => {
    const s = st({
      activePlayer: "player2",
      phase: "rush",
      player1: { rush: [inst("RS-602", "k")], deck: deckCards(3) },
      player2: {
        hand: [inst("RS-073", "sv")],
        rush: [inst("RS-074", "a"), inst("RS-075", "b")],
        command: [...releasedCat("ET", 1, "ee"), ...releasedCat("WB", 1, "ew"), ...releasedCat("OT", 1, "eo")],
        power: powerCards(7, "ep"),
        deck: deckCards(3, "e"),
      },
    });
    expect(canStartRush(s, "player2", "RS-073:sv")).toBe(true);
  });

  it.todo(
    "RS-602: 公式Q&A — カード名が「ニンジャボワイド」になっても、テキストの『「ホワイトカーク」としてつかえる』は変わらず合体に使える（出典: grnrngr/faq-card-8 RS-602 Q2「はい、それで間違いありません」）— 【汚染された水】のカード名変更自体が未実装で、テキスト側が変わらないことを区別して観測できないため",
  );
});

// ===========================================================================
describe("RS-603 蛮機獣ボンベバンキ", () => {
  // 公式の読み替え後（R-ERR-RS603、grnrngr/faq-card-8 RS-603 Q1）
  const TEXT =
    "【超有毒液化ガス】これが自軍エリアにある間、本来の特徴に「車両」を持つユニットはアタックもストライクもできず、効果名を持つテキストは無効になり、発動もできない。";

  it("RS-603: カタログ本文（公式読み替え後）・スペックが出典と一致（出典: grnrngr/faq-card-8 RS-603 Q1・R-ERR-RS603・atwiki/page-1208）", () => {
    expectCatalogText("RS-603", TEXT);
    expectStats("RS-603", {
      name: "蛮機獣ボンベバンキ",
      category: "DA",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 1,
      features: ["メカ", "怪人"],
    });
  });

  // 本来の特徴に「車両」を持つ SP1 の S ユニット（SP！のレツタカは NC なしではストライクできないため、制限の確認用に使う）
  const VEH = sUnit("SPEC-VEH", { features: ["車両"], sp: 1 });
  const board = (bombe: boolean) =>
    st({
      player1: { battle: [inst("SPEC-VEH", "t"), inst("TST-UNIT-0", "x")], rush: bombe ? [inst("RS-603", "bb")] : [], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") },
    }, [VEH]);

  it("RS-603: 【超有毒液化ガス】「車両」のユニット（自軍）はアタックもストライクもできない（出典: atwiki/page-1208）", () => {
    const s = board(true);
    expect(canAttackAny(s, "SPEC-VEH:t")).toBe(false);
    expect(canStrike(s, "SPEC-VEH:t")).toBe(false);
  });

  it("RS-603: 【超有毒液化ガス】ボンベバンキがなければ「車両」のユニットもアタック・ストライクできる（出典: atwiki/page-1208「これが自軍エリアにある間」）", () => {
    const s = board(false);
    expect(canAttackAny(s, "SPEC-VEH:t")).toBe(true);
    expect(canStrike(s, "SPEC-VEH:t")).toBe(true);
  });

  it("RS-603: 【超有毒液化ガス】「車両」を持たないユニットは制限されない（出典: atwiki/page-1208「「車両」を持つユニット」）", () => {
    const s = board(true);
    expect(canAttackAny(s, "TST-UNIT-0:x")).toBe(true);
    expect(canStrike(s, "TST-UNIT-0:x")).toBe(true);
  });

  it("RS-603: 【超有毒液化ガス】敵軍の「車両」のユニットも、相手のターンにアタック・ストライクできない（出典: atwiki/page-1208「「車両」を持つユニット」は自軍・敵軍を問わない）", () => {
    const s = st({
      activePlayer: "player2",
      player1: { battle: [inst("TST-UNIT-0", "mine")], rush: [inst("RS-603", "bb")], deck: deckCards(3) },
      player2: { battle: [inst("SPEC-VEH", "et")], deck: deckCards(3, "e") },
    }, [VEH]);
    expect(canAttackAny(s, "SPEC-VEH:et", "player2")).toBe(false);
    expect(canStrike(s, "SPEC-VEH:et", "player2")).toBe(false);
  });

  // 既知の不具合: CARD-RS-603 「効果名を持つテキストは無効」が未実装（レツタカの【心の力】「SP1」が有効なまま）
  it.fails("RS-603: 【超有毒液化ガス】「車両」のユニットの効果名を持つテキストは無効 — レツタカの NC【心の力】で SP1 にならない（出典: atwiki/page-1208「効果名を持つテキストは無効になり、発動もできない」）", () => {
    const s = resolveAll(enter(st({ player1: { battle: fill(3), rush: [inst("RS-597", "t"), inst("RS-603", "bb")], deck: deckCards(3) } }), "RS-597:t"));
    expect(spOf(s, "player1", "RS-597:t")).toBe(0);
  });

  it("RS-603: 【超有毒液化ガス】効果名のない ※ 行は無効にならない — レツタカは敵軍ターンに撃破されたときパワーゾーンに置ける（出典: atwiki/page-1208「効果名を持つテキスト」）", () => {
    const s0 = st({
      activePlayer: "player2",
      player1: { battle: [inst("RS-597", "t")], rush: [inst("RS-603", "bb")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") },
    });
    // 車両でない攻撃役がレツタカにアタックする
    const s = attack(s0, "TST-UNIT-7:atk", "RS-597:t", "player2");
    const t = resolveAll(s.pendingEffectChoice?.sourceCardId === "RS-597" ? pick(s, "place_in_power") : resolveAll(s));
    expect(zoneOf(t, "player1", "RS-597:t")).toBe("power");
  });

  // 公式読み替え: 「本来の特徴に「車両」を持つユニット」（RS-203 大帝ラー・デウスで特徴「車両」が追加されても、ボンベバンキ自身は対象にならない）
  it("RS-603: 公式Q&A（読み替え）— 大帝ラー・デウスの効果で特徴「車両」が追加されても、本来の特徴に「車両」を持たないボンベバンキ自身や他のユニットはアタックできる（出典: grnrngr/faq-card-8 RS-603 Q1・R-ERR-RS603）", () => {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-203", "deus")],
        rush: [inst("RS-597", "veh")],
        battle: [inst("RS-603", "bb"), inst("TST-UNIT-0", "x")],
        command: releasedCat("DA", 1),
        power: powerCards(5),
        deck: deckCards(3),
      },
      player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") },
    });
    const r = rushVia(s, "player1", "RS-203:deus", (a) => ((a.zordMaterialInstanceIds as string[] | undefined) ?? []).includes("RS-597:veh"));
    expect(r.ok).toBe(true);
    s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RS-597:veh")).toBe("discard");
    for (let i = 0; i < 4 && s.phase !== "battle"; i++) {
      const end = legal(s).find((a) => a.type === "end_phase");
      if (!end) break;
      s = resolveAll(raw(s, end));
    }
    expect(s.phase).toBe("battle");
    expect(canAttackAny(s, "RS-603:bb")).toBe(true);
    expect(canAttackAny(s, "TST-UNIT-0:x")).toBe(true);
  });
});

// ===========================================================================
describe("RS-604 蛮機兵ウガッツ", () => {
  const TEXT = "※このカードはデッキに好きな枚数入れてもよい。";

  it("RS-604: カタログ本文・スペックが出典と一致（出典: atwiki/page-1209）", () => {
    expectCatalogText("RS-604", TEXT);
    expectStats("RS-604", {
      name: "蛮機兵ウガッツ",
      category: "DA",
      size: "S",
      bp: 500,
      sp: undefined,
      powerCost: 1,
      features: ["メカ", "戦闘員"],
    });
  });

  it("RS-604: ※ デッキに好きな枚数（12枚）入れてもよい（出典: atwiki/page-1209・R-DECK-03）", () => {
    const r = validateDeckEntries([{ cardId: "RS-604", count: 12 }, { cardId: "RS-338", count: 38 }]);
    expect(r.errors.filter((e) => e.includes("ウガッツ"))).toEqual([]);
  });

  it("RS-604: ※ この注記のないカード（ボンベバンキ）は5枚入れられない（対照）（出典: R-DECK-03）", () => {
    const r = validateDeckEntries([{ cardId: "RS-603", count: 5 }, { cardId: "RS-604", count: 45 }]);
    expect(r.errors.some((e) => e.includes("ボンベバンキ"))).toBe(true);
  });

  it("RS-604: 公式Q&A — 特徴「メカ」を持つので、敵軍の害水大臣ケガレシアの効果を受けない（カード名・特徴は変わらない）（出典: grnrngr/faq-card-8 RS-604 Q1・Q2「効果を受けません」）", () => {
    const s = st({ player1: { battle: [inst("RS-604", "u")], deck: deckCards(3) }, player2: { rush: [inst("RS-602", "k")], deck: deckCards(3, "e") } });
    const d = s.definitions["RS-604"]!;
    expect(d.name).toBe("蛮機兵ウガッツ");
    expect(d.features).toEqual(["メカ", "戦闘員"]);
    expect(zoneOf(s, "player1", "RS-604:u")).toBe("battle");
  });
});
