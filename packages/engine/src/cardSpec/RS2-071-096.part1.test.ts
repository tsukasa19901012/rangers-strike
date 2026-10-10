/**
 * カード別スペック: RS-071〜RS-080（第2弾「二人の黒騎士」）
 *
 * 出典（優先順。docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（RS-071〜096 のエラッタ・読み替えはなし）、
 *     grnrngr/faq-card-2（docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_2.html）、card_1.html
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-0NN.md。ライブ写しは pages/326.txt のみ）
 *  3. docs/rules/*.md の一般ルール
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-0NN …」）で残す。
 * 本文比較は normBody（全半角・空白・※常駐注釈・「。⇒」・「SP1」の括弧・カテゴリ略記のゆれだけ無視）。
 */
import { describe, expect, it } from "vitest";
import { allCardsCatalog, validateDeckEntries } from "@rangers-strike/cards";
import {
  DEFS,
  act,
  attack,
  bpOf,
  canEnter,
  canStrike,
  effectMeta,
  endTurn,
  enter,
  expectBodyText,
  fillers,
  held,
  inst,
  legal,
  legalOfType,
  passEntry,
  playOp,
  powerCards,
  released,
  releasedN,
  settle,
  st,
  strikeDamage,
  sUnit,
  tryAct,
  toBattle,
  tryZordRush,
  zoneIds,
  zoneOf,
} from "./RS2-071-096.helpers";
import type { GameState, PlayerId } from "../types/game";

/** 印刷スペック。 */
function expectStats(
  id: string,
  stats: {
    name: string;
    type?: "unit" | "operation";
    category: string;
    size?: string;
    bp?: number;
    sp?: number | "special" | undefined;
    powerCost: number | string;
    comboNumber?: number;
    features?: string[];
  },
) {
  const d = DEFS[id]!;
  expect(d.name).toBe(stats.name);
  expect(d.type).toBe(stats.type ?? "unit");
  expect(d.category).toBe(stats.category);
  expect(d.powerCost).toBe(stats.powerCost);
  if ((stats.type ?? "unit") === "unit") {
    expect(d.size).toBe(stats.size);
    expect(d.bp).toBe(stats.bp);
    expect(d.sp).toBe(stats.sp);
    expect(d.comboNumber).toBe(stats.comboNumber);
    expect(d.features ?? []).toEqual(stats.features ?? []);
  }
}

function canUseCounter(s: GameState, playerId: PlayerId, instanceId: string): boolean {
  return legal(s).some(
    (a) =>
      (a.type === "initiate_command_payment" && a.playerId === playerId && a.sourceInstanceId === instanceId) ||
      (a.type === "play_counter" && a.playerId === playerId && a.instanceId === instanceId),
  );
}


const EXTRA = [
  sUnit("SPEC-S-RED", { features: ["レッド"] }),
  sUnit("SPEC-S-MECHA", { features: ["メカ"] }),
  sUnit("SPEC-M-3000", { size: "M", bp: 3000, sp: undefined }),
  sUnit("SPEC-S-P5", { powerCost: 5 }),
  sUnit("SPEC-S-P2", { powerCost: 2 }),
];

// ===========================================================================
describe("RS-071 ヒドラー兵の卵", () => {
  const TEXT =
    "※常駐（場に配置して、離れるまで効果が有効になる）自分のラッシュフェイズごとに1度だけ発動できる。自軍山札の上から1枚をオモテにする。オモテにしたカードが「ヒドラー兵」ならラッシュエリアに出し、それ以外なら山札の下に戻す。";

  // atwiki/page-322「種類：オペレーション」「カテゴリ：ダークアライアンス」「必要パワー：1」
  it("RS-071: カタログ本文（※常駐）・スペックが出典と一致（出典: atwiki/page-322）", () => {
    expectBodyText("RS-071", TEXT);
    expectStats("RS-071", { name: "ヒドラー兵の卵", type: "operation", category: "DA", powerCost: 1 });
    expect(effectMeta("RS-071")?.kind).toBe("permanent");
  });

  function eggState(deck: ReturnType<typeof inst>[], opts: { phase?: "rush" | "battle"; active?: PlayerId } = {}) {
    return st({
      phase: opts.phase ?? "rush",
      activePlayer: opts.active ?? "player1",
      player1: { operation: [inst("RS-071", "egg")], deck },
    });
  }
  function canEgg(s: GameState, playerId: PlayerId = "player1") {
    return legal(s).some((a) => a.type === "hidora_egg" && a.playerId === playerId);
  }

  // 「※常駐（場に配置して…）」「必要パワー：1」
  it("RS-071: DA コマンドを1つホールドし、パワー1で使うと場（オペレーションゾーン）に配置される（出典: atwiki/page-322）", () => {
    const mk = (power: number) =>
      st({ phase: "rush", player1: { hand: [inst("RS-071", "egg")], command: [released("TST-OP-DA", "da")], power: powerCards(power) } });
    const r = playOp(mk(1), "player1", "RS-071:egg");
    expect(r.ok).toBe(true);
    expect(zoneOf(settle(r.state), "player1", "RS-071:egg")).toBe("operation");
    expect(playOp(mk(0), "player1", "RS-071:egg").ok).toBe(false);
  });

  // 「オモテにしたカードが「ヒドラー兵」ならラッシュエリアに出し」
  it("RS-071: 山札の上がヒドラー兵ならラッシュエリアに出す（出典: atwiki/page-322）", () => {
    let s = eggState([inst("RS-080", "h1"), inst("TST-OP", "d2")]);
    expect(canEgg(s)).toBe(true);
    s = settle(act(s, { type: "hidora_egg", playerId: "player1" }));
    expect(zoneOf(s, "player1", "RS-080:h1")).toBe("rush");
    expect(zoneIds(s, "player1", "deck")).toEqual(["TST-OP:d2"]);
  });

  // 「それ以外なら山札の下に戻す」
  it("RS-071: 山札の上がヒドラー兵以外なら山札の下に戻す（出典: atwiki/page-322）", () => {
    let s = eggState([inst("TST-OP", "d1"), inst("RS-080", "h2")]);
    s = settle(act(s, { type: "hidora_egg", playerId: "player1" }));
    expect(zoneIds(s, "player1", "deck")).toEqual(["RS-080:h2", "TST-OP:d1"]);
    expect(zoneIds(s, "player1", "rush")).toEqual([]);
  });

  // 「自分のラッシュフェイズごとに1度だけ発動できる」
  it("RS-071: 1度発動すると同じラッシュフェイズにはもう発動できない（出典: atwiki/page-322）", () => {
    let s = eggState([inst("TST-OP", "d1"), inst("TST-OP", "d2")]);
    s = settle(act(s, { type: "hidora_egg", playerId: "player1" }));
    expect(canEgg(s)).toBe(false);
    expect(tryAct(s, { type: "hidora_egg", playerId: "player1" }).ok).toBe(false);
  });

  it("RS-071: 自分のバトルフェイズには発動できない（出典: atwiki/page-322「自分のラッシュフェイズごとに」）", () => {
    const s = eggState([inst("RS-080", "h1")], { phase: "battle" });
    expect(canEgg(s)).toBe(false);
    expect(tryAct(s, { type: "hidora_egg", playerId: "player1" }).ok).toBe(false);
  });

  it("RS-071: 相手のラッシュフェイズには発動できない（出典: atwiki/page-322「自分のラッシュフェイズ」）", () => {
    const s = eggState([inst("RS-080", "h1")], { active: "player2" });
    expect(canEgg(s, "player1")).toBe(false);
    expect(tryAct(s, { type: "hidora_egg", playerId: "player1" }).ok).toBe(false);
  });

  // 「発動できる」— 任意
  it("RS-071: 発動せずにラッシュフェイズを終えられる（「発動できる」）（出典: atwiki/page-322）", () => {
    const s = eggState([inst("RS-080", "h1")]);
    expect(canEgg(s)).toBe(true);
    expect(legalOfType(s, "end_phase").length).toBeGreaterThan(0);
  });
});

