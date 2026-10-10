/**
 * カード別スペック: RS-376〜RS-381（第6弾「紅き六戦士の帰還」ギンガレッド〜ガレオパルサー）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-6
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_6.html）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール（R-CN-02 NC の発動、R-KW-RIDE-02/05 ライド・ライドオフ）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 *
 * ギンガマン各カードの「「MA」の自軍コマンドを１つホールドして、次の効果を発動できる」は NC 効果の一部で、
 * 発動は任意（「発動できる」）。起動の申し出は helpers の holdEffectOffered / useHoldEffect で、
 * 保留中の効果選択・コマンド支払い・場のユニット能力の起動のいずれの形でも受け付ける。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  attackTargets,
  canSkip,
  canStrike,
  choiceIds,
  deckCards,
  DEFS,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  holdEffectOffered,
  inst,
  kibaShot,
  lastBattleBps,
  legal,
  passEntry,
  pick,
  released,
  releasedCat,
  resolveAll,
  settle,
  spOf,
  st,
  sUnit,
  useHoldEffect,
  zoneOf,
} from "./RS6-369-389.helpers";
import type { GameState } from "../types/game";

const NO_NUM_S = sUnit("SPEC-NONUM-S", { bp: 5000, powerCost: 3 });
const NUM_S = sUnit("SPEC-NUM-S", { bp: 1000, comboNumber: 3 });
const NO_NUM_M = sUnit("SPEC-NONUM-M", { bp: 3000, size: "M" });
const RED_M = sUnit("SPEC-RED-M", { size: "M", features: ["レッド"] });
const SPECS = [NO_NUM_S, NUM_S, NO_NUM_M, RED_M];

/** player1 のバトルフェイズに id を cn 番目に出す。 */
function ncEnter(
  id: string,
  cn: number,
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
) {
  const s = st(
    {
      player1: { rush: [inst(id, "x")], battle: fillers(cn - 1), deck: deckCards(5), ...p1 },
      player2: { deck: deckCards(5, "e"), ...p2 },
    },
    SPECS,
  );
  return act(s, { type: "move_to_battle", playerId: "player1", instanceId: `${id}:x` });
}

const MA1 = () => releasedCat("MA", 1);

