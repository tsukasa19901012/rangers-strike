/**
 * カード別スペック: RK-022〜RK-028（ザ・マスクドライダーEXP vol.1 ライダーパス〜バトルホッパー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-1
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_1.html。RK-022・RK-023・RK-024・RK-026 の Q&A、
 *     RK-050・RK-053・RK-058 の相互参照 Q）、grnrngr/faq-rider-2（rider_2.html。RK-024・SK-002 の相互参照 Q）、
 *     grnrngr/faq-card-6（card_6.html。RS-394 の相互参照 Q）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-RC-01、R-KW-PERM-01、R-TGT-01 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 * レアリティは atwiki の「メモリアルレア／スーパーレア／ノーマル」を MR／SR／N として照合する（パック版とスターター版で違うものはどちらか）。
 *
 * 既存の照合で済んでいるもの（重複させない）:
 *  - RK-022 の置き換え（ラッシュ扱い・状態と位置の引き継ぎ・何度でも・必要パワー・「DEN-O」のユニットがない場合）
 *    — cardSpec/RS5-audit-crossref.test.ts「RK-022 ライダーパス」
 *  - RK-023 Q1（RC の「SP1」と5番目の SP1 は重複しない・ライドオフで5番目に並ぶ）— rulesSpec/05-battle-strike-damage.test.ts R-BA-02
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import { pickEffectChoice } from "../ai/helpers";
import {
  act,
  attack,
  attackersOf,
  bpOf,
  calm,
  canEnter,
  canSkip,
  canStrike,
  cardIn,
  choiceIds,
  damageOf,
  deckCards,
  enter,
  expectCatalogText,
  expectOpStats,
  expectRarityIn,
  expectStats,
  expectVehicleStats,
  fill,
  inst,
  legal,
  mount,
  p1Battle,
  passEntry,
  pick,
  playOp,
  powerCards,
  rcUnit,
  releasedCat,
  releasedN,
  resolveAll,
  rideOff,
  ridingPair,
  settle,
  skip,
  st,
  strike,
  sUnit,
  zoneIds,
  zoneOf,
} from "./RK2-022-042.helpers";

const KAMEN = sUnit("SPEC-KAMEN", { category: "ET", bp: 2000, features: ["仮面ライダー", "男"] });
const MALE = sUnit("SPEC-MALE", { category: "ET", bp: 2000, features: ["男"] });
const E1500 = sUnit("SPEC-E1500", { bp: 1500 });
const E2000 = sUnit("SPEC-E2000", { bp: 2000 });
const E3000 = sUnit("SPEC-E3000", { bp: 3000 });
const E3500 = sUnit("SPEC-E3500", { bp: 3500 });
const E4000 = sUnit("SPEC-E4000", { bp: 4000 });
const E5000 = sUnit("SPEC-E5000", { bp: 5000 });
const EM5000 = sUnit("SPEC-EM5000", { bp: 5000, size: "M" });
const RC3000 = rcUnit("SPEC-RC3000", { bp: 3000 });
const RC3500 = rcUnit("SPEC-RC3500", { bp: 3500 });
const DENO = sUnit("SPEC-DENO", { category: "OT", bp: 3000, powerCost: 0, features: ["仮面ライダー", "DEN-O"] });
const DENO2 = sUnit("SPEC-DENO2", { category: "OT", bp: 4000, powerCost: 0, features: ["仮面ライダー", "DEN-O"] });
const DENO_NORC = sUnit("SPEC-DENO-NORC", { category: "OT", bp: 4000, powerCost: 0, features: ["仮面ライダー", "DEN-O"] });
const DENO_RC = rcUnit("SPEC-DENO-RC", { category: "OT", bp: 3000, features: ["仮面ライダー", "DEN-O"] });
const EXTRA = [KAMEN, MALE, E1500, E2000, E3000, E3500, E4000, E5000, EM5000, RC3000, RC3500, DENO, DENO2, DENO_NORC, DENO_RC];

const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  p1Battle(p1, p2, EXTRA);

/** 敵軍（player2）バトルフェイズの盤面。 */
const enemyTurn = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