// ===========================================================================
describe("RS-072 無限連鎖カード", () => {
  const TEXT = "このターン、相手の常駐オペレーションは無効になり、相手はカウンターを発動できない。";

  it("RS-072: カタログ本文・スペックが出典と一致（出典: atwiki/page-323）", () => {
    expectBodyText("RS-072", TEXT);
    expectStats("RS-072", { name: "無限連鎖カード", type: "operation", category: "DA", powerCost: 3 });
    expect(effectMeta("RS-072")?.kind).toBe("instant");
  });

  /** ラッシュフェイズに無限連鎖カードを使い（chain=true のとき）、バトルフェイズへ進める。 */
  function chainState(opts: { chain: boolean; ownLightning?: boolean }) {
    let s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-072", "ic")],
        rush: [inst("SPEC-M-3000", "m")],
        command: [released("TST-OP-DA", "da")],
        power: powerCards(3),
        operation: opts.ownLightning ? [inst("RS-069", "own")] : [],
      },
      player2: { operation: [inst("RS-069", "lg")] },
    }, EXTRA);
    if (opts.chain) {
      const r = playOp(s, "player1", "RS-072:ic");
      expect(r.ok).toBe(true);
      s = settle(r.state);
    }
    return toBattle(s);
  }

  // 「必要パワー：3」
  it("RS-072: DA コマンドをホールドしパワー3で使える。パワー2では使えない（出典: atwiki/page-323「必要パワー：3」）", () => {
    const mk = (n: number) =>
      st({
        phase: "rush",
        player1: { hand: [inst("RS-072", "ic")], command: [released("TST-OP-DA", "da")], power: powerCards(n) },
      });
    expect(playOp(mk(3), "player1", "RS-072:ic").ok).toBe(true);
    expect(playOp(mk(2), "player1", "RS-072:ic").ok).toBe(false);
  });

  // 「相手の常駐オペレーションは無効になり」
  it("RS-072: このターン、相手の常駐（稲妻重力エネルギー）が無効になり、Mユニットがホールドなしでバトルエリアに出られる（出典: atwiki/page-323）", () => {
    const without = chainState({ chain: false });
    expect(tryAct(without, { type: "move_to_battle", playerId: "player1", instanceId: "SPEC-M-3000:m" }).ok).toBe(false);
    const withChain = chainState({ chain: true });
    expect(tryAct(withChain, { type: "move_to_battle", playerId: "player1", instanceId: "SPEC-M-3000:m" }).ok).toBe(true);
  });

  it("RS-072: 無効になるのは「相手の」常駐だけで、自分の常駐は有効のまま（出典: atwiki/page-323）", () => {
    const s = chainState({ chain: true, ownLightning: true });
    expect(tryAct(s, { type: "move_to_battle", playerId: "player1", instanceId: "SPEC-M-3000:m" }).ok).toBe(false);
  });

  // 「このターン」
  it("RS-072: 次のターンには相手の常駐は再び有効（出典: atwiki/page-323「このターン」）", () => {
    let s = chainState({ chain: true });
    s = endTurn(s);
    expect(s.activePlayer).toBe("player2");
    s = { ...s, phase: "battle", players: { ...s.players, player2: { ...s.players.player2, rush: [inst("SPEC-M-3000", "m2")], command: [] } } };
    expect(tryAct(s, { type: "move_to_battle", playerId: "player2", instanceId: "SPEC-M-3000:m2" }).ok).toBe(false);
  });

  // 「相手はカウンターを発動できない」
  it("RS-072: このターンのバトルフェイズ、相手はアタックに対するカウンター（新体操アクション）を発動できない（出典: atwiki/page-323）", () => {
    const mk = (chain: boolean) => {
      let s = st({
        phase: "rush",
        player1: {
          hand: [inst("RS-072", "ic")],
          battle: [inst("TST-UNIT-2", "atk")],
          command: [released("TST-OP-DA", "da")],
          power: powerCards(3),
        },
        player2: {
          battle: [inst("TST-UNIT-0", "def")],
          hand: [inst("RS-006", "gym")],
          command: [released("TST-OP-ET", "et")],
          power: powerCards(1, "e"),
        },
      });
      if (chain) s = settle(playOp(s, "player1", "RS-072:ic").state);
      s = toBattle(s);
      return attack(s, "TST-UNIT-2:atk", "TST-UNIT-0:def");
    };
    expect(canUseCounter(mk(false), "player2", "RS-006:gym")).toBe(true);
    expect(canUseCounter(mk(true), "player2", "RS-006:gym")).toBe(false);
  });

  it("RS-072: 使った後のラッシュフェイズ中のラッシュにも、相手はカウンター（RS-026）を発動できない（出典: atwiki/page-323）", () => {
    const mk = (chain: boolean) => {
      let s = st({
        phase: "rush",
        player1: {
          hand: [inst("RS-072", "ic"), inst("TST-UNIT-0", "u")],
          command: [released("TST-OP-DA", "da"), released("TST-OP", "wb")],
          power: powerCards(3),
        },
        player2: { hand: [inst("RS-026", "ctr")], command: [released("TST-OP-MA", "ma")], power: powerCards(5, "e") },
      });
      if (chain) s = settle(playOp(s, "player1", "RS-072:ic").state);
      return act(s, { type: "initiate_command_payment", playerId: "player1", kind: "category_use", sourceInstanceId: "TST-UNIT-0:u" });
    };
    expect(canUseCounter(mk(false), "player2", "RS-026:ctr")).toBe(true);
    expect(canUseCounter(mk(true), "player2", "RS-026:ctr")).toBe(false);
  });
});

