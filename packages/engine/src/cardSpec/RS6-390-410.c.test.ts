/**
 * カード別スペック: RS-404〜RS-410（第6弾「紅き六戦士の帰還」マーフィーK9〜冥府神ドレイク）
 *
 * 出典（優先順、docs/rules/README.md §1.2）:
 *  1. docs/rules/08-errata.md（該当なし）、grnrngr/faq-card-6
 *     （docs/rules/sources/web/www.grnrngr.com/documents/rangersstrike/faq/card_6.html: RS-404 Q1〜Q3、RS-407 Q1〜Q3、
 *      RS-408 Q1/Q2、RS-409 Q1）、grnrngr/faq-rider_1 RK-051（RS-408 の相互参照）
 *  2. atwiki カードページ（docs/wiki/sources/atwiki/page-N-RS-NNN.md。ライブ写し pages/N.txt は該当ページなし）
 *     atwiki 転載 Q&A（RS-405 Q1）
 *  3. docs/rules/*.md の一般ルール（R-KW-RIDE-04/05・R-KW-RC-01 ライド、R-ADD 追加条件 ほか）
 * 期待値は出典に従う。エンジンが誤っている箇所は it.fails（「既知の不具合: CARD-RS-NNN …」）で残す。
 */
import { describe, expect, it } from "vitest";
import {
  act,
  attack,
  attackTargets,
  bpOf,
  canSkip,
  canStartRush,
  canStrike,
  choiceIds,
  deckCards,
  DEFS,
  enter,
  expectCatalogText,
  expectStats,
  fillers,
  inst,
  legal,
  nextPhase,
  pick,
  playOp,
  powerCards,
  released,
  releasedCat,
  resolveAll,
  rushFromHand,
  rushVia,
  settle,
  skip,
  spOf,
  st,
  sUnit,
  zoneOf,
} from "./RS6-390-410.helpers";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState } from "../types/game";

type P = Partial<GameState["players"]["player1"]>;

const POLICE = sUnit("SPEC-POL", { name: "警察ユニット", features: ["警察"], category: "OT", comboNumber: 3, bp: 3000 });
const POLICE_M = sUnit("SPEC-POLM", { name: "警察Mユニット", features: ["警察"], category: "OT", size: "M", bp: 3000 });
const PLAIN = sUnit("SPEC-PLAIN", { name: "一般ユニット", category: "OT", comboNumber: 3, bp: 3000 });
const STRONG_SP1 = sUnit("SPEC-SP1-9000", { name: "SP1 BP9000", bp: 9000, sp: 1 });
const WB_M_SP1 = sUnit("SPEC-WBM", { name: "WB M SP1", size: "M", sp: 1 });
const SPECS: CardDefinition[] = [POLICE, POLICE_M, PLAIN, STRONG_SP1, WB_M_SP1];

function enterAt(id: string, pos: number, p1: P = {}, p2: P = {}) {
  const s = st(
    { player1: { battle: fillers(pos - 1), rush: [inst(id, "x")], deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } },
    SPECS,
  );
  return enter(s, `${id}:x`);
}