// ===========================================================================
describe("RS-376 ギンガレッド", () => {
  const TEXT =
    "【炎一閃】「SP1」「MA」の自軍コマンドを１つホールドして、次の効果を発動できる⇒敵軍バトルエリアからナンバーを持たないSユニットを1体選び、撃破する。";

  it("RS-376: カタログ本文・スペックが出典と一致（出典: atwiki/page-501）", () => {
    expectCatalogText("RS-376", TEXT);
    expectStats("RS-376", { name: "ギンガレッド", category: "WB", size: "S", bp: 3000, sp: "special", powerCost: 3, comboNumber: 2, features: ["レッド", "男"] });
  });

  it("RS-376: 【炎一閃】NC 成立（2番目）で SP1 になりストライクできる（出典: atwiki/page-501「「SP1」」）", () => {
    const s = ncEnter("RS-376", 2, { command: MA1() });
    expect(spOf(s, "player1", "RS-376:x")).toBe(1);
    expect(canStrike(s, "RS-376:x")).toBe(true);
  });

  it("RS-376: NC 不成立（1番目）なら SP はなく、【炎一閃】も発動できない（出典: atwiki/page-501「SP：！」・R-CN-02）", () => {
    const s = ncEnter("RS-376", 1, { command: MA1() }, { battle: [inst("SPEC-NONUM-S", "t")] });
    expect(spOf(s, "player1", "RS-376:x")).toBe(0);
    expect(holdEffectOffered(s, "RS-376:x")).toBe(false);
  });

  it.fails("RS-376: 【炎一閃】NC 成立時、「MA」の自軍コマンドを1つホールドして発動できる（出典: atwiki/page-501「「MA」の自軍コマンドを１つホールドして、次の効果を発動できる」）", () => {
    // 既知の不具合: CARD-RS-376 NC で SP1 になるだけで、【炎一閃】（MA ホールド→撃破）の発動手段がない
    const s = ncEnter("RS-376", 2, { command: MA1() }, { battle: [inst("SPEC-NONUM-S", "t")] });
    expect(holdEffectOffered(s, "RS-376:x")).toBe(true);
  });

  it.fails("RS-376: 【炎一閃】敵軍バトルエリアのナンバーを持たない S ユニットだけが候補（ナンバー持ち・M ユニット・ラッシュエリアは不可）で、選んだユニットを撃破する（出典: atwiki/page-501）", () => {
    // 既知の不具合: CARD-RS-376 【炎一閃】の発動手段がない
    let s = ncEnter(
      "RS-376",
      2,
      { command: MA1() },
      { battle: [inst("SPEC-NONUM-S", "t"), inst("SPEC-NUM-S", "n"), inst("SPEC-NONUM-M", "m")], rush: [inst("SPEC-NONUM-S", "r")] },
    );
    s = useHoldEffect(s, "player1", "RS-376:x", ["TST-OP-MA:cMA0"]);
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
    expect(choiceIds(s)).toEqual(["SPEC-NONUM-S:t"]);
    s = resolveAll(pick(s, "SPEC-NONUM-S:t"));
    expect(zoneOf(s, "player2", "SPEC-NONUM-S:t")).toBe("discard");
  });

  it("RS-376: 【炎一閃】は任意 — 発動しなければ MA コマンドはリリースのままで、何も撃破されない（出典: atwiki/page-501「発動できる」）", () => {
    let s = ncEnter("RS-376", 2, { command: MA1() }, { battle: [inst("SPEC-NONUM-S", "t")] });
    if (s.pendingEffectChoice?.sourceInstanceId === "RS-376:x") {
      expect(canSkip(s)).toBe(true);
      s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    }
    s = settle(s);
    expect(s.players.player1.command[0]?.commandHeld ?? false).toBe(false);
    expect(zoneOf(s, "player2", "SPEC-NONUM-S:t")).toBe("battle");
  });

  it("RS-376: 【炎一閃】「MA」の自軍コマンドがなければ（WB だけでは）発動できない（出典: atwiki/page-501「「MA」の自軍コマンドを１つホールドして」）", () => {
    const s = ncEnter("RS-376", 2, { command: releasedCat("WB", 2) }, { battle: [inst("SPEC-NONUM-S", "t")] });
    expect(holdEffectOffered(s, "RS-376:x")).toBe(false);
    expect(zoneOf(resolveAll(s), "player2", "SPEC-NONUM-S:t")).toBe("battle");
  });
});

