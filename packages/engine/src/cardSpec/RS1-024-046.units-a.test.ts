/**
 * カード仕様テスト: RS-031〜RS-041（第1弾「英雄の再誕」ユニット: サンバルカン／ジュウレンジャー）。
 * 出典の優先順位と方針は RS1-024-046.ops.test.ts 冒頭を参照。
 */
import { describe, expect, it } from "vitest";
import { effectiveBp } from "../core/catalog";
import {
  CMD,
  act,
  attack,
  battleEntryHoldsRequired,
  canUse,
  cardDef,
  choiceOptions,
  choose,
  deck,
  endTurn,
  enterBattle,
  expectTextMatches,
  findCard,
  heldCount,
  held,
  inst,
  legal,
  mk,
  passEntry,
  passReactions,
  powers,
  released,
  resolveEffectHolds,
  rush,
  tryEnterBattle,
  tryRush,
  unitDef,
  zoneOf,
} from "./RS1-024-046.helpers";
import type { CardInstance, GameState, PlayerId } from "./RS1-024-046.helpers";

function fillers(n: number, prefix = "f"): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst("SPEC-S-1000", `${prefix}${i}`));
}

function canStrike(state: GameState, playerId: PlayerId, instanceId: string): boolean {
  return legal(state).some(
    (a) => a.type === "strike" && a.playerId === playerId && a.instanceId === instanceId,
  );
}

function bpOf(state: GameState, playerId: PlayerId, instanceId: string): number {
  return effectiveBp(state, playerId, findCard(state, playerId, instanceId)!);
}

const EXTRA = {
  "SPEC-M-4500": unitDef("SPEC-M-4500", { bp: 4500, size: "M" }),
  "SPEC-M-5500": unitDef("SPEC-M-5500", { bp: 5500, size: "M" }),
  "SPEC-S-1500": unitDef("SPEC-S-1500", { bp: 1500, size: "S" }),
  "SPEC-S-4500": unitDef("SPEC-S-4500", { bp: 4500, size: "S" }),
  "SPEC-S-WB-4000-NOSP": unitDef("SPEC-S-WB-4000-NOSP", { bp: 4000, size: "S", sp: undefined }),
};

// ===========================================================================
describe("RS-031 バルイーグル", () => {
  const SOURCE =
    "【イーグルダイビング】SP1このターン、これはBP＋2000される。（この効果は「バルシャーク」または「バルパンサー」からコンビネーションするときはナンバーに関係なく発動する）";

  it("RS-031: カタログのテキストが原文と一致する（出典: atwiki/page-33 テキスト）", () => {
    expectTextMatches("RS-031", SOURCE);
  });

  it("RS-031: ET の Sユニット BP3000・SP！・必要パワー4・CN5・特徴レッド／男（出典: atwiki/page-33）", () => {
    const def = cardDef("RS-031")!;
    expect(def.type).toBe("unit");
    expect(def.category).toBe("ET");
    expect(def.size).toBe("S");
    expect(def.bp).toBe(3000);
    expect(def.sp).toBe("special");
    expect(def.powerCost).toBe(4);
    expect(def.comboNumber).toBe(5);
    expect(def.features).toEqual(["レッド", "男"]);
  });

  it("RS-031: 5番目に出ると SP1 になり、このターン BP＋2000（出典: atwiki/page-33 / R-CN-02）", () => {
    const eagle = inst("RS-031", "eagle");
    let state = mk({ phase: "battle", player1: { rush: [eagle], battle: fillers(4) } });
    state = enterBattle(state, "player1", eagle.instanceId);
    expect(canStrike(state, "player1", eagle.instanceId)).toBe(true);
    expect(bpOf(state, "player1", eagle.instanceId)).toBe(5000);
  });

  it("RS-031: 5番目でなく、左隣もバルシャーク／バルパンサーでなければ発動しない（SP！のまま）（出典: R-CN-02 / R-STK-02）", () => {
    const eagle = inst("RS-031", "eagle");
    let state = mk({ phase: "battle", player1: { rush: [eagle], battle: fillers(2) } });
    state = enterBattle(state, "player1", eagle.instanceId);
    expect(canStrike(state, "player1", eagle.instanceId)).toBe(false);
    expect(bpOf(state, "player1", eagle.instanceId)).toBe(3000);
  });

  it("RS-031: バルシャークからコンビネーションすると番号に関係なく発動する（2番目）（出典: atwiki/page-33「ナンバーに関係なく発動」）", () => {
    const shark = inst("RS-032", "shark");
    const eagle = inst("RS-031", "eagle");
    let state = mk({ phase: "battle", player1: { rush: [eagle], battle: [shark] } });
    state = enterBattle(state, "player1", eagle.instanceId);
    expect(canStrike(state, "player1", eagle.instanceId)).toBe(true);
    expect(bpOf(state, "player1", eagle.instanceId)).toBe(5000);
  });

  it("RS-031: バルパンサーからコンビネーションしても番号に関係なく発動する（出典: atwiki/page-33）", () => {
    const panther = inst("RS-033", "panther");
    const eagle = inst("RS-031", "eagle");
    let state = mk({ phase: "battle", player1: { rush: [eagle], battle: [inst("SPEC-S-1000", "x"), panther] } });
    state = enterBattle(state, "player1", eagle.instanceId);
    expect(canStrike(state, "player1", eagle.instanceId)).toBe(true);
  });

  it("RS-031: 1番目がバルシャークでも、間に別のユニットがあれば発動しない（出典: grnrngr/faq-card-1 RS-031 Q1）", () => {
    // 「いいえ、その場合は発動しません。」
    const shark = inst("RS-032", "shark");
    const eagle = inst("RS-031", "eagle");
    let state = mk({ phase: "battle", player1: { rush: [eagle], battle: [shark, inst("SPEC-S-1000", "mid")] } });
    state = enterBattle(state, "player1", eagle.instanceId);
    expect(canStrike(state, "player1", eagle.instanceId)).toBe(false);
    expect(bpOf(state, "player1", eagle.instanceId)).toBe(3000);
  });

  it("RS-031: 「このターン」なので、次の相手ターン中は BP＋2000 されていない（出典: grnrngr/faq-card-1 RS-031 Q2）", () => {
    // 「相手のターン中は発動していません」
    const eagle = inst("RS-031", "eagle");
    let state = mk({ phase: "battle", player1: { rush: [eagle], battle: fillers(4) } });
    state = enterBattle(state, "player1", eagle.instanceId);
    state = passEntry(state);
    state = endTurn(state);
    expect(state.activePlayer).toBe("player2");
    expect(bpOf(state, "player1", eagle.instanceId)).toBe(3000);
  });
});

