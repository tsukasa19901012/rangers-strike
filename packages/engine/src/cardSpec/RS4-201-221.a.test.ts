/**
 * カード別スペック: RS-201〜RS-207（第4弾「四雄の覚醒」）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-4
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_4.html）ほか card_1/2/3/5/6/8・rider_1/2 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  advanceToBattle,
  attack,
  attackTargets,
  bpOf,
  canDecline,
  canStartRush,
  canStrike,
  choiceIds,
  confirmIfAsked,
  countS,
  decline,
  deckCards,
  drain,
  endTurn,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  inst,
  legal,
  passEntry,
  pick,
  powerCards,
  releasedN,
  rushWithMaterial,
  settle,
  st,
  strike,
  sUnit,
  zoneOf,
} from "./RS4-201-221.helpers";
import type { GameState } from "../types/game";

// ===========================================================================
describe("RS-201 イエローフォー", () => {
  const TEXT =
    "【超電子ホログラフィー】自軍山札を見る。そして、オペレーションのカードがあれば1枚選び、自軍パワーゾーンに置く。その後、山札をシャッフルする。";

  it("RS-201: カタログ本文・スペックが出典と一致（出典: atwiki/page-409）", () => {
    expectCatalogText("RS-201", TEXT);
    expectStats("RS-201", {
      name: "イエローフォー",
      category: "OT",
      size: "S",
      bp: 1000,
      sp: undefined,
      powerCost: 1,
      comboNumber: 3,
      features: ["イエロー", "女"],
    });
  });

  function yellowFourAt(position: number, deck = [inst("TST-OP", "op1"), inst("TST-UNIT-0", "u1"), inst("TST-OP-ET", "op2")]) {
    return st({ player1: { battle: fillers(position - 1), rush: [inst("RS-201", "y")], deck } });
  }

  // 「自軍山札を見る。そして、オペレーションのカードがあれば1枚選び、自軍パワーゾーンに置く」
  it("RS-201: NC（3番目）で山札のオペレーションから1枚選び自軍パワーゾーンに置く（ユニットのカードは選べない）（出典: atwiki/page-409）", () => {
    let s = enter(yellowFourAt(3), "RS-201:y");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["TST-OP-ET:op2", "TST-OP:op1"]);
    s = pick(s, "player1", "TST-OP-ET:op2");
    expect(zoneOf(s, "player1", "TST-OP-ET:op2")).toBe("power");
    expect(zoneOf(s, "player1", "TST-OP:op1")).toBe("deck");
    expect(zoneOf(s, "player1", "TST-UNIT-0:u1")).toBe("deck");
    expect(s.players.player1.power).toHaveLength(1);
  });

  // 「オペレーションのカードがあれば」— 無ければ何も置かない（NC 成立時に置けることも確認）
  it("RS-201: 山札にオペレーションが無ければ何も置かない／あれば置く（出典: atwiki/page-409「オペレーションのカードがあれば」）", () => {
    const none = drain(enter(yellowFourAt(3, [inst("TST-UNIT-0", "u1"), inst("TST-UNIT-2", "u2")]), "RS-201:y"), "player1");
    expect(none.players.player1.power).toHaveLength(0);
    expect(none.players.player1.deck).toHaveLength(2);
    const some = drain(enter(yellowFourAt(3), "RS-201:y"), "player1");
    expect(some.players.player1.power).toHaveLength(1);
  });

  it("RS-201: NC 不成立（1番目）では山札を見ない／3番目なら置く（出典: atwiki/page-409、R-CN-02）", () => {
    const first = drain(enter(yellowFourAt(1), "RS-201:y"), "player1");
    expect(first.players.player1.power).toHaveLength(0);
    expect(first.players.player1.deck).toHaveLength(3);
    const third = drain(enter(yellowFourAt(3), "RS-201:y"), "player1");
    expect(third.players.player1.power).toHaveLength(1);
  });

  it.todo("RS-201: 「その後、山札をシャッフルする」— シャッフル結果は乱数で、順序の変化を決定的に観測できない（出典: atwiki/page-409）");
});

// ===========================================================================
describe("RS-202 ピンクファイブ", () => {
  const TEXT =
    "【ピンクバリヤー】次の相手ターン、自軍パワーゾーンのカードをウラ返してダメージにするとき、ウラ返すカードと必要パワーの数字が同じ敵軍ユニットをすべて撃破する。";

  it("RS-202: カタログ本文・スペックが出典と一致（出典: atwiki/page-410）", () => {
    expectCatalogText("RS-202", TEXT);
    expectStats("RS-202", {
      name: "ピンクファイブ",
      category: "OT",
      size: "S",
      bp: 1000,
      sp: undefined,
      powerCost: 2,
      comboNumber: 5,
      features: ["ピンク", "女"],
    });
  });

  /** 自軍ターンにピンクファイブを position 番目に出し、相手のバトルフェイズまで進める。自軍パワーは必要パワー1/3/4 のカード。 */
  function toEnemyBattle(position: number): GameState {
    let s = st({
      player1: {
        battle: fillers(position - 1),
        rush: [inst("RS-202", "p")],
        power: [inst("RS-201", "c1"), inst("RS-205", "c3"), inst("RS-210", "c4")],
        deck: deckCards(5),
      },
      player2: {
        rush: [inst("TST-UNIT-0", "e0"), inst("TST-UNIT-2", "e2"), inst("RS-211", "e3"), inst("RS-206", "e3b"), inst("RS-210", "e4")],
        power: powerCards(3, "e"),
        deck: deckCards(5, "e"),
      },
    });
    s = passEntry(enter(s, "RS-202:p"));
    s = endTurn(s);
    return advanceToBattle(s, "player2");
  }

  /** 相手が e0 でストライクし、自軍は指定のパワーカードをウラ返して支払う。 */
  function takeStrike(s: GameState, flip: string): GameState {
    s = enter(s, "TST-UNIT-0:e0", "player2");
    s = strike(s, "TST-UNIT-0:e0", "player2");
    s = act(s, { type: "resolve_damage_payment", playerId: "player1", instanceId: flip });
    return settle(s);
  }

  // 「ウラ返すカードと必要パワーの数字が同じ敵軍ユニットをすべて撃破する」
  it("RS-202: 次の相手ターン、必要パワー3のカードをウラ返すと必要パワー3の敵軍ユニットがすべて（ラッシュエリアも）撃破される（出典: atwiki/page-410）", () => {
    const s = takeStrike(toEnemyBattle(5), "RS-205:c3");
    expect(s.players.player1.damage).toBe(1);
    expect(zoneOf(s, "player2", "RS-211:e3")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-206:e3b")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-210:e4")).toBe("rush");
    expect(zoneOf(s, "player2", "TST-UNIT-2:e2")).toBe("rush");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e0")).toBe("battle");
  });

  it("RS-202: NC 不成立（1番目）なら撃破しない／5番目なら撃破する（出典: atwiki/page-410、R-CN-02）", () => {
    const first = takeStrike(toEnemyBattle(1), "RS-205:c3");
    expect(zoneOf(first, "player2", "RS-211:e3")).toBe("rush");
    const fifth = takeStrike(toEnemyBattle(5), "RS-205:c3");
    expect(zoneOf(fifth, "player2", "RS-211:e3")).toBe("discard");
  });

  // faq-card-4 RS-202 Q1「一度発動してしまえば、「RS-202 ピンクファイブ」が撃破されても、そのコンビネーションが崩されても、効果は有効になります」
  it("RS-202: 公式Q&A — 発動後にピンクファイブが撃破されても効果は有効（出典: grnrngr/faq-card-4 RS-202 Q1）", () => {
    let s = toEnemyBattle(5);
    s = enter(s, "TST-UNIT-2:e2", "player2");
    s = settle(attack(s, "TST-UNIT-2:e2", "RS-202:p", "player2"));
    expect(zoneOf(s, "player1", "RS-202:p")).toBe("discard");
    s = takeStrike(s, "RS-210:c4");
    expect(zoneOf(s, "player2", "RS-210:e4")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-203 大帝ラー・デウス", () => {
  const TEXT =
    "※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される。【デウス遺伝子】これをラッシュしたターン、このユニットの追加条件で捨札にしたユニットのカードの特徴を、すべてのユニットの特徴に追加する。";

  it("RS-203: カタログ本文・スペックが出典と一致（出典: atwiki/page-383）", () => {
    expectCatalogText("RS-203", TEXT);
    expectStats("RS-203", {
      name: "大帝ラー・デウス",
      category: "DA",
      size: "S",
      bp: 4000,
      sp: 1,
      powerCost: "5+",
      features: ["皇帝"],
      rushCondition: "discard_generic_unit",
    });
  });

  // 「追加条件：自軍ユニットを1体捨札にする。」
  it("RS-203: 追加条件 — 自軍ユニットを1体捨札にしてラッシュでき、捨札にできるユニットが無ければラッシュできない（出典: atwiki/page-383）", () => {
    const none = st({ phase: "rush", player1: { hand: [inst("RS-203", "d")], power: powerCards(5), command: releasedN(1, "TST-OP-DA") } });
    expect(canStartRush(none, "player1", "RS-203:d")).toBe(false);
    let s = st({ phase: "rush", player1: { hand: [inst("RS-203", "d")], rush: [inst("TST-UNIT-0", "m")], power: powerCards(5), command: releasedN(1, "TST-OP-DA") } });
    s = rushWithMaterial(s, "player1", "RS-203:d", "TST-UNIT-0:m");
    expect(zoneOf(s, "player1", "RS-203:d")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:m")).toBe("discard");
  });

  // 「※これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される」
  it("RS-203: ※ 敵軍ターン中に SP1 のユニットとバトルすると勝っても撃破される（出典: atwiki/page-383）", () => {
    let s = st({ activePlayer: "player2", player1: { battle: [inst("RS-203", "d")] }, player2: { battle: [inst("TST-UNIT-0", "e")] } });
    s = settle(attack(s, "TST-UNIT-0:e", "RS-203:d", "player2"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-203:d")).toBe("discard");
  });

  it("RS-203: ※ SP の無いユニットとのバトル・自軍ターン中のバトルでは勝てば残る（出典: atwiki/page-383「敵軍ターン中、「SP1」以上」）", () => {
    const NOSP = sUnit("SPEC-NOSP", { sp: undefined });
    let s = st({ activePlayer: "player2", player1: { battle: [inst("RS-203", "d")] }, player2: { battle: [inst("SPEC-NOSP", "e")] } }, [NOSP]);
    s = settle(attack(s, "SPEC-NOSP:e", "RS-203:d", "player2"));
    expect(zoneOf(s, "player1", "RS-203:d")).toBe("battle");
    let own = st({ player1: { battle: [inst("RS-203", "d")] }, player2: { battle: [inst("TST-UNIT-0", "e")] } });
    own = settle(attack(own, "RS-203:d", "TST-UNIT-0:e"));
    expect(zoneOf(own, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(zoneOf(own, "player1", "RS-203:d")).toBe("battle");
  });

  /** RS-179 恐竜やのカレー（特徴「イエロー」の自軍SユニットはBP＋2000）を両軍に置き、イエローフォー（イエロー）を捨札にしてラー・デウスをラッシュする。 */
  const LATE = sUnit("SPEC-LATE-DA", { category: "DA" });
  function rushDeusWithYellow(): GameState {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-203", "d"), inst("SPEC-LATE-DA", "late")],
        rush: [inst("RS-201", "y"), inst("TST-UNIT-0", "own")],
        power: powerCards(5),
        command: releasedN(2, "TST-OP-DA"),
        operation: [inst("RS-179", "cur")],
        deck: deckCards(5),
      },
      player2: { rush: [inst("TST-UNIT-0", "e")], operation: [inst("RS-179", "ecur")], deck: deckCards(5, "e") },
    }, [LATE]);
    return rushWithMaterial(s, "player1", "RS-203:d", "RS-201:y");
  }

  // 「このユニットの追加条件で捨札にしたユニットのカードの特徴を、すべてのユニットの特徴に追加する」
  it("RS-203: 追加条件で捨札にしたイエローフォーの特徴「イエロー」が自軍・敵軍すべてのユニットに追加される（カレーでBP＋2000）（出典: atwiki/page-383）", () => {
    const s = rushDeusWithYellow();
    expect(bpOf(s, "player1", "TST-UNIT-0:own")).toBe(3000);
    expect(bpOf(s, "player2", "TST-UNIT-0:e")).toBe(3000);
    expect(bpOf(s, "player1", "RS-203:d")).toBe(6000);
  });

  // faq-card-4 RS-203 Q1「「RS-203 大帝ラー・デウス」をラッシュしたそのターンが終わるまで有効です」
  it("RS-203: 公式Q&A — 追加された特徴はラッシュしたターンの終わりまで有効（次の相手ターンには無い）（出典: grnrngr/faq-card-4 RS-203 Q1）", () => {
    let s = rushDeusWithYellow();
    expect(bpOf(s, "player2", "TST-UNIT-0:e")).toBe(3000);
    s = endTurn(s);
    expect(s.activePlayer).toBe("player2");
    expect(bpOf(s, "player2", "TST-UNIT-0:e")).toBe(1000);
  });

  // faq-card-4 RS-203 Q4「後にラッシュしたユニットにも特徴は追加されます」
  it("RS-203: 公式Q&A — 同じターンにあとからラッシュしたユニットにも特徴が追加される（出典: grnrngr/faq-card-4 RS-203 Q4）", () => {
    let s = rushDeusWithYellow();
    const r = legal(s).find(
      (a) => (a.type === "rush" && a.instanceId === "SPEC-LATE-DA:late") || (a.type === "initiate_command_payment" && a.sourceInstanceId === "SPEC-LATE-DA:late"),
    );
    expect(r).toBeDefined();
    s = settle(act(s, r!));
    expect(zoneOf(s, "player1", "SPEC-LATE-DA:late")).toBe("rush");
    expect(bpOf(s, "player1", "SPEC-LATE-DA:late")).toBe(3000);
  });

  // faq-card-4 RS-203 Q5「手札のカードはまだラッシュされていない…ので「ユニット」とはみなされません」
  // 既知の不具合: CARD-RS-242 【ジャリュウ一族の侵攻】（戦闘員のカードをホールドせずにラッシュ）が未実装のため、対照（戦闘員のカードはラッシュできる）が成立しない
  it.fails("RS-203: 公式Q&A — 手札のカードはユニットではないので特徴「戦闘員」を得ず、リュウオーンの効果でホールドせずにラッシュできない（出典: grnrngr/faq-card-4 RS-203 Q5）", () => {
    const GRUNT = sUnit("SPEC-GRUNT", { category: "DA", features: ["戦闘員"] });
    const PLAIN = sUnit("SPEC-PLAIN-DA", { category: "DA", features: ["男"] });
    const base = (hand: ReturnType<typeof inst>[]) =>
      st(
        {
          phase: "rush",
          player1: {
            hand: [inst("RS-203", "d"), ...hand],
            rush: [inst("RS-242", "ryu"), inst("SPEC-GRUNT", "mat")],
            power: powerCards(6),
            command: releasedN(1, "TST-OP-DA"),
          },
        },
        [GRUNT, PLAIN],
      );
    // 対照: 本来「戦闘員」を持つ手札のカードは、コマンドがすべてホールドされていてもリュウオーンの効果でラッシュできる
    const ctl = rushWithMaterial(base([inst("SPEC-GRUNT", "h")]), "player1", "RS-203:d", "SPEC-GRUNT:mat");
    expect(ctl.players.player1.command.every((c) => c.commandHeld)).toBe(true);
    expect(canStartRush(ctl, "player1", "SPEC-GRUNT:h")).toBe(true);
    // 手札の「戦闘員」を持たないカードは、デウス遺伝子の影響を受けないのでラッシュできない
    const s = rushWithMaterial(base([inst("SPEC-PLAIN-DA", "h")]), "player1", "RS-203:d", "SPEC-GRUNT:mat");
    expect(canStartRush(s, "player1", "SPEC-PLAIN-DA:h")).toBe(false);
  });

  // faq-card-4 RS-203 Q3「「男」なおかつ「女」となったユニットを２体選んだ場合は「性別が同じ」と判断します」
  /** 「男」の S ユニットを捨札にしてラー・デウスをラッシュし、バトルフェイズに磁石神父を2番目に出す（CN2 の NC）。 */
  function deusThenMagnet(): GameState {
    const MALE = sUnit("SPEC-MALE-MAT", { features: ["男"] });
    let s = st(
      {
        phase: "rush",
        player1: {
          hand: [inst("RS-203", "d")],
          battle: fillers(1),
          rush: [inst("SPEC-MALE-MAT", "mat"), inst("RS-295", "j")],
          power: powerCards(5),
          command: releasedN(1, "TST-OP-DA"),
          deck: deckCards(5),
        },
        player2: {
          battle: [inst("RS-201", "y")],
          rush: [inst("RS-202", "p"), inst("RS-205", "r")],
          power: powerCards(3, "e"),
          deck: deckCards(5, "e"),
        },
      },
      [MALE],
    );
    s = rushWithMaterial(s, "player1", "RS-203:d", "SPEC-MALE-MAT:mat");
    s = advanceToBattle(s, "player1");
    return enter(s, "RS-295:j");
  }

  it("RS-203: 公式Q&A — 「男」を追加された女性ユニット2体を磁石神父で選ぶと「性別が同じ」で手札に戻る（出典: grnrngr/faq-card-4 RS-203 Q3・faq-card-5 RS-295）", () => {
    let s = deusThenMagnet();
    expect(choiceIds(s)).toEqual(["RS-201:y", "RS-202:p", "RS-205:r"]);
    s = settle(pick(s, "player1", "RS-201:y", "RS-202:p"));
    expect(zoneOf(s, "player2", "RS-201:y")).toBe("hand");
    expect(zoneOf(s, "player2", "RS-202:p")).toBe("hand");
    expect(zoneOf(s, "player2", "RS-205:r")).toBe("rush");
  });

  it("RS-203: 公式Q&A — 「男」なおかつ「女」となったユニットと「男」のユニットを選ぶと「性別が違う」のでバトルする（出典: grnrngr/faq-card-4 RS-203 Q3・faq-card-5 RS-295）", () => {
    let s = deusThenMagnet();
    s = settle(pick(s, "player1", "RS-201:y", "RS-205:r"));
    expect(zoneOf(s, "player2", "RS-201:y")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-205:r")).toBe("rush");
  });
  it.todo(
    "RS-203: 公式Q&A — 特徴「航空機」を捨札にしたターン、航空機を持たないユニットのラッシュでもバラクティカ【編隊出撃】を発動できる（出典: grnrngr/faq-card-4 RS-203 Q2・faq-card-5）— デウス遺伝子が未実装で、XL の RS-296 の起動型効果の手順をこの範囲で組み立てられない",
  );
  it.todo(
    "RS-203: 公式Q&A — ゾル大佐の効果で SP1 になった戦闘員ダイナレッドは NC 不成立ならストライク後にアタックできない（出典: grnrngr/faq-card-4 RS-203 Q6・rider_2）— RK-091 の BP 再計算と RS-191 の NC 判定は範囲外カードの実装に依存する",
  );
});

// ===========================================================================
describe("RS-204 レッドファルコン", () => {
  const TEXT =
    "【ファルコンブレイク】「SP1」（この効果は、敵軍ユニットが1体以上あるとき、このユニットのBPがすべての敵軍ユニットとくらべて一番低ければ、ナンバーに関係なく発動する）";

  it("RS-204: カタログ本文・スペックが出典と一致（出典: atwiki/page-401）", () => {
    expectCatalogText("RS-204", TEXT);
    expectStats("RS-204", {
      name: "レッドファルコン",
      category: "ET",
      size: "S",
      bp: 2000,
      sp: "special",
      powerCost: 3,
      comboNumber: 5,
      features: ["レッド", "男"],
    });
  });

  function falconFirst(enemy: ReturnType<typeof inst>[], extra: Parameters<typeof st>[1] = [], enemyOps: ReturnType<typeof inst>[] = []) {
    const s = st({ player1: { rush: [inst("RS-204", "f")] }, player2: { battle: enemy, operation: enemyOps } }, extra);
    return enter(s, "RS-204:f");
  }

  // 「敵軍ユニットが1体以上あるとき、このユニットのBPがすべての敵軍ユニットとくらべて一番低ければ、ナンバーに関係なく発動する」
  it("RS-204: 1番目でも、BP が敵軍ユニットより低ければ「SP1」でストライクできる（出典: atwiki/page-401）", () => {
    expect(canStrike(falconFirst([inst("TST-UNIT-2", "m"), inst("TST-UNIT-7", "l")]), "RS-204:f")).toBe(true);
    let s = st({
      player1: { rush: [inst("RS-204", "f")] },
      player2: { battle: [inst("TST-UNIT-2", "m")], power: powerCards(2, "e"), deck: deckCards(2, "e") },
    });
    s = settle(strike(enter(s, "RS-204:f"), "RS-204:f"));
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-204: BP がより低い敵軍ユニットがいる・敵軍ユニットが0体なら1番目では発動しない／一番低ければ発動する（出典: atwiki/page-401）", () => {
    expect(canStrike(falconFirst([inst("TST-UNIT-0", "low"), inst("TST-UNIT-2", "m")]), "RS-204:f")).toBe(false);
    expect(canStrike(falconFirst([]), "RS-204:f")).toBe(false);
    expect(canStrike(falconFirst([inst("TST-UNIT-2", "m")]), "RS-204:f")).toBe(true);
  });

  it("RS-204: 5番目なら通常のナンバーコンビネーションで「SP1」になる（出典: atwiki/page-401、R-CN-02）", () => {
    let s = st({
      player1: { battle: fillers(4), rush: [inst("RS-204", "f")] },
      player2: { battle: [inst("TST-UNIT-0", "e")], power: powerCards(2, "e"), deck: deckCards(2, "e") },
    });
    s = enter(s, "RS-204:f");
    expect(canStrike(s, "RS-204:f")).toBe(true);
    s = settle(strike(s, "RS-204:f"));
    expect(s.players.player2.damage).toBe(1);
  });

  // faq-card-4 RS-204 Q1「はい、その通りです。」（気力・恐竜やのカレー等で補正された値と比べる）
  it("RS-204: 公式Q&A — 補正後の BP で比べる（BP1000 のイエローフォーがカレーで3000なら一番低い）（出典: grnrngr/faq-card-4 RS-204 Q1）", () => {
    const s = falconFirst([inst("RS-201", "y")], [], [inst("RS-179", "cur")]);
    expect(bpOf(s, "player2", "RS-201:y")).toBe(3000);
    expect(canStrike(s, "RS-204:f")).toBe(true);
  });

  // faq-card-4 RS-204 Q2「BPが同着最下位でも「一番低い」と考えます」
  it("RS-204: 公式Q&A — 同じ BP2000 の敵軍ユニットがあっても発動する（出典: grnrngr/faq-card-4 RS-204 Q2）", () => {
    const BP2000 = sUnit("SPEC-BP2000", { bp: 2000 });
    expect(canStrike(falconFirst([inst("SPEC-BP2000", "e")], [BP2000]), "RS-204:f")).toBe(true);
  });
});

// ===========================================================================
describe("RS-205 リュウレンジャー", () => {
  const TEXT =
    "【天火星・稲妻炎上破】「SP1」「MA」の自軍コマンドを、「DA」の敵軍Sユニットの数まで好きな数ホールドしてもよい。そうしたとき、ホールドした数だけ「DA」の敵軍Sユニットを撃破する。";

  it("RS-205: カタログ本文・スペックが出典と一致（出典: atwiki/page-116）", () => {
    expectCatalogText("RS-205", TEXT);
    expectStats("RS-205", {
      name: "リュウレンジャー",
      category: "MA",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 3,
      comboNumber: 3,
      features: ["レッド", "男"],
    });
  });

  function ryuAt(position: number, commands = releasedN(3, "TST-OP-MA", "ma")) {
    const s = st({
      player1: { battle: fillers(position - 1), rush: [inst("RS-205", "r")], command: commands },
      player2: {
        battle: [inst("RS-210", "da1"), inst("TST-UNIT-0", "wb")],
        rush: [inst("RS-217", "da2"), inst("RS-216", "daL")],
        power: powerCards(3, "e"),
        deck: deckCards(3, "e"),
      },
    });
    return enter(s, "RS-205:r");
  }

  it("RS-205: NC（3番目）で「SP1」になりストライクで1点与える（出典: atwiki/page-116）", () => {
    let s = ryuAt(3);
    s = drain(s, "player1");
    if (canDecline(s, "player1")) s = decline(s, "player1");
    expect(canStrike(s, "RS-205:r")).toBe(true);
    s = settle(strike(s, "RS-205:r"));
    expect(s.players.player2.damage).toBe(1);
  });

  // 「「MA」の自軍コマンドを、「DA」の敵軍Sユニットの数まで好きな数ホールドしてもよい。そうしたとき、ホールドした数だけ「DA」の敵軍Sユニットを撃破する」
  // faq-card-4 RS-205 Q2「「RS-205 リュウレンジャー」の持ち主が対象を選んで撃破してください」
  it("RS-205: MA コマンドを2つホールドし、持ち主が DA の敵軍 S ユニット（バトル・ラッシュエリア）2体を選んで撃破する（出典: atwiki/page-116・grnrngr/faq-card-4 RS-205 Q2）", () => {
    let s = ryuAt(3);
    s = confirmIfAsked(s, "player1");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    s = drain(s, "player1", ["TST-OP-MA:ma0", "TST-OP-MA:ma1"]);
    s = settle(s);
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
    expect(zoneOf(s, "player2", "RS-210:da1")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-217:da2")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-216:daL")).toBe("rush");
    expect(zoneOf(s, "player2", "TST-UNIT-0:wb")).toBe("battle");
  });

  it("RS-205: 撃破の対象は「DA」の敵軍 S ユニットだけ（DA の L・DA 以外の S は選べない）（出典: atwiki/page-116）", () => {
    let s = ryuAt(3);
    s = confirmIfAsked(s, "player1");
    // ホールドするコマンドを選ぶ段階があれば済ませ、撃破対象の候補を見る
    for (let i = 0; i < 4 && s.pendingEffectChoice && s.pendingEffectChoice.validInstanceIds.some((id) => id.startsWith("TST-OP-MA")); i++) {
      s = pick(s, "player1", s.pendingEffectChoice.validInstanceIds.find((id) => id.startsWith("TST-OP-MA"))!);
    }
    expect(choiceIds(s)).toEqual(["RS-210:da1", "RS-217:da2"]);
  });

  // 「ホールドしてもよい」— ホールドしないことを選べる
  it("RS-205: ホールドしないことを選べ、そのときは何も撃破しない（出典: atwiki/page-116「ホールドしてもよい」）", () => {
    let s = ryuAt(3);
    expect(canDecline(s, "player1")).toBe(true);
    s = settle(decline(s, "player1"));
    expect(s.players.player1.command.every((c) => !c.commandHeld)).toBe(true);
    expect(zoneOf(s, "player2", "RS-210:da1")).toBe("battle");
    expect(zoneOf(s, "player2", "RS-217:da2")).toBe("rush");
  });

  // 「「MA」の自軍コマンドを」— MA 以外のコマンドはホールドに使えない（リリース状態の MA が1つなら1体まで）
  it("RS-205: リリース状態の MA コマンドが1つ（他は ET）なら撃破できるのは1体まで（出典: atwiki/page-116「「MA」の自軍コマンド」）", () => {
    let s = ryuAt(3, [...releasedN(1, "TST-OP-MA", "ma"), ...releasedN(2, "TST-OP-ET", "et")]);
    s = confirmIfAsked(s, "player1");
    s = drain(s, "player1");
    s = settle(s);
    expect(s.players.player1.command.filter((c) => c.commandHeld).map((c) => c.cardId)).toEqual(["TST-OP-MA"]);
    const destroyed = ["RS-210:da1", "RS-217:da2"].filter((id) => zoneOf(s, "player2", id) === "discard");
    expect(destroyed).toHaveLength(1);
  });

  it("RS-205: NC 不成立（1番目）ではホールド・撃破の効果は発動しない／3番目なら発動する（出典: atwiki/page-116、R-CN-02）", () => {
    const first = ryuAt(1);
    expect(first.pendingEffectChoice).toBeUndefined();
    expect(canStrike(first, "RS-205:r")).toBe(false);
    const third = ryuAt(3);
    expect(third.pendingEffectChoice?.playerId).toBe("player1");
  });

  // faq-card-4 RS-205 Q1「先に撃破する対象をすべて選んでから、選んだユニットを１体ずつ撃破するようにしてください」
  it("RS-205: 公式Q&A — 撃破する対象をすべて選び終えるまで1体も撃破されない（出典: grnrngr/faq-card-4 RS-205 Q1）", () => {
    let s = ryuAt(3);
    s = confirmIfAsked(s, "player1");
    for (let i = 0; i < 4 && s.pendingEffectChoice && s.pendingEffectChoice.validInstanceIds.some((id) => id.startsWith("TST-OP-MA")); i++) {
      s = pick(s, "player1", s.pendingEffectChoice.validInstanceIds.find((id) => id.startsWith("TST-OP-MA"))!);
    }
    s = pick(s, "player1", "RS-210:da1");
    expect(zoneOf(s, "player2", "RS-210:da1")).toBe("battle");
    s = settle(pick(s, "player1", "RS-217:da2"));
    expect(zoneOf(s, "player2", "RS-210:da1")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-217:da2")).toBe("discard");
  });

  // faq-card-4 RS-205 Q3「選ぶことのできない「RK-057 仮面ライダーザビーＲＦ」を撃破することはできません」
  it("RS-205: 公式Q&A — 闇のヤイバで DA になった「相手に選ばれない」ザビーRF は対象にできず、DA の男性ユニットは選べる（出典: grnrngr/faq-card-4 RS-205 Q3）", () => {
    let s = st({
      player1: { battle: fillers(2), rush: [inst("RS-205", "r"), inst("RS-339", "yaiba")], command: releasedN(2, "TST-OP-MA", "ma") },
      player2: { battle: [inst("RK-057", "zabee"), inst("RS-211", "maleMA")], power: powerCards(3, "e"), deck: deckCards(3, "e") },
    });
    s = enter(s, "RS-205:r");
    s = confirmIfAsked(s, "player1");
    for (let i = 0; i < 4 && s.pendingEffectChoice && s.pendingEffectChoice.validInstanceIds.some((id) => id.startsWith("TST-OP-MA")); i++) {
      s = pick(s, "player1", s.pendingEffectChoice.validInstanceIds.find((id) => id.startsWith("TST-OP-MA"))!);
    }
    expect(choiceIds(s)).toContain("RS-211:maleMA");
    expect(choiceIds(s)).not.toContain("RK-057:zabee");
  });
});

// ===========================================================================
describe("RS-206 シシレンジャー", () => {
  const TEXT = "【天幻星・霧隠れ】「SP1」ユニットを1体選んでもよい。そうしたとき、このターン、このユニットは選んだユニットの特徴が追加される。";

  it("RS-206: カタログ本文・スペックが出典と一致（出典: atwiki/page-117）", () => {
    expectCatalogText("RS-206", TEXT);
    expectStats("RS-206", {
      name: "シシレンジャー",
      category: "MA",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 3,
      comboNumber: 3,
      features: ["グリーン", "男"],
    });
  });

  /** 自軍にカレー（イエローの自軍SユニットBP+2000）を置き、敵軍にイエローフォー（イエロー）がある状態でシシレンジャーを出す。 */
  function shishiAt(position: number): GameState {
    const s = st({
      player1: { battle: fillers(position - 1), rush: [inst("RS-206", "r")], operation: [inst("RS-179", "cur")], deck: deckCards(3) },
      player2: { battle: [inst("RS-201", "y")], power: powerCards(3, "e"), deck: deckCards(3, "e") },
    });
    return enter(s, "RS-206:r");
  }

  it("RS-206: NC（3番目）で「SP1」になりストライクで1点与える（出典: atwiki/page-117）", () => {
    let s = shishiAt(3);
    if (canDecline(s, "player1")) s = decline(s, "player1");
    expect(canStrike(s, "RS-206:r")).toBe(true);
    s = settle(strike(s, "RS-206:r"));
    expect(s.players.player2.damage).toBe(1);
  });

  // 「ユニットを1体選んでもよい。そうしたとき、このターン、このユニットは選んだユニットの特徴が追加される」
  it("RS-206: 敵軍のイエローフォーを選ぶと「イエロー」が追加され、自軍カレーで BP＋2000 になる（出典: atwiki/page-117）", () => {
    let s = shishiAt(3);
    s = confirmIfAsked(s, "player1");
    expect(choiceIds(s)).toContain("RS-201:y");
    s = pick(s, "player1", "RS-201:y");
    expect(bpOf(s, "player1", "RS-206:r")).toBe(5000);
  });

  // 「選んでもよい」— 選ばないことを選べる
  it("RS-206: ユニットを選ばないこともでき、そのときは特徴が増えない（出典: atwiki/page-117「選んでもよい」）", () => {
    let s = shishiAt(3);
    expect(canDecline(s, "player1")).toBe(true);
    s = decline(s, "player1");
    expect(bpOf(s, "player1", "RS-206:r")).toBe(3000);
    expect(canStrike(s, "RS-206:r")).toBe(true);
  });

  // 「このターン」— 次のターンには追加された特徴は無い
  it("RS-206: 追加された特徴はそのターンだけ（相手ターンには BP3000 に戻る）（出典: atwiki/page-117「このターン」）", () => {
    let s = shishiAt(3);
    s = confirmIfAsked(s, "player1");
    s = pick(s, "player1", "RS-201:y");
    expect(bpOf(s, "player1", "RS-206:r")).toBe(5000);
    // バトルエリアに出た直後の行動ウィンドウ（アタック／ストライク）を閉じてからターンを終える。
    s = endTurn(passEntry(s));
    expect(bpOf(s, "player1", "RS-206:r")).toBe(3000);
  });

  it("RS-206: NC 不成立（1番目）では選べない／3番目なら選べる（出典: atwiki/page-117、R-CN-02）", () => {
    const first = shishiAt(1);
    expect(first.pendingEffectChoice).toBeUndefined();
    const third = confirmIfAsked(shishiAt(3), "player1");
    expect(choiceIds(third)).toContain("RS-201:y");
  });
});

// ===========================================================================
describe("RS-207 テンマレンジャー", () => {
  const TEXT =
    "【天重星・天馬回転蹴り】「SP1」敵軍Sユニットの数が自軍Sユニットの数より4体以上多いとき、次の効果を発動できる⇒自軍Sユニットと同じ数になるまで、相手は自分自身のSユニットを選び手札に戻す。";

  it("RS-207: カタログ本文・スペックが出典と一致（出典: atwiki/page-118）", () => {
    expectCatalogText("RS-207", TEXT);
    expectStats("RS-207", {
      name: "テンマレンジャー",
      category: "MA",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 3,
      comboNumber: 3,
      features: ["ブルー", "男"],
    });
  });

  /** 自軍 S は3体（フィラー2＋テンマ）。敵軍 S は enemyS 体（バトル4＋ラッシュ残り）と M 1体。 */
  function tenmaAt(position: number, enemyS: number): GameState {
    const s = st({
      player1: { battle: fillers(position - 1), rush: [inst("RS-207", "r"), ...fillers(3 - position, "ownR")] },
      player2: {
        battle: fillers(Math.min(enemyS, 4), "eb"),
        rush: [...fillers(Math.max(enemyS - 4, 0), "er"), inst("TST-UNIT-2", "em")],
        power: powerCards(3, "e"),
        deck: deckCards(3, "e"),
      },
    });
    return enter(s, "RS-207:r");
  }

  it("RS-207: NC（3番目）で「SP1」になりストライクで1点与える（出典: atwiki/page-118）", () => {
    let s = tenmaAt(3, 2);
    expect(canStrike(s, "RS-207:r")).toBe(true);
    s = settle(strike(s, "RS-207:r"));
    expect(s.players.player2.damage).toBe(1);
  });

  // 「敵軍Sユニットの数が自軍Sユニットの数より4体以上多いとき…自軍Sユニットと同じ数になるまで、相手は自分自身のSユニットを選び手札に戻す」
  it("RS-207: 敵軍 S が自軍 S より4体以上多い（7対3）とき発動でき、相手が自分の S を選んで3体になるまで手札に戻す（M は戻さない）（出典: atwiki/page-118）", () => {
    let s = tenmaAt(3, 7);
    expect(countS(s, "player1")).toBe(3);
    expect(countS(s, "player2")).toBe(7);
    s = confirmIfAsked(s, "player1");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(choiceIds(s)).not.toContain("TST-UNIT-2:em");
    s = drain(s, "player2");
    expect(countS(s, "player2")).toBe(3);
    expect(s.players.player2.hand).toHaveLength(4);
    expect(zoneOf(s, "player2", "TST-UNIT-2:em")).toBe("rush");
  });

  it("RS-207: 差が3体（6対3）では発動できない／4体なら発動できる（出典: atwiki/page-118「4体以上多いとき」）", () => {
    const three = drain(confirmIfAsked(tenmaAt(3, 6), "player1"), "player2");
    expect(countS(three, "player2")).toBe(6);
    expect(three.players.player2.hand).toHaveLength(0);
    const four = drain(confirmIfAsked(tenmaAt(3, 7), "player1"), "player2");
    expect(countS(four, "player2")).toBe(3);
  });

  // 「次の効果を発動できる」— 発動しないことを選べる
  it("RS-207: 条件を満たしていても発動しないことを選べる（出典: atwiki/page-118「発動できる」）", () => {
    let s = tenmaAt(3, 7);
    expect(canDecline(s, "player1")).toBe(true);
    s = decline(s, "player1");
    expect(countS(s, "player2")).toBe(7);
  });

  it("RS-207: NC 不成立（1番目）では発動しない／3番目なら発動する（出典: atwiki/page-118、R-CN-02）", () => {
    const first = drain(confirmIfAsked(tenmaAt(1, 7), "player1"), "player2");
    expect(countS(first, "player2")).toBe(7);
    const third = drain(confirmIfAsked(tenmaAt(3, 7), "player1"), "player2");
    expect(countS(third, "player2")).toBe(3);
  });

  // faq-card-4 RS-207 Q1「いいえ、できません。必ず同じ数になるまで選び、持ち主の手札に戻してください」
  it("RS-207: 公式Q&A — 相手は途中で止められない（選択中に断る手段が無い）（出典: grnrngr/faq-card-4 RS-207 Q1）", () => {
    let s = confirmIfAsked(tenmaAt(3, 7), "player1");
    expect(s.pendingEffectChoice?.playerId).toBe("player2");
    expect(canDecline(s, "player2")).toBe(false);
    s = pick(s, "player2", s.pendingEffectChoice!.validInstanceIds[0]!);
    expect(canDecline(s, "player2")).toBe(false);
    s = drain(s, "player2");
    expect(countS(s, "player2")).toBe(3);
  });
});

void attackTargets;
