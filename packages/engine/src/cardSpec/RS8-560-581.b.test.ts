/**
 * カード別スペック: RS-567〜RS-573（第8弾「究極の八神」トライコンドル〜ファイヤーカイザー（2nd））
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（RS-567〜RS-573 は該当なし）、grnrngr/faq-card-8
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_8.html。RS-565 Q2・Q3（風雷丸）、
 *      RS-569 Q1・Q2、RS-570 Q1（RS-527 / RS-528 の項にも同じ Q）、RS-572 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール（R-ADD-06 合体、R-KW-RIDE-02/03 ライド、R-KW-RESIST-01 レジスト、R-TIME-01 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  attackTargets,
  BIG,
  canSkip,
  canStartRush,
  choiceIds,
  confirm,
  damageCards,
  deckCards,
  DEFS,
  endTurn,
  enter,
  enterBattleByEffect,
  expectCatalogText,
  expectStats,
  inst,
  legal,
  passEntry,
  pick,
  playOp,
  powerCards,
  reanimateTests,
  released,
  releasedCat,
  resistTests,
  resolveAll,
  rider,
  rideOptions,
  rushFromHand,
  rushVia,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
  zordDownTests,
} from "./RS8-560-581.helpers";
import type { GameState } from "../types/game";

const DA_HUMAN_L = sUnit("SPEC-DA-HUMAN-L", { category: "DA", size: "L", bp: 9000, features: ["人型"] });
const HUMAN_M = sUnit("SPEC-HUMAN-M", { category: "OT", size: "M", bp: 3000, features: ["人型"] });

/** ビークルのスペック（BP・SP なし）。 */
function expectVehicleStats(id: string, v: { name: string; category: string; size: string; powerCost: number; features: string[] }) {
  const d = DEFS[id]!;
  expect(d.name).toBe(v.name);
  expect(d.type).toBe("vehicle");
  expect(d.category).toBe(v.category);
  expect(d.size).toBe(v.size);
  expect(d.powerCost).toBe(v.powerCost);
  expect(d.features ?? []).toEqual(v.features);
  expect(d.rushAdditionalCondition).toBeUndefined();
}