// ===========================================================================
describe("RS-032 バルシャーク", () => {
  const SOURCE =
    "【シャークジョーズ】これがアタックするとき、敵軍ユニットのBPをカードに表記された本来の値としてバトルする。（この効果は「バルイーグル」または「バルパンサー」からコンビネーションするときは、ナンバーに関係なく発動する）";

  /** 敵軍: 本来BP1000 だが修正で 5000 のユニット。 */
  function setup(battle: CardInstance[]) {
    const shark = inst("RS-032", "shark");
    const enemy = { ...inst("SPEC-S-1000", "enemy"), bpModifier: 4000 };
    const state = mk({ phase: "battle", definitions: EXTRA, player1: { rush: [shark], battle }, player2: { battle: [enemy] } });
    return { shark, enemy, state };
  }

  it("RS-032: カタログのテキストが原文と一致する（出典: atwiki/page-73 テキスト）", () => {
    expectTextMatches("RS-032", SOURCE);
  });

  it("RS-032: ET の Sユニット BP2000・SP空欄・必要パワー1・CN5・特徴ブルー／男（出典: atwiki/page-73）", () => {
    const def = cardDef("RS-032")!;
    expect(def.category).toBe("ET");
    expect(def.size).toBe("S");
    expect(def.bp).toBe(2000);
    expect(def.sp).toBeUndefined();
    expect(def.powerCost).toBe(1);
    expect(def.comboNumber).toBe(5);
    expect(def.features).toEqual(["ブルー", "男"]);
  });

  it("RS-032: 5番目に出てアタックすると、敵軍ユニットの BP を本来の値（1000）としてバトルし勝つ（出典: atwiki/page-73 テキスト）", () => {
    const { shark, enemy, state } = setup(fillers(4));
    let s = enterBattle(state, "player1", shark.instanceId);
    s = passReactions(attack(s, "player1", shark.instanceId, enemy.instanceId));
    expect(zoneOf(s, "player2", enemy.instanceId)).toBe("discard");
    expect(zoneOf(s, "player1", shark.instanceId)).toBe("battle");
  });

  it("RS-032: バルイーグルからコンビネーションすると番号に関係なく発動する（出典: atwiki/page-73「ナンバーに関係なく発動」）", () => {
    const { shark, enemy, state } = setup([inst("RS-031", "eagle")]);
    let s = enterBattle(state, "player1", shark.instanceId);
    s = passReactions(attack(s, "player1", shark.instanceId, enemy.instanceId));
    expect(zoneOf(s, "player2", enemy.instanceId)).toBe("discard");
  });

  it("RS-032: コンビネーションしなければ修正後の BP（5000）とバトルして負ける（出典: R-CN-02 / atwiki/page-73）", () => {
    const { shark, enemy, state } = setup(fillers(1));
    let s = enterBattle(state, "player1", shark.instanceId);
    s = passReactions(attack(s, "player1", shark.instanceId, enemy.instanceId));
    expect(zoneOf(s, "player2", enemy.instanceId)).toBe("battle");
    expect(zoneOf(s, "player1", shark.instanceId)).toBe("discard");
  });

  it("RS-032: アタックされるときは効果がない（修正後の BP で負ける）（出典: atwiki/page-73「これがアタックするとき」）", () => {
    const shark = inst("RS-032", "shark");
    const enemy = { ...inst("SPEC-S-1000", "enemy"), bpModifier: 4000 };
    let s = mk({ phase: "battle", activePlayer: "player2", player1: { battle: [shark] }, player2: { battle: [enemy] } });
    s = passReactions(attack(s, "player2", enemy.instanceId, shark.instanceId));
    expect(zoneOf(s, "player1", shark.instanceId)).toBe("discard");
  });
});

