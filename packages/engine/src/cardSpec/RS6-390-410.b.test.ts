/**
 * カード別スペック: RS-397〜RS-403（第6弾「紅き六戦士の帰還」タイムジェット1〜デカレッド（2nd））
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-6（この範囲のカードの Q&A なし）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール（R-ADD 追加条件、R-CN-02 NC、R-ZONE-08 ほか）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attackTargets,
  canSkip,
  canStartRush,
  choiceIds,
  deckCards,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  held,
  inst,
  legal,
  pick,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./RS6-390-410.helpers";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState } from "../types/game";

type P = Partial<GameState["players"]["player1"]>;

const NINJA = sUnit("SPEC-NIN", { name: "忍者ユニット", features: ["忍者"] });
const NINJA_M = sUnit("SPEC-NINM", { name: "忍者Mユニット", features: ["忍者"], size: "M" });
const AIR = sUnit("SPEC-AIR", { name: "航空機ユニット", features: ["航空機"] });
const DINO_S = sUnit("SPEC-DINOS", { name: "恐竜Sユニット", features: ["恐竜"] });
const MA_S = sUnit("SPEC-MAS", { name: "MA Sユニット", category: "MA" });
const MA_M = sUnit("SPEC-MAM", { name: "MA Mユニット", category: "MA", size: "M" });
const OT_M = sUnit("SPEC-OTM", { name: "OT Mユニット", category: "OT", size: "M" });
const S2500 = sUnit("SPEC-S2500", { name: "BP2500", bp: 2500 });
const S500 = sUnit("SPEC-S500", { name: "BP500", bp: 500 });
const M2500 = sUnit("SPEC-M2500", { name: "M BP2500", bp: 2500, size: "M" });
const SPECS: CardDefinition[] = [NINJA, NINJA_M, AIR, DINO_S, MA_S, MA_M, OT_M, S2500, S500, M2500];

function enterAt(id: string, pos: number, p1: P = {}, p2: P = {}) {
  const s = st(
    { player1: { battle: fillers(pos - 1), rush: [inst(id, "x")], deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } },
    SPECS,
  );
  return enter(s, `${id}:x`);
}

/** タイムジェット1〜5: 自軍ラッシュフェイズに手札から（S ユニット1体をパワーゾーンに送って）ラッシュする。 */
function rushJet(id: string, p2: P = {}, p1: P = {}) {
  const s = st(
    {
      phase: "rush",
      player1: { hand: [inst(id, "j")], rush: [inst("TST-UNIT-0", "mat")], command: releasedCat("OT", 1), power: powerCards(3), deck: deckCards(3), ...p1 },
      player2: { deck: deckCards(3, "e"), ...p2 },
    },
    SPECS,
  );
  return rushFromHand(s, "player1", `${id}:j`);
}

/** タイムジェット1〜5 共通: スペックと追加条件「自軍Sユニットを1体パワーゾーンに送る」。 */
function jetBasics(id: string, name: string, bp: number, page: string) {
  it(`${id}: スペックが出典と一致（OT・M・BP${bp}・SP－・必要パワー3+・メカ／航空機）（出典: ${page}）`, () => {
    expectStats(id, {
      name,
      category: "OT",
      size: "M",
      bp,
      sp: undefined,
      powerCost: "3+",
      features: ["メカ", "航空機"],
      rushCondition: "send_s_unit_to_power",
    });
  });

  it(`${id}: 追加条件 — 自軍 S ユニット1体をパワーゾーンに送ってラッシュできる（出典: ${page}「自軍Sユニットを1体パワーゾーンに送る」）`, () => {
    const r = rushJet(id);
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", `${id}:j`)).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:mat")).toBe("power");
  });

  it(`${id}: 追加条件 — 自軍に S ユニットがなければ（M ユニットだけ）ラッシュできない（出典: ${page}「自軍Sユニットを1体」）`, () => {
    const s = st(
      { phase: "rush", player1: { hand: [inst(id, "j")], rush: [inst("SPEC-OTM", "m")], command: releasedCat("OT", 1), power: powerCards(3), deck: deckCards(3) } },
      SPECS,
    );
    expect(canStartRush(s, "player1", `${id}:j`)).toBe(false);
  });

  it(`${id}: 必要パワー3+ — パワー2ではラッシュできない（出典: ${page}「必要パワー：3+」）`, () => {
    const s = st(
      { phase: "rush", player1: { hand: [inst(id, "j")], rush: [inst("TST-UNIT-0", "mat")], command: releasedCat("OT", 1), power: powerCards(2), deck: deckCards(3) } },
      SPECS,
    );
    expect(canStartRush(s, "player1", `${id}:j`)).toBe(false);
  });
}

