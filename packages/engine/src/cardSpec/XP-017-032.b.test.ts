/**
 * カード別スペック: XP-022〜XP-026（クロスギャザー プロモーションカード ゴセイレッド〜仮面ライダーアクセル）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ を「XP-」とカード名で検索: 本範囲のカードの項はない。
 *     atwiki に転載された公式 Q&A: XP-026 Q1（atwiki/page-2257。RS-118 ゴーゴーダンプの置きかえ）。
 *     XP-023 は RS-289 と同じ本文の再録なので、RS-289 の公式Q&A（grnrngr/faq-card-5 RS-289 Q1・Q2）も同じく当てはめる。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XP-NNN.md。ライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-WING-01・R-KW-READ-01・R-KW-RC-01・R-KW-REG・R-KW-FUSION）・atwiki のカード評価
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XP-NNN …」）で残す。
 * 同じ本文の再録（XP-023＝RS-289）は元カードの cardSpec（RS5-285-305.a）と同じ確かめ方をする。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  attackTargets,
  attackUntilRegister,
  bpOf,
  canEnter,
  canSkip,
  choiceIds,
  damageCards,
  deckCards,
  endTurn,
  enter,
  expectCatalogText,
  expectUnit,
  inst,
  legal,
  PLAIN_VEHICLE,
  passEntry,
  payableFor,
  pick,
  powerCards,
  rcBoard,
  registerOffered,
  released,
  releasedCat,
  rushFromHand,
  rushPhase,
  settle,
  st,
  strike,
  sUnit,
  toPhase,
  useCard,
  wingTests,
  zoneOf,
} from "./XP-017-032.helpers";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState } from "../types/game";

const E_M = sUnit("SPEC-E-M", { size: "M", bp: 4000 } as never);
const E4 = sUnit("SPEC-E4", { bp: 4000 });
const E35 = sUnit("SPEC-E35", { bp: 3500 });
const E45 = sUnit("SPEC-E45", { bp: 4500 });
const E_ET = sUnit("SPEC-E-ET", { category: "ET", bp: 1000 });
const E_OT = sUnit("SPEC-E-OT", { category: "OT", bp: 1000 });
const VEH_OT = { ...PLAIN_VEHICLE, id: "SPEC-VEH-OT", name: "SPEC-VEH-OT", category: "OT" } as unknown as CardDefinition;
const EXTRA = [E_M, E4, E35, E45, E_ET, E_OT, VEH_OT];

// ===========================================================================
describe("XP-022 ゴセイレッド", () => {
  const TEXT =
    "※ウイング ※リードMA(このユニットはMAのオペレーションカードを使用するためのコマンドとしてホールドできる) 【レッドブレイク】敵軍Sユニットを1体選び、持ち主の手札に戻してもよい。（自分の手札が1枚以下なら、手札に戻すかわりに、持ち主のパワーゾーンにダメージにして置いてもよい）";

  it("XP-022: カタログ本文・スペックが出典と一致（WB／MA のマルチカテゴリ・CN1）（出典: atwiki/page-2234）", () => {
    expectCatalogText("XP-022", TEXT);
    expectUnit("XP-022", {
      name: "ゴセイレッド",
      category: ["WB", "MA"],
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 3,
      comboNumber: 1,
      features: ["レッド", "男"],
      rarity: "PR",
    });
  });

  wingTests("XP-022", "atwiki/page-2234");

  it.fails("XP-022: ※リードMA — MA のオペレーションを使うためのコマンドとして、ラッシュエリアのこれをホールドできる（出典: atwiki/page-2234「※リードMA」・R-KW-READ-01） — 既知の不具合: CARD-XP-022 リードMA でユニットをコマンドとしてホールドできない", () => {
    const s = rushPhase({ hand: [inst("TST-OP-MA", "op")], rush: [inst("XP-022", "gr")], command: [released("TST-OP", "c")], power: powerCards(3) });
    expect(payableFor(s, "TST-OP-MA:op")).toContain("XP-022:gr");
  });

  it("XP-022: ※リードMA — MA 以外のオペレーションのコマンドにはならない（出典: atwiki/page-2234「MAのオペレーションカードを使用するための」）", () => {
    const s = rushPhase({ hand: [inst("TST-OP-OT", "op")], rush: [inst("XP-022", "gr")], command: [released("TST-OP-OT", "c")], power: powerCards(3) });
    expect(payableFor(s, "TST-OP-OT:op") ?? []).not.toContain("XP-022:gr");
  });

  it("XP-022: 【レッドブレイク】（CN1）バトルエリアに出たとき、敵軍 S ユニットを1体選び持ち主の手札に戻してもよい（任意）（出典: atwiki/page-2234）", () => {
    let s = enter(st({ player1: { rush: [inst("XP-022", "gr")], hand: [inst("TST-UNIT-0", "h1"), inst("TST-UNIT-0", "h2")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") } }), "XP-022:gr");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XP-022");
    expect(canSkip(s)).toBe(true);
    s = settle(pick(s, "TST-UNIT-0:e"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("hand");
  });

  it("XP-022: 【レッドブレイク】ラッシュエリアの敵軍 S ユニットも選べる（出典: atwiki/page-2234「敵軍Sユニット」）", () => {
    const s = enter(st({ player1: { rush: [inst("XP-022", "gr")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e")], rush: [inst("TST-UNIT-7", "r")], deck: deckCards(3, "e") } }), "XP-022:gr");
    expect(choiceIds(s)).toContain("TST-UNIT-7:r");
  });

  it.fails("XP-022: 【レッドブレイク】敵軍 M ユニットは選べない（出典: atwiki/page-2234「敵軍Sユニット」） — 既知の不具合: CARD-XP-022 【レッドブレイク】の候補に S 以外のユニットが入る", () => {
    const s = enter(st({ player1: { rush: [inst("XP-022", "gr")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e")], rush: [inst("SPEC-E-M", "m")], deck: deckCards(3, "e") } }, EXTRA), "XP-022:gr");
    expect(choiceIds(s)).not.toContain("SPEC-E-M:m");
  });

  it.fails("XP-022: 【レッドブレイク】自分の手札が1枚以下なら、手札に戻すかわりに持ち主のパワーゾーンにダメージ（ウラ）にして置ける（出典: atwiki/page-2234「（自分の手札が1枚以下なら…ダメージにして置いてもよい）」） — 既知の不具合: CARD-XP-022 手札1枚以下のとき「ダメージにして置く」方を選べない（必ず手札に戻る）", () => {
    let s = enter(st({ player1: { rush: [inst("XP-022", "gr")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") } }), "XP-022:gr");
    s = settle(pick(s, "TST-UNIT-0:e"));
    // 「かわりに…置いてもよい」— 手札に戻すか、ダメージにして置くかを選ぶ場面がある（すぐに手札へ戻らない）。
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).not.toBe("hand");
  });
});

// ===========================================================================
describe("XP-023 ドラゴンレンジャー", () => {
  const TEXT =
    "※これはダメージを受けた敵軍ターンの次の自軍ターンにしかバトルエリアに出られない。 ※自分がターンを終えるとき、ゲームに負けるまでの自軍ダメージが残り3点以下なら、これを撃破する。 【獣奏剣】これが自軍エリアにある間、特徴「恐竜」を持つすべての自軍ユニットはBP＋1000される。";

  it("XP-023: カタログ本文・スペックが出典と一致（RS-289 と同じ本文）（出典: atwiki/page-2253）", () => {
    expectCatalogText("XP-023", TEXT);
    expectUnit("XP-023", {
      name: "ドラゴンレンジャー",
      category: "WB",
      size: "S",
      bp: 6000,
      sp: 1,
      powerCost: 3,
      features: ["グリーン", "男", "獣奏剣"],
      rarity: "PR",
    });
  });

  function nextOwnBattle(strikeDamage: boolean) {
    let s = st({
      activePlayer: "player2",
      player1: { rush: [inst("XP-023", "dr")], power: powerCards(3, "p1pw"), deck: deckCards(8) },
      player2: { battle: [inst("TST-UNIT-0", "st")], deck: deckCards(8, "e") },
    });
    if (strikeDamage) s = settle(strike(s, "TST-UNIT-0:st", "player2"));
    s = endTurn(s);
    return toPhase(s, "player1", "battle");
  }

  it("XP-023: ※ 敵軍ターン中にダメージを受けたら、次の自軍ターンにバトルエリアに出られる（出典: atwiki/page-2253）", () => {
    const s = nextOwnBattle(true);
    expect(s.players.player1.damage).toBe(1);
    expect(canEnter(s, "XP-023:dr")).toBe(true);
  });

  it("XP-023: ※ 直前の敵軍ターンにダメージを受けていなければバトルエリアに出られない（出典: atwiki/page-2253「にしか…出られない」）", () => {
    expect(canEnter(nextOwnBattle(false), "XP-023:dr")).toBe(false);
  });

  it("XP-023: ※ その次の自軍ターン（間の敵軍ターンにダメージなし）には出られない（出典: atwiki/page-2253「次の自軍ターンにしか」）", () => {
    let s = nextOwnBattle(true);
    s = endTurn(passEntry(s));
    s = endTurn(s);
    s = toPhase(s, "player1", "battle");
    expect(canEnter(s, "XP-023:dr")).toBe(false);
  });

  it("XP-023: 公式Q&A（RS-289 と同じ本文）— 敵軍ターン中に「ダメージにして置く」効果（カーナビック）を受けた場合も、次の自軍ターンに出られる（出典: grnrngr/faq-card-5 RS-289 Q1）", () => {
    let s = st({
      activePlayer: "player2",
      phase: "rush",
      player1: { hand: [inst("RS-247", "ctr")], rush: [inst("XP-023", "dr")], deck: deckCards(8) },
      player2: { hand: [inst("RS-185", "cn")], command: [released("TST-OP-OT", "c"), released("TST-OP", "c2")], power: powerCards(6), deck: deckCards(8, "e") },
    });
    s = useCard(s, "player2", "RS-185:cn");
    s = settle(pick(s, "RS-247:ctr"));
    s = toPhase(endTurn(s), "player1", "battle");
    expect(canEnter(s, "XP-023:dr")).toBe(true);
  });

  function endWithDamage(damage: number, zone: "battle" | "rush", active: "player1" | "player2" = "player1") {
    const s = st({
      activePlayer: active,
      player1: { [zone]: [inst("XP-023", "dr")], damage, power: damageCards(damage), deck: deckCards(5) },
      player2: { deck: deckCards(5, "e") },
    });
    return endTurn(s);
  }

  it("XP-023: ※ 自分がターンを終えるとき、自軍ダメージ4点（負けるまで残り3点）ならこれを撃破する（出典: atwiki/page-2253）", () => {
    expect(zoneOf(endWithDamage(4, "battle"), "player1", "XP-023:dr")).toBe("discard");
  });

  it("XP-023: ※ ラッシュエリアにあっても撃破する（出典: atwiki/page-2253「これを撃破する」）", () => {
    expect(zoneOf(endWithDamage(5, "rush"), "player1", "XP-023:dr")).toBe("discard");
  });

  it("XP-023: ※ 自軍ダメージ3点（残り4点）なら撃破しない（出典: atwiki/page-2253「残り3点以下なら」）", () => {
    expect(zoneOf(endWithDamage(3, "battle"), "player1", "XP-023:dr")).toBe("battle");
  });

  it("XP-023: ※ 相手がターンを終えるときは撃破しない（出典: atwiki/page-2253「自分がターンを終えるとき」）", () => {
    expect(zoneOf(endWithDamage(4, "rush", "player2"), "player1", "XP-023:dr")).toBe("rush");
  });

  it("XP-023: 【獣奏剣】自軍エリアにある間、特徴「恐竜」を持つ自軍ユニット（バトル・ラッシュとも）は BP＋1000、ほかは変わらない（出典: atwiki/page-2253）", () => {
    const s = st({ player1: { rush: [inst("XP-023", "dr"), inst("RS-036", "d1")], battle: [inst("RS-037", "d2"), inst("TST-UNIT-0", "x")] } });
    expect(bpOf(s, "player1", "RS-036:d1")).toBe(6000);
    expect(bpOf(s, "player1", "RS-037:d2")).toBe(6000);
    expect(bpOf(s, "player1", "TST-UNIT-0:x")).toBe(1000);
    expect(bpOf(s, "player1", "XP-023:dr")).toBe(6000);
  });

  it("XP-023: 【獣奏剣】敵軍の「恐竜」は BP＋1000 されない（出典: atwiki/page-2253「自軍ユニット」）", () => {
    const s = st({ player1: { battle: [inst("XP-023", "dr")], rush: [inst("RS-036", "d1")] }, player2: { battle: [inst("RS-038", "ed")] } });
    expect(bpOf(s, "player1", "RS-036:d1")).toBe(6000);
    expect(bpOf(s, "player2", "RS-038:ed")).toBe(3000);
  });
});

// ===========================================================================
describe("XP-024 仮面ライダー2号", () => {
  const TEXT =
    "※レジスト ※これは自軍ターン中、バトルするとき、BP+2000される。 【力の2号】BP4000以上の敵軍Sユニットを1体選び、このユニットと選んだユニットでバトルしてもよい。そうしたとき、このターン、これはアタックする事ができない。";

  it("XP-024: カタログ本文・スペックが出典と一致（CN：RC）（出典: atwiki/page-2255）", () => {
    expectCatalogText("XP-024", TEXT);
    expectUnit("XP-024", {
      name: "仮面ライダー2号",
      category: "ET",
      size: "S",
      bp: 3000,
      sp: "1/5",
      powerCost: 3,
      comboNumber: "RC",
      features: ["仮面ライダー", "男", "改造人間"],
      rarity: "PR",
    });
  });

  it("XP-024: ※レジスト — 敵軍ユニットにアタックされたとき、レジストを宣言できる（出典: atwiki/page-2255「※レジスト」・R-KW-REG）", () => {
    expect(registerOffered(attackUntilRegister({ battle: [inst("XP-024", "n2")] }, "XP-024:n2", {}, "TST-UNIT-7:atk", EXTRA))).toBe(true);
  });

  it("XP-024: ※ 自軍ターン中にバトルするとき BP+2000 — BP4000 の敵軍ユニットにアタックして勝つ（出典: atwiki/page-2255）", () => {
    const s = st({ player1: { battle: [inst("XP-024", "n2")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-E4", "a")], deck: deckCards(3, "e") } }, EXTRA);
    expect(bpOf(s, "player1", "XP-024:n2")).toBe(3000);
    const r = settle(attack(s, "XP-024:n2", "SPEC-E4:a"));
    expect(zoneOf(r, "player2", "SPEC-E4:a")).toBe("discard");
    expect(zoneOf(r, "player1", "XP-024:n2")).toBe("battle");
  });

  it("XP-024: ※ 敵軍ターン中のバトルでは BP+2000 されない — BP3500 の敵軍ユニットにアタックされると負ける（出典: atwiki/page-2255「自軍ターン中」）", () => {
    let s = st({ activePlayer: "player2", player1: { battle: [inst("XP-024", "n2")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-E35", "a")], deck: deckCards(3, "e") } }, EXTRA);
    s = settle(attack(s, "SPEC-E35:a", "XP-024:n2", "player2"));
    // レジストを宣言しない（settle は任意の選択を見送る）ので、負けて撃破される。
    expect(zoneOf(s, "player1", "XP-024:n2")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E35:a")).toBe("battle");
  });

  it("XP-024: 【力の2号】（RC）ライドオフしたとき、BP4000 以上の敵軍 S ユニットを1体選べる（BP3500 は選べない。任意）（出典: atwiki/page-2255「BP4000以上の敵軍Sユニットを1体選び」）", () => {
    const s = rcBoard("XP-024:n2", {}, { battle: [inst("SPEC-E4", "a"), inst("SPEC-E35", "b")] }, EXTRA);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XP-024");
    expect(choiceIds(s)).toEqual(["SPEC-E4:a"]);
    expect(canSkip(s)).toBe(true);
  });

  it.fails("XP-024: 【力の2号】エリアを問わない — ラッシュエリアの BP4000 以上の敵軍 S ユニットも選べる（出典: atwiki/page-2255 カード評価「エリアを問わないため…ラッシュエリアに篭りがちなシステムユニットを狙える」） — 既知の不具合: CARD-XP-024 【力の2号】の候補が敵軍バトルエリアだけ", () => {
    const s = rcBoard("XP-024:n2", {}, { battle: [inst("SPEC-E4", "a")], rush: [inst("SPEC-E45", "r")] }, EXTRA);
    expect(choiceIds(s)).toContain("SPEC-E45:r");
  });

  it("XP-024: 【力の2号】選んだユニットとバトルする（自軍ターン中なので BP5000 で BP4000 に勝つ）。そうしたとき、このターンこれはアタックできない（出典: atwiki/page-2255）", () => {
    let s = rcBoard("XP-024:n2", {}, { battle: [inst("SPEC-E4", "a"), inst("SPEC-E35", "b")] }, EXTRA);
    s = settle(pick(s, "SPEC-E4:a"));
    expect(zoneOf(s, "player2", "SPEC-E4:a")).toBe("discard");
    expect(zoneOf(s, "player1", "XP-024:n2")).toBe("battle");
    expect(attackTargets(s, "XP-024:n2")).toEqual([]);
  });

  it("XP-024: 【力の2号】を使わなければ、そのターンにアタックできる（出典: atwiki/page-2255「そうしたとき、」）", () => {
    let s = rcBoard("XP-024:n2", {}, { battle: [inst("SPEC-E4", "a"), inst("SPEC-E35", "b")] }, EXTRA);
    s = settle(act(s, { type: "skip_effect_choice", playerId: "player1" }));
    expect(attackTargets(s, "XP-024:n2")).toContain("SPEC-E35:b");
  });
});

// ===========================================================================
describe("XP-025 ダイカイシンケンオー", () => {
  const TEXT =
    "※合体─獅子折神（またはシンケンレッド）+龍折神（またはシンケンブルー）+亀折神（またはシンケンピンク）+熊折神（またはシンケングリーン）+猿折神（またはシンケンイエロー）+海老折神（またはシンケンゴールド） 【二天一流乱れ斬り】自軍ターン中、これがバトルエリアに出たとき、追加条件を持たない敵軍ユニットを2体まで選び、持ち主の手札に戻してもよい。";

  it("XP-025: カタログ本文・スペックが出典と一致（L ユニット・必要パワー6+）（出典: atwiki/page-2256）", () => {
    expectCatalogText("XP-025", TEXT);
    expectUnit("XP-025", {
      name: "ダイカイシンケンオー",
      category: "MA",
      size: "L",
      bp: 18000,
      sp: 1,
      powerCost: "6+",
      features: ["侍", "人型"],
      rushConditionText: "自軍合体ユニットを捨札にする",
      rarity: "PR",
    });
  });

  const SIX = () => [inst("RS-674", "r"), inst("RS-675", "b"), inst("RS-676", "p"), inst("RS-677", "g"), inst("RS-678", "y"), inst("XP-012", "go")];

  it("XP-025: ※合体 — シンケンレッド・ブルー・ピンク・グリーン・イエロー・ゴールドの6体を捨札にしてラッシュできる（出典: atwiki/page-2256「※合体─」・R-KW-FUSION）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("XP-025", "dk")], rush: SIX(), command: releasedCat("MA", 1), power: powerCards(6) }), "player1", "XP-025:dk");
    expect(r.ok, r.error).toBe(true);
    const s = settle(r.state);
    expect(zoneOf(s, "player1", "XP-025:dk")).toBe("rush");
    for (const c of SIX()) expect(zoneOf(s, "player1", c.instanceId)).toBe("discard");
  });

  it("XP-025: ※合体 — 6体のうち1体（シンケンゴールド）が欠けていればラッシュできない（出典: atwiki/page-2256「※合体─」）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("XP-025", "dk")], rush: SIX().slice(0, 5), command: releasedCat("MA", 1), power: powerCards(6) }), "player1", "XP-025:dk");
    expect(r.ok).toBe(false);
  });

  const entered = (p2: Partial<GameState["players"]["player2"]>) =>
    enter(st({ player1: { rush: [inst("XP-025", "dk")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e"), ...p2 } }, EXTRA), "XP-025:dk");

  it("XP-025: 【二天一流乱れ斬り】自軍ターン中、バトルエリアに出たとき、敵軍ユニットを選んで手札に戻せる（任意）（出典: atwiki/page-2256）", () => {
    let s = entered({ battle: [inst("TST-UNIT-0", "a"), inst("TST-UNIT-7", "b")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XP-025");
    expect(canSkip(s)).toBe(true);
    s = settle(pick(s, "TST-UNIT-0:a"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("hand");
  });

  it.fails("XP-025: 【二天一流乱れ斬り】2体まで — 2体を選んで両方とも手札に戻せる（出典: atwiki/page-2256「2体まで選び」） — 既知の不具合: CARD-XP-025 「2体まで」なのに1体選ぶと効果が終わる", () => {
    let s = entered({ battle: [inst("TST-UNIT-0", "a"), inst("TST-UNIT-7", "b")] });
    s = pick(s, "TST-UNIT-0:a");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XP-025");
    s = settle(pick(s, "TST-UNIT-7:b"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-UNIT-7:b")).toBe("hand");
  });

  it.fails("XP-025: 【二天一流乱れ斬り】追加条件を持つ敵軍ユニット（XP-010 デカブルーSWAT）は選べない（出典: atwiki/page-2256「追加条件を持たない敵軍ユニット」） — 既知の不具合: CARD-XP-025 候補から追加条件を持つユニットが除かれない", () => {
    const s = entered({ battle: [inst("TST-UNIT-0", "a"), inst("XP-010", "sw")] });
    expect(choiceIds(s)).not.toContain("XP-010:sw");
  });

  it.fails("XP-025: 【二天一流乱れ斬り】ラッシュエリアの敵軍ユニットも選べる（出典: atwiki/page-2256「敵軍ユニット」） — 既知の不具合: CARD-XP-025 候補が敵軍バトルエリアだけ", () => {
    const s = entered({ battle: [inst("TST-UNIT-0", "a")], rush: [inst("TST-UNIT-7", "r")] });
    expect(choiceIds(s)).toContain("TST-UNIT-7:r");
  });

  it.todo("XP-025: 【二天一流乱れ斬り】敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-2256「自軍ターン中、」）— 敵軍ターン中に L ユニットをバトルエリアに出す手順を公開 API で組めない");
});

// ===========================================================================
describe("XP-026 仮面ライダーアクセル", () => {
  const TEXT =
    "※これは、自分がターンを終えるときバトルエリアにあれば、特徴「加速」を持つ自軍コマンドをホールドしてラッシュエリアに戻してよい。 【アクセルグランツァー】これが自軍バトルエリアからラッシュエリアに戻るとき、自軍コマンドを1つ選び手札に戻してもよい。そうしたとき、戻したコマンドと同じカテゴリを持たない、敵軍Sユニットまたはライドされていない敵軍Sビークルがあれば1体選び捨札にする。";

  it("XP-026: カタログ本文・スペックが出典と一致（出典: atwiki/page-2257）", () => {
    expectCatalogText("XP-026", TEXT);
    expectUnit("XP-026", {
      name: "仮面ライダーアクセル",
      category: "ET",
      size: "S",
      bp: 1000,
      sp: "1/5",
      powerCost: 1,
      features: ["仮面ライダー", "男", "警察", "アクセルドライバー"],
      rarity: "PR",
    });
  });

  const endOwnTurn = (s: GameState) => act(s, legal(s).find((a) => a.type === "end_phase" && a.playerId === "player1")!);
  const board = (command = [released("PR-020", "kas"), released("TST-OP-ET", "et")], p2: Partial<GameState["players"]["player2"]> = {}) =>
    st({ player1: { battle: [inst("XP-026", "ac")], command, deck: deckCards(3) }, player2: { battle: [inst("SPEC-E-ET", "eet"), inst("SPEC-E-OT", "eot")], deck: deckCards(3, "e"), ...p2 } }, EXTRA);

  it("XP-026: ※ 自分がターンを終えるとき、特徴「加速」の自軍コマンド（PR-020 タイムレッド）をホールドしてラッシュエリアに戻せる（任意）（出典: atwiki/page-2257）", () => {
    let s = endOwnTurn(board());
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XP-026");
    expect(choiceIds(s)).toEqual(["PR-020:kas"]);
    expect(canSkip(s)).toBe(true);
    s = pick(s, "PR-020:kas");
    expect(zoneOf(s, "player1", "XP-026:ac")).toBe("rush");
    expect(s.players.player1.command.find((c) => c.instanceId === "PR-020:kas")?.commandHeld).toBe(true);
  });

  it("XP-026: ※ 「加速」のコマンドがなければ戻せない（選択が出ない）（出典: atwiki/page-2257「特徴「加速」を持つ自軍コマンドをホールドして」）", () => {
    const s = endOwnTurn(board([released("TST-OP-ET", "et")]));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("XP-026");
    expect(zoneOf(settle(s), "player1", "XP-026:ac")).toBe("battle");
  });

  it("XP-026: 【アクセルグランツァー】※で戻ったとき、自軍コマンド（ET）を手札に戻すと、ET を持たない敵軍 S ユニットを1体選び捨札にする（出典: atwiki/page-2257）", () => {
    let s = pick(endOwnTurn(board()), "PR-020:kas");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XP-026");
    expect(canSkip(s)).toBe(true);
    s = pick(s, "TST-OP-ET:et");
    expect(zoneOf(s, "player1", "TST-OP-ET:et")).toBe("hand");
    expect(choiceIds(s)).toEqual(["SPEC-E-OT:eot"]);
    s = settle(pick(s, "SPEC-E-OT:eot"));
    expect(zoneOf(s, "player2", "SPEC-E-OT:eot")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E-ET:eet")).toBe("battle");
  });

  it("XP-026: 【アクセルグランツァー】ライドされていない敵軍 S ビークルも選べる（出典: atwiki/page-2257「ライドされていない敵軍Sビークル」）", () => {
    let s = pick(endOwnTurn(board(undefined, { rush: [inst("SPEC-VEH-OT", "veh")] })), "PR-020:kas");
    s = pick(s, "TST-OP-ET:et");
    expect(choiceIds(s)).toContain("SPEC-VEH-OT:veh");
  });

  it("XP-026: 公式Q&A — RS-118 ゴーゴーダンプ【プレシャスの護り手】の置きかえでラッシュエリアに移ったときも【アクセルグランツァー】を発動できる（出典: atwiki/page-2257 Q1「はい、できます。」）", () => {
    let s = st({ player1: { rush: [inst("RS-118", "dump")], battle: [inst("XP-026", "accel")], command: [released("TST-OP-ET", "et")] }, player2: { battle: [inst("TST-UNIT-0", "e")] } });
    s = enter(s, "RS-118:dump");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "XP-026:accel" });
    expect(zoneOf(s, "player1", "XP-026:accel")).toBe("rush");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("XP-026");
    s = pick(s, "TST-OP-ET:et");
    s = settle(pick(s, "TST-UNIT-0:e"));
    expect(zoneOf(s, "player1", "TST-OP-ET:et")).toBe("hand");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
  });
});