// ===========================================================================
describe("RS-404 マーフィーK9", () => {
  const TEXT =
    "【追跡】これをラッシュしたとき、次の効果を発動できる⇒特徴「メカ」を持たないSユニットを1体選ぶ。そして選んだユニットと同じカード名のユニットカードを自軍山札から1枚選び、相手に見せてから自分の手札に加えてもよい。その後、山札をシャッフルする。";

  it("RS-404: カタログ本文・スペックが出典と一致（出典: atwiki/page-561）", () => {
    expectCatalogText("RS-404", TEXT);
    expectStats("RS-404", {
      name: "マーフィーK9",
      category: "OT",
      size: "S",
      bp: 500,
      sp: undefined,
      powerCost: 1,
      features: ["メカ"],
    });
  });

  const rushMurphy = (p1: P = {}, p2: P = {}) => {
    const s = st(
      {
        phase: "rush",
        player1: { hand: [inst("RS-404", "m")], command: releasedCat("OT", 1), power: powerCards(1), deck: [inst("RS-405", "d5"), inst("TST-UNIT-0", "dx")], ...p1 },
        player2: { deck: deckCards(3, "e"), ...p2 },
      },
      SPECS,
    );
    const r = rushFromHand(s, "player1", "RS-404:m");
    expect(r.ok).toBe(true);
    return r.state;
  };

  it("RS-404: 【追跡】ラッシュしたとき、特徴「メカ」を持たない S ユニットを選べる（メカ・M ユニットは不可）（出典: atwiki/page-561「特徴「メカ」を持たないSユニットを1体選ぶ」）", () => {
    const s = rushMurphy({ rush: [inst("RS-405", "own"), inst("RS-404", "mecha"), inst("SPEC-POLM", "m")] });
    expect(s.pendingEffectChoice?.sourceCardId).toBe("RS-404");
    expect(choiceIds(s)).toEqual(["RS-405:own"]);
  });

  it("RS-404: 選んだユニットと同じカード名のユニットカードを自軍山札から手札に加えられる（出典: atwiki/page-561「同じカード名のユニットカードを自軍山札から1枚選び…手札に加えてもよい」）", () => {
    let s = rushMurphy({ rush: [inst("RS-405", "own")] });
    s = pick(s, "RS-405:own");
    expect(choiceIds(s)).toEqual(["RS-405:d5"]);
    s = pick(s, "RS-405:d5");
    expect(zoneOf(s, "player1", "RS-405:d5")).toBe("hand");
    expect(zoneOf(s, "player1", "TST-UNIT-0:dx")).toBe("deck");
  });

  it("RS-404: 「次の効果を発動できる」— 発動しないことを選べる（出典: atwiki/page-561「発動できる」）", () => {
    let s = rushMurphy({ rush: [inst("RS-405", "own")] });
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(s.pendingEffectChoice).toBeUndefined();
    expect(s.players.player1.hand).toHaveLength(0);
  });

  it("RS-404: 「手札に加えてもよい」— 山札のカードを選んだあとでも加えないことを選べる（出典: atwiki/page-561「加えてもよい」）", () => {
    let s = rushMurphy({ rush: [inst("RS-405", "own")] });
    s = pick(s, "RS-405:own");
    expect(canSkip(s)).toBe(true);
    s = skip(s);
    expect(zoneOf(s, "player1", "RS-405:d5")).toBe("deck");
  });

  it("RS-404: ラッシュしていない（効果以外で場にある）ときは発動しない（出典: atwiki/page-561「これをラッシュしたとき」）", () => {
    const s = enterAt("RS-404", 1, { rush: [inst("RS-404", "x"), inst("RS-405", "own")] });
    expect(s.pendingEffectChoice).toBeUndefined();
  });

  it.todo("RS-404: 「相手に見せてから」「その後、山札をシャッフルする」— 公開・シャッフルの順序は公開状態に現れないため保留（出典: atwiki/page-561）");

  // grnrngr/faq-card-6 RS-404 Q1:「はい、できます。」
  it("RS-404: 公式Q&A — 【追跡】で敵軍ユニットを選べる（出典: grnrngr/faq-card-6 RS-404 Q1）", () => {
    const s = rushMurphy({}, { battle: [inst("RS-405", "enemy")] });
    expect(choiceIds(s)).toEqual(["RS-405:enemy"]);
  });

  // grnrngr/faq-card-6 RS-404 Q2:「はい、できます。」
  it("RS-404: 公式Q&A — メカを持たない「ヘドリアン女王」（RS-360）を選び、メカを持つ「ヘドリアン女王（2nd）」（SR-004）を山札から加えられる（出典: grnrngr/faq-card-6 RS-404 Q2）", () => {
    let s = rushMurphy({ deck: [inst("SR-004", "q2"), inst("TST-UNIT-0", "dx")] }, { battle: [inst("RS-360", "q")] });
    s = pick(s, "RS-360:q");
    expect(choiceIds(s)).toEqual(["SR-004:q2"]);
    s = pick(s, "SR-004:q2");
    expect(zoneOf(s, "player1", "SR-004:q2")).toBe("hand");
  });

  // grnrngr/faq-card-6 RS-404 Q3:「…コマンドゾーンやパワーゾーンに置かれているものはあくまでも「ユニットカード」であり…選ぶことはできません。」
  it("RS-404: 公式Q&A — バトル・ラッシュエリアのユニットは自軍敵軍とも選べるが、コマンドゾーン・パワーゾーンのユニットカードは選べない（出典: grnrngr/faq-card-6 RS-404 Q3）", () => {
    const s = rushMurphy(
      { rush: [inst("RS-405", "own")], command: [...releasedCat("OT", 1), released("RS-391", "cmd")], power: [inst("RS-390", "pw")] },
      { battle: [inst("RS-402", "eb")], command: [released("RS-403", "ecmd")], power: [inst("RS-392", "epw")] },
    );
    expect(choiceIds(s)).toEqual(["RS-402:eb", "RS-405:own"]);
  });
});

