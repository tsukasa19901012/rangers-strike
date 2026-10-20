/**
 * カード別スペック: RS-257〜RS-263（第5弾「五龍の逆鱗」野球仮面〜タンクコマンド）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当カードのエラッタなし）、grnrngr/faq-card-5
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_5.html）
 *     ほか card_1/card_2/card_3/card_6/rider_1 の相互参照
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *  3. docs/rules/*.md の一般ルール
 * 例外2（README §1.2）: atwiki/page-453 RS-263 Q5 の「（2010/02/08 修正）」付き回答は、取得済みの公式 faq-rider_1 RK-048 の
 * 回答（「いいえ、発動できません」）より優先する（ユーザー決定）。
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import { deckCopyUnlimited, validateDeckEntries, type CardDefinition } from "@rangers-strike/cards";
import {
  act,
  attack,
  attackTargets,
  bpOf,
  canEnter,
  canSkip,
  canStrike,
  choiceIds,
  confirm,
  DEFS,
  deckCards,
  drain,
  endTurn,
  enter,
  enterWithHold,
  expectCatalogText,
  expectStats,
  fillers,
  held,
  inst,
  legal,
  passEntry,
  pick,
  powerCards,
  released,
  rushFromHand,
  settle,
  skip,
  spOf,
  st,
  strike,
  sUnit,
  toPhase,
  tryAct,
  useCard,
  zoneOf,
  CMD,
} from "./RS5-243-263.helpers";
import type { CardInstance, GameState } from "../types/game";

/** 保留中の選択で、候補にあれば want を、なければ先頭を選び続ける（最大 n 回）。 */
function pickAll(s: GameState, want: string[], n = 6): GameState {
  let next = s;
  for (let i = 0; i < n && next.pendingEffectChoice; i += 1) {
    const p = next.pendingEffectChoice;
    const id = want.find((w) => p.validInstanceIds.includes(w)) ?? p.validInstanceIds[0];
    if (!id) break;
    const r = tryAct(next, { type: "resolve_effect_choice", playerId: p.playerId, instanceId: id });
    if (!r.ok) break;
    next = r.state;
  }
  return next;
}
const ncLogged = (s: GameState, cardId: string) => s.log.some((l) => l.includes("number_combo") && l.includes(cardId));

// ===========================================================================
describe("RS-257 野球仮面", () => {
  const TEXT =
    "【予告ホームラン】敵軍山札の上から1枚をオモテにしてもよい。そうしたとき、オモテにしたカードと同じ必要パワーの数字を持つ自軍コマンドを1つホールドできれば、そのカードを持ち主のパワーゾーンにダメージにして置く。できなければ、そのカードを持ち主の手札に加える。";

  /** 野球仮面を pos 番目に出す。敵軍山札の上は top。 */
  function homerun(top: string, commands: CardInstance[], pos = 1) {
    let s = st({
      player1: { battle: fillers(pos - 1), rush: [inst("RS-257", "y")], command: commands, deck: deckCards(3) },
      player2: { deck: [inst(top, "top"), ...deckCards(2, "e")] },
    });
    s = enter(s, "RS-257:y");
    return s;
  }

  it("RS-257: カタログ本文・スペックが出典と一致（出典: atwiki/page-432）", () => {
    expectCatalogText("RS-257", TEXT);
    expectStats("RS-257", { name: "野球仮面", category: "DA", size: "S", bp: 2000, sp: undefined, powerCost: 2, comboNumber: 1, features: ["怪人", "男"] });
  });

  it("RS-257: SP が「－」なのでストライクできない（出典: atwiki/page-432「SP：－」）", () => {
    const s = homerun("TST-UNIT-2", []);
    expect(canStrike(passEntry(s), "RS-257:y")).toBe(false);
  });

  it("RS-257: 1番目に出て NC が成立すると敵軍山札の上をオモテにしてよい。同じ必要パワー（2）の自軍コマンドをホールドすれば、そのカードは持ち主のパワーゾーンにダメージとして置かれる（出典: atwiki/page-432）", () => {
    let s = homerun("TST-UNIT-2", [released("TST-UNIT-2", "c2"), released("TST-OP-ET", "c1")]);
    expect(ncLogged(s, "RS-257")).toBe(true);
    expect(canSkip(s)).toBe(true);
    s = pickAll(s, ["TST-UNIT-2:top", "TST-UNIT-2:c2"], 4);
    s = settle(s);
    expect(s.players.player1.command.find((c) => c.instanceId === "TST-UNIT-2:c2")?.commandHeld).toBe(true);
    const placed = s.players.player2.power.find((c) => c.instanceId === "TST-UNIT-2:top");
    expect(placed?.faceDown).toBe(true);
    expect(s.players.player2.damage).toBe(1);
  });

  it("RS-257: 同じ必要パワーの自軍コマンドがなければ（ホールドできなければ）、オモテにしたカードは持ち主の手札に加わる（出典: atwiki/page-432「できなければ、そのカードを持ち主の手札に加える」）", () => {
    let s = homerun("TST-UNIT-2", [released("TST-OP-ET", "c1")]);
    s = pickAll(s, ["TST-UNIT-2:top"], 4);
    s = settle(s);
    expect(zoneOf(s, "player2", "TST-UNIT-2:top")).toBe("hand");
    expect(s.players.player2.damage).toBe(0);
  });

  it("RS-257: オモテにしないことを選べば何も起きない（出典: atwiki/page-432「オモテにしてもよい」）", () => {
    let s = homerun("TST-UNIT-2", [released("TST-UNIT-2", "c2")]);
    if (s.pendingEffectChoice && canSkip(s)) s = skip(s);
    s = settle(s);
    expect(s.players.player2.deck[0]?.instanceId).toBe("TST-UNIT-2:top");
    expect(s.players.player1.command[0]?.commandHeld).toBe(false);
  });

  it("RS-257: 1番目以外（2番目）に出れば NC は成立せず、何も起きない（出典: atwiki/page-432「CN：1」・R-CN-02）", () => {
    const s = settle(homerun("TST-UNIT-2", [released("TST-UNIT-2", "c2")], 2));
    expect(ncLogged(s, "RS-257")).toBe(false);
    expect(s.players.player2.deck[0]?.instanceId).toBe("TST-UNIT-2:top");
    expect(s.players.player2.damage).toBe(0);
  });

  // faq-card-5 RS-257 Q1（atwiki Q1）「いいえ、ホールドしたくなければしなくても構いません。ただしその場合は…「できなければ」以降のテキストに従ってください。」
  it("RS-257: 公式Q&A — ホールドできるときもホールドしなくてよい。その場合はカードを持ち主の手札に加える（出典: grnrngr/faq-card-5 RS-257 Q1・atwiki/page-432 Q1）", () => {
    let s = homerun("TST-UNIT-2", [released("TST-UNIT-2", "c2")]);
    s = pickAll(s, ["TST-UNIT-2:top"], 1);
    expect(canSkip(s)).toBe(true);
    s = settle(skip(s));
    expect(s.players.player1.command[0]?.commandHeld).toBe(false);
    expect(zoneOf(s, "player2", "TST-UNIT-2:top")).toBe("hand");
  });

  // faq-card-5 RS-257 Q2（atwiki Q2）「「オモテにしたカードの必要パワーと同じ必要パワーのカードをホールドする」と解釈してください。」
  it("RS-257: 公式Q&A — 比べるのは必要パワーどうし（必要パワー2のカードに対し、ナンバー2で必要パワー1のマジブルーはホールドに使えず手札へ）（出典: grnrngr/faq-card-5 RS-257 Q2・atwiki/page-432 Q2）", () => {
    let s = homerun("TST-UNIT-2", [released("RS-059", "cn2")]);
    s = pickAll(s, ["TST-UNIT-2:top"], 4);
    s = settle(s);
    expect(s.players.player1.command[0]?.commandHeld).toBe(false);
    expect(zoneOf(s, "player2", "TST-UNIT-2:top")).toBe("hand");
  });
});

