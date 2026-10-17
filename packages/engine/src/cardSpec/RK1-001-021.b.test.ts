/**
 * カード別スペック: RK-008〜RK-014（ザ・マスクドライダーEXP vol.1 メカニック忍者〜共同戦線）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（本範囲のエラッタなし）、grnrngr/faq-rider-1
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/rider_1.html。RK-008・RK-010・RK-011・RK-012・RK-013 の Q&A）、
 *     grnrngr/faq-rider-2（rider_2.html。RK-008・RK-012・RK-013 の相互参照 Q）、grnrngr/faq-card-5（RS-247 の相互参照 Q）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RK-NNN.md。本範囲のライブ写し pages/N.txt はなし）
 *  3. docs/rules/*.md の一般ルール（R-KW-PERM-01、R-CTR-01/02、R-TGT-01 等）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RK-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { unitFeatures } from "../rules/addedFeatures";
import {
  act,
  attack,
  attackersOf,
  bpOf,
  canSkip,
  cardIn,
  choiceIds,
  damageOf,
  deckCards,
  endTurn,
  expectCatalogText,
  expectOpStats,
  expectRarityIn,
  held,
  inst,
  lastBattleBps,
  legal,
  nextPhase,
  pick,
  playOp,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  settle,
  skip,
  st,
  sUnit,
  toPhase,
  tryAct,
  zoneIds,
  zoneOf,
} from "./RK1-001-021.helpers";

const KAIZO = sUnit("SPEC-KAIZO", { category: "ET", bp: 3000, features: ["男", "改造人間"] });
const KAIZO4 = sUnit("SPEC-KAIZO4", { category: "ET", bp: 4000, features: ["男", "改造人間"] });
const KAIZO_M = sUnit("SPEC-KAIZO-M", { category: "ET", size: "M", bp: 3000, features: ["男", "改造人間"] });
const KAIZO_COND = sUnit("SPEC-KAIZO-COND", {
  category: "ET",
  bp: 3000,
  powerCost: "3+",
  features: ["男", "改造人間"],
  rushAdditionalCondition: { conditionId: "send_s_unit_to_command_or_discard", text: "自軍Sユニットを1体コマンドゾーンに送るか捨札にする", unitCount: 1 },
} as Partial<CardDefinition>);
const MALE = sUnit("SPEC-MALE", { category: "ET", bp: 2000, features: ["男"] });
const MALE_M = sUnit("SPEC-MALE-M", { category: "ET", size: "M", bp: 3000, features: ["男"] });
const ATK_S = sUnit("SPEC-ATK-S", { bp: 2500 });
const ATK_M = sUnit("SPEC-ATK-M", { bp: 2500, size: "M" });
const S5000 = sUnit("SPEC-S5000", { bp: 5000 });
const S4000 = sUnit("SPEC-S4000", { bp: 4000 });
const S3000 = sUnit("SPEC-S3000", { bp: 3000 });
const M4000 = sUnit("SPEC-M4000", { bp: 4000, size: "M" });
const ET_S = sUnit("SPEC-ET-S", { category: "ET", bp: 1000 });
const RIDER = sUnit("SPEC-RIDER", { category: "MA", bp: 1000, features: ["仮面ライダー", "男"] });
const POLICE = sUnit("SPEC-POLICE", { category: "MA", bp: 1000, features: ["警察"] });
const POLICE_RIDER = sUnit("SPEC-POLICE-RIDER", { category: "MA", bp: 1000, features: ["仮面ライダー", "警察"] });
const EXTRA = [KAIZO, KAIZO4, KAIZO_M, KAIZO_COND, MALE, MALE_M, ATK_S, ATK_M, S5000, S4000, S3000, M4000, ET_S, RIDER, POLICE, POLICE_RIDER];

/** 自軍（player1）ラッシュフェイズ。 */
const rushBoard = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
  st({ phase: "rush", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, EXTRA);

const played = (s: GameState, id: string, playerId: PlayerId = "player1") => {
  const r = playOp(s, playerId, id);
  expect(r.ok, r.error).toBe(true);
  return r.state;
};

/** 敵軍（player2）ターンに player2 の attacker が player1 の defender にアタックする（反応ウィンドウは開いたまま）。 */
const enemyAttack = (
  p1: Partial<GameState["players"]["player1"]>,
  defender: string,
  attacker = "SPEC-ATK-S:a",
  p2: Partial<GameState["players"]["player2"]> = {},
) => {
  const [aid, asuf] = attacker.split(":") as [string, string];
  const s = st(
    {
      activePlayer: "player2",
      player1: { deck: deckCards(5), ...p1 },
      player2: { deck: deckCards(5, "e"), ...p2, battle: [...(p2.battle ?? []), inst(aid, asuf)] },
    },
    EXTRA,
  );
  return attack(s, attacker, defender, "player2");
};

/** 手札のカウンターを使う（カテゴリの支払いは先頭の有効なコマンド）。substitute を指定できる。 */
const useCounter = (s: GameState, id: string, playerId: PlayerId = "player1", substitute?: string) => {
  const matches = (a: Record<string, unknown>) => substitute === undefined || a.substituteInstanceId === substitute;
  const acts = legal(s) as unknown as Record<string, unknown>[];
  const pay = acts.find((a) => a.type === "initiate_command_payment" && a.sourceInstanceId === id && matches(a));
  let next = pay ? act(s, pay as never) : s;
  const play = (legal(next) as unknown as Record<string, unknown>[]).find(
    (a) => a.type === "play_counter" && a.instanceId === id && matches(a),
  );
  if (play) next = act(next, play as never);
  return next;
};
const canCounter = (s: GameState, id: string, playerId: PlayerId = "player1") =>
  legal(s).some(
    (a) =>
      a.playerId === playerId &&
      ((a.type === "initiate_command_payment" && a.sourceInstanceId === id) || (a.type === "play_counter" && a.instanceId === id)),
  );
const ninjaSubs = (s: GameState, id = "RK-008:nin") =>
  [
    ...new Set(
      (legal(s) as unknown as Record<string, unknown>[])
        .filter((a) => (a.type === "initiate_command_payment" && a.sourceInstanceId === id) || (a.type === "play_counter" && a.instanceId === id))
        .map((a) => a.substituteInstanceId as string | undefined)
        .filter((x): x is string => typeof x === "string"),
    ),
  ].sort();

/** バトルの反応ウィンドウをパスし、撃破による離場の反応ウィンドウ（pendingLeave）まで進める。 */
const toLeave = (s: GameState) => {
  let n = s;
  for (let i = 0; i < 5 && !n.pendingLeave; i++) {
    const p = legal(n).find((a) => a.type === "pass_battle_reaction");
    if (!p) break;
    n = act(n, p);
  }
  return n;
};

/** 手札からラッシュする（支払いまで済ませ、ラッシュの反応ウィンドウは開いたまま）。 */
const rushOpen = (s: GameState, playerId: PlayerId, instanceId: string) => {
  let r = tryAct(s, { type: "initiate_command_payment", playerId, kind: "category_use", sourceInstanceId: instanceId });
  expect(r.ok, r.error).toBe(true);
  for (let i = 0; i < 4 && r.state.pendingCommandPayment?.playerId === playerId; i++) {
    const p = r.state.pendingCommandPayment;
    r = tryAct(r.state, { type: "resolve_command_payment", playerId, commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded) });
    expect(r.ok, r.error).toBe(true);
  }
  return r.state;
};