// ===========================================================================
describe("RS-405 デカブレイク", () => {
  const TEXT =
    "※これはBP1000以下のユニットにアタックできない。【光速拳ライトニングフィスト】相手に1点ダメージを与える。(この効果はライドオフしたとき、ナンバーに関係なく発動する)";

  it("RS-405: カタログ本文・スペックが出典と一致（出典: atwiki/page-562）", () => {
    expectCatalogText("RS-405", TEXT);
    expectStats("RS-405", {
      name: "デカブレイク",
      category: "OT",
      size: "S",
      bp: 4000,
      sp: undefined,
      powerCost: 4,
      comboNumber: 6,
      features: ["男", "警察", "特キョウ"],
    });
  });

  it("RS-405: ※ BP1000以下のユニット（BP1000・BP500）にはアタックできず、BP3000 にはアタックできる（出典: atwiki/page-562「BP1000以下のユニットにアタックできない」）", () => {
    const s = st(
      {
        player1: { battle: [inst("RS-405", "x")], deck: deckCards(3) },
        player2: { battle: [inst("TST-UNIT-0", "k"), inst("RS-404", "half"), inst("SPEC-PLAIN", "big")], deck: deckCards(3, "e") },
      },
      SPECS,
    );
    expect(attackTargets(s, "RS-405:x")).toEqual(["SPEC-PLAIN:big"]);
  });

  it("RS-405: 【光速拳ライトニングフィスト】6番目に出て NC が成立すると相手に1点ダメージを与える（出典: atwiki/page-562「CN：6」「相手に1点ダメージを与える」）", () => {
    const s = resolveAll(enterAt("RS-405", 6));
    expect(s.players.player2.damage).toBe(1);
    expect(s.players.player1.damage).toBe(0);
  });

  it("RS-405: NC が成立していない（5番目）ときはダメージを与えない（出典: atwiki/page-562・R-CN-02）", () => {
    const s = resolveAll(enterAt("RS-405", 5));
    expect(s.players.player2.damage).toBe(0);
  });

  const viaBoxer = (rideOff: boolean) => {
    let s = st({ player1: { rush: [inst("RS-406", "v"), inst("RS-405", "x")], deck: deckCards(5) }, player2: { deck: deckCards(5, "e") } }, SPECS);
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "RS-405:x", vehicleInstanceId: "RS-406:v" });
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff });
    return resolveAll(s);
  };

  it("RS-405: （この効果はライドオフしたとき、ナンバーに関係なく発動する）— マシンボクサーからライドオフ（2番目）すると相手に1点ダメージ（出典: atwiki/page-562「ライドオフしたとき、ナンバーに関係なく発動する」・評価欄「マシンボクサー…があればナンバーに関係なく」）", () => {
    expect(viaBoxer(true).players.player2.damage).toBe(1);
  });

  it("RS-405: ライドオフしなければ（ライドしたまま）ダメージを与えない（出典: atwiki/page-562「ライドオフしたとき」）", () => {
    expect(viaBoxer(false).players.player2.damage).toBe(0);
  });

  // atwiki 転載 Q1（XG-078 コピーベント）「…「この効果は、ライドオフしたときナンバーに関係なく発動する」等のように特殊な発動条件が書かれたテキストをコピーした場合、そのテキストに従いライドオフすることで効果を発動することができます。」
  // JC ユニットは仮面ライダーW・CC（XG4-088、ナンバー L・特徴「仮面ライダー」）、ライドはマシンゼクトロン（RK-058「仮面ライダー」は RC なしでライド可）。
  // 既知の不具合: CARD-RS-405 コピーベント（XG1-078）は効果が未実装で、使うとユニットを選ばずに解決するため、W・CC の効果は【光速拳ライトニングフィスト】にならず、ライドオフしてもダメージを与えない。
  it.fails(
    "RS-405: Q&A — コピーベント（XG-078）で【光速拳ライトニングフィスト】をコピーした JC ユニットは、ライドオフすることで発動できる（出典: atwiki/page-562 Q1）",
    () => {
      let s = st({
        phase: "rush",
        player1: {
          hand: [inst("XG1-078", "cv")],
          rush: [inst("XG4-088", "w"), inst("RS-405", "x"), inst("RK-058", "v")],
          command: releasedCat("WB", 2),
          power: powerCards(5),
          deck: deckCards(5),
        },
        player2: { deck: deckCards(5, "e") },
      });
      const r = playOp(s, "player1", "XG1-078:cv");
      expect(r.ok).toBe(true);
      s = r.state;
      // 1体目に JC ユニット（W・CC）、2体目にデカブレイクを選ぶ（どちらもナンバーを持つ）。
      expect(choiceIds(s)).toContain("XG4-088:w");
      s = pick(s, "XG4-088:w");
      expect(choiceIds(s)).toContain("RS-405:x");
      s = resolveAll(pick(s, "RS-405:x"));
      s = nextPhase(s);
      expect(s.phase).toBe("battle");
      s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "XG4-088:w", vehicleInstanceId: "RK-058:v" });
      s = resolveAll(act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true }));
      expect(s.players.player2.damage).toBe(1);
    },
  );
});