// ===========================================================================
describe("RS-073 サンバルカンロボ", () => {
  const TEXT = "合体―コスモバルカン＋ブルバルカン　【バルシールド】自軍ダメージが6点のとき、このユニットは次の能力を得る。⇒SP2";

  it("RS-073: カタログ本文・スペック・追加条件が出典と一致（出典: atwiki/page-130）", () => {
    expectBodyText("RS-073", TEXT);
    expectStats("RS-073", {
      name: "サンバルカンロボ",
      category: "ET",
      size: "L",
      bp: 9000,
      sp: 1,
      powerCost: "6+",
      features: ["メカ", "人型"],
    });
    expect(DEFS["RS-073"]!.rushAdditionalCondition?.conditionId).toBe("discard_fusion_unit");
    expect(DEFS["RS-073"]!.rushAdditionalCondition?.text).toBe("自軍合体ユニットを捨札にする");
  });

  // 「合体―コスモバルカン＋ブルバルカン」「追加条件：自軍合体ユニットを捨札にする」
  it("RS-073: 自軍のコスモバルカンとブルバルカンを捨札にしてラッシュする（出典: atwiki/page-130）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-073", "robo")],
        rush: [inst("RS-074", "cosmo"), inst("RS-075", "bull")],
        command: [released("TST-OP-ET", "et")],
        power: powerCards(6),
      },
    });
    const r = tryZordRush(s, "RS-073:robo", { materials: ["RS-074:cosmo", "RS-075:bull"] });
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-073:robo")).toBe("rush");
    expect(zoneOf(r.state, "player1", "RS-074:cosmo")).toBe("discard");
    expect(zoneOf(r.state, "player1", "RS-075:bull")).toBe("discard");
  });

  it("RS-073: 合体素材の片方（ブルバルカン）がなければラッシュできない（出典: atwiki/page-130）", () => {
    const s = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-073", "robo")],
        rush: [inst("RS-074", "cosmo")],
        command: [released("TST-OP-ET", "et")],
        power: powerCards(6),
      },
    });
    const canStart = legal(s).some(
      (a) => (a.type === "begin_zord_setup" && a.zordInstanceId === "RS-073:robo") ||
        (a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-073:robo") ||
        (a.type === "rush" && a.instanceId === "RS-073:robo"),
    );
    expect(canStart).toBe(false);
  });

  function roboStrike(damage: number, extraOps: ReturnType<typeof inst>[] = []) {
    const s = st({
      player1: { battle: [inst("RS-073", "robo")], damage, operation: extraOps, power: powerCards(8) },
      player2: { power: powerCards(5, "e") },
    });
    return strikeDamage(s, "RS-073:robo");
  }

  // 「SP：1」
  it("RS-073: 自軍ダメージが6点でなければ SP1（ストライクで1点）（出典: atwiki/page-130）", () => {
    expect(roboStrike(5)).toBe(1);
    expect(roboStrike(0)).toBe(1);
  });

  // 「自軍ダメージが6点のとき…⇒SP2」
  it("RS-073: 自軍ダメージがちょうど6点のとき SP2（ストライクで2点）（出典: atwiki/page-130）", () => {
    expect(roboStrike(6)).toBe(2);
  });

  // atwiki/page-130 カード評価「能力が発動するのは、飽くまでダメージが6点のときのみ」
  it("RS-073: 命の泉で負けずに自軍ダメージ7点のときは SP2 にならない（SP1）（出典: atwiki/page-130 カード評価、RS-244 命の泉）", () => {
    expect(roboStrike(7, [inst("RS-244", "izumi")])).toBe(1);
  });
});