// ===========================================================================
describe("RS-033 バルパンサー", () => {
  const SOURCE =
    "【パンサークロー】これがアタックするとき、相手はカウンターを発動できない。（この効果は「バルイーグル」または「バルシャーク」からコンビネーションするときは、ナンバーに関係なく発動する）";

  /** 守備側 player2 は 新体操アクション（自軍Sユニットがアタックされたとき）とダイノガッツを構える。 */
  function setup(battle: CardInstance[]) {
    const panther = inst("RS-033", "panther");
    const enemy = inst("SPEC-S-1000", "enemy");
    const state = mk({
      phase: "battle",
      player1: { rush: [panther], battle },
      player2: {
        battle: [enemy],
        hand: [inst("RS-006", "gym"), inst("RS-027", "guts")],
        command: [released(CMD.ET, "e"), released(CMD.WB, "w")],
        power: powers(4),
        deck: deck(5),
      },
    });
    return { panther, enemy, state };
  }

  it("RS-033: カタログのテキストが原文と一致する（出典: atwiki/page-74 テキスト）", () => {
    expectTextMatches("RS-033", SOURCE);
  });

  it("RS-033: ET の Sユニット BP3000・SP空欄・必要パワー2・CN5・特徴イエロー／男（出典: atwiki/page-74）", () => {
    const def = cardDef("RS-033")!;
    expect(def.category).toBe("ET");
    expect(def.size).toBe("S");
    expect(def.bp).toBe(3000);
    expect(def.sp).toBeUndefined();
    expect(def.powerCost).toBe(2);
    expect(def.comboNumber).toBe(5);
    expect(def.features).toEqual(["イエロー", "男"]);
  });

  it("RS-033: コンビネーションしないアタックには相手はカウンター（新体操アクション）を使える（出典: R-CTR-01 / atwiki/page-74）", () => {
    const { panther, enemy, state } = setup(fillers(1));
    let s = enterBattle(state, "player1", panther.instanceId);
    s = attack(s, "player1", panther.instanceId, enemy.instanceId);
    expect(canUse(s, "player2", "RS-006:gym")).toBe(true);
  });

  it("RS-033: 5番目に出てアタックするとき、相手はカウンター（新体操アクション）を発動できない（出典: atwiki/page-74 テキスト）", () => {
    const { panther, enemy, state } = setup(fillers(4));
    let s = enterBattle(state, "player1", panther.instanceId);
    s = attack(s, "player1", panther.instanceId, enemy.instanceId);
    expect(canUse(s, "player2", "RS-006:gym")).toBe(false);
  });

  it("RS-033: バルイーグルからコンビネーションすると番号に関係なく発動する（出典: atwiki/page-74「ナンバーに関係なく発動」）", () => {
    const { panther, enemy, state } = setup([inst("RS-031", "eagle")]);
    let s = enterBattle(state, "player1", panther.instanceId);
    s = attack(s, "player1", panther.instanceId, enemy.instanceId);
    expect(canUse(s, "player2", "RS-006:gym")).toBe(false);
  });

  it("RS-033: 封じはアタック宣言から次の宣言まで。そのバトルで撃破されたユニットにダイノガッツも使えない（出典: grnrngr/faq-card-1 RS-033 Q）", () => {
    // 「「RS-027 ダイノガッツ」も…発動することはできません」
    const { panther, enemy, state } = setup(fillers(4));
    let s = enterBattle(state, "player1", panther.instanceId);
    s = attack(s, "player1", panther.instanceId, enemy.instanceId);
    // 撃破されて場を離れるところまで進める（カウンター以外の窓はパス）
    expect(canUse(s, "player2", "RS-027:guts")).toBe(false);
    for (let i = 0; i < 4 && zoneOf(s, "player2", enemy.instanceId) === "battle"; i += 1) {
      expect(canUse(s, "player2", "RS-027:guts")).toBe(false);
      const pass = legal(s).find((a) => a.type.startsWith("pass_") && a.playerId === "player2");
      if (!pass) break;
      s = act(s, pass);
    }
    expect(zoneOf(s, "player2", enemy.instanceId)).toBe("discard");
  });
});

// ===========================================================================
describe("RS-034 大獣神", () => {
  const SOURCE =
    "合体―守護獣ティラノザウルス＋守護獣ジュウマンモス＋守護獣トリケラトプス＋守護獣サーベルタイガー＋守護獣プテラノドン【守護獣の神】これがバトルエリアにあるとき、これ以外の「WB」のユニットすべてはBP＋2000される。";
  const PARTS = ["RS-035", "RS-036", "RS-037", "RS-038", "RS-039"];

  it("RS-034: カタログのテキストが原文と一致する（出典: atwiki/page-76 テキスト）", () => {
    expectTextMatches("RS-034", SOURCE);
  });

  it("RS-034: WB の Lユニット BP17000・SP1・必要パワー8+・追加条件「自軍合体ユニットを捨札にする」・特徴恐竜／人型（出典: atwiki/page-76）", () => {
    const def = cardDef("RS-034")!;
    expect(def.category).toBe("WB");
    expect(def.size).toBe("L");
    expect(def.bp).toBe(17000);
    expect(def.sp).toBe(1);
    expect(def.powerCost).toBe("8+");
    expect(def.rushAdditionalCondition?.text).toBe("自軍合体ユニットを捨札にする");
    expect(def.features).toEqual(["恐竜", "人型"]);
  });

  it("RS-034: 合体に列挙された5体を自軍エリアから捨札にしてラッシュできる（出典: atwiki/page-76 合体 / R-ADD-06）", () => {
    const god = inst("RS-034", "god");
    const parts = PARTS.map((id, i) => inst(id, `p${i}`));
    const state = mk({ player1: { hand: [god], rush: parts, power: powers(8), command: [released(CMD.WB, "c")] } });
    const next = rush(state, "player1", god.instanceId, parts[0]!.instanceId);
    expect(zoneOf(next, "player1", god.instanceId)).toBe("rush");
    for (const p of parts) expect(zoneOf(next, "player1", p.instanceId)).toBe("discard");
  });

  it("RS-034: 合体ユニットが1体でも欠けるとラッシュできない（出典: R-ADD-06「表記されたユニットを全て」）", () => {
    const god = inst("RS-034", "god");
    const parts = PARTS.slice(0, 4).map((id, i) => inst(id, `p${i}`));
    const state = mk({ player1: { hand: [god], rush: parts, power: powers(8), command: [released(CMD.WB, "c")] } });
    const r = tryRush(state, "player1", god.instanceId, parts[0]!.instanceId);
    expect(r.ok && zoneOf(r.state, "player1", god.instanceId) === "rush").toBe(false);
  });

  it("RS-034: パワー7ではラッシュできない（出典: atwiki/page-76 必要パワー8+）", () => {
    const god = inst("RS-034", "god");
    const parts = PARTS.map((id, i) => inst(id, `p${i}`));
    const state = mk({ player1: { hand: [god], rush: parts, power: powers(7), command: [released(CMD.WB, "c")] } });
    const r = tryRush(state, "player1", god.instanceId, parts[0]!.instanceId);
    expect(r.ok && zoneOf(r.state, "player1", god.instanceId) === "rush").toBe(false);
  });

  it("RS-034: バトルエリアにあるとき、これ以外の自軍 WB ユニットは BP＋2000（ラッシュエリアのユニットも）（出典: atwiki/page-76【守護獣の神】）", () => {
    const god = inst("RS-034", "god");
    const a = inst("SPEC-S-1000", "a");
    const b = inst("SPEC-S-1000", "b");
    const state = mk({ phase: "battle", player1: { battle: [god, a], rush: [b] } });
    expect(bpOf(state, "player1", a.instanceId)).toBe(3000);
    expect(bpOf(state, "player1", b.instanceId)).toBe(3000);
    expect(bpOf(state, "player1", god.instanceId)).toBe(17000);
  });

  it("RS-034: WB 以外のユニットは BP＋2000 されない（出典: atwiki/page-76「WB」のユニット）", () => {
    const god = inst("RS-034", "god");
    const et = inst("SPEC-S-ET", "et");
    const state = mk({ phase: "battle", player1: { battle: [god, et] } });
    expect(bpOf(state, "player1", et.instanceId)).toBe(1000);
  });

  it("RS-034: ラッシュエリアにあるときは効果がない（出典: atwiki/page-76「これがバトルエリアにあるとき」）", () => {
    const god = inst("RS-034", "god");
    const a = inst("SPEC-S-1000", "a");
    const state = mk({ player1: { rush: [god, a] } });
    expect(bpOf(state, "player1", a.instanceId)).toBe(1000);
  });

  it.fails("RS-034: 【守護獣の神】は敵軍の WB ユニットにも適用される（出典: grnrngr/faq-card-1 RS-034 Q）", () => {
    // 既知の不具合: CARD-RS-034 BP＋2000 が自軍ユニットにしか適用されない
    // 「はい、適用されます。」
    const god = inst("RS-034", "god");
    const enemy = inst("SPEC-S-1000", "enemy");
    const state = mk({ phase: "battle", player1: { battle: [god] }, player2: { battle: [enemy] } });
    expect(bpOf(state, "player2", enemy.instanceId)).toBe(3000);
  });
});