// ===========================================================================
describe("RS-406 マシンボクサー", () => {
  const TEXT = "※これにライドしているユニットはBP+500される。※特徴「警察」を持つ自軍Sユニットは、ＲＣを持っていなくてもこのビークルにライドできる。";

  it("RS-406: カタログ本文・スペックが出典と一致（S ビークル・OT・必要パワー2・メカ／車両）（出典: atwiki/page-563）", () => {
    expectCatalogText("RS-406", TEXT);
    const d = DEFS["RS-406"]!;
    expect(d.name).toBe("マシンボクサー");
    expect(d.type).toBe("vehicle");
    expect(d.category).toBe("OT");
    expect(d.size).toBe("S");
    expect(d.powerCost).toBe(2);
    expect(d.features).toEqual(["メカ", "車両"]);
  });

  const canMount = (s: GameState, rider: string) =>
    legal(s).some((a) => a.type === "mount_ride" && a.riderInstanceId === rider && a.vehicleInstanceId === "RS-406:v");
  const base = (rider: string) =>
    st({ player1: { rush: [inst("RS-406", "v"), inst(rider, "r")], deck: deckCards(5) }, player2: { deck: deckCards(5, "e") } }, SPECS);

  it("RS-406: ※ 特徴「警察」を持つ自軍 S ユニットは RC がなくてもライドできる（出典: atwiki/page-563）", () => {
    expect(canMount(base("SPEC-POL"), "SPEC-POL:r")).toBe(true);
  });

  it("RS-406: ※ 警察を持たず RC もない S ユニットはライドできない（出典: atwiki/page-563・R-KW-RIDE-02）", () => {
    expect(canMount(base("SPEC-PLAIN"), "SPEC-PLAIN:r")).toBe(false);
  });

  it("RS-406: ※ 警察を持っていても M ユニットはライドできない（出典: atwiki/page-563「特徴「警察」を持つ自軍Sユニット」）", () => {
    expect(canMount(base("SPEC-POLM"), "SPEC-POLM:r")).toBe(false);
  });

  it("RS-406: ※ ライドしているユニットは BP+500 される（警察 BP3000 → 3500）（出典: atwiki/page-563「BP+500される」）", () => {
    let s = base("SPEC-POL");
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "SPEC-POL:r", vehicleInstanceId: "RS-406:v" });
    expect(bpOf(s, "player1", "SPEC-POL:r")).toBe(3500);
  });

  it("RS-406: ライドオフしたユニットはライドしていないので BP+500 されない（出典: atwiki/page-563「これにライドしているユニット」・R-KW-RIDE-04/05）", () => {
    let s = base("SPEC-POL");
    s = act(s, { type: "mount_ride", playerId: "player1", riderInstanceId: "SPEC-POL:r", vehicleInstanceId: "RS-406:v" });
    s = act(s, { type: "resolve_ride_off_choice", playerId: "player1", rideOff: true });
    expect(bpOf(s, "player1", "SPEC-POL:r")).toBe(3000);
  });
});