// ===========================================================================
describe("RK-022 ライダーパス", () => {
  const TEXT =
    "※常駐 これを配置するとき、自軍山札から特徴「DEN-O」を持つユニットカードを4枚まで選び、相手に見せてからこれに重ねて置いた後、山札をシャッフルする。自軍ラッシュフェイズに重ねたカードから1枚選び、本来の特徴に「DEN-O」を持つ自軍ユニットと置き換えてもよい（必要パワーと追加条件は満たすこと）。これが常駐置き場を離れるとき、重ねたカードはすべて捨札になる。";

  /** 自軍ラッシュフェイズに手札のライダーパスを使う（配置するときの選択は残す）。 */
  const placed = (deck = [inst("SPEC-DENO", "d1"), inst("TST-OP", "x"), inst("SPEC-DENO2", "d2"), inst("SPEC-MALE", "m")], p1: Partial<GameState["players"]["player1"]> = {}) => {
    const s = st(
      { phase: "rush", player1: { hand: [inst("RK-022", "rp")], command: releasedCat("OT", 1), deck, ...p1 }, player2: { deck: deckCards(5, "e") } },
      EXTRA,
    );
    const r = playOp(s, "player1", "RK-022:rp");
    expect(r.ok, r.error).toBe(true);
    return r.state;
  };
  const stacked = (s: GameState) => (s.players.player1.operation.find((c) => c.instanceId === "RK-022:rp")?.stackedCards ?? []);

  it("RK-022: カタログ本文・スペックが出典と一致（出典: atwiki/page-128）", () => {
    expectCatalogText("RK-022", TEXT);
    expectOpStats("RK-022", { name: "ライダーパス", category: "OT", powerCost: 0 });
    expectRarityIn("RK-022", ["MR", "N"]);
  });

  it("RK-022: 配置するとき、自軍山札の特徴「DEN-O」を持つユニットカードだけを選べる（出典: atwiki/page-128「自軍山札から特徴「DEN-O」を持つユニットカードを4枚まで選び」）", () => {
    const s = placed();
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-022");
    expect(choiceIds(s)).toEqual(["SPEC-DENO2:d2", "SPEC-DENO:d1"]);
  });

  it("RK-022: 選んだカードはこれに重ねて置かれ、選ばなかったカードは山札に残る（出典: atwiki/page-128「これに重ねて置いた後、山札をシャッフルする」）", () => {
    let s = placed();
    s = pick(s, "SPEC-DENO:d1");
    s = pick(s, "SPEC-DENO2:d2");
    s = resolveAll(s);
    expect(zoneOf(s, "player1", "RK-022:rp")).toBe("operation");
    expect(stacked(s).map((c) => c.instanceId).sort()).toEqual(["SPEC-DENO2:d2", "SPEC-DENO:d1"]);
    expect(zoneIds(s, "player1", "deck").sort()).toEqual(["SPEC-MALE:m", "TST-OP:x"]);
  });

  it("RK-022: 選ぶのは4枚まで（5枚あっても4枚で終わる）（出典: atwiki/page-128「4枚まで」）", () => {
    const deck = ["a", "b", "c", "d", "e"].map((x) => inst("SPEC-DENO", x));
    let s = placed(deck);
    for (const x of ["a", "b", "c", "d"]) s = pick(s, `SPEC-DENO:${x}`);
    s = resolveAll(s);
    expect(stacked(s)).toHaveLength(4);
    expect(zoneIds(s, "player1", "deck")).toEqual(["SPEC-DENO:e"]);
  });

  it("RK-022: 4枚より少なく選んで終えてもよい（0枚も可）（出典: atwiki/page-128「4枚まで選び」）", () => {
    let s = placed();
    expect(canSkip(s)).toBe(true);
    s = resolveAll(skip(s));
    expect(zoneOf(s, "player1", "RK-022:rp")).toBe("operation");
    expect(stacked(s)).toHaveLength(0);
    expect(s.players.player1.deck).toHaveLength(4);
  });

  // 公式 Q7「オモテ向きに重ねてください。選んだカードは相手に見せてから重ねますので、その時点で公開情報となっています。」
  it("RK-022: 公式Q&A — 重ねたカードはオモテ向き（出典: grnrngr/faq-rider-1 RK-022 Q7・atwiki/page-128 Q7）", () => {
    let s = placed();
    s = resolveAll(pick(s, "SPEC-DENO:d1"), []);
    expect(stacked(s).length).toBeGreaterThan(0);
    for (const c of stacked(s)) expect(c.faceDown ?? false).toBe(false);
  });

  it("RK-022: 常駐置き場を離れるとき、重ねたカードはすべて捨札になる（出典: atwiki/page-128「これが常駐置き場を離れるとき、重ねたカードはすべて捨札になる」）", () => {
    // 常駐置き場の入れ替え（新しい常駐〈改造人間 RK-001〉の配置）でライダーパスを離す（R-KW-PERM-01）。
    let s = st(
      {
        phase: "rush",
        player1: {
          operation: [{ ...inst("RK-022", "rp"), stackedCards: [inst("SPEC-DENO", "s1"), inst("SPEC-DENO2", "s2")] }],
          hand: [inst("RK-001", "k")],
          command: releasedCat("ET", 1),
          deck: deckCards(5),
        },
        player2: { deck: deckCards(5, "e") },
      },
      EXTRA,
    );
    const r = playOp(s, "player1", "RK-001:k");
    expect(r.ok, r.error).toBe(true);
    s = resolveAll(r.state, ["RK-022:rp"]);
    expect(zoneOf(s, "player1", "RK-001:k")).toBe("operation");
    expect(zoneOf(s, "player1", "RK-022:rp")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-DENO:s1")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-DENO2:s2")).toBe("discard");
  });

  /** ライダーパス配置済みの自軍ラッシュフェイズ。 */
  const passBoard = (rush: ReturnType<typeof inst>[], stack: ReturnType<typeof inst>[] = [inst("SPEC-DENO2", "s")], p1: Partial<GameState["players"]["player1"]> = {}) =>
    st(
      {
        phase: "rush",
        player1: { rush, operation: [{ ...inst("RK-022", "pass"), stackedCards: stack }], power: powerCards(6), deck: deckCards(5), ...p1 },
        player2: { deck: deckCards(5, "e") },
      },
      EXTRA,
    );
  const swap = (s: GameState, card: string, unit: string) => {
    const a = legal(s).find((x) => x.type === "activate_resident_operation" && x.operationInstanceId === "RK-022:pass");
    expect(a).toBeDefined();
    return pick(pick(act(s, a!), card), unit);
  };

  // 公式 Q2「文字通り置き換えるだけですので、ライド状態を維持したまま、重ねているユニットカードだけを置き換えます。」
  it("RK-022: 公式Q&A — ビークルにライドしているユニットと置き換えても、ライド状態のまま（出典: grnrngr/faq-rider-1 RK-022 Q2・atwiki/page-128 Q2）", () => {
    const s = swap(passBoard(ridingPair("SPEC-DENO-RC", "u", "RK-058", "v"), [inst("SPEC-DENO2", "s")]), "SPEC-DENO2:s", "SPEC-DENO-RC:u");
    expect(cardIn(s, "player1", "SPEC-DENO2:s")?.mountedOnInstanceId).toBe("RK-058:v");
    expect(zoneOf(s, "player1", "RK-058:v")).toBe("rush");
  });

  // 公式 Q4「いいえ、文字通り置き換えるだけですのでライドオフはしません。」
  it("RK-022: 公式Q&A — RC を持たないユニットに置き換えてもライドオフしない（出典: grnrngr/faq-rider-1 RK-022 Q4・atwiki/page-128 Q4）", () => {
    const s = swap(passBoard(ridingPair("SPEC-DENO-RC", "u", "RK-058", "v"), [inst("SPEC-DENO-NORC", "s")]), "SPEC-DENO-NORC:s", "SPEC-DENO-RC:u");
    expect(cardIn(s, "player1", "SPEC-DENO-NORC:s")?.mountedOnInstanceId).toBe("RK-058:v");
  });

  // 公式 Q1「重ねたユニットがユニットでなくなっていますので、「RK-013 Jパワー」は捨札になります。」
  it("RK-022: 公式Q&A — J パワーに重ねられていたユニットを置き換えると、J パワーは捨札になる（出典: grnrngr/faq-rider-1 RK-022 Q1・atwiki/page-128 Q1）", () => {
    const jp = { ...inst("SPEC-DENO", "u"), stackedCards: [inst("RK-013", "jp")] };
    const s = swap(passBoard([jp], [inst("SPEC-DENO2", "s")]), "SPEC-DENO2:s", "SPEC-DENO:u");
    expect(zoneOf(s, "player1", "SPEC-DENO2:s")).toBe("rush");
    expect(zoneOf(s, "player1", "RK-013:jp")).toBe("discard");
    expect(cardIn(s, "player1", "SPEC-DENO2:s")?.stackedCards ?? []).toHaveLength(0);
  });

  // CPU: 重ねたカードを選ぶ選択で、以前は簡易の選び方がいつも見送り、起動しても置き換えなかった（2026-10-26 の見直し）。
  const cpuPickAfterActivate = (s: GameState) => {
    const a = legal(s).find((x) => x.type === "activate_resident_operation" && x.operationInstanceId === "RK-022:pass");
    expect(a).toBeDefined();
    const opened = act(s, a!);
    return pickEffectChoice(opened, opened.pendingEffectChoice!, legal(opened));
  };
  it("RK-022: CPU は、重ねたカードの方が強ければ置き換える", () => {
    const choice = cpuPickAfterActivate(passBoard([inst("SPEC-DENO", "u")], [inst("SPEC-DENO2", "s")]));
    expect(choice).toMatchObject({ type: "resolve_effect_choice", instanceId: "SPEC-DENO2:s" });
  });
  it("RK-022: CPU は、重ねたカードの方が弱ければ置き換えない", () => {
    const choice = cpuPickAfterActivate(passBoard([inst("SPEC-DENO2", "u")], [inst("SPEC-DENO", "s")]));
    expect(choice?.type).toBe("skip_effect_choice");
  });

  it("RK-022: 自軍ラッシュフェイズ以外（自軍バトルフェイズ）には置き換えられない（出典: atwiki/page-128「自軍ラッシュフェイズに」）", () => {
    const s = st(
      {
        player1: { rush: [inst("SPEC-DENO", "u")], operation: [{ ...inst("RK-022", "pass"), stackedCards: [inst("SPEC-DENO2", "s")] }], power: powerCards(6), deck: deckCards(5) },
      },
      EXTRA,
    );
    expect(legal(s).some((a) => a.type === "activate_resident_operation" && a.operationInstanceId === "RK-022:pass")).toBe(false);
  });

  it.todo(
    "RK-022: 「本来の特徴」— 効果で「DEN-O」を追加されたユニットとは置き換えられない（出典: atwiki/page-128「本来の特徴に「DEN-O」を持つ自軍ユニット」）— 本範囲に特徴「DEN-O」を追加する効果がなく、公開 API で状況を作れないため",
  );
  it.todo(
    "RK-022: 追加条件を持つカードは、追加条件を満たして置き換えられる（出典: atwiki/page-128「必要パワーと追加条件は満たすこと」・コメント欄「入れ替える対象以外に追加条件満たす用の電王SFがないといけない」）— 置き換えに伴う追加条件の支払い手順が出典に書かれておらず（コメント欄のみ）、エンジンも追加条件付きカードを候補から外しているため",
  );
  // 公式Q&A（grnrngr/faq-rider-1 RK-053 Q2: ガタックバルカンを受けたユニットをライダーパスで置き換えると、効果は引き継がない）は、RK-053 の照合の後
  // RK3-043-063.b の RK-053 で実テストにした（以前はここの it.todo）。
  it.todo(
    "RK-022: 公式Q&A — 置き換えて出したユニットは「ラッシュ」として扱い、VRVマスターの【乗ってみないか？】が発動する（出典: grnrngr/faq-rider-1 RK-022 Q5）— RS-299 側の未実装（cardSpec/RS5-285-305.c.test.ts に it.todo）。ラッシュ扱い自体は RS5-audit-crossref で照合済み",
  );
});