// ===========================================================================
/** ※これは自軍コマンドを1つホールドしなければバトルエリアに出られない（RS-035〜RS-039 共通）。 */
function holdToEnterTests(cardId: string, page: string) {
  it(`${cardId}: バトルエリアに出るには自軍コマンドを1つホールドする（出典: ${page} ※）`, () => {
    const unit = inst(cardId, "u");
    const state = mk({ phase: "battle", player1: { rush: [unit], command: [released(CMD.WB, "c")] } });
    expect(battleEntryHoldsRequired(state, "player1", unit.instanceId)).toBe(1);
    const next = enterBattle(state, "player1", unit.instanceId);
    expect(zoneOf(next, "player1", unit.instanceId)).toBe("battle");
    expect(heldCount(next, "player1")).toBe(1);
  });

  it(`${cardId}: ホールドできるコマンドがなければバトルエリアに出られない（出典: ${page} ※ / R-BA-03）`, () => {
    const unit = inst(cardId, "u");
    const state = mk({ phase: "battle", player1: { rush: [unit], command: [held(CMD.WB, "c")] } });
    expect(battleEntryHoldsRequired(state, "player1", unit.instanceId)).toBeNull();
    const r = tryEnterBattle(state, "player1", unit.instanceId);
    expect(r.ok && zoneOf(r.state, "player1", unit.instanceId) === "battle").toBe(false);
  });

  it(`${cardId}: ホールドするコマンドのカテゴリは問わない（ET のコマンドでもよい）（出典: grnrngr/faq-card-1 RS-051 Q1 / R-CMD-03）`, () => {
    // 「カテゴリ名を指定されていないので、どのカテゴリでも構いません」
    const unit = inst(cardId, "u");
    const state = mk({ phase: "battle", player1: { rush: [unit], command: [released(CMD.ET, "c")] } });
    const next = enterBattle(state, "player1", unit.instanceId);
    expect(zoneOf(next, "player1", unit.instanceId)).toBe("battle");
  });
}

describe("RS-035 守護獣ティラノザウルス", () => {
  const SOURCE =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【ティラノソニック】これをラッシュしたとき、BP5000以下のユニットを自軍と敵軍の場から1体ずつ選んで撃破してもよい。";

  function setup(p1: Record<string, unknown> = {}, p2: Record<string, unknown> = {}) {
    const ty = inst("RS-035", "ty");
    const state = mk({
      player1: { hand: [ty], power: powers(6), command: [released(CMD.WB, "c")], ...p1 },
      player2: { ...p2 },
    });
    return { ty, state: rush(state, "player1", ty.instanceId) };
  }

  it("RS-035: カタログのテキストが原文と一致する（出典: atwiki/page-78 テキスト）", () => {
    expectTextMatches("RS-035", SOURCE);
  });

  it("RS-035: WB の Mユニット BP5000・SPなし・必要パワー6・特徴恐竜（出典: atwiki/page-78）", () => {
    const def = cardDef("RS-035")!;
    expect(def.category).toBe("WB");
    expect(def.size).toBe("M");
    expect(def.bp).toBe(5000);
    expect(def.sp).toBeUndefined();
    expect(def.powerCost).toBe(6);
    expect(def.features).toEqual(["恐竜"]);
  });

  holdToEnterTests("RS-035", "atwiki/page-78");

  it("RS-035: ラッシュしたとき、BP5000以下の自軍ユニットと敵軍ユニットを1体ずつ選んで撃破できる（出典: atwiki/page-78【ティラノソニック】）", () => {
    const own = inst("SPEC-S-5000", "own");
    const enemy = inst("SPEC-S-5000", "enemy");
    let { state } = setup({ rush: [own] }, { battle: [enemy] });
    expect(choiceOptions(state, "player1")).toContain(own.instanceId);
    state = choose(state, "player1", own.instanceId);
    expect(choiceOptions(state, "player1")).toContain(enemy.instanceId);
    state = choose(state, "player1", enemy.instanceId);
    for (let i = 0; i < 4 && state.pendingEffectChoice; i += 1) {
      if (legal(state).some((a) => a.type === "confirm_effect_choice")) {
        state = act(state, { type: "confirm_effect_choice", playerId: state.pendingEffectChoice.playerId });
      } else break;
    }
    state = passReactions(state);
    expect(zoneOf(state, "player1", own.instanceId)).toBe("discard");
    expect(zoneOf(state, "player2", enemy.instanceId)).toBe("discard");
  });

  it("RS-035: BP6000のユニットは選べない（出典: atwiki/page-78「BP5000以下のユニット」）", () => {
    const own = inst("SPEC-S-6000", "own");
    const enemy = inst("SPEC-S-6000", "enemy");
    const { state } = setup({ rush: [own] }, { battle: [enemy] });
    const opts = choiceOptions(state, "player1");
    expect(opts).not.toContain(own.instanceId);
    expect(opts).not.toContain(enemy.instanceId);
  });

  it("RS-035: 撃破は任意（しないことを選べる）（出典: atwiki/page-78「撃破してもよい」）", () => {
    const own = inst("SPEC-S-1000", "own");
    const enemy = inst("SPEC-S-1000", "enemy");
    let { state } = setup({ rush: [own] }, { battle: [enemy] });
    expect(legal(state).some((a) => a.type === "skip_effect_choice" && a.playerId === "player1")).toBe(true);
    state = act(state, { type: "skip_effect_choice", playerId: "player1" });
    expect(zoneOf(state, "player1", own.instanceId)).toBe("rush");
    expect(zoneOf(state, "player2", enemy.instanceId)).toBe("battle");
  });

  it("RS-035: ティラノソニックで守護獣ティラノザウルス自身を選べる（出典: grnrngr/faq-card-1 RS-035 Q）", () => {
    // 「はい、できます。」
    const enemy = inst("SPEC-S-1000", "enemy");
    const { ty, state } = setup({}, { battle: [enemy] });
    expect(choiceOptions(state, "player1")).toContain(ty.instanceId);
  });
});