// ===========================================================================
describe("RS-258 アオレンジャー", () => {
  const TEXT =
    "【ブルーチェリー】敵軍コマンドゾーンからホールド状態のカードを1枚選び、持ち主のパワーゾーンに送ってもよい。（この効果は特徴「グリーン」を持つユニットからコンビネーションするときはナンバーに関係なく発動する）";

  function ao(before: CardInstance[], p2cmd: CardInstance[] = [held("TST-OP", "h"), released("TST-OP", "r")]) {
    let s = st({ player1: { battle: before, rush: [inst("RS-258", "ao")] }, player2: { command: p2cmd } });
    return enter(s, "RS-258:ao");
  }

  it("RS-258: カタログ本文・スペックが出典と一致（出典: atwiki/page-459）", () => {
    expectCatalogText("RS-258", TEXT);
    expectStats("RS-258", { name: "アオレンジャー", category: "ET", size: "S", bp: 3000, sp: undefined, powerCost: 1, comboNumber: 4, features: ["ブルー", "男"] });
  });

  it("RS-258: SP が「－」なのでストライクできない（出典: atwiki/page-459「SP：－」）", () => {
    expect(canStrike(passEntry(skip(ao(fillers(3)))), "RS-258:ao")).toBe(false);
  });

  it("RS-258: 4番目で NC が成立すると、敵軍のホールド状態のコマンドだけを選べ、持ち主のパワーゾーンに送る（出典: atwiki/page-459）", () => {
    let s = ao(fillers(3));
    expect(choiceIds(s)).toEqual(["TST-OP:h"]);
    s = pick(s, "TST-OP:h");
    expect(zoneOf(s, "player2", "TST-OP:h")).toBe("power");
    expect(zoneOf(s, "player2", "TST-OP:r")).toBe("command");
  });

  it("RS-258: 送らないことを選べる（出典: atwiki/page-459「送ってもよい」）", () => {
    const s0 = ao(fillers(3));
    expect(canSkip(s0)).toBe(true);
    expect(zoneOf(skip(s0), "player2", "TST-OP:h")).toBe("command");
  });

  it("RS-258: 4番目以外（2番目）で、直前がグリーンでなければ発動しない（出典: atwiki/page-459「CN：4」・R-CN-02）", () => {
    const s = ao(fillers(1));
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "TST-OP:h")).toBe("command");
  });

  it("RS-258: 特徴「グリーン」のユニット（ミドレンジャー）からコンビネーションすると、ナンバーに関係なく（2番目でも）発動する（出典: atwiki/page-459「（この効果は特徴「グリーン」を持つユニットからコンビネーションするときはナンバーに関係なく発動する）」）", () => {
    const s = ao([inst("RS-190", "mido")]);
    expect(choiceIds(s)).toEqual(["TST-OP:h"]);
  });

  it("RS-258: グリーンのユニットが直前でなければ（間に別のユニット）ナンバーどおりでないと発動しない（出典: atwiki/page-459「からコンビネーションするとき」・R-CN-05）", () => {
    const s = ao([inst("RS-190", "mido"), inst("TST-UNIT-0", "f")]);
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  it("RS-258: ホールド状態の敵軍コマンドがなければ選択は開かない（出典: atwiki/page-459）", () => {
    const s = ao(fillers(3), [released("TST-OP", "r")]);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(s, "player2", "TST-OP:r")).toBe("command");
  });
});