// ===========================================================================
describe("RS-567 トライコンドル", () => {
  const TEXT =
    "【カラクリ忍法・消身の術】これが自軍エリアにある間、敵軍ターン中、合体を必要とする自軍Lユニットが撃破されたとき、捨札にするかわりに自軍パワーゾーンに送ってもよい。そうしたとき、相手がそのターンを終えたとき、この効果で自軍パワーゾーンに送ったユニットカードが自軍パワーゾーンにオモテ向きであれば、自分はそのユニットカードを自軍ラッシュエリアに出してもよい。";

  it("RS-567: カタログ本文・スペックが出典と一致（出典: atwiki/page-1188）", () => {
    expectCatalogText("RS-567", TEXT);
    expectStats("RS-567", { name: "トライコンドル", category: "MA", size: "M", bp: 4000, sp: undefined, powerCost: 6, features: ["メカ", "カラクリボール"] });
  });

  /** 敵軍ターンに、自軍バトルエリアの target が BP30000 にアタックされて撃破される。 */
  const destroyed = (target: string, p1: Partial<GameState["players"]["player1"]> = {}) => {
    const s = st(
      {
        activePlayer: "player2",
        player1: { battle: [inst(target, "t")], rush: [inst("RS-567", "tc")], deck: deckCards(5), ...p1 },
        player2: { battle: [inst("SPEC-BIG", "atk")], deck: deckCards(5, "e") },
      },
      [BIG],
    );
    return settle(attack(s, "SPEC-BIG:atk", `${target}:t`, "player2"));
  };

  // 既知の不具合: CARD-RS-567 【カラクリ忍法・消身の術】が未実装（撃破された合体 L ユニットはそのまま捨札になり、選択がない）
  it.fails("RS-567: 【消身の術】敵軍ターン中に撃破された合体を必要とする自軍 L ユニット（旋風神）を、捨札にするかわりに自軍パワーゾーンに送れる（出典: atwiki/page-1188「捨札にするかわりに自軍パワーゾーンに送ってもよい」）", () => {
    let s = destroyed("RS-095");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-567");
    const accept = legal(s).find((a) => a.type === "confirm_effect_choice" || a.type === "resolve_effect_choice");
    s = resolveAll(act(s, accept!));
    expect(zoneOf(s, "player1", "RS-095:t")).toBe("power");
    expect(s.players.player1.power.find((c) => c.instanceId === "RS-095:t")?.faceDown ?? false).toBe(false);
  });

  // 既知の不具合: CARD-RS-567 【カラクリ忍法・消身の術】が未実装（パワーゾーンに送る選択がないため、ターン終了時にラッシュエリアに出せない）
  it.fails("RS-567: 【消身の術】相手がそのターンを終えたとき、パワーゾーンにオモテ向きで残っていれば自軍ラッシュエリアに出せる（出典: atwiki/page-1188「相手がそのターンを終えたとき、…自軍ラッシュエリアに出してもよい」）", () => {
    let s = destroyed("RS-095");
    const accept = legal(s).find((a) => a.type === "confirm_effect_choice" || a.type === "resolve_effect_choice");
    s = resolveAll(act(s, accept!));
    s = endTurn(s);
    s = resolveAll(s, ["RS-095:t"]);
    const ok = legal(s).find((a) => (a.type === "confirm_effect_choice" || a.type === "resolve_effect_choice") && a.playerId === "player1");
    if (ok) s = resolveAll(act(s, ok));
    expect(zoneOf(s, "player1", "RS-095:t")).toBe("rush");
  });

  // 既知の不具合: CARD-RS-567 【カラクリ忍法・消身の術】が未実装（任意の選択自体が出ない）
  it.fails("RS-567: 【消身の術】任意 — パワーゾーンに送らないことを選べ、そのときは捨札になる（出典: atwiki/page-1188「送ってもよい」）", () => {
    let s = destroyed("RS-095");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player1", "RS-095:t")).toBe("discard");
  });

  it("RS-567: 【消身の術】合体を必要としない L ユニット（TST-UNIT-7）は対象外で、捨札になる（出典: atwiki/page-1188「合体を必要とする自軍Lユニット」）", () => {
    const s = destroyed("TST-UNIT-7");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player1", "TST-UNIT-7:t")).toBe("discard");
  });

  it("RS-567: 【消身の術】トライコンドルが自軍エリアになければ（捨札）発動しない（出典: atwiki/page-1188「これが自軍エリアにある間」）", () => {
    const s = st(
      { activePlayer: "player2", player1: { battle: [inst("RS-095", "t")], discard: [inst("RS-567", "tc")], deck: deckCards(5) }, player2: { battle: [inst("SPEC-BIG", "atk")], deck: deckCards(5, "e") } },
      [BIG],
    );
    const t = settle(attack(s, "SPEC-BIG:atk", "RS-095:t", "player2"));
    expect(t.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(t, "player1", "RS-095:t")).toBe("discard");
  });

  it("RS-567: 【消身の術】自軍ターン中に撃破されたときは発動しない（出典: atwiki/page-1188「敵軍ターン中、」）", () => {
    // 自軍ターン、旋風神（BP16000）が BP30000 の敵軍ユニットにアタックして撃破される。
    const s = st(
      { player1: { battle: [inst("RS-095", "t")], rush: [inst("RS-567", "tc")], deck: deckCards(5) }, player2: { battle: [inst("SPEC-BIG", "big")], deck: deckCards(5, "e") } },
      [BIG],
    );
    const t = settle(attack(s, "RS-095:t", "SPEC-BIG:big"));
    expect(t.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(t, "player1", "RS-095:t")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-568 風雷丸", () => {
  const TEXT =
    "【各々方、合体で御座る！】これが自軍エリアにある間、自軍ラッシュフェイズ中、自分の手札から、特徴「メカ」を持つLユニットのカードを1枚選び相手に見せ、表記された合体ユニットと同じカード名のMユニットのカードを、自分の手札からそれぞれ1枚ずつ選び、自軍ラッシュエリアに出してもよい。そうしたとき、相手に見せたLユニットのカードを、自軍パワーゾーンにダメージにして置く。";

  it("RS-568: カタログ本文・スペックが出典と一致（出典: atwiki/page-1189）", () => {
    expectCatalogText("RS-568", TEXT);
    expectStats("RS-568", { name: "風雷丸", category: "MA", size: "M", bp: 4000, sp: undefined, powerCost: 5, features: ["メカ", "人型", "カラクリボール"] });
  });

  const rushPhase = () =>
    st({
      phase: "rush",
      player1: {
        hand: [inst("RS-565", "gs"), inst("RS-568", "f2"), inst("RS-096", "h"), inst("RS-097", "l"), inst("RS-098", "d"), inst("RS-310", "b"), inst("RS-311", "s")],
        rush: [inst("RS-568", "fu")],
        command: releasedCat("MA", 1),
        deck: deckCards(3),
      },
      player2: { deck: deckCards(3, "e") },
    });

  // 既知の不具合: CARD-RS-568 【各々方、合体で御座る！】が未実装（ラッシュフェイズに起動する手段がない）
  it.fails("RS-568: 【各々方、合体で御座る！】自軍ラッシュフェイズ中、手札のメカ L ユニット（轟雷旋風神）を見せ、表記された合体ユニットと同名の M ユニットを手札から出す行動がある（出典: atwiki/page-1189）", () => {
    const s = rushPhase();
    expect(legal(s).some((a) => JSON.stringify(a).includes("RS-568:fu") || (JSON.stringify(a).includes("RS-565:gs") && a.type !== "initiate_command_payment"))).toBe(true);
  });

  it.todo(
    "RS-568: 【各々方、合体で御座る！】出したあと、見せた L ユニットのカードを自軍パワーゾーンにダメージにして置く（出典: atwiki/page-1189「そうしたとき、相手に見せたLユニットのカードを、自軍パワーゾーンにダメージにして置く」）— 効果が未実装で公開 API に起動手段がないため",
  );
  it.todo(
    "RS-568: 公式Q&A — 轟雷旋風神を見せる場合、手札に風雷丸・ハリケンホーク・ハリケンレオン・ハリケンドルフィン・ゴウライビートル・ゴウライスタッグがそれぞれ最低1枚ずつ必要（出典: grnrngr/faq-card-8 RS-565 Q2「はい、その通りです。」）— 効果が未実装で公開 API に起動手段がないため",
  );
  it.todo(
    "RS-568: 公式Q&A — ハリケン3体を旋風神として参照し、風雷丸・ゴウライビートル・ゴウライスタッグの3体だけを出すこともできる（出典: grnrngr/faq-card-8 RS-565 Q3「はい、可能です。」）— 効果が未実装で公開 API に起動手段がないため",
  );

  it("RS-568: 【各々方、合体で御座る！】自軍ラッシュフェイズ以外（バトルフェイズ）には使えない（出典: atwiki/page-1189「自軍ラッシュフェイズ中、」）", () => {
    const s = st({ player1: { hand: [inst("RS-565", "gs"), inst("RS-568", "f2"), inst("RS-310", "b"), inst("RS-311", "s")], rush: [inst("RS-568", "fu")], deck: deckCards(3) } });
    expect(legal(s).some((a) => JSON.stringify(a).includes("RS-565:gs"))).toBe(false);
  });
});

// ===========================================================================
describe("RS-569 スーパーデカレンジャーロボ", () => {
  const TEXT =
    "合体―デカバイクロボ（またはデカバイク）＋デカレンジャーロボ（またはパトストライカー＋パトジャイラー＋パトレーラー＋パトアーマー＋パトシグナー） 【ガトリングパンチ】自軍ターン中、これがバトルエリアに出たとき、オモテ向きの自軍パワーを好きな枚数選び捨札にしてもよい。そうしたとき、このターン、これは捨札にしたカード3枚につき「SP+1」される。";

  it("RS-569: カタログ本文・スペックが出典と一致（追加条件「自軍合体ユニットをパワーゾーンに送る」）（出典: atwiki/page-1230）", () => {
    expectCatalogText("RS-569", TEXT);
    expectStats("RS-569", { name: "スーパーデカレンジャーロボ", category: "OT", size: "L", bp: 23000, sp: 2, powerCost: "8+", features: ["メカ", "人型"], rushCondition: "discard_fusion_unit" });
    expect(DEFS["RS-569"]!.rushAdditionalCondition?.text).toBe("自軍合体ユニットをパワーゾーンに送る");
  });

  const rushState = (materials: string[], power = 8) =>
    st({ phase: "rush", player1: { hand: [inst("RS-569", "sd")], rush: materials.map((id) => inst(id, "m")), command: releasedCat("OT", 2), power: powerCards(power), deck: deckCards(3) } });

  it("RS-569: 合体 — デカバイクロボ＋デカレンジャーロボでラッシュできる（出典: atwiki/page-1230「合体―デカバイクロボ（またはデカバイク）＋デカレンジャーロボ」・R-ADD-06）", () => {
    const r = rushFromHand(rushState(["RS-571", "RS-042"]), "player1", "RS-569:sd");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-569:sd")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-571:m")).not.toBe("rush");
    expect(zoneOf(t, "player1", "RS-042:m")).not.toBe("rush");
  });

  // 既知の不具合: CARD-RS-569 追加条件「自軍合体ユニットをパワーゾーンに送る」が「捨札にする」として処理される（合体ユニットが捨札に行く）
  it.fails("RS-569: 追加条件 — 合体ユニットは捨札ではなくパワーゾーンに送られる（出典: atwiki/page-1230「追加条件：自軍合体ユニットをパワーゾーンに送る」）", () => {
    const r = rushFromHand(rushState(["RS-571", "RS-042"]), "player1", "RS-569:sd");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-569:sd")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-571:m")).toBe("power");
    expect(zoneOf(t, "player1", "RS-042:m")).toBe("power");
  });

  it("RS-569: 合体 — デカバイクロボのかわりにデカバイク（ビークル）、デカレンジャーロボのかわりにパトストライカー〜パトシグナーでもよい（出典: atwiki/page-1230「デカバイクロボ（またはデカバイク）」「（またはパトストライカー＋…＋パトシグナー）」）", () => {
    const r = rushFromHand(rushState(["RS-570", "RS-043", "RS-044", "RS-045", "RS-046", "RS-047"]), "player1", "RS-569:sd");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "RS-569:sd")).toBe("rush");
  });

  it("RS-569: 合体 — デカレンジャーロボがいなければラッシュできない（出典: atwiki/page-1230・R-ADD-06）", () => {
    expect(canStartRush(rushState(["RS-571"]), "player1", "RS-569:sd")).toBe(false);
  });

  it("RS-569: 必要パワー8+ — パワー7ではラッシュできない（出典: atwiki/page-1230「必要パワー：8+」）", () => {
    expect(canStartRush(rushState(["RS-571", "RS-042"], 7), "player1", "RS-569:sd")).toBe(false);
  });

  const entered = (faceUp: number, facedown = 0) =>
    enter(
      st({ player1: { rush: [inst("RS-569", "sd")], power: [...powerCards(faceUp), ...damageCards(facedown)], damage: facedown, deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }),
      "RS-569:sd",
    );

  /** 承認して、選択できるパワーを prefer の順に（無ければ先頭から）n 枚選ぶ。 */
  const gatling = (s: GameState, n: number): GameState => {
    let t = s;
    if (t.pendingEffectChoice?.kind === "confirm") t = confirm(t);
    for (let i = 0; i < n && t.pendingEffectChoice; i++) t = pick(t, t.pendingEffectChoice.validInstanceIds[0]!);
    if (t.pendingEffectChoice && legal(t).some((a) => a.type === "confirm_effect_choice")) t = confirm(t);
    return t;
  };

  it("RS-569: 【ガトリングパンチ】任意 — 捨札にしないことを選べ、パワーも SP（2）も変わらない（出典: atwiki/page-1230「捨札にしてもよい」）", () => {
    let s = entered(7);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-569");
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(s.players.player1.power).toHaveLength(7);
    expect(spOf(s, "player1", "RS-569:sd")).toBe(2);
  });

  // 既知の不具合: CARD-RS-569 【ガトリングパンチ】が未実装（承認してもパワーを選べず、何も捨札にならない）
  it.fails("RS-569: 【ガトリングパンチ】オモテ向きのパワーを6枚捨札にすると、このターン SP+2（SP4）になる（出典: atwiki/page-1230「捨札にしたカード3枚につき「SP+1」」）", () => {
    const s = gatling(entered(7), 6);
    expect(s.players.player1.discard).toHaveLength(6);
    expect(spOf(s, "player1", "RS-569:sd")).toBe(4);
  });

  // 既知の不具合: CARD-RS-569 【ガトリングパンチ】が未実装（承認してもパワーを選べず、何も捨札にならない）
  it.fails("RS-569: 【ガトリングパンチ】5枚なら3枚につき1回だけ数え、SP+1（SP3）（出典: atwiki/page-1230「3枚につき」）", () => {
    const s = gatling(entered(7), 5);
    expect(s.players.player1.discard).toHaveLength(5);
    expect(spOf(s, "player1", "RS-569:sd")).toBe(3);
  });

  // 既知の不具合: CARD-RS-569 【ガトリングパンチ】が未実装（パワーを選ぶ選択がない）
  it.fails("RS-569: 【ガトリングパンチ】選べるのはオモテ向きの自軍パワーだけ（ウラ向きのダメージは選べない）（出典: atwiki/page-1230「オモテ向きの自軍パワー」）", () => {
    let s = entered(2, 2);
    if (s.pendingEffectChoice?.kind === "confirm") s = confirm(s);
    expect(choiceIds(s)).toEqual(["TST-P:pw0", "TST-P:pw1"]);
  });

  it("RS-569: 【ガトリングパンチ】敵軍ターン中にバトルエリアに出ても発動しない（出典: atwiki/page-1230「自軍ターン中、」）", () => {
    const s0 = st({ activePlayer: "player2", player1: { rush: [inst("RS-569", "sd")], power: powerCards(6), deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    const s = enterBattleByEffect(s0, "player1", "RS-569:sd");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player1.power).toHaveLength(6);
  });

  // grnrngr/faq-card-8 RS-569 Q1「はい、できます。」
  it("RS-569: 公式Q&A — スーパーフォーメーションで、足りない合体ユニットをリリース状態の自軍コマンドから捨札にして追加条件を満たせる（出典: grnrngr/faq-card-8 RS-569 Q1）", () => {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-569", "sd"), inst("RS-347", "sf")],
        rush: [inst("RS-571", "f"), inst("RS-043", "f"), inst("RS-044", "f")],
        command: [...releasedCat("ET", 1), ...releasedCat("OT", 1), released("RS-045", "c"), released("RS-046", "c"), released("RS-047", "c")],
        power: powerCards(8),
        deck: deckCards(3),
      },
    });
    const sf = playOp(s, "player1", "RS-347:sf");
    expect(sf.ok).toBe(true);
    s = resolveAll(sf.state);
    const r = rushFromHand(s, "player1", "RS-569:sd");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "RS-569:sd")).toBe("rush");
  });

  // grnrngr/faq-card-8 RS-569 Q2「いいえ、できません。…2体合体として考えますので」
  it("RS-569: 公式Q&A — デカレンジャーロボ＋デカバイク（2体合体）としてはスーパーフォーメーションを使えない（出典: grnrngr/faq-card-8 RS-569 Q2）", () => {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-569", "sd"), inst("RS-347", "sf")],
        command: [...releasedCat("ET", 1), ...releasedCat("OT", 1), released("RS-042", "c"), released("RS-570", "c")],
        power: powerCards(8),
        deck: deckCards(3),
      },
    });
    const sf = playOp(s, "player1", "RS-347:sf");
    expect(sf.ok).toBe(true);
    s = resolveAll(sf.state);
    expect(canStartRush(s, "player1", "RS-569:sd")).toBe(false);
  });
});