// ===========================================================================
describe("RS-036 守護獣ジュウマンモス", () => {
  // 修正後テキスト（08-errata R-ERR-RS036）
  const SOURCE =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【モスブリザード】これをラッシュしたとき、相手は自分自身のコマンドゾーンから、リリース状態のコマンドを2つ選びホールドする。1つしかなければ1つ選びホールドする。";

  function setup(p2: Record<string, unknown> = {}) {
    const moss = inst("RS-036", "moss");
    const state = mk({
      player1: { hand: [moss], power: powers(5), command: [released(CMD.WB, "c")], deck: deck(3) },
      player2: { deck: deck(3, "p2d"), ...p2 },
    });
    return { moss, state };
  }

  /** 相手側（player2）のホールド選択を先頭から解決する。 */
  function resolveOpponentHolds(state: GameState): GameState {
    return resolveEffectHolds(state, "player2");
  }

  it("RS-036: カタログのテキストが修正後テキストと一致する（出典: 08-errata R-ERR-RS036 / atwiki/page-79）", () => {
    expectTextMatches("RS-036", SOURCE);
  });

  it("RS-036: WB の Mユニット BP5000・SPなし・必要パワー5・特徴恐竜（出典: atwiki/page-79）", () => {
    const def = cardDef("RS-036")!;
    expect(def.category).toBe("WB");
    expect(def.size).toBe("M");
    expect(def.bp).toBe(5000);
    expect(def.sp).toBeUndefined();
    expect(def.powerCost).toBe(5);
    expect(def.features).toEqual(["恐竜"]);
  });

  holdToEnterTests("RS-036", "atwiki/page-79");

  it("RS-036: ラッシュしたとき、相手はリリース状態のコマンドを2つホールドする（出典: 修正後テキスト）", () => {
    const { moss, state } = setup({ command: [released(CMD.WB, "a"), released(CMD.WB, "b"), released(CMD.WB, "c")] });
    const next = resolveOpponentHolds(rush(state, "player1", moss.instanceId));
    expect(heldCount(next, "player2")).toBe(2);
  });

  it("RS-036: リリース状態が1つしかなければ1つホールドする（出典: 修正後テキスト「1つしかなければ1つ」）", () => {
    const { moss, state } = setup({ command: [released(CMD.WB, "a"), held(CMD.WB, "b")] });
    const next = resolveOpponentHolds(rush(state, "player1", moss.instanceId));
    expect(heldCount(next, "player2")).toBe(2);
    expect(next.players.player2.command.every((c) => c.commandHeld)).toBe(true);
  });

  it("RS-036: ホールドは強制で、相手は拒否できない（出典: 修正後テキスト「選びホールドする」）", () => {
    const { moss, state } = setup({ command: [released(CMD.WB, "a"), released(CMD.WB, "b")] });
    const next = rush(state, "player1", moss.instanceId);
    if (next.pendingEffectChoice) {
      expect(legal(next).some((a) => a.type === "skip_effect_choice")).toBe(false);
    }
    expect(heldCount(resolveOpponentHolds(next), "player2")).toBe(2);
  });

  it("RS-036: ラッシュ効果のホールドが先に適用され、疾風流超忍法のコマンドがなくなれば使えない（出典: grnrngr/faq-card-1 RS-036 Q）", () => {
    // 「まずユニットのラッシュしたときの効果を適用して、コマンドを２つホールドします」
    const { moss, state } = setup({
      hand: [inst("RS-026", "ctr")],
      command: [released(CMD.MA, "m1"), released(CMD.MA, "m2")],
      power: powers(3, "p2pw"),
    });
    const next = resolveOpponentHolds(rush(state, "player1", moss.instanceId));
    expect(heldCount(next, "player2")).toBe(2);
    expect(canUse(next, "player2", "RS-026:ctr")).toBe(false);
  });

  it("RS-036: リリース状態のコマンドが3つあれば、2つホールドした後に残る1つで疾風流超忍法を使える（出典: grnrngr/faq-card-1 RS-036 Q の裏）", () => {
    // 「すべてホールドされてしまった場合…発動させることはできなくなります」
    const { moss, state } = setup({
      hand: [inst("RS-026", "ctr")],
      command: [released(CMD.MA, "m1"), released(CMD.MA, "m2"), released(CMD.MA, "m3")],
      power: powers(3, "p2pw"),
    });
    const next = resolveOpponentHolds(rush(state, "player1", moss.instanceId));
    expect(canUse(next, "player2", "RS-026:ctr")).toBe(true);
  });
});