// ===========================================================================
describe("RS-259 モモレンジャー", () => {
  const TEXT =
    "【ゴレンジャーハリケーン】このターン、このユニットから「キレンジャー，ミドレンジャー，アオレンジャー，アカレンジャー」の順にコンビネーションしたとき、BP8000以下の敵軍ユニットをすべて撃破する。このとき、その「アカレンジャー」は「SP2」になる。";
  const E8 = sUnit("SPEC-E8", { bp: 8000 });
  const E9 = sUnit("SPEC-E9", { bp: 9000 });
  const GORENGER = ["RS-259:momo", "RS-189:ki", "RS-190:mido", "RS-258:ao", "RS-126:aka"];

  function chain(order: string[], p2: Partial<GameState["players"]["player2"]>, extra: CardDefinition[] = [E8, E9], prefer: string[] = []) {
    let s = st(
      {
        player1: { rush: order.map((id) => inst(id.split(":")[0]!, id.split(":")[1]!)), deck: deckCards(5) },
        player2: { deck: deckCards(5, "e"), ...p2 },
      },
      extra,
    );
    for (const id of order) {
      s = enter(s, id);
      s = settle(pickAll(drain(s, "player1", prefer), prefer));
      if (id !== order.at(-1)) s = passEntry(s);
    }
    return s;
  }

  it("RS-259: カタログ本文・スペックが出典と一致（出典: atwiki/page-460）", () => {
    expectCatalogText("RS-259", TEXT);
    expectStats("RS-259", { name: "モモレンジャー", category: "ET", size: "S", bp: 2000, sp: undefined, powerCost: 0, comboNumber: 1, features: ["ピンク", "女"] });
  });

  it("RS-259: モモ→キ→ミド→アオ→アカの順にコンビネーションすると、BP8000以下の敵軍ユニット（バトルエリア・ラッシュエリア）をすべて撃破する（BP9000 は残る）（出典: atwiki/page-460）", () => {
    const s = chain(GORENGER, { battle: [inst("SPEC-E8", "b8")], rush: [inst("SPEC-E8", "r8"), inst("SPEC-E9", "r9")] });
    expect(zoneOf(s, "player2", "SPEC-E8:b8")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E8:r8")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-E9:r9")).toBe("rush");
  });

  // 「このとき、その「アカレンジャー」は「SP2」になる」
  it("RS-259: そのアカレンジャーは「SP2」になり、ストライクで2点を与える（出典: atwiki/page-460「その「アカレンジャー」は「SP2」になる」）", () => {
    let s = chain(GORENGER, { battle: [inst("SPEC-E9", "b9")], power: powerCards(4, "ep") });
    expect(spOf(s, "player1", "RS-126:aka")).toBe(2);
    s = settle(strike(s, "RS-126:aka"));
    expect(s.players.player2.damage).toBe(2);
  });

  it("RS-259: 順番が違えば（キとミドが逆）発動しない（出典: atwiki/page-460「の順にコンビネーションしたとき」）", () => {
    const s = chain(["RS-259:momo", "RS-190:mido", "RS-189:ki", "RS-258:ao", "RS-126:aka"], { battle: [inst("SPEC-E8", "b8")] });
    expect(zoneOf(s, "player2", "SPEC-E8:b8")).toBe("battle");
    expect(spOf(s, "player1", "RS-126:aka")).not.toBe(2);
  });

  it("RS-259: モモレンジャーから始まらなければ（モモがない）発動しない（出典: atwiki/page-460「このユニットから」）", () => {
    const s = chain(["TST-UNIT-0:f", "RS-189:ki", "RS-190:mido", "RS-258:ao", "RS-126:aka"], { battle: [inst("SPEC-E8", "b8")] });
    expect(zoneOf(s, "player2", "SPEC-E8:b8")).toBe("battle");
  });

  it("RS-259: SP が「－」なのでモモレンジャーはストライクできない（出典: atwiki/page-460「SP：－」）", () => {
    const s = st({ player1: { rush: [inst("RS-259", "momo")] } });
    expect(canStrike(passEntry(enter(s, "RS-259:momo")), "RS-259:momo")).toBe(false);
  });

  // faq-card-5 RS-259 Q1（atwiki Q1）「その場合は「RS-259 モモレンジャー」が撃破したことになります。」
  it.todo(
    "RS-259: 公式Q&A — ゴレンジャーハリケーンで撃破したのはモモレンジャー（出典: grnrngr/faq-card-5 RS-259 Q1・atwiki/page-460 Q1・faq-rider_1 RK-005）— 「どのユニットが撃破したか」を公開 API で観測する手段がない（超電子ダイナモ RK-005 の対象は特徴「改造人間」のユニットに限られ、モモレンジャーには使えない）",
  );

  // faq-card-5 RS-259 Q2（atwiki Q2）「はい、SP２になります。」
  it("RS-259: 公式Q&A — 1体も撃破できなくても、そのアカレンジャーは「SP2」になる（出典: grnrngr/faq-card-5 RS-259 Q2・atwiki/page-460 Q2）", () => {
    const s = chain(GORENGER, { battle: [inst("SPEC-E9", "b9")] });
    expect(zoneOf(s, "player2", "SPEC-E9:b9")).toBe("battle");
    expect(spOf(s, "player1", "RS-126:aka")).toBe(2);
  });

  // faq-card-5 RS-259 Q3（atwiki Q3・faq-card-1 RS-052）「はい、場にとどまります。…撃破の処理は対象になったユニットの中からターンプレイヤーが１体づつ順に選び行います。」
  it("RS-259: 公式Q&A — 敵軍の爆竜トリケラトプス2体のうち1体目を2体目の【超シールド進化】で守れば、1体目は場にとどまる（対象は選び直されない）（出典: grnrngr/faq-card-5 RS-259 Q3・atwiki/page-460 Q3）", () => {
    let s = st(
      {
        player1: { rush: GORENGER.map((id) => inst(id.split(":")[0]!, id.split(":")[1]!)), deck: deckCards(5) },
        player2: { battle: [inst("RS-052", "t1"), inst("RS-052", "t2")], deck: deckCards(5, "e") },
      },
      [],
    );
    for (const id of GORENGER) {
      s = enter(s, id);
      for (let i = 0; i < 12; i += 1) {
        const acts = legal(s);
        // 相手: 1体目（t1）が撃破されるとき、2体目（t2）の【超シールド進化】でかわりに捨札にする
        const shield = acts.find((a) => a.type === "use_super_shield" && a.playerId === "player2");
        if (shield && zoneOf(s, "player2", "RS-052:t2") === "battle") {
          s = act(s, shield);
          if (s.pendingEffectChoice?.playerId === "player2" && s.pendingEffectChoice.validInstanceIds.includes("RS-052:t2")) s = pick(s, "RS-052:t2");
          continue;
        }
        const p = s.pendingEffectChoice;
        if (p?.playerId === "player1") {
          const conf = acts.find((a) => a.type === "confirm_effect_choice");
          if (conf) {
            s = act(s, conf);
            continue;
          }
          const first = acts.find((a) => a.type === "resolve_effect_choice");
          if (!first) break;
          s = act(s, first);
          continue;
        }
        const pass = acts.find((a) => a.type.startsWith("pass_") && a.type !== "pass_battle_entry");
        if (!pass) break;
        s = act(s, pass);
      }
      if (id !== GORENGER.at(-1)) s = passEntry(s);
    }
    expect(zoneOf(s, "player2", "RS-052:t2")).toBe("discard");
    expect(zoneOf(s, "player2", "RS-052:t1")).toBe("battle");
  });

  // faq-card-5 RS-259 Q4（atwiki Q4・faq-card-3 RS-126 Q1）「その「RS-126 アカレンジャー」自体がＳＰ２になる…「レッドビュート」を発動させられなかったとしても…ＳＰ２でストライクすることができます。」
  it("RS-259: 公式Q&A — そのアカレンジャー自体が SP2 になり、【レッドビュート】（NC）がタンクコマンドで発動できなくても SP2 でストライクできる（出典: grnrngr/faq-card-5 RS-259 Q4・atwiki/page-460 Q4）", () => {
    let s = chain(GORENGER, {
      rush: [inst("RS-263", "tank")],
      command: [released("RS-062", "cn5"), held("TST-OP", "h")],
      battle: [inst("TST-UNIT-2", "def")],
    }, [], ["TST-OP:h"]);
    expect(canStrike(s, "RS-126:aka")).toBe(true);
    s = settle(strike(s, "RS-126:aka"));
    expect(s.players.player2.damage).toBe(2);
  });

  it("RS-259: 公式Q&A（補足）— SP2 になるのは「その」アカレンジャーだけで、別のアカレンジャーは SP2 にならない（出典: grnrngr/faq-card-5 RS-259 Q4「すべての「アカレンジャー」というユニットがSP２になるという意味ではありません」）", () => {
    // 1番目に別のアカレンジャー、2〜6番目でゴレンジャーハリケーン（6番目のアカレンジャーは【レッドビュート】が成立しない）
    const s = chain(["RS-126:other", ...GORENGER], { battle: [inst("SPEC-E9", "b9")] });
    expect(spOf(s, "player1", "RS-126:aka")).toBe(2);
    expect(spOf(s, "player1", "RS-126:other")).not.toBe(2);
  });

  // faq-card-6 RS-364 Q「いいえ。【ゴレンジャーハリケーン】の効果は、その発動時点で「ＢＰ８０００以下のユニット」のみが対象となります。」
  it("RS-259: 公式Q&A — 敵軍のヘルサターン総統で BP+3000 されて BP8000 を超えているユニットは、総統が先に撃破されても対象にならない（発動時点で対象を決める）（出典: grnrngr/faq-card-6 RS-364 Q）", () => {
    const DA6 = sUnit("SPEC-DA6", { category: "DA", bp: 6000 });
    const s = chain(GORENGER, { battle: [inst("RS-364", "hs")], rush: [inst("SPEC-DA6", "da")] }, [DA6]);
    expect(zoneOf(s, "player2", "RS-364:hs")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-DA6:da")).toBe("rush");
  });

  // faq-card-6 RS-407 Q「その「アカレンジャー」はストライクすることができません。…【ゴレンジャーハリケーン】は発動できます。」
  it.todo(
    "RS-259: 公式Q&A — 天空大聖者マジエルと闇のヤイバがあるとき、ゴレンジャーハリケーンは発動するが、DA が追加されたアカレンジャーはストライクできない（出典: grnrngr/faq-card-6 RS-407 Q）— RS-407・RS-339（範囲外）の組み合わせ効果の実装状況に依存し、本カードの検証として切り分けられない",
  );

  // faq-rider_1 RK-005 Q「「RS-259 モモレンジャー」に使用してください。これは、実際に撃破する効果を持っているのが「RS-259 モモレンジャー」だからです。」
  it.todo(
    "RS-259: 公式Q&A — 超電子ダイナモは、撃破する効果を持つモモレンジャーに使う（出典: grnrngr/faq-rider_1 RK-005 Q）— RK-005 の対象は特徴「改造人間」のユニットだけで、モモレンジャー（特徴ピンク／女）を対象にする手順を公開 API で組めない",
  );
});