// ===========================================================================
describe("RK-008 メカニック忍者", () => {
  const TEXT =
    "※カウンター（これは敵軍ターン中にのみ使用できる） 自軍Sユニットがアタックされたとき発動できる⇒自軍コマンドゾーンから、追加条件を持たない特徴「改造人間」を持つSユニットのカードを1枚選び、自軍ラッシュエリアに出す。その後、アタックされたユニットを自軍コマンドゾーンにホールド状態で置く。このとき、バトルは行われない。";

  const board = (command: CardInstance[], defender = "TST-UNIT-0:d", attacker = "TST-UNIT-7:atk") => {
    const [did, dsuf] = defender.split(":") as [string, string];
    return enemyAttack({ battle: [inst(did, dsuf)], hand: [inst("RK-008", "nin")], command, power: powerCards(4) }, defender, attacker);
  };

  it("RK-008: カタログ本文・スペックが出典と一致（出典: atwiki/page-196）", () => {
    expectCatalogText("RK-008", TEXT);
    expectOpStats("RK-008", { name: "メカニック忍者", category: "ET", powerCost: 4 });
    expectRarityIn("RK-008", ["MR"]);
  });

  it("RK-008: 候補は自軍コマンドゾーンの、追加条件を持たない特徴「改造人間」の S ユニットのカードだけ（出典: atwiki/page-196「追加条件を持たない特徴「改造人間」を持つSユニットのカード」）", () => {
    const s = board([released("SPEC-KAIZO", "k"), released("SPEC-KAIZO-M", "km"), released("SPEC-KAIZO-COND", "kc"), released("SPEC-MALE", "m"), ...releasedCat("ET", 1)]);
    expect(ninjaSubs(s)).toEqual(["SPEC-KAIZO:k"]);
  });

  it("RK-008: 選んだカードを自軍ラッシュエリアに出し、アタックされたユニットを自軍コマンドゾーンにホールド状態で置く。バトルは行われない（出典: atwiki/page-196）", () => {
    const s = settle(useCounter(board([released("SPEC-KAIZO", "k"), ...releasedCat("ET", 1)]), "RK-008:nin", "player1", "SPEC-KAIZO:k"));
    expect(zoneOf(s, "player1", "SPEC-KAIZO:k")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:d")).toBe("command");
    expect(cardIn(s, "player1", "TST-UNIT-0:d")?.commandHeld).toBe(true);
    expect(zoneOf(s, "player2", "TST-UNIT-7:atk")).toBe("battle");
    expect(s.pendingBattle).toBeUndefined();
  });

  // faq-rider-2「リリース状態で置かれます。ユニットはユニットでなくなった時点で、ユニットとして持っていた情報はすべて失われる」
  it("RK-008: 公式Q&A — ホールド状態でコマンドゾーンにあったカードもリリース状態でラッシュエリアに出る（出典: grnrngr/faq-rider-2 RK-024・RK-166 の Q）", () => {
    const s = settle(useCounter(board([held("SPEC-KAIZO", "k"), ...releasedCat("ET", 1)]), "RK-008:nin", "player1", "SPEC-KAIZO:k"));
    expect(zoneOf(s, "player1", "SPEC-KAIZO:k")).toBe("rush");
    expect(cardIn(s, "player1", "SPEC-KAIZO:k")?.commandHeld ?? false).toBe(false);
  });

  it("RK-008: 自軍 M ユニットがアタックされたときは使えない（出典: atwiki/page-196「自軍Sユニットがアタックされたとき」）", () => {
    expect(canCounter(board([released("SPEC-KAIZO", "k"), ...releasedCat("ET", 1)], "SPEC-MALE-M:d"), "RK-008:nin")).toBe(false);
  });

  // faq-rider-1 RK-008 Q3「その場合は、アタックされたユニットはその場に留まります。…通常通りバトルを行うことになります。」
  it("RK-008: 公式Q&A — 出せるカードがなく、コマンドゾーンが5枚ならアタックされたユニットはその場に留まり、通常通りバトルを行う（出典: grnrngr/faq-rider-1 RK-008 Q3・atwiki/page-196 Q3）", () => {
    const s = settle(useCounter(board(releasedCat("ET", 5)), "RK-008:nin"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:d")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-008:nin")).toBe("discard");
  });

  it("RK-008: 出せるカードがなくても、コマンドゾーンに空きがあればアタックされたユニットをコマンドゾーンに置き、バトルは行われない（出典: atwiki/page-196「その後、」・grnrngr/faq-rider-1 RK-008 Q3 の前提「アタックされたユニットを自軍コマンドゾーンにホールド状態で置くことになります」）", () => {
    const s = settle(useCounter(board(releasedCat("ET", 1)), "RK-008:nin"));
    expect(zoneOf(s, "player1", "TST-UNIT-0:d")).toBe("command");
  });

  it("RK-008: ※カウンター — 自軍ターン中は使えない（出典: atwiki/page-196「これは敵軍ターン中にのみ使用できる」・R-CTR-01）", () => {
    let s = st(
      {
        phase: "battle",
        player1: { battle: [inst("TST-UNIT-0", "u")], hand: [inst("RK-008", "nin")], command: [released("SPEC-KAIZO", "k"), ...releasedCat("ET", 1)], power: powerCards(4), deck: deckCards(5) },
        player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(5, "e") },
      },
      EXTRA,
    );
    s = attack(s, "TST-UNIT-0:u", "TST-UNIT-0:e");
    expect(canCounter(s, "RK-008:nin")).toBe(false);
  });

  it.todo(
    "RK-008: 公式Q&A — ゴーゴーファイヤー【プロジェットカノン】をメカニック忍者の処理の途中（カードがコマンドゾーンを離れたとき）に発動してから、続きとしてアタックされたユニットをコマンドゾーンに置ける（ライアと併用なら2回）（出典: grnrngr/faq-rider-1 RK-008 Q1・Q2）— 「その後」の処理の途中に別の効果を割り込ませる手順（効果の解決の中断と再開）を公開 API で組めないため",
  );
});

