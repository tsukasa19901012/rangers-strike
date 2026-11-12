/**
 * カード別スペック: XP-017〜XP-021（クロスギャザー プロモーションカード 仮面ライダーディケイド激情態〜ファイナルカメンアタックフォームライド）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）。grnrngr の公式FAQ を「XP-」とカード名で検索: 本範囲のカードの項はない。
 *     atwiki に転載された公式 Q&A: XP-017 Q1（atwiki/page-1981。XG2-055・RK-160 の両方をここで確認）・XP-018 Q1（atwiki/page-2130）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-XP-NNN.md。ライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-CAT-02 マルチカテゴリ・R-KW-RC-01・R-KW-MORPH-03・R-KW-REG・R-KW-PERM-01）・atwiki のカード評価
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-XP-NNN …」）で残す。
 * レアリティは atwiki の「プロモーション（カード）」を PR、「リミテッドレア」を LR として照合する。
 * 同じ本文の再録（XP-019＝RK-023）は元カードの cardSpec（RK2-022-042.a）と同じ確かめ方をする。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  attack,
  attackUntilRegister,
  bpOf,
  canSkip,
  canStrike,
  canUseCard,
  chaseTargets,
  choiceIds,
  damageCards,
  damageOf,
  deckCards,
  enemyRushes,
  enemyTurnBoard,
  enter,
  expectCatalogText,
  expectChoiceFrom,
  expectOp,
  expectUnit,
  inst,
  legal,
  many,
  morphCandidates,
  passEntry,
  payableFor,
  PLAIN_VEHICLE,
  pick,
  playOp,
  powerCards,
  rcBoard,
  raw,
  rcUnit,
  registerOffered,
  released,
  releasedCat,
  resolveAll,
  ridingPair,
  rushFromHand,
  rushPhase,
  settle,
  spOf,
  st,
  strike,
  sUnit,
  zoneIds,
  zoneOf,
} from "./XP-017-032.helpers";

const ENEMY0 = sUnit("SPEC-ENEMY0", { category: "WB", powerCost: 0, bp: 1000 });
const E1500 = sUnit("SPEC-E1500", { bp: 1500 });
const E2000 = sUnit("SPEC-E2000", { bp: 2000 });
const RC3500 = rcUnit("SPEC-RC3500", { bp: 3500 });
const WB_MA = sUnit("SPEC-WB-MA", { category: ["WB", "MA"] as never, bp: 2000 });
const MA_ONLY = sUnit("SPEC-MA", { category: "MA", bp: 2000 });
const WB_ET = sUnit("SPEC-WB-ET", { category: ["WB", "ET"] as never, bp: 2000 });
const SAMURAI = sUnit("SPEC-SAMURAI", { category: "WB", bp: 1000, features: ["侍"] });
const SILVER = sUnit("SPEC-SILVER", { category: "WB", bp: 1000, features: ["シルバー"] });
const PLAIN = sUnit("SPEC-PLAIN", { category: "WB", bp: 1000 });
const EXTRA = [ENEMY0, E1500, E2000, RC3500, WB_MA, MA_ONLY, WB_ET, SAMURAI, SILVER, PLAIN];
const MA_NOSP = sUnit("SPEC-MA-NOSP", { category: "MA", bp: 1000, sp: undefined });
const RC_SAMURAI = rcUnit("SPEC-RC-SAMURAI", { category: "WB", bp: 1000, features: ["侍"] });
const ET_S = sUnit("SPEC-ET-S", { category: "ET", bp: 1000, powerCost: 1 });

// ===========================================================================
describe("XP-017 仮面ライダーディケイド激情態", () => {
  const TEXT =
    "※これは手札からしかラッシュできない。 【世界の破壊者】自分と相手のパワーゾーンのカードの枚数をくらべ、枚数が多いパワーゾーンの持ち主は次のようにする⇒自分自身のパワーゾーンのカードの枚数が対戦相手と同じになるまで、自分自身のオモテ向きのパワーを可能な限り選び捨札にする。";

  it("XP-017: カタログ本文・スペックが出典と一致（OT／DA のマルチカテゴリ）（出典: atwiki/page-1981）", () => {
    expectCatalogText("XP-017", TEXT);
    expectUnit("XP-017", {
      name: "仮面ライダーディケイド激情態",
      category: ["OT", "DA"],
      size: "S",
      bp: 4000,
      sp: "1/4",
      powerCost: 4,
      comboNumber: "RC",
      features: ["仮面ライダー", "男", "ディケイドライバー"],
      rarity: "PR",
    });
  });

  it("XP-017: 手札からの通常のラッシュは、OT と DA のコマンドがあればできる（マルチカテゴリ）（出典: atwiki/page-1981・R-CAT-02）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("XP-017", "gj")], command: [...releasedCat("OT", 1), ...releasedCat("DA", 1)], power: powerCards(4) }), "player1", "XP-017:gj");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "XP-017:gj")).toBe("rush");
  });

  it("XP-017: ※ 手札からしかラッシュできない — モーフの置き換え先に選べない（特徴が完全一致するディケイド ファイズは選べる）（出典: atwiki/page-1981「※これは手札からしかラッシュできない」・カード評価「他の特徴「ディケイドライバー」持ちユニットからのモーフ…はできない」）", () => {
    const s = enemyRushes({ battle: [inst("XP-004", "dc")], command: [released("XP-017", "gj"), released("XG1-066", "fz")] }, "SPEC-ENEMY0:e", EXTRA);
    expect(morphCandidates(s)).toEqual(["XG1-066:fz"]);
  });

  it("XP-017: 【世界の破壊者】RC — 相手のパワーゾーンの枚数（6）が多ければ、相手はオモテ向きのパワーを捨札にして自分（3）と同じ枚数にする（出典: atwiki/page-1981）", () => {
    const s = resolveAll(rcBoard("XP-017:gj", { power: powerCards(3) }, { power: [...powerCards(4, "ep"), ...damageCards(2, "ed")], damage: 2 }));
    expect(s.players.player2.power).toHaveLength(3);
    expect(s.players.player2.power.filter((c) => c.faceDown)).toHaveLength(2);
    expect(s.players.player2.discard).toHaveLength(3);
    expect(s.players.player1.power).toHaveLength(3);
  });

  it("XP-017: 【世界の破壊者】「可能な限り」— オモテ向きのパワーが足りなければ、オモテ向きをすべて捨札にしてそこで終わる（ダメージは捨札にしない）（出典: atwiki/page-1981「自分自身のオモテ向きのパワーを可能な限り選び捨札にする」）", () => {
    const s = resolveAll(rcBoard("XP-017:gj", { power: powerCards(1) }, { power: [...powerCards(1, "ep"), ...damageCards(4, "ed")], damage: 4 }));
    expect(s.players.player2.power).toHaveLength(4);
    expect(s.players.player2.power.every((c) => c.faceDown)).toBe(true);
  });

  it("XP-017: 【世界の破壊者】自分のパワーゾーンのほうが多ければ、自分が捨札にする（出典: atwiki/page-1981「枚数が多いパワーゾーンの持ち主は」）", () => {
    const s = resolveAll(rcBoard("XP-017:gj", { power: powerCards(5) }, { power: powerCards(2, "ep") }));
    expect(s.players.player1.power).toHaveLength(2);
    expect(s.players.player2.power).toHaveLength(2);
  });

  it("XP-017: 【世界の破壊者】ライドしないで出たとき（RC 不成立）は何も起きない（出典: atwiki/page-1981「CN：RC」・R-KW-RC-01）", () => {
    const s = resolveAll(passEntry(enter(st({ player1: { rush: [inst("XP-017", "gj")], power: powerCards(3), deck: deckCards(3) }, player2: { power: powerCards(6, "ep"), deck: deckCards(3, "e") } }), "XP-017:gj")));
    expect(s.players.player2.power).toHaveLength(6);
  });

  it("XP-017: 公式Q&A — XG2-055 変身一発の「手札から選んで出す」効果ではラッシュできる（出典: atwiki/page-1981 Q1・atwiki/page-1764 Q4）", () => {
    const r = playOp(rushPhase({ hand: [inst("XG2-055", "ip"), inst("XP-017", "gj")], command: releasedCat("ET", 1) }), "player1", "XG2-055:ip");
    expect(r.ok, r.error).toBe(true);
    expect(choiceIds(r.state)).toContain("XP-017:gj");
    expect(zoneOf(resolveAll(pick(r.state, "XP-017:gj")), "player1", "XP-017:gj")).toBe("rush");
  });
  it("XP-017: 公式Q&A — RK-160 シザーズジャガー【ナノロボット散布実験】の「手札から1枚選び、ラッシュエリアに出す」でもラッシュできる（必要パワー4の敵軍 S ユニットのラッシュに反応。XP-017 は DA を持つ）（出典: atwiki/page-1981 Q1「はい、できます」）", () => {
    const E4 = sUnit("SPEC-E4", { category: "WB", bp: 1000, powerCost: 4 });
    const s0 = st(
      {
        phase: "rush",
        activePlayer: "player2",
        player1: { rush: [inst("RK-160", "sj")], hand: [inst("XP-017", "gj")], command: releasedCat("DA", 1), deck: deckCards(3) },
        player2: { hand: [inst("SPEC-E4", "er")], command: releasedCat("WB", 1), power: powerCards(4, "ep"), deck: deckCards(3, "e") },
      },
      [E4],
    );
    const r = rushFromHand(s0, "player2", "SPEC-E4:er");
    expect(r.ok, r.error).toBe(true);
    expectChoiceFrom(r.state, "player1", "RK-160");
    expect(choiceIds(r.state)).toContain("XP-017:gj");
    const s = resolveAll(pick(r.state, "XP-017:gj"));
    expect(zoneOf(s, "player1", "XP-017:gj")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-E4:er")).toBe("discard");
  });
});

// ===========================================================================
describe("XP-018 ゴールド寿司", () => {
  const TEXT =
    "※常駐 特徴に「シルバー」または「ゴールド」または「侍」を持つ自軍Sユニットは、自軍コマンドゾーンにあるカードのカテゴリごとに次の能力を得る⇒WBがあればレジストを得る。MAがあればタクスMAを得る。OTがあればチェイスを得る。ETがあればコールETを得る。";

  it("XP-018: カタログ本文・スペックが出典と一致（MA／ET のマルチカテゴリ）（出典: atwiki/page-2130）", () => {
    expectCatalogText("XP-018", TEXT);
    expectOp("XP-018", { name: "ゴールド寿司", category: ["MA", "ET"], powerCost: 3, rarity: "PR" });
  });

  it("XP-018: ※常駐 — MA と ET のコマンドがあれば使え、常駐置き場に置かれる（出典: atwiki/page-2130・R-CAT-02・R-KW-PERM-01）", () => {
    const r = playOp(rushPhase({ hand: [inst("XP-018", "gs")], command: [...releasedCat("MA", 1), ...releasedCat("ET", 1)], power: powerCards(3) }), "player1", "XP-018:gs");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "XP-018:gs")).toBe("operation");
  });

  const attackedSushi = (target: string, command = releasedCat("WB", 1)) =>
    attackUntilRegister({ battle: [inst(target.split(":")[0]!, target.split(":")[1]!)], operation: [inst("XP-018", "gs")], command }, target, {}, "TST-UNIT-7:atk", EXTRA);

  it("XP-018: 自軍コマンドゾーンに WB があれば、特徴「侍」の自軍 S ユニット（XP-012 シンケンゴールド。レジストなし）はレジストを得る（出典: atwiki/page-2130「WBがあればレジストを得る」）", () => {
    expect(registerOffered(attackedSushi("XP-012:sg"))).toBe(true);
  });

  it("XP-018: 特徴「シルバー」の自軍 S ユニットもレジストを得る（出典: atwiki/page-2130「特徴に「シルバー」または「ゴールド」または「侍」を持つ」）", () => {
    expect(registerOffered(attackedSushi("SPEC-SILVER:s"))).toBe(true);
  });

  it("XP-018: 自軍コマンドゾーンに WB がなければレジストを得ない（出典: atwiki/page-2130「WBがあれば」）", () => {
    expect(registerOffered(attackedSushi("XP-012:sg", releasedCat("MA", 1)))).toBe(false);
  });

  it("XP-018: 「シルバー」「ゴールド」「侍」を持たない自軍ユニットはレジストを得ない（出典: atwiki/page-2130）", () => {
    expect(registerOffered(attackedSushi("SPEC-PLAIN:p"))).toBe(false);
  });

  it("XP-018: MA があればタクスMA を得る（特徴「侍」の S ユニットの右隣、バトルエリア3番目の MA の S ユニットが SP1）（出典: atwiki/page-2130「MAがあればタクスMAを得る」・R-KW-TAKUS-01）", () => {
    const board = (command = releasedCat("MA", 1)) =>
      st({ phase: "battle", player1: { battle: [inst("SPEC-PLAIN", "p"), inst("SPEC-SAMURAI", "h"), inst("SPEC-MA-NOSP", "m")], operation: [inst("XP-018", "gs")], command, deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }, [...EXTRA, MA_NOSP]);
    expect(spOf(board(), "player1", "SPEC-MA-NOSP:m")).toBe(1);
    expect(spOf(board(releasedCat("WB", 1)), "player1", "SPEC-MA-NOSP:m")).toBe(0);
  });

  it("XP-018: OT があればチェイスを得る（ライド中に撃破されるとき、ライドされていない自軍ビークルに乗り換えられる）（出典: atwiki/page-2130「OTがあればチェイスを得る」・R-KW-CHASE-01）", () => {
    const chased = (command: ReturnType<typeof releasedCat>) => {
      const s = st(
        {
          player1: { rush: [inst("TST-UNIT-7", "a")], deck: deckCards(3) },
          player2: { operation: [inst("XP-018", "gs")], command, battle: ridingPair("SPEC-RC-SAMURAI", "r", "SPEC-VEHICLE", "v"), rush: [inst("SPEC-VEHICLE", "v2")], deck: deckCards(3, "e") },
        },
        [...EXTRA, RC_SAMURAI, PLAIN_VEHICLE],
      );
      return attack(enter(s, "TST-UNIT-7:a"), "TST-UNIT-7:a", "SPEC-RC-SAMURAI:r");
    };
    expect(chaseTargets(chased(releasedCat("OT", 1)), "player2")).toEqual(["SPEC-VEHICLE:v2"]);
    expect(chaseTargets(chased(releasedCat("WB", 1)), "player2")).toEqual([]);
  });

  it("XP-018: ET があればコールET を得る（ET のユニットをラッシュするためのコマンドとしてホールドできる）（出典: atwiki/page-2130「ETがあればコールETを得る」・R-KW-CALL-01）", () => {
    const board = (command: ReturnType<typeof releasedCat>) =>
      rushPhase({ hand: [inst("SPEC-ET-S", "h")], rush: [inst("SPEC-SAMURAI", "c")], operation: [inst("XP-018", "gs")], command, power: powerCards(1) }, {}, [...EXTRA, ET_S]);
    const s = raw(board(releasedCat("ET", 1)), { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: "SPEC-ET-S:h" });
    expect(s.pendingCommandPayment?.validInstanceIds).toContain("SPEC-SAMURAI:c");
    // ET のコマンドがなければコールET を得ず、WB のコマンドだけでは ET のユニットのラッシュに払えない
    expect(legal(board(releasedCat("WB", 1))).some((a) => a.type === "initiate_command_payment" && "sourceInstanceId" in a && a.sourceInstanceId === "SPEC-ET-S:h")).toBe(false);
  });
  it("XP-018: 公式Q&A — 【黄金の希望】で「SP2」になった XG7-041 W・CJGX がゴールド寿司のチェイスで場に留まっても「SP2」のまま（出典: atwiki/page-2130 Q1「ラッシュ時に発動して解決を完了した、期限の指定のない効果は、そのユニットがユニットである間有効です」）", () => {
    // ライド中の XG7-041（【黄金の希望】で SP2）。自軍コマンドゾーンに OT、ラッシュエリアにライドされていないビークル。
    // ビークルは RS-393 コマンドアタッカー（「ETのSユニットは、ＲＣを持っていなくてもこのビークルにライドできる」。XG7-041 は ET の S ユニット）。
    const [v, gx] = ridingPair("XG7-041", "gx", "RS-393", "v");
    const board = st(
      {
        player1: { battle: [v!, { ...gx!, spUntilLeave: 2 }], rush: [inst("RS-393", "v2")], command: releasedCat("OT", 1), operation: [inst("XP-018", "gs")], deck: deckCards(3) },
        player2: { deck: deckCards(3, "e") },
      },
      EXTRA,
    );
    expect(spOf(board, "player1", "XG7-041:gx")).toBe(2);
    // 自分がターンを終えるとき、※で除外されるかわりにチェイスで乗り換える
    let s = settle(board);
    for (let i = 0; i < 10 && !s.pendingChase; i++) {
      const end = legal(s).find((a) => a.type === "end_phase");
      if (!end) break;
      s = raw(s, end);
    }
    expect(chaseTargets(s, "player1")).toEqual(["RS-393:v2"]);
    const atChase = s;
    s = settle(raw(s, legal(s).find((a) => a.type === "resolve_chase" && a.playerId === "player1")!));
    expect(zoneOf(s, "player1", "XG7-041:gx")).toBe("rush");
    // ターンを終えて相手のターンになっても SP2 のまま
    expect(s.activePlayer).toBe("player2");
    expect(spOf(s, "player1", "XG7-041:gx")).toBe(2);
    // チェイスしなければ※のとおり除外される
    const passed = settle(raw(atChase, { type: "pass_chase", playerId: "player1" }));
    expect((passed.players.player1.exile ?? []).map((c) => c.instanceId)).toContain("XG7-041:gx");
  });
});

// ===========================================================================
describe("XP-019 仮面ライダー1号", () => {
  const TEXT =
    "【技の1号】「SP1」これがアタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルし、自分が次の行動の宣言をするまで相手はカウンターを発動できない。";

  it("XP-019: カタログ本文・スペックが出典と一致（出典: atwiki/page-2131）", () => {
    expectCatalogText("XP-019", TEXT);
    expectUnit("XP-019", {
      name: "仮面ライダー1号",
      category: "ET",
      size: "S",
      bp: 4000,
      sp: "1/5",
      powerCost: 4,
      comboNumber: "RC",
      features: ["仮面ライダー", "男", "改造人間"],
      rarity: "PR",
    });
  });

  const rc = (p2: Partial<GameState["players"]["player2"]> = {}, p1: Partial<GameState["players"]["player1"]> = {}) => settle(rcBoard("XP-019:one", p1, p2, EXTRA));

  it("XP-019: RC — ライドオフすると「SP1」を得て、2番目に並んでもストライクで1点与える（出典: atwiki/page-2131「【技の1号】「SP1」」・カード評価「実物にはちゃんと通常のものと同様にRCがついている」・R-KW-RC-01）", () => {
    let s = rc();
    expect(zoneIds(s, "player1", "battle")).toEqual(["SPEC-VEHICLE:v", "XP-019:one"]);
    expect(canStrike(s, "XP-019:one")).toBe(true);
    s = settle(strike(s, "XP-019:one"));
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("XP-019: RC — アタックするとき、敵軍ユニットの BP を本来の値としてバトルする（ライドで BP4500 の相手〈本来 3500〉に BP4000 で勝つ）（出典: atwiki/page-2131「敵軍ユニットのBPをカードに表記された本来の値としてバトルし」）", () => {
    let s = rc({ battle: ridingPair("SPEC-RC3500", "e", "RK-024", "ev") });
    expect(bpOf(s, "player2", "SPEC-RC3500:e")).toBe(4500);
    s = resolveAll(attack(s, "XP-019:one", "SPEC-RC3500:e"));
    expect(zoneOf(s, "player2", "SPEC-RC3500:e")).toBe("discard");
    expect(zoneOf(s, "player1", "XP-019:one")).toBe("battle");
  });

  /** 相手（player2）がギギの腕輪（RK-004。WB のカウンター）を使える盤面。 */
  const gigi = { hand: [inst("RK-004", "g")], command: releasedCat("WB", 2, "eW"), power: powerCards(3, "ep") };
  const canCounter = (s: GameState) =>
    legal(s).some((a) => (a.type === "initiate_command_payment" && a.sourceInstanceId === "RK-004:g") || (a.type === "play_counter" && a.instanceId === "RK-004:g"));

  it("XP-019: RC — これがアタックするとき、相手はカウンターを発動できない（出典: atwiki/page-2131「自分が次の行動の宣言をするまで相手はカウンターを発動できない」）", () => {
    const s = attack(rc({ battle: [inst("SPEC-E1500", "e")], ...gigi }), "XP-019:one", "SPEC-E1500:e");
    expect(canCounter(s)).toBe(false);
  });

  it("XP-019: RC を発動していなければ、相手はアタックに対してカウンターを発動できる（出典: atwiki/page-2131・R-KW-RC-01）", () => {
    let s = enter(st({ player1: { rush: [inst("XP-019", "one")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-E1500", "e")], deck: deckCards(3, "e"), ...gigi } }, EXTRA), "XP-019:one");
    s = attack(s, "XP-019:one", "SPEC-E1500:e");
    expect(canCounter(s)).toBe(true);
  });
});

// ===========================================================================
describe("XP-020 護星天使", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる） カテゴリを2つ以上持つSユニットのうち、MAを持つSユニットは次の能力を得る⇒このユニットは敵軍ターン中BP+1000され、MAのオペレーションカードを使用するためのコマンドとしてホールドできる。";

  it("XP-020: カタログ本文・スペックが出典と一致（出典: atwiki/page-2127）", () => {
    expectCatalogText("XP-020", TEXT);
    expectOp("XP-020", { name: "護星天使", category: "MA", powerCost: 2, rarity: "PR" });
  });

  it("XP-020: ※常駐 — 使うと常駐置き場に置かれる（出典: atwiki/page-2127「※常駐（場に配置して、離れるまで効果が有効になる）」）", () => {
    const r = playOp(rushPhase({ hand: [inst("XP-020", "gt")], command: releasedCat("MA", 1), power: powerCards(2) }), "player1", "XP-020:gt");
    expect(r.ok).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "XP-020:gt")).toBe("operation");
  });

  it("XP-020: 敵軍ターン中、MA を含むマルチカテゴリの自軍 S ユニットは BP+1000（2000→3000）（出典: atwiki/page-2127「このユニットは敵軍ターン中BP+1000され」）", () => {
    const s = enemyTurnBoard({ battle: [inst("SPEC-WB-MA", "m")], operation: [inst("XP-020", "gt")] }, {}, EXTRA);
    expect(bpOf(s, "player1", "SPEC-WB-MA:m")).toBe(3000);
  });

  it("XP-020: 自分も相手も対象 — 相手の常駐でも、自軍の MA マルチカテゴリ S ユニットは敵軍ターン中 BP+1000（出典: atwiki/page-2127 カード評価「自分だけでなく相手も効果の対象になっている」）", () => {
    const s = enemyTurnBoard({ battle: [inst("SPEC-WB-MA", "m")] }, { operation: [inst("XP-020", "gt")] }, EXTRA);
    expect(bpOf(s, "player1", "SPEC-WB-MA:m")).toBe(3000);
  });

  it("XP-020: 自軍ターン中は BP が上がらない（出典: atwiki/page-2127「敵軍ターン中」）", () => {
    const s = st({ player1: { battle: [inst("SPEC-WB-MA", "m")], operation: [inst("XP-020", "gt")] } }, EXTRA);
    expect(bpOf(s, "player1", "SPEC-WB-MA:m")).toBe(2000);
  });

  it("XP-020: MA だけのユニット・MA を持たないマルチカテゴリのユニットは対象外（出典: atwiki/page-2127「カテゴリを2つ以上持つSユニットのうち、MAを持つSユニットは」）", () => {
    const s = enemyTurnBoard({ battle: [inst("SPEC-MA", "a"), inst("SPEC-WB-ET", "b")], operation: [inst("XP-020", "gt")] }, {}, EXTRA);
    expect(bpOf(s, "player1", "SPEC-MA:a")).toBe(2000);
    expect(bpOf(s, "player1", "SPEC-WB-ET:b")).toBe(2000);
  });

    it("XP-020: MA マルチカテゴリの自軍 S ユニットを、MA のオペレーション（2枚目の護星天使）を使うためのコマンドとしてホールドできる（自軍ターン中も。BP の増加とは独立）（出典: atwiki/page-2127「MAのオペレーションカードを使用するためのコマンドとしてホールドできる」・カード評価「独立した効果である事が公式のコラムで明言されている」・R-KW-READ-01）", () => {
    const s = rushPhase({ hand: [inst("XP-020", "gt2")], rush: [inst("SPEC-WB-MA", "m")], command: [released("TST-OP-MA", "c")], operation: [inst("XP-020", "gt")], power: powerCards(2) }, {}, EXTRA);
    expect(payableFor(s, "XP-020:gt2")).toContain("SPEC-WB-MA:m");
  });

  it("XP-020: 護星天使がなければ、そのユニットはコマンドとしてホールドできない（出典: atwiki/page-2127・R-KW-READ-01）", () => {
    const s = rushPhase({ hand: [inst("XP-020", "gt2")], rush: [inst("SPEC-WB-MA", "m")], command: [released("TST-OP-MA", "c")], power: powerCards(2) }, {}, EXTRA);
    expect(payableFor(s, "XP-020:gt2")).not.toContain("SPEC-WB-MA:m");
  });
});