// ===========================================================================
describe("RS-074 コスモバルカン", () => {
  const TEXT =
    "【バルカン砲】自軍ラッシュエリアに「ブルバルカン」があるとき、このユニットは次の能力を得る。⇒これがアタックするとき、相手はカウンターを発動できず、敵軍ユニットのBPをカードに表記された本来の値としてバトルする。";

  it("RS-074: カタログ本文・スペック・追加条件が出典と一致（出典: atwiki/page-287）", () => {
    expectBodyText("RS-074", TEXT);
    expectStats("RS-074", {
      name: "コスモバルカン",
      category: "ET",
      size: "M",
      bp: 4000,
      sp: undefined,
      powerCost: "4+",
      features: ["メカ", "航空機"],
    });
    expect(DEFS["RS-074"]!.rushAdditionalCondition?.conditionId).toBe("send_s_unit_to_command_or_discard");
    expect(DEFS["RS-074"]!.rushAdditionalCondition?.text).toBe("自軍Sユニットを1体コマンドゾーンに送るか捨札にする");
  });

  // 「追加条件：自軍Sユニットを1体コマンドゾーンに送るか捨札にする」
  it("RS-074: 追加条件の自軍Sユニットがなければラッシュできない（出典: atwiki/page-287）", () => {
    const mk = (s: boolean) =>
      st({
        phase: "rush",
        player1: {
          hand: [inst("RS-074", "c")],
          rush: s ? [inst("TST-UNIT-0", "s")] : [],
          command: [released("TST-OP-ET", "et")],
          power: powerCards(4),
        },
      });
    const can = (st0: GameState) =>
      legal(st0).some(
        (a) => (a.type === "begin_zord_setup" && a.zordInstanceId === "RS-074:c") ||
          (a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-074:c"),
      );
    expect(can(mk(true))).toBe(true);
    expect(can(mk(false))).toBe(false);
  });

  /** コスモバルカン（BP4000）が、BP+2000 を受けた BP3000 の敵軍 S ユニット（実効 BP5000）にアタックする。 */
  function cannonAttack(bull: boolean) {
    const s = st({
      phase: "battle",
      player1: { battle: [inst("RS-074", "c")], rush: bull ? [inst("RS-075", "bull")] : [] },
      player2: { battle: [{ ...inst("SPEC-S-RED", "def"), bpModifier: 2000 } as ReturnType<typeof inst>] },
    }, [sUnit("SPEC-S-RED", { bp: 3000, features: ["レッド"] })]);
    return settle(attack(s, "RS-074:c", "SPEC-S-RED:def"));
  }

  // 「敵軍ユニットのBPをカードに表記された本来の値としてバトルする」
  it("RS-074: ブルバルカンがラッシュエリアにあるとき、敵軍ユニットを本来の BP（3000）としてバトルし撃破する（出典: atwiki/page-287）", () => {
    const s = cannonAttack(true);
    expect(zoneOf(s, "player2", "SPEC-S-RED:def")).toBe("discard");
    expect(zoneOf(s, "player1", "RS-074:c")).toBe("battle");
  });

  // 「自軍ラッシュエリアに「ブルバルカン」があるとき」
  it("RS-074: ブルバルカンがなければ BP 修正込み（5000）でバトルし、コスモバルカンが撃破される（出典: atwiki/page-287）", () => {
    const s = cannonAttack(false);
    expect(zoneOf(s, "player1", "RS-074:c")).toBe("discard");
    expect(zoneOf(s, "player2", "SPEC-S-RED:def")).toBe("battle");
  });

  // 「相手はカウンターを発動できず」
  it("RS-074: ブルバルカンがあるとき、アタックに対して相手はカウンターを発動できない／ないときは発動できる（出典: atwiki/page-287）", () => {
    const mk = (bull: boolean) => {
      const s = st({
        phase: "battle",
        player1: { battle: [inst("RS-074", "c")], rush: bull ? [inst("RS-075", "bull")] : [] },
        player2: {
          battle: [inst("TST-UNIT-0", "def")],
          hand: [inst("RS-006", "gym")],
          command: [released("TST-OP-ET", "et")],
          power: powerCards(1, "e"),
        },
      });
      return attack(s, "RS-074:c", "TST-UNIT-0:def");
    };
    expect(canUseCounter(mk(true), "player2", "RS-006:gym")).toBe(false);
    expect(canUseCounter(mk(false), "player2", "RS-006:gym")).toBe(true);
  });

  it("RS-074: ブルバルカンが自軍ラッシュエリアではなくバトルエリアにあるときは能力を得ない（カウンターできる）（出典: atwiki/page-287）", () => {
    const s0 = st({
      phase: "battle",
      player1: { battle: [inst("RS-075", "bull"), inst("RS-074", "c")] },
      player2: {
        battle: [inst("TST-UNIT-0", "def")],
        hand: [inst("RS-006", "gym")],
        command: [released("TST-OP-ET", "et")],
        power: powerCards(1, "e"),
      },
    });
    const s = attack(s0, "RS-074:c", "TST-UNIT-0:def");
    expect(canUseCounter(s, "player2", "RS-006:gym")).toBe(true);
  });
});

// ===========================================================================
describe("RS-075 ブルバルカン", () => {
  const TEXT = "【救助活動】これをラッシュしたとき、自軍捨札から、特徴「メカ」を持つユニットのカードを1枚選んで手札に加える。";

  it("RS-075: カタログ本文・スペックが出典と一致（出典: atwiki/page-288）", () => {
    expectBodyText("RS-075", TEXT);
    expectStats("RS-075", {
      name: "ブルバルカン",
      category: "ET",
      size: "M",
      bp: 5000,
      sp: undefined,
      powerCost: "5+",
      features: ["メカ", "車両"],
    });
  });

  // atwiki/page-288「追加条件：自軍Sユニット2体をそれぞれコマンドゾーンに送るか捨札にする」、faq-card-2 RS-075 Q1 の前提
  it("RS-075: 追加条件は「自軍Sユニット2体をそれぞれコマンドゾーンに送るか捨札にする」（出典: atwiki/page-288、grnrngr/faq-card-2 RS-075 Q1）", () => {
    const cond = DEFS["RS-075"]!.rushAdditionalCondition;
    expect(cond?.conditionId).toBe("send_s_unit_to_command_or_discard");
    expect(cond?.text).toBe("自軍Sユニット2体をそれぞれコマンドゾーンに送るか捨札にする");
    expect((cond as { unitCount?: number } | undefined)?.unitCount).toBe(2);
  });

  function bullState(sUnits: number, extra: { discard?: ReturnType<typeof inst>[]; hand?: ReturnType<typeof inst>[] } = {}) {
    return st({
      phase: "rush",
      player1: {
        hand: [inst("RS-075", "bull"), ...(extra.hand ?? [])],
        rush: Array.from({ length: sUnits }, (_, i) => inst("TST-UNIT-0", `s${i}`)),
        discard: extra.discard ?? [],
        command: [released("TST-OP-ET", "et")],
        power: powerCards(5),
      },
    }, EXTRA);
  }
  function canRushBull(s: GameState) {
    return legal(s).some(
      (a) => (a.type === "begin_zord_setup" && a.zordInstanceId === "RS-075:bull") ||
        (a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-075:bull"),
    );
  }
  function rushBull(s0: GameState, materials: string[], destination: "command" | "discard" = "discard") {
    const r = tryZordRush(s0, "RS-075:bull", { materials, destination });
    if (!r.ok) throw new Error(`rush failed: ${r.error}`);
    return r.state;
  }

  it("RS-075: 自軍Sユニットが1体しかなければラッシュできない（出典: atwiki/page-288 追加条件）", () => {
    expect(canRushBull(bullState(2))).toBe(true);
    expect(canRushBull(bullState(1))).toBe(false);
  });

  it("RS-075: ラッシュすると自軍Sユニット2体をそれぞれ捨札にする（出典: atwiki/page-288 追加条件）", () => {
    const s = settle(rushBull(bullState(2), ["TST-UNIT-0:s0", "TST-UNIT-0:s1"]));
    expect(zoneOf(s, "player1", "RS-075:bull")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:s0")).toBe("discard");
    expect(zoneOf(s, "player1", "TST-UNIT-0:s1")).toBe("discard");
  });

  // 「これをラッシュしたとき、自軍捨札から、特徴「メカ」を持つユニットのカードを1枚選んで手札に加える」
  it("RS-075: ラッシュしたとき、自軍捨札の特徴「メカ」を持つユニットを1枚選んで手札に加える（メカでないカードは選べない）（出典: atwiki/page-288）", () => {
    let s = rushBull(
      bullState(2, { discard: [inst("SPEC-S-MECHA", "mecha"), inst("TST-UNIT-0", "plain"), inst("TST-OP", "op")] }),
      ["TST-UNIT-0:s0", "TST-UNIT-0:s1"],
    );
    s = settle(s);
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(s.pendingEffectChoice?.validInstanceIds).toContain("SPEC-S-MECHA:mecha");
    expect(s.pendingEffectChoice?.validInstanceIds).not.toContain("TST-UNIT-0:plain");
    expect(s.pendingEffectChoice?.validInstanceIds).not.toContain("TST-OP:op");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "SPEC-S-MECHA:mecha" });
    expect(zoneOf(s, "player1", "SPEC-S-MECHA:mecha")).toBe("hand");
  });

  // 「選んで手札に加える」（「してもよい」ではない）
  it("RS-075: 救助活動は任意ではない（対象があればスキップできない）（出典: atwiki/page-288）", () => {
    let s = rushBull(bullState(2, { discard: [inst("SPEC-S-MECHA", "mecha")] }), ["TST-UNIT-0:s0", "TST-UNIT-0:s1"]);
    s = settle(s);
    expect(s.pendingEffectChoice).toBeDefined();
    expect(legalOfType(s, "skip_effect_choice")).toHaveLength(0);
  });

  // faq-card-2 RS-075 Q1「「RS-076 ジャガーバルカン」の効果を使ってラッシュすることができますか？」「はい、できます。」
  it("RS-075: 公式Q&A — ジャガーバルカンの効果を使ってラッシュできる（出典: grnrngr/faq-card-2 RS-075 Q1）", () => {
    const s0 = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-075", "bull")],
        rush: [inst("RS-076", "jag")],
        command: releasedN(3, "TST-OP-ET", "e"),
        power: powerCards(5),
      },
    });
    const r = tryZordRush(s0, "RS-075:bull", { mothership: true });
    expect(r.ok).toBe(true);
    const s = r.state;
    expect(zoneOf(s, "player1", "RS-075:bull")).toBe("rush");
  });

  // faq-card-2 RS-075 Q2「１体目として送ったコマンドを、２体目の代わりとしてホールドして…」「はい、可能です。」
  it("RS-075: 公式Q&A — 1体目としてコマンドゾーンに送ったETのSユニットを、ジャガーバルカンで2体目の代わりにホールドしてラッシュできる（出典: grnrngr/faq-card-2 RS-075 Q2）", () => {
    const s0 = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-075", "bull")],
        rush: [inst("RS-076", "jag"), inst("RS-091", "gored")],
        command: [released("TST-OP-ET", "e0")],
        power: powerCards(5),
      },
    });
    const r = tryZordRush(s0, "RS-075:bull", {
      materials: ["RS-091:gored"],
      destination: "command",
      mothership: true,
      pay: ["TST-OP-ET:e0", "RS-091:gored"],
    });
    expect(r.ok).toBe(true);
    const s = r.state;
    expect(zoneOf(s, "player1", "RS-075:bull")).toBe("rush");
    const gored = s.players.player1.command.find((c) => c.instanceId === "RS-091:gored");
    expect(gored?.commandHeld).toBe(true);
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });

  // faq-card-2 RS-075 Q3「…うち１体を、「救助活動」の効果で手札に戻すことができますか？」「はい、できます。」
  it("RS-075: 公式Q&A — 追加条件で捨札にしたバイオハンター・シルバ2体のうち1体を救助活動で手札に戻せる（出典: grnrngr/faq-card-2 RS-075 Q3）", () => {
    const s0 = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-075", "bull")],
        rush: [inst("RS-079", "sv1"), inst("RS-079", "sv2")],
        command: [released("TST-OP-ET", "et")],
        power: powerCards(5),
      },
    });
    let s = settle(rushBull(s0, ["RS-079:sv1", "RS-079:sv2"]));
    expect(zoneOf(s, "player1", "RS-079:sv2")).toBe("discard");
    expect(s.pendingEffectChoice?.validInstanceIds).toEqual(expect.arrayContaining(["RS-079:sv1", "RS-079:sv2"]));
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-079:sv1" });
    expect(zoneOf(s, "player1", "RS-079:sv1")).toBe("hand");
    expect(zoneOf(s, "player1", "RS-079:sv2")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-076 ジャガーバルカン", () => {
  const TEXT =
    "【母艦】これが自軍ラッシュエリアにあるとき、自分がラッシュするMユニットの追加条件を満たすために次のようにしてもよい⇒自軍Sユニットを1体コマンドゾーンに送るかわりに、「ET」の自軍コマンドを1つホールドする。";

  it("RS-076: カタログ本文・スペック（サイズ以外）が出典と一致（出典: atwiki/page-289）", () => {
    expectBodyText("RS-076", TEXT);
    const d = DEFS["RS-076"]!;
    expect(d.name).toBe("ジャガーバルカン");
    expect(d.category).toBe("ET");
    expect(d.bp).toBe(4000);
    expect(d.sp).toBeUndefined();
    expect(d.powerCost).toBe(4);
    expect(d.rushAdditionalCondition).toBeUndefined();
    expect(d.features).toEqual(["メカ", "母艦"]);
  });

  // atwiki/page-289「種類：XLユニット」
  it("RS-076: サイズは XL（出典: atwiki/page-289「種類：XLユニット」）", () => {
    expect(DEFS["RS-076"]!.size).toBe("XL");
  });

  function cosmoState(opts: { jaguarZone?: "rush" | "battle" | null; sUnit?: boolean; ets?: number }) {
    const jag = inst("RS-076", "jag");
    return st({
      phase: "rush",
      player1: {
        hand: [inst("RS-074", "cosmo")],
        rush: [...(opts.jaguarZone === "rush" ? [jag] : []), ...(opts.sUnit ? [inst("TST-UNIT-0", "s")] : [])],
        battle: opts.jaguarZone === "battle" ? [jag] : [],
        command: releasedN(opts.ets ?? 2, "TST-OP-ET", "e"),
        power: powerCards(4),
      },
    });
  }
  function mothershipRush(s0: GameState, id: string) {
    const r = tryZordRush(s0, id, { mothership: true });
    if (!r.ok) throw new Error(`rush failed: ${r.error}`);
    return r.state;
  }
  function canStartZord(s: GameState, id: string) {
    return legal(s).some(
      (a) => (a.type === "begin_zord_setup" && a.zordInstanceId === id) ||
        (a.type === "initiate_command_payment" && a.sourceInstanceId === id),
    );
  }
  /** 母艦経路でラッシュを最後まで進められるか。 */
  function canMothershipRush(s: GameState, id: string) {
    const r = tryZordRush(s, id, { mothership: true });
    return r.ok && zoneOf(r.state, "player1", id) === "rush";
  }

  // 「自軍Sユニットを1体コマンドゾーンに送るかわりに、「ET」の自軍コマンドを1つホールドする」
  it("RS-076: ラッシュエリアにあるとき、Sユニットの代わりに ET コマンドを1つホールドしてコスモバルカンをラッシュできる（カテゴリ分と合わせて2つ）（出典: atwiki/page-289）", () => {
    const s0 = cosmoState({ jaguarZone: "rush" });
    expect(canStartZord(s0, "RS-074:cosmo")).toBe(true);
    const s = mothershipRush(s0, "RS-074:cosmo");
    expect(zoneOf(s, "player1", "RS-074:cosmo")).toBe("rush");
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(2);
  });

  it("RS-076: ET コマンドが1つ（カテゴリ分）しかなければ母艦で代えられない（出典: atwiki/page-289）", () => {
    const s0 = cosmoState({ jaguarZone: "rush", ets: 1 });
    expect(canMothershipRush(s0, "RS-074:cosmo")).toBe(false);
  });

  // 「これが自軍ラッシュエリアにあるとき」
  it("RS-076: バトルエリアにあるときは母艦を使えない（出典: atwiki/page-289）", () => {
    const s0 = cosmoState({ jaguarZone: "battle" });
    expect(canMothershipRush(s0, "RS-074:cosmo")).toBe(false);
  });

  // 「次のようにしてもよい」— 任意
  it("RS-076: 母艦を使わず、通常どおり自軍Sユニットを送ってラッシュしてもよい（出典: atwiki/page-289「してもよい」）", () => {
    const s0 = cosmoState({ jaguarZone: "rush", sUnit: true });
    const r = tryZordRush(s0, "RS-074:cosmo", { materials: ["TST-UNIT-0:s"], destination: "command" });
    expect(r.ok).toBe(true);
    const s = r.state;
    expect(zoneOf(s, "player1", "RS-074:cosmo")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:s")).toBe("command");
    expect(s.players.player1.command.filter((c) => c.commandHeld)).toHaveLength(1);
  });

  // faq-card-2 RS-076 Q1「…その追加条件を満たさなくてはなりませんか？」「はい、その通りです。」
  it("RS-076: 公式Q&A — 人身略取の追加条件は、Sユニットがなくてもジャガーバルカンで満たせるなら満たさなければならない（出典: grnrngr/faq-card-2 RS-076 Q1）", () => {
    let s = st({
      activePlayer: "player2",
      phase: "battle",
      turn: 3,
      player2: { rush: [inst("RS-322", "ben")], hand: [inst("RS-074", "cosmo")] },
      player1: { rush: [inst("RS-076", "jag")], command: [released("TST-OP-ET", "e1")] },
    });
    s = act(s, { type: "move_to_battle", playerId: "player2", instanceId: "RS-322:ben" });
    for (let i = 0; i < 10; i += 1) {
      const p = s.pendingEffectChoice;
      if (p) {
        const pick = p.validInstanceIds.includes("RS-074:cosmo") ? "RS-074:cosmo" : p.validInstanceIds[0];
        if (pick === undefined) break;
        s = act(s, { type: "resolve_effect_choice", playerId: p.playerId, instanceId: pick });
        continue;
      }
      const pay = s.pendingCommandPayment;
      if (pay) {
        s = act(s, { type: "resolve_command_payment", playerId: pay.playerId, commandInstanceIds: pay.validInstanceIds.slice(0, pay.totalNeeded) });
        continue;
      }
      break;
    }
    expect(s.players.player1.command.find((c) => c.instanceId === "TST-OP-ET:e1")?.commandHeld).toBe(true);
  });

  // faq-card-2 RS-076 Q2「「RS-010 プリズムパワー」の効果で代用することはできません」
  it("RS-076: 公式Q&A — 代わりにホールドする ET コマンドはプリズムパワー（2つホールドで代用）では満たせない（出典: grnrngr/faq-card-2 RS-076 Q2）", () => {
    const s0 = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-074", "cosmo")],
        rush: [inst("RS-076", "jag")],
        operation: [inst("RS-010", "prism")],
        command: [released("TST-OP-ET", "e0"), ...releasedN(3, "TST-OP-OT", "o")],
        power: powerCards(4),
      },
    });
    expect(canMothershipRush(s0, "RS-074:cosmo")).toBe(false);
  });

  // faq-card-2 RS-076 Q3「「RS-195ダイナマッハ」そのものをホールドすることで…」「はい、出来ます。」
  it("RS-076: 公式Q&A — ダイナギャリーで選んだダイナマッハそのものをホールドして追加条件の代わりにできる（出典: grnrngr/faq-card-2 RS-076 Q3）", () => {
    let s = st({
      phase: "battle",
      player1: {
        rush: [inst("RS-197", "gal"), inst("RS-076", "jag")],
        command: [inst("RS-195", "dm")],
        power: powerCards(6),
      },
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: "RS-197:gal" });
    expect(s.pendingEffectChoice?.validInstanceIds ?? []).toContain("RS-195:dm");
    s = act(s, { type: "resolve_effect_choice", playerId: "player1", instanceId: "RS-195:dm" });
    for (let i = 0; i < 6 && zoneOf(s, "player1", "RS-195:dm") !== "rush"; i += 1) {
      const acts = legal(s);
      const step =
        acts.find((a) => a.type === "resolve_zord_setup" && "paymentPath" in a && a.paymentPath === "mothership") ??
        acts.find((a) => a.type === "resolve_command_payment" && a.commandInstanceIds.includes("RS-195:dm")) ??
        acts.find((a) => a.type === "resolve_zord_setup");
      if (!step) break;
      s = act(s, step);
    }
    expect(zoneOf(s, "player1", "RS-195:dm")).toBe("rush");
  });

  // faq-card-2 RS-076 Q4「コマンドゾーンがすでに上限の５枚…」「はい、出来ます。」
  it("RS-076: 公式Q&A — コマンドゾーンが5枚で埋まっていても使える（出典: grnrngr/faq-card-2 RS-076 Q4）", () => {
    const s0 = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-074", "cosmo")],
        rush: [inst("RS-076", "jag"), inst("TST-UNIT-0", "s")],
        command: [...releasedN(2, "TST-OP-ET", "e"), ...releasedN(3, "TST-OP", "w")],
        power: powerCards(4),
      },
    });
    const s = mothershipRush(s0, "RS-074:cosmo");
    expect(zoneOf(s, "player1", "RS-074:cosmo")).toBe("rush");
    expect(zoneOf(s, "player1", "TST-UNIT-0:s")).toBe("rush");
  });

  // faq-card-2 RS-076 Q5「…ワイルドビーストやミスティックアームズのＭユニット…」「いいえ、できません。」
  it("RS-076: 公式Q&A — 「コマンドゾーンに送る」と書かれていない MA の Mユニット（ハリケンホーク）には使えない（出典: grnrngr/faq-card-2 RS-076 Q5）", () => {
    const s0 = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-096", "hawk")],
        rush: [inst("RS-076", "jag")],
        command: [released("TST-OP-MA", "ma"), released("TST-OP-ET", "e1")],
        power: powerCards(4),
      },
    });
    expect(canStartZord(s0, "RS-096:hawk")).toBe(false);
    expect(canMothershipRush(s0, "RS-096:hawk")).toBe(false);
  });

  // faq-card-2 RS-076 Q6「自軍Sユニットが１枚もラッシュされていなくても発動することができますか？」「はい、できます。」
  it("RS-076: 公式Q&A — 自軍Sユニットが1体もなくても使える（出典: grnrngr/faq-card-2 RS-076 Q6）", () => {
    const s0 = cosmoState({ jaguarZone: "rush", sUnit: false });
    expect(s0.players.player1.rush.filter((c) => c.cardId === "TST-UNIT-0")).toHaveLength(0);
    const s = mothershipRush(s0, "RS-074:cosmo");
    expect(zoneOf(s, "player1", "RS-074:cosmo")).toBe("rush");
  });

  // faq-card-2 RS-076 Q7「「アーステクノロジー」のコマンドを２つホールドします。」
  it("RS-076: 公式Q&A — ブルバルカンを Sユニット1体＋母艦でラッシュすると ET コマンドを合計2つホールドする（出典: grnrngr/faq-card-2 RS-076 Q7）", () => {
    const s0 = st({
      phase: "rush",
      player1: {
        hand: [inst("RS-075", "bull")],
        rush: [inst("RS-076", "jag"), inst("TST-UNIT-0", "s")],
        command: releasedN(3, "TST-OP-ET", "e"),
        power: powerCards(5),
      },
    });
    const r = tryZordRush(s0, "RS-075:bull", { materials: ["TST-UNIT-0:s"], destination: "command", mothership: true });
    expect(r.ok).toBe(true);
    const s = r.state;
    expect(zoneOf(s, "player1", "RS-075:bull")).toBe("rush");
    expect(s.players.player1.command.filter((c) => c.commandHeld && c.cardId === "TST-OP-ET")).toHaveLength(2);
  });
});