// ===========================================================================
describe("RS-037 守護獣トリケラトプス", () => {
  const SOURCE =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【トリケラカノン】これが自軍ラッシュエリアにあるとき、「WB」の自軍Mユニットは、アタックするときBP＋1000される。";

  /** 自軍 WB M (BP4000) が 敵 BP4500 にアタック。 */
  function attackSetup(rushArea: CardInstance[], attackerId = "SPEC-M-WB-4000", defenderId = "SPEC-M-4500") {
    const attacker = inst(attackerId, "atk");
    const defender = inst(defenderId, "def");
    let state = mk({
      phase: "battle",
      definitions: EXTRA,
      player1: { rush: rushArea, battle: [attacker] },
      player2: { battle: [defender] },
    });
    state = passReactions(attack(state, "player1", attacker.instanceId, defender.instanceId));
    return { attacker, defender, state };
  }

  it("RS-037: カタログのテキストが原文と一致する（出典: atwiki/page-80 テキスト）", () => {
    expectTextMatches("RS-037", SOURCE);
  });

  it("RS-037: WB の Mユニット BP5000・SPなし・必要パワー4・特徴恐竜（出典: atwiki/page-80）", () => {
    const def = cardDef("RS-037")!;
    expect(def.category).toBe("WB");
    expect(def.size).toBe("M");
    expect(def.bp).toBe(5000);
    expect(def.sp).toBeUndefined();
    expect(def.powerCost).toBe(4);
    expect(def.features).toEqual(["恐竜"]);
  });

  holdToEnterTests("RS-037", "atwiki/page-80");

  it("RS-037: 自軍ラッシュエリアにあるとき、WB の自軍Mユニットはアタックするとき BP＋1000（4000+1000 > 4500 で勝つ）（出典: atwiki/page-80【トリケラカノン】）", () => {
    const { attacker, defender, state } = attackSetup([inst("RS-037", "tri")]);
    expect(zoneOf(state, "player2", defender.instanceId)).toBe("discard");
    expect(zoneOf(state, "player1", attacker.instanceId)).toBe("battle");
  });

  it("RS-037: トリケラトプスがいなければ 4000 < 4500 で負ける（対照）（出典: R-BTL-01）", () => {
    const { attacker, state } = attackSetup([]);
    expect(zoneOf(state, "player1", attacker.instanceId)).toBe("discard");
  });

  it("RS-037: アタックされるときは BP＋1000 されない（出典: atwiki/page-80「アタックするとき」）", () => {
    const mine = inst("SPEC-M-WB-4000", "mine");
    const enemy = inst("SPEC-M-4500", "enemy");
    let state = mk({
      phase: "battle",
      activePlayer: "player2",
      definitions: EXTRA,
      player1: { rush: [inst("RS-037", "tri")], battle: [mine] },
      player2: { battle: [enemy] },
    });
    state = passReactions(attack(state, "player2", enemy.instanceId, mine.instanceId));
    expect(zoneOf(state, "player1", mine.instanceId)).toBe("discard");
  });

  it("RS-037: Sユニットのアタックには効果がない（出典: atwiki/page-80「自軍Mユニット」）", () => {
    const { attacker, state } = attackSetup([inst("RS-037", "tri")], "SPEC-S-WB-4000", "SPEC-S-4500");
    expect(zoneOf(state, "player1", attacker.instanceId)).toBe("discard");
  });

  it("RS-037: WB 以外の Mユニットのアタックには効果がない（出典: atwiki/page-80「WB」の自軍Mユニット）", () => {
    const attacker = inst("SPEC-M-ET-5000", "atk");
    const defender = inst("SPEC-M-5500", "def");
    let state = mk({
      phase: "battle",
      definitions: EXTRA,
      player1: { rush: [inst("RS-037", "tri")], battle: [attacker] },
      player2: { battle: [defender] },
    });
    state = passReactions(attack(state, "player1", attacker.instanceId, defender.instanceId));
    expect(zoneOf(state, "player1", attacker.instanceId)).toBe("discard");
  });

  it("RS-037: バトルエリアにあるトリケラトプスでは効果がない（出典: atwiki/page-80「これが自軍ラッシュエリアにあるとき」）", () => {
    const tri = inst("RS-037", "tri");
    const attacker = inst("SPEC-M-WB-4000", "atk");
    const defender = inst("SPEC-M-4500", "def");
    let state = mk({
      phase: "battle",
      definitions: EXTRA,
      player1: { battle: [tri, attacker] },
      player2: { battle: [defender] },
    });
    state = passReactions(attack(state, "player1", attacker.instanceId, defender.instanceId));
    expect(zoneOf(state, "player1", attacker.instanceId)).toBe("discard");
  });

  it("RS-037: アバレキラーからのコンビネーションでアタック時だけ BP8000 になっても、ストライクはできない（出典: grnrngr/faq-card-1 RS-023(=RS-037) Q）", () => {
    // 「この効果でＳＰ１になってもストライクはできません」
    const killer = inst("RS-234", "killer");
    const m = inst("SPEC-M-WB-4000", "m");
    let state = mk({ phase: "battle", player1: { rush: [inst("RS-037", "tri"), killer, m] } });
    state = enterBattle(state, "player1", killer.instanceId);
    state = enterBattle(state, "player1", m.instanceId);
    // 4000 + 3000（ウイングペンタクト）= 7000。アタックしないので＋1000 はなく SP1 にならない
    // 注: RS-234 の BP+3000 自体が未実装のため、この期待は現状では自明に満たされている
    expect(canStrike(state, "player1", m.instanceId)).toBe(false);
  });

  it("RS-037: 2体あれば効果は重複する（4000+2000 > 5500 で勝つ）（出典: grnrngr/faq-card-1 RS-037 Q2）", () => {
    // 「はい、その通りです。」
    const { attacker, defender, state } = attackSetup(
      [inst("RS-037", "tri1"), inst("RS-037", "tri2")],
      "SPEC-M-WB-4000",
      "SPEC-M-5500",
    );
    expect(zoneOf(state, "player2", defender.instanceId)).toBe("discard");
    expect(zoneOf(state, "player1", attacker.instanceId)).toBe("battle");
  });
});