// ===========================================================================
describe("RK-009 二人の世紀王", () => {
  const TEXT =
    "※カウンター（これは敵軍ターン中にのみ使用できる） 自軍Sユニットが敵軍Sユニットにアタックされたとき発動できる⇒自分も相手も、バトルを行うユニット以外のSユニットをすべて手札に戻す。このときバトルを行うお互いのユニットは、このバトルの間、戻した自分自身のユニット1体につきそれぞれBP+1000される。";

  const board = (defender = "TST-UNIT-0:d", attacker = "SPEC-ATK-S:a") => {
    const [did, dsuf] = defender.split(":") as [string, string];
    return enemyAttack(
      {
        battle: [inst(did, dsuf), inst("TST-UNIT-0", "b1")],
        rush: [inst("TST-UNIT-0", "r1"), inst("TST-UNIT-0", "r2"), inst("SPEC-MALE-M", "rm")],
        hand: [inst("RK-009", "kk")],
        command: releasedCat("MA", 1),
        power: powerCards(5),
      },
      defender,
      attacker,
      { battle: [inst("TST-UNIT-0", "eb1")], rush: [inst("TST-UNIT-0", "er1"), inst("SPEC-ATK-M", "erm")] },
    );
  };

  it("RK-009: カタログ本文・スペックが出典と一致（出典: atwiki/page-209）", () => {
    expectCatalogText("RK-009", TEXT);
    expectOpStats("RK-009", { name: "二人の世紀王", category: "MA", powerCost: 5 });
    expectRarityIn("RK-009", ["MR", "N"]);
  });

  it("RK-009: 自軍 S ユニットが敵軍 S ユニットにアタックされたとき使える（出典: atwiki/page-209）", () => {
    expect(canCounter(board(), "RK-009:kk")).toBe(true);
  });

  it("RK-009: 自分も相手も、バトルを行うユニット以外の S ユニットをすべて手札に戻す（M ユニットは残る）（出典: atwiki/page-209「バトルを行うユニット以外のSユニットをすべて手札に戻す」）", () => {
    const s = settle(useCounter(board(), "RK-009:kk"));
    for (const id of ["TST-UNIT-0:b1", "TST-UNIT-0:r1", "TST-UNIT-0:r2"]) expect(zoneOf(s, "player1", id)).toBe("hand");
    for (const id of ["TST-UNIT-0:eb1", "TST-UNIT-0:er1"]) expect(zoneOf(s, "player2", id)).toBe("hand");
    expect(zoneOf(s, "player1", "SPEC-MALE-M:rm")).toBe("rush");
    expect(zoneOf(s, "player2", "SPEC-ATK-M:erm")).toBe("rush");
  });

  it("RK-009: バトルを行うユニットは、このバトルの間、戻した自分自身のユニット1体につき BP+1000 される（自軍3体戻し BP4000、敵軍2体戻し BP4500）（出典: atwiki/page-209「戻した自分自身のユニット1体につきそれぞれBP+1000される」）", () => {
    const s = settle(useCounter(board(), "RK-009:kk"));
    expect(lastBattleBps(s)).toEqual({ attacker: 4500, defender: 4000 });
  });

  it("RK-009: バトルの後は BP の修正は残らない（出典: atwiki/page-209「このバトルの間」）", () => {
    const s = settle(useCounter(board(), "RK-009:kk"));
    expect(zoneOf(s, "player2", "SPEC-ATK-S:a")).toBe("battle");
    expect(bpOf(s, "player2", "SPEC-ATK-S:a")).toBe(2500);
  });

  it("RK-009: 敵軍 M ユニットにアタックされたときは使えない（出典: atwiki/page-209「敵軍Sユニットにアタックされたとき」）", () => {
    expect(canCounter(board("TST-UNIT-0:d", "SPEC-ATK-M:a"), "RK-009:kk")).toBe(false);
  });

  it("RK-009: 自軍 M ユニットがアタックされたときは使えない（出典: atwiki/page-209「自軍Sユニットが」）", () => {
    expect(canCounter(board("SPEC-MALE-M:d"), "RK-009:kk")).toBe(false);
  });
});