// ===========================================================================
describe("RS-077 機関車仮面", () => {
  const TEXT =
    "※これは毎ターン、可能ならバトルエリアに出る。【競争】お互いに山札の上から1枚をオモテにし、必要パワーの数字をくらべる。そして数字の大きい方を持ち主の手札に加え、小さい方を持ち主の山札の下に戻す。同じならそれぞれ山札の上に戻す。";

  it("RS-077: カタログ本文・スペックが出典と一致（出典: atwiki/page-324）", () => {
    expectBodyText("RS-077", TEXT);
    expectStats("RS-077", {
      name: "機関車仮面",
      category: "DA",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 3,
      comboNumber: 3,
      features: ["怪人", "男"],
    });
  });

  // 「※これは毎ターン、可能ならバトルエリアに出る。」
  it("RS-077: ラッシュエリアにあり出られるなら、バトルエリアに出さずにバトルフェイズを終えられない（出典: atwiki/page-324）", () => {
    const s = st({ player1: { rush: [inst("RS-077", "loco")] } });
    expect(legalOfType(s, "end_phase")).toHaveLength(0);
    expect(canEnter(s, "RS-077:loco")).toBe(true);
  });

  function raceState(myTop: string, enemyTop: string, battle = 2) {
    return st({
      player1: { battle: fillers(battle), rush: [inst("RS-077", "loco")], deck: [inst(myTop, "m"), inst("TST-OP", "m2")] },
      player2: { deck: [inst(enemyTop, "e"), inst("TST-OP", "e2")] },
    }, EXTRA);
  }

  // 「数字の大きい方を持ち主の手札に加え、小さい方を持ち主の山札の下に戻す」
  it("RS-077: 3番目に出ると【競争】— 自分のカードの必要パワーが大きければ自分の手札に加え、相手のカードは相手の山札の下へ（出典: atwiki/page-324）", () => {
    const s = enter(raceState("SPEC-S-P5", "SPEC-S-P2"), "RS-077:loco");
    expect(zoneOf(s, "player1", "SPEC-S-P5:m")).toBe("hand");
    expect(zoneIds(s, "player2", "deck")).toEqual(["TST-OP:e2", "SPEC-S-P2:e"]);
  });

  it("RS-077: 相手のカードの必要パワーが大きければ相手の手札に加え、自分のカードは自分の山札の下へ（出典: atwiki/page-324「持ち主の手札」）", () => {
    const s = enter(raceState("SPEC-S-P2", "SPEC-S-P5"), "RS-077:loco");
    expect(zoneOf(s, "player2", "SPEC-S-P5:e")).toBe("hand");
    expect(zoneIds(s, "player1", "deck")).toEqual(["TST-OP:m2", "SPEC-S-P2:m"]);
  });

  // 「同じならそれぞれ山札の上に戻す」
  it("RS-077: 必要パワーが同じならそれぞれ山札の上に戻す（出典: atwiki/page-324）", () => {
    const s = enter(raceState("SPEC-S-P2", "SPEC-S-P2"), "RS-077:loco");
    expect(zoneIds(s, "player1", "deck")).toEqual(["SPEC-S-P2:m", "TST-OP:m2"]);
    expect(zoneIds(s, "player2", "deck")).toEqual(["SPEC-S-P2:e", "TST-OP:e2"]);
  });

  // 「必要パワーの数字」— 「6+」は 6
  it("RS-077: 「+」付きの必要パワー（サンバルカンロボ 6+）は数字 6 として比べる（出典: atwiki/page-324）", () => {
    const s = enter(raceState("SPEC-S-P5", "RS-073"), "RS-077:loco");
    expect(zoneOf(s, "player2", "RS-073:e")).toBe("hand");
  });

  // 「CN：3」
  it("RS-077: 3番目以外（1番目）に出ても【競争】は発動しない（出典: atwiki/page-324「CN：3」）", () => {
    const s = enter(raceState("SPEC-S-P5", "SPEC-S-P2", 0), "RS-077:loco");
    expect(zoneIds(s, "player1", "deck")).toEqual(["SPEC-S-P5:m", "TST-OP:m2"]);
    expect(zoneIds(s, "player2", "deck")).toEqual(["SPEC-S-P2:e", "TST-OP:e2"]);
  });
});