// ===========================================================================
describe("RS-377 ギンガグリーン", () => {
  const TEXT =
    "【キバショット】「MA」の自軍コマンドを１つホールドして、次の効果を発動できる⇒このターン、リリース状態の敵軍コマンドがホールドされたとき、 ホールドされたコマンドの必要パワーの数字と同じ必要パワーの数字を持つ敵軍Sユニットを1体選び撃破する。";

  it("RS-377: カタログ本文・スペックが出典と一致（出典: atwiki/page-502）", () => {
    expectCatalogText("RS-377", TEXT);
    expectStats("RS-377", { name: "ギンガグリーン", category: "WB", size: "S", bp: 3000, sp: undefined, powerCost: 2, comboNumber: 1, features: ["グリーン", "男"] });
  });

  it.fails("RS-377: 【キバショット】の発動は任意で、NC 成立時に敵軍コマンドを強制的に選ばせない（出典: atwiki/page-502「発動できる」）", () => {
    // 既知の不具合: CARD-RS-377 NC 成立で、見送れない「敵軍コマンドを1つ選んでホールドする」選択が出る（MA の自軍コマンドの支払いもない）
    const s = ncEnter("RS-377", 1, { command: MA1() }, { command: releasedCat("WB", 2, "ec") });
    const forced = s.pendingEffectChoice?.sourceInstanceId === "RS-377:x" && !canSkip(s);
    expect(forced).toBe(false);
    expect(s.players.player2.command.every((c) => !c.commandHeld)).toBe(true);
  });

  it.fails("RS-377: 【キバショット】MA をホールドして発動すると、このターン、リリース状態の敵軍コマンドがホールドされたとき、その必要パワーと同じ必要パワーの敵軍 S ユニットを1体選び撃破する（出典: atwiki/page-502）", () => {
    // 既知の不具合: CARD-RS-377 【キバショット】の発動手段がない（NC で敵軍コマンドを1つホールドさせる別の処理になっている）
    // 敵軍がダイノガッツ（RS-027）をコマンド TST-UNIT-2（必要パワー2）をホールドして使う → 必要パワー2の敵軍 S ユニット（RS-372）を撃破。
    let s = kibaShot(inst("TST-UNIT-2", "cmd"), { battle: [inst("RS-372", "c2"), inst("RS-369", "c3")] });
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["RS-372:c2"]);
    s = resolveAll(pick(s, "RS-372:c2"));
    expect(zoneOf(s, "player2", "RS-372:c2")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-369:c3")).toBe("battle");
  });

  it.fails("RS-377: 【キバショット】を発動しなければ、敵軍コマンドがホールドされても何も撃破しない（出典: atwiki/page-502「次の効果を発動できる⇒このターン、…」）", () => {
    // 既知の不具合: CARD-RS-377 NC 成立で見送れない敵軍コマンドの選択が出るため、【キバショット】を見送ってアタックへ進めない
    const s = resolveAll(kibaShot(inst("TST-UNIT-2", "cmd"), { battle: [inst("RS-372", "c2")] }, { activate: false }));
    expect(zoneOf(s, "player2", "RS-372:c2")).toBe("battle");
  });

  // grnrngr/faq-card-6 RS-377「いいえ、できません。「RS-010 プリズムパワー」の効果が発動できるのは「自分がカードを使用するとき」ですので」
  it("RS-377: 公式Q&A — プリズムパワー（自軍コマンド2つのホールド）で MA コマンドの代わりにはできない（WB コマンドだけでは自軍コマンドをホールドして発動できない）（出典: grnrngr/faq-card-6 RS-377 Q）", () => {
    let s = ncEnter("RS-377", 1, { command: releasedCat("WB", 3), operation: [inst("RS-010", "prism")] }, { command: releasedCat("WB", 1, "ec") });
    const prism = legal(s).some(
      (a) => a.playerId === "player1" && "prismSubstitute" in a && a.prismSubstitute === true && "sourceInstanceId" in a && a.sourceInstanceId === "RS-377:x",
    );
    expect(prism).toBe(false);
    s = resolveAll(s);
    expect(s.players.player1.command.every((c) => !c.commandHeld)).toBe(true);
  });
});