// ===========================================================================
describe("RS-407 天空大聖者マジエル", () => {
  const TEXT =
    "※これはバトルエリアに出られない。【ハロー・ミラージュ】これが自軍ラッシュエリアにある間、すべてのSユニットは、そのカテゴリごとに次の制限を受ける⇒バトルエリアでの並び順が、WBなら2番目、MAなら3番目、OTなら4番目、ETなら5番目、DAなら1番目でなければストライクできない。";

  it("RS-407: カタログ本文・スペックが出典と一致（出典: atwiki/page-570）", () => {
    expectCatalogText("RS-407", TEXT);
    expectStats("RS-407", {
      name: "天空大聖者マジエル",
      category: "MA",
      size: "L",
      bp: 6000,
      sp: undefined,
      powerCost: 2,
      features: ["女", "人型", "魔法", "天空聖者"],
    });
  });

  it("RS-407: ※ バトルエリアに出られない（出典: atwiki/page-570「これはバトルエリアに出られない」）", () => {
    const s = st({ player1: { rush: [inst("RS-407", "m")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === "RS-407:m")).toBe(false);
  });

  /** カテゴリ cat・SP1 の S ユニットを pos 番目に置いた player1 のバトルフェイズ（マジエルの位置は where）。 */
  const strikeAt = (cat: string, pos: number, where: "rush" | "power" | "enemy" = "rush") => {
    const U = sUnit(`SPEC-${cat}-SP1`, { category: cat as CardDefinition["category"] });
    const m = inst("RS-407", "m");
    const s = st(
      {
        player1: {
          battle: [...fillers(pos - 1), inst(U.id, "u")],
          rush: where === "rush" ? [m] : [],
          power: where === "power" ? [m] : [],
          deck: deckCards(3),
        },
        player2: { rush: where === "enemy" ? [m] : [], deck: deckCards(3, "e") },
      },
      [U],
    );
    return canStrike(s, `${U.id}:u`);
  };

  const table: [string, number][] = [["WB", 2], ["MA", 3], ["OT", 4], ["ET", 5], ["DA", 1]];
  for (const [cat, okPos] of table) {
    it(`RS-407: 【ハロー・ミラージュ】${cat} の S ユニットは${okPos}番目ならストライクでき、それ以外（${okPos === 1 ? 2 : 1}番目）ではストライクできない（出典: atwiki/page-570「${cat}なら${okPos}番目…でなければストライクできない」）`, () => {
      expect(strikeAt(cat, okPos)).toBe(true);
      expect(strikeAt(cat, okPos === 1 ? 2 : 1)).toBe(false);
    });
  }

  it("RS-407: 「すべてのSユニット」— 敵軍ラッシュエリアのマジエルでも自分の S ユニットは制限を受ける（WB 1番目はストライクできない）（出典: atwiki/page-570「すべてのSユニット」）", () => {
    expect(strikeAt("WB", 1, "enemy")).toBe(false);
  });

  it("RS-407: マジエルがラッシュエリアにない（パワーゾーンにある）ときは制限を受けない（出典: atwiki/page-570「これが自軍ラッシュエリアにある間」）", () => {
    expect(strikeAt("WB", 1, "power")).toBe(true);
  });

  it("RS-407: S ユニット以外（WB の M ユニット）は制限を受けない（出典: atwiki/page-570「すべてのSユニット」）", () => {
    const s = st(
      { player1: { battle: [inst("SPEC-WBM", "u")], rush: [inst("RS-407", "m")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } },
      SPECS,
    );
    expect(canStrike(s, "SPEC-WBM:u")).toBe(true);
  });

  // grnrngr/faq-card-6 RS-407 Q1:「その「アカレンジャー」はストライクすることができません。…並び順が１番目であっても５番目であっても…」
  it("RS-407: 公式Q&A — 闇のヤイバ（RS-339）で DA が追加された「アカレンジャー」（ET・男）は5番目で「SP1」になってもストライクできない（出典: grnrngr/faq-card-6 RS-407 Q1）", () => {
    let s = st({
      player1: { battle: fillers(4), rush: [inst("RS-407", "m"), inst("RS-339", "y"), inst("RS-126", "aka")], deck: deckCards(3) },
      player2: { deck: deckCards(3, "e") },
    });
    s = resolveAll(enter(s, "RS-126:aka"));
    expect(spOf(s, "player1", "RS-126:aka")).toBeGreaterThanOrEqual(1);
    expect(canStrike(s, "RS-126:aka")).toBe(false);
  });

  // grnrngr/faq-card-6 RS-407 Q2:「…ナンバー２でＳＰ１になるユニットは、そのナンバーが３になることで、ストライクできなくなります。」
  it("RS-407: 公式Q&A — マジエルとコロン（RS-140）があるとき、ナンバー2の WB ユニット（ガオレッド（2nd））は2番目でも3番目でもストライクできない（制限はテキスト通り）（出典: grnrngr/faq-card-6 RS-407 Q2）", () => {
    const mk = (pos: number) => {
      const s = st({
        activePlayer: "player2",
        player1: { rush: [inst("RS-407", "m"), inst("RS-140", "c")], deck: deckCards(3) },
        player2: { battle: fillers(pos - 1, "ef"), rush: [inst("RS-402", "g")], deck: deckCards(3, "e") },
      });
      return resolveAll(enter(s, "RS-402:g", "player2"));
    };
    expect(canStrike(mk(2), "RS-402:g", "player2")).toBe(false);
    expect(canStrike(mk(3), "RS-402:g", "player2")).toBe(false);
  });

  // grnrngr/faq-card-6 RS-407 Q3:「いいえ、どちらのカテゴリの並び順でもストライクできません。」
  it("RS-407: 公式Q&A — 複数カテゴリ（WB・ET）の S ユニットは2番目でも5番目でもストライクできない（出典: grnrngr/faq-card-6 RS-407 Q3）", () => {
    const mk = (pos: number) =>
      st({ player1: { battle: [...fillers(pos - 1), inst("TST-UNIT-WB-ET", "u")], rush: [inst("RS-407", "m")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    expect(canStrike(mk(2), "TST-UNIT-WB-ET:u")).toBe(false);
    expect(canStrike(mk(5), "TST-UNIT-WB-ET:u")).toBe(false);
  });
});

// ===========================================================================
describe("RS-408 天空聖者サンジェル", () => {
  const TEXT =
    "【プロミネンス・シャワー】これが自軍バトルエリアにある間、敵軍ユニットが「これは敵軍ターン中、「SP1」以上のユニットとバトルしたときバトルに勝っても撃破される」の効果で撃破されたとき、その持ち主は1点ダメージを受ける。";

  it("RS-408: カタログ本文・スペックが出典と一致（出典: atwiki/page-573）", () => {
    expectCatalogText("RS-408", TEXT);
    expectStats("RS-408", {
      name: "天空聖者サンジェル",
      category: "MA",
      size: "S",
      bp: 3000,
      sp: undefined,
      powerCost: 3,
      features: ["男", "魔法", "天空聖者"],
    });
  });

  /** 自軍ターン、自軍 SP1 BP1000 が敵軍ドレイク（RS-410「バトルに勝っても撃破される」）にアタックして負ける。 */
  const loseToDrake = (sangels: number, zone: "battle" | "rush" = "battle") => {
    const ss = Array.from({ length: sangels }, (_, i) => inst("RS-408", `s${i}`));
    let s = st({
      player1: { battle: [...(zone === "battle" ? ss : []), inst("TST-UNIT-0", "a")], rush: zone === "rush" ? ss : [], deck: deckCards(3) },
      player2: { battle: [inst("RS-410", "d")], deck: deckCards(3, "e") },
    });
    s = resolveAll(settle(attack(s, "TST-UNIT-0:a", "RS-410:d")));
    return s;
  };

  it("RS-408: （前提）敵軍ターン中の「バトルに勝っても撃破される」でドレイクは撃破される（出典: atwiki/page-607 ※）", () => {
    expect(zoneOf(loseToDrake(1), "player2", "RS-410:d")).toBe("discard");
  });

  it("RS-408: 【プロミネンス・シャワー】自軍バトルエリアにある間、敵軍ユニットが「バトルに勝っても撃破される」で撃破されると、その持ち主は1点ダメージを受ける（出典: atwiki/page-573「その持ち主は1点ダメージを受ける」）", () => {
    const s = loseToDrake(1);
    expect(s.players.player2.damage).toBe(1);
    expect(s.players.player1.damage).toBe(0);
  });

  it("RS-408: サンジェルが自軍ラッシュエリアにある（バトルエリアにない）ときはダメージを受けない（出典: atwiki/page-573「これが自軍バトルエリアにある間」）", () => {
    expect(loseToDrake(1, "rush").players.player2.damage).toBe(0);
  });

  // grnrngr/faq-card-6 RS-408 Q1:「いいえ、その場合は発動しません。」
  it("RS-408: 公式Q&A — SP1 の自軍ユニットがバトルに勝って（通常の撃破で）敵軍ユニットを撃破したときは発動しない（出典: grnrngr/faq-card-6 RS-408 Q1）", () => {
    let s = st(
      {
        player1: { battle: [inst("RS-408", "s"), inst("SPEC-SP1-9000", "a")], deck: deckCards(3) },
        player2: { battle: [inst("RS-410", "d")], deck: deckCards(3, "e") },
      },
      SPECS,
    );
    s = resolveAll(settle(attack(s, "SPEC-SP1-9000:a", "RS-410:d")));
    expect(zoneOf(s, "player2", "RS-410:d")).toBe("discard");
    expect(s.players.player2.damage).toBe(0);
  });

  // grnrngr/faq-card-6 RS-408 Q2:「はい、その通りです。…結果としてその効果は重複することになります。」
  it("RS-408: 公式Q&A — サンジェルが3体あれば効果は重複し、相手は3点ダメージを受ける（出典: grnrngr/faq-card-6 RS-408 Q2）", () => {
    expect(loseToDrake(3).players.player2.damage).toBe(3);
  });

  // grnrngr/faq-rider_1 RK-051 Q2:「いいえ。…「RK-051 仮面ライダー鋭鬼」のテキストに書かれた「撃破」ですので…」
  it("RS-408: 公式Q&A — 仮面ライダー鋭鬼（RK-051）の【音撃打・必殺必中】で撃破したときはダメージを与えない（出典: grnrngr/faq-rider_1 RK-051 Q2）", () => {
    let s = st({
      player1: { battle: [inst("RS-408", "s")], rush: [inst("RK-051", "ek")], deck: deckCards(3) },
      player2: { battle: [inst("RS-410", "d")], deck: deckCards(3, "e") },
    });
    s = resolveAll(enter(s, "RK-051:ek"), ["RS-410:d"]);
    expect(zoneOf(s, "player2", "RS-410:d")).toBe("discard");
    expect(s.players.player2.damage).toBe(0);
  });

  // grnrngr/faq-rider_1 RK-051 Q1:「はい、可能です。」（敵軍バトルエリアの「サンジェル」を撃破できるか）
  it.todo(
    "RS-408: 公式Q&A — 鋭鬼の【音撃打・必殺必中】で敵軍バトルエリアの「サンジェル」を撃破できる — サンジェル自身は「バトルに勝っても撃破される」を持たず、Q の前提（音撃 RK-019 等で付与された状態）の再現が RK-051 側の範囲のため保留（出典: grnrngr/faq-rider_1 RK-051 Q1）",
  );
});

// ===========================================================================
describe("RS-409 冥府神スレイプニル", () => {
  const TEXT = "【フレンジー・スピア・クラッシュ】これは自軍と敵軍の常駐置き場にあるカード1枚につきBP＋1000され、BP6000以上のとき「SP1」になる。";

  it("RS-409: カタログ本文・スペックが出典と一致（出典: atwiki/page-598）", () => {
    expectCatalogText("RS-409", TEXT);
    expectStats("RS-409", {
      name: "冥府神スレイプニル",
      category: "DA",
      size: "L",
      bp: 4000,
      sp: "special",
      powerCost: "3+",
      features: ["冥府神", "二極神", "男", "人型"],
      rushCondition: "discard_command_card",
    });
  });

  const withPerm = (own: number, foe: number) =>
    st({
      player1: { battle: [inst("RS-409", "s")], operation: Array.from({ length: own }, (_, i) => inst("TST-OP", `o${i}`)), deck: deckCards(3) },
      player2: { operation: Array.from({ length: foe }, (_, i) => inst("TST-OP", `e${i}`)), deck: deckCards(3, "e") },
    });

  it("RS-409: 常駐置き場にカードがなければ BP4000 で SP！のまま（出典: atwiki/page-598）", () => {
    const s = withPerm(0, 0);
    expect(bpOf(s, "player1", "RS-409:s")).toBe(4000);
    expect(spOf(s, "player1", "RS-409:s")).toBe(0);
  });

  it("RS-409: 【フレンジー・スピア・クラッシュ】自軍と敵軍の常駐置き場のカード1枚につき BP+1000（自軍1・敵軍1 → 6000）（出典: atwiki/page-598「自軍と敵軍の常駐置き場にあるカード1枚につきBP＋1000」）", () => {
    expect(bpOf(withPerm(1, 1), "player1", "RS-409:s")).toBe(6000);
  });

  it("RS-409: BP6000以上のとき「SP1」になる（出典: atwiki/page-598「BP6000以上のとき「SP1」になる」）", () => {
    const s = withPerm(1, 1);
    expect(spOf(s, "player1", "RS-409:s")).toBe(1);
    expect(canStrike(s, "RS-409:s")).toBe(true);
  });

  it("RS-409: 1枚だけ（BP5000）のときは BP+1000 されるが「SP1」にはならない（出典: atwiki/page-598「BP6000以上のとき」）", () => {
    const s = withPerm(0, 1);
    expect(bpOf(s, "player1", "RS-409:s")).toBe(5000);
    expect(spOf(s, "player1", "RS-409:s")).toBe(0);
  });

  it("RS-409: 追加条件 — 自軍コマンドを1つ捨札にしてラッシュできる（出典: atwiki/page-598「自軍コマンドを1つ捨札にする」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-409", "s")], command: [released("TST-OP-DA", "c"), released("TST-OP-DA", "c2")], power: powerCards(3), deck: deckCards(3) } });
    const r = rushVia(s, "player1", "RS-409:s", (a) => (a.zordMaterialInstanceIds as string[] | undefined)?.[0] === "TST-OP-DA:c2");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-409:s")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-OP-DA:c2")).toBe("discard");
  });

  it("RS-409: 必要パワー3+ — パワー2ではラッシュできない（出典: atwiki/page-598「必要パワー：3+」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-409", "s")], command: [released("TST-OP-DA", "c"), released("TST-OP-DA", "c2")], power: powerCards(2), deck: deckCards(3) } });
    expect(canStartRush(s, "player1", "RS-409:s")).toBe(false);
  });

  // grnrngr/faq-card-6 RS-409 Q1:「はい、できます。」
  it("RS-409: 公式Q&A — ラッシュするためにホールドしたコマンドを捨札にして追加条件を満たせる（コマンド1つだけでラッシュできる）（出典: grnrngr/faq-card-6 RS-409 Q1）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-409", "s")], command: [released("TST-OP-DA", "c")], power: powerCards(3), deck: deckCards(3) } });
    const r = rushVia(s, "player1", "RS-409:s");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-409:s")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-OP-DA:c")).toBe("discard");
  });
});