// ===========================================================================
describe("RK-010 ハイブリッドエネルギー", () => {
  const TEXT =
    "※常駐 自分がターンを終えるとき、自軍山札の上から1枚をオモテにする。オモテにしたカードが山札の上にある間、そのカードと同じカテゴリの自軍SユニットはBP+1000される。 オモテにしたカードがドローされる以外で自軍山札の状態が変更される操作をするとき、オモテにしたカードを手札に加えてから操作する。";

  /** 自軍（player1）バトルフェイズ。山札の上は WB のカード（TST-OP）。ラッシュエリアに WB の S（TST-UNIT-0）と ET の S。 */
  const board = (p1: Partial<GameState["players"]["player1"]> = {}) =>
    st(
      {
        phase: "battle",
        player1: {
          operation: [inst("RK-010", "he")],
          rush: [inst("TST-UNIT-0", "wb"), inst("SPEC-ET-S", "et"), inst("TST-UNIT-2", "wbm")],
          deck: [inst("TST-OP", "top"), ...deckCards(5)],
          ...p1,
        },
        player2: { deck: deckCards(5, "e") },
      },
      EXTRA,
    );

  it("RK-010: カタログ本文・スペックが出典と一致（出典: atwiki/page-210）", () => {
    expectCatalogText("RK-010", TEXT);
    expectOpStats("RK-010", { name: "ハイブリッドエネルギー", category: "MA", powerCost: 4 });
    expectRarityIn("RK-010", ["R"]);
  });

  it("RK-010: 自分がターンを終えるとき山札の上をオモテにし、それが山札の上にある間、同じカテゴリの自軍 S ユニットは BP+1000（出典: atwiki/page-210）", () => {
    const s = endTurn(board());
    expect(s.activePlayer).toBe("player2");
    expect(bpOf(s, "player1", "TST-UNIT-0:wb")).toBe(2000);
  });

  it("RK-010: 違うカテゴリの S ユニット・同じカテゴリの M ユニットは BP が変わらない（出典: atwiki/page-210「そのカードと同じカテゴリの自軍Sユニット」）", () => {
    const s = endTurn(board());
    expect(bpOf(s, "player1", "SPEC-ET-S:et")).toBe(1000);
    expect(bpOf(s, "player1", "TST-UNIT-2:wbm")).toBe(3000);
  });

  it("RK-010: ターンを終える前は BP が変わらない（出典: atwiki/page-210「自分がターンを終えるとき」）", () => {
    expect(bpOf(board(), "player1", "TST-UNIT-0:wb")).toBe(1000);
  });

  it("RK-010: 相手がターンを終えるときはオモテにしない（出典: atwiki/page-210「自分がターンを終えるとき」）", () => {
    const s = endTurn({ ...board(), activePlayer: "player2" });
    expect(bpOf(s, "player1", "TST-UNIT-0:wb")).toBe(1000);
  });

  // faq-rider-1 RK-010 Q2「そのオモテになっているカードをドローします。」
  it("RK-010: 公式Q&A — 次の自軍ターンの初めの1枚のドローでは、オモテになっているカードをドローする（出典: grnrngr/faq-rider-1 RK-010 Q2・atwiki/page-210 Q2）", () => {
    let s = endTurn(board());
    s = toPhase(s, "player1", "charge");
    expect(zoneOf(s, "player1", "TST-OP:top")).toBe("hand");
    expect(bpOf(s, "player1", "TST-UNIT-0:wb")).toBe(1000);
  });

  // faq-rider-1 RK-010 Q1「いいえ、含まれません。…山札の一番上でオモテになっているカードを手札に加えてから、「RK-015 人類の進化」の効果の続きを実行する」
  it("RK-010: 公式Q&A — 人類の進化の「山札の上からカードを1枚ひく」はドローに含まれず、オモテのカードを手札に加えてから次の1枚をひく（出典: grnrngr/faq-rider-1 RK-010 Q1・atwiki/page-210 Q1）", () => {
    let s = endTurn(
      board({
        battle: [inst("SPEC-MALE", "def")],
        hand: [inst("RK-015", "jk")],
        command: releasedCat("MA", 1),
        power: powerCards(3),
        deck: [inst("TST-OP", "top"), inst("SPEC-RIDER", "rd"), ...deckCards(3)],
      }),
    );
    s = toPhase(s, "player2", "battle");
    s = { ...s, players: { ...s.players, player2: { ...s.players.player2, battle: [inst("TST-UNIT-7", "atk")] } } };
    s = toLeave(attack(s, "TST-UNIT-7:atk", "SPEC-MALE:def", "player2"));
    s = resolveAll(useCounter(s, "RK-015:jk"), ["SPEC-RIDER:rd"]);
    expect(zoneOf(s, "player1", "TST-OP:top")).toBe("hand");
    expect(zoneOf(s, "player1", "SPEC-RIDER:rd")).toBe("rush");
  });

  it.todo(
    "RK-010: 公式Q&A — ゴーゴーマリン【海底調査】で山札の下からドローするときは、オモテのカードを手札に加えてから下のカードをドローする（出典: grnrngr/faq-rider-1 RK-010 Q3・atwiki/page-210 Q3）— 【海底調査】（RS-122）の処理は RS 系の担当範囲で、ハイブリッドエネルギーとの割り込み手順を公開 API で確認できなかったため",
  );
  it.todo(
    "RK-010: 公式Q&A — 敵軍ターン中にデネブ【デネブキャンディー】が解決するときも、オモテのカードを手札に加えてから解決する（出典: atwiki/page-210 Q4）— RK-146 デネブは本範囲外のため",
  );
});

