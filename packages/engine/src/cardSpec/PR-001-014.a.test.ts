/**
 * カード別スペック: PR-001〜PR-005（プロモーションカード ボウケンレッド〜デカレンジャーロボ）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（R-ERR-RS030 アドベンチャー）。grnrngr/faq-card-plomo（PR-003 は「RS-030 アドベンチャー」の項、
 *     PR-004 は「RS-031 バルイーグル」の項を参照するよう書かれている）。そのため元カードの公式Q&A（faq-card-1 RS-030・RS-031）を当てはめる。
 *     PR-001・PR-002・PR-005 も本文が元カード（RS-062・RS-117・RS-042）と同じ（能力名だけ違う）なので、元カードの公式Q&A を同じく当てはめる。
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-PR-NNN.md。ライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-CN-02・R-ADD-06・R-KW-PERM-01）・atwiki のカード評価
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-PR-NNN …」）で残す。
 * 元カードの cardSpec（RS1-047-070・RS2-097-122.c・RS1-024-046.ops / units-a / units-b）と同じ確かめ方をする。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameState } from "../types/game";
import {
  act,
  attack,
  bpOf,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  deckCards,
  endTurn,
  endWithChoices,
  enter,
  expectCatalogText,
  expectOp,
  expectUnit,
  fillers,
  held,
  inst,
  legal,
  passEntry,
  pick,
  playOp,
  powerCards,
  released,
  releasedCat,
  releasedN,
  resolveAll,
  rushFromHand,
  rushPhase,
  settle,
  st,
  strikeDmg,
  sUnit,
  zoneOf,
} from "./PR-001-014.helpers";

const NONMECHA = sUnit("SPEC-BP6000", { bp: 6000 });
const BIG = sUnit("SPEC-BIG", { size: "L", bp: 19000 } as never);
const EXTRA = [NONMECHA, BIG];

// ===========================================================================
describe("PR-001 ボウケンレッド（プロモ1）", () => {
  it("PR-001: カタログ本文・スペックが出典と一致（能力名は【アクセルラー】）（出典: atwiki/page-995）", () => {
    expectCatalogText("PR-001", "【アクセルラー】「SP1」これは特徴「メカ」をもつユニットにアタックするとき、BP＋4000される。");
    expectUnit("PR-001", { name: "ボウケンレッド", category: "ET", size: "S", bp: 4000, sp: "special", powerCost: 3, comboNumber: 5, features: ["レッド", "男"], rarity: "PR" });
  });

  function red(position: 1 | 5, defender: string) {
    const s = st(
      {
        player1: { battle: fillers(position - 1), rush: [inst("PR-001", "r")] },
        player2: { battle: [inst(defender, "d")], power: powerCards(3), deck: deckCards(3, "e") },
      },
      EXTRA,
    );
    return enter(s, "PR-001:r");
  }

  it.fails("PR-001: 5番目で「SP1」を得てストライクで1点（出典: atwiki/page-995「CN：5」） — 既知の不具合: CARD-PR-001 再録（RS-062）の【アクセルラー】（NC の「SP1」・メカへのアタック時 BP+4000）が未実装", () => {
    expect(strikeDmg(red(5, "SPEC-BP6000"), "PR-001:r")).toBe(1);
  });

  it.fails("PR-001: 特徴「メカ」のユニット（パトストライカー BP6000）にアタックするとき BP8000 で勝つ（出典: atwiki/page-995） — 既知の不具合: CARD-PR-001 再録（RS-062）の【アクセルラー】（NC の「SP1」・メカへのアタック時 BP+4000）が未実装", () => {
    const s = settle(attack(red(5, "RS-043"), "PR-001:r", "RS-043:d"));
    expect(zoneOf(s, "player2", "RS-043:d")).toBe("discard");
    expect(zoneOf(s, "player1", "PR-001:r")).toBe("battle");
  });

  it("PR-001: 「メカ」を持たないユニットにアタックするときは BP+4000 されない（出典: atwiki/page-995）", () => {
    const s = settle(attack(red(5, "SPEC-BP6000"), "PR-001:r", "SPEC-BP6000:d"));
    expect(zoneOf(s, "player1", "PR-001:r")).toBe("discard");
  });

  it("PR-001: NC が成立しなければ（1番目）メカにアタックしても BP は上がらない（出典: atwiki/page-995・R-CN-02）", () => {
    const s = settle(attack(red(1, "RS-043"), "PR-001:r", "RS-043:d"));
    expect(zoneOf(s, "player1", "PR-001:r")).toBe("discard");
  });

  it.fails("PR-001: 公式Q&A（RS-062 と同じ本文）— 隠流忍術でバトル相手が非メカに変わっても、メカにアタックした BP+4000 は残る（出典: grnrngr/faq-card-1 RS-018） — 既知の不具合: CARD-PR-001 再録（RS-062）の【アクセルラー】（NC の「SP1」・メカへのアタック時 BP+4000）が未実装", () => {
    let s = st({
      player1: { battle: fillers(4), rush: [inst("PR-001", "r")] },
      player2: { battle: [inst("RS-089", "rescue"), inst("RS-165", "rouki")], hand: [inst("RS-018", "nin")], command: [released("TST-OP-MA", "ma")], power: powerCards(4), deck: deckCards(3, "e") },
    });
    s = enter(s, "PR-001:r");
    s = attack(s, "PR-001:r", "RS-089:rescue");
    s = act(s, { type: "initiate_command_payment", playerId: "player2", kind: "category_use", sourceInstanceId: "RS-018:nin", substituteInstanceId: "RS-165:rouki" });
    s = settle(s);
    expect(zoneOf(s, "player2", "RS-165:rouki")).toBe("discard");
    expect(zoneOf(s, "player1", "PR-001:r")).toBe("battle");
  });
});

// ===========================================================================
describe("PR-002 ダイボウケン", () => {
  it("PR-002: カタログ本文・スペックが出典と一致（能力名は【ゴースコッパー＆ゴービッカー】）（出典: atwiki/page-996）", () => {
    expectCatalogText(
      "PR-002",
      "合体―ゴーゴーダンプ＋ゴーゴーフォーミュラ＋ゴーゴージャイロ＋ゴーゴードーザー＋ゴーゴーマリン 【ゴースコッパー＆ゴービッカー】これはアタックするときBP＋4000される。",
    );
    expectUnit("PR-002", { name: "ダイボウケン", category: "ET", size: "L", bp: 16000, sp: 1, powerCost: "7+", features: ["メカ", "人型"], rushCondition: "discard_fusion_unit", rarity: "PR" });
  });

  it("PR-002: アタックするとき BP+4000（16000+4000 で BP19000 に勝つ）（出典: atwiki/page-996）", () => {
    let s = st({ player1: { rush: [inst("PR-002", "db")] }, player2: { battle: [inst("SPEC-BIG", "big")] } }, EXTRA);
    s = settle(attack(enter(s, "PR-002:db"), "PR-002:db", "SPEC-BIG:big"));
    expect(zoneOf(s, "player2", "SPEC-BIG:big")).toBe("discard");
    expect(zoneOf(s, "player1", "PR-002:db")).toBe("battle");
  });

  it("PR-002: アタックされたとき（防御側）は BP+4000 されない（出典: atwiki/page-996「アタックするとき」）", () => {
    const s = settle(attack(st({ player1: { battle: [inst("SPEC-BIG", "big")] }, player2: { battle: [inst("PR-002", "db")] } }, EXTRA), "SPEC-BIG:big", "PR-002:db"));
    expect(zoneOf(s, "player2", "PR-002:db")).toBe("discard");
  });

  it("PR-002: 合体ユニット（ゴーゴーダンプ〜ゴーゴーマリンの5体）をすべて捨札にしてラッシュでき、4体では満たせない（出典: atwiki/page-996・R-ADD-06）", () => {
    const five = ["RS-118", "RS-119", "RS-120", "RS-121", "RS-122"].map((id) => inst(id, "m"));
    const mk = (rush: CardInstance[]) => st({ phase: "rush", player1: { hand: [inst("PR-002", "db")], rush, command: releasedN(2, "TST-OP-ET", "et"), power: powerCards(7) } });
    expect(canStartRush(mk(five.slice(0, 4)), "player1", "PR-002:db")).toBe(false);
    const r = rushFromHand(mk(five), "player1", "PR-002:db");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "PR-002:db")).toBe("rush");
    expect(r.state.players.player1.discard).toHaveLength(5);
  });

  it.todo(
    "PR-002: 公式Q&A（RS-117 と同じ本文）— スモーキーで出したダイボウケンを素材にスーパーダイボウケンをラッシュした場合、ターン終了時にスーパーダイボウケンは捨札にならない（出典: grnrngr/faq-card-2 RS-117 Q1）— RS-326 魔法猫スモーキーと RS-208 キリンレンジャー「時間返し」の組み合わせを公開 API で再現できない（RS2-097-122.c の RS-117 と同じ）",
  );
});

// ===========================================================================
describe("PR-003 アドベンチャー", () => {
  it("PR-003: カタログ本文・スペックが出典と一致（出典: atwiki/page-997）", () => {
    expectCatalogText("PR-003", "※常駐（場に配置して、離れるまで効果が有効になる） 自分も相手も次の制限を受ける。ターンを終えるときホールド状態のコマンドを1つ選んで手札に戻す。");
    expectOp("PR-003", { name: "アドベンチャー", category: "ET", powerCost: 3, rarity: "PR" });
  });

  it("PR-003: ※常駐 — 使うと常駐置き場に置かれる（出典: atwiki/page-997「※常駐（場に配置して、離れるまで効果が有効になる）」）", () => {
    const r = playOp(rushPhase({ hand: [inst("PR-003", "adv")], command: releasedCat("ET", 1), power: powerCards(3) }), "player1", "PR-003:adv");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(resolveAll(r.state), "player1", "PR-003:adv")).toBe("operation");
  });

  // ターンを終えたプレイヤーが、自分のホールド状態のコマンドを戻す（R-ERR-RS030 の修正後の読み・faq-card-1 RS-030 Q2）。
  it.fails("PR-003: 自分のターンを終えるとき、自分のホールド状態のコマンドを1つ手札に戻す（出典: atwiki/page-997・08-errata R-ERR-RS030） — 既知の不具合: CARD-PR-003 再録（RS-030）の常駐（ターンを終えるときホールド状態のコマンドを手札に戻す）が働かない", () => {
    const next = endWithChoices(st({ phase: "end", player1: { operation: [inst("PR-003", "adv")], command: [held("TST-OP", "h1"), held("TST-OP", "h2"), released("TST-OP", "r")] } }));
    expect(next.players.player1.hand).toHaveLength(1);
    expect(next.players.player1.command).toHaveLength(2);
    expect(zoneOf(next, "player1", "TST-OP:r")).toBe("command");
  });

  it.fails("PR-003: 相手が配置したアドベンチャーでも、自分のターン終了時に自分のコマンドを戻す（出典: atwiki/page-997「自分も相手も次の制限を受ける」） — 既知の不具合: CARD-PR-003 再録（RS-030）の常駐（ターンを終えるときホールド状態のコマンドを手札に戻す）が働かない", () => {
    const next = endWithChoices(st({ phase: "end", player1: { command: [held("TST-OP", "h1")] }, player2: { operation: [inst("PR-003", "adv")] } }));
    expect(zoneOf(next, "player1", "TST-OP:h1")).toBe("hand");
  });

  it("PR-003: ホールド状態のコマンドがなければ何も戻さない（出典: atwiki/page-997「ホールド状態のコマンド」）", () => {
    const next = endWithChoices(st({ phase: "end", player1: { operation: [inst("PR-003", "adv")], command: [released("TST-OP", "r")] } }));
    expect(next.players.player1.hand).toHaveLength(0);
    expect(zoneOf(next, "player1", "TST-OP:r")).toBe("command");
  });

  it.fails("PR-003: 公式Q&A — 自分も相手も常駐していれば効果は重複し、ターンを終えたプレイヤーが2つ戻す（出典: grnrngr/faq-card-plomo PR-003 →faq-card-1 RS-030 Q1） — 既知の不具合: CARD-PR-003 再録（RS-030）の常駐（ターンを終えるときホールド状態のコマンドを手札に戻す）が働かない", () => {
    const next = endWithChoices(
      st({
        phase: "end",
        player1: { operation: [inst("PR-003", "adv1")], command: [held("TST-OP", "h1"), held("TST-OP", "h2"), held("TST-OP", "h3")] },
        player2: { operation: [inst("PR-003", "adv2")], command: [held("TST-OP-ET", "o1")] },
      }),
    );
    expect(next.players.player1.hand).toHaveLength(2);
    expect(zoneOf(next, "player2", "TST-OP-ET:o1")).toBe("command");
  });

  it.fails("PR-003: 公式Q&A — 元の RS-030 と並べても重複する（同じ「アドベンチャー」）（出典: grnrngr/faq-card-plomo PR-003 →faq-card-1 RS-030 Q1） — 既知の不具合: CARD-PR-003 再録（RS-030）の常駐（ターンを終えるときホールド状態のコマンドを手札に戻す）が働かない", () => {
    const next = endWithChoices(
      st({ phase: "end", player1: { operation: [inst("PR-003", "adv1")], command: [held("TST-OP", "h1"), held("TST-OP", "h2"), held("TST-OP", "h3")] }, player2: { operation: [inst("RS-030", "adv2")] } }),
    );
    expect(next.players.player1.hand).toHaveLength(2);
  });

  it.fails("PR-003: 公式Q&A — 重複していてもホールド状態が1枚しかなければその1枚だけ戻す（出典: grnrngr/faq-card-plomo PR-003 →faq-card-1 RS-030 Q1） — 既知の不具合: CARD-PR-003 再録（RS-030）の常駐（ターンを終えるときホールド状態のコマンドを手札に戻す）が働かない", () => {
    const next = endWithChoices(st({ phase: "end", player1: { operation: [inst("PR-003", "adv1")], command: [held("TST-OP", "h1")] }, player2: { operation: [inst("PR-003", "adv2")] } }));
    expect(next.players.player1.hand).toHaveLength(1);
    expect(next.players.player1.command).toHaveLength(0);
  });

  it("PR-003: 公式Q&A — 相手がターンを終えるとき、自分（ターンを終えないプレイヤー）はコマンドを戻さない（出典: grnrngr/faq-card-plomo PR-003 →faq-card-1 RS-030 Q2「ターンを終えたプレイヤーのみ行います」）", () => {
    const next = endWithChoices(st({ phase: "end", player1: { operation: [inst("PR-003", "adv")], command: [held("TST-OP", "h1")] }, player2: { command: [held("TST-OP-ET", "o1")] } }));
    expect(zoneOf(next, "player2", "TST-OP-ET:o1")).toBe("command");
    expect(next.players.player2.hand).toHaveLength(0);
  });
});

// ===========================================================================
describe("PR-004 バルイーグル", () => {
  it("PR-004: カタログ本文・スペックが出典と一致（能力名は【秘剣流れ十文字斬り】）（出典: atwiki/page-998）", () => {
    expectCatalogText("PR-004", "【秘剣流れ十文字斬り】SP1 このターン、これはBP＋2000される。（この効果は「バルシャーク」または「バルパンサー」からコンビネーションするときはナンバーに関係なく発動する）");
    expectUnit("PR-004", { name: "バルイーグル", category: "ET", size: "S", bp: 3000, sp: "special", powerCost: 4, comboNumber: 5, features: ["レッド", "男"], rarity: "PR" });
  });

  const eagleAfter = (battle: CardInstance[]) => enter(st({ player1: { rush: [inst("PR-004", "eagle")], battle } }), "PR-004:eagle");

  it.fails("PR-004: 5番目に出ると SP1 になり、このターン BP＋2000（出典: atwiki/page-998・R-CN-02） — 既知の不具合: CARD-PR-004 再録（RS-031）の【秘剣流れ十文字斬り】（「SP1」・BP+2000・バルシャーク／バルパンサーからのコンビネーション）が未実装", () => {
    const s = eagleAfter(fillers(4));
    expect(canStrike(s, "PR-004:eagle")).toBe(true);
    expect(bpOf(s, "player1", "PR-004:eagle")).toBe(5000);
  });

  it("PR-004: 5番目でなく、左隣もバルシャーク／バルパンサーでなければ発動しない（SP！のまま）（出典: R-CN-02）", () => {
    const s = eagleAfter(fillers(2));
    expect(canStrike(s, "PR-004:eagle")).toBe(false);
    expect(bpOf(s, "player1", "PR-004:eagle")).toBe(3000);
  });

  it.fails("PR-004: バルシャークからコンビネーションすると番号に関係なく発動する（2番目）（出典: atwiki/page-998「ナンバーに関係なく発動する」） — 既知の不具合: CARD-PR-004 再録（RS-031）の【秘剣流れ十文字斬り】（「SP1」・BP+2000・バルシャーク／バルパンサーからのコンビネーション）が未実装", () => {
    const s = eagleAfter([inst("RS-032", "shark")]);
    expect(canStrike(s, "PR-004:eagle")).toBe(true);
    expect(bpOf(s, "player1", "PR-004:eagle")).toBe(5000);
  });

  it.fails("PR-004: バルパンサーからコンビネーションしても番号に関係なく発動する（3番目）（出典: atwiki/page-998） — 既知の不具合: CARD-PR-004 再録（RS-031）の【秘剣流れ十文字斬り】（「SP1」・BP+2000・バルシャーク／バルパンサーからのコンビネーション）が未実装", () => {
    expect(canStrike(eagleAfter([inst("TST-UNIT-0", "x"), inst("RS-033", "panther")]), "PR-004:eagle")).toBe(true);
  });

  it("PR-004: 公式Q&A — 1番目がバルシャークでも、間に別のユニットがあれば発動しない（出典: grnrngr/faq-card-plomo PR-004 →faq-card-1 RS-031 Q1）", () => {
    const s = eagleAfter([inst("RS-032", "shark"), inst("TST-UNIT-0", "mid")]);
    expect(canStrike(s, "PR-004:eagle")).toBe(false);
    expect(bpOf(s, "player1", "PR-004:eagle")).toBe(3000);
  });

  it("PR-004: 公式Q&A — 「このターン」なので、次の相手ターン中は BP＋2000 されていない（出典: grnrngr/faq-card-plomo PR-004 →faq-card-1 RS-031 Q2）", () => {
    const s = endTurn(passEntry(eagleAfter(fillers(4))));
    expect(s.activePlayer).toBe("player2");
    expect(bpOf(s, "player1", "PR-004:eagle")).toBe(3000);
  });
});

// ===========================================================================
describe("PR-005 デカレンジャーロボ", () => {
  const PAT_PARTS = ["RS-043", "RS-044", "RS-045", "RS-046", "RS-047"];

  it("PR-005: カタログ本文・スペックが出典と一致（出典: atwiki/page-1003）", () => {
    expectCatalogText(
      "PR-005",
      "合体―パトストライカー＋パトジャイラー＋パトレーラー＋パトアーマー＋パトシグナー 【ジャスティスフラッシャー】自軍パワーゾーンからダメージ以外のカードを5枚選び捨札にしてもよい。そうしたとき、このターン、このユニットは次の能力を得る⇒「SP3」",
    );
    expectUnit("PR-005", {
      name: "デカレンジャーロボ",
      category: "OT",
      size: "L",
      bp: 19000,
      sp: 2,
      powerCost: "8+",
      features: ["メカ", "人型"],
      rushConditionText: "自軍合体ユニットを捨札にする",
      rarity: "PR",
    });
  });

  const robo = (power: CardInstance[]) => enter(st({ player1: { rush: [inst("PR-005", "robo")], power }, player2: { power: powerCards(3, "opp"), deck: deckCards(3, "od") } }), "PR-005:robo");
  const damageCard = (suffix: string): CardInstance => ({ ...inst("TST-P", suffix), faceDown: true });
  const choosePowers = (s0: GameState, n: number) => {
    let s = s0;
    for (let i = 0; i < n && s.pendingEffectChoice?.sourceCardId === "PR-005"; i++) s = pick(s, choiceIds(s)[0]!);
    return s;
  };

  it("PR-005: 合体に列挙された5体を自軍エリアから捨札にしてラッシュでき、パトシグナーが欠けるとラッシュできない（出典: atwiki/page-1003・R-ADD-06）", () => {
    const mk = (ids: string[]) => rushPhase({ hand: [inst("PR-005", "robo")], rush: ids.map((id, i) => inst(id, `p${i}`)), power: powerCards(8), command: releasedCat("OT", 1) });
    expect(canStartRush(mk(PAT_PARTS.slice(0, 4)), "player1", "PR-005:robo")).toBe(false);
    const r = rushFromHand(mk(PAT_PARTS), "player1", "PR-005:robo");
    expect(r.ok, r.error).toBe(true);
    expect(zoneOf(r.state, "player1", "PR-005:robo")).toBe("rush");
    for (let i = 0; i < 5; i++) expect(zoneOf(r.state, "player1", `${PAT_PARTS[i]}:p${i}`)).toBe("discard");
  });

  it("PR-005: 何もしなければ SP2 でストライクし2点（出典: atwiki/page-1003「SP：2」）", () => {
    let s = robo(powerCards(5));
    if (s.pendingEffectChoice?.sourceCardId === "PR-005") s = act(s, { type: "skip_effect_choice", playerId: "player1" });
    expect(strikeDmg(s, "PR-005:robo")).toBe(2);
  });

  it.fails("PR-005: 【ジャスティスフラッシャー】発動は任意 — バトルエリアに出たとき選ばずに済ませられる（出典: atwiki/page-1003「捨札にしてもよい」） — 既知の不具合: CARD-PR-005 再録（RS-042）の【ジャスティスフラッシャー】が未実装", () => {
    const s = robo(powerCards(5));
    expect(s.pendingEffectChoice?.sourceCardId).toBe("PR-005");
    expect(canSkip(s)).toBe(true);
  });

  it.fails("PR-005: 【ジャスティスフラッシャー】ダメージ以外のパワー5枚を捨札にすると、このターン「SP3」— ストライクはちょうど3点（出典: atwiki/page-1003） — 既知の不具合: CARD-PR-005 再録（RS-042）の【ジャスティスフラッシャー】が未実装", () => {
    const s = choosePowers(robo(powerCards(5)), 5);
    expect(s.players.player1.power).toHaveLength(0);
    expect(s.players.player1.discard.filter((c) => c.cardId === "TST-P")).toHaveLength(5);
    expect(strikeDmg(s, "PR-005:robo")).toBe(3);
  });

  it("PR-005: 【ジャスティスフラッシャー】ダメージのカード（ウラ向き）は選べない（出典: atwiki/page-1003「ダメージ以外のカード」）", () => {
    expect(choiceIds(robo([...powerCards(5), damageCard("dmg")]))).not.toContain("TST-P:dmg");
  });

  it("PR-005: 【ジャスティスフラッシャー】ダメージ以外のカードが4枚しかなければ発動できない（出典: atwiki/page-1003「5枚選び」）", () => {
    expect(robo([...powerCards(4), damageCard("dmg")]).pendingEffectChoice?.sourceCardId).not.toBe("PR-005");
  });

  it.fails("PR-005: 公式Q&A（RS-042 と同じ本文）— SP を得る効果は自軍バトルフェイズ中に発動できる（出たときに見送っても同じバトルフェイズ中に発動できる）（出典: grnrngr/faq-card-1 RS-051 Q3） — 既知の不具合: CARD-PR-005 再録（RS-042）の【ジャスティスフラッシャー】が未実装", () => {
    let s = act(robo(powerCards(5)), { type: "skip_effect_choice", playerId: "player1" });
    s = passEntry(s);
    const offered = legal(s).some(
      (a) => (a.type === "activate_field_unit_ability" && a.unitInstanceId === "PR-005:robo") || (a.type === "resolve_effect_choice" && s.pendingEffectChoice?.sourceCardId === "PR-005"),
    );
    expect(offered).toBe(true);
  });

  it("PR-005: 自軍バトルフェイズ以外（ラッシュフェイズ）には発動できない（出典: grnrngr/faq-card-1 RS-051 Q3「それ以外のタイミングでは発動できません」）", () => {
    const r = rushFromHand(rushPhase({ hand: [inst("PR-005", "robo")], rush: PAT_PARTS.map((id, i) => inst(id, `p${i}`)), power: powerCards(13), command: releasedCat("OT", 1) }), "player1", "PR-005:robo");
    expect(r.ok, r.error).toBe(true);
    expect(r.state.pendingEffectChoice?.sourceCardId).not.toBe("PR-005");
    expect(legal(r.state).some((a) => a.type === "activate_field_unit_ability" && a.unitInstanceId === "PR-005:robo")).toBe(false);
  });
});

