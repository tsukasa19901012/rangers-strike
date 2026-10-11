/**
 * カード別スペック: RS-488〜RS-494（第7弾「七忍の炎陣」ハリケンウィンガー〜縁切り忍者シラーンス）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-7（RS-488〜RS-494 の Q はない）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし。Q&A 欄なし）
 *  3. docs/rules/*.md の一般ルール（R-KW-RIDE-02 ライドできるユニット、R-KW-RIDE-05 ライドオフ、R-CN-02 NC、R-RUSH-30 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  DEFS,
  act,
  attackTargets,
  bpOf,
  canSkip,
  canStartRush,
  choiceIds,
  damageCards,
  deckCards,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  inst,
  legal,
  pick,
  powerCards,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  st,
  sUnit,
  zoneOf,
} from "./RS7-474-494.helpers";
import type { CardInstance, GameState } from "../types/game";

const NINJA_MA = sUnit("SPEC-NINJA", { category: "MA", features: ["忍者"] });
const PLAIN_MA = sUnit("SPEC-PLAIN", { category: "MA", features: ["男"] });
const NINJA_M = sUnit("SPEC-NINJA-M", { category: "MA", features: ["忍者"], size: "M" });
const RC_UNIT = sUnit("SPEC-RC", { category: "WB", comboNumber: "RC" as unknown as number });
const DA_S = sUnit("SPEC-DA", { category: "DA", features: ["男"], bp: 2000 });
const DA_M = sUnit("SPEC-DA-M", { category: "DA", size: "M" });
const WB_S = sUnit("SPEC-WB", { category: "WB" });
const SPECS = [NINJA_MA, PLAIN_MA, NINJA_M, RC_UNIT, DA_S, DA_M, WB_S];

const canMount = (s: GameState, rider: string, vehicle: string) =>
  legal(s).some(
    (a) => a.type === "mount_ride" && a.riderInstanceId === rider && a.vehicleInstanceId === vehicle,
  );

const mountState = (vehicle: string, rider: string) =>
  st(
    { player1: { rush: [inst(vehicle, "v"), inst(rider, "r")], deck: deckCards(5) }, player2: { deck: deckCards(5, "e") } },
    SPECS,
  );

/** ライドした状態（ビークル → ライドしているユニット）でバトルエリアにある。 */
const ridden = (vehicle: string, rider: string): CardInstance[] => [
  inst(vehicle, "v"),
  { ...inst(rider, "r"), mountedOnInstanceId: `${vehicle}:v` },
];

function expectVehicle(id: string, v: { name: string; category: string; powerCost: number; features: string[] }) {
  const d = DEFS[id]!;
  expect(d.name).toBe(v.name);
  expect(d.type).toBe("vehicle");
  expect(d.category).toBe(v.category);
  expect(d.size).toBe("S");
  expect(d.powerCost).toBe(v.powerCost);
  expect(d.features).toEqual(v.features);
}