// ===========================================================================
describe("RK-011 第三の眼", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる） 相手がカウンターを発動したとき、そのカウンターの必要パワーの数字を見て、それ以上の必要パワーの数字を持つカードを自分の手札から１枚選び捨札にしてもよい。そうしたとき、そのカウンターの効果は無効になる。";

  /**
   * 自軍（player1）ラッシュフェイズ。第三の眼を常駐させ、BP5000 の S ユニットをラッシュする。
   * 敵軍（player2）は疾風流超忍法（RS-026・必要パワー3「BP8000以下の敵軍ユニットがラッシュされたとき…」）を使う。
   */
  const board = (hand: CardInstance[], p2Hand: CardInstance[] = [inst("RS-026", "sp")]) => {
    let s = st(
      {
        phase: "rush",
        player1: { operation: [inst("RK-011", "eye")], hand: [inst("SPEC-S5000", "u"), ...hand], command: releasedCat("WB", 1), deck: deckCards(5) },
        player2: { hand: p2Hand, command: releasedCat("MA", 2, "e"), power: powerCards(4, "epw"), deck: deckCards(5, "e") },
      },
      EXTRA,
    );
    s = rushOpen(s, "player1", "SPEC-S5000:u");
    return useCounter(s, "RS-026:sp", "player2");
  };

  it("RK-011: カタログ本文・スペックが出典と一致（出典: atwiki/page-44）", () => {
    expectCatalogText("RK-011", TEXT);
    expectOpStats("RK-011", { name: "第三の眼", category: "ET", powerCost: 2 });
    expectRarityIn("RK-011", ["MR"]);
  });

  it("RK-011: 相手がカウンターを発動したとき、その必要パワー以上の必要パワーを持つ手札のカードを選んで捨札にしてもよい（任意・候補は必要パワー3以上のカード）（出典: atwiki/page-44）", () => {
    const s = board([inst("TST-OP", "c3"), inst("RK-001", "c0"), inst("RK-021", "c4")]);
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-011");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s)).toEqual(["RK-021:c4", "TST-OP:c3"]);
    expect(canSkip(s)).toBe(true);
  });

  it("RK-011: 捨札にすると、そのカウンターの効果は無効になる（ラッシュしたユニットはそのまま）（出典: atwiki/page-44「そうしたとき、そのカウンターの効果は無効になる」）", () => {
    const s = settle(pick(board([inst("TST-OP", "c3")]), "TST-OP:c3"));
    expect(zoneOf(s, "player1", "TST-OP:c3")).toBe("discard");
    expect(zoneOf(s, "player1", "SPEC-S5000:u")).toBe("rush");
    expect(zoneOf(s, "player2", "RS-026:sp")).toBe("discard");
  });

  it("RK-011: 捨札にしなければカウンターの効果は通常どおり（出典: atwiki/page-44「捨札にしてもよい」）", () => {
    const s = settle(skip(board([inst("TST-OP", "c3")])));
    expect(zoneOf(s, "player1", "TST-OP:c3")).toBe("hand");
    expect(zoneOf(s, "player1", "SPEC-S5000:u")).not.toBe("rush");
  });

  it("RK-011: 必要パワーがカウンターより小さいカードしかなければ選べない（出典: atwiki/page-44「それ以上の必要パワーの数字を持つカード」）", () => {
    const s = board([inst("RK-001", "c0")]);
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-011");
    expect(zoneOf(settle(s), "player1", "SPEC-S5000:u")).not.toBe("rush");
  });

  // faq-rider-1 RK-011「はい、できます。」
  it("RK-011: 公式Q&A — 第三の眼で無効にされた後、2枚目の疾風流超忍法を改めて使える（出典: grnrngr/faq-rider-1 RK-011・atwiki/page-44 Q1・grnrngr/faq-card-5 RS-247 Q3）", () => {
    let s = board([inst("TST-OP", "c3")], [inst("RS-026", "sp"), inst("RS-247", "sp2")]);
    s = pick(s, "TST-OP:c3");
    expect(zoneOf(s, "player1", "SPEC-S5000:u")).toBe("rush");
    expect(canCounter(s, "RS-247:sp2", "player2")).toBe(true);
  });

  it("RK-011: 自分が使ったカウンターには発動しない（出典: atwiki/page-44「相手がカウンターを発動したとき」）", () => {
    // 敵軍（player2）ターン、自軍（player1）が宏のオルゴール時計を使う。第三の眼は player1 の常駐。
    let s = st(
      {
        phase: "rush",
        activePlayer: "player2",
        player1: { operation: [inst("RK-011", "eye")], hand: [inst("RK-012", "mb"), inst("TST-OP", "c3")], command: releasedCat("ET", 1), power: powerCards(4), deck: deckCards(5) },
        player2: { hand: [inst("SPEC-S5000", "eu")], command: releasedCat("WB", 1, "e"), deck: deckCards(5, "e") },
      },
      EXTRA,
    );
    s = useCounter(rushOpen(s, "player2", "SPEC-S5000:eu"), "RK-012:mb");
    expect(s.pendingEffectChoice?.sourceCardId).not.toBe("RK-011");
  });
});