// ===========================================================================
describe("RS-410 冥府神ドレイク", () => {
  const TEXT =
    "※これは敵軍ターン中、SP1以上のユニットとバトルしたときバトルに勝っても撃破される。※これは毎ターン可能ならバトルエリアに出る。【竜闘気爆炸球】これは敵軍ユニットが1体もなければ「SP1」になる。";

  it("RS-410: カタログ本文・スペックが出典と一致（出典: atwiki/page-607）", () => {
    expectCatalogText("RS-410", TEXT);
    expectStats("RS-410", {
      name: "冥府神ドレイク",
      category: "DA",
      size: "L",
      bp: 7000,
      sp: "special",
      powerCost: "2+",
      features: ["冥府神", "二極神", "男", "ドラゴン"],
      rushCondition: "discard_command_card",
    });
  });

  it("RS-410: ※ 敵軍ターン中、SP1 のユニットとバトルするとバトルに勝っても撃破される（出典: atwiki/page-607）", () => {
    let s = st({
      activePlayer: "player2",
      player1: { battle: [inst("RS-410", "d")], deck: deckCards(3) },
      player2: { battle: [inst("TST-UNIT-0", "a")], deck: deckCards(3, "e") },
    });
    s = resolveAll(settle(attack(s, "TST-UNIT-0:a", "RS-410:d", "player2")));
    expect(zoneOf(s, "player1", "RS-410:d")).toBe("discard");
    expect(zoneOf(s, "player2", "TST-UNIT-0:a")).toBe("discard");
  });

  it("RS-410: ※ SP を持たない（SP－）ユニットとのバトルでは撃破されない（出典: atwiki/page-607「SP1以上のユニットと」）", () => {
    const NOSP = sUnit("SPEC-NOSP", { sp: undefined });
    let s = st(
      { activePlayer: "player2", player1: { battle: [inst("RS-410", "d")], deck: deckCards(3) }, player2: { battle: [inst("SPEC-NOSP", "a")], deck: deckCards(3, "e") } },
      [NOSP],
    );
    s = resolveAll(settle(attack(s, "SPEC-NOSP:a", "RS-410:d", "player2")));
    expect(zoneOf(s, "player1", "RS-410:d")).toBe("battle");
  });

  it("RS-410: ※ 自軍ターン中に SP1 のユニットとバトルして勝っても撃破されない（出典: atwiki/page-607「敵軍ターン中」）", () => {
    let s = st({ player1: { battle: [inst("RS-410", "d")], deck: deckCards(3) }, player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") } });
    s = resolveAll(settle(attack(s, "RS-410:d", "TST-UNIT-0:e")));
    expect(zoneOf(s, "player1", "RS-410:d")).toBe("battle");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
  });

  it("RS-410: ※ 毎ターン可能ならバトルエリアに出る — 出られるうちはバトルフェイズを終えられない（出典: atwiki/page-607「毎ターン可能ならバトルエリアに出る」）", () => {
    const s = st({ player1: { rush: [inst("RS-410", "d"), inst("TST-UNIT-0", "o")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } });
    expect(legal(s).some((a) => a.type === "end_phase")).toBe(false);
    expect(legal(s).some((a) => a.type === "move_to_battle" && a.instanceId === "RS-410:d")).toBe(true);
  });

  it("RS-410: 【竜闘気爆炸球】敵軍ユニットが1体もなければ「SP1」になる（出典: atwiki/page-607「敵軍ユニットが1体もなければ「SP1」になる」）", () => {
    const s = enter(st({ player1: { rush: [inst("RS-410", "d")], deck: deckCards(3) }, player2: { deck: deckCards(3, "e") } }), "RS-410:d");
    expect(spOf(s, "player1", "RS-410:d")).toBe(1);
    expect(canStrike(s, "RS-410:d")).toBe(true);
  });

  it("RS-410: 敵軍ラッシュエリアにユニットが1体でもいれば SP！のまま（出典: atwiki/page-607「1体もなければ」）", () => {
    const s = enter(
      st({ player1: { rush: [inst("RS-410", "d")], deck: deckCards(3) }, player2: { rush: [inst("TST-UNIT-0", "e")], deck: deckCards(3, "e") } }),
      "RS-410:d",
    );
    expect(spOf(s, "player1", "RS-410:d")).toBe(0);
    expect(canStrike(s, "RS-410:d")).toBe(false);
  });

  it("RS-410: 追加条件 — 自軍コマンドを1つ捨札にして、パワー2でラッシュできる（ホールドしたコマンドでも可: faq-card-6 RS-409 Q1「等」）（出典: atwiki/page-607・grnrngr/faq-card-6 RS-409 Q1）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-410", "d")], command: [released("TST-OP-DA", "c")], power: powerCards(2), deck: deckCards(3) } });
    const r = rushVia(s, "player1", "RS-410:d");
    expect(r.ok).toBe(true);
    expect(zoneOf(r.state, "player1", "RS-410:d")).toBe("rush");
    expect(zoneOf(r.state, "player1", "TST-OP-DA:c")).toBe("discard");
  });

  it("RS-410: 必要パワー2+ — パワー1ではラッシュできない（出典: atwiki/page-607「必要パワー：2+」）", () => {
    const s = st({ phase: "rush", player1: { hand: [inst("RS-410", "d")], command: [released("TST-OP-DA", "c")], power: powerCards(1), deck: deckCards(3) } });
    expect(canStartRush(s, "player1", "RS-410:d")).toBe(false);
  });
});