// ===========================================================================
describe("RS-378 ギンガブルー", () => {
  const TEXT =
    "【流水の鼓動】「SP1」「MA」の自軍コマンドを１つホールドして次の効果を発動できる⇒ホールドしたコマンドにナンバーがあれば、そのナンバーと同じナンバーを持つ敵軍Sユニットを1体選び撃破する。";

  it("RS-378: カタログ本文・スペックが出典と一致（出典: atwiki/page-503）", () => {
    expectCatalogText("RS-378", TEXT);
    expectStats("RS-378", { name: "ギンガブルー", category: "WB", size: "S", bp: 3000, sp: "special", powerCost: 3, comboNumber: 2, features: ["ブルー", "男"] });
  });

  it("RS-378: 【流水の鼓動】NC 成立（2番目）で SP1 になりストライクできる（出典: atwiki/page-503「「SP1」」）", () => {
    const s = ncEnter("RS-378", 2);
    expect(spOf(s, "player1", "RS-378:x")).toBe(1);
    expect(canStrike(s, "RS-378:x")).toBe(true);
  });

  it("RS-378: NC 不成立（1番目）なら SP はなく、【流水の鼓動】も発動できない（出典: atwiki/page-503・R-CN-02）", () => {
    const s = ncEnter("RS-378", 1, { command: [released("RS-369", "cmd")] });
    expect(spOf(s, "player1", "RS-378:x")).toBe(0);
    expect(holdEffectOffered(s, "RS-378:x")).toBe(false);
  });

  it.fails("RS-378: 【流水の鼓動】ナンバーを持つ MA コマンド（ブルーマスク・CN3）をホールドすると、ナンバー3の敵軍 S ユニットを1体選び撃破する（出典: atwiki/page-503）", () => {
    // 既知の不具合: CARD-RS-378 NC で SP1 になるだけで、【流水の鼓動】の発動手段がない
    let s = ncEnter("RS-378", 2, { command: [released("RS-369", "cmd")] }, { battle: [inst("RS-370", "n3"), inst("RS-371", "n2"), inst("TST-UNIT-0", "nn")] });
    s = useHoldEffect(s, "player1", "RS-378:x", ["RS-369:cmd"]);
    expect(choiceIds(s)).toEqual(["RS-370:n3"]);
    s = resolveAll(pick(s, "RS-370:n3"));
    expect(zoneOf(s, "player2", "RS-370:n3")).toBe("discard");
  });

  it.fails("RS-378: 【流水の鼓動】ホールドした MA コマンドにナンバーがなければ（オペレーション）何も撃破しない（出典: atwiki/page-503「ホールドしたコマンドにナンバーがあれば」）", () => {
    // 既知の不具合: CARD-RS-378 【流水の鼓動】の発動手段がない
    let s = ncEnter("RS-378", 2, { command: MA1() }, { battle: [inst("RS-370", "n3")] });
    s = resolveAll(useHoldEffect(s, "player1", "RS-378:x", ["TST-OP-MA:cMA0"]));
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "RS-370:n3")).toBe("battle");
  });

  it("RS-378: 【流水の鼓動】「MA」の自軍コマンドがなければ発動できない（出典: atwiki/page-503「「MA」の自軍コマンドを１つホールドして」）", () => {
    const s = ncEnter("RS-378", 2, { command: [released("RS-376", "wbcmd")] }, { battle: [inst("RS-371", "n2")] });
    expect(holdEffectOffered(s, "RS-378:x")).toBe(false);
  });

  // grnrngr/faq-card-6 RS-378「ホールドしたコマンドに該当するのは「ミスティックアームズ」のコマンドの代わりとしてホールドした「ワイルドビースト」のコマンド１つ」
  it.fails("RS-378: 公式Q&A — マスター・シャーフーで MA の代わりに WB コマンド＋追加1つをホールドしたとき、「ホールドしたコマンド」は代わりの WB コマンド1つだけ（出典: grnrngr/faq-card-6 RS-378 Q）", () => {
    // 既知の不具合: CARD-RS-378 【流水の鼓動】の発動手段がない
    // 代わりの WB コマンド = ギンガレッド（CN2）、追加分 = ブルーマスク（CN3）。ナンバー2の敵軍 S ユニットだけが候補。
    let s = ncEnter(
      "RS-378",
      2,
      { rush: [inst("RS-378", "x"), inst("RS-429", "shf")], command: [released("RS-376", "wb2"), released("RS-369", "ma3")] },
      { battle: [inst("RS-371", "n2"), inst("RS-370", "n3")] },
    );
    s = useHoldEffect(s, "player1", "RS-378:x", ["RS-376:wb2", "RS-369:ma3"]);
    expect(choiceIds(s)).toEqual(["RS-371:n2"]);
  });
});

