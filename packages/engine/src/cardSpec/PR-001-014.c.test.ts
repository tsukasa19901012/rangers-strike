/**
 * カード別スペック: PR-011〜PR-014（プロモーションカード ボウケンレッド（プロモ2）〜ダークナイト）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-RS018 隠流忍術の「以外のユニットを」。PR-012 の印刷文はこの修正を含む）。
 *     grnrngr/faq-card-plomo には本範囲の項はない。本文が元カード（RS-062・RS-018・RS-236・RS-078）と同じなので、元カードの公式Q&A を同じく当てはめる。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-PR-NNN.md。ライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-CN-02・R-ADD-06・R-KW-COUNTER）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-PR-NNN …」）で残す。
 * 元カードの cardSpec（RS1-047-070・RS1-001-023.part3・RS4-222-242.c・RS2-071-096.part1）と同じ確かめ方をする。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  act,
  attack,
  canCounter,
  canStartRush,
  canStrike,
  canUseCard,
  deckCards,
  enter,
  expectCatalogText,
  expectOp,
  expectUnit,
  fillers,
  inst,
  legal,
  powerCards,
  released,
  releasedCat,
  rushFromHand,
  rushPhase,
  settle,
  st,
  strike,
  strikeDmg,
  substitutes,
  sUnit,
  useNinja,
  zoneOf,
} from "./PR-001-014.helpers";

const NONMECHA = sUnit("SPEC-BP6000", { bp: 6000 });
const ATK4 = sUnit("SPEC-ATK4", { bp: 4000 });
const BIG = sUnit("SPEC-BIG9", { bp: 9000 });
const RED = sUnit("SPEC-S-RED", { category: "WB", bp: 1000, features: ["レッド"] });
const EXTRA = [NONMECHA, ATK4, BIG, RED];

// ===========================================================================
describe("PR-011 ボウケンレッド（プロモ2）", () => {
  it("PR-011: カタログ本文・スペックが出典と一致（能力名は【サバイバスター】）（出典: atwiki/page-994）", () => {
    expectCatalogText("PR-011", "【サバイバスター】「SP1」これは特徴「メカ」をもつユニットにアタックするとき、BP＋4000される。");
    expectUnit("PR-011", { name: "ボウケンレッド", category: "ET", size: "S", bp: 4000, sp: "special", powerCost: 3, comboNumber: 5, features: ["レッド", "男"], rarity: "PR" });
  });

  const red = (position: 1 | 5, defender: string) =>
    enter(st({ player1: { battle: fillers(position - 1), rush: [inst("PR-011", "r")] }, player2: { battle: [inst(defender, "d")], power: powerCards(3), deck: deckCards(3, "e") } }, EXTRA), "PR-011:r");

  it("PR-011: 5番目で「SP1」を得てストライクで1点（出典: atwiki/page-994「CN：5」）", () => {
    expect(strikeDmg(red(5, "SPEC-BP6000"), "PR-011:r")).toBe(1);
  });

  it("PR-011: 特徴「メカ」のユニット（パトストライカー BP6000）にアタックするとき BP8000 で勝つ（出典: atwiki/page-994）", () => {
    const s = settle(attack(red(5, "RS-043"), "PR-011:r", "RS-043:d"));
    expect(zoneOf(s, "player2", "RS-043:d")).toBe("discard");
    expect(zoneOf(s, "player1", "PR-011:r")).toBe("battle");
  });

  it("PR-011: 「メカ」を持たないユニットにアタックするときは BP+4000 されない（出典: atwiki/page-994）", () => {
    expect(zoneOf(settle(attack(red(5, "SPEC-BP6000"), "PR-011:r", "SPEC-BP6000:d")), "player1", "PR-011:r")).toBe("discard");
  });

  it("PR-011: NC が成立しなければ（1番目）メカにアタックしても BP は上がらない（出典: atwiki/page-994・R-CN-02）", () => {
    expect(zoneOf(settle(attack(red(1, "RS-043"), "PR-011:r", "RS-043:d")), "player1", "PR-011:r")).toBe("discard");
  });

  it("PR-011: 公式Q&A（RS-062 と同じ本文）— 隠流忍術でバトル相手が非メカに変わっても、メカにアタックした BP+4000 は残る（出典: grnrngr/faq-card-1 RS-018）", () => {
    let s = st({
      player1: { battle: fillers(4), rush: [inst("PR-011", "r")] },
      player2: { battle: [inst("RS-089", "rescue"), inst("RS-165", "rouki")], hand: [inst("RS-018", "nin")], command: [released("TST-OP-MA", "ma")], power: powerCards(4), deck: deckCards(3, "e") },
    });
    s = attack(enter(s, "PR-011:r"), "PR-011:r", "RS-089:rescue");
    s = settle(act(s, { type: "initiate_command_payment", playerId: "player2", kind: "category_use", sourceInstanceId: "RS-018:nin", substituteInstanceId: "RS-165:rouki" }));
    expect(zoneOf(s, "player2", "RS-165:rouki")).toBe("discard");
    expect(zoneOf(s, "player1", "PR-011:r")).toBe("battle");
  });
});

// ===========================================================================
describe("PR-012 隠流忍術", () => {
  const N = "PR-012:n";

  it("PR-012: カタログ本文・スペックが出典と一致（出典: atwiki/page-993）", () => {
    expectCatalogText("PR-012", "※カウンター（これは敵軍ターン中にのみ使用できる） 自軍ユニットがアタックされたとき発動できる⇒アタックしてきたユニット以外のユニットをすべての場からユニットを1体選んで、かわりにバトルさせる。");
    expectOp("PR-012", { name: "隠流忍術", category: "MA", powerCost: 4, rarity: "PR" });
  });

  /** player1（自軍ターン）のアタックに、player2 が手札の PR-012 で応じられる盤面。 */
  function ninjaState(o: { p1Battle?: CardInstance[]; p1Rush?: CardInstance[]; p2Battle?: CardInstance[]; p2Rush?: CardInstance[]; p2Hand?: CardInstance[] }): GameState {
    return st(
      {
        phase: "battle",
        player1: { battle: o.p1Battle ?? [], rush: o.p1Rush ?? [], deck: deckCards(3) },
        player2: {
          battle: o.p2Battle ?? [],
          rush: o.p2Rush ?? [],
          hand: o.p2Hand ?? [inst("PR-012", "n")],
          command: [released("TST-OP-MA", "ma"), released("TST-OP-MA", "ma2")],
          power: powerCards(5, "e"),
          deck: deckCards(3, "e"),
        },
      },
      EXTRA,
    );
  }

  it("PR-012: ※カウンター — 自軍ターン中に手札から使用できない（出典: atwiki/page-993「※カウンター（これは敵軍ターン中にのみ使用できる）」）", () => {
    expect(canUseCard(rushPhase({ hand: [inst("PR-012", "op")], power: powerCards(4), command: releasedCat("MA", 1) }), "player1", "PR-012:op")).toBe(false);
  });

  it("PR-012: 自軍ユニットがアタックされたとき、選んだ別のユニットがかわりにバトルする（出典: atwiki/page-993）", () => {
    let s = attack(ninjaState({ p1Battle: [inst("SPEC-ATK4", "atk")], p2Battle: [inst("TST-UNIT-0", "def"), inst("SPEC-BIG9", "sub")] }), "SPEC-ATK4:atk", "TST-UNIT-0:def");
    s = settle(useNinja(s, N, "SPEC-BIG9:sub"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:def")).toBe("battle");
    expect(zoneOf(s, "player2", "SPEC-BIG9:sub")).toBe("battle");
    expect(zoneOf(s, "player1", "SPEC-ATK4:atk")).toBe("discard");
  });

  it("PR-012: 「すべての場から」— 敵軍（アタックした側）のユニットや自軍ラッシュエリアのユニットも選べる（出典: atwiki/page-993「すべての場から」・08-errata R-ERR-RS018）", () => {
    const s = attack(ninjaState({ p1Battle: [inst("SPEC-ATK4", "atk"), inst("TST-UNIT-0", "ally")], p2Battle: [inst("TST-UNIT-0", "def")], p2Rush: [inst("TST-UNIT-0", "myRush")] }), "SPEC-ATK4:atk", "TST-UNIT-0:def");
    const subs = substitutes(s, N);
    expect(subs).toContain("TST-UNIT-0:ally");
    expect(subs).toContain("TST-UNIT-0:myRush");
  });

  it("PR-012: アタックしてきたユニットは選べない（出典: atwiki/page-993「アタックしてきたユニット以外の」・RS-018 Q13）", () => {
    const s = attack(ninjaState({ p1Battle: [inst("SPEC-ATK4", "atk")], p2Battle: [inst("TST-UNIT-0", "def"), inst("TST-UNIT-0", "x")] }), "SPEC-ATK4:atk", "TST-UNIT-0:def");
    expect(substitutes(s, N)).not.toContain("SPEC-ATK4:atk");
  });

  it("PR-012: 公式Q&A（RS-018 と同じ本文）— 1回のアタックに対してカウンターを2枚以上使用できる（出典: grnrngr/faq-card-1 RS-018・atwiki/page-242 Q1）", () => {
    let s = attack(
      ninjaState({ p1Battle: [inst("SPEC-ATK4", "atk")], p2Battle: [inst("TST-UNIT-0", "def"), inst("SPEC-BIG9", "sub")], p2Hand: [inst("PR-012", "n"), inst("PR-012", "n2")] }),
      "SPEC-ATK4:atk",
      "TST-UNIT-0:def",
    );
    s = useNinja(s, N, "SPEC-BIG9:sub");
    expect(canCounter(s, "PR-012:n2", "player2")).toBe(true);
  });

  it("PR-012: 公式Q&A（RS-018 と同じ本文）— レジストを持つユニット（XP-024）を選んでバトルで撃破されたら、レジストできる（出典: grnrngr/faq-card-1 RS-018・atwiki/page-242 Q2）", () => {
    let s = attack(ninjaState({ p1Battle: [inst("SPEC-BIG9", "atk")], p2Battle: [inst("TST-UNIT-0", "def"), inst("XP-024", "r")] }), "SPEC-BIG9:atk", "TST-UNIT-0:def");
    s = useNinja(s, N, "XP-024:r");
    for (let i = 0; i < 6 && !legal(s).some((a) => a.type === "use_register"); i += 1) {
      const pass = legal(s).find((a) => a.type.startsWith("pass_") && a.type !== "pass_register");
      if (!pass) break;
      s = act(s, pass);
    }
    expect(legal(s).some((a) => a.type === "use_register" && a.playerId === "player2")).toBe(true);
  });

  it("PR-012: 公式Q&A（RS-018 と同じ本文）— 「航空機」を持たないアタッカーとジェットファルコンをバトルさせられる（出典: grnrngr/faq-card-1 RS-018・atwiki/page-242 Q8）", () => {
    let s = attack(ninjaState({ p1Battle: [inst("SPEC-ATK4", "atk")], p2Battle: [inst("TST-UNIT-0", "def"), inst("RS-135", "jet")] }), "SPEC-ATK4:atk", "TST-UNIT-0:def");
    expect(substitutes(s, N)).toContain("RS-135:jet");
    s = settle(useNinja(s, N, "RS-135:jet"));
    expect(zoneOf(s, "player2", "RS-135:jet")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:def")).toBe("battle");
  });

  it("PR-012: 公式Q&A（RS-018 と同じ本文）— ファイブテクターでストライクをバトルに変えても、隠流忍術は使えない（出典: grnrngr/faq-card-1 RS-018・atwiki/page-242 Q9）", () => {
    let s = st(
      {
        phase: "battle",
        player1: { battle: [inst("TST-UNIT-0", "striker")] },
        player2: { operation: [inst("RS-014", "ft")], rush: [inst("TST-UNIT-0", "g")], battle: [inst("SPEC-BIG9", "o")], hand: [inst("PR-012", "n")], command: [released("TST-OP-MA", "ma")], power: powerCards(5, "e") },
      },
      EXTRA,
    );
    s = strike(s, "TST-UNIT-0:striker");
    const icp = legal(s).find((a) => a.type === "five_tech_intercept" && a.interceptInstanceId === "TST-UNIT-0:g");
    expect(icp).toBeDefined();
    s = act(s, icp!);
    expect(canCounter(s, N, "player2")).toBe(false);
  });

  it("PR-012: 公式Q&A（RS-018 と同じ本文）— ガオシャークが敵軍ラッシュエリアの S ユニットにアタックしたとき、バトルエリアの S ユニットをかわりにバトルさせられる（出典: grnrngr/faq-card-1 RS-018・atwiki/page-242 Q10）", () => {
    const s = attack(ninjaState({ p1Battle: [inst("RS-154", "shark")], p2Rush: [inst("TST-UNIT-0", "rushS")], p2Battle: [inst("TST-UNIT-7", "battleS")] }), "RS-154:shark", "TST-UNIT-0:rushS");
    expect(substitutes(s, N)).toContain("TST-UNIT-7:battleS");
  });

  it("PR-012: 公式Q&A（RS-018 と同じ本文）— 変わるのはバトルの対象のみ。メカにアタックしたボウケンレッドの BP+4000 は残る（出典: grnrngr/faq-card-1 RS-018・atwiki/page-242 Q11）", () => {
    let s = ninjaState({ p1Battle: fillers(4, "f"), p1Rush: [inst("RS-062", "red")], p2Battle: [inst("RS-089", "rescue"), inst("RS-165", "rouki")] });
    s = attack(enter(s, "RS-062:red"), "RS-062:red", "RS-089:rescue");
    s = settle(useNinja(s, N, "RS-165:rouki"));
    expect(zoneOf(s, "player2", "RS-165:rouki")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-062:red")).toBe("battle");
  });

  it.todo(
    "PR-012: 公式Q&A（RS-018 と同じ本文）— ジョイントコンビネーションしたユニットやそのLユニットを選べる／JC 中のバキケロナグルスが撃破されても L ユニットの効果は残る（出典: grnrngr/faq-card-1 RS-018・atwiki/page-242 Q5〜Q7）— ジョイントコンビネーション成立状態を公開 API で組み立てられない（RS1-001-023.part3 の RS-018 と同じ）",
  );
});

// ===========================================================================
describe("PR-013 スーパーダイボウケン", () => {
  const TEXT =
    "合体―ダイボウケン（または、ゴーゴーダンプ＋ゴーゴーフォーミュラ＋ゴーゴージャイロ＋ゴーゴードーザー＋ゴーゴーマリン）＋ゴーゴードリル＋ゴーゴーショベル＋ゴーゴーミキサー＋ゴーゴークレーン 【ダブルアームクラッシュ】これはアタックとストライクを1度ずつ行ってもよい。";

  it("PR-013: カタログ本文・スペックが出典と一致（出典: atwiki/page-991）", () => {
    expectCatalogText("PR-013", TEXT);
    expectUnit("PR-013", { name: "スーパーダイボウケン", category: "ET", size: "L", bp: 23000, sp: 3, powerCost: "7+", features: ["メカ", "人型"], rushCondition: "discard_fusion_unit", rarity: "PR" });
  });

  const FOUR = ["RS-171", "RS-172", "RS-173", "RS-174"];
  const sdbRush = (rush: CardInstance[], power = 7) => st({ phase: "rush", player1: { hand: [inst("PR-013", "sdb")], rush, command: [released("TST-OP-ET", "et")], power: powerCards(power) } });

  it("PR-013: ダイボウケン＋ドリル・ショベル・ミキサー・クレーンを捨札にしてラッシュできる（出典: atwiki/page-991・R-ADD-06）", () => {
    const r = rushFromHand(sdbRush([inst("RS-117", "db"), ...FOUR.map((id) => inst(id, "m"))]), "player1", "PR-013:sdb");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "PR-013:sdb")).toBe("rush");
    expect(r.state.players.player1.discard).toHaveLength(5);
  });

  it("PR-013: 「ダイボウケン」の再録（PR-002）も素材にできる（出典: atwiki/page-991「ダイボウケン」・カード名で判定）", () => {
    const r = rushFromHand(sdbRush([inst("PR-002", "db"), ...FOUR.map((id) => inst(id, "m"))]), "player1", "PR-013:sdb");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "PR-002:db")).toBe("discard");
  });

  it.fails("PR-013: ダイボウケンのかわりにダンプ・フォーミュラ・ジャイロ・ドーザー・マリンの5体でもラッシュできる（出典: atwiki/page-991「（または、…）」） — 既知の不具合: CARD-PR-013 再録（RS-236）の合体で「（または、ゴーゴーダンプ＋…＋ゴーゴーマリン）」の5体を素材にできない", () => {
    const five = ["RS-118", "RS-119", "RS-120", "RS-121", "RS-122"].map((id) => inst(id, "v"));
    const r = rushFromHand(sdbRush([...five, ...FOUR.map((id) => inst(id, "m"))]), "player1", "PR-013:sdb");
    expect(r.ok, r.error).toBe(true);
    expect(r.state.players.player1.discard).toHaveLength(9);
  });

  it("PR-013: 合体ユニットが1体でも欠けて（クレーンがない）いればラッシュできない／パワー6でもできない（出典: atwiki/page-991「必要パワー：7+」）", () => {
    expect(canStartRush(sdbRush([inst("RS-117", "db"), ...FOUR.slice(0, 3).map((id) => inst(id, "m"))]), "player1", "PR-013:sdb")).toBe(false);
    expect(rushFromHand(sdbRush([inst("RS-117", "db"), ...FOUR.map((id) => inst(id, "m"))], 6), "player1", "PR-013:sdb").ok).toBe(false);
  });

  const onField = () => enter(st({ player1: { rush: [inst("PR-013", "sdb")] }, player2: { battle: [inst("TST-UNIT-0", "e")], power: powerCards(5, "ep") } }), "PR-013:sdb");

  it("PR-013: 【ダブルアームクラッシュ】アタックした後にストライクもできる（SP3 で3点）（出典: atwiki/page-991）", () => {
    let s = settle(attack(onField(), "PR-013:sdb", "TST-UNIT-0:e"));
    expect(canStrike(s, "PR-013:sdb")).toBe(true);
    s = settle(strike(s, "PR-013:sdb"));
    expect(s.players.player2.damage).toBe(3);
    expect(canStrike(s, "PR-013:sdb")).toBe(false);
  });

  it("PR-013: 【ダブルアームクラッシュ】ストライクした後にアタックもできる（出典: atwiki/page-991）", () => {
    const s = settle(strike(onField(), "PR-013:sdb"));
    expect(legal(s).some((a) => a.type === "battle" && a.attackerInstanceId === "PR-013:sdb")).toBe(true);
  });

  it.todo(
    "PR-013: 公式Q&A（RS-236 と同じ本文）— 魔法猫スモーキーで出したダイボウケンを素材にしたスーパーダイボウケンは、ターンを終えるとき捨札にならない（出典: grnrngr/faq-card-4 RS-236 Q1）— スモーキー（RS-326）→キリンレンジャー（RS-208）の時間返しの流れを公開 API で組み立てられない（RS4-222-242.c の RS-236 と同じ）",
  );
});