// ===========================================================================
describe("RS-488 ハリケンウィンガー", () => {
  const TEXT =
    "※特徴「忍者」を持つ自軍SユニットはＲＣを持っていなくてもこのビークルにライドできる。【滑空】これにライドしているSユニットは次の能力を得る⇒これはSユニットにアタックされない。";

  it("RS-488: カタログ本文・スペック（S ビークル・MA・必要パワー1・メカ／航空機）が出典と一致（出典: atwiki/page-810）", () => {
    expectCatalogText("RS-488", TEXT);
    expectVehicle("RS-488", { name: "ハリケンウィンガー", category: "MA", powerCost: 1, features: ["メカ", "航空機"] });
  });

  it("RS-488: ※ RC を持たない特徴「忍者」の自軍 S ユニットはライドできる（出典: atwiki/page-810「特徴「忍者」を持つ自軍SユニットはＲＣを持っていなくても」）", () => {
    expect(canMount(mountState("RS-488", "SPEC-NINJA"), "SPEC-NINJA:r", "RS-488:v")).toBe(true);
  });

  it("RS-488: ※ RC を持たない「忍者」でない S ユニットはライドできない（出典: atwiki/page-810・R-KW-RIDE-02）", () => {
    expect(canMount(mountState("RS-488", "SPEC-PLAIN"), "SPEC-PLAIN:r", "RS-488:v")).toBe(false);
  });

  it("RS-488: ※ 「忍者」でも M ユニットはライドできない（出典: atwiki/page-810「Sユニットは」・R-KW-RIDE-02）", () => {
    expect(canMount(mountState("RS-488", "SPEC-NINJA-M"), "SPEC-NINJA-M:r", "RS-488:v")).toBe(false);
  });

  it("RS-488: RC を持つユニットはライドできる（出典: R-KW-RIDE-02「RC を持つユニットか…」）", () => {
    expect(canMount(mountState("RS-488", "SPEC-RC"), "SPEC-RC:r", "RS-488:v")).toBe(true);
  });

  const winger = (rider: CardInstance[]) =>
    st(
      {
        activePlayer: "player2",
        player1: { battle: rider, deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-0", "es"), inst("TST-UNIT-2", "em")], deck: deckCards(3, "e") },
      },
      SPECS,
    );

  it("RS-488: 【滑空】ライドしている S ユニットは S ユニットにアタックされない（出典: atwiki/page-810「これはSユニットにアタックされない」）", () => {
    const s = winger(ridden("RS-488", "SPEC-NINJA"));
    expect(attackTargets(s, "TST-UNIT-0:es", "player2")).not.toContain("SPEC-NINJA:r");
  });

  it("RS-488: 【滑空】ライドしている S ユニットも M ユニットにはアタックされる（出典: atwiki/page-810「Sユニットにアタックされない」）", () => {
    const s = winger(ridden("RS-488", "SPEC-NINJA"));
    expect(attackTargets(s, "TST-UNIT-2:em", "player2")).toContain("SPEC-NINJA:r");
  });

  it("RS-488: 【滑空】ライドしていない（ライドオフ後の）S ユニットは S ユニットにアタックされる（出典: atwiki/page-810「これにライドしているSユニットは」）", () => {
    const s = winger([inst("RS-488", "v"), inst("SPEC-NINJA", "r")]);
    expect(attackTargets(s, "TST-UNIT-0:es", "player2")).toContain("SPEC-NINJA:r");
  });
});

// ===========================================================================
describe("RS-489 二の槍チュウズーボ", () => {
  const TEXT =
    "【宇宙忍法・箱次元】敵軍バトルエリアからSユニットを2体選び、選んだ2体のユニットの特徴が2つ以上同じなら、選んだ2体を敵軍の山札の下に好きな順番で戻してもよい。";

  it("RS-489: カタログ本文・スペックが出典と一致（出典: atwiki/page-814）", () => {
    expectCatalogText("RS-489", TEXT);
    expectStats("RS-489", {
      name: "二の槍チュウズーボ",
      category: "DA",
      size: "S",
      bp: 4000,
      sp: undefined,
      powerCost: 2,
      comboNumber: 2,
      features: ["暗黒七本槍", "男", "忍者"],
      rushCondition: undefined,
    });
  });

  const TWO_A = sUnit("SPEC-MN-A", { features: ["男", "忍者", "レッド"] });
  const TWO_B = sUnit("SPEC-MN-B", { features: ["男", "忍者"] });
  const ONE = sUnit("SPEC-M-ONLY", { features: ["男", "ブルー"] });
  const MNM = sUnit("SPEC-MN-M", { features: ["男", "忍者"], size: "M" });

  /** 自軍バトルフェイズ: チュウズーボを position 番目に出す。 */
  const zuubo = (enemyBattle: CardInstance[], position: 1 | 2 = 2) =>
    enter(
      st(
        {
          player1: { battle: position === 2 ? fillers(1) : [], rush: [inst("RS-489", "zb")], deck: deckCards(5) },
          player2: { battle: enemyBattle, rush: [inst("SPEC-MN-A", "rushA")], deck: [inst("TST-OP", "edeck")] },
        },
        [TWO_A, TWO_B, ONE, MNM],
      ),
      "RS-489:zb",
    );

  it("RS-489: 【宇宙忍法・箱次元】NC 成立時、敵軍バトルエリアの S ユニットだけを選べる（ラッシュエリア・M は不可）（出典: atwiki/page-814「敵軍バトルエリアからSユニットを2体選び」）", () => {
    const s = zuubo([inst("SPEC-MN-A", "a"), inst("SPEC-MN-B", "b"), inst("SPEC-MN-M", "m")]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-489");
    expect(choiceIds(s)).toEqual(["SPEC-MN-A:a", "SPEC-MN-B:b"]);
  });

  it("RS-489: 【宇宙忍法・箱次元】選んだ2体の特徴が2つ以上同じ（男・忍者）なら、2体を敵軍の山札の下に戻せる（出典: atwiki/page-814「選んだ2体を敵軍の山札の下に好きな順番で戻してもよい」）", () => {
    const s = resolveAll(zuubo([inst("SPEC-MN-A", "a"), inst("SPEC-MN-B", "b")]), ["SPEC-MN-A:a", "SPEC-MN-B:b"]);
    expect(zoneOf(s, "player2", "SPEC-MN-A:a")).toBe("deck");
    expect(zoneOf(s, "player2", "SPEC-MN-B:b")).toBe("deck");
    expect(s.players.player2.deck[0]?.instanceId).toBe("TST-OP:edeck");
  });

  it("RS-489: 【宇宙忍法・箱次元】同じ特徴が1つだけ（男）なら戻らない（出典: atwiki/page-814「特徴が2つ以上同じなら」）", () => {
    const s = resolveAll(zuubo([inst("SPEC-MN-A", "a"), inst("SPEC-M-ONLY", "o")]), ["SPEC-MN-A:a", "SPEC-M-ONLY:o"]);
    expect(zoneOf(s, "player2", "SPEC-MN-A:a")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-M-ONLY:o")).toBe("battle");
  });

  it("RS-489: 【宇宙忍法・箱次元】「戻してもよい」— 戻さないことを選べる（出典: atwiki/page-814）", () => {
    let s = zuubo([inst("SPEC-MN-A", "a"), inst("SPEC-MN-B", "b")]);
    for (let i = 0; i < 4 && s.pendingEffectChoice?.sourceCardId === "RS-489"; i++) {
      expect(canSkip(s)).toBe(true);
      s = skip(s);
    }
    s = settle(s);
    expect(s.players.player2.battle).toHaveLength(2);
  });

  it("RS-489: 【宇宙忍法・箱次元】NC 不成立（1番目）では発動しない（出典: atwiki/page-814「CN：2」・R-CN-02）", () => {
    const s = resolveAll(zuubo([inst("SPEC-MN-A", "a"), inst("SPEC-MN-B", "b")], 1), ["SPEC-MN-A:a", "SPEC-MN-B:b"]);
    expect(s.players.player2.battle).toHaveLength(2);
  });
});

// ===========================================================================
describe("RS-490 三の槍マンマルバ幼体", () => {
  const TEXT =
    "【予言】これが自軍エリアにある間、敵軍ターン中、敵軍ユニットがラッシュされたとき、自軍ユニットの数が敵軍ユニットの数より少なければ、次の効果を発動できる⇒自軍山札の上から1枚オモテにする。オモテにしたカードが、ラッシュされた敵軍ユニットと同じ特徴を1つ以上持つユニットカードなら、自軍ラッシュエリアに出す。（ただし追加条件は満たすこと）。出せなかった場合は、捨札にする。";

  it("RS-490: カタログ本文・スペックが出典と一致（出典: atwiki/page-813）", () => {
    expectCatalogText("RS-490", TEXT);
    expectStats("RS-490", {
      name: "三の槍マンマルバ幼体",
      category: "DA",
      size: "S",
      bp: 1000,
      sp: undefined,
      powerCost: 3,
      features: ["暗黒七本槍", "男", "忍者"],
      rushCondition: undefined,
    });
  });

  /** 敵軍ラッシュフェイズ: 相手がハリケンレッド（レッド／男／忍者）をラッシュする。自軍山札の上は top。 */
  const enemyRush = (top: string, opts: { enemyUnits?: number; ownUnits?: number; mamaZone?: "rush" | "hand" } = {}) => {
    const s = st(
      {
        activePlayer: "player2",
        phase: "rush",
        player1: {
          [opts.mamaZone ?? "rush"]: [inst("RS-490", "mm")],
          battle: fillers(opts.ownUnits ?? 0, "own"),
          deck: [inst(top, "top"), ...deckCards(3)],
        },
        player2: {
          hand: [inst("RS-099", "red")],
          rush: fillers(opts.enemyUnits ?? 1, "en"),
          command: releasedCat("MA", 2),
          power: powerCards(2),
          deck: deckCards(5, "e"),
        },
      },
      SPECS,
    );
    const r = rushFromHand(s, "player2", "RS-099:red");
    expect(r.ok).toBe(true);
    return r.state;
  };

  it("RS-490: 【予言】敵軍ターン中に敵軍ユニットがラッシュされ、自軍ユニットの数が少なければ、山札の上が同じ特徴（男）を持つユニットカードなら自軍ラッシュエリアに出す（出典: atwiki/page-813「自軍ラッシュエリアに出す」）", () => {
    const s = resolveAll(enemyRush("SPEC-DA"), ["RS-490:mm"]);
    expect(zoneOf(s, "player1", "SPEC-DA:top")).toBe("rush");
  });

  it("RS-490: 【予言】オモテにしたカードが同じ特徴を持たない（またはユニットでない）なら捨札にする（出典: atwiki/page-813「出せなかった場合は、捨札にする」）", () => {
    const s = resolveAll(enemyRush("TST-OP"), ["RS-490:mm"]);
    expect(zoneOf(s, "player1", "TST-OP:top")).toBe("discard");
  });

  it("RS-490: 【予言】自軍ユニットの数が敵軍ユニットの数以上なら発動しない（出典: atwiki/page-813「自軍ユニットの数が敵軍ユニットの数より少なければ」）", () => {
    // 自軍: 幼体＋2体＝3、敵軍: 1体＋ラッシュされたハリケンレッド＝2。
    const s = resolveAll(enemyRush("SPEC-DA", { ownUnits: 2 }), ["RS-490:mm"]);
    expect(zoneOf(s, "player1", "SPEC-DA:top")).toBe("deck");
  });

  it("RS-490: 【予言】これが自軍エリアにないとき（手札）は発動しない（出典: atwiki/page-813「これが自軍エリアにある間」）", () => {
    const s = resolveAll(enemyRush("SPEC-DA", { mamaZone: "hand" }), ["RS-490:mm"]);
    expect(zoneOf(s, "player1", "SPEC-DA:top")).toBe("deck");
  });

  it("RS-490: 【予言】自軍ターン中に自軍がラッシュしても発動しない（出典: atwiki/page-813「敵軍ターン中、敵軍ユニットがラッシュされたとき」）", () => {
    const s0 = st({
      phase: "rush",
      player1: { rush: [inst("RS-490", "mm")], hand: [inst("RS-099", "red")], command: releasedCat("MA", 2), power: powerCards(2), deck: [inst("SPEC-DA", "top"), ...deckCards(3)] },
      player2: { rush: fillers(3, "en"), deck: deckCards(5, "e") },
    }, SPECS);
    const r = rushFromHand(s0, "player1", "RS-099:red");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "SPEC-DA:top")).toBe("deck");
  });

  it("RS-490: 【予言】「（ただし追加条件は満たすこと）」— 追加条件を満たせなければ出せず捨札、満たせれば素材を捨札にして出す（出典: atwiki/page-813・R-RUSH-21）", () => {
    // RS-473 タイムシャドウ（メカ／人型／忍者。追加条件：自軍「タイムシャドウSM」1体を捨札にする）。ハリケンレッドと「忍者」が同じ。
    const run = (withSm: boolean) => {
      const s = st(
        {
          activePlayer: "player2",
          phase: "rush",
          player1: { rush: [inst("RS-490", "mm"), ...(withSm ? [inst("RS-474", "sm")] : [])], deck: [inst("RS-473", "top"), ...deckCards(3)] },
          player2: { hand: [inst("RS-099", "red")], rush: fillers(2, "en"), command: releasedCat("MA", 2), power: powerCards(2), deck: deckCards(5, "e") },
        },
        SPECS,
      );
      const r = rushFromHand(s, "player2", "RS-099:red");
      expect(r.ok).toBe(true);
      return resolveAll(r.state, ["RS-490:mm", "RS-474:sm"]);
    };
    const without = run(false);
    expect(zoneOf(without, "player1", "RS-473:top")).toBe("discard");
    const withSm = run(true);
    expect(zoneOf(withSm, "player1", "RS-473:top")).toBe("rush");
    expect(zoneOf(withSm, "player1", "RS-474:sm")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-491 三の槍マンマルバ成体", () => {
  const TEXT =
    "【目覚めた凶暴性】自軍Sユニットの数が敵軍Sユニットの数より少なければ、相手は自分自身のSユニットを1体選び撃破する。（この効果は、ライドオフしたときナンバーに関係なく発動する）";

  it("RS-491: カタログ本文・スペックが出典と一致（出典: atwiki/page-748）", () => {
    expectCatalogText("RS-491", TEXT);
    expectStats("RS-491", {
      name: "三の槍マンマルバ成体",
      category: "DA",
      size: "S",
      bp: 5000,
      sp: 1,
      powerCost: "6+",
      comboNumber: 3,
      features: ["暗黒七本槍", "男", "忍者"],
      rushCondition: "discard_named_unit",
    });
  });

  it("RS-491: 追加条件 — 自軍「三の槍マンマルバ幼体」1体を捨札にしてラッシュできる（出典: atwiki/page-748「追加条件：自軍「三の槍マンマルバ幼体」1体を捨札にする」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-491", "ad")], rush: [inst("RS-490", "yo")], command: releasedCat("DA", 1), power: powerCards(6), deck: deckCards(3) } });
    const r = rushFromHand(s, "player1", "RS-491:ad");
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-491:ad")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-490:yo")).toBe("discard");
  });

  it("RS-491: 追加条件 — 幼体がいなければラッシュできない／パワー5ではラッシュできない（出典: atwiki/page-748「必要パワー：6＋」）", () => {
    const none = st({ phase: "rush", player1: { hand: [inst("RS-491", "ad")], rush: [inst("TST-UNIT-0", "x")], command: releasedCat("DA", 1), power: powerCards(8), deck: deckCards(3) } });
    expect(canStartRush(none, "player1", "RS-491:ad")).toBe(false);
    const low = st({ phase: "rush", player1: { hand: [inst("RS-491", "ad")], rush: [inst("RS-490", "yo")], command: releasedCat("DA", 1), power: powerCards(5), deck: deckCards(3) } });
    expect(canStartRush(low, "player1", "RS-491:ad")).toBe(false);
  });

  /** 自軍バトルフェイズ: S ユニット ownS 体の次に成体を出す。敵軍: S ユニット enemyS 体と M 1体。 */
  const adult = (ownS: number, enemyS: number) =>
    enter(
      st({
        player1: { battle: fillers(ownS), rush: [inst("RS-491", "ad")], deck: deckCards(5) },
        player2: {
          battle: [...Array.from({ length: enemyS }, (_, i) => inst("TST-UNIT-0", `es${i}`)), inst("TST-UNIT-2", "em")],
          deck: deckCards(5, "e"),
        },
      }),
      "RS-491:ad",
    );

  it("RS-491: 【目覚めた凶暴性】NC 成立時（3番目）、自軍 S（3）が敵軍 S（4）より少なければ、相手が自分自身の S ユニットを1体選び撃破する（出典: atwiki/page-748「相手は自分自身のSユニットを1体選び撃破する」）", () => {
    let s = adult(2, 4);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-491");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:es0", "TST-UNIT-0:es1", "TST-UNIT-0:es2", "TST-UNIT-0:es3"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "TST-UNIT-0:es2"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:es2")).toBe("discard");
    expect(s.players.player2.battle).toHaveLength(4);
  });

  it("RS-491: 【目覚めた凶暴性】自軍 S の数が敵軍 S の数と同じ（3 対 3）なら撃破しない（出典: atwiki/page-748「より少なければ」）", () => {
    const s = resolveAll(adult(2, 3), ["TST-UNIT-0:es0"]);
    expect(s.players.player2.battle).toHaveLength(4);
  });

  it("RS-491: 【目覚めた凶暴性】NC 不成立（2番目）では発動しない（出典: atwiki/page-748「CN：3」・R-CN-02）", () => {
    const s = resolveAll(adult(1, 5), ["TST-UNIT-0:es0"]);
    expect(s.players.player2.battle).toHaveLength(6);
  });

  it("RS-491: 【目覚めた凶暴性】ビークル（ハリケンウィンガー）からライドオフしたときは、ナンバーに関係なく発動する（出典: atwiki/page-748「（この効果は、ライドオフしたときナンバーに関係なく発動する）」・R-KW-RIDE-05）", () => {
    let s = st({
      player1: { rush: [inst("RS-488", "v"), inst("RS-491", "ad")], deck: deckCards(5) },
      player2: { battle: fillers(3, "es"), deck: deckCards(5, "e") },
    });
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "RS-491:ad", vehicleInstanceId: "RS-488:v" });
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-491");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
  });
});