// ===========================================================================
describe("RK-012 宏のオルゴール時計", () => {
  const TEXT = "※カウンター（これは敵軍ターン中にのみ使用できる） BP4000以上のSユニットがラッシュされたとき発動できる⇒このターン、相手はバトルフェイズを飛ばす。";

  /** 敵軍（player2）ラッシュフェイズに unit をラッシュする（反応ウィンドウは開いたまま）。 */
  const enemyRush = (unit: string, p1Hand: CardInstance[] = [inst("RK-012", "mb")]) => {
    const [id, suf] = unit.split(":") as [string, string];
    const s = st(
      {
        phase: "rush",
        activePlayer: "player2",
        player1: { hand: p1Hand, command: releasedCat("ET", 1), power: powerCards(4), deck: deckCards(5) },
        player2: { hand: [inst(id, suf)], command: releasedCat("WB", 1, "e"), deck: deckCards(5, "e") },
      },
      EXTRA,
    );
    return rushOpen(s, "player2", unit);
  };

  it("RK-012: カタログ本文・スペックが出典と一致（出典: atwiki/page-198）", () => {
    expectCatalogText("RK-012", TEXT);
    expectOpStats("RK-012", { name: "宏のオルゴール時計", category: "ET", powerCost: 4 });
    expectRarityIn("RK-012", ["MR", "N"]);
  });

  it("RK-012: BP4000 以上の S ユニットがラッシュされたとき使える（BP4000 ちょうども含む）（出典: atwiki/page-198「BP4000以上のSユニット」）", () => {
    expect(canCounter(enemyRush("SPEC-S4000:u"), "RK-012:mb")).toBe(true);
  });

  it("RK-012: BP3000 の S ユニット・BP4000 の M ユニットのラッシュには使えない（出典: atwiki/page-198「BP4000以上のSユニット」）", () => {
    expect(canCounter(enemyRush("SPEC-S3000:u"), "RK-012:mb")).toBe(false);
    expect(canCounter(enemyRush("SPEC-M4000:u"), "RK-012:mb")).toBe(false);
  });

  it("RK-012: このターン、相手はバトルフェイズを飛ばす（ラッシュフェイズを終えるとバトルフェイズに入らない）（出典: atwiki/page-198「このターン、相手はバトルフェイズを飛ばす」）", () => {
    let s = settle(useCounter(enemyRush("SPEC-S5000:u"), "RK-012:mb"));
    expect(zoneOf(s, "player1", "RK-012:mb")).toBe("discard");
    s = nextPhase(s);
    expect(s.phase).not.toBe("battle");
  });

  // faq-rider-1 RK-012 Q2「はい、できます。」・Q4「はい、できます。」
  it("RK-012: 公式Q&A — メカニック忍者で BP4000 以上の S ユニットを自軍ラッシュエリアに出したとき、さらに使え、敵軍バトルフェイズを終了させる（出典: grnrngr/faq-rider-1 RK-012 Q2・Q4・atwiki/page-198 Q2・Q4）", () => {
    let s = enemyAttack(
      { battle: [inst("TST-UNIT-0", "d")], hand: [inst("RK-008", "nin"), inst("RK-012", "mb")], command: [released("SPEC-KAIZO4", "k"), ...releasedCat("ET", 2)], power: powerCards(4) },
      "TST-UNIT-0:d",
      "TST-UNIT-7:atk",
      { battle: [inst("TST-UNIT-0", "e2")] },
    );
    s = useCounter(s, "RK-008:nin", "player1", "SPEC-KAIZO4:k");
    expect(canCounter(s, "RK-012:mb")).toBe(true);
    s = settle(useCounter(s, "RK-012:mb"));
    // バトルフェイズを終了させた: 敵軍はもうアタック・ストライク・バトルエリアへの進入ができず、フェイズを終えることだけができる。
    expect(legal(s).map((a) => a.type)).toEqual(["end_phase"]);
  });

  // faq-rider-1 RK-012 Q3「はい、できます。」
  it("RK-012: 公式Q&A — BP4000 以上8000以下の S ユニットのラッシュに、疾風流超忍法と両方を使える（出典: grnrngr/faq-rider-1 RK-012 Q3・atwiki/page-198 Q3）", () => {
    let s = enemyRush("SPEC-S5000:u", [inst("RK-012", "mb"), inst("RS-247", "sp")]);
    s = { ...s, players: { ...s.players, player1: { ...s.players.player1, command: [...releasedCat("ET", 1), ...releasedCat("MA", 1)] } } };
    s = useCounter(s, "RK-012:mb");
    expect(canCounter(s, "RS-247:sp")).toBe(true);
  });

  it("RK-012: ※カウンター — 自軍ターン中は使えない（出典: atwiki/page-198「これは敵軍ターン中にのみ使用できる」・R-CTR-01）", () => {
    const s = st(
      { phase: "rush", player1: { hand: [inst("SPEC-S5000", "u"), inst("RK-012", "mb")], command: [...releasedCat("WB", 1), ...releasedCat("ET", 1)], power: powerCards(4), deck: deckCards(5) }, player2: { deck: deckCards(5, "e") } },
      EXTRA,
    );
    expect(canCounter(rushOpen(s, "player1", "SPEC-S5000:u"), "RK-012:mb")).toBe(false);
  });

  it.todo(
    "RK-012: 公式Q&A — 【神出鬼没の疾風】でラッシュしたサイクロン・ドーパントのリード ET の効果で使える（出典: atwiki/page-198 Q1）— RK-099・XG7-055 が本範囲外のため",
  );
  it.todo(
    "RK-012: 公式Q&A — 使用後はバトルフェイズ中に発動する効果・ユニットの行動はできず、使用時に処理中だった効果（【エンドオブワールド】の続き）と同じタイミングの効果（モーフ）だけを実行してバトルフェイズを終える（出典: atwiki/page-198 Q5）— RK-115 仮面ライダーゾルダ【エンドオブワールド】の処理途中に割り込む手順を公開 API で組めないため",
  );
  it.todo(
    "RK-012: 公式Q&A — ラッシュされた時点の BP で判定する（ラッシュしたときの効果で BP6000 になった仮面ライダーアギトには使えない）（出典: atwiki/page-198 Q6）— XG3-076 仮面ライダーアギト【覚醒】が本範囲外のため",
  );
  it.todo(
    "RK-012: 公式Q&A — スカイライダーがあるとき、ウイングを持たない本来の BP が4000の S ユニットのラッシュには使えない（出典: atwiki/page-198 Q7）— XG4-087 スカイライダー【スカイキック】が本範囲外のため",
  );
  it.todo(
    "RK-012: 公式Q&A — 手札から使って手札が1枚になり仮面ライダーカリスが BP3000 になっても、相手のバトルフェイズを飛ばせる（出典: grnrngr/faq-rider-2 RK-127 Q）— RK-127 仮面ライダーカリスが本範囲外のため",
  );
});