// ===========================================================================
describe("RS-379 ギンガイエロー", () => {
  const TEXT =
    "【雷の雄叫び】「MA」の自軍コマンドを１つホールドして次の効果を発動できる⇒このターン、特徴「メカ」を持つ敵軍ユニットの、効果名を持つテキストは無効になり、発動もできない。";

  it("RS-379: カタログ本文・スペックが出典と一致（出典: atwiki/page-504）", () => {
    expectCatalogText("RS-379", TEXT);
    expectStats("RS-379", { name: "ギンガイエロー", category: "WB", size: "S", bp: 2000, sp: undefined, powerCost: 0, comboNumber: 1, features: ["イエロー", "男"] });
  });

  /** 敵軍: パトレーラー（メカ、【シグナルキャノン】OT の M ユニットはアタックされるとき BP+1000）がラッシュエリア、パトアーマー（OT M BP5000）がバトルエリア。 */
  const ENEMY = () => ({ rush: [inst("RS-045", "pl")], battle: [inst("RS-046", "pa")], deck: deckCards(5, "e") });

  it("RS-379: 対照 — 【雷の雄叫び】を発動しなければ、敵軍メカの【シグナルキャノン】でアタックされた OT の M ユニットは BP+1000（6000）（出典: atwiki/page-504・RS-045 本文）", () => {
    let s = st({ player1: { rush: [inst("RS-379", "x"), inst("TST-UNIT-7", "atk")], command: MA1(), deck: deckCards(5) }, player2: ENEMY() });
    s = passEntry(resolveAll(act(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-379:x" })));
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: "TST-UNIT-7:atk" });
    s = settle(attack(s, "TST-UNIT-7:atk", "RS-046:pa"));
    expect(lastBattleBps(s)?.defender).toBe(6000);
  });

  it("RS-379: 【雷の雄叫び】MA をホールドして発動すると、このターン、メカの敵軍ユニットの効果名を持つテキスト（【シグナルキャノン】）は無効（アタックされた OT の M ユニットは BP5000 のまま）（出典: atwiki/page-504）", () => {
    let s = st({ player1: { rush: [inst("RS-379", "x"), inst("TST-UNIT-7", "atk")], command: MA1(), deck: deckCards(5) }, player2: ENEMY() });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-379:x" });
    s = useHoldEffect(s, "player1", "RS-379:x", ["TST-OP-MA:cMA0"]);
    s = passEntry(resolveAll(s));
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: "TST-UNIT-7:atk" });
    s = settle(attack(s, "TST-UNIT-7:atk", "RS-046:pa"));
    expect(lastBattleBps(s)?.defender).toBe(5000);
  });

  it("RS-379: 【雷の雄叫び】効果名を持たない ※ テキストは無効にならない（ジェットファルコンは発動後も「航空機」を持たないユニットにアタックされない）（出典: atwiki/page-504「効果名を持つテキストは無効になり」）", () => {
    let s = st({ player1: { rush: [inst("RS-379", "x"), inst("TST-UNIT-7", "atk")], command: MA1(), deck: deckCards(5) }, player2: { battle: [inst("RS-135", "jf")], deck: deckCards(5, "e") } });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-379:x" });
    s = passEntry(resolveAll(useHoldEffect(s, "player1", "RS-379:x", ["TST-OP-MA:cMA0"])));
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: "TST-UNIT-7:atk" });
    expect(attackTargets(s, "TST-UNIT-7:atk")).not.toContain("RS-135:jf");
  });

  it("RS-379: NC 不成立（2番目）なら【雷の雄叫び】は発動できない（出典: atwiki/page-504「CN：1」・R-CN-02）", () => {
    const s = ncEnter("RS-379", 2, { command: MA1() }, ENEMY());
    expect(holdEffectOffered(s, "RS-379:x")).toBe(false);
  });

  it("RS-379: 「MA」の自軍コマンドがなければ発動できない（出典: atwiki/page-504「「MA」の自軍コマンドを１つホールドして」）", () => {
    const s = ncEnter("RS-379", 1, { command: releasedCat("WB", 2) }, ENEMY());
    expect(holdEffectOffered(s, "RS-379:x")).toBe(false);
  });
});

