/**
 * 第5弾（RS-243〜RS-347）監査で見つかった、範囲外カードの不具合の修正確認。
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  - grnrngr 公式 FAQ（docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_5.html / card_6.html / rider_1.html）
 *  - atwiki カードページ（docs/wiki/sources/atwiki/page-N-<ID>.md）
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attackTargets,
  bpOf,
  canEnter,
  canStartRush,
  deckCards,
  enter,
  held,
  inst,
  legal,
  pick,
  powerCards,
  released,
  releasedCat,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./RS5-327-347.helpers";
import { fullPlayableCatalog } from "@rangers-strike/cards";
import { requiredBattleEntryHolds } from "../rules/restrictions";

const DA_S = sUnit("SPEC-OOR-DA-S", { category: "DA", bp: 3000 });
const DA_S6 = sUnit("SPEC-OOR-DA-S6", { category: "DA", bp: 5000 });
const DA_M = sUnit("SPEC-OOR-DA-M", { category: "DA", size: "M", bp: 3000 });
const WB_S = sUnit("SPEC-OOR-WB-S", { category: "WB", bp: 3000 });
const SPECS = [DA_S, DA_S6, DA_M, WB_S];

// ===========================================================================
describe("RK-048 仮面ライダー斬鬼【音撃斬・雷電斬震】", () => {
  // 「敵軍バトルエリアからユニットを1体選ぶ。そして、選んだユニットの必要パワーの数字より1つ多い数だけ自軍コマンドを
  //  リリースしてもよい。そうしたとき、選んだユニットを撃破する。このとき、これはアタックすることができない。」
  // （faq-rider_1 RK-048・atwiki RK-048）
  const zanki = (commands: ReturnType<typeof inst>[]) =>
    enter(
      st({
        player1: { battle: [inst("TST-UNIT-0", "f")], rush: [inst("RK-048", "z")], command: commands, deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") },
      }),
      "RK-048:z",
    );

  it("RK-048: 選んだユニット（必要パワー0）＋1＝1つの自軍コマンドをリリースしてから撃破し、斬鬼はアタックできない（出典: faq-rider_1 RK-048・atwiki RK-048）", () => {
    let s = zanki([held("TST-OP", "h1"), held("TST-OP", "h2")]);
    expect(s.pendingEffectChoice?.validInstanceIds).toEqual(["TST-UNIT-0:e"]);
    s = pick(s, "TST-UNIT-0:e");
    expect([...s.pendingEffectChoice!.validInstanceIds].sort()).toEqual(["TST-OP:h1", "TST-OP:h2"]);
    s = settle(pick(s, "TST-OP:h2"));
    expect(s.players.player1.command.find((c) => c.instanceId === "TST-OP:h2")?.commandHeld).toBe(false);
    expect(s.players.player1.command.find((c) => c.instanceId === "TST-OP:h1")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(attackTargets(s, "RK-048:z")).toEqual([]);
  });

  it("RK-048: 「リリースしてもよい」— リリースしなければ撃破しない（出典: atwiki RK-048「してもよい。そうしたとき」）", () => {
    let s = zanki([held("TST-OP", "h1")]);
    s = pick(s, "TST-UNIT-0:e");
    s = settle(skip(s));
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("battle");
  });

  it("RK-048: リリースできるホールド状態の自軍コマンドが足りなければ撃破しない（出典: atwiki RK-048）", () => {
    let s = zanki([released("TST-OP", "r1")]);
    s = settle(pick(s, "TST-UNIT-0:e"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-364 ヘルサターン総統【黒き太陽神への忠誠】", () => {
  it("RS-364: 自軍ユニットがすべて DA なら、総統以外の自軍 S ユニットは BP+3000（M ユニット・総統自身は対象外）（出典: atwiki/page-576）", () => {
    const s = st({ player1: { rush: [inst("RS-364", "hs"), inst(DA_S.id, "s"), inst(DA_M.id, "m")] } }, SPECS);
    expect(bpOf(s, "player1", `${DA_S.id}:s`)).toBe(6000);
    expect(bpOf(s, "player1", `${DA_M.id}:m`)).toBe(3000);
    expect(bpOf(s, "player1", "RS-364:hs")).toBe(4000);
  });

  it("RS-364: DA 以外の自軍ユニットがいれば効果はない（出典: atwiki/page-576「自軍ユニットがすべてDAなら」）", () => {
    const s = st({ player1: { rush: [inst("RS-364", "hs"), inst(DA_S.id, "s"), inst(WB_S.id, "w")] } }, SPECS);
    expect(bpOf(s, "player1", `${DA_S.id}:s`)).toBe(3000);
  });

  it("RS-364: 公式Q&A — 2体あれば BP+6000（重複する）が、ホールドする数は1つ（出典: grnrngr/faq-card-6 RS-364 Q3・Q5）", () => {
    const s = st({ player1: { rush: [inst("RS-364", "h1"), inst("RS-364", "h2"), inst(DA_S.id, "s")] } }, SPECS);
    expect(bpOf(s, "player1", `${DA_S.id}:s`)).toBe(9000);
    expect(requiredBattleEntryHolds(s, "player1", s.players.player1.rush[2]!)).toBe(1);
  });

  it("RS-364: 「1つホールドしなければバトルエリアに出られない」— ホールドすれば出られる（出典: atwiki/page-576）", () => {
    let s = st({ player1: { rush: [inst("RS-364", "hs"), inst(DA_S.id, "s")], command: releasedCat("DA", 1) } }, SPECS);
    expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === `${DA_S.id}:s`)).toBe(false);
    s = act(s, { type: "initiate_command_payment", playerId: "player1", kind: "battle_entry", sourceInstanceId: `${DA_S.id}:s` });
    expect(zoneOf(s, "player1", `${DA_S.id}:s`)).toBe("battle");
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
  });

  it("RS-364: BP8000 以上のとき「SP1」になる（BP5000+3000）（出典: atwiki/page-576・faq-card-6 RS-364 Q1）", () => {
    const s = st({ player1: { battle: [inst(DA_S6.id, "s")], rush: [inst("RS-364", "hs")] } }, SPECS);
    expect(bpOf(s, "player1", `${DA_S6.id}:s`)).toBe(8000);
    expect(spOf(s, "player1", `${DA_S6.id}:s`)).toBe(1);
  });
});

// ===========================================================================
describe("RS-290 気伝武人龍星王【飛竜棍・大風車】", () => {
  it("RS-290: 敵軍バトルエリアにある間、DA の自軍 S ユニットはバトルエリアに出られない（ラッシュエリアの龍星王では制限されない）（出典: atwiki/page-474）", () => {
    const blocked = st({ player1: { rush: [inst(DA_S.id, "s")] }, player2: { battle: [inst("RS-290", "r")] } }, SPECS);
    expect(canEnter(blocked, `${DA_S.id}:s`)).toBe(false);
    const free = st({ player1: { rush: [inst(DA_S.id, "s")] }, player2: { rush: [inst("RS-290", "r")] } }, SPECS);
    expect(canEnter(free, `${DA_S.id}:s`)).toBe(true);
  });
});

// ===========================================================================
describe("RS-420 大剣人ズバーン【ズバズバンキック】", () => {
  it("RS-420: 公式Q&A — 追加条件が「自軍合体ユニットを捨札にする」でないメカの L ユニット（トラベリオン）では発動しない（出典: grnrngr/faq-card-6 RS-420 Q1）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-328", "tr")], rush: [inst("RS-329", "ex"), inst("RS-420", "zb")], command: releasedCat("MA", 1), power: powerCards(5), deck: deckCards(3) },
      player2: { rush: [inst("TST-UNIT-0", "e1")], deck: deckCards(3, "e") },
    });
    const r = rushFromHand(s, "player1", "RS-328:tr");
    expect(r.ok).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).not.toBe("RS-420");
  });

  it("RS-420: 合体ユニットを捨札にしてメカの L ユニット（轟雷神）をラッシュしたときは敵軍 S ユニットを選べる（出典: atwiki RS-420）", () => {
    const s = st({
      phase: "rush",
      player1: { hand: [inst("RS-309", "g")], rush: [inst("RS-310", "b"), inst("RS-311", "t"), inst("RS-420", "zb")], command: releasedCat("MA", 1), power: powerCards(6), deck: deckCards(3) },
      player2: { rush: [inst("TST-UNIT-0", "e1")], deck: deckCards(3, "e") },
    });
    const r = rushFromHand(s, "player1", "RS-309:g");
    expect(r.ok).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).toBe("RS-420");
    expect(r.state.pendingEffectChoice?.validInstanceIds).toContain("TST-UNIT-0:e1");
  });
});

// ===========================================================================
describe("RS-565 轟雷旋風神／RS-569 スーパーデカレンジャーロボ（「または」側の合体）", () => {
  it("RS-565: 風雷丸＋ハリケンホーク＋ハリケンレオン＋ハリケンドルフィン＋ゴウライビートル＋ゴウライスタッグを捨札にしてラッシュできる（出典: カード本文「旋風神（または…）＋轟雷神（または…）」・grnrngr/faq-card-8 RS-565 Q1）", () => {
    const mats = ["RS-568", "RS-096", "RS-097", "RS-098", "RS-310", "RS-311"];
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-565", "gs")],
        rush: mats.map((id) => inst(id, "m")),
        command: [...releasedCat("ET", 1), ...releasedCat("MA", 1)],
        power: powerCards(7),
        deck: deckCards(3),
      },
    });
    expect(canStartRush(s, "player1", "RS-565:gs")).toBe(true);
    const r = rushFromHand(s, "player1", "RS-565:gs");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-565:gs")).toBe("rush");
    for (const id of mats) expect(zoneOf(r.state, "player1", `${id}:m`)).toBe("discard");
  });

  it("RS-569: デカバイクロボ＋パトストライカー〜パトシグナーの6体合体でラッシュできる（出典: カード本文「デカレンジャーロボ（またはパトストライカー＋…＋パトシグナー）」・grnrngr/faq-card-8 RS-569 Q1）", () => {
    const mats = ["RS-571", "RS-043", "RS-044", "RS-045", "RS-046", "RS-047"];
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-569", "sd")],
        rush: mats.map((id) => inst(id, "m")),
        command: [...releasedCat("ET", 1), ...releasedCat("OT", 1)],
        power: powerCards(8),
        deck: deckCards(3),
      },
    });
    expect(canStartRush(s, "player1", "RS-569:sd")).toBe(true);
    const r = rushFromHand(s, "player1", "RS-569:sd");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-569:sd")).toBe("rush");
    for (const id of mats) expect(zoneOf(r.state, "player1", `${id}:m`)).not.toBe("rush");
  });
});

// ===========================================================================
describe("XG3-006 ビクトリーウォーカー", () => {
  // XG3-006 は core-playable カタログ外なので、full-playable の定義をテスト用に加える。
  const XG3_006 = fullPlayableCatalog.cards.find((c) => c.id === "XG3-006")!;
  it("XG3-006: 「ブルースローワー＋イエローアーマー＋ピンクエイダー」としてつかえる — レッドラダー・グリーンホバーと捨札にしてビクトリーロボをラッシュできる（出典: カード本文・atwiki/page-388 Q1）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-382", "vr")],
        rush: [inst("RS-383", "rl"), inst("RS-385", "gh"), inst("XG3-006", "vw")],
        command: [...releasedCat("ET", 1), ...releasedCat("OT", 1)],
        power: powerCards(8),
        deck: deckCards(3),
      },
    }, [XG3_006]);
    expect(canStartRush(s, "player1", "RS-382:vr")).toBe(true);
    const r = rushFromHand(s, "player1", "RS-382:vr");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-382:vr")).toBe("rush");
    for (const id of ["RS-383:rl", "RS-385:gh", "XG3-006:vw"]) expect(zoneOf(r.state, "player1", id)).toBe("discard");
  });
});
