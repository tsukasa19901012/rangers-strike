/**
 * カード別スペック: RS-574〜RS-581（第8弾「究極の八神」セイントカイザー〜魔導馬バリキオン（2nd））
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-RS575 一角聖馬ユニゴルオンの読み替え「⇒敵軍ラッシュエリアのユニットにアタックできる」）、
 *     grnrngr/faq-card-8（docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_8.html。
 *     RS-574 Q1、RK-575 Q1（読み替え）、RS-576 Q1（faq-card-1 の RS-441 の項にも同じ Q）、RS-580 Q1）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。RS-575 はライブ写し pages/1240.txt も同文）。
 *     RS-579 の Q&A（Q1・Q2）は atwiki/page-1194 の転載（公式ページの取得分に該当 Q なし）。
 *  3. docs/rules/*.md の一般ルール（R-ADD-06 合体、R-KW-RIDE-02 ライド、R-KW-RESIST-01 レジスト、R-CN-02 NC、R-TIME-01 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  attackTargets,
  BIG,
  bpOf,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  damageCards,
  deckCards,
  DEFS,
  enter,
  enterBattleByEffect,
  expectCatalogText,
  expectStats,
  heldUnit,
  inst,
  legal,
  nextPhase,
  passEntry,
  pick,
  powerCards,
  reanimateTests,
  releasedCat,
  resistTests,
  resolveAll,
  rider,
  rideOptions,
  rushFromHand,
  rushVia,

  skip,
  spOf,
  st,
  strike,
  sUnit,
  zoneOf,
  zordDownTests,
} from "./RS8-560-581.helpers";
import type { CardInstance, GameState } from "../types/game";

function fill(n: number, prefix = "f"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst("TST-UNIT-0", `${prefix}${i}`));
}

function dmg(n: number, prefix = "dm") {
  return { damage: n, power: damageCards(n, prefix) };
}

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

const DA_HUMAN_M = sUnit("SPEC-DA-HUMAN-M", { category: "DA", size: "M", bp: 3000, features: ["人型"] });
const HUMAN_S = sUnit("SPEC-HUMAN-S", { category: "MA", size: "S", bp: 2000, features: ["人型"] });
const BEAST_M = sUnit("SPEC-BEAST-M", { category: "MA", size: "M", bp: 3000, features: ["獣"] });

// ===========================================================================
describe("RS-574 セイントカイザー", () => {
  const TEXT =
    "合体―マジフェニックス＋一角聖馬ユニゴルオン 【セイントホーンフィニッシュ】自軍ターン中、これがバトルエリアに出たとき、DAを持つ敵軍ユニットを1体選び撃破する。ただし、必要パワーの数字が自軍ダメージの点数以下のユニットしか選べない。";

  it("RS-574: カタログ本文・スペックが出典と一致（追加条件「自軍合体ユニットを捨札にする」）（出典: atwiki/page-1218）", () => {
    expectCatalogText("RS-574", TEXT);
    expectStats("RS-574", { name: "セイントカイザー", category: "MA", size: "L", bp: 7000, sp: 1, powerCost: "4+", features: ["魔法", "人型"], rushCondition: "discard_fusion_unit" });
  });

  const rushState = (materials: string[], power = 4) =>
    st({ phase: "rush", player1: { hand: [inst("RS-574", "sk")], rush: materials.map((id) => inst(id, "m")), command: releasedCat("MA", 2), power: powerCards(power), deck: deckCards(3) } });

  it("RS-574: 合体 — マジフェニックス＋一角聖馬ユニゴルオン（ビークル）を捨札にしてラッシュできる（出典: atwiki/page-1218「合体―マジフェニックス＋一角聖馬ユニゴルオン」・atwiki/page-1240「このビークルは合体ユニットとしてつかえる」）", () => {
    const r = rushFromHand(rushState(["RS-576", "RS-575"]), "player1", "RS-574:sk");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-574:sk")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-576:m")).toBe("discard");
    expect(zoneOf(t, "player1", "RS-575:m")).toBe("discard");
  });

  it("RS-574: 合体 — マジレッド（2nd）を「マジフェニックス」として使える（出典: atwiki/page-1228「これは「マジフェニックス」としてつかえる」）", () => {
    const r = rushFromHand(rushState(["RS-577", "RS-575"]), "player1", "RS-574:sk");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "RS-574:sk")).toBe("rush");
  });

  it("RS-574: 合体 — ユニゴルオンがなければラッシュできない（出典: atwiki/page-1218・R-ADD-06）", () => {
    expect(canStartRush(rushState(["RS-576"]), "player1", "RS-574:sk")).toBe(false);
  });

  it("RS-574: 必要パワー4+ — パワー3ではラッシュできない（出典: atwiki/page-1218「必要パワー：4+」）", () => {
    expect(canStartRush(rushState(["RS-576", "RS-575"], 3), "player1", "RS-574:sk")).toBe(false);
  });

  const entered = (enemy: Partial<GameState["players"]["player2"]>, myDamage = 3) =>
    enter(st({ player1: { rush: [inst("RS-574", "sk")], ...dmg(myDamage), deck: deckCards(3) }, player2: { deck: deckCards(3, "e"), ...enemy } }), "RS-574:sk");

  it("RS-574: 【セイントホーンフィニッシュ】候補は DA を持ち、必要パワーの数字が自軍ダメージ以下の敵軍ユニットだけ（出典: atwiki/page-1218「ただし、必要パワーの数字が自軍ダメージの点数以下のユニットしか選べない」）", () => {
    // 自軍ダメージ3: 魔導馬バリキオン（DA・3）は可、暴走皇帝エグゾス（DA・6）は不可、TST-UNIT-0（WB・0）は DA でないので不可。
    const s = entered({ battle: [inst("RS-114", "bk"), inst("RS-216", "ex"), inst("TST-UNIT-0", "wb")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-574");
    expect(choiceIds(s)).toEqual(["RS-114:bk"]);
  });

  it("RS-574: 【セイントホーンフィニッシュ】選んだ DA の敵軍ユニットを撃破する（強制・見送れない）（出典: atwiki/page-1218「DAを持つ敵軍ユニットを1体選び撃破する」）", () => {
    let s = entered({ battle: [inst("RS-114", "bk")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-574");
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "RS-114:bk"));
    expect(zoneOf(s, "player2", "RS-114:bk")).toBe("discard");
  });

  it("RS-574: 【セイントホーンフィニッシュ】DA を持たない敵軍ユニット（TST-UNIT-0・WB）は選べない（出典: atwiki/page-1218「DAを持つ敵軍ユニット」）", () => {
    const s = entered({ battle: [inst("RS-114", "bk"), inst("TST-UNIT-0", "wb")] });
    expect(choiceIds(s)).not.toContain("TST-UNIT-0:wb");
  });

  it("RS-574: 【セイントホーンフィニッシュ】敵軍ラッシュエリアの DA ユニットも選べる（出典: atwiki/page-1218「敵軍ユニット」— 場所の限定なし）", () => {
    let s = entered({ rush: [inst("RS-114", "bk")] });
    expect(choiceIds(s)).toEqual(["RS-114:bk"]);
    s = resolveAll(pick(s, "RS-114:bk"));
    expect(zoneOf(s, "player2", "RS-114:bk")).toBe("discard");
  });

  it("RS-574: 【セイントホーンフィニッシュ】自軍ダメージ0なら必要パワー3の DA ユニットは選べない（出典: atwiki/page-1218「…以下のユニットしか選べない」）", () => {
    const s = entered({ battle: [inst("RS-114", "bk")] }, 0);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "RS-114:bk")).toBe("battle");
  });

  it("RS-574: 【セイントホーンフィニッシュ】参照するのは自軍ダメージで、敵軍ダメージではない（出典: atwiki/page-1218「自軍ダメージの点数」）", () => {
    const s = entered({ battle: [inst("RS-114", "bk")], ...dmg(5, "ed") }, 0);
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  it("RS-574: 【セイントホーンフィニッシュ】敵軍ターン中にバトルエリアに出ても発動しない（出典: atwiki/page-1218「自軍ターン中、」）", () => {
    const s0 = st({ activePlayer: "player2", player1: { rush: [inst("RS-574", "sk")], ...dmg(3), deck: deckCards(3) }, player2: { battle: [inst("RS-114", "bk")], deck: deckCards(3, "e") } });
    const s = enterBattleByEffect(s0, "player1", "RS-574:sk");
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "RS-114:bk")).toBe("battle");
  });

  it.todo(
    "RS-574: 公式Q&A — ゴートクラッシャーからコンビネーションしたときに参照する『合体に必要なユニットの数』は（ビークルのユニゴルオンも数えて）2体（出典: grnrngr/faq-card-8 RS-574 Q1「いいえ、2体になります。」）— RS-487【疾風豪快落とし】のコンビネーション（JC）を公開 API で起こし、選べる数を観測する手段がないため",
  );
});

// ===========================================================================
describe("RS-575 一角聖馬ユニゴルオン", () => {
  // 公式の読み替え（R-ERR-RS575、grnrngr/faq-card-8 RK-575 Q1）後の本文
  const TEXT =
    "※DAを持たない特徴「人型」を持つMユニットは、ＲＣを持っていなくてもこのビークルにライドでき、それ以外のユニットはライドできない。 ※このビークルは合体ユニットとしてつかえる。 【世界を駆ける力】これにライドしているユニットは、次の能力を得る⇒敵軍ラッシュエリアのユニットにアタックできる。";

  it("RS-575: カタログ本文（公式読み替え後）・スペックが出典と一致（M ビークル・MA・必要パワー4）（出典: R-ERR-RS575・atwiki/page-1240）", () => {
    expectCatalogText("RS-575", TEXT);
    expectVehicleStats("RS-575", { name: "一角聖馬ユニゴルオン", category: "MA", size: "M", powerCost: 4, features: ["魔法"] });
  });

  const rideState = () =>
    st(
      {
        turn: 3,
        player1: {
          rush: [inst("RS-575", "u"), inst("RS-576", "mp"), inst("RS-568", "fu"), inst("SPEC-DA-HUMAN-M", "da"), inst("SPEC-HUMAN-S", "hs"), inst("SPEC-BEAST-M", "bm")],
          deck: deckCards(3),
        },
        player2: { deck: deckCards(3, "e") },
      },
      [DA_HUMAN_M, HUMAN_S, BEAST_M],
    );

  it("RS-575: ※ DA を持たない「人型」の M ユニット（マジフェニックス・風雷丸）は RC がなくてもライドできる（出典: atwiki/page-1240「ＲＣを持っていなくてもこのビークルにライドでき」・R-KW-RIDE-02）", () => {
    const opts = rideOptions(rideState());
    expect(opts).toContain("RS-576:mp>RS-575:u");
    expect(opts).toContain("RS-568:fu>RS-575:u");
  });

  it("RS-575: ※ それ以外（DA の「人型」M・「人型」の S・「人型」なしの M）はライドできない（出典: atwiki/page-1240「それ以外のユニットはライドできない」）", () => {
    const opts = rideOptions(rideState());
    for (const r of ["SPEC-DA-HUMAN-M:da", "SPEC-HUMAN-S:hs", "SPEC-BEAST-M:bm"]) expect(opts).not.toContain(`${r}>RS-575:u`);
  });

  const riding = (mounted = true) =>
    st({
      player1: { battle: mounted ? [rider("RS-576", "mp", "RS-575:u"), inst("RS-575", "u")] : [inst("RS-576", "mp")], deck: deckCards(3) },
      player2: { rush: [inst("TST-UNIT-0", "er")], deck: deckCards(3, "e") },
    });

  // grnrngr/faq-card-8 RK-575 Q1「『敵軍ラッシュエリアのユニットにアタックできる。』と読み替えて」
  it("RS-575: 【世界を駆ける力】ライドしているユニットは敵軍ラッシュエリアのユニットにアタックできる（出典: R-ERR-RS575・grnrngr/faq-card-8 RK-575 Q1）", () => {
    expect(attackTargets(riding(), "RS-576:mp")).toContain("TST-UNIT-0:er");
  });

  it("RS-575: 【世界を駆ける力】ライドしていなければ敵軍ラッシュエリアのユニットにアタックできない（出典: atwiki/page-1240「これにライドしているユニットは」）", () => {
    expect(attackTargets(riding(false), "RS-576:mp")).not.toContain("TST-UNIT-0:er");
  });

  it("RS-575: 公式Q&A — 読み替えにより、自軍ラッシュエリアのユニットにはアタックできない（出典: grnrngr/faq-card-8 RK-575 Q1「自軍・敵軍を問わない…？」への読み替え回答）", () => {
    const s = st({
      player1: { battle: [rider("RS-576", "mp", "RS-575:u"), inst("RS-575", "u")], rush: [inst("TST-UNIT-0", "own")], deck: deckCards(3) },
      player2: { deck: deckCards(3, "e") },
    });
    expect(attackTargets(s, "RS-576:mp")).not.toContain("TST-UNIT-0:own");
  });
});

// ===========================================================================
describe("RS-576 マジフェニックス", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「マジレッド」のカードを1枚選び、自軍ラッシュエリアに出す。 ※これをラッシュしたとき、ホールド状態の自軍Sユニットをすべてリリースしてもよい。 【フェニックススピンキック】「SP1」これがストライクしたとき、自分は1枚ドローする。";
  const RED = "RS-057";

  it("RS-576: カタログ本文・スペックが出典と一致（出典: atwiki/page-1193）", () => {
    expectCatalogText("RS-576", TEXT);
    expectStats("RS-576", { name: "マジフェニックス", category: "MA", size: "M", bp: 4500, sp: "special", powerCost: "7-", comboNumber: 3, features: ["魔法", "人型"], rushCondition: "zord_down_discard_named" });
  });

  zordDownTests("RS-576", RED, "マジレッド", "atwiki/page-1193", "MA");
  reanimateTests("RS-576", RED, "マジレッド", "atwiki/page-1193");

  const rushed = () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-576", "mp")],
        battle: [heldUnit("TST-UNIT-0", "hs"), heldUnit("TST-UNIT-2", "hm")],
        command: releasedCat("MA", 1),
        power: powerCards(7),
        deck: deckCards(3),
      },
      player2: { battle: [heldUnit("TST-UNIT-0", "es")], deck: deckCards(3, "e") },
    });
    const r = rushFromHand(s, "player1", "RS-576:mp");
    expect(r.ok).toBe(true);
    return r.state;
  };
  const isHeld = (s: GameState, p: "player1" | "player2", id: string) => s.players[p].battle.find((c) => c.instanceId === id)?.commandHeld ?? false;

  it("RS-576: ※ ラッシュしたとき、ホールド状態の自軍 S ユニットをすべてリリースできる（M ユニット・敵軍ユニットはそのまま）（出典: atwiki/page-1193「ホールド状態の自軍Sユニットをすべてリリースしてもよい」）", () => {
    let s = rushed();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-576");
    const accept = legal(s).find((a) => a.type === "confirm_effect_choice" || a.type === "resolve_effect_choice");
    s = resolveAll(act(s, accept!));
    expect(isHeld(s, "player1", "TST-UNIT-0:hs")).toBe(false);
    expect(isHeld(s, "player1", "TST-UNIT-2:hm")).toBe(true);
    expect(isHeld(s, "player2", "TST-UNIT-0:es")).toBe(true);
  });

  it("RS-576: ※ 任意 — リリースしないことを選べる（出典: atwiki/page-1193「リリースしてもよい」）", () => {
    let s = rushed();
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(isHeld(s, "player1", "TST-UNIT-0:hs")).toBe(true);
  });

  const atThird = () => enter(st({ turn: 3, player1: { battle: fill(2), rush: [inst("RS-576", "mp")], deck: deckCards(5) }, player2: { deck: deckCards(3, "e") } }), "RS-576:mp");

  it("RS-576: 【フェニックススピンキック】3番目に出ると NC が成立して SP1（出典: atwiki/page-1193「CN：3」「「SP1」」・R-CN-02）", () => {
    expect(spOf(atThird(), "player1", "RS-576:mp")).toBe(1);
  });

  it("RS-576: 【フェニックススピンキック】NC 不成立（1番目）なら SP「！」は 0（出典: atwiki/page-1193「SP：！」・R-CN-02）", () => {
    const s = passEntry(enter(st({ player1: { rush: [inst("RS-576", "mp")], deck: deckCards(5) } }), "RS-576:mp"));
    expect(spOf(s, "player1", "RS-576:mp")).toBe(0);
  });

  it("RS-576: 【フェニックススピンキック】ストライクしたとき、自分は1枚ドローする（出典: atwiki/page-1193「これがストライクしたとき、自分は1枚ドローする」）", () => {
    const s = atThird();
    expect(canStrike(s, "RS-576:mp")).toBe(true);
    const t = resolveAll(strike(s, "RS-576:mp"));
    expect(t.players.player1.hand).toHaveLength(1);
    expect(t.players.player1.deck).toHaveLength(4);
  });

  it.todo(
    "RS-576: 公式Q&A — バトルコサック【コサックダンス】で手札に戻したマジレッドと「同じカード名」として、『マジフェニックスとしてつかえる』マジレッドに従いマジフェニックスをラッシュできる（出典: grnrngr/faq-card-8 RS-576 Q1「はい、可能です。」・faq-card-1 RS-441）— 自軍バトルフェイズ中にユニットをバトルエリアからラッシュエリアに戻す状況と【コサックダンス】の起動を公開 API で作れないため",
  );
});

// ===========================================================================
describe("RS-577 マジレッド（2nd）", () => {
  const TEXT =
    "※これは「マジフェニックス」としてつかえる。 ※レジスト（これがバトルで撃破されたとき、捨札にするかわりにこれをホールドしてその場に留めてもよい） 【フェイタル・ブレイド】「SP1」これがストライクしたとき、自分は1枚ドローする。";

  it("RS-577: カタログ本文・スペックが出典と一致（出典: atwiki/page-1228）", () => {
    expectCatalogText("RS-577", TEXT);
    expectStats("RS-577", { name: "マジレッド（2nd）", category: "MA", size: "S", bp: 2000, sp: "special", powerCost: 4, comboNumber: 3, features: ["レッド", "男", "魔法", "2nd"] });
  });

  it("RS-577: ※ 「マジフェニックス」としてつかえる — ファイヤーカイザー（RS-113）の合体ユニットになる（出典: atwiki/page-1228「これは「マジフェニックス」としてつかえる」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-113", "fk")], rush: [inst("RS-577", "mr"), inst("RS-114", "bk")], command: releasedCat("MA", 2), power: powerCards(6), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-113:fk");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-113:fk")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-577:mr")).toBe("discard");
  });

  resistTests("RS-577", "page-1228");

  const atThird = () => enter(st({ turn: 3, player1: { battle: fill(2), rush: [inst("RS-577", "mr")], deck: deckCards(5) }, player2: { deck: deckCards(3, "e") } }), "RS-577:mr");

  it("RS-577: 【フェイタル・ブレイド】3番目に出ると NC が成立して SP1（出典: atwiki/page-1228「CN：3」「「SP1」」・R-CN-02）", () => {
    expect(spOf(atThird(), "player1", "RS-577:mr")).toBe(1);
  });

  it("RS-577: 【フェイタル・ブレイド】NC 不成立（2番目）なら SP「！」は 0（出典: atwiki/page-1228「SP：！」・R-CN-02）", () => {
    const s = passEntry(enter(st({ player1: { battle: fill(1), rush: [inst("RS-577", "mr")], deck: deckCards(5) } }), "RS-577:mr"));
    expect(spOf(s, "player1", "RS-577:mr")).toBe(0);
  });

  it("RS-577: 【フェイタル・ブレイド】ストライクしたとき、自分は1枚ドローする（出典: atwiki/page-1228「これがストライクしたとき、自分は1枚ドローする」）", () => {
    const s = atThird();
    const t = resolveAll(strike(s, "RS-577:mr"));
    expect(t.players.player1.hand).toHaveLength(1);
    expect(t.players.player1.deck).toHaveLength(4);
  });
});

// ===========================================================================
describe("RS-578 レジェンドマジグリーンRA", () => {
  const TEXT =
    "※これが撃破されて捨札になったとき、自軍捨札から「レジェンドマジグリーン」のカードを1枚選び、自軍ラッシュエリアに出す。 【岩の装甲】これが自軍バトルエリアにある間、敵軍ターン中、「レジェンドマジグリーンRA」以外の特徴「魔法」を持つ自軍Sユニットはアタックされない。";
  const LMG = "RS-337";

  it("RS-578: カタログ本文・スペックが出典と一致（出典: atwiki/page-1220。カード名は本文の「レジェンドマジグリーンRA」表記に従う）", () => {
    expectCatalogText("RS-578", TEXT);
    expectStats("RS-578", {
      name: "レジェンドマジグリーンRA",
      category: "MA",
      size: "S",
      bp: 6500,
      sp: undefined,
      powerCost: "10-",
      features: ["グリーン", "男", "魔法", "レジェンドフォーム", "ロックアーマー"],
      rushCondition: "zord_down_discard_named",
    });
  });

  zordDownTests("RS-578", LMG, "レジェンドマジグリーン", "atwiki/page-1220", "MA", 10);
  reanimateTests("RS-578", LMG, "レジェンドマジグリーン", "atwiki/page-1220");

  const enemyTurn = (raZone: "battle" | "rush") =>
    st({
      activePlayer: "player2",
      player1: {
        battle: [...(raZone === "battle" ? [inst("RS-578", "ra")] : []), inst("RS-057", "red"), inst("TST-UNIT-0", "plain"), inst("RS-576", "phx")],
        rush: raZone === "rush" ? [inst("RS-578", "ra")] : [],
        deck: deckCards(3),
      },
      player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") },
    });

  it("RS-578: 【岩の装甲】敵軍ターン中、特徴「魔法」を持つ自軍 S ユニット（マジレッド）はアタックされない（出典: atwiki/page-1220「特徴「魔法」を持つ自軍Sユニットはアタックされない」）", () => {
    expect(attackTargets(enemyTurn("battle"), "TST-UNIT-7:atk", "player2")).not.toContain("RS-057:red");
  });

  it("RS-578: 【岩の装甲】RA 自身・「魔法」なしの S・「魔法」の M ユニットはアタックされる（出典: atwiki/page-1220「「レジェンドマジグリーンRA」以外の」「自軍Sユニット」）", () => {
    const t = attackTargets(enemyTurn("battle"), "TST-UNIT-7:atk", "player2");
    expect(t).toContain("RS-578:ra");
    expect(t).toContain("TST-UNIT-0:plain");
    expect(t).toContain("RS-576:phx");
  });

  it("RS-578: 【岩の装甲】RA が自軍バトルエリアになければ（ラッシュエリア）効果はない（出典: atwiki/page-1220「これが自軍バトルエリアにある間」）", () => {
    expect(attackTargets(enemyTurn("rush"), "TST-UNIT-7:atk", "player2")).toContain("RS-057:red");
  });
});

// ===========================================================================
describe("RS-579 ルナジェル", () => {
  const TEXT =
    "※これは自軍ターン中、バトルエリアに出られない。 【ルジュナ】これが自軍エリアにある間、BP8000以下のユニットは次の制限を受ける⇒ラッシュしたターンにストライクもアタックもできない。";
  const BP8000 = sUnit("SPEC-BP8000", { bp: 8000, powerCost: 0 });
  const BP8500 = sUnit("SPEC-BP8500", { bp: 8500, powerCost: 0 });

  it("RS-579: カタログ本文・スペックが出典と一致（出典: atwiki/page-1194）", () => {
    expectCatalogText("RS-579", TEXT);
    expectStats("RS-579", { name: "ルナジェル", category: "MA", size: "S", bp: 4000, sp: undefined, powerCost: 2, features: ["女", "魔法", "天空聖者"] });
  });

  it("RS-579: ※ 自軍ターン中はバトルエリアに出られない（出典: atwiki/page-1194「これは自軍ターン中、バトルエリアに出られない」）", () => {
    const s = st({ player1: { rush: [inst("RS-579", "ln")], command: releasedCat("MA", 1), deck: deckCards(3) } });
    expect(legal(s).some((a) => JSON.stringify(a).includes("RS-579:ln"))).toBe(false);
  });

  /** player の自軍ラッシュフェイズに手札の unit をラッシュし、バトルフェイズでバトルエリアに出す。 */
  const rushThenEnter = (unit: string, luna: "player1" | "player2" | "none", lunaZone: "rush" | "discard" = "rush") => {
    const lunaCards = [inst("RS-579", "ln")];
    let s = st(
      {
        turn: 3,
        phase: "rush",
        player1: {
          hand: [inst(unit, "u")],
          command: releasedCat("WB", 1),
          power: powerCards(7),
          deck: deckCards(3),
          ...(luna === "player1" ? { [lunaZone]: lunaCards } : {}),
        },
        player2: { battle: [inst("TST-UNIT-0", "eb")], deck: deckCards(3, "e"), ...(luna === "player2" ? { [lunaZone]: lunaCards } : {}) },
      },
      [BP8000, BP8500],
    );
    const r = rushFromHand(s, "player1", `${unit}:u`);
    expect(r.ok).toBe(true);
    s = nextPhase(resolveAll(r.state));
    expect(s.phase).toBe("battle");
    // バトル進入直後の行動ウィンドウ（pendingBattleEntry）でストライク・アタックの可否を見る。
    return enter(s, `${unit}:u`);
  };

  it("RS-579: 【ルジュナ】ラッシュしたターン、BP8000 以下のユニット（BP8000）はストライクもアタックもできない（出典: atwiki/page-1194「BP8000以下のユニットは…ラッシュしたターンにストライクもアタックもできない」）", () => {
    const s = rushThenEnter("SPEC-BP8000", "player1");
    expect(canStrike(s, "SPEC-BP8000:u")).toBe(false);
    expect(attackTargets(s, "SPEC-BP8000:u")).toEqual([]);
  });

  it("RS-579: 【ルジュナ】BP8000 を超えるユニット（BP8500）は制限を受けない（出典: atwiki/page-1194「BP8000以下」）", () => {
    const s = rushThenEnter("SPEC-BP8500", "player1");
    expect(canStrike(s, "SPEC-BP8500:u")).toBe(true);
    expect(attackTargets(s, "SPEC-BP8500:u")).toContain("TST-UNIT-0:eb");
  });

  it("RS-579: 【ルジュナ】敵軍のルナジェルでも、すべてのユニットが制限を受ける（出典: atwiki/page-1194「BP8000以下のユニットは」— 自軍・敵軍の限定なし）", () => {
    const s = rushThenEnter("SPEC-BP8000", "player2");
    expect(canStrike(s, "SPEC-BP8000:u")).toBe(false);
    expect(attackTargets(s, "SPEC-BP8000:u")).toEqual([]);
  });

  it("RS-579: 【ルジュナ】ルナジェルが自軍エリアになければ（捨札）制限はない（出典: atwiki/page-1194「これが自軍エリアにある間」）", () => {
    const s = rushThenEnter("SPEC-BP8000", "player1", "discard");
    expect(canStrike(s, "SPEC-BP8000:u")).toBe(true);
  });

  it("RS-579: 【ルジュナ】そのターンにラッシュしていないユニットは制限を受けない（出典: atwiki/page-1194「ラッシュしたターンに」）", () => {
    const s = enter(st({ turn: 3, player1: { rush: [inst("RS-579", "ln"), inst("TST-UNIT-0", "old")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "eb")], deck: deckCards(3, "e") } }), "TST-UNIT-0:old");
    expect(canStrike(s, "TST-UNIT-0:old")).toBe(true);
    expect(attackTargets(s, "TST-UNIT-0:old")).toContain("TST-UNIT-0:eb");
  });

  // atwiki/page-1194 Q1「はい、できます。」
  // 「アタックするかわりに」の効果は use_juu_kun_do（R-ATK-05・R-REPL-03）で発動する。
  it(
    "RS-579: Q&A — ルナジェルがあっても、このターンにラッシュした BP8000 以下の「侍」ユニットは恐竜折神からコンビネーションして【キョウリュウマル】を発動できる（出典: atwiki/page-1194 Q1「はい、できます。」）",
    () => {
      let s = st({
        turn: 3,
        phase: "rush",
        player1: { hand: [inst("RS-677", "sg")], rush: [inst("RS-579", "ln"), inst("XG3-034", "ko")], command: releasedCat("MA", 1), power: powerCards(7), deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-0", "eb")], deck: deckCards(3, "e") },
      });
      // シンケングリーン（侍・BP3000）をこのターンにラッシュする。
      const r = rushFromHand(s, "player1", "RS-677:sg");
      expect(r.ok).toBe(true);
      s = nextPhase(resolveAll(r.state));
      expect(s.phase).toBe("battle");
      // 恐竜折神（L）を出し、続けてシンケングリーンを出してコンビネーションする。
      s = passEntry(resolveAll(enter(s, "XG3-034:ko")));
      s = resolveAll(enter(s, "RS-677:sg"));
      // ルナジェルの制限でアタックはできない。
      expect(attackTargets(s, "RS-677:sg")).toEqual([]);
      // 【キョウリュウマル】: アタックするかわりに、BP の合計がシンケングリーンの BP 以下になるよう敵軍バトルエリアのユニットを選び撃破できる。
      expect(legal(s).some((a) => a.type === "use_juu_kun_do" && a.attackerInstanceId === "RS-677:sg")).toBe(true);
      s = resolveAll(act(s, { type: "use_juu_kun_do", playerId: "player1", attackerInstanceId: "RS-677:sg" }), ["TST-UNIT-0:eb"]);
      expect(zoneOf(s, "player2", "TST-UNIT-0:eb")).toBe("discard");
    },
  );
  it.todo(
    "RS-579: Q&A — ラッシュした電子星獣ドルをホールドしてビークルにし、リリースしてユニットに戻しても、そのターンはストライクもアタックもできない（出典: atwiki/page-1194 Q2「いいえ、それはできません。」）— XG2-082 は未実装（DSL は note_card のみ）で、自軍ラッシュフェイズ中にドルをホールドしてビークルにする／リリースしてユニットに戻す公開アクションが存在しない（ラッシュ後の合法手は end_phase のみ）ため、Q&A の手順を再現できない",
  );
});