// ===========================================================================
describe("RS-078 ダークナイト", () => {
  const TEXT = "【闇の舞】敵軍ラッシュエリアか敵軍バトルエリアに特徴「レッド」を持つユニットがあるとき、このユニットは次の能力を得る。⇒SP1";

  it("RS-078: カタログ本文・スペックが出典と一致（出典: atwiki/page-325）", () => {
    expectBodyText("RS-078", TEXT);
    expectStats("RS-078", {
      name: "ダークナイト",
      category: "DA",
      size: "S",
      bp: 4000,
      sp: "special",
      powerCost: 5,
      features: ["有尾人一族", "男"],
    });
  });

  function knight(p1: Partial<GameState["players"]["player1"]>, p2: Partial<GameState["players"]["player2"]>) {
    return st({
      player1: { battle: [inst("RS-078", "dk")], ...p1 },
      player2: { power: powerCards(3, "e"), ...p2 },
    }, EXTRA);
  }

  it("RS-078: 敵軍ラッシュエリアに特徴「レッド」のユニットがあれば SP1（ストライクで1点）（出典: atwiki/page-325）", () => {
    expect(strikeDamage(knight({}, { rush: [inst("SPEC-S-RED", "r")] }), "RS-078:dk")).toBe(1);
  });

  it("RS-078: 敵軍バトルエリアに特徴「レッド」のユニットがあっても SP1（出典: atwiki/page-325）", () => {
    const s = knight({}, { battle: [inst("SPEC-S-RED", "r")] });
    expect(canStrike(s, "RS-078:dk")).toBe(true);
  });

  it("RS-078: 敵軍にレッドがいなければ SP を得ずストライクできない（出典: atwiki/page-325「SP：！」）", () => {
    expect(canStrike(knight({}, { rush: [inst("TST-UNIT-0", "x")] }), "RS-078:dk")).toBe(false);
  });

  it("RS-078: 自軍のレッドや、敵軍コマンドゾーンのレッドのカードは条件にならない（出典: atwiki/page-325「敵軍ラッシュエリアか敵軍バトルエリア」）", () => {
    expect(canStrike(knight({ rush: [inst("SPEC-S-RED", "own")] }, {}), "RS-078:dk")).toBe(false);
    expect(canStrike(knight({}, { command: [released("SPEC-S-RED", "cmd")] }), "RS-078:dk")).toBe(false);
  });
});