// ===========================================================================
describe("RS-570 デカバイク", () => {
  const TEXT =
    "※DAを持たない特徴「人型」を持つLユニットは、ＲＣを持っていなくてもこのビークルにライドでき、それ以外のユニットはライドできない。 ※このビークルは合体ユニットとしてつかえる。 【ウィリー走行】これにライドしているLユニットは、必要パワーに「＋」を持たないユニットにアタックされない。";

  it("RS-570: カタログ本文・スペックが出典と一致（L ビークル・OT・必要パワー5）（出典: atwiki/page-1190）", () => {
    expectCatalogText("RS-570", TEXT);
    expectVehicleStats("RS-570", { name: "デカバイク", category: "OT", size: "L", powerCost: 5, features: ["メカ", "車両"] });
  });

  const rideState = () =>
    st(
      {
        turn: 3,
        player1: { rush: [inst("RS-570", "v"), inst("RS-095", "hu"), inst("TST-UNIT-7", "l7"), inst("SPEC-DA-HUMAN-L", "da"), inst("SPEC-HUMAN-M", "hm")], deck: deckCards(3) },
        player2: { deck: deckCards(3, "e") },
      },
      [DA_HUMAN_L, HUMAN_M],
    );

  // 既知の不具合: CARD-RS-570 RC なしでライドできる※が未実装（「人型」の L ユニットでもライドできない）
  it.fails("RS-570: ※ DA を持たない「人型」の L ユニット（旋風神）は RC がなくてもライドできる（出典: atwiki/page-1190「ＲＣを持っていなくてもこのビークルにライドでき」・R-KW-RIDE-02）", () => {
    expect(rideOptions(rideState())).toContain("RS-095:hu>RS-570:v");
  });

  it("RS-570: ※ それ以外（「人型」なしの L・DA の「人型」L・「人型」の M）はライドできない（出典: atwiki/page-1190「それ以外のユニットはライドできない」）", () => {
    const opts = rideOptions(rideState());
    for (const r of ["TST-UNIT-7:l7", "SPEC-DA-HUMAN-L:da", "SPEC-HUMAN-M:hm"]) expect(opts).not.toContain(`${r}>RS-570:v`);
  });

  it("RS-570: ※ 合体ユニットとしてつかえる — スーパーデカレンジャーロボの「デカバイクロボ（またはデカバイク）」になる（出典: atwiki/page-1190「このビークルは合体ユニットとしてつかえる」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-569", "sd")], rush: [inst("RS-570", "v"), inst("RS-042", "r")], command: releasedCat("OT", 2), power: powerCards(8), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-569:sd");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-569:sd")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-570:v")).not.toBe("rush");
  });

  /** 自軍バトルエリアに、デカバイクにライドした旋風神。敵軍ターン。 */
  const riding = (mounted = true) =>
    st({
      activePlayer: "player2",
      player1: { battle: mounted ? [rider("RS-095", "hu", "RS-570:v"), inst("RS-570", "v")] : [inst("RS-095", "hu")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-2", "c2"), inst("TST-UNIT-7", "c7")], deck: deckCards(3, "e") },
    });

  // 既知の不具合: CARD-RS-570 【ウィリー走行】が未実装（ライドしている L ユニットが「＋」なしのユニットにアタックされる）
  it.fails("RS-570: 【ウィリー走行】ライドしている L ユニットは、必要パワーに「＋」を持たないユニットにアタックされない（出典: atwiki/page-1190「必要パワーに「＋」を持たないユニットにアタックされない」）", () => {
    expect(attackTargets(riding(), "TST-UNIT-2:c2", "player2")).not.toContain("RS-095:hu");
  });

  it("RS-570: 【ウィリー走行】必要パワーに「＋」を持つユニット（7+）にはアタックされる（出典: atwiki/page-1190）", () => {
    expect(attackTargets(riding(), "TST-UNIT-7:c7", "player2")).toContain("RS-095:hu");
  });

  it("RS-570: 【ウィリー走行】ライドしていなければ、必要パワーに「＋」を持たないユニットにもアタックされる（出典: atwiki/page-1190「これにライドしているLユニットは」）", () => {
    expect(attackTargets(riding(false), "TST-UNIT-2:c2", "player2")).toContain("RS-095:hu");
  });

  // grnrngr/faq-card-8 RS-570 Q1「いいえ。ビークルにライドしているユニットが、さらに別のビークルにライドすることはできません。」
  it("RS-570: 公式Q&A — バルジオンにライドして「人型」の L ユニットになっているバイオハンター・シルバは、さらにデカバイクにライドできない（出典: grnrngr/faq-card-8 RS-570 Q1・R-KW-RIDE-03）", () => {
    const s = st({ turn: 3, player1: { rush: [rider("RS-528", "sv", "RS-527:bj"), inst("RS-527", "bj"), inst("RS-570", "v")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    expect(rideOptions(s)).not.toContain("RS-528:sv>RS-570:v");
  });
});

// ===========================================================================
describe("RS-571 デカバイクロボ", () => {
  const TEXT = "【ソードトルネード】これが自軍エリアにある間、自分か相手の山札がシャッフルされたとき、そのターン中、これは「SP1」になる。";

  it("RS-571: カタログ本文・スペックが出典と一致（追加条件「自軍「デカバイク」1体を捨札にする」）（出典: atwiki/page-1214）", () => {
    expectCatalogText("RS-571", TEXT);
    expectStats("RS-571", { name: "デカバイクロボ", category: "OT", size: "L", bp: 7000, sp: "special", powerCost: "6+", features: ["メカ", "人型"], rushCondition: "discard_named_unit" });
  });

  const rushState = (withBike: boolean, power = 6) =>
    st({ phase: "rush", player1: { hand: [inst("RS-571", "br")], rush: withBike ? [inst("RS-570", "v")] : [inst("TST-UNIT-0", "x")], command: releasedCat("OT", 1), power: powerCards(power), deck: deckCards(3) } });

  // 既知の不具合: CARD-RS-571 追加条件の素材にビークルの「デカバイク」を選べず、ラッシュできない
  it.fails("RS-571: 追加条件 — 自軍「デカバイク」1体を捨札にしてラッシュできる（出典: atwiki/page-1214「追加条件：自軍「デカバイク」1体を捨札にする」）", () => {
    const r = rushVia(rushState(true), "player1", "RS-571:br");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-571:br")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-570:v")).toBe("discard");
  });

  it("RS-571: 追加条件 — デカバイクがなければラッシュできない（出典: atwiki/page-1214・R-ADD-02）", () => {
    expect(canStartRush(rushState(false), "player1", "RS-571:br")).toBe(false);
  });

  it("RS-571: 必要パワー6+ — パワー5ではラッシュできない（出典: atwiki/page-1214「必要パワー：6+」）", () => {
    expect(canStartRush(rushState(true, 5), "player1", "RS-571:br")).toBe(false);
  });

  /** RS-349 スーパー戦隊アドレスブック（ET・必要パワー3。自軍ラッシュフェイズに使う）＝使用者の山札がシャッフルされる。 */
  const useAddressBook = (s: GameState, playerId: "player1" | "player2") => {
    const r = playOp(s, playerId, "RS-349:ab");
    expect(r.ok).toBe(true);
    let t = r.state;
    // 山札のカードを1枚選んで手札に加える（その後、山札をシャッフルする）。
    for (let i = 0; i < 4 && t.pendingEffectChoice; i++) t = pick(t, t.pendingEffectChoice.validInstanceIds[0]!);
    return settle(t);
  };

  it("RS-571: 【ソードトルネード】シャッフルがなければ SP「！」は 0（出典: atwiki/page-1214「SP：！」）", () => {
    const s = st({ player1: { battle: [inst("RS-571", "br")], deck: deckCards(3) } });
    expect(spOf(s, "player1", "RS-571:br")).toBe(0);
  });

  // 既知の不具合: CARD-RS-571 【ソードトルネード】が未実装（山札がシャッフルされても SP1 にならない）
  it.fails("RS-571: 【ソードトルネード】自分の山札がシャッフルされたとき、そのターン中 SP1 になる（出典: atwiki/page-1214「自分か相手の山札がシャッフルされたとき、そのターン中、これは「SP1」になる」）", () => {
    const s = useAddressBook(
      st({ phase: "rush", player1: { battle: [inst("RS-571", "br")], hand: [inst("RS-349", "ab")], command: releasedCat("ET", 1), power: powerCards(3), deck: [inst("TST-UNIT-0", "dk"), ...deckCards(3)] } }),
      "player1",
    );
    expect(zoneOf(s, "player1", "RS-349:ab")).toBe("discard");
    expect(spOf(s, "player1", "RS-571:br")).toBe(1);
  });

  // 既知の不具合: CARD-RS-571 【ソードトルネード】が未実装（相手の山札がシャッフルされても SP1 にならない）
  it.fails("RS-571: 【ソードトルネード】相手の山札がシャッフルされたときも SP1 になる（出典: atwiki/page-1214「自分か相手の山札」）", () => {
    const s = useAddressBook(
      st({
        phase: "rush",
        activePlayer: "player2",
        player1: { battle: [inst("RS-571", "br")], deck: deckCards(3) },
        player2: { hand: [inst("RS-349", "ab")], command: releasedCat("ET", 1, "ec"), power: powerCards(3, "ep"), deck: [inst("TST-UNIT-0", "edk"), ...deckCards(3, "e")] },
      }),
      "player2",
    );
    expect(zoneOf(s, "player2", "RS-349:ab")).toBe("discard");
    expect(spOf(s, "player1", "RS-571:br")).toBe(1);
  });
});

// ===========================================================================
describe("RS-572 デカマスター（2nd）", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札に「ドギー・クルーガー」のカードがあれば1枚選び、自軍ラッシュエリアに出す。 【ディーソードベガ】自軍ターン中、これがバトルエリアに出たとき、相手は1点ダメージを受けるか、自分自身のユニットを1体選び撃破するかを選ぶ。";
  const DOGGIE = "RS-318";

  it("RS-572: カタログ本文・スペックが出典と一致（出典: atwiki/page-1215）", () => {
    expectCatalogText("RS-572", TEXT);
    expectStats("RS-572", { name: "デカマスター（2nd）", category: "OT", size: "S", bp: 6500, sp: undefined, powerCost: "7-", features: ["男", "警察", "2nd"], rushCondition: "zord_down_discard_named" });
  });

  zordDownTests("RS-572", DOGGIE, "ドギー・クルーガー", "atwiki/page-1215", "OT");
  reanimateTests("RS-572", DOGGIE, "ドギー・クルーガー", "atwiki/page-1215");

  const entered = (enemyBattle = [inst("TST-UNIT-0", "e1")]) =>
    enter(st({ player1: { rush: [inst("RS-572", "dm")], deck: deckCards(3) }, player2: { battle: enemyBattle, deck: deckCards(3, "e") } }), "RS-572:dm");

  // 既知の不具合: CARD-RS-572 【ディーソードベガ】で相手に選択がなく、常に1点ダメージになる
  it.fails("RS-572: 【ディーソードベガ】選ぶのは相手（1点ダメージか、自分自身のユニット1体の撃破か）（出典: atwiki/page-1215「相手は…を選ぶ」）", () => {
    const s = entered();
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(s.players.player2.damage).toBe(0);
  });

  // 既知の不具合: CARD-RS-572 【ディーソードベガ】で相手に選択がなく、常に1点ダメージになる
  it.fails("RS-572: 【ディーソードベガ】相手が撃破を選べば、自分自身のユニットを1体選んで撃破し、ダメージは受けない（出典: atwiki/page-1215「自分自身のユニットを1体選び撃破する」）", () => {
    let s = entered();
    s = resolveAll(s, ["TST-UNIT-0:e1"]);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("discard");
    expect(s.players.player2.damage).toBe(0);
  });

  it("RS-572: 【ディーソードベガ】1点ダメージは相手が受ける（自分は受けない）（出典: atwiki/page-1215「相手は1点ダメージを受ける」）", () => {
    const s = resolveAll(entered([]));
    expect(s.players.player2.damage).toBe(1);
    expect(s.players.player1.damage).toBe(0);
  });

  // grnrngr/faq-card-8 RS-572 Q1「ユニットがいない場合は対象が取れない為、…自動的にダメージを受けることになります。」
  it("RS-572: 公式Q&A — 相手のユニットが1体もいなければ、撃破は選べず自動的に1点ダメージを受ける（出典: grnrngr/faq-card-8 RS-572 Q1）", () => {
    const s = entered([]);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-572: 【ディーソードベガ】敵軍ターン中にバトルエリアに出ても発動しない（出典: atwiki/page-1215「自軍ターン中、」）", () => {
    const s0 = st({ activePlayer: "player2", player1: { rush: [inst("RS-572", "dm")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e1")], deck: deckCards(3, "e") } });
    const s = enterBattleByEffect(s0, "player1", "RS-572:dm");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player2.damage).toBe(0);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e1")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-573 ファイヤーカイザー（2nd）", () => {
  const TEXT =
    "合体―マジフェニックス＋魔導馬バリキオン ※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【バリランサー】自軍ターン中、これがバトルエリアに出たとき、これをホールドしてもよい。そうしたとき、このターン、これは「SP2」になり、敵軍ラッシュエリアのユニットにアタックできる。";

  it("RS-573: カタログ本文・スペックが出典と一致（追加条件「自軍合体ユニットを捨札にする」）（出典: atwiki/page-1191）", () => {
    expectCatalogText("RS-573", TEXT);
    expectStats("RS-573", { name: "ファイヤーカイザー（2nd）", category: "MA", size: "L", bp: 6000, sp: "special", powerCost: "5+", features: ["魔法", "人型", "2nd"], rushCondition: "discard_fusion_unit" });
  });

  const rushState = (materials: string[], power = 5) =>
    st({ phase: "rush", player1: { hand: [inst("RS-573", "fk")], rush: materials.map((id) => inst(id, "m")), command: releasedCat("MA", 2), power: powerCards(power), deck: deckCards(3) } });

  it("RS-573: 合体 — マジフェニックス＋魔導馬バリキオンを捨札にしてラッシュできる（出典: atwiki/page-1191「合体―マジフェニックス＋魔導馬バリキオン」・R-ADD-06）", () => {
    const r = rushFromHand(rushState(["RS-576", "RS-114"]), "player1", "RS-573:fk");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-573:fk")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-576:m")).toBe("discard");
    expect(zoneOf(t, "player1", "RS-114:m")).toBe("discard");
  });

  it("RS-573: 合体 — マジレッド（2nd）は「マジフェニックス」として、魔導馬バリキオン（2nd）は合体ユニットとしてつかえる（出典: atwiki/page-1228「これは「マジフェニックス」としてつかえる」・atwiki/page-1195「このビークルは合体ユニットとしてつかえる」）", () => {
    const r = rushFromHand(rushState(["RS-577", "RS-581"]), "player1", "RS-573:fk");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "RS-573:fk")).toBe("rush");
  });

  it("RS-573: 合体 — 魔導馬バリキオンがいなければラッシュできない（出典: atwiki/page-1191・R-ADD-06）", () => {
    expect(canStartRush(rushState(["RS-576"]), "player1", "RS-573:fk")).toBe(false);
  });

  it("RS-573: 必要パワー5+ — パワー4ではラッシュできない（出典: atwiki/page-1191「必要パワー：5+」）", () => {
    expect(canStartRush(rushState(["RS-576", "RS-114"], 4), "player1", "RS-573:fk")).toBe(false);
  });

  resistTests("RS-573", "page-1191");

  const entered = () =>
    enter(st({ player1: { rush: [inst("RS-573", "fk")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "eb")], rush: [inst("TST-UNIT-0", "er")], deck: deckCards(3, "e") } }), "RS-573:fk");

  // 既知の不具合: CARD-RS-573 【バリランサー】がホールドの選択なしに自動適用される（ホールドもされない）
  it.fails("RS-573: 【バリランサー】任意 — ホールドするかどうかを選べる（出典: atwiki/page-1191「これをホールドしてもよい」）", () => {
    const s = entered();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-573");
    expect(canSkip(s)).toBe(true);
  });

  // 既知の不具合: CARD-RS-573 【バリランサー】でホールドされず、敵軍ラッシュエリアにアタックできず、SP も 2 にならない
  it.fails("RS-573: 【バリランサー】ホールドしたとき、このターン SP2 になり、敵軍ラッシュエリアのユニットにアタックできる（出典: atwiki/page-1191「そうしたとき、このターン、これは「SP2」になり、敵軍ラッシュエリアのユニットにアタックできる」）", () => {
    let s = entered();
    const accept = legal(s).find((a) => a.type === "confirm_effect_choice" || a.type === "resolve_effect_choice");
    if (accept) s = act(s, accept);
    s = passEntry(s);
    expect(s.players.player1.battle.find((c) => c.instanceId === "RS-573:fk")?.commandHeld).toBe(true);
    expect(spOf(s, "player1", "RS-573:fk")).toBe(2);
    expect(attackTargets(s, "RS-573:fk")).toContain("TST-UNIT-0:er");
  });

  // 既知の不具合: CARD-RS-573 【バリランサー】がホールドの選択なしに自動適用され、断れない
  it.fails("RS-573: 【バリランサー】ホールドしなければ SP「！」は 0 のまま（NC なし）（出典: atwiki/page-1191「そうしたとき」）", () => {
    let s = entered();
    if (canSkip(s)) s = skip(s);
    s = passEntry(s);
    expect(spOf(s, "player1", "RS-573:fk")).toBe(0);
    expect(s.players.player1.battle.find((c) => c.instanceId === "RS-573:fk")?.commandHeld ?? false).toBe(false);
  });

  it("RS-573: 【バリランサー】ホールドしなければ敵軍ラッシュエリアのユニットにはアタックできない（出典: atwiki/page-1191「そうしたとき」）", () => {
    let s = entered();
    if (canSkip(s)) s = skip(s);
    s = passEntry(s);
    expect(attackTargets(s, "RS-573:fk")).not.toContain("TST-UNIT-0:er");
  });

  it("RS-573: 【バリランサー】敵軍ターン中にバトルエリアに出ても発動しない（出典: atwiki/page-1191「自軍ターン中、」）", () => {
    const s0 = st({ activePlayer: "player2", player1: { rush: [inst("RS-573", "fk")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    const s = enterBattleByEffect(s0, "player1", "RS-573:fk");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player1.battle.find((c) => c.instanceId === "RS-573:fk")?.commandHeld ?? false).toBe(false);
  });
});