// ===========================================================================
describe("RS-260 バイオドラゴン", () => {
  const TEXT =
    "【母艦】これが自軍ラッシュエリアにある間、自分が特徴「航空機」を持つ「OT」のMユニットをラッシュするとき、追加条件を満たすために次のようにしてもよい⇒自軍Sユニットを1体パワーゾーンに送るかわりに、「OT」の自軍コマンドを1つホールドし、自軍山札の上から1枚を自軍パワーゾーンに置く。";

  /** タンクコマンド（OT・M・航空機。追加条件: 自軍Sユニット1体をパワーゾーンに送る）を手札から、バイオドラゴンの【母艦】でラッシュする。 */
  function mothershipRush(s: GameState): { ok: boolean; state: GameState } {
    let r = tryAct(s, { type: "begin_zord_setup", playerId: "player1", zordInstanceId: "RS-263:tank" });
    if (!r.ok) return r;
    for (let i = 0; i < 8 && r.ok && r.state.pendingZordSetup; i += 1) {
      const step = r.state.pendingZordSetup.step;
      r = tryAct(r.state, step === "material" ? { type: "resolve_zord_setup", playerId: "player1", paymentPath: "mothership" } : { type: "resolve_zord_setup", playerId: "player1" });
    }
    for (let i = 0; i < 6 && r.ok && r.state.pendingCommandPayment?.playerId === "player1"; i += 1) {
      const p = r.state.pendingCommandPayment;
      r = tryAct(r.state, { type: "resolve_command_payment", playerId: "player1", commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded) });
    }
    if (r.ok) r = { ok: true, state: settle(r.state) };
    return r;
  }
  function bio(p1: Partial<GameState["players"]["player1"]> = {}) {
    return st({
      phase: "rush",
      player1: {
        hand: [inst("RS-263", "tank")],
        rush: [inst("RS-260", "bd")],
        command: [released(CMD.OT, "o1"), released(CMD.OT, "o2")],
        power: powerCards(4),
        deck: [inst("TST-OP", "top"), ...deckCards(3)],
        ...p1,
      },
    });
  }

  it("RS-260: カタログ本文・スペックが出典と一致（出典: atwiki/page-456）", () => {
    expectCatalogText("RS-260", TEXT);
    expectStats("RS-260", { name: "バイオドラゴン", category: "OT", size: "XL", bp: 4000, sp: undefined, powerCost: 5, comboNumber: undefined, features: ["メカ", "母艦"] });
  });

  it("RS-260: S ユニットがなく母艦もなければ、タンクコマンドはラッシュできない（対照）（出典: atwiki/page-453 追加条件・R-ADD-01）", () => {
    const s = bio({ rush: [] });
    expect(rushFromHand(s, "player1", "RS-263:tank").ok).toBe(false);
  });

  it("RS-260: ラッシュエリアにあれば、OT の航空機 M ユニット（タンクコマンド）の追加条件のかわりに OT の自軍コマンドを1つホールドし、山札の上から1枚をパワーゾーンに置いてラッシュできる（出典: atwiki/page-456）", () => {
    const r = mothershipRush(bio());
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-263:tank")).toBe("rush");
    expect(r.state.players.player1.command.every((c) => c.commandHeld)).toBe(true);
    expect(zoneOf(r.state, "player1", "TST-OP:top")).toBe("power");
  });

  it("RS-260: 「してもよい」— S ユニットがあれば通常どおり S ユニットをパワーゾーンに送ってラッシュできる（出典: atwiki/page-456）", () => {
    const s = bio({ rush: [inst("RS-260", "bd"), inst("TST-UNIT-0", "s")] });
    const r = rushFromHand(s, "player1", "RS-263:tank", { materials: ["TST-UNIT-0:s"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-263:tank")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:s")).toBe("power");
  });

  it("RS-260: バイオドラゴンがラッシュエリアになければ（バトルエリアにあれば）使えない（出典: atwiki/page-456「これが自軍ラッシュエリアにある間」）", () => {
    const s = bio({ rush: [], battle: [inst("RS-260", "bd")] });
    expect(mothershipRush(s).ok && zoneOf(mothershipRush(s).state, "player1", "RS-263:tank") === "rush").toBe(false);
  });

  it("RS-260: 特徴「航空機」を持たない OT の M ユニットには使えない（出典: atwiki/page-456「特徴「航空機」を持つ「OT」のMユニット」）", () => {
    const NOAIR = sUnit("SPEC-OT-M", { size: "M", category: "OT", bp: 5000, powerCost: "4+", features: ["メカ"], rushAdditionalCondition: { conditionId: "send_s_unit_to_power", text: "自軍Sユニットを1体パワーゾーンに送る", unitCount: 1 } } as Partial<CardDefinition>);
    const s = st(
      {
        phase: "rush",
        player1: { hand: [inst("SPEC-OT-M", "m")], rush: [inst("RS-260", "bd")], command: [released(CMD.OT, "o1"), released(CMD.OT, "o2")], power: powerCards(4), deck: deckCards(3) },
      },
      [NOAIR],
    );
    let r = tryAct(s, { type: "begin_zord_setup", playerId: "player1", zordInstanceId: "SPEC-OT-M:m" });
    if (r.ok) r = tryAct(r.state, { type: "resolve_zord_setup", playerId: "player1", paymentPath: "mothership" });
    expect(r.ok && zoneOf(r.state, "player1", "SPEC-OT-M:m") === "rush").toBe(false);
  });

  // faq-card-5 RS-260 Q1（faq-card-2 RS-322）「はい、その通りです。」
  it("RS-260: 公式Q&A — 相手のベン・G【人身略取】で、追加条件のための S ユニットがなくてもバイオドラゴンで満たせるなら、満たさなければならない（出典: grnrngr/faq-card-5 RS-260 Q1・faq-card-2 RS-322）", () => {
    let s = st({
      activePlayer: "player2",
      player1: { rush: [inst("RS-260", "bd")], command: [released(CMD.OT, "o1")], deck: [inst("TST-OP", "top"), ...deckCards(3)] },
      player2: { rush: [inst("RS-322", "ben")], hand: [inst("RS-263", "tank")], deck: deckCards(3, "e") },
    });
    s = enter(s, "RS-322:ben", "player2");
    s = pickAll(s, ["RS-263:tank", "TST-OP-OT:o1"], 6);
    s = settle(s);
    expect(zoneOf(s, "player2", "RS-263:tank")).toBe("discard");
    expect(s.players.player1.command[0]?.commandHeld).toBe(true);
    expect(zoneOf(s, "player1", "TST-OP:top")).toBe("power");
  });
});