// ===========================================================================
describe("RK-023 仮面ライダー1号", () => {
  const TEXT =
    "【技の1号】「SP1」これがアタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルし、自分が次の行動の宣言をするまで相手はカウンターを発動できない。";

  it("RK-023: カタログ本文・スペックが出典と一致（出典: atwiki/page-106）", () => {
    expectCatalogText("RK-023", TEXT);
    expectStats("RK-023", {
      name: "仮面ライダー1号",
      category: "ET",
      size: "S",
      bp: 4000,
      sp: "1/5",
      powerCost: 4,
      comboNumber: "RC",
      features: ["仮面ライダー", "男", "改造人間"],
    });
    expectRarityIn("RK-023", ["SR"]);
  });

  /** 1号をマシンゼクトロン（RK-058。進入効果なし）にライドさせて出し、ライドオフする（RC 発動）。 */
  const rcBoard = (p2: Partial<GameState["players"]["player2"]> = {}, p1: Partial<GameState["players"]["player1"]> = {}) =>
    rideOff(mount(board({ rush: [inst("RK-023", "one"), inst("RK-058", "v")], ...p1 }, p2), "RK-023:one", "RK-058:v"), true);

  it("RK-023: RC — ライドオフすると「SP1」を得て、2番目に並んでもストライクで1点与える（出典: atwiki/page-106「【技の1号】「SP1」」・R-KW-RC-01）", () => {
    let s = settle(rcBoard());
    expect(zoneIds(s, "player1", "battle")).toEqual(["RK-058:v", "RK-023:one"]);
    expect(canStrike(s, "RK-023:one")).toBe(true);
    s = settle(strike(s, "RK-023:one"));
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RK-023: ライドしないで出たときは RC が発動せず、SP1/5 の1番目ではストライクできない（出典: atwiki/page-106「SP：1/5」・R-KW-RC-01）", () => {
    const s = enter(board({ rush: [inst("RK-023", "one")] }), "RK-023:one");
    expect(canStrike(s, "RK-023:one")).toBe(false);
  });

  it("RK-023: RC — アタックするとき、敵軍ユニットの BP を本来の値としてバトルする（ライドで BP4500 の相手〈本来 3500〉に BP4000 で勝つ）（出典: atwiki/page-106「敵軍ユニットのBPをカードに表記された本来の値としてバトルし」）", () => {
    let s = settle(rcBoard({ battle: ridingPair("SPEC-RC3500", "e", "RK-024", "ev") }));
    expect(bpOf(s, "player2", "SPEC-RC3500:e")).toBe(4500);
    s = resolveAll(attack(s, "RK-023:one", "SPEC-RC3500:e"));
    expect(zoneOf(s, "player2", "SPEC-RC3500:e")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-023:one")).toBe("battle");
  });

  it("RK-023: RC を発動していなければ、敵軍ユニットの BP はそのまま（BP4000 で BP4500 の相手に負ける）（出典: atwiki/page-106・R-KW-RC-01）", () => {
    let s = enter(board({ rush: [inst("RK-023", "one")] }, { battle: ridingPair("SPEC-RC3500", "e", "RK-024", "ev") }), "RK-023:one");
    s = resolveAll(attack(s, "RK-023:one", "SPEC-RC3500:e"));
    expect(zoneOf(s, "player1", "RK-023:one")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-RC3500:e")).toBe("battle");
  });

  /** 相手（player2）がギギの腕輪（RK-004。WB のカウンター）を使える盤面。 */
  const gigi = { hand: [inst("RK-004", "g")], command: releasedCat("WB", 2, "eW"), power: powerCards(3, "ep") };
  const canCounter = (s: GameState) =>
    legal(s).some(
      (a) =>
        (a.type === "initiate_command_payment" && a.sourceInstanceId === "RK-004:g") || (a.type === "play_counter" && a.instanceId === "RK-004:g"),
    );

  it("RK-023: RC — これがアタックするとき、相手はカウンターを発動できない（出典: atwiki/page-106「自分が次の行動の宣言をするまで相手はカウンターを発動できない」）", () => {
    const s = attack(settle(rcBoard({ battle: [inst("SPEC-E1500", "e")], ...gigi })), "RK-023:one", "SPEC-E1500:e");
    expect(canCounter(s)).toBe(false);
  });

  it("RK-023: RC を発動していなければ、相手はアタックに対してカウンターを発動できる（出典: atwiki/page-106・RK-004 の発動条件 atwiki/page-175）", () => {
    let s = enter(board({ rush: [inst("RK-023", "one")] }, { battle: [inst("SPEC-E1500", "e")], ...gigi }), "RK-023:one");
    s = attack(s, "RK-023:one", "SPEC-E1500:e");
    expect(canCounter(s)).toBe(true);
  });

  it("RK-023: 「次の行動の宣言をするまで」— 1号のアタックの後、次に出たユニットのアタックには相手はカウンターを発動できる（出典: atwiki/page-106・コメント欄「1号のアタックに対してカウンターを発動させない効果」）", () => {
    let s = settle(rcBoard({ battle: [inst("SPEC-E1500", "e"), inst("SPEC-E1500", "e2")], ...gigi }, { rush: [inst("RK-023", "one"), inst("RK-058", "v"), inst("SPEC-E2000", "next")] }));
    s = resolveAll(attack(s, "RK-023:one", "SPEC-E1500:e"));
    s = enter(passEntry(s), "SPEC-E2000:next");
    s = attack(s, "SPEC-E2000:next", "SPEC-E1500:e2");
    expect(canCounter(s)).toBe(true);
  });

  it.todo(
    "RK-023: 公式Q&A（相互参照）— SK-002 仮面ライダーV3【ダブルタイフーン】でホールドした1号の RC は「SP1」を含めて V3 の効果として発動する（出典: grnrngr/faq-rider-2 SK-002 Q1・Q2）— SK-002 は本範囲外のカード",
  );
});

// ===========================================================================
describe("RK-024 サイクロン号", () => {
  const TEXT =
    "※これにライドしているユニットはBP+1000される。 【サイクロンクラッシャー】自軍ターン中、これがバトルエリアに出たとき、追加条件を持たないBP4000以上の敵軍Sユニットを1体選び、持ち主のコマンドゾーンにホールド状態で置く。置けなければ捨札にする。";

  it("RK-024: カタログ本文・スペックが出典と一致（出典: atwiki/page-50）", () => {
    expectCatalogText("RK-024", TEXT);
    expectVehicleStats("RK-024", { name: "サイクロン号", category: "ET", powerCost: 5, size: "S", features: ["メカ", "車両"] });
    expectRarityIn("RK-024", ["N"]);
  });

  it("RK-024: ※ これにライドしているユニットは BP+1000 される（出典: atwiki/page-50）", () => {
    const s = board({ battle: ridingPair("SPEC-RC3000", "u", "RK-024", "v"), rush: [inst("SPEC-RC3000", "w")] });
    expect(bpOf(s, "player1", "SPEC-RC3000:u")).toBe(4000);
    expect(bpOf(s, "player1", "SPEC-RC3000:w")).toBe(3000);
  });

  /** RC3000 をサイクロン号にライドさせて出す（進入効果の選択を残す）。 */
  const crash = (p2: Partial<GameState["players"]["player2"]>) =>
    mount(board({ rush: [inst("SPEC-RC3000", "u"), inst("RK-024", "v")] }, p2), "SPEC-RC3000:u", "RK-024:v");

  it("RK-024: 【サイクロンクラッシャー】選べるのは BP4000 以上の敵軍 S ユニット（バトルエリア・ラッシュエリアとも）で、BP3500・M ユニットは選べない（出典: atwiki/page-50「BP4000以上の敵軍Sユニット」・カード評価「エリアを問わずに除去できる」）", () => {
    const s = crash({ battle: [inst("SPEC-E4000", "b"), inst("SPEC-E3500", "c"), inst("SPEC-EM5000", "m")], rush: [inst("SPEC-E5000", "r")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-024");
    expect(choiceIds(s)).toEqual(["SPEC-E4000:b", "SPEC-E5000:r"]);
  });

  it("RK-024: 選んだユニットは持ち主のコマンドゾーンにホールド状態で置かれる（出典: atwiki/page-50「持ち主のコマンドゾーンにホールド状態で置く」）", () => {
    const s = settle(pick(crash({ battle: [inst("SPEC-E4000", "b")] }), "SPEC-E4000:b"));
    expect(zoneOf(s, "player2", "SPEC-E4000:b")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-E4000:b")?.commandHeld).toBe(true);
  });

  it("RK-024: 選ぶのは強制（見送れない）（出典: atwiki/page-50「1体選び、…置く」（「してもよい」がない））", () => {
    expect(canSkip(crash({ battle: [inst("SPEC-E4000", "b")] }))).toBe(false);
  });

  it("RK-024: 持ち主のコマンドゾーンに置けなければ（5枚）捨札にする（出典: atwiki/page-50「置けなければ捨札にする」）", () => {
    const s = settle(pick(crash({ battle: [inst("SPEC-E4000", "b")], command: releasedN(5, "TST-OP", "ec") }), "SPEC-E4000:b"));
    expect(zoneOf(s, "player2", "SPEC-E4000:b")).toBe("discard");
    expect(s.players.player2.command).toHaveLength(5);
  });

  it("RK-024: 追加条件を持つユニット（ジェノサイダー BP9000）は選べない（出典: atwiki/page-50「追加条件を持たない」・page-185 カード評価「サイクロン号などの一部の除去能力の対象にならない」）", () => {
    const s = crash({ battle: [inst("RK-041", "g")] });
    expect(choiceIds(s)).not.toContain("RK-041:g");
  });

  it("RK-024: 参照するのは今の BP（ライドで BP4000 になっている本来 BP3000 のユニットも選べる）（出典: atwiki/page-50「BP4000以上」・カード評価「参照するBPは本来の値ではない」）", () => {
    const s = crash({ battle: ridingPair("SPEC-RC3000", "e", "RK-024", "ev") });
    expect(choiceIds(s)).toContain("SPEC-RC3000:e");
  });

  // 公式 Q1「はい、ライドされていればバトルエリアに出ることができます。」
  it("RK-024: 公式Q&A — 対象がいなくてもライドされていればバトルエリアに出られる（出典: grnrngr/faq-rider-1 RK-024 Q1・atwiki/page-50 Q1）", () => {
    const s = settle(crash({ battle: [inst("SPEC-E3000", "c")] }));
    expect(zoneOf(s, "player1", "RK-024:v")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-E3000:c")).toBe("battle");
  });
});

// ===========================================================================
describe("RK-025 電波人間タックル", () => {
  const TEXT =
    "【電波投げ】敵軍山札の上から2枚をオモテにする。オモテにしたカードの中から、特徴「男」を持つユニットカードを持ち主のコマンドゾーンにホールド状態で置く。置けなかったカードと、それ以外のカードは、相手が好きな順で山札の上に戻す。";

  it("RK-025: カタログ本文・スペックが出典と一致（出典: atwiki/page-200）", () => {
    expectCatalogText("RK-025", TEXT);
    expectStats("RK-025", {
      name: "電波人間タックル",
      category: "ET",
      size: "S",
      bp: 1000,
      sp: "1/5",
      powerCost: 0,
      comboNumber: "RC",
      features: ["女", "改造人間"],
    });
    expectRarityIn("RK-025", ["N"]);
  });

  const rc = (deck: ReturnType<typeof inst>[], p2: Partial<GameState["players"]["player2"]> = {}) =>
    rideOff(mount(board({ rush: [inst("RK-025", "t"), inst("RK-058", "v")] }, { deck, ...p2 }), "RK-025:t", "RK-058:v"), true);

  it("RK-025: RC — 敵軍山札の上から2枚のうち、特徴「男」を持つユニットカードを持ち主のコマンドゾーンにホールド状態で置く（出典: atwiki/page-200）", () => {
    const s = settle(rc([inst("SPEC-MALE", "m"), inst("TST-OP", "a"), inst("TST-OP", "b")]));
    expect(zoneOf(s, "player2", "SPEC-MALE:m")).toBe("command");
    expect(cardIn(s, "player2", "SPEC-MALE:m")?.commandHeld).toBe(true);
    expect(zoneIds(s, "player2", "deck")).toEqual(["TST-OP:a", "TST-OP:b"]);
  });

  it("RK-025: RC — 2枚とも「男」のユニットカードなら2枚とも置く（出典: atwiki/page-200「特徴「男」を持つユニットカードを」）", () => {
    const s = settle(rc([inst("SPEC-MALE", "m"), inst("SPEC-KAMEN", "k"), inst("TST-OP", "b")]));
    expect(zoneOf(s, "player2", "SPEC-MALE:m")).toBe("command");
    expect(zoneOf(s, "player2", "SPEC-KAMEN:k")).toBe("command");
    expect(zoneIds(s, "player2", "deck")).toEqual(["TST-OP:b"]);
  });

  it("RK-025: RC — 「男」以外のカードは、相手（持ち主）が順番を選んで山札の上に戻す（出典: atwiki/page-200「それ以外のカードは、相手が好きな順で山札の上に戻す」）", () => {
    let s = rc([inst("TST-OP", "a"), inst("SPEC-E2000", "b"), inst("TST-OP", "c")]);
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).toEqual(["SPEC-E2000:b", "TST-OP:a"]);
    s = settle(pick(s, "SPEC-E2000:b"));
    expect(zoneIds(s, "player2", "deck")).toEqual(["SPEC-E2000:b", "TST-OP:a", "TST-OP:c"]);
  });

  it("RK-025: RC — コマンドゾーンに置けなかった「男」のカードも山札の上に戻す（出典: atwiki/page-200「置けなかったカードと、それ以外のカードは…山札の上に戻す」）", () => {
    const s = resolveAll(rc([inst("SPEC-MALE", "m"), inst("TST-OP", "a"), inst("TST-OP", "b")], { command: releasedN(5, "TST-OP", "ec") }));
    expect(zoneIds(s, "player2", "deck").slice(0, 2).sort()).toEqual(["SPEC-MALE:m", "TST-OP:a"]);
    expect(s.players.player2.command).toHaveLength(5);
  });

  it("RK-025: RC は強制（ライドオフすれば必ずオモテにする。見送れない）（出典: atwiki/page-200（「してもよい」がない）・カード評価「RC能力は任意発動ではなく強制発動」）", () => {
    const s = rc([inst("SPEC-MALE", "m"), inst("TST-OP", "a")]);
    expect(s.pendingEffectChoice?.playerId === "player1" && canSkip(s)).toBe(false);
    expect(zoneOf(settle(s), "player2", "SPEC-MALE:m")).toBe("command");
  });

  it("RK-025: ライドしないで出たときは RC が発動しない（出典: atwiki/page-200・R-KW-RC-01）", () => {
    const s = settle(enter(board({ rush: [inst("RK-025", "t")] }, { deck: [inst("SPEC-MALE", "m"), inst("TST-OP", "a")] }), "RK-025:t"));
    expect(zoneIds(s, "player2", "deck")).toEqual(["SPEC-MALE:m", "TST-OP:a"]);
  });
});

// ===========================================================================
describe("RK-026 がんがんじい", () => {
  const TEXT =
    "※これはBP2000以上の敵軍Sユニットにアタックされない。 【日本一の正義の味方】自軍ターン中、これがバトルエリアに出たとき、特徴「仮面ライダー」を持つ自軍ユニットを1体選び、ラッシュエリアに戻してもよい。ただし、戻したユニットはこのターン、再びバトルエリアに出ることはできない。";

  it("RK-026: カタログ本文・スペックが出典と一致（出典: atwiki/page-201）", () => {
    expectCatalogText("RK-026", TEXT);
    expectStats("RK-026", { name: "がんがんじい", category: "ET", size: "S", bp: 500, sp: undefined, powerCost: 1, features: ["男"] });
    expectRarityIn("RK-026", ["N"]);
  });

  it("RK-026: ※ BP2000 以上の敵軍 S ユニットにはアタックされず、BP1500 の S ユニット・BP5000 の M ユニットにはアタックされる（出典: atwiki/page-201「BP2000以上の敵軍Sユニットにアタックされない」）", () => {
    const s = enemyTurn(
      { battle: [inst("RK-026", "g")] },
      { battle: [inst("SPEC-E2000", "a"), inst("SPEC-E1500", "b"), inst("SPEC-EM5000", "m")] },
    );
    expect(attackersOf(s, "RK-026:g")).toEqual(["SPEC-E1500:b", "SPEC-EM5000:m"]);
  });

  const gan = (battle: ReturnType<typeof inst>[], rush: ReturnType<typeof inst>[] = []) =>
    enter(board({ battle, rush: [inst("RK-026", "g"), ...rush] }), "RK-026:g");

  it("RK-026: 【日本一の正義の味方】自軍ターン中に出たとき、自軍バトルエリアの特徴「仮面ライダー」を持つユニットを選べる（任意）（出典: atwiki/page-201「特徴「仮面ライダー」を持つ自軍ユニットを1体選び、ラッシュエリアに戻してもよい」）", () => {
    const s = gan([inst("SPEC-KAMEN", "k"), inst("SPEC-MALE", "m")], [inst("SPEC-KAMEN", "r")]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-026");
    expect(choiceIds(s)).toEqual(["SPEC-KAMEN:k"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-026: 選んだユニットは自軍ラッシュエリアに戻り、このターン再びバトルエリアに出られない（出典: atwiki/page-201「戻したユニットはこのターン、再びバトルエリアに出ることはできない」）", () => {
    let s = settle(pick(gan([inst("SPEC-KAMEN", "k")]), "SPEC-KAMEN:k"));
    expect(zoneOf(s, "player1", "SPEC-KAMEN:k")).toBe("rush");
    s = passEntry(s);
    expect(canEnter(s, "SPEC-KAMEN:k")).toBe(false);
  });

  it("RK-026: 戻さないことを選べば、そのユニットはバトルエリアに残る（出典: atwiki/page-201「戻してもよい」）", () => {
    const s = settle(skip(gan([inst("SPEC-KAMEN", "k")])));
    expect(zoneOf(s, "player1", "SPEC-KAMEN:k")).toBe("battle");
  });

  // 公式 Q1「ライド状態のまま自軍ラッシュエリアに戻ることになります。」
  it("RK-026: 公式Q&A — ビークルにライドしているユニットを戻すと、ライドした状態のままラッシュエリアに戻る（出典: grnrngr/faq-rider-1 RK-026 Q1・atwiki/page-201 Q1）", () => {
    const pair = ridingPair("RK-023", "one", "RK-058", "v");
    const s = settle(pick(gan(pair), "RK-023:one"));
    expect(zoneOf(s, "player1", "RK-023:one")).toBe("rush");
    expect(zoneOf(s, "player1", "RK-058:v")).toBe("rush");
    expect(cardIn(s, "player1", "RK-023:one")?.mountedOnInstanceId).toBe("RK-058:v");
  });

  // 公式Q&A（grnrngr/faq-rider-1 RK-050 Q: 仮面ライダー裁鬼は NC の効果があってもがんがんじいにアタックできない）は、RK-050 の照合の後
  // RK3-043-063.b の RK-050 で実テストにした（以前はここの it.todo）。
  it.todo(
    "RK-026: 公式Q&A（相互参照）— 戻すときにタイムロボβ／αで置き換えたユニットは、戻したユニットとしては扱わず再びバトルエリアに出られる（出典: grnrngr/faq-card-6 RS-394 Q）— RS-394/395 の置き換えと RS-203 の特徴追加の連鎖が必要（cardSpec/RS6-390-410.a.test.ts に it.todo）",
  );
});

// ===========================================================================
describe("RK-027 仮面ライダーBLACK", () => {
  const TEXT =
    "※これはライド中、BP+1000される。 【ライダーキック】自軍も敵軍もSユニットが1体しかいなければ、敵軍Sユニットを1体選び持ち主のパワーゾーンにダメージにして置く。";

  it("RK-027: カタログ本文・スペックが出典と一致（出典: atwiki/page-215）", () => {
    expectCatalogText("RK-027", TEXT);
    expectStats("RK-027", {
      name: "仮面ライダーBLACK",
      category: "MA",
      size: "S",
      bp: 3000,
      sp: "1/3",
      powerCost: 4,
      comboNumber: "RC",
      features: ["仮面ライダー", "男", "改造人間", "世紀王"],
    });
    expectRarityIn("RK-027", ["SR"]);
  });

  it("RK-027: ※ ライド中は BP+1000（バトルホッパーにライドして BP4000、マシンゼクトロン〈+500〉なら BP4500）、ライドしていなければ BP3000（出典: atwiki/page-215「これはライド中、BP+1000される」）", () => {
    const s = board({ battle: [...ridingPair("RK-027", "a", "RK-028", "h"), ...ridingPair("RK-027", "b", "RK-058", "z"), inst("RK-027", "c")] });
    expect(bpOf(s, "player1", "RK-027:a")).toBe(4000);
    expect(bpOf(s, "player1", "RK-027:b")).toBe(4500);
    expect(bpOf(s, "player1", "RK-027:c")).toBe(3000);
  });

  const kick = (p2: Partial<GameState["players"]["player2"]>, extraRush: ReturnType<typeof inst>[] = []) =>
    rideOff(mount(board({ rush: [inst("RK-027", "bk"), inst("RK-058", "v"), ...extraRush] }, p2), "RK-027:bk", "RK-058:v"), true);

  it("RK-027: RC — 自軍も敵軍も S ユニットが1体だけなら、敵軍 S ユニットを持ち主のパワーゾーンにダメージ（ウラ向き）として置く（出典: atwiki/page-215「持ち主のパワーゾーンにダメージにして置く」）", () => {
    let s = kick({ battle: [inst("SPEC-E5000", "e")] });
    if (s.pendingEffectChoice?.sourceCardId === "RK-027") {
      expect(choiceIds(s)).toEqual(["SPEC-E5000:e"]);
      expect(canSkip(s)).toBe(false);
      s = pick(s, "SPEC-E5000:e");
    }
    s = settle(s);
    expect(zoneOf(s, "player2", "SPEC-E5000:e")).toBe("power");
    expect(cardIn(s, "player2", "SPEC-E5000:e")?.faceDown).toBe(true);
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RK-027: RC — 敵軍の S ユニットがラッシュエリアにいても選べる（エリアを問わない）（出典: atwiki/page-215「敵軍Sユニットを1体選び」・カード評価「エリアを問わない能力であることがポイント」）", () => {
    const s = resolveAll(kick({ rush: [inst("SPEC-E5000", "e")] }), ["SPEC-E5000:e"]);
    expect(zoneOf(s, "player2", "SPEC-E5000:e")).toBe("power");
  });

  it("RK-027: RC — 敵軍の S ユニットが2体なら発動しない（出典: atwiki/page-215「自軍も敵軍もSユニットが1体しかいなければ」）", () => {
    const s = resolveAll(kick({ battle: [inst("SPEC-E5000", "e")], rush: [inst("SPEC-E1500", "e2")] }));
    expect(zoneOf(s, "player2", "SPEC-E5000:e")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-E1500:e2")).toBe("rush");
  });

  it("RK-027: RC — 自軍に BLACK 以外の S ユニットがいれば（ラッシュエリアでも）発動しない（出典: atwiki/page-215「自軍も…Sユニットが1体しかいなければ」）", () => {
    const s = resolveAll(kick({ battle: [inst("SPEC-E5000", "e")] }, [inst("TST-UNIT-0", "mine")]));
    expect(zoneOf(s, "player2", "SPEC-E5000:e")).toBe("battle");
  });

  it("RK-027: RC — M ユニットは数えない（敵軍が S1体＋M1体なら S ユニットを置く）（出典: atwiki/page-215「Sユニットが1体しかいなければ」・カード評価「Mユニットを利用する混合環境では意外と使う機会が生まれやすい」）", () => {
    const s = resolveAll(kick({ battle: [inst("SPEC-E5000", "e"), inst("SPEC-EM5000", "m")] }), ["SPEC-E5000:e"]);
    expect(zoneOf(s, "player2", "SPEC-E5000:e")).toBe("power");
    expect(zoneOf(s, "player2", "SPEC-EM5000:m")).toBe("battle");
  });

  it("RK-027: ライドしないで出たときは RC が発動しない（出典: atwiki/page-215・R-KW-RC-01）", () => {
    const s = resolveAll(enter(board({ rush: [inst("RK-027", "bk")] }, { battle: [inst("SPEC-E5000", "e")] }), "RK-027:bk"));
    expect(zoneOf(s, "player2", "SPEC-E5000:e")).toBe("battle");
  });

  it.todo(
    "RK-027: 公式Q&A（相互参照）— マシンゼクトロンにライドしている BLACK に J パワーを使うと、下からマシンゼクトロン・J パワー・BLACK の順に重ねる（出典: grnrngr/faq-rider-1 RK-058 Q）— J パワー（RK-013）は照合済み（RK1-001-021.b）だが、ビークル・J パワー・ユニットの重ね順は公開 API で観測できない",
  );
});

// ===========================================================================
describe("RK-028 バトルホッパー", () => {
  const TEXT =
    "※これは、自軍Sユニットがバトルエリアにあれば、ライドされていなくてもバトルエリアに出ることができる。 【ダイナミックスマッシュ】自軍ターン中、これがバトルエリアに出たとき、これにライドしているユニットの本来のBP以下のBPを持つSユニットを敵軍バトルエリアから1体選び、持ち主の手札に戻す。";

  it("RK-028: カタログ本文・スペックが出典と一致（出典: atwiki/page-216）", () => {
    expectCatalogText("RK-028", TEXT);
    expectVehicleStats("RK-028", { name: "バトルホッパー", category: "MA", powerCost: 2, size: "S", features: ["車両", "昆虫"] });
    expectRarityIn("RK-028", ["N"]);
  });

  it("RK-028: ※ 自軍 S ユニットがバトルエリアにあれば、ライドされていなくてもバトルエリアに出られる（出典: atwiki/page-216）", () => {
    const s = board({ battle: fill(1), rush: [inst("RK-028", "h")] });
    expect(canEnter(s, "RK-028:h")).toBe(true);
    const t = calm(enter(s, "RK-028:h"));
    expect(zoneOf(t, "player1", "RK-028:h")).toBe("battle");
  });

  it("RK-028: ※ 自軍バトルエリアに S ユニットがいなければ、ライドされずには出られない（M ユニットだけでも不可）（出典: atwiki/page-216「自軍Sユニットがバトルエリアにあれば」）", () => {
    expect(canEnter(board({ rush: [inst("RK-028", "h")] }), "RK-028:h")).toBe(false);
    expect(canEnter(board({ battle: [inst("SPEC-EM5000", "m")], rush: [inst("RK-028", "h")] }), "RK-028:h")).toBe(false);
  });

  /** BLACK（本来 BP3000、ライド中 BP4000）をバトルホッパーにライドさせて出す。 */
  const smash = (p2: Partial<GameState["players"]["player2"]>) =>
    mount(board({ rush: [inst("RK-027", "bk"), inst("RK-028", "h")] }, p2), "RK-027:bk", "RK-028:h");

  it("RK-028: 【ダイナミックスマッシュ】選べるのは、ライドしているユニットの本来の BP（3000）以下の敵軍バトルエリアの S ユニット（ライド中の BP4000 ではない）（出典: atwiki/page-216「これにライドしているユニットの本来のBP以下」・page-215 カード評価「乗り手の本来のBPを参照する」）", () => {
    const s = smash({ battle: [inst("SPEC-E3000", "a"), inst("SPEC-E3500", "b"), inst("SPEC-E1500", "c")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-028");
    expect(choiceIds(s)).toEqual(["SPEC-E1500:c", "SPEC-E3000:a"]);
  });

  it("RK-028: 選んだユニットは持ち主の手札に戻る（出典: atwiki/page-216「持ち主の手札に戻す」）", () => {
    const s = settle(pick(smash({ battle: [inst("SPEC-E3000", "a")] }), "SPEC-E3000:a"));
    expect(zoneOf(s, "player2", "SPEC-E3000:a")).toBe("hand");
  });

  it("RK-028: 選ぶのは強制（見送れない）（出典: atwiki/page-216（「してもよい」がない）・カード評価「効果は強制である点だけは注意」）", () => {
    expect(canSkip(smash({ battle: [inst("SPEC-E3000", "a")] }))).toBe(false);
  });

  it("RK-028: 敵軍ラッシュエリアのユニット・M ユニットは選べない（出典: atwiki/page-216「Sユニットを敵軍バトルエリアから1体選び」）", () => {
    const s = settle(smash({ rush: [inst("SPEC-E1500", "r")], battle: [inst("SPEC-EM5000", "m")] }));
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-028");
    expect(zoneOf(s, "player2", "SPEC-E1500:r")).toBe("rush");
  });

  it("RK-028: ライドされずに出たときは、比べる「ライドしているユニットの本来の BP」がないので手札に戻さない（出典: atwiki/page-216「これにライドしているユニットの本来のBP以下」）", () => {
    const s = settle(enter(board({ battle: fill(1), rush: [inst("RK-028", "h")] }, { battle: [inst("SPEC-E1500", "c")] }), "RK-028:h"));
    expect(zoneOf(s, "player2", "SPEC-E1500:c")).toBe("battle");
  });
});
