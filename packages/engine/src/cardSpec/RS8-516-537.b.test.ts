/**
 * カード別スペック: RS-527〜RS-532（第8弾「究極の八神」バルジオン（2nd）・バイオハンター・シルバ（2nd）・チェンジロボと合体素材）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-8
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_8.html。RS-527・RS-528・RS-532 の Q）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）。
 *     RS-527 Q2・RS-531 Q1・RS-532 Q2 は atwiki の転載のみ（公式ページの取得分に該当 Q なし）。
 *  3. docs/rules/*.md の一般ルール（R-ADD-02/04/06、R-KW-SCRUM-01、R-KW-RESIST-01/04、R-CN-02、02-zones-cards のコマンドゾーン上限 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  DEFS,
  act,
  attack,
  attackTargets,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  cardIn,
  choiceIds,
  deckCards,
  enter,
  expectCatalogText,
  expectStats,
  fill,
  held,
  inst,
  legal,
  pick,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  strike,
  sUnit,
  tryAct,
  zoneOf,
  registerTests,
} from "./RS8-516-537.helpers";
import type { GameState } from "../types/game";

// ===========================================================================
describe("RS-527 バルジオン（2nd）", () => {
  const TEXT =
    "※本来のカテゴリにDAを持つSユニットは、ＲＣを持っていなくてもこのビークルにライドでき、それ以外のユニットはライドできない。 【反バイオ粒子砲】これにライドしているユニットは「Lユニット」になり、OTを持つ敵軍コマンド1つにつき、「BP+1000」される。また、これにライドしているユニットは、「バイオハンター・シルバ」なら「SP1」になる。";
  const DA_S = sUnit("SPEC-DA-S", { category: "DA", bp: 2000, sp: undefined });
  const DA_M = sUnit("SPEC-DA-M", { category: "DA", size: "M", sp: undefined });
  const WB_S = sUnit("SPEC-WB-S", { category: "WB", sp: undefined });
  const EXTRA = [DA_S, DA_M, WB_S];

  const rideState = (rider: string, p2: Partial<GameState["players"]["player2"]> = {}) =>
    st({ player1: { rush: [inst(rider, "s"), inst("RS-527", "bj")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e"), ...p2 } }, EXTRA);
  const canRide = (s: GameState, rider: string, vehicle = "RS-527:bj") =>
    legal(s).some((a) => a.type === "mount_ride" && a.riderInstanceId === rider && a.vehicleInstanceId === vehicle);
  const ride = (s: GameState, rider: string) =>
    act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: rider, vehicleInstanceId: "RS-527:bj" });

  it("RS-527: カタログ本文・スペック（L ビークル・DA・必要パワー5・特徴）が出典と一致（出典: atwiki/page-1156）", () => {
    expectCatalogText("RS-527", TEXT);
    const d = DEFS["RS-527"]!;
    expect(d.name).toBe("バルジオン（2nd）");
    expect(d.type).toBe("vehicle");
    expect(d.category).toBe("DA");
    expect(d.size).toBe("L");
    expect(d.powerCost).toBe(5);
    expect(d.features).toEqual(["メカ", "人型", "2nd"]);
  });

  it("RS-527: ※ 本来のカテゴリに DA を持つ S ユニットは RC なしでライドしてバトルエリアに出られる（出典: atwiki/page-1156）", () => {
    const s = rideState("SPEC-DA-S");
    expect(canRide(s, "SPEC-DA-S:s")).toBe(true);
    expect(zoneOf(ride(s, "SPEC-DA-S:s"), "player1", "SPEC-DA-S:s")).toBe("battle");
  });

  it("RS-527: ※ DA を持たない S ユニット・DA の M ユニットはライドできない（出典: atwiki/page-1156「それ以外のユニットはライドできない」）", () => {
    expect(canRide(rideState("SPEC-WB-S"), "SPEC-WB-S:s")).toBe(false);
    expect(canRide(rideState("SPEC-DA-M"), "SPEC-DA-M:s")).toBe(false);
  });

  // 既知の不具合: CARD-RS-527 【反バイオ粒子砲】の BP+1000（OT の敵軍コマンド1つにつき）が未実装
  it.fails("RS-527: 【反バイオ粒子砲】ライドしているユニットは OT を持つ敵軍コマンド1つにつき BP+1000（OT 2つ・WB 1つなら +2000）（出典: atwiki/page-1156「OTを持つ敵軍コマンド1つにつき、「BP+1000」される」）", () => {
    const s = ride(rideState("SPEC-DA-S", { command: [...releasedCat("OT", 2), ...releasedCat("WB", 1)] }), "SPEC-DA-S:s");
    expect(bpOf(s, "player1", "SPEC-DA-S:s")).toBe(4000);
  });

  it("RS-527: 【反バイオ粒子砲】敵軍に OT のコマンドがなければ BP は変わらない（出典: atwiki/page-1156）", () => {
    const s = ride(rideState("SPEC-DA-S", { command: releasedCat("WB", 2) }), "SPEC-DA-S:s");
    expect(bpOf(s, "player1", "SPEC-DA-S:s")).toBe(2000);
  });

  // 既知の不具合: CARD-RS-527 【反バイオ粒子砲】のシルバ SP1 が未実装
  it.fails("RS-527: 【反バイオ粒子砲】ライドしているのが「バイオハンター・シルバ」（RS-528）なら SP1 になる（出典: atwiki/page-1156「「バイオハンター・シルバ」なら「SP1」になる」）", () => {
    const s = ride(rideState("RS-528"), "RS-528:s");
    expect(spOf(s, "player1", "RS-528:s")).toBe(1);
  });

  it("RS-527: 【反バイオ粒子砲】「バイオハンター・シルバ」以外の SP 空欄のユニットは SP を得ない（出典: atwiki/page-1156）", () => {
    const s = ride(rideState("SPEC-DA-S"), "SPEC-DA-S:s");
    expect(spOf(s, "player1", "SPEC-DA-S:s")).toBe(0);
  });

  it("RS-527: Q&A — バルジオンにライドしているシルバは、さらにデカバイク（RS-570）にライドできない（出典: grnrngr/faq-card-8 RS-527 Q「いいえ。ビークルにライドしているユニットが、さらに別のビークルにライドすることはできません」）", () => {
    let s = st({ player1: { rush: [inst("RS-528", "s"), inst("RS-527", "bj"), inst("RS-570", "bike")], deck: deckCards(3) } });
    s = settle(ride(s, "RS-528:s"));
    expect(canRide(s, "RS-528:s", "RS-570:bike")).toBe(false);
  });

  it("RS-527: Q&A — 敵軍に気伝武人龍星王があっても、DA の S ユニットはバルジオンにライドすれば L ユニットになりバトルエリアに出られる（出典: atwiki/page-1156 Q2「はい、可能です」）", () => {
    const s = rideState("SPEC-DA-S", { battle: [inst("RS-290", "ryu")] });
    expect(canEnter(s, "SPEC-DA-S:s")).toBe(false);
    expect(canRide(s, "SPEC-DA-S:s")).toBe(true);
    expect(zoneOf(ride(s, "SPEC-DA-S:s"), "player1", "SPEC-DA-S:s")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-528 バイオハンター・シルバ（2nd）", () => {
  const TEXT =
    "※レジスト 【バイオ粒子反応アリ！】これが自軍エリアにある間、OTを持つ敵軍ユニットがラッシュされたとき、これをリリースしてもよい。そうしたとき、相手はラッシュしたユニットを撃破するか、1点ダメージを受けるかを選ぶ。ダメージを受けることを選んだ場合、OTを持つ自軍ユニットがあれば、自分も1点ダメージを受ける。";
  const OT_S = sUnit("SPEC-OT-S", { category: "OT", powerCost: 0 });
  const WB_S = sUnit("SPEC-WB0", { category: "WB", powerCost: 0 });
  const OT_MINE = sUnit("SPEC-OT-MINE", { category: "OT" });

  /** 敵軍（player2）のラッシュフェイズ: player2 が手札の unit をラッシュする（反応はパスしない）。 */
  const enemyRushes = (unit: string, silva = held("RS-528", "sv"), p1Rush: ReturnType<typeof inst>[] = []) => {
    const s = st(
      {
        phase: "rush",
        turn: 4,
        activePlayer: "player2",
        player1: { rush: [silva, ...p1Rush], deck: deckCards(3), power: powerCards(3, "p1p") },
        player2: { hand: [inst(unit, "u")], command: [...releasedCat("OT", 1), ...releasedCat("WB", 1)], power: powerCards(3, "p2p"), deck: deckCards(3, "e") },
      },
      [OT_S, WB_S, OT_MINE],
    );
    let r = tryAct(s, { type: "initiate_command_payment", playerId: "player2", kind: "category_use", sourceInstanceId: `${unit}:u` });
    for (let i = 0; i < 3 && r.ok && r.state.pendingCommandPayment; i++) {
      const p = r.state.pendingCommandPayment;
      r = tryAct(r.state, { type: "resolve_command_payment", playerId: "player2", commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded) });
    }
    expect(r.ok).toBe(true);
    return r.state;
  };
  const silvaPrompted = (s: GameState) =>
    s.pendingEffectChoice?.sourceCardId === "RS-528" ||
    legal(s).some((a) => a.playerId === "player1" && JSON.stringify(a).includes("RS-528:sv"));

  it("RS-528: カタログ本文・スペックが出典と一致（出典: atwiki/page-1232）", () => {
    expectCatalogText("RS-528", TEXT);
    expectStats("RS-528", {
      name: "バイオハンター・シルバ（2nd）",
      category: "DA",
      size: "S",
      bp: 4000,
      sp: undefined,
      powerCost: 3,
      features: ["メカ", "人型", "2nd"],
    });
  });

  registerTests("RS-528", "atwiki/page-1232");

  // 既知の不具合: CARD-RS-528 【バイオ粒子反応アリ！】（OT のラッシュに反応してリリース）が未実装
  it.fails("RS-528: 【バイオ粒子反応アリ！】ホールド状態のシルバが自軍エリアにあるとき、OT の敵軍ユニットがラッシュされると、これをリリースする選択が出る（出典: atwiki/page-1232「OTを持つ敵軍ユニットがラッシュされたとき、これをリリースしてもよい」）", () => {
    const s = enemyRushes("SPEC-OT-S");
    expect(silvaPrompted(s)).toBe(true);
  });

  // 既知の不具合: CARD-RS-528 【バイオ粒子反応アリ！】が未実装（相手の撃破／ダメージの選択が起きない）
  it.fails("RS-528: 【バイオ粒子反応アリ！】リリースすると、相手はラッシュしたユニットを撃破するか1点ダメージを受けるかを選ぶ（撃破を選べばラッシュしたユニットは捨札）（出典: atwiki/page-1232「相手はラッシュしたユニットを撃破するか、1点ダメージを受けるかを選ぶ」）", () => {
    const s = resolveAll(enemyRushes("SPEC-OT-S"), ["RS-528:sv", "SPEC-OT-S:u"]);
    expect(cardIn(s, "player1", "RS-528:sv")?.commandHeld).not.toBe(true);
    const destroyed = zoneOf(s, "player2", "SPEC-OT-S:u") === "discard";
    const damaged = s.players.player2.damage === 1;
    expect(destroyed !== damaged).toBe(true);
  });

  it("RS-528: 【バイオ粒子反応アリ！】OT を持たない敵軍ユニットのラッシュには反応しない（出典: atwiki/page-1232「OTを持つ敵軍ユニット」）", () => {
    const s = enemyRushes("SPEC-WB0");
    expect(silvaPrompted(s)).toBe(false);
  });

  it("RS-528: 【バイオ粒子反応アリ！】シルバがリリース状態ならリリースできないので反応しない（出典: atwiki/page-1232「これをリリースしてもよい」）", () => {
    const s = enemyRushes("SPEC-OT-S", inst("RS-528", "sv"));
    expect(silvaPrompted(s)).toBe(false);
    expect(zoneOf(resolveAll(s), "player2", "SPEC-OT-S:u")).toBe("rush");
  });

  it.todo(
    "RS-528: 【バイオ粒子反応アリ！】相手がダメージを選んだとき、OT を持つ自軍ユニットがあれば自分も1点ダメージを受ける（出典: atwiki/page-1232「OTを持つ自軍ユニットがあれば、自分も1点ダメージを受ける」）— 相手の選択（撃破／ダメージ）を指定する手段がエンジンに無く（効果自体が未実装。上の it.fails）、ダメージ側を確定させて検証できない",
  );

  it("RS-528: Q&A — バルジオン（2nd）にライドしているシルバは、さらにデカバイクにライドできない（出典: grnrngr/faq-card-8 RS-528 Q「いいえ」）", () => {
    let s = st({ player1: { rush: [inst("RS-528", "s"), inst("RS-527", "bj"), inst("RS-570", "bike")], deck: deckCards(3) } });
    s = settle(act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "RS-528:s", vehicleInstanceId: "RS-527:bj" }));
    expect(legal(s).some((a) => a.type === "mount_ride" && a.riderInstanceId === "RS-528:s" && a.vehicleInstanceId === "RS-570:bike")).toBe(false);
  });
});