// ===========================================================================
describe("RS-261 メラージュ戦闘機", () => {
  const TEXT = "※このカードはデッキに好きな枚数入れてもよい。";

  function melage(p1: Partial<GameState["players"]["player1"]> = {}) {
    return st({
      phase: "rush",
      player1: { hand: [inst("RS-261", "mf")], command: [released(CMD.DA, "c")], power: powerCards(2), deck: deckCards(3), ...p1 },
    });
  }

  it("RS-261: カタログ本文・スペックが出典と一致（出典: atwiki/page-436）", () => {
    expectCatalogText("RS-261", TEXT);
    expectStats("RS-261", { name: "メラージュ戦闘機", category: "DA", size: "M", bp: 3500, sp: undefined, powerCost: "2+", comboNumber: undefined, features: ["メカ", "航空機"], rushCondition: "send_s_unit_to_discard" });
  });

  it("RS-261: 追加条件 — 自軍 S ユニットを1体捨札にしてラッシュできる（出典: atwiki/page-436「追加条件：自軍Sユニットを1体捨札にする」）", () => {
    const r = rushFromHand(melage({ rush: [inst("TST-UNIT-0", "s")] }), "player1", "RS-261:mf", { materials: ["TST-UNIT-0:s"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-261:mf")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:s")).toBe("discard");
  });

  it("RS-261: 自軍 S ユニットがなければ（M ユニットだけでは）ラッシュできない（出典: atwiki/page-436・R-ADD-01）", () => {
    expect(rushFromHand(melage({ rush: [inst("TST-UNIT-2", "m")] }), "player1", "RS-261:mf").ok).toBe(false);
  });

  it("RS-261: 必要パワー2+ — パワー1ではラッシュできない（出典: atwiki/page-436「必要パワー：2+」）", () => {
    expect(rushFromHand(melage({ rush: [inst("TST-UNIT-0", "s")], power: powerCards(1) }), "player1", "RS-261:mf").ok).toBe(false);
  });

  it("RS-261: デッキに好きな枚数入れてよい（4枚以上でも同名枚数制限にかからない）（出典: atwiki/page-436「※このカードはデッキに好きな枚数入れてもよい」・R-DECK-03）", () => {
    expect(deckCopyUnlimited(DEFS["RS-261"]!)).toBe(true);
    const result = validateDeckEntries([{ cardId: "RS-261", count: 40 }]);
    expect(result.errors).toEqual([]);
  });
});

// ===========================================================================
describe("RS-262 フラッシュキング", () => {
  const TEXT =
    "合体―タンクコマンド＋ジェットデルタ＋ジェットシーカー【スーパーコズモフラッシュ】自軍ターン中、これがバトルエリアに出たとき、自軍パワーゾーンにあるダメージ以外のカードから、「OT」以外のカードを2枚選び捨札にしてもよい。そうしたとき、このターン、これは「SP2」になる。";
  const OT_ET = { id: "SPEC-OP-ET-OT", name: "SPEC-OP-ET-OT", type: "operation", category: ["ET", "OT"], rarity: "N", expansion: "card-spec", powerCost: 1 } as unknown as CardDefinition;

  function flash(power: CardInstance[]) {
    let s = st({ player1: { rush: [inst("RS-262", "fk")], power, deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }, [OT_ET]);
    s = enter(s, "RS-262:fk");
    return s;
  }

  it("RS-262: カタログ本文・スペックが出典と一致（出典: atwiki/page-452）", () => {
    expectCatalogText("RS-262", TEXT);
    expectStats("RS-262", { name: "フラッシュキング", category: "OT", size: "L", bp: 14000, sp: 1, powerCost: "6+", comboNumber: undefined, features: ["メカ", "人型"], rushCondition: "discard_fusion_unit" });
  });

  function fusion(rush: CardInstance[], power = 6) {
    return st({ phase: "rush", player1: { hand: [inst("RS-262", "fk")], rush, command: [released(CMD.OT, "c")], power: powerCards(power), deck: deckCards(3) } });
  }
  const PARTS = () => [inst("RS-263", "tank"), inst("RS-264", "delta"), inst("RS-265", "seeker")];

  it("RS-262: 合体 — タンクコマンド＋ジェットデルタ＋ジェットシーカーを捨札にしてラッシュできる（出典: atwiki/page-452「合体―…」・R-ADD-06）", () => {
    const r = rushFromHand(fusion(PARTS()), "player1", "RS-262:fk", { materials: ["RS-263:tank", "RS-264:delta", "RS-265:seeker"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-262:fk")).toBe("rush");
    for (const id of ["RS-263:tank", "RS-264:delta", "RS-265:seeker"]) expect(zoneOf(r.state, "player1", id)).toBe("discard");
  });

  it("RS-262: 合体素材が1つ欠けていればラッシュできない（出典: atwiki/page-452・R-ADD-06）", () => {
    expect(rushFromHand(fusion(PARTS().slice(0, 2)), "player1", "RS-262:fk").ok).toBe(false);
  });

  it("RS-262: 必要パワー6+ — パワー5ではラッシュできない（出典: atwiki/page-452「必要パワー：6+」）", () => {
    expect(rushFromHand(fusion(PARTS(), 5), "player1", "RS-262:fk").ok).toBe(false);
  });

  it("RS-262: 何もしなければ「SP1」でストライクできる（出典: atwiki/page-452「SP：1」）", () => {
    const s = flash([]);
    expect(canStrike(s, "RS-262:fk")).toBe(true);
    expect(spOf(s, "player1", "RS-262:fk")).toBe(1);
  });

  it("RS-262: 自軍ターン中にバトルエリアに出たとき、パワーゾーンのダメージ以外の「OT」以外のカード2枚を捨札にすれば、このターン「SP2」になる（出典: atwiki/page-452）", () => {
    let s = flash([inst("TST-OP", "w1"), inst("TST-OP-ET", "e1"), inst("TST-OP-OT", "o1"), { ...inst("TST-OP", "dmg"), faceDown: true }]);
    expect(choiceIds(s)).toEqual(["TST-OP-ET:e1", "TST-OP:w1"]);
    s = pick(s, "TST-OP:w1");
    s = pick(s, "TST-OP-ET:e1");
    if (legal(s).some((a) => a.type === "confirm_effect_choice")) s = confirm(s);
    expect(zoneOf(s, "player1", "TST-OP:w1")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP-ET:e1")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-OP-OT:o1")).toBe("power");
    expect(spOf(s, "player1", "RS-262:fk")).toBe(2);
  });

  it("RS-262: 「してもよい」— 捨札にしないことを選べ、その場合は「SP1」のまま（出典: atwiki/page-452「捨札にしてもよい」）", () => {
    let s = flash([inst("TST-OP", "w1"), inst("TST-OP-ET", "e1")]);
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player1", "TST-OP:w1")).toBe("power");
    expect(spOf(s, "player1", "RS-262:fk")).toBe(1);
  });

  it("RS-262: ダメージ以外の「OT」以外のカードが2枚なければ（1枚＋ダメージ1枚）発動できず「SP1」のまま（出典: atwiki/page-452「ダメージ以外のカードから…2枚選び」）", () => {
    const s = flash([inst("TST-OP", "w1"), { ...inst("TST-OP-ET", "dmg"), faceDown: true }, inst("TST-OP-OT", "o1")]);
    expect(s.pendingEffectChoice?.effectId === "supakozumofurashu").toBe(false);
    expect(spOf(s, "player1", "RS-262:fk")).toBe(1);
    expect(zoneOf(s, "player1", "TST-OP:w1")).toBe("power");
  });

  it("RS-262: 「SP2」は「このターン」だけ（次の自軍ターンは SP1）（出典: atwiki/page-452「このターン、これは「SP2」になる」）", () => {
    let s = flash([inst("TST-OP", "w1"), inst("TST-OP-ET", "e1")]);
    s = pickAll(s, ["TST-OP:w1", "TST-OP-ET:e1"], 2);
    if (legal(s).some((a) => a.type === "confirm_effect_choice")) s = confirm(s);
    expect(spOf(s, "player1", "RS-262:fk")).toBe(2);
    s = endTurn(passEntry(s));
    s = toPhase(s, "player1", "battle");
    const fk = s.players.player1.battle.concat(s.players.player1.rush).find((c) => c.instanceId === "RS-262:fk");
    expect(fk).toBeDefined();
    expect(spOf(s, "player1", "RS-262:fk")).toBe(1);
  });

  it.todo(
    "RS-262: 敵軍ターン中にバトルエリアに出たときは発動しない（出典: atwiki/page-452「自軍ターン中、」）— 敵軍ターン中に L ユニットをバトルエリアに出す手段（ファイブテクター等は S ユニット限定）が公開 API で組めない",
  );

  // faq-card-5 RS-262 Q1（atwiki Q1）「いいえ、それはできません。OTを含むカードは「OTのカードである」として扱われます。」
  it("RS-262: Q&A — OT を含むマルチカテゴリ（ET/OT）のカードは捨札に選べない（出典: atwiki/page-452 Q1）", () => {
    const s = flash([inst("TST-OP", "w1"), inst("TST-OP-ET", "e1"), inst("SPEC-OP-ET-OT", "mc")]);
    expect(choiceIds(s)).toEqual(["TST-OP-ET:e1", "TST-OP:w1"]);
  });
});

// ===========================================================================
describe("RS-263 タンクコマンド", () => {
  const TEXT =
    "【弾幕タンクコマンドミサイル】これが自軍ラッシュエリアにある間、リリース状態の自軍コマンドに、ナンバーを持つユニットカードがあれば、カードに表記された本来のナンバーがそのユニットカードと同じSユニットは、ＮＣの効果を発動できない。";

  /** マジブルー（CN2【未来予知】1枚ドロー）を2番目に出す。tank: タンクコマンドの位置と持ち主、cmd: タンク持ち主のコマンド。 */
  function blue(opts: { tankOwner?: "player1" | "player2"; tankZone?: "rush" | "battle"; cmd: CardInstance[] }) {
    const owner = opts.tankOwner ?? "player1";
    const tank = inst("RS-263", "tank");
    const p1Extra = owner === "player1" ? { [opts.tankZone ?? "rush"]: [tank], command: opts.cmd } : {};
    const p2Extra = owner === "player2" ? { [opts.tankZone ?? "rush"]: [tank], command: opts.cmd } : {};
    let s = st({
      player1: { battle: [inst("TST-UNIT-0", "f")], rush: [inst("RS-059", "blue")], deck: deckCards(5), ...p1Extra } as Partial<GameState["players"]["player1"]>,
      player2: { deck: deckCards(5, "e"), ...p2Extra } as Partial<GameState["players"]["player2"]>,
    });
    if (owner === "player1" && (opts.tankZone ?? "rush") === "rush") {
      s = { ...s, players: { ...s.players, player1: { ...s.players.player1, rush: [inst("RS-263", "tank"), inst("RS-059", "blue")] } } };
    }
    s = settle(enter(s, "RS-059:blue"));
    return s;
  }
  const drew = (s: GameState) => s.players.player1.hand.length;

  it("RS-263: カタログ本文・スペックが出典と一致（出典: atwiki/page-453）", () => {
    expectCatalogText("RS-263", TEXT);
    expectStats("RS-263", { name: "タンクコマンド", category: "OT", size: "M", bp: 5000, sp: undefined, powerCost: "4+", comboNumber: undefined, features: ["メカ", "車両", "航空機"], rushCondition: "send_s_unit_to_power" });
  });

  function tankRush(rush: CardInstance[], power = 4) {
    return st({ phase: "rush", player1: { hand: [inst("RS-263", "t")], rush, command: [released(CMD.OT, "c")], power: powerCards(power), deck: deckCards(3) } });
  }

  it("RS-263: 追加条件 — 自軍 S ユニットを1体パワーゾーンに送ってラッシュできる（出典: atwiki/page-453「追加条件：自軍Sユニットを1体パワーゾーンに送る」）", () => {
    const r = rushFromHand(tankRush([inst("TST-UNIT-0", "s")]), "player1", "RS-263:t", { materials: ["TST-UNIT-0:s"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-263:t")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-UNIT-0:s")).toBe("power");
  });

  it("RS-263: S ユニットがなければラッシュできず、必要パワー4+ — パワー3でもラッシュできない（出典: atwiki/page-453）", () => {
    expect(rushFromHand(tankRush([inst("TST-UNIT-2", "m")]), "player1", "RS-263:t").ok).toBe(false);
    expect(rushFromHand(tankRush([inst("TST-UNIT-0", "s")], 3), "player1", "RS-263:t").ok).toBe(false);
  });

  it("RS-263: SP が「－」なのでストライクできない（出典: atwiki/page-453「SP：－」）", () => {
    const s = st({ player1: { rush: [inst("RS-263", "t")] } });
    expect(canStrike(passEntry(enter(s, "RS-263:t")), "RS-263:t")).toBe(false);
  });

  it("RS-263: ラッシュエリアにあり、リリース状態の自軍コマンドにナンバー2のユニットカードがあれば、本来のナンバー2の S ユニット（マジブルー）は NC を発動できない（出典: atwiki/page-453）", () => {
    const s = blue({ cmd: [released("RS-059", "cmd")] });
    expect(drew(s)).toBe(0);
  });

  it("RS-263: そのコマンドがホールド状態なら制限されない（対照）（出典: atwiki/page-453「リリース状態の自軍コマンドに」）", () => {
    expect(drew(blue({ cmd: [held("RS-059", "cmd")] }))).toBe(1);
  });

  it("RS-263: リリース状態のコマンドのナンバーが違えば（3）制限されない（対照）（出典: atwiki/page-453「…と同じSユニットは」）", () => {
    expect(drew(blue({ cmd: [released("RS-058", "cmd")] }))).toBe(1);
  });

  it("RS-263: タンクコマンドがバトルエリアにあるときは制限されない（出典: atwiki/page-453「これが自軍ラッシュエリアにある間」）", () => {
    expect(drew(blue({ tankZone: "battle", cmd: [released("RS-059", "cmd")] }))).toBe(1);
  });

  // faq-card-5 RS-263 Q1（atwiki Q1）「い いえ、できません。…ナンバーコンビネーションではないライディングコンビネーション（RC）やジョイントコンビネーション（JC）を発動できなくすることはできません。」
  // faq-card-6 RS-419 Q「…「RS-263 タンクコマンド」で発動できなくなるのは「ナンバーコンビネーション」ですので、それ以外のコンビネーションは問題なく発動することができます。」
  it("RS-263: 公式Q&A — ジョイントコンビネーション（ガオエレファント「R」）は、同じナンバー（R）のカードがリリース状態でも発動できる（出典: grnrngr/faq-card-5 RS-263 Q1・faq-card-6 RS-419 Q）", () => {
    let s = st({
      player1: {
        battle: [inst("TST-UNIT-7", "L")],
        rush: [inst("RS-263", "tank"), inst("RS-158", "el")],
        command: [released("TST-OP", "c"), released("RS-158", "cmdR")],
      },
    });
    s = enterWithHold(s, "RS-158:el", ["TST-OP:c"]);
    expect(s.pendingEffectChoice?.effectId).toBe("elephant_shield");
  });

  // faq-card-5 RS-263 Q2（atwiki Q2）「はい、その通りです。」
  it("RS-263: 公式Q&A — 自軍と敵軍の両方に適用される（敵軍のタンクコマンドと敵軍のリリース状態のコマンドで、自軍のマジブルーの NC が発動できない）（出典: grnrngr/faq-card-5 RS-263 Q2・atwiki/page-453 Q2）", () => {
    expect(drew(blue({ tankOwner: "player2", cmd: [released("RS-059", "cmd")] }))).toBe(0);
    expect(drew(blue({ tankOwner: "player2", cmd: [held("RS-059", "cmd")] }))).toBe(1);
  });

  // faq-card-5 RS-263 Q3（atwiki Q3）「はい、その通りです。」（技名の後に「SP1」しか書かれていないユニットはその「SP1」が発動できない効果）
  it("RS-263: 公式Q&A — 技名の後に「SP1」だけのユニット（ボウケンレッド CN5）は、その「SP1」が発動できずストライクできない（出典: grnrngr/faq-card-5 RS-263 Q3・atwiki/page-453 Q3）", () => {
    const red = (cmd: CardInstance) => {
      let s = st({ player1: { battle: fillers(4), rush: [inst("RS-263", "tank"), inst("RS-062", "red")], command: [cmd] } });
      s = enter(s, "RS-062:red");
      return s;
    };
    expect(canStrike(red(released("RS-062", "cmd")), "RS-062:red")).toBe(false);
    expect(canStrike(red(held("RS-062", "cmd")), "RS-062:red")).toBe(true);
  });

  // faq-card-5 RS-263 Q4（atwiki Q4・faq-card-1 RS-015 Q1・faq-card-3 RS-140）「参照するのは、「カードに表記された本来のナンバー」だけです。」
  it("RS-263: 公式Q&A — 参照するのは本来のナンバー。バードニックウェーブでナンバー3になったマジピンク（本来4）も、ナンバー4のカードがリリース状態なら NC を発動できない（出典: grnrngr/faq-card-5 RS-263 Q4・atwiki/page-453 Q4）", () => {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-254", "bw")],
        rush: [inst("TST-UNIT-0", "f1"), inst("TST-UNIT-0", "f2"), inst("RS-060", "pink"), inst("RS-263", "tank")],
        command: [released(CMD.ET, "et"), released("RS-060", "cmdPink")],
        power: powerCards(2),
        deck: deckCards(5),
      },
      player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(5, "e") },
    });
    s = useCard(s, "player1", "RS-254:bw");
    s = toPhase(s, "player1", "battle");
    s = passEntry(enter(s, "TST-UNIT-0:f1"));
    s = passEntry(enter(s, "TST-UNIT-0:f2"));
    s = enter(s, "RS-060:pink");
    expect(s.pendingEffectChoice?.sourceCardId === "RS-060").toBe(false);
    expect(ncLogged(s, "RS-060")).toBe(false);
  });

  // atwiki/page-453 Q5「はい、そのまま処理を実行して下さい。…すでに発動したNCの効果を無効にすることは出来ません。（2010/02/08 修正）」
  // 公式 faq-rider_1 RK-048 の回答（「いいえ、発動できません」）は atwiki の日付つき修正で上書き（README §1.2 例外2）。
  it("RS-263: Q&A — 仮面ライダー斬鬼（CN2）の NC で CN2 のコマンドをリリースしても、すでに発動した NC はそのまま実行する（出典: atwiki/page-453 Q5（2010/02/08 修正）・例外2で faq-rider_1 RK-048 より優先）", () => {
    let s = st({
      player1: {
        battle: [inst("TST-UNIT-0", "f")],
        rush: [inst("RS-263", "tank"), inst("RK-048", "zanki")],
        command: [held("RS-059", "cn2"), held("TST-OP", "h2")],
        deck: deckCards(3),
      },
      player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") },
    });
    s = enter(s, "RK-048:zanki");
    // 選ぶユニット（必要パワー0）→ 1つ多い数＝1つのコマンドをリリース（CN2 のカードを選ぶ）
    s = pickAll(s, ["TST-UNIT-0:e", "RS-059:cn2"], 4);
    for (let i = 0; i < 3 && s.pendingCommandPayment; i += 1) {
      const p = s.pendingCommandPayment;
      const ids = p.validInstanceIds.includes("RS-059:cn2") ? ["RS-059:cn2"] : p.validInstanceIds.slice(0, p.totalNeeded);
      s = act(s, { type: "resolve_command_payment", playerId: p.playerId, commandInstanceIds: ids });
    }
    s = settle(s);
    expect(s.players.player1.command.find((c) => c.instanceId === "RS-059:cn2")?.commandHeld).toBe(false);
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
  });
});

void attack;
void attackTargets;
void bpOf;
void canEnter;