// ===========================================================================
describe("RS-492 炎の騎馬", () => {
  const TEXT = "※DAのSユニットは、ＲＣを持っていなくてもこのビークルにライドできる。※これにライドしているユニットはBP+1500される。";

  it("RS-492: カタログ本文・スペック（S ビークル・DA・必要パワー4・メカ／車両）が出典と一致（出典: atwiki/page-815）", () => {
    expectCatalogText("RS-492", TEXT);
    expectVehicle("RS-492", { name: "炎の騎馬", category: "DA", powerCost: 4, features: ["メカ", "車両"] });
  });

  it("RS-492: ※ RC を持たない DA の S ユニットはライドできる（出典: atwiki/page-815「DAのSユニットは、ＲＣを持っていなくても」）", () => {
    expect(canMount(mountState("RS-492", "SPEC-DA"), "SPEC-DA:r", "RS-492:v")).toBe(true);
  });

  it("RS-492: ※ RC を持たない DA 以外（WB）の S ユニットはライドできない（出典: atwiki/page-815・R-KW-RIDE-02）", () => {
    expect(canMount(mountState("RS-492", "SPEC-WB"), "SPEC-WB:r", "RS-492:v")).toBe(false);
  });

  it("RS-492: ※ RC を持たない DA の M ユニットはライドできない（出典: atwiki/page-815「DAのSユニット」）", () => {
    expect(canMount(mountState("RS-492", "SPEC-DA-M"), "SPEC-DA-M:r", "RS-492:v")).toBe(false);
  });

  it("RS-492: RC を持つユニットはライドできる（出典: R-KW-RIDE-02）", () => {
    expect(canMount(mountState("RS-492", "SPEC-RC"), "SPEC-RC:r", "RS-492:v")).toBe(true);
  });

  it("RS-492: ※ ライドしているユニットは BP+1500 される（出典: atwiki/page-815「これにライドしているユニットはBP+1500される」）", () => {
    let s = mountState("RS-492", "SPEC-RC");
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "SPEC-RC:r", vehicleInstanceId: "RS-492:v" });
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: false });
    expect(bpOf(s, "player1", "SPEC-RC:r")).toBe(2500);
  });

  it("RS-492: ※ ライドオフしたユニットは BP+1500 されない（出典: atwiki/page-815「これにライドしているユニットは」）", () => {
    let s = mountState("RS-492", "SPEC-RC");
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "SPEC-RC:r", vehicleInstanceId: "RS-492:v" });
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true });
    expect(bpOf(s, "player1", "SPEC-RC:r")).toBe(1000);
  });
});