// ===========================================================================
describe("RK-013 Jパワー", () => {
  const TEXT =
    "自軍Sユニットを1体選ぶ。そして、このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる。このカードに重ねたユニットは特徴「人型」を追加されて「Lユニット」になる。重ねたユニットがユニットでなくなるとき、このカードは捨札になる。";

  const board = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    rushBoard({ hand: [inst("RK-013", "jp")], rush: [inst("SPEC-KAIZO", "k")], command: releasedCat("MA", 1), power: powerCards(4), ...p1 }, p2);
  const powered = (p1: Partial<GameState["players"]["player1"]> = {}, p2: Partial<GameState["players"]["player2"]> = {}) =>
    resolveAll(played(board(p1, p2), "RK-013:jp"), ["SPEC-KAIZO:k"]);

  it("RK-013: カタログ本文・スペックが出典と一致（出典: atwiki/page-211）", () => {
    expectCatalogText("RK-013", TEXT);
    expectOpStats("RK-013", { name: "Jパワー", category: "MA", powerCost: 4 });
    expectRarityIn("RK-013", ["MR"]);
  });

  it("RK-013: 選べるのは自軍 S ユニットだけ（M ユニット・敵軍ユニットは選べない）（出典: atwiki/page-211「自軍Sユニットを1体選ぶ」）", () => {
    const s = played(board({ rush: [inst("SPEC-KAIZO", "k"), inst("SPEC-MALE-M", "m")] }, { rush: [inst("TST-UNIT-0", "e")] }), "RK-013:jp");
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-013");
    expect(choiceIds(s)).toEqual(["SPEC-KAIZO:k"]);
  });

  it("RK-013: 選んだユニットはラッシュエリアに残り、このカードがその下に重なる（捨札にならない）（出典: atwiki/page-211「このカードを自軍ラッシュエリアに置き、選んだユニットをこのカードに重ねる」・grnrngr/faq-rider-2 RK-088 Q「そのユニットの下には…重ねられる」）", () => {
    const s = powered();
    expect(zoneOf(s, "player1", "SPEC-KAIZO:k")).toBe("rush");
    expect(zoneOf(s, "player1", "RK-013:jp")).toBeNull();
    expect((cardIn(s, "player1", "SPEC-KAIZO:k")?.stackedCards ?? []).map((c) => c.instanceId)).toEqual(["RK-013:jp"]);
  });

  it("RK-013: 重ねたユニットは L ユニットになる — 「Sユニット」を選ぶ効果（超電子ダイナモ）に選ばれない（出典: atwiki/page-211「「Lユニット」になる」）", () => {
    let s = powered({ hand: [inst("RK-013", "jp"), inst("RK-005", "dy")], command: [...releasedCat("MA", 1), ...releasedCat("ET", 1)] });
    s = played(s, "RK-005:dy");
    expect(choiceIds(s)).toEqual([]);
  });

  it("RK-013: 重ねたユニットは特徴「人型」が追加され、既存の特徴の後ろに並ぶ（出典: atwiki/page-211「特徴「人型」を追加されて」・grnrngr/faq-rider-1 RK-013 Q7「追加される特徴は、既存の特徴の後ろに順番に追加されていきます」）", () => {
    const s = powered();
    const k = cardIn(s, "player1", "SPEC-KAIZO:k")!;
    expect(unitFeatures(s, "player1", k)).toEqual(["男", "改造人間", "人型"]);
  });

  // faq-rider-1 RK-013 Q4「いいえ、ラッシュしたことにはなりません。」
  it("RK-013: 公式Q&A — 重ねることはユニットのラッシュではない（ラッシュの反応ウィンドウは開かない）（出典: grnrngr/faq-rider-1 RK-013 Q4・atwiki/page-211 Q4）", () => {
    const s = played(board(), "RK-013:jp");
    const t = pick(s, "SPEC-KAIZO:k");
    expect(t.pendingRush).toBeUndefined();
  });

  it("RK-013: 重ねたユニットが撃破されてユニットでなくなるとき、このカードは捨札になる（出典: atwiki/page-211「重ねたユニットがユニットでなくなるとき、このカードは捨札になる」）", () => {
    let s = nextPhase(powered({}, { battle: [inst("TST-UNIT-7", "big")] }));
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: "SPEC-KAIZO:k" });
    s = resolveAll(attack(s, "SPEC-KAIZO:k", "TST-UNIT-7:big"));
    expect(zoneOf(s, "player1", "SPEC-KAIZO:k")).toBe("discard");
    expect(zoneOf(s, "player1", "RK-013:jp")).toBe("discard");
  });

  // faq-rider-1 RK-013 Q2・Q6「いいえ、効果はそのまま継続します。」
  it("RK-013: 公式Q&A — 先に S ユニットを対象にして使ったオペレーション（超電子ダイナモ）の効果は、J パワーで L ユニットになっても続く（出典: grnrngr/faq-rider-1 RK-013 Q2・Q6・atwiki/page-211 Q2・Q6）", () => {
    let s = rushBoard(
      { hand: [inst("RK-005", "dy"), inst("RK-013", "jp")], rush: [inst("SPEC-KAIZO", "k")], command: [...releasedCat("ET", 1), ...releasedCat("MA", 1)], power: powerCards(4) },
      { battle: [inst("TST-UNIT-0", "e")], power: powerCards(3, "epw") },
    );
    s = resolveAll(played(s, "RK-005:dy"), ["SPEC-KAIZO:k"]);
    s = resolveAll(played(s, "RK-013:jp"), ["SPEC-KAIZO:k"]);
    s = act(nextPhase(s), { type: "move_to_battle", playerId: "player1", instanceId: "SPEC-KAIZO:k" });
    s = resolveAll(attack(s, "SPEC-KAIZO:k", "TST-UNIT-0:e"));
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
    expect(damageOf(s, "player2")).toBe(1);
  });

  it("RK-013: 使ったターンが終わっても L ユニットのまま（期間の指定がない）（出典: atwiki/page-211「このカードに重ねたユニットは…「Lユニット」になる」）", () => {
    const s = endTurn(powered());
    const k = cardIn(s, "player1", "SPEC-KAIZO:k")!;
    expect(unitFeatures(s, "player1", k)).toContain("人型");
  });

  it.todo(
    "RK-013: 公式Q&A — CN3 で SP1 になる MA の S ユニットが J パワーで L ユニットになり、トータスハンマーから JC して3番目に並ぶと SP2（出典: grnrngr/faq-rider-1 RK-013 Q1）— RS-224 トータスハンマーの JC 手順を伴い、RS4-222-242.a の todo と同じ理由で組めないため",
  );
  it.todo(
    "RK-013: 公式Q&A — ミラーワールドに重ねたカードと同名の S ユニットが J パワーで L ユニットになっても、ミラーワールドの能力は続く（出典: grnrngr/faq-rider-1 RK-013 Q3・RK-016 Q2）— RK-016 側（RK1-001-021.c）で確かめる",
  );
  it.todo(
    "RK-013: 公式Q&A — RC を持つユニットは J パワーで L ユニットになっても S ビークルにライドできる（出典: grnrngr/faq-rider-1 RK-013 Q5）— ラッシュエリアの L ユニットのライドの合法手（mount_ride）がバトルエリアへの進入と一体で、ライドの可否だけを公開 API で取り出せないため",
  );
  it.todo(
    "RK-013: 公式Q&A — 特徴の並び順が変わるので、J パワーを使ったユニットは「仮面ライダー/男/人型/ディケイドライバー」へのモーフができない（出典: grnrngr/faq-rider-1 RK-013 Q7）— XG3-075 が本範囲外のため",
  );
  it.todo(
    "RK-013: 公式Q&A — J パワーを重ねた魔導騎士ウルザードのサイズ変更とは、ターンプレイヤーが優先順を選ぶ（出典: atwiki/page-211 Q8）— XG3-029 が本範囲外のため",
  );
  it.todo(
    "RK-013: 公式Q&A — ライド中のユニットに使うと、下から「ビークル」「J パワー」「ユニット」の順に重ねる（出典: grnrngr/faq-rider-1 RK-058 Q）— ライド中のユニットへの使用でビークルの扱いを公開 API で観測できないため",
  );
  it.todo(
    "RK-013: 公式Q&A — イマジンとの契約を使ったユニットに続けて使うと、2枚ともそのユニットの下に重ねる（出典: grnrngr/faq-rider-2 RK-088 Q）— RK-088 が本範囲外のため",
  );
});