// ===========================================================================
describe("RS-397 タイムジェット1", () => {
  const TEXT = "【予期せぬ出現】これをラッシュしたとき、敵軍バトルエリアのユニットを好きな順に並び変えてもよい。";

  it("RS-397: カタログ本文が出典と一致（出典: atwiki/page-555）", () => {
    expectCatalogText("RS-397", TEXT);
  });
  jetBasics("RS-397", "タイムジェット1", 4000, "atwiki/page-555");

  const enemy3 = (): P => ({ battle: [inst("TST-UNIT-0", "a"), inst("TST-UNIT-0", "b"), inst("TST-UNIT-0", "c")] });
  const order = (s: GameState) => s.players.player2.battle.map((c) => c.instanceId);

  it("RS-397: 【予期せぬ出現】ラッシュしたとき並び替えを選べ、逆順（c,b,a）にできる（出典: atwiki/page-555「好きな順に並び変えてもよい」）", () => {
    let s = rushJet("RS-397", enemy3()).state;
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-397");
    s = pick(s, s.pendingEffectChoice!.validInstanceIds[0]!);
    expect(order(s)).toEqual(["TST-UNIT-0:c", "TST-UNIT-0:b", "TST-UNIT-0:a"]);
  });

  it("RS-397: 「好きな順」— 逆順以外の任意の順（b,c,a など）にも並び替えられる（出典: atwiki/page-555「好きな順に」）", () => {
    let s = rushJet("RS-397", enemy3()).state;
    expect(s.pendingEffectChoice?.validInstanceIds.length).toBeGreaterThan(1);
    s = resolveAll(s, ["TST-UNIT-0:b", "TST-UNIT-0:c", "TST-UNIT-0:a"]);
    expect(order(s)).toEqual(["TST-UNIT-0:b", "TST-UNIT-0:c", "TST-UNIT-0:a"]);
  });

  it("RS-397: 任意 — 並び替えないことを選べる（出典: atwiki/page-555「並び変えてもよい」）", () => {
    let s = rushJet("RS-397", enemy3()).state;
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(order(s)).toEqual(["TST-UNIT-0:a", "TST-UNIT-0:b", "TST-UNIT-0:c"]);
  });

  it("RS-397: ラッシュしていない（ラッシュエリアにあるだけの）ときは何も起きない（出典: atwiki/page-555「これをラッシュしたとき」）", () => {
    const s = st({ player1: { rush: [inst("RS-397", "j")], battle: fillers(1), deck: deckCards(3) }, player2: { ...enemy3(), deck: deckCards(3, "e") } });
    expect(s.pendingEffectChoice).toBeUndefined();
    const t = enter(s, "RS-397:j");
    expect(t.pendingEffectChoice).toBeUndefined();
    expect(order(t)).toEqual(["TST-UNIT-0:a", "TST-UNIT-0:b", "TST-UNIT-0:c"]);
  });
});