// ===========================================================================
describe("XP-021 ファイナルカメンアタックフォームライド", () => {
  const TEXT =
    "※これは特徴「仮面ライダー」を持つユニット1体ごとと、特徴「仮面ライダー」を持つゾーンのオモテ向きのカード1枚ごとと、特徴「仮面ライダー」を持つ捨札1枚ごとにつき、必要パワーの数字が1減る。 ◎敵軍ユニットを1体選び撃破する。";

  it("XP-021: カタログ本文・スペックが出典と一致（リミテッドレア）（出典: atwiki/page-2078）", () => {
    expectCatalogText("XP-021", TEXT);
    expectOp("XP-021", { name: "ファイナルカメンアタックフォームライド", category: "OT", powerCost: 25, rarity: "LR" });
  });

  /**
   * 自軍ラッシュフェイズ。「仮面ライダー」（XG1-066）を自軍バトルエリア・自軍捨札・敵軍ラッシュエリア・敵軍パワー（オモテ）に riders 体ずつ置く
   * （合計 4×riders）。自軍パワーは power 枚。敵軍ラッシュエリアに L ユニット（TST-UNIT-7）。
   */
  const board = (riders: number, power: number) =>
    rushPhase({
      hand: [inst("XP-021", "far")],
      command: releasedCat("OT", 1),
      power: powerCards(power),
      battle: many("XG1-066", riders, "ob"),
      discard: many("XG1-066", riders, "od"),
    }, { rush: [...many("XG1-066", riders, "er"), inst("TST-UNIT-7", "big")], power: many("XG1-066", riders, "ep", true) });

  it("XP-021: 仮面ライダーが無ければ必要パワー25 — パワー25で使え、24では使えない（出典: atwiki/page-2078「必要パワー：25」）", () => {
    expect(canUseCard(board(0, 25), "player1", "XP-021:far")).toBe(true);
    expect(canUseCard(board(0, 24), "player1", "XP-021:far")).toBe(false);
  });

  it("XP-021: ※ お互いのエリアのユニット・ゾーンのオモテ向きのカード・捨札の「仮面ライダー」1枚ごとに必要パワーが1減る（20枚で25→5。パワー5で使える）（出典: atwiki/page-2078・カード評価「お互いのエリア・ゾーン・捨札にある仮面ライダーの数だけ必要パワーは減る」）", () => {
    expect(canUseCard(board(5, 5), "player1", "XP-021:far")).toBe(true);
  });

  it("XP-021: ※ 20枚減っても、パワー4では使えない（出典: atwiki/page-2078）", () => {
    expect(canUseCard(board(5, 4), "player1", "XP-021:far")).toBe(false);
  });

  it("XP-021: ◎ 敵軍ユニットを1体選び撃破する（サイズ・エリアを問わない。強制）（出典: atwiki/page-2078「敵軍ユニットを1体選び撃破する」・カード評価「エリアやサイズを問わない非常に汎用的な除去」）", () => {
    const r = playOp(board(0, 25), "player1", "XP-021:far");
    expect(r.ok).toBe(true);
    let s = r.state;
    expectChoiceFrom(s, "player1", "XP-021");
    expect(choiceIds(s)).toEqual(["TST-UNIT-7:big"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "TST-UNIT-7:big"));
    expect(zoneOf(s, "player2", "TST-UNIT-7:big")).toBe("discard");
  });
});

