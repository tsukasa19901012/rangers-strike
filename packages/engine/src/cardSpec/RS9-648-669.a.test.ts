/**
 * カード別スペック: RS-648〜RS-655（第9弾「蒼九の翼」ガオイカロス〜デカウイングロボ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲の該当なし）、grnrngr/faq-card-9
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_9.html。
 *      カード別 Q&A は無く、キーワード「ウイング」Q1〜Q6・「ブラスト」Q1 のみ。faq/card_1〜8・index にも該当カードの Q&A はない）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。本範囲のライブ写し pages/N.txt はない。
 *     各ページに Q&A 節はない）
 *  3. docs/rules/*.md の一般ルール（R-CN-01〜06、R-ADD-06 合体、R-KW-WING-*、R-KW-BLAST-01、R-DECK-04 2nd は同名 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import {
  act,
  attack,
  attackTargets,
  bpOf,
  canEnter,
  canSkip,
  canStartRush,
  canStrike,
  canWing,
  cardIn,
  choiceIds,
  deckCards,
  enterBattleByEffect,
  enterKeep,
  enterWithHold,
  expectCatalogText,
  expectStats,
  fill,
  held,
  heldN,
  holdToEnterTests,
  inst,
  legal,
  p1Battle,
  p1Rush,
  pick,
  powerCards,
  rarityOf,
  releasedCat,
  resolveAll,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  toPhase,
  wingTests,
  zoneOf,
} from "./RS9-648-669.helpers";

const E_S = sUnit("SPEC-ES", { bp: 2000 });
const E_M = sUnit("SPEC-EM", { bp: 3000, size: "M" });
const E_L = sUnit("SPEC-EL", { bp: 9000, size: "L" });

/** player1 のターン終了から player2 のスタートフェイズに入り、バトルエリアを戻す操作（return_all_battle_to_rush）を1回行う。 */
function enemyStartReturn(s: GameState): GameState {
  let t = s;
  for (let i = 0; i < 30 && !(t.activePlayer === "player2" && t.phase === "start"); i++) {
    const acts = legal(t);
    const a =
      acts.find((x) => x.type === "pass_battle_entry") ??
      acts.find((x) => x.type === "pass_battle_reaction") ??
      acts.find((x) => x.type === "pass_strike_reaction") ??
      acts.find((x) => x.type === "end_phase");
    if (!a) throw new Error(`enemyStartReturn: stuck; legal=${acts.map((x) => x.type).join(",")}`);
    t = act(t, a);
  }
  const ret = legal(t).find((x) => x.type === "return_all_battle_to_rush" && x.playerId === "player2" && !("instanceId" in x && x.instanceId));
  if (!ret) return t;
  return resolveAll(act(t, ret));
}