// ===========================================================================
describe("RK-014 共同戦線", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる） 自軍バトルエリアに特徴「警察」を持つユニットがある間、特徴「仮面ライダー」を持つ自軍ユニットは、敵軍Sユニットにアタックされない。";

  /** 敵軍（player2）バトルフェイズ。player2 の S（TST-UNIT-0）と M（TST-UNIT-2）がバトルエリアにいる。 */
  const board = (p1: Partial<GameState["players"]["player1"]>, withOp = true, p2battle: CardInstance[] = []) =>
    st(
      {
        activePlayer: "player2",
        player1: { operation: withOp ? [inst("RK-014", "kd")] : [], deck: deckCards(5), ...p1 },
        player2: { battle: [inst("TST-UNIT-0", "es"), inst("TST-UNIT-2", "em"), ...p2battle], deck: deckCards(5, "e") },
      },
      EXTRA,
    );

  it("RK-014: カタログ本文・スペックが出典と一致（出典: atwiki/page-212）", () => {
    expectCatalogText("RK-014", TEXT);
    expectOpStats("RK-014", { name: "共同戦線", category: "MA", powerCost: 2 });
    expectRarityIn("RK-014", ["MR"]);
  });

  it("RK-014: 自軍バトルエリアに「警察」があれば、「仮面ライダー」の自軍ユニットは敵軍 S ユニットにアタックされない（出典: atwiki/page-212）", () => {
    const s = board({ battle: [inst("SPEC-POLICE", "p"), inst("SPEC-RIDER", "r")] });
    expect(attackersOf(s, "SPEC-RIDER:r")).toEqual(["TST-UNIT-2:em"]);
  });

  it("RK-014: 「仮面ライダー」を持たない自軍ユニットはアタックされる（出典: atwiki/page-212「特徴「仮面ライダー」を持つ自軍ユニットは」）", () => {
    const s = board({ battle: [inst("SPEC-POLICE", "p"), inst("TST-UNIT-0", "x")] });
    expect(attackersOf(s, "TST-UNIT-0:x")).toEqual(["TST-UNIT-0:es", "TST-UNIT-2:em"]);
  });

  it("RK-014: 「警察」がラッシュエリアにしかいなければ守られない（出典: atwiki/page-212「自軍バトルエリアに特徴「警察」を持つユニットがある間」）", () => {
    const s = board({ battle: [inst("SPEC-RIDER", "r")], rush: [inst("SPEC-POLICE", "p")] });
    expect(attackersOf(s, "SPEC-RIDER:r")).toContain("TST-UNIT-0:es");
  });

  it("RK-014: 敵軍バトルエリアの「警察」では守られない（出典: atwiki/page-212「自軍バトルエリアに」）", () => {
    const s = board({ battle: [inst("SPEC-RIDER", "r")] }, true, [inst("SPEC-POLICE", "ep")]);
    expect(attackersOf(s, "SPEC-RIDER:r")).toContain("TST-UNIT-0:es");
  });

  it("RK-014: 「警察」と「仮面ライダー」を両方持つユニット自身も守られる（出典: atwiki/page-212 カード評価「特徴「警察」に「仮面ライダー」を持つているので敵からアタックされず」）", () => {
    const s = board({ battle: [inst("SPEC-POLICE-RIDER", "pr")] });
    expect(attackersOf(s, "SPEC-POLICE-RIDER:pr")).toEqual(["TST-UNIT-2:em"]);
  });

  it("RK-014: 配置していなければアタックされる（出典: atwiki/page-212・R-KW-PERM-01）", () => {
    const s = board({ battle: [inst("SPEC-POLICE", "p"), inst("SPEC-RIDER", "r")] }, false);
    expect(attackersOf(s, "SPEC-RIDER:r")).toContain("TST-UNIT-0:es");
  });
});

void MALE;