// ===========================================================================
describe("RS-038 守護獣サーベルタイガー", () => {
  const SOURCE = "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。";

  it("RS-038: カタログのテキストが原文と一致する（出典: atwiki/page-82 テキスト）", () => {
    expectTextMatches("RS-038", SOURCE);
  });

  it("RS-038: WB の Mユニット BP3000・SP1・必要パワー8・特徴恐竜（出典: atwiki/page-82）", () => {
    const def = cardDef("RS-038")!;
    expect(def.category).toBe("WB");
    expect(def.size).toBe("M");
    expect(def.bp).toBe(3000);
    expect(def.sp).toBe(1);
    expect(def.powerCost).toBe(8);
    expect(def.features).toEqual(["恐竜"]);
  });

  holdToEnterTests("RS-038", "atwiki/page-82");

  it("RS-038: SP1 なのでバトルエリアに出ればストライクできる（出典: atwiki/page-82 SP：1 / R-STK-01）", () => {
    const saber = inst("RS-038", "saber");
    let state = mk({ phase: "battle", player1: { rush: [saber], command: [released(CMD.WB, "c")] } });
    state = enterBattle(state, "player1", saber.instanceId);
    expect(canStrike(state, "player1", saber.instanceId)).toBe(true);
  });

  it("RS-038: パワー7では手札からラッシュできない（出典: atwiki/page-82 必要パワー8）", () => {
    const saber = inst("RS-038", "saber");
    const state = mk({ player1: { hand: [saber], power: powers(7), command: [released(CMD.WB, "c")] } });
    expect(canUse(state, "player1", saber.instanceId)).toBe(false);
  });
});

// ===========================================================================
describe("RS-039 守護獣プテラノドン", () => {
  const SOURCE =
    "※これは自軍コマンドを1つホールドしなければバトルエリアに出られない。【プテラビーム】これをラッシュしたとき、敵軍コマンドゾーンからホールド状態のカードを1枚選んで捨札にする。";

  function setup(p2: Record<string, unknown> = {}) {
    const ptera = inst("RS-039", "ptera");
    const state = mk({
      player1: { hand: [ptera], power: powers(3), command: [released(CMD.WB, "c")] },
      player2: { ...p2 },
    });
    return { ptera, state: rush(state, "player1", ptera.instanceId) };
  }

  it.fails("RS-039: カタログのテキストが原文と一致する（出典: atwiki/page-81 テキスト）", () => {
    // 既知の不具合: CARD-RS-039 カタログ本文が「捨て札にする」で原文「捨札にする」と表記が異なる
    expectTextMatches("RS-039", SOURCE);
  });

  it("RS-039: WB の Mユニット BP4000・SPなし・必要パワー3・特徴恐竜（出典: atwiki/page-81）", () => {
    const def = cardDef("RS-039")!;
    expect(def.category).toBe("WB");
    expect(def.size).toBe("M");
    expect(def.bp).toBe(4000);
    expect(def.sp).toBeUndefined();
    expect(def.powerCost).toBe(3);
    expect(def.features).toEqual(["恐竜"]);
  });

  holdToEnterTests("RS-039", "atwiki/page-81");

  it("RS-039: ラッシュしたとき、敵軍コマンドゾーンのホールド状態のカードを1枚選んで捨札にする（出典: atwiki/page-81【プテラビーム】）", () => {
    let { state } = setup({ command: [held(CMD.ET, "h"), released(CMD.ET, "r")] });
    const opts = choiceOptions(state, "player1");
    expect(opts).toContain("TST-OP-ET:h");
    expect(opts).not.toContain("TST-OP-ET:r");
    state = choose(state, "player1", "TST-OP-ET:h");
    expect(zoneOf(state, "player2", "TST-OP-ET:h")).toBe("discard");
    expect(zoneOf(state, "player2", "TST-OP-ET:r")).toBe("command");
  });

  it("RS-039: ホールド状態のカードがなければ何も捨札にしない（出典: atwiki/page-81「ホールド状態のカード」）", () => {
    const { state } = setup({ command: [released(CMD.ET, "r")] });
    expect(state.pendingEffectChoice).toBeUndefined();
    expect(zoneOf(state, "player2", "TST-OP-ET:r")).toBe("command");
  });

  it.todo(
    "RS-039: レスキューファイターがある状態で隠流忍術により相撃ちにされたとき、捨札かパワーゾーンかはターンプレイヤーが処理順で選べる（出典: grnrngr/faq-card-1 RS-039 Q1）— RS-018 隠流忍術の相撃ちと RS-089 の置換の処理順をターンプレイヤーが選ぶ公開アクションが確認できない",
  );

  it.fails("RS-039: ホールド状態の「アタックされる以外では相手に選ばれない」ユニットカード（ガタックRF）は選べない（出典: atwiki/page-81 Q2）", () => {
    // 既知の不具合: CARD-RS-039 【プテラビーム】の候補に、コマンドゾーンでオモテ向きの「相手に選ばれない」カードが含まれる
    // 「敵軍プレイヤーは…を選ぶことは出来ません」
    const { state } = setup({ command: [held("RK-054", "gatack"), held(CMD.ET, "h")] });
    const opts = choiceOptions(state, "player1");
    expect(opts).not.toContain("RK-054:gatack");
    expect(opts).toContain("TST-OP-ET:h");
  });
});