// ===========================================================================
describe("RS-380 ギンガピンク", () => {
  const TEXT = "【花弁の爪】「SP1」「MA」の自軍コマンドを１つホールドして、次の効果を発動できる⇒敵軍コマンドをすべてホールドする。";

  it("RS-380: カタログ本文・スペックが出典と一致（出典: atwiki/page-505）", () => {
    expectCatalogText("RS-380", TEXT);
    expectStats("RS-380", { name: "ギンガピンク", category: "WB", size: "S", bp: 500, sp: "special", powerCost: 1, comboNumber: 2, features: ["ピンク", "女"] });
  });

  it("RS-380: 【花弁の爪】NC 成立（2番目）で SP1 になりストライクできる（出典: atwiki/page-505「「SP1」」）", () => {
    const s = ncEnter("RS-380", 2);
    expect(spOf(s, "player1", "RS-380:x")).toBe(1);
    expect(canStrike(s, "RS-380:x")).toBe(true);
  });

  it("RS-380: NC 不成立（1番目）なら SP はない（出典: atwiki/page-505・R-CN-02）", () => {
    expect(spOf(ncEnter("RS-380", 1), "player1", "RS-380:x")).toBe(0);
  });

  it.fails("RS-380: 【花弁の爪】MA をホールドして発動すると、敵軍コマンドをすべてホールドする（出典: atwiki/page-505「敵軍コマンドをすべてホールドする」）", () => {
    // 既知の不具合: CARD-RS-380 NC で SP1 になるだけで、【花弁の爪】の発動手段がない
    let s = ncEnter("RS-380", 2, { command: MA1() }, { command: releasedCat("WB", 3, "ec") });
    s = resolveAll(useHoldEffect(s, "player1", "RS-380:x", ["TST-OP-MA:cMA0"]));
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
    expect(s.players.player2.command.every((c) => c.commandHeld)).toBe(true);
  });

  it("RS-380: 【花弁の爪】は任意 — 発動しなければ敵軍コマンドはリリースのまま（出典: atwiki/page-505「発動できる」）", () => {
    let s = ncEnter("RS-380", 2, { command: MA1() }, { command: releasedCat("WB", 3, "ec") });
    if (s.pendingEffectChoice?.sourceInstanceId === "RS-380:x") s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    s = settle(s);
    expect(s.players.player2.command.every((c) => !c.commandHeld)).toBe(true);
    expect(s.players.player1.command[0]?.commandHeld ?? false).toBe(false);
  });

  it("RS-380: 「MA」の自軍コマンドがなければ発動できない（出典: atwiki/page-505「「MA」の自軍コマンドを１つホールドして」）", () => {
    const s = ncEnter("RS-380", 2, { command: releasedCat("WB", 2) }, { command: releasedCat("WB", 3, "ec") });
    expect(holdEffectOffered(s, "RS-380:x")).toBe(false);
    expect(s.players.player2.command.every((c) => !c.commandHeld)).toBe(true);
  });
});