// ===========================================================================
describe("RS-648 ガオイカロス", () => {
  const TEXT =
    "合体―-ガオファルコン＋ガオライノス＋ガオマジロ＋ガオジュラフ＋ガオディアス ※ブラスト 【イカロスバインド】これがバトルエリアに出たとき、敵軍ユニットを1体選びホールドしてもよい。また、これが自軍バトルエリアにある間、相手は次の制限を受ける⇒ホールド状態のユニットをラッシュエリアに戻すとき、それを撃破するか戻さないかを選ぶ。";
  const PAGE = "atwiki/page-1497";
  const PARTS = ["RS-649:fa", "RS-650:ri", "RS-651:ma", "RS-157:ju", "RS-652:di"];
  const parts = (ids = PARTS) => ids.map((x) => inst(x.split(":")[0]!, x.split(":")[1]!));

  it("RS-648: カタログ本文・スペックが出典と一致（出典: atwiki/page-1497）", () => {
    expectCatalogText("RS-648", TEXT);
    expectStats("RS-648", {
      name: "ガオイカロス",
      category: "WB",
      size: "L",
      bp: 17000,
      sp: 1,
      powerCost: "7+",
      features: ["獣", "人型"],
      rushCondition: "discard_fusion_unit",
    });
  });

  it("RS-648: レアリティはスーパーレア（出典: atwiki/page-1497「レアリティ：スーパーレア」）", () => {
    expect(rarityOf("RS-648")).toBe("SR");
  });

  const rushBoard = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    p1Rush({ hand: [inst("RS-648", "ic")], command: releasedCat("WB", 1), power: powerCards(7), ...p1 });

  it("RS-648: 合体 — 自軍エリアのガオファルコン・ガオライノス・ガオマジロ・ガオジュラフ・ガオディアスをすべて捨札にしてラッシュできる（出典: atwiki/page-1497「合体―-…」・R-ADD-06）", () => {
    const r = rushFromHand(rushBoard({ rush: parts() }), "player1", "RS-648:ic", { materials: PARTS });
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-648:ic")).toBe("rush");
    for (const p of PARTS) expect(zoneOf(t, "player1", p)).toBe("discard");
  });

  it("RS-648: 合体 — 素材が1体（ガオディアス）でも欠けていればラッシュできない（出典: atwiki/page-1497・R-ADD-06「表記されたユニットを全て」）", () => {
    expect(canStartRush(rushBoard({ rush: parts(PARTS.slice(0, 4)) }), "player1", "RS-648:ic")).toBe(false);
  });

  it("RS-648: 必要パワー7+ — 素材が揃っていてもパワー6ではラッシュできない（出典: atwiki/page-1497「必要パワー：7+」）", () => {
    expect(canStartRush(rushBoard({ rush: parts(), power: powerCards(6) }), "player1", "RS-648:ic")).toBe(false);
  });

  it("RS-648: ※ブラスト — 自軍ダメージ6点（残り1点）で自軍 L ユニットがなければ、合体素材なしでラッシュできる（出典: grnrngr/faq-card-9 ブラスト Q1「追加条件を無視できるようになります」）", () => {
    const s = rushBoard({ damage: 6, rush: [inst("TST-UNIT-0", "s")] });
    expect(canStartRush(s, "player1", "RS-648:ic")).toBe(true);
    const r = rushFromHand(s, "player1", "RS-648:ic");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-648:ic")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:s")).toBe("rush");
  });

  it("RS-648: ※ブラスト — 自軍 L ユニットがあれば追加条件は無視できない（出典: grnrngr/faq-card-9 ブラスト Q1「自軍Ｌユニットが１体もなければ」）", () => {
    expect(canStartRush(rushBoard({ damage: 6, rush: [inst("TST-UNIT-7", "l")] }), "player1", "RS-648:ic")).toBe(false);
  });

  it("RS-648: ※ブラスト — 自軍ダメージ5点（残り2点）なら追加条件は無視できない（出典: grnrngr/faq-card-9 ブラスト Q1「残りダメージ１点で」）", () => {
    expect(canStartRush(rushBoard({ damage: 5 }), "player1", "RS-648:ic")).toBe(false);
  });

  it("RS-648: ※ブラスト — 必要パワーは満たさなければならない（パワー6では不可）（出典: R-KW-BLAST-01「もちろん必要パワーは満たさなければならない」）", () => {
    expect(canStartRush(rushBoard({ damage: 6, power: powerCards(6) }), "player1", "RS-648:ic")).toBe(false);
  });

  const bindBoard = () =>
    act(
      p1Battle(
        { rush: [inst("RS-648", "ic")] },
        { battle: [inst("SPEC-ES", "eb")], rush: [inst("SPEC-EL", "erl"), held("SPEC-EM", "erh")] },
        [E_S, E_M, E_L],
      ),
      { type: "move_to_battle", playerId: "player1", instanceId: "RS-648:ic" },
    );

  it("RS-648: 【イカロスバインド】バトルエリアに出たとき、敵軍ユニットを1体選ぶ選択が開き、選ばないこともできる（出典: atwiki/page-1497「敵軍ユニットを1体選びホールドしてもよい」）", () => {
    const s = bindBoard();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-648");
    expect(choiceIds(s)).toContain("SPEC-ES:eb");
    expect(canSkip(s)).toBe(true);
  });

  it("RS-648: 【イカロスバインド】選んだ敵軍バトルエリアのユニットがホールド状態になる（出典: atwiki/page-1497）", () => {
    const s = resolveAll(pick(bindBoard(), "SPEC-ES:eb"));
    expect(zoneOf(s, "player2", "SPEC-ES:eb")).toBe("battle");
    expect(cardIn(s, "player2", "SPEC-ES:eb")?.commandHeld).toBe(true);
  });

  it("RS-648: 【イカロスバインド】敵軍ラッシュエリアのユニット（L を含む）も選べる（出典: atwiki/page-1497「敵軍ユニットを1体選び」・カード評価「サイズとエリアを問わないホールド能力」）", () => {
    expect(choiceIds(bindBoard())).toEqual(expect.arrayContaining(["SPEC-ES:eb", "SPEC-EL:erl"]));
  });

  it("RS-648: 【イカロスバインド】選んだ敵軍 L ユニット（ラッシュエリア）がホールド状態になる（出典: atwiki/page-1497・カード評価「サイズとエリアを問わないホールド能力」）", () => {
    const s = resolveAll(pick(bindBoard(), "SPEC-EL:erl"));
    expect(zoneOf(s, "player2", "SPEC-EL:erl")).toBe("rush");
    expect(cardIn(s, "player2", "SPEC-EL:erl")?.commandHeld).toBe(true);
    expect(cardIn(s, "player2", "SPEC-ES:eb")?.commandHeld ?? false).toBe(false);
  });

  it("RS-648: 【イカロスバインド】任意 — 選ばなければ何もホールドされない（出典: atwiki/page-1497「ホールドしてもよい」）", () => {
    const s = resolveAll(skip(bindBoard()));
    expect(cardIn(s, "player2", "SPEC-EL:erl")?.commandHeld ?? false).toBe(false);
    expect(cardIn(s, "player2", "SPEC-ES:eb")?.commandHeld ?? false).toBe(false);
  });

  it("RS-648: 【イカロスバインド】自軍ユニットは選べない（出典: atwiki/page-1497「敵軍ユニットを1体選び」）", () => {
    const s = act(
      p1Battle({ rush: [inst("RS-648", "ic"), inst("TST-UNIT-0", "own")] }, { battle: [inst("SPEC-ES", "eb")] }, [E_S]),
      { type: "move_to_battle", playerId: "player1", instanceId: "RS-648:ic" },
    );
    expect(choiceIds(s)).not.toContain("TST-UNIT-0:own");
    expect(choiceIds(s)).not.toContain("RS-648:ic");
  });

  it("RS-648: 【イカロスバインド】「自軍ターン中」の限定がないため、敵軍ターン中に効果でバトルエリアに出たときも発動する（出典: atwiki/page-1497「これがバトルエリアに出たとき」）", () => {
    const s0 = st(
      { activePlayer: "player2", player1: { rush: [inst("RS-648", "ic")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-ES", "eb")], deck: deckCards(3, "e") } },
      [E_S],
    );
    const s = enterBattleByEffect(s0, "player1", "RS-648:ic");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-648");
    expect(choiceIds(s)).toContain("SPEC-ES:eb");
  });

  /** player1 のバトルエリア（またはラッシュエリア）にガオイカロス、player2 のバトルエリアにホールド状態とリリース状態のユニット。 */
  const returnBoard = (icZone: "battle" | "rush") =>
    st(
      {
        activePlayer: "player1",
        phase: "end",
        player1: { [icZone]: [inst("RS-648", "ic")], deck: deckCards(5) },
        player2: { battle: [held("SPEC-ES", "hb"), inst("TST-UNIT-0", "rb")], deck: deckCards(5, "e") },
      } as Parameters<typeof st>[0],
      [E_S],
    );

  // 既知の不具合: CARD-RS-648 【イカロスバインド】後半の制限（ホールド状態のユニットを戻すとき撃破か戻さないかを選ぶ）が未実装（スタートフェイズの戻しに制限がない）
  it.fails("RS-648: 【イカロスバインド】自軍バトルエリアにある間、相手はホールド状態のユニットをラッシュエリアに戻せない（撃破するか、戻さずバトルエリアに残す）（出典: atwiki/page-1497「それを撃破するか戻さないかを選ぶ」）", () => {
    const s = enemyStartReturn(returnBoard("battle"));
    expect(["discard", "battle"]).toContain(zoneOf(s, "player2", "SPEC-ES:hb"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:rb")).toBe("rush");
  });

  it("RS-648: 【イカロスバインド】ガオイカロスが自軍バトルエリアになければ（ラッシュエリア）、相手のホールド状態のユニットは普通にラッシュエリアに戻る（出典: atwiki/page-1497「これが自軍バトルエリアにある間」）", () => {
    const s = enemyStartReturn(returnBoard("rush"));
    expect(zoneOf(s, "player2", "SPEC-ES:hb")).toBe("rush");
    expect(zoneOf(s, "player2", "TST-UNIT-0:rb")).toBe("rush");
  });
});

// ===========================================================================
describe("RS-649 ガオファルコン", () => {
  const TEXT = "※ウイング ※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【急降下の一撃】「SP1」";
  const PAGE = "atwiki/page-1470";

  it("RS-649: カタログ本文・スペックが出典と一致（出典: atwiki/page-1470）", () => {
    expectCatalogText("RS-649", TEXT);
    expectStats("RS-649", { name: "ガオファルコン", category: "WB", size: "M", bp: 4000, sp: "special", powerCost: 5, comboNumber: 2, features: ["獣"] });
    expect(rarityOf("RS-649")).toBe("N");
  });

  wingTests("RS-649", PAGE);
  holdToEnterTests("RS-649", PAGE);

  it("RS-649: ※ウイング — ホールドしなければバトルエリアに出られない制限があっても、ウイングは発動できる（出典: grnrngr/faq-card-9 ウイング Q2「はい、できます」）", () => {
    const s = p1Battle({ rush: [inst("RS-649", "w")], command: heldN(1) }, { battle: [inst("SPEC-ES", "e")] }, [E_S]);
    expect(canEnter(s, "RS-649:w")).toBe(false);
    expect(canWing(s, "RS-649:w")).toBe(true);
  });

  const nc = (filler: number) =>
    enterWithHold(p1Battle({ rush: [inst("RS-649", "f")], battle: fill(filler), command: releasedCat("WB", 1) }), "RS-649:f", ["cWB0"].map((x) => `TST-OP:${x}`));

  it("RS-649: 【急降下の一撃】NC（2番目）で SP1 になりストライクできる（出典: atwiki/page-1470「【急降下の一撃】「SP1」」）", () => {
    const s = nc(1);
    expect(zoneOf(s, "player1", "RS-649:f")).toBe("battle");
    expect(spOf(s, "player1", "RS-649:f")).toBe(1);
    expect(canStrike(s, "RS-649:f")).toBe(true);
  });

  it("RS-649: 【急降下の一撃】NC が成立しない（3番目）と SP！のままストライクできない（出典: R-CN-02）", () => {
    const s = nc(2);
    expect(zoneOf(s, "player1", "RS-649:f")).toBe("battle");
    expect(spOf(s, "player1", "RS-649:f")).toBe(0);
    expect(canStrike(s, "RS-649:f")).toBe(false);
  });
});

// ===========================================================================
describe("RS-650 ガオライノス", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【強蹴一閃ライノシュート】自軍ラッシュフェイズ中、DAを持たない自軍Lユニットを1体選び、このユニットに重ねてもよい。これは、ユニットが重ねられている間カードとして扱い、重ねたユニットがユニットでなくなるとき捨札になる。このカードに重ねたユニットは、次の能力を得る⇒このユニットからコンビネーションする「ガオマジロ」はBP+5000される。";
  const PAGE = "atwiki/page-1471";

  it("RS-650: カタログ本文・スペックが出典と一致（出典: atwiki/page-1471）", () => {
    expectCatalogText("RS-650", TEXT);
    expectStats("RS-650", { name: "ガオライノス", category: "WB", size: "M", bp: 4000, sp: undefined, powerCost: 4, comboNumber: undefined, features: ["獣"] });
    expect(rarityOf("RS-650")).toBe("N");
  });

  holdToEnterTests("RS-650", PAGE);

  /** 自軍ラッシュフェイズで、ガオライノスに関わる起動系の合法手（ライノシュート）を探す。 */
  const rhinoActions = (s: GameState) =>
    legal(s).filter((a) => JSON.stringify(a).includes("RS-650:r") && a.type !== "end_phase");

  // 既知の不具合: CARD-RS-650 【強蹴一閃ライノシュート】が未実装（自軍ラッシュフェイズに L ユニットを重ねる手段がない）
  it.fails("RS-650: 【強蹴一閃ライノシュート】自軍ラッシュフェイズ中、DA を持たない自軍 L ユニットを選んでこのユニットに重ねられる（出典: atwiki/page-1471）", () => {
    const s = p1Rush({ rush: [inst("RS-650", "r"), inst("RS-151", "gk")] });
    expect(rhinoActions(s).length).toBeGreaterThan(0);
  });

  it("RS-650: 【強蹴一閃ライノシュート】自軍ラッシュフェイズ以外（バトルフェイズ）には重ねられない（出典: atwiki/page-1471「自軍ラッシュフェイズ中」）", () => {
    const s = p1Battle({ rush: [inst("RS-650", "r"), inst("RS-151", "gk")] });
    expect(rhinoActions(s).filter((a) => a.type !== "move_to_battle" && a.type !== "initiate_command_payment" && a.type !== "hold_for_wing")).toEqual([]);
  });

  it.todo(
    "RS-650: 【強蹴一閃ライノシュート】DA を持つ L ユニット（ガオハンターイビル等）は選べない／重ねた L ユニットからコンビネーションする「ガオマジロ」は BP+5000／重ねた L ユニットがユニットでなくなるときガオライノスも捨札になる（出典: atwiki/page-1471）— 重ねる処理自体が未実装（上の it.fails）で、前提の盤面を公開 API で作れないため",
  );
});

// ===========================================================================
describe("RS-651 ガオマジロ", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【体当たり】これが「ガオライノス」か、特徴「人型」を持つLユニットからコンビネーションするとき、次の効果を発動できる⇒このターン、これは敵軍ラッシュエリアのユニットにアタックできる。";
  const PAGE = "atwiki/page-1472";
  const L_NOHUMAN = sUnit("SPEC-LWB", { size: "L", bp: 9000, features: ["獣"] });

  it("RS-651: カタログ本文・スペックが出典と一致（出典: atwiki/page-1472）", () => {
    expectCatalogText("RS-651", TEXT);
    expectStats("RS-651", { name: "ガオマジロ", category: "WB", size: "M", bp: 3000, sp: undefined, powerCost: 1, comboNumber: "R" as never, features: ["獣"] });
    expect(rarityOf("RS-651")).toBe("N");
  });

  holdToEnterTests("RS-651", PAGE);

  const board = (left: string) =>
    enterWithHold(
      p1Battle(
        { battle: [inst(left.split(":")[0]!, left.split(":")[1]!)], rush: [inst("RS-651", "mj")], command: releasedCat("WB", 1) },
        { battle: [inst("SPEC-ES", "eb")], rush: [inst("SPEC-EM", "er")] },
        [E_S, E_M, L_NOHUMAN],
      ),
      "RS-651:mj",
      ["TST-OP:cWB0"],
    );

  /** 【体当たり】の発動（任意の選択があれば発動を選ぶ）。 */
  const activate = (s: GameState) => {
    let t = s;
    if (t.pendingEffectChoice?.sourceCardId === "RS-651") {
      const ids = t.pendingEffectChoice.validInstanceIds;
      t = pick(t, ids[0]!);
    }
    return t;
  };

  // 既知の不具合: CARD-RS-651 ジョイントコンビネーション（R）の【体当たり】が発動しない（左隣が人型 L・ガオライノスでも選択もログも出ない）
  it.fails("RS-651: 【体当たり】特徴「人型」を持つ L ユニット（ガオキング）からコンビネーションすると、このターン敵軍ラッシュエリアのユニットにアタックできる（出典: atwiki/page-1472）", () => {
    const s = activate(board("RS-151:gk"));
    expect(attackTargets(s, "RS-651:mj")).toEqual(expect.arrayContaining(["SPEC-EM:er", "SPEC-ES:eb"]));
  });

  // 既知の不具合: CARD-RS-651 ジョイントコンビネーション（R）の【体当たり】が発動しない（左隣が人型 L・ガオライノスでも選択もログも出ない）
  it.fails("RS-651: 【体当たり】「ガオライノス」からコンビネーションしても発動する（出典: atwiki/page-1472「これが「ガオライノス」か」）", () => {
    const s = activate(board("RS-650:ri"));
    expect(attackTargets(s, "RS-651:mj")).toContain("SPEC-EM:er");
  });

  it("RS-651: 【体当たり】「人型」を持たない L ユニットからは発動しない（敵軍ラッシュエリアにはアタックできない）（出典: atwiki/page-1472「特徴「人型」を持つLユニット」）", () => {
    const s = resolveAll(board("SPEC-LWB:l"));
    expect(attackTargets(s, "RS-651:mj")).not.toContain("SPEC-EM:er");
  });

  it("RS-651: 【体当たり】ガオライノス以外の M ユニットからは発動しない（出典: atwiki/page-1472）", () => {
    const s = resolveAll(board("TST-UNIT-2:m"));
    expect(attackTargets(s, "RS-651:mj")).not.toContain("SPEC-EM:er");
    expect(attackTargets(s, "RS-651:mj")).toContain("SPEC-ES:eb");
  });

  // 既知の不具合: CARD-RS-651 ジョイントコンビネーション（R）の【体当たり】が発動しない（左隣が人型 L・ガオライノスでも選択もログも出ない）
  it.fails("RS-651: 【体当たり】「発動できる」— 発動しないことを選べ、そのときは敵軍ラッシュエリアにアタックできない（出典: atwiki/page-1472「次の効果を発動できる」）", () => {
    let s = board("RS-151:gk");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-651");
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(attackTargets(s, "RS-651:mj")).not.toContain("SPEC-EM:er");
  });

  // 既知の不具合: CARD-RS-651 【体当たり】が発動しない
  it.fails("RS-651: 【体当たり】発動して敵軍ラッシュエリアのユニットにアタックし、撃破できる（出典: atwiki/page-1472「敵軍ラッシュエリアのユニットにアタックできる」）", () => {
    const s = settle(attack(activate(board("RS-151:gk")), "RS-651:mj", "SPEC-EM:er"));
    // BP3000 同士なので相打ち（両方撃破）。
    expect(zoneOf(s, "player2", "SPEC-EM:er")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-652 ガオディアス", () => {
  const TEXT =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。 【清輝顕現バブルキャプチャー】これが同カテゴリのLユニットからコンビネーションするとき、次の効果を発動できる⇒このコンビネーションが成立している間、敵軍バトルエリアの1番目のユニットは、ラッシュエリアに戻せない。";
  const PAGE = "atwiki/page-1473";

  it("RS-652: カタログ本文・スペックが出典と一致（出典: atwiki/page-1473）", () => {
    expectCatalogText("RS-652", TEXT);
    expectStats("RS-652", { name: "ガオディアス", category: "WB", size: "M", bp: 5000, sp: undefined, powerCost: 5, comboNumber: "R" as never, features: ["獣"] });
    expect(rarityOf("RS-652")).toBe("N");
  });

  holdToEnterTests("RS-652", PAGE);

  const board = (left: string) =>
    enterWithHold(
      p1Battle(
        { battle: [inst(left.split(":")[0]!, left.split(":")[1]!)], rush: [inst("RS-652", "di")], command: releasedCat("WB", 1) },
        { battle: [inst("SPEC-ES", "e1"), inst("SPEC-EM", "e2")] },
        [E_S, E_M],
      ),
      "RS-652:di",
      ["TST-OP:cWB0"],
    );

  // 既知の不具合: CARD-RS-652 ジョイントコンビネーション（R）の【清輝顕現バブルキャプチャー】が発動しない（選択もログも出ない）
  it.fails("RS-652: 【清輝顕現バブルキャプチャー】同カテゴリ（WB）の L ユニットからコンビネーションするとき、発動するかを選べる（任意）（出典: atwiki/page-1473「次の効果を発動できる」）", () => {
    const s = board("RS-151:gk");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-652");
    expect(canSkip(s)).toBe(true);
  });

  // 既知の不具合: CARD-RS-652 【清輝顕現バブルキャプチャー】の「敵軍バトルエリアの1番目のユニットはラッシュエリアに戻せない」が未実装（スタートフェイズの戻しに制限がない）
  it.fails("RS-652: 【清輝顕現バブルキャプチャー】発動すると、敵軍バトルエリアの1番目のユニットは相手のスタートフェイズにラッシュエリアに戻せない（2番目は戻る）（出典: atwiki/page-1473）", () => {
    let s = board("RS-151:gk");
    if (s.pendingEffectChoice?.sourceCardId === "RS-652") s = pick(s, s.pendingEffectChoice.validInstanceIds[0]!);
    s = enemyStartReturn(resolveAll(s));
    expect(zoneOf(s, "player2", "SPEC-ES:e1")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-EM:e2")).toBe("rush");
  });

  it("RS-652: 【清輝顕現バブルキャプチャー】発動しなければ、敵軍バトルエリアのユニットはすべてラッシュエリアに戻る（出典: atwiki/page-1473「発動できる」）", () => {
    let s = board("RS-151:gk");
    if (s.pendingEffectChoice?.sourceCardId === "RS-652") s = skip(s);
    s = enemyStartReturn(resolveAll(s));
    expect(zoneOf(s, "player2", "SPEC-ES:e1")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-EM:e2")).toBe("rush");
  });

  it("RS-652: 【清輝顕現バブルキャプチャー】別カテゴリ（OT）の L ユニットからは発動しない（出典: atwiki/page-1473「同カテゴリのLユニット」）", () => {
    const s = board("RS-515:eo");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-652");
    const t = enemyStartReturn(resolveAll(s));
    expect(zoneOf(t, "player2", "SPEC-ES:e1")).toBe("rush");
  });

  it("RS-652: 【清輝顕現バブルキャプチャー】同カテゴリでも L ユニット以外（S ユニット）からは発動しない（出典: atwiki/page-1473「同カテゴリのLユニット」）", () => {
    const s = board("TST-UNIT-0:s");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-652");
  });

  it.todo(
    "RS-652: 【清輝顕現バブルキャプチャー】コンビネーションが成立しなくなれば（ガオディアスか L ユニットがバトルエリアを離れれば）制限も終わる（出典: atwiki/page-1473「このコンビネーションが成立している間」・R-CN-06）— 制限そのものが未実装（上の it.fails）のため、終了条件を検証できない",
  );
});

// ===========================================================================
describe("RS-653 レッドファルコン（2nd）", () => {
  const TEXT = "※ウイング 【後輩戦士への叱咤】このユニットからコンビネーションする特徴「イエロー」を持つSユニットは、このターン、次の能力を得る⇒BP+3000、「SP1」";
  const PAGE = "atwiki/page-1518";
  const YEL_S = sUnit("SPEC-YS", { bp: 2000, sp: undefined, features: ["イエロー"] });
  const YEL_M = sUnit("SPEC-YM", { bp: 2000, sp: undefined, size: "M", features: ["イエロー"] });
  const BLUE_S = sUnit("SPEC-BS", { bp: 2000, sp: undefined, features: ["ブルー"] });

  it("RS-653: カタログ本文・スペックが出典と一致（出典: atwiki/page-1518）", () => {
    expectCatalogText("RS-653", TEXT);
    expectStats("RS-653", { name: "レッドファルコン（2nd）", category: "ET", size: "S", bp: 3000, sp: undefined, powerCost: 4, comboNumber: 1, features: ["レッド", "男", "2nd"] });
  });

  it("RS-653: レアリティはスーパーレア（出典: atwiki/page-1518「レアリティ：スーパーレア」）", () => {
    expect(rarityOf("RS-653")).toBe("SR");
  });

  wingTests("RS-653", PAGE);

  const board = (next: string, falconFirst = true) => {
    const order = falconFirst ? ["RS-653:rf", next] : ["TST-UNIT-0:f0", "RS-653:rf", next];
    const s = p1Battle({ rush: [inst("RS-653", "rf"), inst(next.split(":")[0]!, next.split(":")[1]!), ...fill(1)] }, {}, [YEL_S, YEL_M, BLUE_S]);
    return resolveAll(enterKeep(s, order));
  };

  // 既知の不具合: CARD-RS-653 【後輩戦士への叱咤】NC は成立する（ログあり）が、次にコンビネーションするイエロー S ユニットに BP+3000・SP1 が付かない
  it.fails("RS-653: 【後輩戦士への叱咤】NC（1番目）— 次にコンビネーションする特徴「イエロー」の S ユニットは BP+3000・SP1 になりストライクできる（出典: atwiki/page-1518）", () => {
    const s = board("SPEC-YS:y");
    expect(bpOf(s, "player1", "SPEC-YS:y")).toBe(5000);
    expect(spOf(s, "player1", "SPEC-YS:y")).toBe(1);
    expect(canStrike(s, "SPEC-YS:y")).toBe(true);
  });

  it("RS-653: 【後輩戦士への叱咤】「イエロー」を持たない S ユニットは強化されない（出典: atwiki/page-1518「特徴「イエロー」を持つSユニット」）", () => {
    const s = board("SPEC-BS:b");
    expect(bpOf(s, "player1", "SPEC-BS:b")).toBe(2000);
    expect(spOf(s, "player1", "SPEC-BS:b")).toBe(0);
  });

  it("RS-653: 【後輩戦士への叱咤】「イエロー」でも S ユニットでなければ（M）強化されない（出典: atwiki/page-1518「Sユニット」）", () => {
    const s = board("SPEC-YM:y");
    expect(bpOf(s, "player1", "SPEC-YM:y")).toBe(2000);
    expect(spOf(s, "player1", "SPEC-YM:y")).toBe(0);
  });

  it("RS-653: 【後輩戦士への叱咤】NC が成立しない（レッドファルコンが2番目）と、次のイエローは強化されない（出典: R-CN-02・atwiki/page-1518 カード評価「アカレッドの効果でこの効果を使えば２番目以外に並んだユニットも強化できる」）", () => {
    const s = board("SPEC-YS:y", false);
    expect(bpOf(s, "player1", "SPEC-YS:y")).toBe(2000);
    expect(spOf(s, "player1", "SPEC-YS:y")).toBe(0);
  });

  it("RS-653: 【後輩戦士への叱咤】BP+3000・SP1 は「このターン」だけ（出典: atwiki/page-1518「このターン、次の能力を得る」）", () => {
    let s = board("SPEC-YS:y");
    s = toPhase(s, "player2", "charge");
    expect(bpOf(s, "player1", "SPEC-YS:y")).toBe(2000);
  });
});

// ===========================================================================
describe("RS-654 ガオイエロー（2nd）", () => {
  const TEXT =
    "※ウイング 【先輩戦士の教え】「SP1」特徴「レッド」を持つ自軍Sユニットを1体選びホールドしてもよい。そうしたとき、敵軍バトルエリアからSユニットを1体選び撃破する。（この効果は、「レッドファルコン｣からコンビネーションするときはナンバーに関係なく発動する）";
  const PAGE = "atwiki/page-1519";

  it("RS-654: カタログ本文・スペックが出典と一致（出典: atwiki/page-1519）", () => {
    expectCatalogText("RS-654", TEXT);
    expectStats("RS-654", { name: "ガオイエロー（2nd）", category: "WB", size: "S", bp: 2000, sp: "special", powerCost: 3, comboNumber: 2, features: ["イエロー", "男", "2nd"] });
  });

  it("RS-654: レアリティはスーパーレア（出典: atwiki/page-1519「レアリティ：スーパーレア」）", () => {
    expect(rarityOf("RS-654")).toBe("SR");
  });

  wingTests("RS-654", PAGE);

  /** 1番目に first、続けてガオイエロー（2nd）。自軍ラッシュエリアにガオレッド（レッド・S）と TST-UNIT-0。敵軍バトルエリアに S と M、ラッシュエリアに S。 */
  const board = (order: string[], ownRush: ReturnType<typeof inst>[] = [inst("RS-160", "red"), inst("TST-UNIT-0", "plain")]) => {
    const firsts = order.slice(0, -1).map((x) => inst(x.split(":")[0]!, x.split(":")[1]!));
    const s = p1Battle(
      { rush: [...firsts, inst("RS-654", "gy"), ...ownRush] },
      { battle: [inst("SPEC-ES", "es"), inst("SPEC-EM", "em")], rush: [inst("TST-UNIT-0", "ers")] },
      [E_S, E_M],
    );
    return enterKeep(s, order);
  };

  // 既知の不具合: CARD-RS-654 【先輩戦士の教え】の「レッドをホールド→敵軍バトルエリアの S を撃破」が未実装（NC で SP1 だけ付く）／「レッドファルコンからならナンバーに関係なく発動」も未実装
  it.fails("RS-654: 【先輩戦士の教え】NC（2番目）— 特徴「レッド」の自軍 S ユニットを選べ（レッドでないもの・自身は不可）、選ばないこともできる（出典: atwiki/page-1519「特徴「レッド」を持つ自軍Sユニットを1体選びホールドしてもよい」）", () => {
    const s = board(["TST-UNIT-0:f0", "RS-654:gy"]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-654");
    expect(choiceIds(s)).toEqual(["RS-160:red"]);
    expect(canSkip(s)).toBe(true);
  });

  // 既知の不具合: CARD-RS-654 【先輩戦士の教え】の「レッドをホールド→敵軍バトルエリアの S を撃破」が未実装（NC で SP1 だけ付く）／「レッドファルコンからならナンバーに関係なく発動」も未実装
  it.fails("RS-654: 【先輩戦士の教え】レッドをホールドしたとき、敵軍バトルエリアの S ユニットだけを選んで撃破する（強制）（出典: atwiki/page-1519「そうしたとき、敵軍バトルエリアからSユニットを1体選び撃破する」）", () => {
    let s = pick(board(["TST-UNIT-0:f0", "RS-654:gy"]), "RS-160:red");
    expect(cardIn(s, "player1", "RS-160:red")?.commandHeld).toBe(true);
    expect(choiceIds(s)).toEqual(["SPEC-ES:es"]);
    expect(canSkip(s)).toBe(false);
    s = resolveAll(pick(s, "SPEC-ES:es"));
    expect(zoneOf(s, "player2", "SPEC-ES:es")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-EM:em")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:ers")).toBe("rush");
  });

  it("RS-654: 【先輩戦士の教え】ホールドしなければ撃破しない（出典: atwiki/page-1519「そうしたとき」）", () => {
    let s = board(["TST-UNIT-0:f0", "RS-654:gy"]);
    if (s.pendingEffectChoice?.sourceCardId === "RS-654") s = skip(s);
    s = resolveAll(s);
    expect(cardIn(s, "player1", "RS-160:red")?.commandHeld ?? false).toBe(false);
    expect(zoneOf(s, "player2", "SPEC-ES:es")).toBe("battle");
  });

  it("RS-654: 【先輩戦士の教え】NC（2番目）で SP1 になる（出典: atwiki/page-1519「「SP1」」）", () => {
    let s = board(["TST-UNIT-0:f0", "RS-654:gy"]);
    if (s.pendingEffectChoice?.sourceCardId === "RS-654") s = skip(s);
    s = resolveAll(s);
    expect(spOf(s, "player1", "RS-654:gy")).toBe(1);
  });

  it("RS-654: 【先輩戦士の教え】すでにホールド状態のレッドは選べない（出典: atwiki/page-1519「ホールドしてもよい」）", () => {
    const s = board(["TST-UNIT-0:f0", "RS-654:gy"], [held("RS-160", "red")]);
    expect(choiceIds(s)).not.toContain("RS-160:red");
  });

  it("RS-654: 【先輩戦士の教え】NC が成立しない（3番目・左隣がレッドファルコンでない）と発動せず SP！のまま（出典: R-CN-02）", () => {
    const s = board(["TST-UNIT-0:f0", "TST-UNIT-0:f1", "RS-654:gy"], [inst("RS-160", "red"), ...fill(2)]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RS-654");
    const t = resolveAll(s);
    expect(spOf(t, "player1", "RS-654:gy")).toBe(0);
    expect(zoneOf(t, "player2", "SPEC-ES:es")).toBe("battle");
  });

  // 既知の不具合: CARD-RS-654 【先輩戦士の教え】の「レッドをホールド→敵軍バトルエリアの S を撃破」が未実装（NC で SP1 だけ付く）／「レッドファルコンからならナンバーに関係なく発動」も未実装
  it.fails("RS-654: 【先輩戦士の教え】「レッドファルコン（2nd）」からコンビネーションするときは3番目でも発動する（2nd は同名）（出典: atwiki/page-1519「「レッドファルコン｣からコンビネーションするときはナンバーに関係なく発動する」・R-DECK-04）", () => {
    let s = board(["TST-UNIT-0:f0", "RS-653:rf", "RS-654:gy"], [inst("RS-160", "red"), ...fill(1)]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-654");
    // レッドファルコン（2nd）自身（バトルエリアのレッド・S）も選べる
    expect(choiceIds(s)).toEqual(expect.arrayContaining(["RS-160:red", "RS-653:rf"]));
    s = resolveAll(pick(pick(s, "RS-653:rf"), "SPEC-ES:es"));
    expect(zoneOf(s, "player2", "SPEC-ES:es")).toBe("discard");
    expect(spOf(s, "player1", "RS-654:gy")).toBe(1);
  });

  // 既知の不具合: CARD-RS-654 【先輩戦士の教え】の「レッドをホールド→敵軍バトルエリアの S を撃破」が未実装（NC で SP1 だけ付く）／「レッドファルコンからならナンバーに関係なく発動」も未実装
  it.fails("RS-654: 【先輩戦士の教え】「レッドファルコン」（RS-204）からコンビネーションするときも3番目で発動する（出典: atwiki/page-1519）", () => {
    const s = board(["TST-UNIT-0:f0", "RS-204:rf", "RS-654:gy"], [inst("RS-160", "red"), ...fill(1)]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-654");
  });

  it("RS-654: 【先輩戦士の教え】敵軍バトルエリアに S ユニットがいなくても、レッドのホールドは選べる（ホールドした後に撃破できるユニットがないだけ）（出典: atwiki/page-1519）", () => {
    const s0 = p1Battle(
      { battle: fill(1), rush: [inst("RS-654", "gy"), inst("RS-160", "red")] },
      { battle: [inst("SPEC-EM", "em")] },
      [E_M],
    );
    let s = enterKeep(s0, ["RS-654:gy"]);
    if (s.pendingEffectChoice?.sourceCardId === "RS-654") s = resolveAll(pick(s, "RS-160:red"));
    expect(zoneOf(s, "player2", "SPEC-EM:em")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-655 デカウイングロボ", () => {
  const TEXT = "※ウイング 【パトマグナム】自軍捨札に特徴「スワット」を持つユニットカードが5枚以上あれば、これは「SP2」になる。";
  const PAGE = "atwiki/page-1528";
  const SWATS = ["RS-345", "RS-496", "RS-658", "RS-659", "RS-660"];

  it("RS-655: カタログ本文・スペックが出典と一致（出典: atwiki/page-1528）", () => {
    expectCatalogText("RS-655", TEXT);
    expectStats("RS-655", {
      name: "デカウイングロボ",
      category: "OT",
      size: "L",
      bp: 9000,
      sp: 1,
      powerCost: "7+",
      features: ["メカ", "人型", "航空機"],
      rushCondition: "discard_named_unit",
    });
  });

  it("RS-655: レアリティはスーパーレア（出典: atwiki/page-1528「レアリティ：スーパーレア」）", () => {
    expect(rarityOf("RS-655")).toBe("SR");
  });

  const rushBoard = (rush: ReturnType<typeof inst>[], power = 7) =>
    p1Rush({ hand: [inst("RS-655", "dw")], rush, command: releasedCat("OT", 1), power: powerCards(power) });

  it("RS-655: 追加条件 — 自軍「デカウイングキャノン」1体を捨札にしてラッシュできる（出典: atwiki/page-1528「自軍「パトウイング」、または自軍「デカウイングキャノン」1体を捨札にする」）", () => {
    const r = rushFromHand(rushBoard([inst("RS-656", "can")]), "player1", "RS-655:dw", { materials: ["RS-656:can"] });
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-655:dw")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-656:can")).toBe("discard");
  });

  // 既知の不具合: CARD-RS-655 追加条件の「自軍「パトウイング」」側が素材として登録されていない（partnerName がデカウイングキャノンだけ）
  it.fails("RS-655: 追加条件 — 自軍「パトウイング」1体を捨札にしてもラッシュできる（出典: atwiki/page-1528「自軍「パトウイング」、または」）", () => {
    const s = rushBoard([inst("RS-657", "pw")]);
    expect(canStartRush(s, "player1", "RS-655:dw")).toBe(true);
    const r = rushFromHand(s, "player1", "RS-655:dw", { materials: ["RS-657:pw"] });
    expect(r.ok).toBe(true);
    const t = resolveAll(r.state);
    expect(zoneOf(t, "player1", "RS-655:dw")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-657:pw")).toBe("discard");
  });

  it("RS-655: 追加条件 — どちらもなければラッシュできない（出典: atwiki/page-1528）", () => {
    expect(canStartRush(rushBoard([inst("TST-UNIT-0", "s")]), "player1", "RS-655:dw")).toBe(false);
  });

  it("RS-655: 必要パワー7+ — パワー6ではラッシュできない（出典: atwiki/page-1528「必要パワー：7+」）", () => {
    expect(canStartRush(rushBoard([inst("RS-656", "can")], 6), "player1", "RS-655:dw")).toBe(false);
  });

  wingTests("RS-655", PAGE);

  const spBoard = (discard: ReturnType<typeof inst>[], enemyDiscard: ReturnType<typeof inst>[] = []) =>
    p1Battle({ battle: [inst("RS-655", "dw")], discard }, { discard: enemyDiscard });

  // 既知の不具合: CARD-RS-655 【パトマグナム】が未実装（自軍捨札にスワットのユニットカードが5枚以上でも SP1 のまま）
  it.fails("RS-655: 【パトマグナム】自軍捨札に特徴「スワット」を持つユニットカードが5枚あれば SP2（出典: atwiki/page-1528「5枚以上あれば、これは「SP2」になる」）", () => {
    const s = spBoard(SWATS.map((id, i) => inst(id, `d${i}`)));
    expect(spOf(s, "player1", "RS-655:dw")).toBe(2);
  });

  it("RS-655: 【パトマグナム】4枚なら SP1 のまま（出典: atwiki/page-1528「5枚以上」）", () => {
    const s = spBoard(SWATS.slice(0, 4).map((id, i) => inst(id, `d${i}`)));
    expect(spOf(s, "player1", "RS-655:dw")).toBe(1);
  });

  it("RS-655: 【パトマグナム】「スワット」を持たないユニットカードは数えない（出典: atwiki/page-1528「特徴「スワット」を持つユニットカード」）", () => {
    const s = spBoard([...SWATS.slice(0, 4).map((id, i) => inst(id, `d${i}`)), inst("RS-108", "dg")]);
    expect(spOf(s, "player1", "RS-655:dw")).toBe(1);
  });

  it("RS-655: 【パトマグナム】敵軍の捨札のスワットは数えない（出典: atwiki/page-1528「自軍捨札」）", () => {
    const s = spBoard([], SWATS.map((id, i) => inst(id, `ed${i}`)));
    expect(spOf(s, "player1", "RS-655:dw")).toBe(1);
  });

  // 既知の不具合: CARD-RS-655 【パトマグナム】が未実装（自軍捨札にスワットのユニットカードが5枚以上でも SP1 のまま）
  it.fails("RS-655: 【パトマグナム】SP2 でストライクすると2点（出典: atwiki/page-1528「「SP2」になる」）", () => {
    let s = p1Battle({ rush: [inst("RS-655", "dw")], discard: SWATS.map((id, i) => inst(id, `d${i}`)) });
    s = enterKeep(s, ["RS-655:dw"]);
    expect(canStrike(s, "RS-655:dw")).toBe(true);
    s = settle(act(s, { type: "strike", playerId: "player1", instanceId: "RS-655:dw" }));
    expect(s.players.player2.damage).toBe(2);
  });
});