// ===========================================================================
describe("RS-580 絶対神ン・マ", () => {
  const TEXT =
    "※これがユニットでなくなるとき、自分も相手も自分自身の捨札をすべて山札に戻してシャッフルする。 【全てを飲み込む飢餓】これをラッシュしたとき、次の効果を、自分、相手の順に行う⇒自分自身の山札の枚数が2枚以上あれば、自分自身の山札の上から1枚ずつひいて、ウラ向きのまま2つの束に交互に振り分ける。その後、2つの束をそれぞれ見て、どちらか1つの束を選び、シャッフルする。これが自軍エリアにある間、選んだ束を自分自身の山札として扱い、もう1つの束は捨札にする。";
  const EXOS = "RS-216"; // 暴走皇帝エグゾス（DA・L・BP8000・必要パワー6）

  it("RS-580: カタログ本文・スペックが出典と一致（追加条件「ダークアライアンスを持つ自軍Lユニット1体を捨札にする」）（出典: atwiki/page-1219）", () => {
    expectCatalogText("RS-580", TEXT);
    expectStats("RS-580", { name: "絶対神ン・マ", category: "DA", size: "XL", bp: 8000, sp: 1, powerCost: "9+", features: ["人型"], rushCondition: "discard_category_l_unit" });
  });

  const rushState = (material: string, power = 9, decks: [number, number] = [5, 5]) =>
    st({
      phase: "rush",
      player1: { hand: [inst("RS-580", "nm")], rush: [inst(material, "m")], command: releasedCat("DA", 1), power: powerCards(power), deck: deckCards(decks[0]) },
      player2: { deck: deckCards(decks[1], "e") },
    });

  it("RS-580: 追加条件 — DA を持つ自軍 L ユニット（暴走皇帝エグゾス）を捨札にしてラッシュできる（出典: atwiki/page-1219・R-ADD-02）", () => {
    const r = rushVia(rushState(EXOS), "player1", "RS-580:nm");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-580:nm")).toBe("rush");
    expect(zoneOf(t, "player1", `${EXOS}:m`)).toBe("discard");
  });

  it("RS-580: 追加条件 — DA を持たない L ユニット（TST-UNIT-7・WB）では満たせない（出典: atwiki/page-1219「ダークアライアンスを持つ自軍Lユニット」）", () => {
    expect(canStartRush(rushState("TST-UNIT-7"), "player1", "RS-580:nm")).toBe(false);
  });

  it("RS-580: 必要パワー9+ — パワー8ではラッシュできない（出典: atwiki/page-1219「必要パワー：9+」）", () => {
    expect(canStartRush(rushState(EXOS, 8), "player1", "RS-580:nm")).toBe(false);
  });

  const deckIds = (s: GameState, p: "player1" | "player2") => s.players[p].deck.map((c) => c.instanceId);

  it("RS-580: 【全てを飲み込む飢餓】ラッシュしたとき、自分と相手は山札を2つの束に分け、選んだ束を山札、もう1つを捨札にする（山札4枚→2枚）（出典: atwiki/page-1219）", () => {
    const r = rushVia(rushState(EXOS, 9, [4, 4]), "player1", "RS-580:nm");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(deckIds(t, "player1")).toHaveLength(2);
    expect(deckIds(t, "player2")).toHaveLength(2);
    expect(t.players.player1.discard.filter((c) => c.instanceId.startsWith("TST-OP:dk"))).toHaveLength(2);
    expect(t.players.player2.discard.filter((c) => c.instanceId.startsWith("TST-OP:e"))).toHaveLength(2);
  });

  it("RS-580: 【全てを飲み込む飢餓】山札が1枚しかないプレイヤーには何も起きない（出典: atwiki/page-1219「自分自身の山札の枚数が2枚以上あれば」）", () => {
    const r = rushVia(rushState(EXOS, 9, [1, 1]), "player1", "RS-580:nm");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(deckIds(t, "player1")).toHaveLength(1);
    expect(deckIds(t, "player2")).toHaveLength(1);
  });

  it.todo(
    "RS-580: 【全てを飲み込む飢餓】効果は自分→相手の順に行い、各自が束を見て選ぶ。ン・マが自軍エリアにある間だけ選んだ束を山札として扱う（出典: atwiki/page-1219「自分、相手の順に行う」「これが自軍エリアにある間、選んだ束を自分自身の山札として扱い」）— 束の中身を見て選ぶ順序と、ン・マが場を離れた後の「山札として扱う」期間の扱いを公開 API で観測できないため",
  );

  /** 敵軍ターン、自軍バトルエリアのン・マが attacker にアタックされる。 */
  const attacked = (attacker: string) => {
    const s = st(
      {
        activePlayer: "player2",
        player1: { battle: [inst("RS-580", "nm")], discard: [inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b")], deck: deckCards(3) },
        player2: { battle: [inst(attacker, "atk")], discard: [inst("TST-UNIT-0", "c")], deck: deckCards(3, "e") },
      },
      [BIG],
    );
    return resolveAll(attack(s, `${attacker}:atk`, "RS-580:nm", "player2"));
  };

  it("RS-580: ※ ユニットでなくなるとき（撃破）、自分も相手も捨札をすべて山札に戻してシャッフルする（ン・マ自身はその後で捨札になる）（出典: atwiki/page-1219「これがユニットでなくなるとき、自分も相手も自分自身の捨札をすべて山札に戻してシャッフルする」・R-TIME-01）", () => {
    const s = attacked("SPEC-BIG");
    expect(zoneOf(s, "player1", "RS-580:nm")).toBe("discard");
    expect(s.players.player1.discard.map((c) => c.instanceId)).toEqual(["RS-580:nm"]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:a")).toBe("deck");
    expect(zoneOf(s, "player2", "TST-UNIT-0:c")).toBe("deck");
  });

  // grnrngr/faq-card-8 RS-580 Q1「はい、その通りです。」（捨札になる前に※が実行され、その後お互いの捨札になる）
  it("RS-580: 公式Q&A — 暴走皇帝エグゾスと相討ちになったとき、捨札が山札に戻ってから、ン・マとエグゾスがそれぞれの捨札になる（出典: grnrngr/faq-card-8 RS-580 Q1）", () => {
    const s = attacked(EXOS);
    expect(s.players.player1.discard.map((c) => c.instanceId)).toEqual(["RS-580:nm"]);
    expect(s.players.player2.discard.map((c) => c.instanceId)).toEqual([`${EXOS}:atk`]);
    expect(zoneOf(s, "player1", "TST-UNIT-0:a")).toBe("deck");
    expect(zoneOf(s, "player2", "TST-UNIT-0:c")).toBe("deck");
  });

  it("RS-580: ※ ユニットのまま場に残っていれば捨札は戻らない（出典: atwiki/page-1219「ユニットでなくなるとき」）", () => {
    const s = st({ player1: { battle: [inst("RS-580", "nm")], discard: [inst("TST-UNIT-0", "a")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    expect(zoneOf(s, "player1", "TST-UNIT-0:a")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-581 魔導馬バリキオン（2nd）", () => {
  const TEXT =
    "※特徴「人型」を持つMユニットは、ＲＣを持っていなくてもこのビークルにライドでき、それ以外のユニットはライドできない。 ※このビークルは合体ユニットとしてつかえる。 【1500万馬力】これにライドしているユニットは、敵軍ターン中、BP+1500される。";

  it("RS-581: カタログ本文・スペックが出典と一致（M ビークル・DA・必要パワー2）（出典: atwiki/page-1195）", () => {
    expectCatalogText("RS-581", TEXT);
    expectVehicleStats("RS-581", { name: "魔導馬バリキオン（2nd）", category: "DA", size: "M", powerCost: 2, features: ["魔法", "2nd"] });
  });

  const rideState = () =>
    st(
      {
        turn: 3,
        player1: { rush: [inst("RS-581", "bk"), inst("RS-576", "mp"), inst("SPEC-DA-HUMAN-M", "da"), inst("SPEC-HUMAN-S", "hs"), inst("SPEC-BEAST-M", "bm")], deck: deckCards(3) },
        player2: { deck: deckCards(3, "e") },
      },
      [DA_HUMAN_M, HUMAN_S, BEAST_M],
    );

  it("RS-581: ※ 「人型」の M ユニットは（DA でも）RC がなくてもライドできる（出典: atwiki/page-1195「特徴「人型」を持つMユニットは、ＲＣを持っていなくてもこのビークルにライドでき」）", () => {
    const opts = rideOptions(rideState());
    expect(opts).toContain("RS-576:mp>RS-581:bk");
    expect(opts).toContain("SPEC-DA-HUMAN-M:da>RS-581:bk");
  });

  it("RS-581: ※ それ以外（「人型」の S・「人型」なしの M）はライドできない（出典: atwiki/page-1195「それ以外のユニットはライドできない」）", () => {
    const opts = rideOptions(rideState());
    for (const r of ["SPEC-HUMAN-S:hs", "SPEC-BEAST-M:bm"]) expect(opts).not.toContain(`${r}>RS-581:bk`);
  });

  const riding = (activePlayer: "player1" | "player2", mounted = true) =>
    st({
      activePlayer,
      player1: { battle: mounted ? [rider("RS-576", "mp", "RS-581:bk"), inst("RS-581", "bk")] : [inst("RS-576", "mp")], deck: deckCards(3) },
      player2: { deck: deckCards(3, "e") },
    });

  it("RS-581: 【1500万馬力】ライドしているユニットは敵軍ターン中 BP+1500（マジフェニックス 4500→6000）（出典: atwiki/page-1195「敵軍ターン中、BP+1500される」）", () => {
    expect(bpOf(riding("player2"), "player1", "RS-576:mp")).toBe(6000);
  });

  it("RS-581: 【1500万馬力】自軍ターン中は BP+1500 されない（出典: atwiki/page-1195「敵軍ターン中、」）", () => {
    expect(bpOf(riding("player1"), "player1", "RS-576:mp")).toBe(4500);
  });

  it("RS-581: 【1500万馬力】ライドしていなければ BP+1500 されない（出典: atwiki/page-1195「これにライドしているユニットは」）", () => {
    expect(bpOf(riding("player2", false), "player1", "RS-576:mp")).toBe(4500);
  });

  it("RS-581: ※ 合体ユニットとしてつかえる — ファイヤーカイザー（RS-113）の「魔導馬バリキオン」になる（出典: atwiki/page-1195「このビークルは合体ユニットとしてつかえる」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-113", "fk")], rush: [inst("RS-576", "mp"), inst("RS-581", "bk")], command: releasedCat("MA", 2), power: powerCards(6), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-113:fk");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-113:fk")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-581:bk")).toBe("discard");
  });
});