// ===========================================================================
describe("RS-398 タイムジェット2", () => {
  const TEXT =
    "【時間漂流者の送還】これが自軍ラッシュエリアにある間、自分がターンを終えるとき、自軍バトルエリアから特徴「忍者」を持つSユニットを2体まで選び、自軍パワーゾーンに送ってもよい。";

  it("RS-398: カタログ本文が出典と一致（出典: atwiki/page-556）", () => {
    expectCatalogText("RS-398", TEXT);
  });
  jetBasics("RS-398", "タイムジェット2", 4000, "atwiki/page-556");

  const turnEnd = (jetZone: "rush" | "battle" = "rush") => {
    const s = st(
      {
        player1: {
          rush: jetZone === "rush" ? [inst("RS-398", "j")] : [],
          battle: [
            ...(jetZone === "battle" ? [inst("RS-398", "j")] : []),
            inst("SPEC-NIN", "n1"),
            inst("SPEC-NIN", "n2"),
            inst("SPEC-NIN", "n3"),
            inst("SPEC-NINM", "nm"),
            inst("TST-UNIT-0", "plain"),
          ],
          deck: deckCards(5),
        },
        player2: { deck: deckCards(5, "e") },
      },
      SPECS,
    );
    return act(s, legal(s).find((a) => a.type === "end_phase")!);
  };

  it("RS-398: 【時間漂流者の送還】自軍ラッシュエリアにある間、ターンを終えるとき自軍バトルエリアの特徴「忍者」を持つ S ユニットだけを選べる（出典: atwiki/page-556「自軍バトルエリアから特徴「忍者」を持つSユニットを」）", () => {
    const s = turnEnd();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-398");
    expect(choiceIds(s)).toEqual(["SPEC-NIN:n1", "SPEC-NIN:n2", "SPEC-NIN:n3"]);
  });

  it("RS-398: 「2体まで」— 2体選んで自軍パワーゾーンに送れ、3体目は送れない（出典: atwiki/page-556「2体まで選び、自軍パワーゾーンに送ってもよい」）", () => {
    let s = turnEnd();
    s = resolveAll(s, ["SPEC-NIN:n1", "SPEC-NIN:n2", "SPEC-NIN:n3"]);
    expect(zoneOf(s, "player1", "SPEC-NIN:n1")).toBe("power");
    expect(zoneOf(s, "player1", "SPEC-NIN:n2")).toBe("power");
    expect(zoneOf(s, "player1", "SPEC-NIN:n3")).not.toBe("power");
  });

  it("RS-398: 任意 — 送らないことを選べる（忍者はパワーゾーンに行かない）（出典: atwiki/page-556「送ってもよい」）", () => {
    let s = turnEnd();
    for (let i = 0; i < 4 && s.pendingEffectChoice?.sourceCardId === "RS-398"; i++) s = skip(s);
    expect(s.players.player1.power.map((c) => c.instanceId)).not.toContain("SPEC-NIN:n1");
  });

  it("RS-398: これが自軍バトルエリアにある（ラッシュエリアにない）ときは発動しない（出典: atwiki/page-556「これが自軍ラッシュエリアにある間」）", () => {
    const s = turnEnd("battle");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-398");
    expect(s.players.player1.power).toHaveLength(0);
  });
});

// ===========================================================================
describe("RS-399 タイムジェット3", () => {
  const TEXT = "【オーパーツの返還】これをラッシュしたとき、敵軍バトルエリアからMAのMユニットを1体選び、持ち主のパワーゾーンに送ってもよい。";

  it("RS-399: カタログ本文が出典と一致（出典: atwiki/page-557）", () => {
    expectCatalogText("RS-399", TEXT);
  });
  jetBasics("RS-399", "タイムジェット3", 3000, "atwiki/page-557");

  const foe = (): P => ({
    battle: [inst("SPEC-MAM", "t"), inst("SPEC-MAS", "s"), inst("SPEC-OTM", "o")],
    rush: [inst("SPEC-MAM", "r")],
  });

  it("RS-399: 【オーパーツの返還】選べるのは敵軍バトルエリアの MA の M ユニットだけ（MA の S・OT の M・ラッシュエリアは不可）（出典: atwiki/page-557「敵軍バトルエリアからMAのMユニットを1体選び」）", () => {
    const s = rushJet("RS-399", foe()).state;
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-399");
    expect(choiceIds(s)).toEqual(["SPEC-MAM:t"]);
  });

  it("RS-399: 選んだユニットは持ち主（相手）のパワーゾーンに送られる（出典: atwiki/page-557「持ち主のパワーゾーンに送って」）", () => {
    const s = pick(rushJet("RS-399", foe()).state, "SPEC-MAM:t");
    expect(zoneOf(s, "player2", "SPEC-MAM:t")).toBe("power");
    expect(s.players.player2.power.find((c) => c.instanceId === "SPEC-MAM:t")?.faceDown ?? false).toBe(false);
  });

  it("RS-399: 任意 — 送らないことを選べる（出典: atwiki/page-557「送ってもよい」）", () => {
    const s = skip(rushJet("RS-399", foe()).state);
    expect(zoneOf(s, "player2", "SPEC-MAM:t")).toBe("battle");
  });

  it("RS-399: 対象がいなければ選択は出ない（出典: atwiki/page-557）", () => {
    const s = rushJet("RS-399", { battle: [inst("SPEC-OTM", "o")] }).state;
    expect(s.pendingEffectChoice).toBeUndefined();
  });
});