// ===========================================================================
describe("RS-079 バイオハンター・シルバ", () => {
  const TEXT = "【バイバスター】これは敵軍コマンドゾーンにある「OT」のコマンド1つにつきBP+1000される。これはBP5000以上のとき「SP1」になる。";

  it("RS-079: カタログ本文・スペックが出典と一致（出典: atwiki/page-15）", () => {
    expectBodyText("RS-079", TEXT);
    expectStats("RS-079", {
      name: "バイオハンター・シルバ",
      category: "DA",
      size: "S",
      bp: 3000,
      sp: "special",
      powerCost: 2,
      features: ["メカ", "人型"],
    });
  });

  function silva(enemyCommand: ReturnType<typeof inst>[], opts: { active?: PlayerId } = {}) {
    return st({
      activePlayer: opts.active ?? "player1",
      player1: { battle: [inst("RS-079", "sv")] },
      player2: { command: enemyCommand, power: powerCards(3, "e") },
    });
  }

  // 「敵軍コマンドゾーンにある「OT」のコマンド1つにつきBP+1000される」— 状態の指定はない
  it("RS-079: 敵軍コマンドゾーンの OT コマンド（リリース状態）1つにつき BP+1000、OT 以外は数えない（出典: atwiki/page-15）", () => {
    expect(bpOf(silva([]), "player1", "RS-079:sv")).toBe(3000);
    expect(bpOf(silva([released("TST-OP-OT", "o1"), released("TST-OP-OT", "o2"), released("TST-OP-ET", "x")]), "player1", "RS-079:sv")).toBe(5000);
  });

  it.fails("RS-079: ホールド状態の OT コマンドも1つにつき +1000 だけ（1つで BP4000）（出典: atwiki/page-15）", () => {
    // 既知の不具合: CARD-RS-079 ホールド状態の OT コマンドが二重に数えられる（DSL の BP 加算と legend2 フィールド効果の両方で +1000）
    expect(bpOf(silva([held("TST-OP-OT", "o1"), held("TST-OP-ET", "x")]), "player1", "RS-079:sv")).toBe(4000);
  });

  // 「これはBP5000以上のとき「SP1」になる」
  it("RS-079: ホールド状態の OT コマンド2つで BP5000以上なら SP1（ストライクで1点）、1つならストライクできない（出典: atwiki/page-15）", () => {
    expect(strikeDamage(silva([held("TST-OP-OT", "o1"), held("TST-OP-OT", "o2")]), "RS-079:sv")).toBe(1);
    expect(canStrike(silva([held("TST-OP-OT", "o1")]), "RS-079:sv")).toBe(false);
  });

  it("RS-079: リリース状態の OT コマンド2つで BP5000 になったときも SP1（出典: atwiki/page-15）", () => {
    expect(strikeDamage(silva([released("TST-OP-OT", "o1"), released("TST-OP-OT", "o2")]), "RS-079:sv")).toBe(1);
  });

  // faq-card-2 RS-079 Q1「相手のターンも有効になりますか？」「はい、その通りです。」
  it("RS-079: 公式Q&A — バイバスターは相手のターンも有効（出典: grnrngr/faq-card-2 RS-079 Q1）", () => {
    const s = silva([released("TST-OP-OT", "o1"), released("TST-OP-OT", "o2")], { active: "player2" });
    expect(bpOf(s, "player1", "RS-079:sv")).toBe(5000);
  });

  // faq-card-2 RS-079 Q2「…BPを上昇させる効果で一定以上になった場合も…「SP１」になりますか？」「はい」
  it("RS-079: 公式Q&A — ガオ・ソウル（BP+4000）で BP5000以上になった場合も SP1（出典: grnrngr/faq-card-2 RS-079 Q2）", () => {
    let s = st({
      phase: "rush",
      player1: {
        battle: [inst("RS-079", "sv")],
        hand: [inst("RS-025", "soul")],
        command: [released("TST-OP", "wb")],
        power: powerCards(2),
      },
      player2: { power: powerCards(3, "e") },
    });
    expect(canStrike(toBattle(s), "RS-079:sv")).toBe(false);
    const r = playOp(s, "player1", "RS-025:soul", "RS-079:sv");
    expect(r.ok).toBe(true);
    s = toBattle(r.state);
    expect(bpOf(s, "player1", "RS-079:sv")).toBe(7000);
    expect(strikeDamage(s, "RS-079:sv")).toBe(1);
  });
});