// ===========================================================================
describe("RS-381 ガレオパルサー", () => {
  const TEXT =
    "※特徴「レッド」を持つSユニットは、自軍コマンドを1つホールドすれば、ＲＣを持っていなくてもこのビークルにライドできる。 【獅子の装光】自軍ターン中、これにライドしたユニットをライドオフさせるかわりに次の効果を発動できる⇒ライドされていない敵軍Sビークルを1体選び捨札にする。その後、これを捨札にする。";

  it("RS-381: カタログ本文・スペックが出典と一致（S ビークル・WB・必要パワー4・特徴 ギンガの光／車両）（出典: atwiki/page-522）", () => {
    expectCatalogText("RS-381", TEXT);
    const d = DEFS["RS-381"]!;
    expect(d.name).toBe("ガレオパルサー");
    expect(d.type).toBe("vehicle");
    expect(d.category).toBe("WB");
    expect(d.size).toBe("S");
    expect(d.powerCost).toBe(4);
    expect(d.features ?? []).toEqual(["ギンガの光", "車両"]);
    expect(d.rushAdditionalCondition).toBeUndefined();
  });

  const rideState = (rider: string, cmds = releasedCat("WB", 1), p2: Partial<GameState["players"]["player2"]> = {}) =>
    st({ player1: { rush: [inst(rider, "rd"), inst("RS-381", "v")], command: cmds, deck: deckCards(3) }, player2: { deck: deckCards(3, "e"), ...p2 } }, SPECS);
  const canRide = (s: GameState, rider: string) =>
    legal(s).some((a) => a.type === "mount_ride" && a.riderInstanceId === rider && a.vehicleInstanceId === "RS-381:v");
  const ride = (s: GameState, rider: string) => act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: rider, vehicleInstanceId: "RS-381:v" });

  it("RS-381: ※ 特徴「レッド」の S ユニット（ギンガレッド・RC なし）はライドできる（出典: atwiki/page-522）", () => {
    const s = rideState("RS-376");
    expect(canRide(s, "RS-376:rd")).toBe(true);
    const t = ride(s, "RS-376:rd");
    expect(zoneOf(t, "player1", "RS-376:rd")).toBe("battle");
    expect(t.players.player1.battle.find((c) => c.instanceId === "RS-376:rd")?.mountedOnInstanceId).toBe("RS-381:v");
  });

  it("RS-381: ※ RC を持たない「レッド」の S ユニットがライドするときは自軍コマンドを1つホールドする（出典: atwiki/page-522「自軍コマンドを1つホールドすれば」）", () => {
    const t = ride(rideState("RS-376"), "RS-376:rd");
    expect(t.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(1);
  });

  it("RS-381: ※ リリース状態の自軍コマンドがなければ「レッド」の S ユニットはライドできない（出典: atwiki/page-522「自軍コマンドを1つホールドすれば」）", () => {
    const s = rideState("RS-376", [{ ...inst("TST-OP", "h"), commandHeld: true }]);
    expect(canRide(s, "RS-376:rd")).toBe(false);
  });

  it("RS-381: ※ 「レッド」を持たない RC なしの S ユニットはライドできない（出典: atwiki/page-522「特徴「レッド」を持つSユニットは」・R-KW-RIDE-02）", () => {
    expect(canRide(rideState("RS-378"), "RS-378:rd")).toBe(false);
  });

  it("RS-381: ※ 「レッド」でも M ユニットはライドできない（出典: atwiki/page-522「特徴「レッド」を持つSユニット」）", () => {
    expect(canRide(rideState("SPEC-RED-M"), "SPEC-RED-M:rd")).toBe(false);
  });

  it("RS-381: 【獅子の装光】自軍ターン中、ライドしたユニットをライドオフさせるかわりに、ライドされていない敵軍 S ビークルを1体選び捨札にし、その後これを捨札にする（出典: atwiki/page-522）", () => {
    let s = ride(rideState("RS-376", releasedCat("WB", 1), { rush: [inst("RK-045", "ev")] }), "RS-376:rd");
    const alt = legal(s).find(
      (a) => a.playerId === "player1" && a.type !== "resolve_ride_off_choice" && Object.values(a).includes("RS-381:v"),
    );
    expect(alt).toBeDefined();
    s = resolveAll(act(s, alt!), ["RK-045:ev"]);
    expect(zoneOf(s, "player2", "RK-045:ev")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-381:v")).toBe("discard");
  });

  it("RS-381: 【獅子の装光】を使わなければ通常どおりライドオフを選べる（出典: atwiki/page-522「発動できる」・R-KW-RIDE-05）", () => {
    const s = ride(rideState("RS-376", releasedCat("WB", 1), { rush: [inst("RK-045", "ev")] }), "RS-376:rd");
    expect(legal(s).some((a) => a.type === "resolve_ride_off_choice" && a.rideOff === true)).toBe(true);
    const t = settle(act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: false }));
    expect(zoneOf(t, "player2", "RK-045:ev")).toBe("rush");
    expect(zoneOf(t, "player1", "RS-381:v")).toBe("battle");
  });
});