// ===========================================================================
describe("RS-529 チェンジロボ", () => {
  const TEXT =
    "合体―ジェットチェンジャー1＋ヘリチェンジャー2＋ランドチェンジャー3 【電撃剣スーパーサンダーボルト】これがアタックまたはストライクしたとき、MAを持つ自軍コマンドの必要パワーの数字を順番に見て、その数字と同じ必要パワーの数字を持つ敵軍コマンドがあれば、すべて持ち主のパワーゾーンにダメージにして置く。";
  const MA3 = sUnit("SPEC-MA-CMD3", { type: "operation", category: "MA", powerCost: 3 } as never);

  const rushState = (power: number, rush = [inst("RS-530", "j"), inst("RS-531", "h"), inst("RS-532", "l")]) =>
    st({ phase: "rush", turn: 3, player1: { hand: [inst("RS-529", "cr")], rush, command: releasedCat("ET", 1), power: powerCards(power), deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });

  /** 自軍バトルフェイズ: チェンジロボがバトルエリアにいる。敵軍コマンド: 必要パワー1（ET）2枚・必要パワー3（WB）1枚。 */
  const battle = (myCommand = [released("TST-OP-MA", "ma1")]) =>
    st(
      {
        player1: { battle: [inst("RS-529", "cr")], command: myCommand, deck: deckCards(3) },
        player2: {
          battle: [inst("TST-UNIT-0", "et")],
          command: [released("TST-OP-ET", "c1a"), held("TST-OP-OT", "c1b"), released("TST-OP", "c3")],
          deck: deckCards(3, "e"),
        },
      },
      [MA3],
    );

  it("RS-529: カタログ本文・スペックが出典と一致（出典: atwiki/page-1226）", () => {
    expectCatalogText("RS-529", TEXT);
    expectStats("RS-529", {
      name: "チェンジロボ",
      category: "ET",
      size: "L",
      bp: 12000,
      sp: 1,
      powerCost: "7+",
      features: ["メカ", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  it("RS-529: 追加条件 — 自軍のジェットチェンジャー1・ヘリチェンジャー2・ランドチェンジャー3を捨札にしてラッシュできる（出典: atwiki/page-1226「追加条件：自軍合体ユニットを捨札にする」・R-ADD-06）", () => {
    const r = rushFromHand(rushState(7), "player1", "RS-529:cr");
    expect(r.ok).toBe(true);
    const s = resolveAll(r.state);
    expect(zoneOf(s, "player1", "RS-529:cr")).toBe("rush");
    for (const id of ["RS-530:j", "RS-531:h", "RS-532:l"]) expect(zoneOf(s, "player1", id)).toBe("discard");
  });

  it("RS-529: 合体ユニットが1体でも欠けていればラッシュできない（出典: atwiki/page-1226「合体―」・R-ADD-06）", () => {
    expect(canStartRush(rushState(7, [inst("RS-530", "j"), inst("RS-531", "h")]), "player1", "RS-529:cr")).toBe(false);
  });

  it("RS-529: 必要パワー7+ — パワー6では合体ユニットが揃っていてもラッシュできない（出典: atwiki/page-1226「必要パワー：7+」・R-ADD-01/02）", () => {
    expect(canStartRush(rushState(6), "player1", "RS-529:cr")).toBe(false);
  });

  // 既知の不具合: CARD-RS-529 【電撃剣スーパーサンダーボルト】が未実装（アタックで敵軍コマンドが動かない）
  it.fails("RS-529: 【電撃剣】アタックしたとき、MA の自軍コマンド（必要パワー1）と同じ必要パワーの敵軍コマンドをホールド・リリース問わずすべて持ち主のパワーゾーンにダメージとして置く（出典: atwiki/page-1226「これがアタックまたはストライクしたとき…すべて持ち主のパワーゾーンにダメージにして置く」）", () => {
    const s = resolveAll(attack(battle(), "RS-529:cr", "TST-UNIT-0:et"));
    for (const id of ["TST-OP-ET:c1a", "TST-OP-OT:c1b"]) {
      expect(zoneOf(s, "player2", id)).toBe("power");
      expect(cardIn(s, "player2", id)?.faceDown).toBe(true);
    }
    expect(zoneOf(s, "player2", "TST-OP:c3")).toBe("command");
  });

  // 既知の不具合: CARD-RS-529 【電撃剣スーパーサンダーボルト】が未実装（ストライクで敵軍コマンドが動かない）
  it.fails("RS-529: 【電撃剣】ストライクしたときも発動し、MA の自軍コマンドが必要パワー1と3なら両方の数字の敵軍コマンドを置く（出典: atwiki/page-1226「必要パワーの数字を順番に見て」）", () => {
    const s = resolveAll(strike(battle([released("TST-OP-MA", "ma1"), released("SPEC-MA-CMD3", "ma3")]), "RS-529:cr"));
    for (const id of ["TST-OP-ET:c1a", "TST-OP-OT:c1b", "TST-OP:c3"]) expect(zoneOf(s, "player2", id)).toBe("power");
  });

  it("RS-529: 【電撃剣】MA を持つ自軍コマンドがなければ敵軍コマンドは動かない（出典: atwiki/page-1226「MAを持つ自軍コマンド」）", () => {
    const s = resolveAll(attack(battle([released("TST-OP-ET", "et1")]), "RS-529:cr", "TST-UNIT-0:et"));
    expect(s.players.player2.command).toHaveLength(3);
  });
});

// ===========================================================================
/** 自軍バトルフェイズ: fillers の後に id を position 番目に出す。 */
function ncAt(id: string, position: number, p2: Partial<GameState["players"]["player2"]> = {}, p1: Partial<GameState["players"]["player1"]> = {}) {
  const s = st({ player1: { battle: fill(position - 1), rush: [inst(id, "x")], deck: deckCards(3), ...p1 }, player2: { deck: deckCards(3, "e"), ...p2 } });
  return enter(s, `${id}:x`);
}

/** 敵軍（player2）ターン: player1 のバトルエリアに [unit, next] を並べ、unit にアタックできるか。 */
function scrumProtected(unit: string, next: string | null): boolean {
  const NEXT = sUnit("SPEC-SCRUM-NEXT", { comboNumber: Number(next ?? 0) || undefined });
  const battle = [inst(unit, "sc"), ...(next ? [inst("SPEC-SCRUM-NEXT", "nx")] : [])];
  const s = st({ activePlayer: "player2", player1: { battle, deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-7", "atk")], deck: deckCards(3, "e") } }, [NEXT]);
  return !attackTargets(s, "TST-UNIT-7:atk", "player2").includes(`${unit}:sc`);
}

/** 「自軍Sユニットを n 体コマンドゾーンに送るか捨札にする」追加条件の共通テスト。 */
function sendOrDiscardTests(id: string, n: number, cost: number, page: string) {
  const mk = (power: number, commands: number, rushS = n) =>
    st({ phase: "rush", turn: 3, player1: { hand: [inst(id, "h")], rush: fill(rushS), command: releasedCat("ET", commands), power: powerCards(power), deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });

  it(`${id}: 追加条件 — 自軍 S ユニット${n}体を捨札にしてラッシュできる（出典: ${page}・R-ADD-04）`, () => {
    const r = rushFromHand(mk(cost, 1), "player1", `${id}:h`, { destination: "discard" });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", `${id}:h`)).toBe("rush");
    for (let i = 0; i < n; i++) expect(zoneOf(r.state, "player1", `TST-UNIT-0:f${i}`)).toBe("discard");
  });

  it(`${id}: 追加条件 — 自軍 S ユニット${n}体をコマンドゾーンにリリース状態で送ってラッシュできる（出典: ${page}・R-ADD-04「リリース状態で置きます」）`, () => {
    const r = rushFromHand(mk(cost, 1), "player1", `${id}:h`, { destination: "command" });
    expect(r.ok).toBe(true);
    for (let i = 0; i < n; i++) {
      expect(zoneOf(r.state, "player1", `TST-UNIT-0:f${i}`)).toBe("command");
      expect(cardIn(r.state, "player1", `TST-UNIT-0:f${i}`)?.commandHeld).not.toBe(true);
    }
  });

  it(`${id}: 必要パワー${cost}+ — パワー${cost - 1}ではラッシュできない（出典: ${page}・R-ADD-01/02）`, () => {
    expect(canStartRush(mk(cost - 1, 1), "player1", `${id}:h`)).toBe(false);
  });

  it(`${id}: 「＋」— 自軍 S ユニットが${n - 1}体しかいなければラッシュできない（出典: ${page}・R-ADD-02）`, () => {
    expect(canStartRush(mk(cost, 1, n - 1), "player1", `${id}:h`)).toBe(false);
  });
}

// ===========================================================================
describe("RS-530 ジェットチェンジャー1", () => {
  const TEXT =
    "※スクラム（これのＣＮより1多いCNを持つユニットがこれの次に並んでいる間、これはアタックされない） 【レーザービーム砲】敵軍バトルエリアから、必要パワーに「+」を持たないユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければこの効果は発動できない。";

  it("RS-530: カタログ本文・スペックが出典と一致（出典: atwiki/page-1157）", () => {
    expectCatalogText("RS-530", TEXT);
    expectStats("RS-530", {
      name: "ジェットチェンジャー1",
      category: "ET",
      size: "M",
      bp: 1000,
      sp: undefined,
      powerCost: "5+",
      comboNumber: 1,
      features: ["メカ", "航空機"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  sendOrDiscardTests("RS-530", 1, 5, "atwiki/page-1157「追加条件：自軍Sユニットを1体コマンドゾーンに送るか捨札にする」");

  it("RS-530: ※スクラム — CN2 のユニットが次に並んでいる間はアタックされず、いなければアタックされうる（出典: atwiki/page-1157・R-KW-SCRUM-01）", () => {
    expect(scrumProtected("RS-530", "2")).toBe(true);
    expect(scrumProtected("RS-530", null)).toBe(false);
    expect(scrumProtected("RS-530", "3")).toBe(false);
  });

  // 既知の不具合: CARD-RS-530 必要パワーに「+」を持つユニット（TST-UNIT-7「7+」）も候補に入る
  it.fails("RS-530: 【レーザービーム砲】（NC・1番目）候補は敵軍バトルエリアの必要パワーに「+」を持たないユニットだけ（ラッシュエリア・「7+」は不可）。選択は見送れない（出典: atwiki/page-1157「敵軍バトルエリアから、必要パワーに「+」を持たないユニットを1体選び」）", () => {
    const s = ncAt("RS-530", 1, { battle: [inst("TST-UNIT-0", "e0"), inst("TST-UNIT-2", "e2"), inst("TST-UNIT-7", "e7")], rush: [inst("TST-UNIT-0", "er")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-530");
    expect(choiceIds(s)).toEqual(["TST-UNIT-0:e0", "TST-UNIT-2:e2"]);
    expect(canSkip(s)).toBe(false);
  });

  it("RS-530: 【レーザービーム砲】選んだユニットを持ち主のコマンドゾーンにホールド状態で置く（出典: atwiki/page-1157「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    let s = ncAt("RS-530", 1, { battle: [inst("TST-UNIT-0", "e0")] });
    s = resolveAll(pick(s, "TST-UNIT-0:e0"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e0")).toBe("command");
    expect(cardIn(s, "player2", "TST-UNIT-0:e0")?.commandHeld).toBe(true);
  });

  // 既知の不具合: CARD-RS-530 コマンドゾーンが満杯でも発動し、選んだユニットを捨札にしてしまう
  it.fails("RS-530: 【レーザービーム砲】敵軍コマンドゾーンが5枚で置けなければ発動しない（ユニットはその場に留まる）（出典: atwiki/page-1157「置けなければこの効果は発動できない」・02-zones-cards 上限5枚）", () => {
    const s = resolveAll(ncAt("RS-530", 1, { battle: [inst("TST-UNIT-0", "e0")], command: releasedCat("WB", 5, "ec") }));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e0")).toBe("battle");
    expect(s.players.player2.command).toHaveLength(5);
  });

  it("RS-530: NC — 1番目以外（2番目）に出ても【レーザービーム砲】は発動しない（出典: R-CN-02）", () => {
    const s = ncAt("RS-530", 2, { battle: [inst("TST-UNIT-0", "e0")] });
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-530");
    expect(zoneOf(resolveAll(s), "player2", "TST-UNIT-0:e0")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-531 ヘリチェンジャー2", () => {
  const TEXT =
    "※スクラム（これのＣＮより1多いCNを持つユニットがこれの次に並んでいる間、これはアタックされない） 【対地ミサイル】敵軍捨札からカードを1枚選び、持ち主のコマンドゾーンにホールド状態で置いてもよい。置けなければこの効果は発動できない。";

  it("RS-531: カタログ本文・スペックが出典と一致（出典: atwiki/page-1158）", () => {
    expectCatalogText("RS-531", TEXT);
    expectStats("RS-531", {
      name: "ヘリチェンジャー2",
      category: "ET",
      size: "M",
      bp: 6000,
      sp: undefined,
      powerCost: "4+",
      comboNumber: 2,
      features: ["メカ", "航空機"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  sendOrDiscardTests("RS-531", 2, 4, "atwiki/page-1158「追加条件：自軍Sユニットを2体コマンドゾーンに送るか捨札にする」");

  // 既知の不具合: CARD-RS-531 コマンドが4つのとき、1体をコマンドゾーン・1体を捨札に分けて送れてしまう
  it.fails("RS-531: Q&A — 2体は「両方コマンドゾーン」か「両方捨札」のどちらか。自軍コマンドが4つなら両方捨札にしなければならない（出典: atwiki/page-1158 Q1「はい、その通りです」）", () => {
    const s = st({ phase: "rush", turn: 3, player1: { hand: [inst("RS-531", "h")], rush: fill(2), command: releasedCat("ET", 4), power: powerCards(4), deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    const r = rushFromHand(s, "player1", "RS-531:h", { destination: "command" });
    const split = r.ok && zoneOf(r.state, "player1", "TST-UNIT-0:f0") !== zoneOf(r.state, "player1", "TST-UNIT-0:f1");
    expect(split).toBe(false);
  });

  it("RS-531: ※スクラム — CN3 のユニットが次に並んでいる間はアタックされず、いなければアタックされうる（出典: atwiki/page-1158・R-KW-SCRUM-01）", () => {
    expect(scrumProtected("RS-531", "3")).toBe(true);
    expect(scrumProtected("RS-531", null)).toBe(false);
  });

  // 既知の不具合: CARD-RS-531 【対地ミサイル】が未実装（NC のログだけで何も起きない）
  it.fails("RS-531: 【対地ミサイル】（NC・2番目）敵軍捨札のカードを1枚選び、持ち主のコマンドゾーンにホールド状態で置く（出典: atwiki/page-1158）", () => {
    let s = ncAt("RS-531", 2, { discard: [inst("TST-UNIT-0", "d0"), inst("TST-OP", "d1")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-531");
    expect(choiceIds(s)).toEqual(["TST-OP:d1", "TST-UNIT-0:d0"]);
    s = resolveAll(pick(s, "TST-OP:d1"));
    expect(zoneOf(s, "player2", "TST-OP:d1")).toBe("command");
    expect(cardIn(s, "player2", "TST-OP:d1")?.commandHeld).toBe(true);
  });

  // 既知の不具合: CARD-RS-531 【対地ミサイル】が未実装（選択が出ない）
  it.fails("RS-531: 【対地ミサイル】「置いてもよい」— 見送れる（出典: atwiki/page-1158「置いてもよい」）", () => {
    const s0 = ncAt("RS-531", 2, { discard: [inst("TST-OP", "d1")] });
    expect(canSkip(s0)).toBe(true);
    expect(zoneOf(resolveAll(skip(s0)), "player2", "TST-OP:d1")).toBe("discard");
  });

  it("RS-531: 【対地ミサイル】自軍捨札のカードは選べない（出典: atwiki/page-1158「敵軍捨札から」）", () => {
    const s = ncAt("RS-531", 2, { discard: [inst("TST-OP", "d1")] }, { discard: [inst("TST-OP", "mine")] });
    expect(choiceIds(s)).not.toContain("TST-OP:mine");
  });

  it("RS-531: 【対地ミサイル】敵軍コマンドゾーンが5枚で置けなければ発動しない（出典: atwiki/page-1158「置けなければこの効果は発動できない」）", () => {
    const s = resolveAll(ncAt("RS-531", 2, { discard: [inst("TST-OP", "d1")], command: releasedCat("WB", 5, "ec") }));
    expect(zoneOf(s, "player2", "TST-OP:d1")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-532 ランドチェンジャー3", () => {
  const TEXT =
    "※スクラム（これのＣＮより1多いCNを持つユニットがこれの次に並んでいる間、これはアタックされない） 【ミサイル発射】合体の必要な敵軍ユニットを1体選び撃破する。ただし、選んだユニットの合体に必要なユニットカードのうち、どれか1枚でも敵軍捨札にあれば、そのユニットは撃破できない。";

  it("RS-532: カタログ本文・スペックが出典と一致（出典: atwiki/page-1159）", () => {
    expectCatalogText("RS-532", TEXT);
    expectStats("RS-532", {
      name: "ランドチェンジャー3",
      category: "ET",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: "4+",
      comboNumber: 3,
      features: ["メカ", "車両", "航空機"],
      rushCondition: "send_s_unit_to_command_or_discard",
    });
  });

  sendOrDiscardTests("RS-532", 2, 4, "atwiki/page-1159「追加条件：自軍Sユニットを2体コマンドゾーンに送るか捨札にする」");

  // 既知の不具合: CARD-RS-532 コマンドが4つのとき、1体をコマンドゾーン・1体を捨札に分けて送れてしまう
  it.fails("RS-532: Q&A — 2体は「両方コマンドゾーン」か「両方捨札」のどちらか。自軍コマンドが4つなら両方捨札にしなければならない（出典: atwiki/page-1159 Q2「はい、その通りです」）", () => {
    const s = st({ phase: "rush", turn: 3, player1: { hand: [inst("RS-532", "h")], rush: fill(2), command: releasedCat("ET", 4), power: powerCards(4), deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    const r = rushFromHand(s, "player1", "RS-532:h", { destination: "command" });
    const split = r.ok && zoneOf(r.state, "player1", "TST-UNIT-0:f0") !== zoneOf(r.state, "player1", "TST-UNIT-0:f1");
    expect(split).toBe(false);
  });

  it("RS-532: ※スクラム — CN4 のユニットが次に並んでいる間はアタックされず、いなければアタックされうる（出典: atwiki/page-1159・R-KW-SCRUM-01）", () => {
    expect(scrumProtected("RS-532", "4")).toBe(true);
    expect(scrumProtected("RS-532", null)).toBe(false);
  });

  // 既知の不具合: CARD-RS-532 【ミサイル発射】が未実装（NC のログだけで何も起きない）
  it.fails("RS-532: 【ミサイル発射】（NC・3番目）合体の必要な敵軍ユニット（チェンジロボ）を選び撃破する。合体の不要なユニットは選べない（出典: atwiki/page-1159「合体の必要な敵軍ユニットを1体選び撃破する」）", () => {
    let s = ncAt("RS-532", 3, { battle: [inst("RS-529", "robo"), inst("TST-UNIT-7", "big")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-532");
    expect(choiceIds(s)).toEqual(["RS-529:robo"]);
    s = resolveAll(pick(s, "RS-529:robo"));
    expect(zoneOf(s, "player2", "RS-529:robo")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-532 【ミサイル発射】が未実装
  it.fails("RS-532: 【ミサイル発射】敵軍ラッシュエリアの合体ユニットも選べる（出典: atwiki/page-1159「合体の必要な敵軍ユニット」— エリアの指定なし）", () => {
    let s = ncAt("RS-532", 3, { rush: [inst("RS-529", "robo")] });
    expect(choiceIds(s)).toEqual(["RS-529:robo"]);
    s = resolveAll(pick(s, "RS-529:robo"));
    expect(zoneOf(s, "player2", "RS-529:robo")).toBe("discard");
  });

  it("RS-532: 【ミサイル発射】合体に必要なユニットカード（ジェットチェンジャー1）が1枚でも敵軍捨札にあれば撃破できない（出典: atwiki/page-1159「どれか1枚でも敵軍捨札にあれば、そのユニットは撃破できない」）", () => {
    const s = resolveAll(ncAt("RS-532", 3, { battle: [inst("RS-529", "robo")], discard: [inst("RS-530", "dj")] }), ["RS-529:robo"]);
    expect(zoneOf(s, "player2", "RS-529:robo")).toBe("battle");
  });

  // 既知の不具合: CARD-RS-532 【ミサイル発射】が未実装
  it.fails("RS-532: 【ミサイル発射】自軍捨札に合体素材があっても、敵軍捨札になければ撃破できる（出典: atwiki/page-1159「敵軍捨札にあれば」）", () => {
    const s = resolveAll(ncAt("RS-532", 3, { battle: [inst("RS-529", "robo")] }, { discard: [inst("RS-530", "mj")] }), ["RS-529:robo"]);
    expect(zoneOf(s, "player2", "RS-529:robo")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-532 【ミサイル発射】が未実装（ファイヤーカイザーが撃破されない）
  it.fails("RS-532: Q&A — 敵軍捨札にビークルの「魔導馬バリキオン」（RK-581）しかなければ、ファイヤーカイザー（RS-113）は撃破される（出典: grnrngr/faq-card-8 RS-532 Q「はい、「RS-113 ファイヤーカイザー」は撃破されます」）", () => {
    const s = resolveAll(ncAt("RS-532", 3, { battle: [inst("RS-113", "fk")], discard: [inst("RK-581", "bk")] }), ["RS-113:fk"]);
    expect(zoneOf(s, "player2", "RS-113:fk")).toBe("discard");
  });
});