// ===========================================================================
describe("RS-080 ヒドラー兵", () => {
  // ライブ写し pages/326.txt「テキスト ※このカードはデッキに3枚以上入れてもよい。」
  it("RS-080: カタログ本文・スペックが出典と一致（出典: atwiki/page-326、ライブ写し pages/326.txt）", () => {
    expectBodyText("RS-080", "※このカードはデッキに3枚以上入れてもよい。");
    expectStats("RS-080", {
      name: "ヒドラー兵",
      category: "DA",
      size: "S",
      bp: 500,
      sp: undefined,
      powerCost: 0,
      features: ["戦闘員"],
    });
  });

  // 「※このカードはデッキに3枚以上入れてもよい。」
  it("RS-080: デッキに4枚以上入れてもデッキ構築エラーにならない（他のカードは4枚でエラー）（出典: atwiki/page-326、R-DECK-03）", () => {
    const filler = allCardsCatalog.cards
      .filter((c) => c.type === "operation" && c.id.startsWith("RS-0"))
      .slice(0, 20)
      .map((c) => ({ cardId: c.id, count: 1 }));
    const ok = validateDeckEntries([{ cardId: "RS-080", count: 10 }, ...filler], allCardsCatalog, { minSize: 1 });
    expect(ok.errors.filter((e) => e.includes("ヒドラー兵"))).toEqual([]);
    const ng = validateDeckEntries([{ cardId: "RS-079", count: 4 }], allCardsCatalog, { minSize: 1 });
    expect(ng.errors.some((e) => e.includes("バイオハンター・シルバ"))).toBe(true);
  });

  // 「必要パワー：0」「追加条件：なし」
  it("RS-080: パワー0・DA コマンド1つのホールドでラッシュできる（出典: atwiki/page-326）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-080", "h")], command: [released("TST-OP-DA", "da")], power: [] } });
    const can = legal(s).some(
      (a) => (a.type === "initiate_command_payment" && a.sourceInstanceId === "RS-080:h") || (a.type === "rush" && a.instanceId === "RS-080:h"),
    );
    expect(can).toBe(true);
  });

  // 「SP：－」
  it("RS-080: SP がないのでストライクできない（出典: atwiki/page-326「SP：－」）", () => {
    const s = passEntry(st({ player1: { battle: [inst("RS-080", "h")] }, player2: { power: powerCards(2, "e") } }));
    expect(canStrike(s, "RS-080:h")).toBe(false);
  });
});