// ===========================================================================
describe("RS-493 六の槍サタラクラ", () => {
  const TEXT =
    "【正解の無いクイズ】自軍パワーのダメージになっているカードを、ウラ向きのままシャッフルして置きなおしてもよい。そうしたとき、自軍パワーのダメージになっているカードを1枚選び、そのカードの必要パワーの数字を相手に宣言させてからオモテにする。相手の解答が不正解なら、相手に1点ダメージを与える。正解なら相手は自分自身のユニットを1体選び撃破する。その後オモテにしたカードを捨札にする。";

  it("RS-493: カタログ本文・スペックが出典と一致（出典: atwiki/page-816）", () => {
    expectCatalogText("RS-493", TEXT);
    expectStats("RS-493", {
      name: "六の槍サタラクラ",
      category: "DA",
      size: "S",
      bp: 4000,
      sp: undefined,
      powerCost: 6,
      comboNumber: 6,
      features: ["暗黒七本槍", "男", "忍者"],
      rushCondition: undefined,
    });
  });

  /** 自軍バトルフェイズ: 5体の次にサタラクラ（CN6）を出す。自軍ダメージ ownDamage 点。 */
  const quiz = (ownDamage: number, position: 6 | 5 = 6) =>
    enter(
      st({
        player1: { battle: fillers(position - 1), rush: [inst("RS-493", "st")], power: [...powerCards(2, "up"), ...damageCards(ownDamage)], deck: deckCards(5) },
        player2: { battle: [inst("TST-UNIT-0", "e")], power: [], deck: deckCards(5, "e") },
      }),
      "RS-493:st",
    );

  const enemyDamage = (s: GameState) => s.players.player2.power.filter((c) => c.faceDown).length;

  it("RS-493: 【正解の無いクイズ】自軍のダメージが0点なら、クイズは行えず相手にダメージも撃破もない（出典: atwiki/page-816「自軍パワーのダメージになっているカードを…置きなおしてもよい。そうしたとき」・R-RES-06）", () => {
    const s = resolveAll(quiz(0));
    expect(enemyDamage(s)).toBe(0);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("battle");
  });

  it("RS-493: 【正解の無いクイズ】正誤にかかわらず、オモテにした自軍のダメージのカード1枚を捨札にする（自軍ダメージが1点減る）（出典: atwiki/page-816「その後オモテにしたカードを捨札にする」）", () => {
    const s = resolveAll(quiz(2));
    expect(s.players.player1.power.filter((c) => c.faceDown)).toHaveLength(1);
    expect(s.players.player1.discard).toHaveLength(1);
  });

  it("RS-493: 【正解の無いクイズ】「置きなおしてもよい」— 発動しないことを選べ、そのとき相手にダメージは与えない（出典: atwiki/page-816「置きなおしてもよい」）", () => {
    let s = quiz(2);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-493");
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(enemyDamage(s)).toBe(0);
  });

  it("RS-493: 【正解の無いクイズ】NC 不成立（5番目）では発動しない（出典: atwiki/page-816「CN：6」・R-CN-02）", () => {
    const s = resolveAll(quiz(2, 5));
    expect(enemyDamage(s)).toBe(0);
    expect(s.players.player1.power.filter((c) => c.faceDown)).toHaveLength(2);
  });

  /** 自軍ダメージ1点（必要パワー3の TST-OP）でクイズを行い、相手が declared を宣言する。 */
  const declare = (declared: string) => {
    let s = enter(
      st({
        player1: { battle: fillers(5), rush: [inst("RS-493", "st")], power: [...powerCards(2, "up"), { ...inst("TST-OP", "dm"), faceDown: true }], deck: deckCards(5) },
        player2: { battle: [inst("TST-UNIT-0", "e")], power: [], deck: deckCards(5, "e") },
      }),
      "RS-493:st",
    );
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-493");
    s = pick(s, s.pendingEffectChoice!.validInstanceIds[0]!);
    expect(choiceIds(s)).toEqual(["TST-OP:dm"]);
    s = pick(s, "TST-OP:dm");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(s.pendingEffectChoice?.kind).toBe("declare_number");
    return pick(s, declared);
  };

  it("RS-493: 【正解の無いクイズ】相手の解答（必要パワーの数字）が不正解なら相手に1点ダメージを与え、オモテにしたカードを捨札にする（出典: atwiki/page-816「相手の解答が不正解なら、相手に1点ダメージを与える」）", () => {
    const s = resolveAll(declare("2"));
    expect(enemyDamage(s)).toBe(1);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("battle");
    expect(zoneOf(s, "player1", "TST-OP:dm")).toBe("discard");
  });

  it("RS-493: 【正解の無いクイズ】正解なら相手は自分自身のユニットを1体選び撃破する（強制）。相手にダメージはない（出典: atwiki/page-816「正解なら相手は自分自身のユニットを1体選び撃破する」）", () => {
    let s = declare("3");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "TST-UNIT-0:e"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(enemyDamage(s)).toBe(0);
    expect(zoneOf(s, "player1", "TST-OP:dm")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-494 縁切り忍者シラーンス", () => {
  const TEXT =
    "【宇宙忍法・縁切り】敵軍バトルエリアから、ＣＮの数字が昇順（例:1、2や3、4など）で隣り合っている2体のSユニットを選んでもよい。そうしたとき、選んだ2体でバトルさせる。";

  it("RS-494: カタログ本文・スペックが出典と一致（出典: atwiki/page-817）", () => {
    expectCatalogText("RS-494", TEXT);
    expectStats("RS-494", {
      name: "縁切り忍者シラーンス",
      category: "DA",
      size: "S",
      bp: 2000,
      sp: undefined,
      powerCost: 3,
      comboNumber: 2,
      features: ["怪人", "男", "忍者"],
      rushCondition: undefined,
    });
  });

  const N1 = sUnit("SPEC-N1", { comboNumber: 1, bp: 1000 });
  const N2 = sUnit("SPEC-N2", { comboNumber: 2, bp: 3000 });
  const N3 = sUnit("SPEC-N3", { comboNumber: 3, bp: 5000 });

  /** 自軍バトルフェイズ: シラーンス（CN2）を position 番目に出す。 */
  const silence = (enemyBattle: CardInstance[], position: 1 | 2 = 2) =>
    enter(
      st(
        {
          player1: { battle: position === 2 ? fillers(1) : [], rush: [inst("RS-494", "sl")], deck: deckCards(5) },
          player2: { battle: enemyBattle, deck: deckCards(5, "e") },
        },
        [N1, N2, N3],
      ),
      "RS-494:sl",
    );

  it("RS-494: 【宇宙忍法・縁切り】CN が昇順で隣り合う2体（CN1 BP1000・CN2 BP3000）を選ぶとその2体でバトルし、BP の低い方が撃破される（出典: atwiki/page-817「選んだ2体でバトルさせる」・R-BTL-01）", () => {
    const s = resolveAll(silence([inst("SPEC-N1", "n1"), inst("SPEC-N2", "n2")]), ["SPEC-N1:n1", "SPEC-N2:n2"]);
    expect(zoneOf(s, "player2", "SPEC-N1:n1")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-N2:n2")).toBe("battle");
  });

  it("RS-494: 【宇宙忍法・縁切り】CN が連続していない2体（CN1・CN3）だけならバトルは起きない（出典: atwiki/page-817「ＣＮの数字が昇順（例:1、2や3、4など）で隣り合っている」）", () => {
    const s = resolveAll(silence([inst("SPEC-N1", "n1"), inst("SPEC-N3", "n3")]), ["SPEC-N1:n1", "SPEC-N3:n3"]);
    expect(s.players.player2.battle).toHaveLength(2);
  });

  it("RS-494: 【宇宙忍法・縁切り】「選んでもよい」— 選ばなければバトルは起きない（出典: atwiki/page-817）", () => {
    let s = silence([inst("SPEC-N1", "n1"), inst("SPEC-N2", "n2")]);
    for (let i = 0; i < 4 && s.pendingEffectChoice?.sourceCardId === "RS-494"; i++) {
      expect(canSkip(s)).toBe(true);
      s = skip(s);
    }
    s = settle(s);
    expect(s.players.player2.battle).toHaveLength(2);
  });

  it("RS-494: 【宇宙忍法・縁切り】NC 不成立（1番目）では発動しない（出典: atwiki/page-817「CN：2」・R-CN-02）", () => {
    const s = resolveAll(silence([inst("SPEC-N1", "n1"), inst("SPEC-N2", "n2")], 1), ["SPEC-N1:n1", "SPEC-N2:n2"]);
    expect(s.players.player2.battle).toHaveLength(2);
  });
});