// ===========================================================================
describe("RS-040 マンモスレンジャー", () => {
  const SOURCE = "【モスブレイカー】相手は可能ならコマンドを1つ選んでホールドする。";

  function enterAt(position: number, p2: Record<string, unknown> = {}) {
    const mammoth = inst("RS-040", "mammoth");
    let state = mk({ phase: "battle", player1: { rush: [mammoth], battle: fillers(position - 1) }, player2: { ...p2 } });
    state = enterBattle(state, "player1", mammoth.instanceId);
    return resolveEffectHolds(state, "player2");
  }

  it("RS-040: カタログのテキストが原文と一致する（出典: atwiki/page-235 テキスト）", () => {
    expectTextMatches("RS-040", SOURCE);
  });

  it("RS-040: WB の Sユニット BP3000・SP空欄・必要パワー1・CN2・特徴ブラック／男（出典: atwiki/page-235）", () => {
    const def = cardDef("RS-040")!;
    expect(def.category).toBe("WB");
    expect(def.size).toBe("S");
    expect(def.bp).toBe(3000);
    expect(def.sp).toBeUndefined();
    expect(def.powerCost).toBe(1);
    expect(def.comboNumber).toBe(2);
    expect(def.features).toEqual(["ブラック", "男"]);
  });

  it("RS-040: 2番目に出ると、相手はコマンドを1つホールドする（出典: atwiki/page-235【モスブレイカー】/ R-CN-02）", () => {
    const state = enterAt(2, { command: [released(CMD.ET, "a"), released(CMD.ET, "b")] });
    expect(heldCount(state, "player2")).toBe(1);
  });

  it("RS-040: 2番目以外（3番目）では発動しない（出典: R-CN-02 CN2）", () => {
    const state = enterAt(3, { command: [released(CMD.ET, "a"), released(CMD.ET, "b")] });
    expect(heldCount(state, "player2")).toBe(0);
  });

  it("RS-040: 相手にリリース状態のコマンドがなければ何も起きない（出典: atwiki/page-235「可能なら」）", () => {
    const state = enterAt(2, { command: [held(CMD.ET, "a")] });
    expect(state.pendingEffectChoice).toBeUndefined();
    expect(heldCount(state, "player2")).toBe(1);
  });
});

// ===========================================================================
describe("RS-041 タイガーレンジャー", () => {
  const SOURCE = "※これは毎ターン、可能ならバトルエリアに出る。【サーベルダガー】「SP1」";

  it("RS-041: カタログのテキストが原文と一致する（出典: atwiki/page-236 テキスト）", () => {
    expectTextMatches("RS-041", SOURCE);
  });

  it("RS-041: WB の Sユニット BP500・SP！・必要パワー0・CN2・特徴イエロー／男／忍者（出典: atwiki/page-236）", () => {
    const def = cardDef("RS-041")!;
    expect(def.category).toBe("WB");
    expect(def.size).toBe("S");
    expect(def.bp).toBe(500);
    expect(def.sp).toBe("special");
    expect(def.powerCost).toBe(0);
    expect(def.comboNumber).toBe(2);
    expect(def.features).toEqual(["イエロー", "男", "忍者"]);
  });

  it("RS-041: 自軍バトルフェイズに出られるなら、出ずにフェイズを終えることはできない（出典: atwiki/page-236 ※ / R-BA-04）", () => {
    const tiger = inst("RS-041", "tiger");
    const state = mk({ phase: "battle", player1: { rush: [tiger] } });
    const acts = legal(state);
    expect(acts.some((a) => a.type === "end_phase")).toBe(false);
    expect(acts.some((a) => a.type === "move_to_battle" && a.instanceId === tiger.instanceId)).toBe(true);
  });

  it("RS-041: 2番目に出ると SP1 になりストライクできる（出典: atwiki/page-236【サーベルダガー】）", () => {
    const tiger = inst("RS-041", "tiger");
    let state = mk({ phase: "battle", player1: { rush: [tiger], battle: fillers(1) } });
    state = enterBattle(state, "player1", tiger.instanceId);
    expect(canStrike(state, "player1", tiger.instanceId)).toBe(true);
  });

  it("RS-041: 2番目以外（1番目）では SP1 にならずストライクできない（出典: R-STK-02 SP！）", () => {
    const tiger = inst("RS-041", "tiger");
    let state = mk({ phase: "battle", player1: { rush: [tiger] } });
    state = enterBattle(state, "player1", tiger.instanceId);
    expect(canStrike(state, "player1", tiger.instanceId)).toBe(false);
  });

  it("RS-041: 敵軍ハリケンレオンがいても、ホールドできるコマンドがあればホールドして出なければならない（出典: grnrngr/faq-card-2 RS-097 Q）", () => {
    // 「コマンドを１つホールドしてバトルエリアに出さなければなりません」
    const tiger = inst("RS-041", "tiger");
    const state = mk({
      phase: "battle",
      player1: { rush: [tiger], command: [released(CMD.WB, "c")] },
      player2: { battle: [inst("RS-097", "leo")] },
    });
    expect(legal(state).some((a) => a.type === "end_phase")).toBe(false);
    expect(battleEntryHoldsRequired(state, "player1", tiger.instanceId)).toBe(1);
  });

  it("RS-041: 敵軍ハリケンレオンがいてホールドできるコマンドがなければ、ラッシュエリアに留まれる（出典: grnrngr/faq-card-2 RS-097 Q）", () => {
    // 「ホールドできるコマンドが無ければ…ラッシュエリアに留まります」
    const tiger = inst("RS-041", "tiger");
    const state = mk({
      phase: "battle",
      player1: { rush: [tiger], command: [held(CMD.WB, "c")] },
      player2: { battle: [inst("RS-097", "leo")] },
    });
    expect(legal(state).some((a) => a.type === "end_phase")).toBe(true);
  });
});
