/**
 * カード別スペック: PR-015〜PR-019（プロモーションカード バイオロボ〜レッドファルコン）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr/faq-card-plomo には本範囲の項はない。
 *     本文が元カード（RS-127・RS-230・RS-340・RS-422・RS-204）と同じ（PR-017 は能力名だけ違う）なので、元カードの公式Q&A（faq-card-3/4/6）を同じく当てはめる。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-PR-NNN.md。ライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-CN-02・R-ADD-06）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-PR-NNN …」）で残す。
 * 元カードの cardSpec（RS3-123-150.a・RS4-222-242.b・RS5-327-347.c・RS6-411-431.b・RS4-201-221.a）と同じ確かめ方をする。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  act,
  attack,
  attackTargets,
  attackedInEnemyTurn,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  deckCards,
  destroyedInEnemyTurn,
  drain,
  endTurn,
  enter,
  enterNext,
  expectCatalogText,
  expectUnit,
  fillers,
  held,
  inst,
  lastBattleBps,
  legal,
  pick,
  powerCards,
  released,
  releasedCat,
  releasedN,
  resolveAll,
  rushFromHand,
  rushVia,
  settle,
  spOf,
  st,
  strike,
  sUnit,
  useCard,
  zoneOf,
} from "./PR-015-027.helpers";

const E9 = sUnit("SPEC-E9", { bp: 9000 });
const BP2000 = sUnit("SPEC-BP2000", { bp: 2000 });
const EXTRA = [E9, BP2000];

// ===========================================================================
describe("PR-015 バイオロボ", () => {
  const TEXT =
    "合体―バイオジェット1号＋バイオジェット2号 【バイオ粒子斬り】自軍ターン中、これがバトルエリアに出るとき、「OT」の自軍コマンドを2つ選んでパワーゾーンに送ってもよい。そうしたとき、このターン、これは次の能力を得る⇒「SP2」「BP＋3000」";

  it("PR-015: カタログ本文・スペックが出典と一致（出典: atwiki/page-989）", () => {
    expectCatalogText("PR-015", TEXT);
    expectUnit("PR-015", { name: "バイオロボ", category: "OT", size: "L", bp: 11000, sp: 1, powerCost: "6+", features: ["メカ", "人型"], rushCondition: "discard_fusion_unit", rarity: "PR" });
  });

  const robo = (command = [released("TST-OP-OT", "o1"), held("TST-OP-OT", "o2"), released("TST-OP-MA", "ma")]) =>
    enter(st({ player1: { rush: [inst("PR-015", "bio")], command }, player2: { deck: deckCards(5, "ed") } }), "PR-015:bio");

  it("PR-015: 合体ユニット（バイオジェット1号・2号）を捨札にしてラッシュする（出典: atwiki/page-989「合体―」・R-ADD-06）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("PR-015", "bio")], rush: [inst("RS-128", "j1"), inst("RS-129", "j2")], command: [released("TST-OP-OT", "ot")], power: powerCards(6) } });
    const r = rushFromHand(s, "player1", "PR-015:bio");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "PR-015:bio")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-128:j1")).toBe("discard");
    expect(zoneOf(r.state, "player1", "RS-129:j2")).toBe("discard");
  });

  it("PR-015: 【バイオ粒子斬り】出るとき「OT」の自軍コマンドを2つ（ホールド状態も可）パワーゾーンに送ると、このターン「SP2」「BP＋3000」（出典: atwiki/page-989）", () => {
    let s = robo();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("PR-015");
    expect(choiceIds(s)).toEqual(["TST-OP-OT:o1", "TST-OP-OT:o2"]);
    s = pick(s, "TST-OP-OT:o1");
    s = pick(s, "TST-OP-OT:o2");
    if (s.pendingEffectChoice?.sourceCardId === "PR-015") s = act(s, { type: "confirm_effect_choice", playerId: "player1" });
    expect(zoneOf(s, "player1", "TST-OP-OT:o1")).toBe("power");
    expect(zoneOf(s, "player1", "TST-OP-OT:o2")).toBe("power");
    expect(bpOf(s, "player1", "PR-015:bio")).toBe(14000);
    const before = s.players.player2.power.length;
    s = settle(act(s, { type: "strike", playerId: "player1", instanceId: "PR-015:bio" }));
    expect(s.players.player2.power.length - before).toBe(2);
  });

  it("PR-015: 【バイオ粒子斬り】送らないことを選べる（任意）— その場合 BP11000 のまま（出典: atwiki/page-989「送ってもよい」）", () => {
    let s = robo();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("PR-015");
    expect(canSkip(s)).toBe(true);
    s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(zoneOf(s, "player1", "TST-OP-OT:o1")).toBe("command");
    expect(bpOf(s, "player1", "PR-015:bio")).toBe(11000);
  });

  it("PR-015: 【バイオ粒子斬り】「OT」の自軍コマンドが1つしかなければ発動しない（出典: atwiki/page-989「2つ選んで」）", () => {
    const s = robo([released("TST-OP-OT", "o1"), released("TST-OP-MA", "ma")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("PR-015");
    expect(bpOf(s, "player1", "PR-015:bio")).toBe(11000);
  });

  it("PR-015: 【バイオ粒子斬り】敵軍ターン中に（相手の紐男爵で）バトルエリアに出されたときは発動しない（出典: atwiki/page-989「自軍ターン中」）", () => {
    let s = st({
      activePlayer: "player2",
      player1: { battle: [inst("TST-UNIT-0", "mine")], rush: [inst("PR-015", "bio")], command: [released("TST-OP-OT", "o1"), released("TST-OP-OT", "o2")] },
      player2: { battle: fillers(2, "ef"), rush: [inst("RS-141", "himo")] },
    });
    s = enter(s, "RS-141:himo", "player2");
    s = pick(s, "TST-UNIT-0:mine");
    s = drain(s, "player2", ["PR-015:bio"]);
    expect(zoneOf(s, "player1", "PR-015:bio")).toBe("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("PR-015");
    expect(zoneOf(s, "player1", "TST-OP-OT:o1")).toBe("command");
  });

  it("PR-015: 公式Q&A（RS-127 と同じ本文）— ピンクフラッシュの【プリズムブーツ】で OT 扱いになったホールド状態のコマンドを送って発動できる（出典: grnrngr/faq-card-3 RS-127 Q1）", () => {
    let s = st({ player1: { rush: [inst("RS-270", "pf"), inst("PR-015", "bio")], command: [held("TST-OP-MA", "m1"), held("TST-OP-MA", "m2"), released("TST-OP-OT", "ot")] } });
    s = settle(drain(enter(s, "RS-270:pf"), "player1"));
    const pass = legal(s).find((a) => a.type === "pass_battle_entry");
    if (pass) s = act(s, pass);
    s = enter(s, "PR-015:bio");
    expect(choiceIds(s)).toEqual(expect.arrayContaining(["TST-OP-MA:m1", "TST-OP-MA:m2"]));
  });
});

// ===========================================================================
describe("PR-016 アバレッドAM", () => {
  const TEXT = "※これは毎ターン、可能ならバトルエリアに出る。 ※これが撃破されて捨札になったとき、自軍捨札に「アバレッド」のカードがあれば1枚選び、自軍ラッシュエリアに出す。 【アバレスラッシュ】「SP1」";
  const ID = "PR-016";

  it("PR-016: カタログ本文・スペックが出典と一致（出典: atwiki/page-988）", () => {
    expectCatalogText(ID, TEXT);
    expectUnit(ID, { name: "アバレッドAM", category: "WB", size: "S", bp: 5500, sp: "special", powerCost: "7-", comboNumber: 2, features: ["レッド", "男", "アバレモード"], rushCondition: "zord_down_discard_named", rarity: "PR" });
  });

  it("PR-016: ※ 撃破されて捨札になったとき、自軍捨札の「アバレッド」を1枚選び自軍ラッシュエリアに出す（出典: atwiki/page-988）", () => {
    const s = destroyedInEnemyTurn({ battle: [inst(ID, "am")], discard: [inst("TST-UNIT-0", "other"), inst("RS-054", "p")] }, `${ID}:am`, {}, ["RS-054:p"]);
    expect(zoneOf(s, "player1", `${ID}:am`)).toBe("discard");
    expect(zoneOf(s, "player1", "RS-054:p")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:other")).toBe("discard");
  });

  it("PR-016: ※ 選べるのは「アバレッド」のカードだけで、出さないことは選べない（出典: atwiki/page-988「「アバレッド」のカード」「出す」）", () => {
    let s = attackedInEnemyTurn({ battle: [inst(ID, "am")], discard: [inst("TST-UNIT-0", "other"), inst("RS-054", "p")] }, `${ID}:am`);
    for (let i = 0; i < 4 && s.pendingEffectChoice && s.pendingEffectChoice.sourceCardId !== ID; i++) s = settle(drain(drain(s, "player2"), "player1"));
    if (s.pendingEffectChoice?.sourceCardId === ID) {
      expect(choiceIds(s)).toEqual(["RS-054:p"]);
      expect(canSkip(s)).toBe(false);
      s = pick(s, "RS-054:p");
    }
    s = settle(s);
    expect(zoneOf(s, "player1", "RS-054:p")).toBe("rush");
    expect(s.players.player1.rush).toHaveLength(1);
  });

  it("PR-016: ※ 自軍捨札に「アバレッド」がなければ何も出さない／敵軍の捨札のアバレッドは出さない（出典: atwiki/page-988「自軍捨札」）", () => {
    const a = destroyedInEnemyTurn({ battle: [inst(ID, "am")], discard: [inst("TST-UNIT-0", "other")] }, `${ID}:am`);
    expect(zoneOf(a, "player1", `${ID}:am`)).toBe("discard");
    expect(a.players.player1.rush).toHaveLength(0);
    const b = destroyedInEnemyTurn({ battle: [inst(ID, "am")] }, `${ID}:am`, { discard: [inst("RS-054", "ep")] });
    expect(zoneOf(b, "player2", "RS-054:ep")).toBe("discard");
    expect(b.players.player1.rush).toHaveLength(0);
  });

  it("PR-016: 追加条件 — 自軍「アバレッド」1体を捨札にすれば必要パワー0でラッシュできる（出典: atwiki/page-988）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst(ID, "am")], rush: [inst("RS-054", "p")], command: releasedN(1), power: [] } });
    const r = rushVia(s, "player1", `${ID}:am`, (a) => a.zordMaterialInstanceId === "RS-054:p");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", `${ID}:am`)).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-054:p")).toBe("discard");
  });

  it("PR-016: ※ バトルエリアに出られるのに出さずにバトルフェイズを終えることはできない（出典: atwiki/page-988「毎ターン、可能ならバトルエリアに出る」）", () => {
    const s = st({ player1: { rush: [inst(ID, "am"), inst("TST-UNIT-0", "u")] } });
    expect(legal(s).filter((a) => a.type === "end_phase")).toHaveLength(0);
    expect(canEnter(s, `${ID}:am`)).toBe(true);
  });

  it("PR-016: 【アバレスラッシュ】2番目に出て NC が成立すると「SP1」、1番目なら SP！のまま（出典: atwiki/page-988「CN：2」）", () => {
    const two = enterNext(ID, fillers(1));
    expect(spOf(two, "player1", `${ID}:x`)).toBe(1);
    expect(canStrike(two, `${ID}:x`)).toBe(true);
    const one = enterNext(ID, []);
    expect(canStrike(one, `${ID}:x`)).toBe(false);
  });

  it("PR-016: 公式Q&A（RS-230 と同じ本文）— 追加条件で必要パワー0としてラッシュしていても、ダイノガッツで山札から捨札にするのは7枚（出典: grnrngr/faq-card-4 RS-230 Q1）", () => {
    let s = st(
      {
        activePlayer: "player2",
        player1: { battle: [inst(ID, "am")], hand: [inst("RS-027", "dg")], command: [released("TST-OP", "w")], deck: deckCards(10) },
        player2: { battle: [inst("SPEC-E9", "atk")] },
      },
      EXTRA,
    );
    s = attack(s, "SPEC-E9:atk", `${ID}:am`, "player2");
    s = settle(useCard(s, "player1", "RS-027:dg"));
    expect(zoneOf(s, "player1", `${ID}:am`)).toBe("battle");
    expect(s.players.player1.deck).toHaveLength(3);
  });

  it("PR-016: 公式Q&A（RS-230 と同じ本文）— 超電子レーダーがあるとき、捨札から出たアバレッドについて持ち主はパワーゾーンのオモテ向きのカードを1枚手札に加える（出典: grnrngr/faq-card-4 RS-230 Q3・Q4）", () => {
    const s = destroyedInEnemyTurn({ battle: [inst(ID, "am")], discard: [inst("RS-054", "red")], power: powerCards(2, "own") }, `${ID}:am`, { operation: [inst("RS-124", "radar")] });
    expect(zoneOf(s, "player1", "RS-054:red")).toBe("rush");
    expect(s.players.player1.hand.filter((c) => c.cardId === "TST-P")).toHaveLength(1);
  });
});

// ===========================================================================
describe("PR-017 ゲキレッド", () => {
  const ID = "PR-017";

  it("PR-017: カタログ本文・スペックが出典と一致（能力名は【咆咆弾】）（出典: atwiki/page-987）", () => {
    expectCatalogText(ID, "【咆咆弾】「SP1」特徴「獣」を持つユニットからコンビネーションするとき、このターン、これはBP＋2000される。");
    expectUnit(ID, { name: "ゲキレッド", category: "WB", size: "S", bp: 3000, sp: "special", powerCost: 3, comboNumber: 2, features: ["レッド", "男"], rarity: "PR" });
  });

  it("PR-017: 【咆咆弾】2番目に出て NC が成立すると「SP1」、3番目では SP！のまま（出典: atwiki/page-987「CN：2」）", () => {
    const two = enterNext(ID, fillers(1));
    expect(spOf(two, "player1", `${ID}:x`)).toBe(1);
    expect(canStrike(two, `${ID}:x`)).toBe(true);
    expect(canStrike(enterNext(ID, fillers(2)), `${ID}:x`)).toBe(false);
  });

  it.fails("PR-017: 【咆咆弾】特徴「獣」を持つユニット（ギガゼール）からコンビネーションしたとき、このターン BP+2000 され、次のターンには元に戻る（出典: atwiki/page-987） — 既知の不具合: CARD-PR-017 再録（RS-340）の【咆咆弾】の BP+2000（特徴「獣」からのコンビネーション）が未実装（「SP1」は働く）", () => {
    let s = enterNext(ID, [inst("RK-119", "beast")], { battle: [inst("TST-UNIT-2", "e")] });
    expect(bpOf(s, "player1", `${ID}:x`)).toBe(5000);
    s = settle(attack(s, `${ID}:x`, "TST-UNIT-2:e"));
    expect(lastBattleBps(s)?.attacker).toBe(5000);
    s = endTurn(s);
    expect(bpOf(s, "player1", `${ID}:x`)).toBe(3000);
  });

  it("PR-017: 特徴「獣」を持たないユニットからのとき、また NC 不成立（3番目）のときは BP+2000 されない（出典: atwiki/page-987「特徴「獣」を持つユニットから」・R-CN-02）", () => {
    expect(bpOf(enterNext(ID, fillers(1)), "player1", `${ID}:x`)).toBe(3000);
    expect(bpOf(enterNext(ID, [inst("TST-UNIT-0", "f"), inst("RK-119", "beast")]), "player1", `${ID}:x`)).toBe(3000);
  });

  it("PR-017: 公式Q&A（RS-340 と同じカード名）— ゲキレッド（S）＋ゲキチーター（M）＋ゲキジャガー（M）でゲキトージャの追加条件を満たしてラッシュできる（出典: grnrngr/faq-card-6 RS-422 Q1）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-422", "gt")], rush: [inst(ID, "r"), inst("RS-424", "c"), inst("RS-425", "j")], command: releasedCat("WB", 1), power: powerCards(6), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-422:gt");
    expect(r.ok, r.error).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-422:gt")).toBe("rush");
    expect(zoneOf(t, "player1", `${ID}:r`)).toBe("discard");
  });
});

// ===========================================================================
describe("PR-018 ゲキトージャ", () => {
  const TEXT =
    "合体－ゲキレッドまたはゲキタイガー＋ゲキイエローまたはゲキチーター＋ゲキブルーまたはゲキジャガー 【大頑頑拳】これがアタックしてバトルに勝つたび、敵軍コマンドを1つ選びホールドしてもよい。そうしたとき、これは追加でアタックできる（ストライクはできない）。";

  it("PR-018: カタログ本文・スペックが出典と一致（出典: atwiki/page-986）", () => {
    expectCatalogText("PR-018", TEXT);
    expectUnit("PR-018", { name: "ゲキトージャ", category: "WB", size: "L", bp: 9000, sp: 1, powerCost: "6+", features: ["激気", "人型"], rushCondition: "discard_fusion_unit", rarity: "PR" });
  });

  const rushState = (rush: CardInstance[]) => st({ phase: "rush", player1: { hand: [inst("PR-018", "gt")], rush, command: releasedCat("WB", 2), power: powerCards(6), deck: deckCards(3) } });

  it("PR-018: 追加条件 — ゲキレッド（S）＋ゲキチーター（M）＋ゲキジャガー（M）を捨札にしてラッシュできる（出典: grnrngr/faq-card-6 RS-422 Q1「はい、できます」）", () => {
    const r = rushFromHand(rushState([inst("RS-340", "r"), inst("RS-424", "c"), inst("RS-425", "j")]), "player1", "PR-018:gt");
    expect(r.ok, r.error).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "PR-018:gt")).toBe("rush");
    for (const id of ["RS-340:r", "RS-424:c", "RS-425:j"]) expect(zoneOf(t, "player1", id)).toBe("discard");
  });

  it("PR-018: 追加条件 — ゲキレッド＋ゲキイエロー＋ゲキブルーでラッシュできる（出典: atwiki/page-986「合体－」）", () => {
    const r = rushFromHand(rushState([inst("RS-340", "r"), inst("RS-342", "y"), inst("RS-341", "b")]), "player1", "PR-018:gt");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "PR-018:gt")).toBe("rush");
  });

  it("PR-018: 追加条件 — 3種のうち1つが欠けていればラッシュできない（出典: atwiki/page-986）", () => {
    expect(canStartRush(rushState([inst("RS-340", "r"), inst("RS-424", "c")]), "player1", "PR-018:gt")).toBe(false);
    expect(canStartRush(rushState([inst("RS-340", "r"), inst("RS-340", "r2"), inst("RS-341", "b")]), "player1", "PR-018:gt")).toBe(false);
  });

  const battleState = (p2: Partial<GameState["players"]["player2"]> = {}) =>
    st({ player1: { battle: [inst("PR-018", "gt")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2")], command: [released("TST-OP", "c1"), held("TST-OP", "c2")], deck: deckCards(3, "e"), ...p2 } });

  it.fails("PR-018: 【大頑頑拳】アタックしてバトルに勝ったとき、敵軍コマンドを1つホールドすれば追加でアタックできる（ストライクはできない）（出典: atwiki/page-986） — 既知の不具合: CARD-PR-018 再録（RS-422）の【大頑頑拳】（勝つたびにホールドして追加でアタック）が未実装", () => {
    let s = settle(attack(battleState(), "PR-018:gt", "TST-UNIT-0:e1"));
    expect(s.pendingEffectChoice?.sourceCardId).toBe("PR-018");
    expect(choiceIds(s)).toContain("TST-OP:c1");
    s = settle(pick(s, "TST-OP:c1"));
    expect(s.players.player2.command.find((c) => c.instanceId === "TST-OP:c1")?.commandHeld).toBe(true);
    expect(attackTargets(s, "PR-018:gt")).toEqual(["TST-UNIT-0:e2"]);
    expect(canStrike(s, "PR-018:gt")).toBe(false);
  });

  it("PR-018: 【大頑頑拳】「ホールドしてもよい」— ホールドしなければ追加でアタックできない（出典: atwiki/page-986）", () => {
    let s = settle(attack(battleState(), "PR-018:gt", "TST-UNIT-0:e1"));
    if (s.pendingEffectChoice?.sourceCardId === "PR-018") {
      expect(canSkip(s)).toBe(true);
      s = settle(act(s, { type: "skip_effect_choice", playerId: "player1" }));
    }
    expect(attackTargets(s, "PR-018:gt")).toEqual([]);
  });

  it("PR-018: 【大頑頑拳】バトルに勝てなければ発動しない（出典: atwiki/page-986「アタックしてバトルに勝つたび」）", () => {
    const s = settle(attack(battleState({ battle: [inst("TST-UNIT-7", "big")] }), "PR-018:gt", "TST-UNIT-7:big"));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("PR-018");
    expect(s.players.player2.command.find((c) => c.instanceId === "TST-OP:c1")?.commandHeld).toBe(false);
  });

  it.fails("PR-018: 【大頑頑拳】「勝つたび」— 追加のアタックでも勝てば、もう一度ホールドして追加でアタックできる（出典: atwiki/page-986「バトルに勝つたび」） — 既知の不具合: CARD-PR-018 再録（RS-422）の【大頑頑拳】（勝つたびにホールドして追加でアタック）が未実装", () => {
    let s = battleState({ battle: [inst("TST-UNIT-0", "e1"), inst("TST-UNIT-0", "e2"), inst("TST-UNIT-0", "e3")], command: [released("TST-OP", "c1"), released("TST-OP", "c3")] });
    s = settle(pick(settle(attack(s, "PR-018:gt", "TST-UNIT-0:e1")), "TST-OP:c1"));
    s = settle(attack(s, "PR-018:gt", "TST-UNIT-0:e2"));
    expect(s.pendingEffectChoice?.sourceCardId).toBe("PR-018");
    s = settle(pick(s, "TST-OP:c3"));
    expect(attackTargets(s, "PR-018:gt")).toEqual(["TST-UNIT-0:e3"]);
  });
});

// ===========================================================================
describe("PR-019 レッドファルコン", () => {
  it("PR-019: カタログ本文・スペックが出典と一致（出典: atwiki/page-985）", () => {
    expectCatalogText("PR-019", "【ファルコンブレイク】SP1（この効果は、敵軍ユニットが1体以上あるとき、このユニットのBPがすべての敵軍ユニットとくらべて一番低ければ、ナンバーに関係なく発動する）");
    expectUnit("PR-019", { name: "レッドファルコン", category: "ET", size: "S", bp: 2000, sp: "special", powerCost: 3, comboNumber: 5, features: ["レッド", "男"], rarity: "PR" });
  });

  const falconFirst = (enemy: CardInstance[], enemyOps: CardInstance[] = []) => enterNext("PR-019", [], { battle: enemy, operation: enemyOps }, EXTRA);

  it("PR-019: 1番目でも、BP が敵軍ユニットより低ければ「SP1」でストライクできる（出典: atwiki/page-985）", () => {
    expect(canStrike(falconFirst([inst("TST-UNIT-2", "m"), inst("TST-UNIT-7", "l")]), "PR-019:x")).toBe(true);
    const s = settle(strike(enterNext("PR-019", [], { battle: [inst("TST-UNIT-2", "m")], power: powerCards(2, "e"), deck: deckCards(2, "e") }), "PR-019:x"));
    expect(s.players.player2.damage).toBe(1);
  });

  it("PR-019: BP がより低い敵軍ユニットがいる・敵軍ユニットが0体なら1番目では発動しない（出典: atwiki/page-985「敵軍ユニットが1体以上あるとき」）", () => {
    expect(canStrike(falconFirst([inst("TST-UNIT-0", "low"), inst("TST-UNIT-2", "m")]), "PR-019:x")).toBe(false);
    expect(canStrike(falconFirst([]), "PR-019:x")).toBe(false);
  });

  it("PR-019: 5番目なら通常のナンバーコンビネーションで「SP1」になる（出典: atwiki/page-985・R-CN-02）", () => {
    const s = enterNext("PR-019", fillers(4), { battle: [inst("TST-UNIT-0", "e")], power: powerCards(2, "e"), deck: deckCards(2, "e") });
    expect(canStrike(s, "PR-019:x")).toBe(true);
    expect(settle(strike(s, "PR-019:x")).players.player2.damage).toBe(1);
  });

  it("PR-019: 公式Q&A（RS-204 と同じ本文）— 補正後の BP で比べる（BP1000 のイエローフォーがカレーで3000なら一番低い）（出典: grnrngr/faq-card-4 RS-204 Q1）", () => {
    const s = falconFirst([inst("RS-201", "y")], [inst("RS-179", "cur")]);
    expect(bpOf(s, "player2", "RS-201:y")).toBe(3000);
    expect(canStrike(s, "PR-019:x")).toBe(true);
  });

  it("PR-019: 公式Q&A（RS-204 と同じ本文）— 同じ BP2000 の敵軍ユニットがあっても発動する（同着も「一番低い」）（出典: grnrngr/faq-card-4 RS-204 Q2）", () => {
    expect(canStrike(falconFirst([inst("SPEC-BP2000", "e")]), "PR-019:x")).toBe(true);
  });
});