// ===========================================================================
describe("RS-400 タイムジェット4", () => {
  const TEXT = "【密猟者からの保護】これをラッシュしたとき、敵軍バトルエリアから特徴「恐竜」を持つMユニットを1体選び、持ち主のパワーゾーンに送ってもよい。";

  it("RS-400: カタログ本文が出典と一致（出典: atwiki/page-558）", () => {
    expectCatalogText("RS-400", TEXT);
  });
  jetBasics("RS-400", "タイムジェット4", 4000, "atwiki/page-558");

  const foe = (): P => ({
    battle: [inst("RS-038", "t"), inst("SPEC-DINOS", "s"), inst("SPEC-OTM", "o")],
    rush: [inst("RS-038", "r")],
  });

  it("RS-400: 【密猟者からの保護】選べるのは敵軍バトルエリアの特徴「恐竜」を持つ M ユニットだけ（恐竜の S・恐竜でない M・ラッシュエリアは不可）（出典: atwiki/page-558）", () => {
    const s = rushJet("RS-400", foe()).state;
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-400");
    expect(choiceIds(s)).toEqual(["RS-038:t"]);
  });

  it("RS-400: 選んだユニットは持ち主（相手）のパワーゾーンに送られる（出典: atwiki/page-558「持ち主のパワーゾーンに送って」）", () => {
    const s = pick(rushJet("RS-400", foe()).state, "RS-038:t");
    expect(zoneOf(s, "player2", "RS-038:t")).toBe("power");
  });

  it("RS-400: 任意 — 送らないことを選べる（出典: atwiki/page-558「送ってもよい」）", () => {
    const s = skip(rushJet("RS-400", foe()).state);
    expect(zoneOf(s, "player2", "RS-038:t")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-401 タイムジェット5", () => {
  const TEXT =
    "【最後尾からの警戒】これが自軍バトルエリアの最後に並んでいる間、自軍バトルエリアにある特徴「航空機」を持つユニットは次の能力を得る⇒敵軍ユニットにアタックされない。";

  it("RS-401: カタログ本文が出典と一致（出典: atwiki/page-559）", () => {
    expectCatalogText("RS-401", TEXT);
  });
  jetBasics("RS-401", "タイムジェット5", 2000, "atwiki/page-559");

  const enemyTurn = (battle: GameState["players"]["player1"]["battle"]) =>
    st(
      { activePlayer: "player2", player1: { battle, deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") } },
      SPECS,
    );

  it("RS-401: 【最後尾からの警戒】最後に並んでいる間、自軍バトルエリアの航空機ユニット（これ自身を含む）は敵軍ユニットにアタックされない（出典: atwiki/page-559「特徴「航空機」を持つユニットは…アタックされない」）", () => {
    const s = enemyTurn([inst("SPEC-AIR", "air"), inst("TST-UNIT-0", "plain"), inst("RS-401", "j")]);
    expect(attackTargets(s, "TST-UNIT-7:atk", "player2").sort()).toEqual(["TST-UNIT-0:plain"]);
  });

  it("RS-401: 航空機を持たない自軍ユニットはアタックされうる（出典: atwiki/page-559「特徴「航空機」を持つユニットは」）", () => {
    const s = enemyTurn([inst("SPEC-AIR", "air"), inst("TST-UNIT-0", "plain"), inst("RS-401", "j")]);
    expect(attackTargets(s, "TST-UNIT-7:atk", "player2")).toContain("TST-UNIT-0:plain");
  });

  it("RS-401: 最後に並んでいないときは航空機ユニットもアタックされうる（出典: atwiki/page-559「最後に並んでいる間」）", () => {
    const s = enemyTurn([inst("SPEC-AIR", "air"), inst("RS-401", "j"), inst("TST-UNIT-0", "plain")]);
    expect(attackTargets(s, "TST-UNIT-7:atk", "player2")).toContain("SPEC-AIR:air");
  });
});

// ===========================================================================
describe("RS-402 ガオレッド（2nd）", () => {
  const TEXT = "【灼熱の獅子】「SP1」敵軍コマンドの数が自軍コマンドの数より多ければ、相手は自分自身のコマンドを1つ選び、捨札にする。";

  it("RS-402: カタログ本文・スペックが出典と一致（出典: atwiki/page-543）", () => {
    expectCatalogText("RS-402", TEXT);
    expectStats("RS-402", {
      name: "ガオレッド",
      category: "WB",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 4,
      comboNumber: 2,
      features: ["レッド", "男", "2nd"],
    });
  });

  const more = (): [P, P] => [{ command: [released("TST-OP", "o1")] }, { command: [released("TST-OP", "e1"), held("TST-OP", "e2")] }];

  it("RS-402: 【灼熱の獅子】2番目に出て NC が成立すると「SP1」になる（出典: atwiki/page-543「CN：2」「「SP1」」）", () => {
    const s = enterAt("RS-402", 2, ...more());
    expect(spOf(s, "player1", "RS-402:x")).toBe(1);
  });

  it("RS-402: 敵軍コマンドが自軍より多ければ、相手が自分自身のコマンド（リリース・ホールドとも）から1つ選ぶ（出典: atwiki/page-543「相手は自分自身のコマンドを1つ選び」）", () => {
    const s = enterAt("RS-402", 2, ...more());
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["TST-OP:e1", "TST-OP:e2"]);
  });

  it("RS-402: 選ばれたコマンドは捨札になる（出典: atwiki/page-543「捨札にする」）", () => {
    let s = enterAt("RS-402", 2, ...more());
    s = act(s, { type: "resolve_effect_choice", playerId: "player2", instanceId: "TST-OP:e2" });
    expect(zoneOf(s, "player2", "TST-OP:e2")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-OP:e1")).toBe("command");
    expect(zoneOf(s, "player1", "TST-OP:o1")).toBe("command");
  });

  it("RS-402: 強制 — 相手は選ばないことはできない（出典: atwiki/page-543「選び、捨札にする」（「てもよい」がない））", () => {
    const s = enterAt("RS-402", 2, ...more());
    expect(canSkip(s)).toBe(false);
  });

  it("RS-402: 敵軍コマンドの数が自軍と同じなら何も起きない（SP1 にはなる）（出典: atwiki/page-543「…より多ければ」）", () => {
    const s = enterAt("RS-402", 2, { command: [released("TST-OP", "o1"), released("TST-OP", "o2")] }, more()[1]);
    expect(spOf(s, "player1", "RS-402:x")).toBe(1);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player2.command).toHaveLength(2);
  });

  it("RS-402: NC が成立していない（3番目）ときは SP！のままで、コマンドも捨札にならない（出典: atwiki/page-543・R-CN-02）", () => {
    const s = enterAt("RS-402", 3, ...more());
    expect(spOf(s, "player1", "RS-402:x")).toBe(0);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player2.command).toHaveLength(2);
  });
});

// ===========================================================================
describe("RS-403 デカレッド（2nd）", () => {
  const TEXT = "【ハイブリッドマグナム】敵軍ラッシュエリアから、BPの下三桁が500の敵軍Sユニットを1体選び、撃破してもよい。";

  it("RS-403: カタログ本文・スペックが出典と一致（出典: atwiki/page-560）", () => {
    expectCatalogText("RS-403", TEXT);
    expectStats("RS-403", {
      name: "デカレッド",
      category: "OT",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 3,
      comboNumber: 1,
      features: ["レッド", "男", "警察", "2nd"],
    });
  });

  const foe = (): P => ({
    rush: [inst("SPEC-S2500", "a"), inst("SPEC-S500", "b"), inst("TST-UNIT-0", "k"), inst("SPEC-M2500", "m")],
    battle: [inst("SPEC-S2500", "bt")],
  });

  it("RS-403: 【ハイブリッドマグナム】選べるのは敵軍ラッシュエリアの BP の下三桁が500の S ユニットだけ（BP1000・M ユニット・バトルエリアは不可）（出典: atwiki/page-560「BPの下三桁が500の敵軍Sユニット」）", () => {
    const s = enterAt("RS-403", 1, {}, foe());
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-403");
    expect(choiceIds(s)).toEqual(["SPEC-S2500:a", "SPEC-S500:b"]);
  });

  it("RS-403: 選んだユニットは撃破されて捨札になる（出典: atwiki/page-560「撃破してもよい」）", () => {
    const s = resolveAll(pick(enterAt("RS-403", 1, {}, foe()), "SPEC-S2500:a"));
    expect(zoneOf(s, "player2", "SPEC-S2500:a")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-S500:b")).toBe("rush");
  });

  it("RS-403: 「撃破」— 撃破されたユニットの「撃破されて捨札になったとき」が発動する（BP4500 のレジェンドマジレッドを撃破→相手は捨札のマジレッドをラッシュエリアに出す）（出典: atwiki/page-560「撃破してもよい」・atwiki/page-494）", () => {
    let s = enterAt("RS-403", 1, {}, { rush: [inst("RS-333", "lr")], discard: [inst("RS-057", "mr")] });
    s = resolveAll(pick(s, "RS-333:lr"), ["RS-057:mr"]);
    expect(zoneOf(s, "player2", "RS-333:lr")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-057:mr")).toBe("rush");
  });

  it("RS-403: 任意 — 撃破しないことを選べる（出典: atwiki/page-560「撃破してもよい」）", () => {
    let s = enterAt("RS-403", 1, {}, foe());
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(s.players.player2.rush).toHaveLength(4);
  });

  it("RS-403: NC が成立していない（2番目）ときは選択が出ない（出典: atwiki/page-560「CN：1」・R-CN-02）", () => {
    const s = enterAt("RS-403", 2, {}, foe());
    expect(s.pendingEffectChoice).toBeUndefined();
  });
});