// ===========================================================================
describe("PR-014 ダークナイト", () => {
  it("PR-014: カタログ本文・スペックが出典と一致（出典: atwiki/page-990）", () => {
    expectCatalogText("PR-014", "【闇の舞】敵軍ラッシュエリアか敵軍バトルエリアに特徴「レッド」を持つユニットがあるとき、このユニットは次の能力を得る。⇒SP1");
    expectUnit("PR-014", { name: "ダークナイト", category: "DA", size: "S", bp: 4000, sp: "special", powerCost: 5, features: ["有尾人一族", "男"], rarity: "PR" });
  });

  const knight = (p1: Partial<GameState["players"]["player1"]>, p2: Partial<GameState["players"]["player2"]>) =>
    st({ player1: { battle: [inst("PR-014", "dk")], ...p1 }, player2: { power: powerCards(3, "e"), ...p2 } }, EXTRA);

  it("PR-014: 【闇の舞】敵軍ラッシュエリアに特徴「レッド」のユニットがあれば SP1（ストライクで1点）（出典: atwiki/page-990）", () => {
    expect(strikeDmg(knight({}, { rush: [inst("SPEC-S-RED", "r")] }), "PR-014:dk")).toBe(1);
  });

  it("PR-014: 【闇の舞】敵軍バトルエリアに特徴「レッド」のユニットがあっても SP1（出典: atwiki/page-990）", () => {
    expect(canStrike(knight({}, { battle: [inst("SPEC-S-RED", "r")] }), "PR-014:dk")).toBe(true);
  });

  it("PR-014: 敵軍にレッドがいなければストライクできない（出典: atwiki/page-990「SP：！」）", () => {
    expect(canStrike(knight({}, { rush: [inst("TST-UNIT-0", "x")] }), "PR-014:dk")).toBe(false);
  });

  it("PR-014: 自軍のレッドや、敵軍コマンドゾーンのレッドのカードは条件にならない（出典: atwiki/page-990「敵軍ラッシュエリアか敵軍バトルエリア」）", () => {
    expect(canStrike(knight({ rush: [inst("SPEC-S-RED", "own")] }, {}), "PR-014:dk")).toBe(false);
    expect(canStrike(knight({}, { command: [released("SPEC-S-RED", "cmd")] }), "PR-014:dk")).toBe(false);
  });
});
