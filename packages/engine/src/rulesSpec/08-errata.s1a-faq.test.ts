/**
 * docs/rules/08-errata.md §1A 公式カードFAQ内の読み替え・訂正（10件）
 *
 * 出典: docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/{card_6,card_7,card_8,rider_1,rider_2,index}.html
 *       docs/rules/sources/web/w.atwiki.jp/renst/pages/{1240,1208,605,187,808,820,626}.txt
 * 期待値はルールブック（08 章）と公式ページに従う。エンジンの現状には合わせない。
 */
import { describe, expect, it } from "vitest";
import { cardCategories } from "@rangers-strike/cards";
import { effectiveBp } from "../index";
import type { GameAction } from "../types/actions";
import type { GameState } from "../types/game";
import {
  act,
  cardDef,
  engineText,
  expectCorrectedText,
  inst,
  legal,
  legalOfType,
  norm,
  powerCards,
  released,
  sUnit,
  specState,
  zoneIds,
} from "./08-helpers";

const J = (a: GameAction) => JSON.stringify(a);

// ---------------------------------------------------------------------------
describe("R-ERR-RS575 一角聖馬ユニゴルオン", () => {
  // card_8.html:「『ラッシュエリアのユニットにアタックできる。』の部分については、『敵軍ラッシュエリアのユニットにアタックできる。』と読み替えて」
  it("R-ERR-RS575: 修正後テキスト「⇒敵軍ラッシュエリアのユニットにアタックできる」を持つ（出典: grnrngr/faq-card-8 RK-575）", () => {
    expectCorrectedText(
      "RS-575",
      "【世界を駆ける力】これにライドしているユニットは、次の能力を得る⇒敵軍ラッシュエリアのユニットにアタックできる。",
    );
  });

  it("R-ERR-RS575: 修正前の「⇒ラッシュエリアのユニットに」（敵軍なし）を残していない（出典: grnrngr/faq-card-8 RK-575）", () => {
    expect(norm(engineText("RS-575"))).not.toContain(norm("次の能力を得る⇒ラッシュエリアのユニット"));
  });

  /** ユニゴルオンにライドした（DA を持たない人型 M）ユニットをバトルエリアに出す。 */
  function riderEntered(): { s: GameState; rider: string; enemyRush: string; ownRush: string } {
    const v = inst("RS-575", "v");
    const rider = { ...inst("RIDER", "r"), mountedOnInstanceId: v.instanceId };
    const ownRush = inst("TST-UNIT-0", "own-rush");
    const enemyRush = inst("TST-UNIT-0", "enemy-rush");
    let s = specState(["RS-575"], {
      phase: "battle",
      player1: { rush: [rider, v, ownRush] },
      player2: { rush: [enemyRush], battle: [inst("TST-UNIT-0", "enemy-battle")] },
    });
    s.definitions["RIDER"] = sUnit("RIDER", {
      size: "M",
      category: "MA",
      bp: 3000,
      features: ["人型"],
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: rider.instanceId });
    if (s.pendingRideOffChoice) {
      s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: false });
    }
    return {
      s,
      rider: rider.instanceId,
      enemyRush: enemyRush.instanceId,
      ownRush: ownRush.instanceId,
    };
  }

  // 08 章 正:「これにライドしているユニットは、次の能力を得る⇒敵軍ラッシュエリアのユニットにアタックできる」
  it("R-ERR-RS575: ライドしているユニットは敵軍ラッシュエリアのユニットにアタックできる（出典: grnrngr/faq-card-8 RK-575）", () => {
    const { s, rider, enemyRush } = riderEntered();
    expect(
      legalOfType(s, "battle").some(
        (a) => a.attackerInstanceId === rider && a.defenderInstanceId === enemyRush,
      ),
    ).toBe(true);
  });

  // card_8.html の質問「この「ラッシュエリア」は自軍・敵軍を問わない…？」への回答として「敵軍」に限定
  it("R-ERR-RS575: 公式Q&A — 自軍ラッシュエリアのユニットにはアタックできない（出典: grnrngr/faq-card-8 RK-575）", () => {
    const { s, ownRush } = riderEntered();
    expect(legalOfType(s, "battle").some((a) => a.defenderInstanceId === ownRush)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-RS603 蛮機獣ボンベバンキ", () => {
  // card_8.html:「【超有毒液化ガス】これが自軍エリアにある間、本来の特徴に「車両」を持つユニットは…」
  it("R-ERR-RS603: 修正後テキスト「本来の特徴に「車両」を持つユニット」を持つ（出典: grnrngr/faq-card-8 RS-603）", () => {
    expectCorrectedText(
      "RS-603",
      "【超有毒液化ガス】これが自軍エリアにある間、本来の特徴に「車両」を持つユニットはアタックもストライクもできず、効果名を持つテキストは無効になり、発動もできない。",
    );
  });

  function vehicleUnitState(bombeOwner: "player1" | "player2") {
    const car = inst("CAR", "car");
    const bombe = inst("RS-603", "bombe");
    const s = specState(["RS-603"], {
      phase: "battle",
      player1: {
        battle: [car],
        rush: bombeOwner === "player1" ? [bombe] : [],
      },
      player2: {
        battle: [inst("TST-UNIT-0", "enemy")],
        rush: bombeOwner === "player2" ? [bombe] : [],
      },
    });
    s.definitions["CAR"] = sUnit("CAR", { bp: 5000, sp: 1, features: ["車両"] });
    return { s, car: car.instanceId };
  }

  const attacksOrStrikes = (s: GameState, id: string) =>
    legal(s).some(
      (a) =>
        (a.type === "strike" && a.instanceId === id) ||
        (a.type === "battle" && a.attackerInstanceId === id),
    );

  it("R-ERR-RS603: ボンベバンキが自軍エリアにある間、本来の特徴に「車両」を持つ自軍ユニットはアタックもストライクもできない（出典: grnrngr/faq-card-8 RS-603）", () => {
    const { s, car } = vehicleUnitState("player1");
    expect(attacksOrStrikes(s, car)).toBe(false);
  });

  // 正文の対象は「本来の特徴に「車両」を持つユニット」で、自軍・敵軍を限定しない
  it("R-ERR-RS603: 敵軍の本来の特徴「車両」ユニットもアタック・ストライクできない（出典: grnrngr/faq-card-8 RS-603）", () => {
    const { s, car } = vehicleUnitState("player2");
    expect(attacksOrStrikes(s, car)).toBe(false);
  });

  it("R-ERR-RS603: 「車両」を持たないユニットは制限を受けない（出典: grnrngr/faq-card-8 RS-603）", () => {
    const { s } = vehicleUnitState("player1");
    s.definitions["CAR"] = sUnit("CAR", { bp: 5000, sp: 1, features: ["メカ"] });
    expect(attacksOrStrikes(s, "CAR:car")).toBe(true);
  });

  // card_8.html RS-603: RS-203 大帝ラー・デウスで追加された特徴「車両」でボンベバンキ自身が対象になる問題への回答
  it.todo(
    "R-ERR-RS603: 公式Q&A — 【デウス遺伝子】で後から追加された「車両」は「本来の特徴」ではないので、ボンベバンキ自身の【超有毒液化ガス】は無効にならない（出典: grnrngr/faq-card-8 RS-603）— RS-203 の特徴追加がエンジン未実装のため状態を作れない",
  );
});

// ---------------------------------------------------------------------------
describe("R-ERR-RS365 イナズマギンガー", () => {
  // card_6.html:「「RS-365 イナズマギンガー」の追加条件は「これ以外の自分の手札を全て捨札にする」と読み換えてラッシュしてください」
  it("R-ERR-RS365: 追加条件のテキストが「これ以外の自分の手札を全て捨札にする」（出典: grnrngr/faq-card-6 RS-365）", () => {
    expect(norm(cardDef("RS-365")?.rushAdditionalCondition?.text)).toBe(
      norm("これ以外の自分の手札を全て捨札にする"),
    );
  });

  // 08 章:「【帝国の掌握】は印刷どおり（読み替えなし）」
  it("R-ERR-RS365: 【帝国の掌握】は印刷どおりのテキスト（出典: grnrngr/faq-card-6 RS-365、atwiki/page-605）", () => {
    expectCorrectedText(
      "RS-365",
      "【帝国の掌握】自軍ターン中、これがバトルエリアに出たとき、自分の手札をすべて相手に見せる。そして、見せた手札と同じカード名の敵軍ユニットを全て撃破する。その後、自分の手札をすべて捨札にし、この効果で撃破した敵軍ユニット1体につき、このターン、これはSP+1される。",
    );
  });

  function gingerState(otherHand: string[]) {
    const g = inst("RS-365", "g");
    const others = otherHand.map((id, i) => inst(id, `h${i}`));
    const s = specState(["RS-365"], {
      phase: "rush",
      player1: {
        hand: [g, ...others],
        command: [released("TST-OP-DA", "d1")],
        power: powerCards(3),
      },
    });
    return { s, g: g.instanceId, others: others.map((c) => c.instanceId) };
  }

  const rushActionFor = (s: GameState, id: string) =>
    legal(s).find(
      (a) =>
        (a.type === "rush" && a.instanceId === id) ||
        (a.type === "initiate_command_payment" && a.sourceInstanceId === id),
    );

  it("R-ERR-RS365: これ以外の手札をすべて捨札にしてラッシュでき、イナズマギンガー自身はラッシュエリアに出る（出典: grnrngr/faq-card-6 RS-365）", () => {
    const { s: s0, g, others } = gingerState(["TST-OP", "TST-OP"]);
    const action = rushActionFor(s0, g);
    expect(action).toBeDefined();
    const s = act(s0, action!);
    expect(zoneIds(s, "player1", "rush")).toContain(g);
    expect(zoneIds(s, "player1", "discard")).toEqual(expect.arrayContaining(others));
    expect(s.players.player1.hand).toHaveLength(0);
  });

  // card_6.html:「１枚もなければ「すべて捨札にする」という行為を達成することができず、追加条件が満たせないからです」
  it("R-ERR-RS365: 公式Q&A — これ以外の手札が1枚もなければラッシュできない（出典: grnrngr/faq-card-6 RS-365 Q2）", () => {
    const { s, g } = gingerState([]);
    expect(rushActionFor(s, g)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-RK043 ライドシューター", () => {
  // rider_1.html:「そうしたとき、このターン、次にラッシュする特徴「ミラーライダー」を持つユニットカードの必要パワーの数字は3少なくなり…」
  it("R-ERR-RK043: 修正後テキスト「そうしたとき、このターン、次にラッシュする…」を持つ（出典: grnrngr/faq-rider-1 RK-043）", () => {
    expectCorrectedText(
      "RK-043",
      "【突入】自軍ラッシュフェイズ中、このビークルを捨札にしてもよい。そうしたとき、このターン、次にラッシュする特徴「ミラーライダー」を持つユニットカードの必要パワーの数字は3少なくなり、コマンドをホールドせずにラッシュできる（この効果は重複しない）。",
    );
  });

  it("R-ERR-RK043: ※行「このカードはデッキに好きな枚数入れてもよい」は印刷どおり（出典: grnrngr/faq-rider-1 RK-043）", () => {
    expectCorrectedText("RK-043", "※このカードはデッキに好きな枚数入れてもよい。");
  });

  // 08 章 効果:「対象は「捨札にしたそのターン中に、最初にラッシュする特徴「ミラーライダー」を持つユニットカード」」
  it("R-ERR-RK043: 【突入】で捨札にしたターン、必要パワー3のミラーライダーをパワー0・コマンドのホールドなしでラッシュできる（出典: grnrngr/faq-rider-1 RK-043）", () => {
    const rs = inst("RK-043", "rs");
    const raia = inst("RK-036", "raia");
    let s = specState(["RK-043", "RK-036"], {
      phase: "rush",
      player1: { rush: [rs], hand: [raia] },
    });
    const discardShooter = legal(s).find(
      (a) => a.type !== "end_phase" && J(a).includes(rs.instanceId),
    );
    expect(discardShooter).toBeDefined();
    s = act(s, discardShooter!);
    expect(zoneIds(s, "player1", "discard")).toContain(rs.instanceId);
    const rush = legal(s).find((a) => a.type === "rush" && a.instanceId === raia.instanceId);
    expect(rush).toBeDefined();
  });

  it("R-ERR-RK043: 【突入】を使っていなければ必要パワー3のミラーライダーはパワー0ではラッシュできない（出典: grnrngr/faq-rider-1 RK-043）", () => {
    const raia = inst("RK-036", "raia");
    const s = specState(["RK-043", "RK-036"], {
      phase: "rush",
      player1: { rush: [inst("RK-043", "rs")], hand: [raia] },
    });
    expect(
      legal(s).some(
        (a) =>
          (a.type === "rush" && a.instanceId === raia.instanceId) ||
          (a.type === "initiate_command_payment" && a.sourceInstanceId === raia.instanceId),
      ),
    ).toBe(false);
  });

  // rider_1.html Q1:「効果の対象は、『「RK-043 ライドシューター」を捨札にしたそのターン中に、最初にラッシュする…ユニットカード』」
  it.todo(
    "R-ERR-RK043: 公式Q&A — 捨札にしたターン中にミラーライダーをラッシュしなければ、次のターンには軽減されない（出典: grnrngr/faq-rider-1 RK-043 Q1）— 【突入】自体がエンジン未実装のため起点の状態を作れない",
  );
  // rider_1.html Q2:「効果の対象は「ユニットカード」になりますので、敵軍バトルエリアに「RK-035 ダークウィング」があっても…ラッシュできる」
  it.todo(
    "R-ERR-RK043: 公式Q&A — RK-035 ダークウィングで特徴を失う場合でも対象は「ユニットカード」なので適用できる（出典: grnrngr/faq-rider-1 RK-043 Q2）— 【突入】がエンジン未実装",
  );
});

// ---------------------------------------------------------------------------
describe("R-ERR-RS486 ソードスラッシャー", () => {
  // card_7.html:「手札から選びます。「RS-486 ソードスラッシャー」のテキストは、以下のように読み替えます」
  it("R-ERR-RS486: 修正後テキスト「…自分の手札から好きな枚数選び、自軍ラッシュエリアに出してもよい」を持つ（出典: grnrngr/faq-card-7 RS-486）", () => {
    expectCorrectedText(
      "RS-486",
      "※これはSユニットにアタックされない。【分身幻斬り】これと同カテゴリのLユニットがこのユニットからコンビネーションするとき、次の効果を発動できる⇒コンビネーションしたLユニットがアタックまたはストライクしたとき、その処理をすべて終えてから、そのLユニットと同じカード名のユニットカードを、その合体に必要なユニットの数まで、自分の手札から好きな枚数選び、自軍ラッシュエリアに出してもよい。",
    );
  });

  // 「※これはSユニットにアタックされない」— 読み替え文にも含まれる部分の挙動
  it("R-ERR-RS486: ※これはSユニットにアタックされない（出典: grnrngr/faq-card-7 RS-486）", () => {
    const atk = inst("TST-UNIT-0", "s-attacker");
    const sword = inst("RS-486", "sword");
    const s = specState(["RS-486"], {
      phase: "battle",
      player1: { battle: [atk] },
      player2: { battle: [sword] },
    });
    expect(
      legalOfType(s, "battle").some((a) => a.defenderInstanceId === sword.instanceId),
    ).toBe(false);
  });

  // card_7.html Q:「…どの場所から選ぶことができるのでしょうか？ 手札から選びます。」
  it.todo(
    "R-ERR-RS486: 公式Q&A — 【分身幻斬り】で出す同名ユニットカードは手札から選ぶ（山札・捨札・コマンド・パワーからは選べない）（出典: grnrngr/faq-card-7 RS-486）— LユニットのRS-486からのコンビネーション成立をテスト状態で再現する手段がない",
  );
});

// ---------------------------------------------------------------------------
describe("R-ERR-RS504 獣人メレ", () => {
  // card_7.html:「「メレ」とあるのですが、これは「獣人メレ」のことを指しますか？ はい、そのとおりです。」
  it("R-ERR-RS504: 修正後テキスト「「獣人メレ」以外の自軍ユニットがバトルエリアに出たとき」を持つ（出典: grnrngr/faq-card-7 RS-504）", () => {
    expectCorrectedText(
      "RS-504",
      "【臨獣カメレオン拳】これが自軍エリアにある間、「獣人メレ」以外の自軍ユニットがバトルエリアに出たとき、次の効果から1つ選び発動できる⇒◎自軍コマンドゾーンからカードを1枚選び捨札にする。◎自軍コマンドゾーンにカードが1枚も無ければ、自軍捨札からカードを1枚選び、自軍コマンドゾーンにリリース状態で置く。",
    );
  });

  function meleState(enteringId: string, enteringName?: string) {
    const mele = inst("RS-504", "mele");
    const entering = inst(enteringId, "enter");
    const s = specState(["RS-504", "RS-662"], {
      phase: "battle",
      player1: {
        rush: [mele, entering],
        command: [released("TST-OP", "cmd")],
      },
      player2: { battle: [inst("TST-UNIT-0", "enemy")] },
    });
    if (enteringName) {
      s.definitions[enteringId] = sUnit(enteringId, { name: enteringName, category: "DA" });
    }
    return { s, mele: mele.instanceId, entering: entering.instanceId };
  }

  const meleTriggered = (s: GameState) =>
    s.pendingEffectChoice?.sourceCardId === "RS-504" ||
    s.pendingEffectChoice?.effectId === "kamereon_ken" ||
    s.log.some((e) => e.includes("RS-504") && e.includes("kamereon"));

  it("R-ERR-RS504: 獣人メレ以外の自軍ユニットがバトルエリアに出ると【臨獣カメレオン拳】を発動できる（出典: grnrngr/faq-card-7 RS-504）", () => {
    const { s: s0, entering } = meleState("OTHER", "テストユニット");
    const s = act(s0, { type: "move_to_battle", playerId: "player1", instanceId: entering });
    expect(meleTriggered(s)).toBe(true);
  });

  it("R-ERR-RS504: 名前に「メレ」を含んでも「獣人メレ」でなければ（RS-662 鳳凰メレ）発動条件を満たす（出典: grnrngr/faq-card-7 RS-504）", () => {
    const { s: s0, entering } = meleState("RS-662");
    const s = act(s0, { type: "move_to_battle", playerId: "player1", instanceId: entering });
    expect(meleTriggered(s)).toBe(true);
  });

  // 「メレ」→「獣人メレ」の読み替えにより、除外されるのは「獣人メレ」だけ
  it("R-ERR-RS504: カード名「メレ」のユニットは「獣人メレ」ではないので発動条件を満たす（出典: grnrngr/faq-card-7 RS-504）", () => {
    const { s: s0, entering } = meleState("MERE", "メレ");
    const s = act(s0, { type: "move_to_battle", playerId: "player1", instanceId: entering });
    expect(meleTriggered(s)).toBe(true);
  });

  it("R-ERR-RS504: 公式Q&A — 「獣人メレ」自身がバトルエリアに出ても発動しない（出典: grnrngr/faq-card-7 RS-504）", () => {
    const { s: s0, mele } = meleState("TST-UNIT-0");
    const s = act(s0, { type: "move_to_battle", playerId: "player1", instanceId: mele });
    expect(meleTriggered(s)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-RK086 アカネタカ", () => {
  // rider_2.html:「（ただし１つのタイミングに発動できる「アカネタカ」は１枚だけとする）」
  it("R-ERR-RK086: 修正後テキスト「（ただし１つのタイミングに発動できる「アカネタカ」は１枚だけとする）」を持つ（出典: grnrngr/faq-rider-2 RK-086）", () => {
    expectCorrectedText(
      "RK-086",
      "敵軍ユニットにストライクされて、自軍パワーゾーンのオモテ向きのカードか自軍山札の上からひいたカードをダメージにするとき発動できる（ただし１つのタイミングに発動できる「アカネタカ」は１枚だけとする）⇒ダメージにするカードのかわりに、このカードを相手に見せてから自軍パワーゾーンにダメージにして置く。その後、自分は１枚ドローする。",
    );
  });

  function struckWithTwoAkanetaka() {
    const st = inst("TST-UNIT-0", "striker");
    const a1 = inst("RK-086", "a1");
    const a2 = inst("RK-086", "a2");
    let s = specState(["RK-086"], {
      phase: "battle",
      player1: { battle: [st] },
      player2: {
        hand: [a1, a2],
        command: [released("TST-OP-MA", "m1"), released("TST-OP-MA", "m2")],
        power: powerCards(2),
        deck: Array.from({ length: 4 }, (_, i) => inst("TST-OP", `e${i}`)),
      },
    });
    s = act(s, { type: "strike", playerId: "player1", instanceId: st.instanceId });
    return { s, a1: a1.instanceId, a2: a2.instanceId };
  }

  const usesAkanetaka = (s: GameState, id: string) =>
    legal(s).find((a) => a.playerId === "player2" && J(a).includes(id));

  it("R-ERR-RK086: ストライクのダメージにするときアカネタカをかわりにダメージにして1枚ドローする（出典: grnrngr/faq-rider-2 RK-086）", () => {
    const { s: s0, a1 } = struckWithTwoAkanetaka();
    const use = usesAkanetaka(s0, a1);
    expect(use).toBeDefined();
    const s = act(s0, use!);
    expect(zoneIds(s, "player2", "power")).toContain(a1);
    expect(s.players.player2.power.find((c) => c.instanceId === a1)?.faceDown).toBe(true);
  });

  // rider_2.html:「続けて2枚目の「RK-086 アカネタカ」を使用することはできますか？ いいえ、それはできません。」
  it("R-ERR-RK086: 公式Q&A — 1回のストライクに対して2枚目のアカネタカは使えない（出典: grnrngr/faq-rider-2 RK-086 Q1）", () => {
    const { s: s0, a1, a2 } = struckWithTwoAkanetaka();
    const use = usesAkanetaka(s0, a1);
    expect(use).toBeDefined();
    const s = act(s0, use!);
    expect(usesAkanetaka(s, a2)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-RK125 仮面ライダーブレイド", () => {
  // rider_2.html:「『自分の手札を3枚選び、相手に見せてもよい。そうしたとき、敵軍Sユニットを1体選びホールドする。…』」
  it("R-ERR-RK125: 修正後テキスト「自分の手札を3枚選び」（「まで」なし）を持つ（出典: grnrngr/faq-rider-2 RK-125）", () => {
    expectCorrectedText(
      "RK-125",
      "【ブレイラウザー】自分の手札を3枚選び、相手に見せてもよい。そうしたとき、敵軍Sユニットを1体選びホールドする。その後、見せたカードの持つカテゴリがすべて同じなら、敵軍バトルエリアからSユニットを1体選び撃破する。",
    );
    expect(norm(engineText("RK-125"))).not.toContain(norm("3枚まで"));
  });

  /** ブレイド（RC）をビークルにライドさせてバトルエリアに出し、ライドオフする。 */
  function bladeRideOff(handCount: number) {
    const v = inst("VEH", "v");
    const blade = { ...inst("RK-125", "blade"), mountedOnInstanceId: v.instanceId };
    const enemyS = inst("TST-UNIT-0", "enemy-s");
    let s = specState(["RK-125"], {
      phase: "battle",
      player1: {
        rush: [blade, v],
        hand: Array.from({ length: handCount }, (_, i) => inst("TST-OP", `h${i}`)),
      },
      player2: { battle: [enemyS], deck: [inst("TST-OP", "k")] },
    });
    s.definitions["VEH"] = {
      id: "VEH",
      name: "VEH",
      type: "vehicle",
      category: "WB",
      rarity: "N",
      expansion: "test",
      powerCost: 0,
      bp: 2000,
      size: "S",
    } as never;
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: blade.instanceId });
    return { s, enemyS: enemyS.instanceId };
  }

  // rider_2.html Q1:「手札にカードが3枚以上無い場合にライドオフする事は可能でしょうか。 はい、可能です。」
  it("R-ERR-RK125: 公式Q&A — 手札が3枚未満でもライドオフできる（出典: grnrngr/faq-rider-2 RK-125 Q1）", () => {
    const { s } = bladeRideOff(2);
    expect(
      legalOfType(s, "resolve_ride_off_choice").some((a) => a.rideOff === true),
    ).toBe(true);
  });

  // rider_2.html Q2:「自分の手札を選ぶときは、必ず3枚選ぶようにしてください」
  it("R-ERR-RK125: 公式Q&A — 手札が2枚では3枚選べないので、敵軍Sユニットはホールドされない（出典: grnrngr/faq-rider-2 RK-125 Q2）", () => {
    let { s, enemyS } = bladeRideOff(2);
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true });
    expect(
      legalOfType(s, "resolve_effect_choice").some((a) => a.instanceId === enemyS),
    ).toBe(false);
    expect(zoneIds(s, "player2", "battle")).toContain(enemyS);
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-RK166 仮面ライダーG3 のカテゴリ", () => {
  // rider_2.html:「「RK－166 仮面ライダーG3」のカテゴリは、カード左下に記載してある「アーステクノロジー」として使用して頂く」
  it("R-ERR-RK166: カテゴリはアーステクノロジー（ET）のみ（出典: grnrngr/faq-rider-2 RK-166、faq/index お詫びと訂正）", () => {
    const def = cardDef("RK-166");
    expect(def).toBeDefined();
    expect(cardCategories(def!)).toEqual(["ET"]);
  });

  // rider_2.html Q2:「両方のカテゴリを持つユニットと考えてよろしいでしょうか？ いいえ。」
  it("R-ERR-RK166: 公式Q&A — ミスティックアームズ（MA）のコマンドではラッシュできず、ETのコマンドならラッシュできる（出典: grnrngr/faq-rider-2 RK-166 Q2）", () => {
    const rushable = (cmd: string) => {
      const g = inst("RK-166", "g");
      const s = specState(["RK-166"], {
        phase: "rush",
        player1: { hand: [g], command: [released(cmd, "c")], power: powerCards(3) },
      });
      return legal(s).some(
        (a) =>
          (a.type === "rush" && a.instanceId === g.instanceId) ||
          (a.type === "initiate_command_payment" && a.sourceInstanceId === g.instanceId),
      );
    };
    expect(rushable("TST-OP-MA")).toBe(false);
    expect(rushable("TST-OP-ET")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("R-ERR-RK168 仮面ライダー電王CF", () => {
  it("R-ERR-RK168: 【てんこもりだぜ！】の文面は印刷どおり（解釈の指定のみ）（出典: grnrngr/faq-rider-2 RK-168）", () => {
    expectCorrectedText(
      "RK-168",
      "【てんこもりだぜ！】自軍ターン中、これがバトルエリアに出たとき、パワーゾーンでオモテ向きになっている「モモタロス」「ウラタロス」「キンタロス」「リュウタロス」のカードを捨札にしたときに発動する効果は、捨札にせずに発動できる。",
    );
  });

  /** パワーゾーンにキンタロスを n 枚置いて電王CFをバトルエリアに出し、選択はすべて受ける。 */
  function cfEntered(kintarosCount: number) {
    const cf = inst("RK-168", "cf");
    const kins = Array.from({ length: kintarosCount }, (_, i) => inst("RK-144", `kin${i}`));
    let s = specState(["RK-168", "RK-144"], {
      phase: "battle",
      player1: { rush: [cf], power: kins },
      player2: { battle: [inst("TST-UNIT-0", "enemy")] },
    });
    s = act(s, { type: "move_to_battle", playerId: "player1", instanceId: cf.instanceId });
    for (let i = 0; i < 8; i += 1) {
      const next = legal(s).find(
        (a) => a.type === "confirm_effect_choice" || a.type === "resolve_effect_choice",
      );
      if (!next) break;
      s = act(s, next);
    }
    const unit = s.players.player1.battle.find((c) => c.instanceId === cf.instanceId)!;
    return { s, bp: effectiveBp(s, "player1", unit), kins: kins.map((k) => k.instanceId) };
  }

  // rider_2.html:「「キンタロス」…のカードの捨札にしたときに発動する効果を、1枚につき1度ずつ、捨札にせずに発動できる」
  it("R-ERR-RK168: キンタロス1枚の効果を捨札にせず1度発動し、BP+3000（5000→8000）（出典: grnrngr/faq-rider-2 RK-168）", () => {
    const { s, bp, kins } = cfEntered(1);
    expect(bp).toBe(8000);
    expect(zoneIds(s, "player1", "power")).toEqual(kins);
  });

  // rider_2.html Q1:「複数重複して同時に発動することができますので、その場合はBP＋6000されることになります」
  it("R-ERR-RK168: 公式Q&A — キンタロス2枚なら2枚分発動してBP+6000（出典: grnrngr/faq-rider-2 RK-168 Q1）", () => {
    const { bp } = cfEntered(2);
    expect(bp).toBe(11000);
  });

  // rider_2.html Q2:「…BPが無制限に上昇するということですか？ いいえ、違います。」
  it("R-ERR-RK168: 公式Q&A — キンタロス1枚からは1度だけ（BP+3000で止まり無制限には上がらない）（出典: grnrngr/faq-rider-2 RK-168 Q2）", () => {
    const { bp } = cfEntered(1);
    expect(bp).toBe(8000);
  });
});
