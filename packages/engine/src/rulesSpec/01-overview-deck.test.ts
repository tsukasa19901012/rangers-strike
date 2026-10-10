/**
 * docs/rules/01-overview-deck.md（概要・デッキ構築・ゲーム準備・勝敗）のルール仕様テスト。
 * 期待値はルールブックと docs/rules/sources/web/ の公式・wiki 原文に従う（現行エンジンの挙動ではない）。
 */
import { describe, expect, it } from "vitest";
import {
  allCardsCatalog,
  BANNED_CARD_IDS,
  extendedCardsCatalog,
  fullPlayableCatalog,
  fusionMaterialAliasNames,
  isBannedCardId,
  validateDeckEntries,
  type CardCatalog,
  type CardDefinition,
  type DeckEntry,
} from "@rangers-strike/cards";
import { applyAction, createGame, getLegalActions } from "../index";
import type { GameState, PlayerId } from "../types/game";
import { counterWithCategoryHold } from "../testing/counterPayment";
import { createTestState, inst, releasedWbCommand } from "../testing/fixtures";
import {
  advanceUntil,
  deckOf,
  def,
  distinctNamedCards,
  faceDownPower,
  fillerEntries,
  opponentOf,
  unwrap,
} from "./01-helpers";

const baseDefs = () => createTestState().definitions;

function withDefs(...ids: string[]) {
  const defs = { ...baseDefs() };
  for (const id of ids) defs[id] = def(id);
  return defs;
}

function nameErrors(entries: DeckEntry[], catalog?: CardCatalog): string[] {
  return validateDeckEntries(entries, catalog).errors.filter((e) => e.includes("枚まで"));
}

function namesOf(entries: DeckEntry[], catalog: CardCatalog = allCardsCatalog): string[] {
  return entries.map((e) => catalog.cards.find((c) => c.id === e.cardId)!.name.replace(/（[^）]*）$/, ""));
}

function gameWith40(firstPlayer?: PlayerId, rng: () => number = () => 0.42): GameState {
  const cards = distinctNamedCards(40);
  return createGame({ player1Deck: cards, player2Deck: cards, firstPlayer, rng });
}

/** プレイヤー1 の1点ストライク（SP1 の TST-UNIT-0）で player2 に1点与える局面。 */
function strikeForOne(player2: Partial<GameState["players"]["player2"]>, player1Extra = {}) {
  const attacker = inst("TST-UNIT-0", "striker");
  const state = createTestState({
    phase: "battle",
    activePlayer: "player1",
    definitions: withDefs("RS-244", "RS-348"),
    player1: { battle: [attacker], ...player1Extra },
    player2: { deck: deckOf("p2d", 3), ...player2 },
  });
  return unwrap(
    applyAction(state, { type: "strike", playerId: "player1", instanceId: attacker.instanceId }),
  );
}

// ---------------------------------------------------------------------------
// 1. フォーマット
// ---------------------------------------------------------------------------

describe("R-FMT-01 対戦人数", () => {
  // 「レンジャーズストライクは二人で対戦するゲーム」
  it("R-FMT-01: 通常のゲームは2人対戦として作られる（出典: 公式ルール準備ページ）", () => {
    const state = gameWith40();
    expect(Object.keys(state.players).sort()).toEqual(["player1", "player2"]);
  });

  // 「４人でレンジャーズストライクをプレイするための特別ルール」
  it.todo("R-FMT-01: 4人戦はタッグストライク（R-FMT-04）— エンジンは2人戦のみで表現不能（出典: atwiki/page-750）");
});

describe("R-FMT-02 シリーズと使用可能カード", () => {
  // 「旧ナンバーのカードも続けてゲームに使用できる」
  it("R-FMT-02: 旧ナンバー（RS/RK）と XG のカードを混ぜた40枚デッキは構築可能（出典: atwiki/page-1535）", () => {
    const old = fillerEntries(21, [], fullPlayableCatalog, (c) => /^(RS|RK)-/.test(c.id));
    const xg = fillerEntries(
      19,
      namesOf(old, fullPlayableCatalog),
      fullPlayableCatalog,
      (c) => /^XG\d-/.test(c.id),
    );
    const result = validateDeckEntries([...old, ...xg], fullPlayableCatalog);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  // 「09年6月から始まる」（クロスギャザーへの統一）
  it.todo("R-FMT-02: シリーズ名「クロスギャザー」とキーワード「クロス」の区別 — デッキ構築・ゲーム処理に影響せず API で観測不能（出典: atwiki/page-1535）");
});

describe("R-FMT-03 スタックは存在しない", () => {
  // 「似たタイプで「カウンター」は存在します」
  it("R-FMT-03: カウンター（RS-027 ダイノガッツ）は相手の行動に対して割り込んで使える（出典: atwiki/page-604）", () => {
    const attacker = inst("TST-UNIT-2", "a1");
    const defender = inst("TST-UNIT-2", "d1");
    const counter = inst("RS-027", "dg");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: withDefs("RS-027"),
      player1: { battle: [attacker] },
      player2: {
        battle: [defender],
        hand: [counter],
        command: [releasedWbCommand("cmd")],
        deck: deckOf("d", 5),
        power: deckOf("p", 4),
      },
    });
    const afterBattle = unwrap(
      applyAction(state, {
        type: "battle",
        playerId: "player1",
        attackerInstanceId: attacker.instanceId,
        defenderInstanceId: defender.instanceId,
      }),
    );
    const counterOffer = getLegalActions(afterBattle).find(
      (a) => a.playerId === "player2" && "sourceInstanceId" in a && a.sourceInstanceId === counter.instanceId,
    );
    expect(counterOffer).toBeDefined();
  });

  // 「スタック概念は今のところ存在しません」
  it.todo("R-FMT-03: 効果を積み重ねて逆順解決する一般的なスタックが無いこと — 不在の性質は API 上の単一局面で観測できない（解決順は R-TIME 系で検証）（出典: atwiki/page-604）");
});

describe("R-FMT-04 タッグストライク（4人戦）", () => {
  // 「相手チームの各プレイヤーに５点のダメージを与えることができたチームが勝利」
  it.todo("R-FMT-04: 2対2・各プレイヤー5点で行動不能・チーム勝利 — エンジンは4人戦未実装（対象外）（出典: atwiki/page-750）");
  // 「禁止カードは命の泉、メディテーション、ドラゴンレンジャー」
  it.todo("R-FMT-04: タッグストライク限定禁止（RS-244/RS-289/RS-348）— タッグ用レギュレーションが API に無い（出典: atwiki/page-750, page-2079）");
  it.todo("R-FMT-04: [未確定] 常駐・パワー・コマンド・NC 共有の詳細、後発の同種効果カードの扱い");
});

describe("R-FMT-05 大会レギュレーション", () => {
  it.todo("R-FMT-05: 混合/ライダー単/合体ロボ/ハイランダー/特撮ヒーロー大会 — レギュレーション選択が API に無い（出典: atwiki/page-730, 731, 1690, 2252）");
  it.todo("R-FMT-05: [未確定] 各レギュレーションの公式文書は未取得");
});

// ---------------------------------------------------------------------------
// 2. デッキ構築
// ---------------------------------------------------------------------------

describe("R-DECK-01 デッキ枚数", () => {
  // 「40枚以上ならば何枚でもよくなった」
  it("R-DECK-01: 39枚のデッキは構築できない（出典: atwiki/page-71）", () => {
    const result = validateDeckEntries(fillerEntries(39));
    expect(result.ok).toBe(false);
  });

  // 「40枚以上ならば何枚でもよくなった」
  it("R-DECK-01: 40枚ちょうどのデッキは構築できる（出典: atwiki/page-71、公式準備ページ「40枚１組」）", () => {
    const result = validateDeckEntries(fillerEntries(40));
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  // 「デッキの40枚制限が無くなった」
  it("R-DECK-01: XG 以降は上限なし — 100枚のデッキも構築できる（出典: atwiki/page-71, page-604）", () => {
    const entries = fillerEntries(100);
    const result = validateDeckEntries(entries);
    expect(result.total).toBe(100);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  // 「40枚１組のカードのことをデッキと呼びます」
  it.todo("R-DECK-01: XG 以前のレギュレーションは40枚ちょうど — 旧弾レギュレーションの指定手段が API に無い（出典: 公式ルール準備ページ）");
  it.todo("R-DECK-01: [未確定] 上限撤廃の公式告知文は未取得");
});

describe("R-DECK-02 同名カードは3枚まで", () => {
  // 「同じカード名のカードは３枚まで入れることができます」
  it("R-DECK-02: 同じカード3枚は入れられる（出典: 公式ルール準備ページ）", () => {
    const entries = [{ cardId: "RS-054", count: 3 }, ...fillerEntries(37, ["アバレッド"])];
    expect(nameErrors(entries)).toEqual([]);
    expect(validateDeckEntries(entries).ok).toBe(true);
  });

  // 「同じカード名のカードは３枚まで入れることができます」
  it("R-DECK-02: 同じカード4枚は入れられない（出典: 公式ルール準備ページ）", () => {
    const entries = [{ cardId: "RS-054", count: 4 }, ...fillerEntries(36, ["アバレッド"])];
    expect(validateDeckEntries(entries).ok).toBe(false);
    expect(nameErrors(entries).length).toBeGreaterThan(0);
  });

  // 「テキストや種類の違いに関わらず…3枚まで」
  it("R-DECK-02: テキストの違う同名カード（RK-033/RK-063 仮面ライダー龍騎）は合算して3枚まで（出典: atwiki/page-1739）", () => {
    const ok = [
      { cardId: "RK-033", count: 2 },
      { cardId: "RK-063", count: 1 },
      ...fillerEntries(37, ["仮面ライダー龍騎"]),
    ];
    expect(validateDeckEntries(ok).ok).toBe(true);
    const ng = [
      { cardId: "RK-033", count: 2 },
      { cardId: "RK-063", count: 2 },
      ...fillerEntries(36, ["仮面ライダー龍騎"]),
    ];
    expect(validateDeckEntries(ng).ok).toBe(false);
  });

  // 「テキストや種類の違いに関わらず…3枚まで」
  it("R-DECK-02: 種類の違う同名カード（ユニット RS-114 とビークル RS-581 魔導馬バリキオン）も合算して3枚まで（出典: atwiki/page-1739, page-1646）", () => {
    const ng = [
      { cardId: "RS-114", count: 2 },
      { cardId: "RS-581", count: 2 },
      ...fillerEntries(36, ["魔導馬バリキオン"]),
    ];
    expect(validateDeckEntries(ng).ok).toBe(false);
  });

  // 「コマンダーカードは枚数には含まれない」
  it("R-DECK-02: コマンダーカードはデッキ枚数に数えない（39枚＋コマンダーは40枚にならない）（出典: atwiki/page-1739, page-1690）", () => {
    const entries = [...fillerEntries(39), { cardId: "XC-001", count: 1 }];
    expect(validateDeckEntries(entries, extendedCardsCatalog).ok).toBe(false);
  });
});

describe("R-DECK-03 3枚制限の例外はカード本文の注記で決まる", () => {
  // 「※このカードはデッキに好きな枚数入れてもよい。」
  it("R-DECK-03: 注記「好きな枚数」を持つ RK-303 ワームサナギ体（特徴 ワーム／怪人）は4枚以上入れられる（出典: atwiki/page-1278）", () => {
    const entries = [{ cardId: "RK-303", count: 10 }, ...fillerEntries(30, ["ワームサナギ体"])];
    expect(nameErrors(entries)).toEqual([]);
    expect(validateDeckEntries(entries).ok).toBe(true);
  });

  // 「※このカードはデッキに好きな枚数入れてもよい。」
  it("R-DECK-03: 注記「好きな枚数」を持つ戦闘員 RK-059 ゼクトルーパーは4枚以上入れられる（出典: atwiki/page-962）", () => {
    const entries = [{ cardId: "RK-059", count: 10 }, ...fillerEntries(30, ["ゼクトルーパー"])];
    expect(nameErrors(entries)).toEqual([]);
    expect(validateDeckEntries(entries).ok).toBe(true);
  });

  // 「※このカードはデッキに3枚以上入れてもよい。」
  it("R-DECK-03: RS-080 ヒドラー兵（3枚以上入れてもよい）は4枚以上入れられる（出典: atwiki/page-326）", () => {
    const entries = [{ cardId: "RS-080", count: 10 }, ...fillerEntries(30, ["ヒドラー兵"])];
    expect(nameErrors(entries)).toEqual([]);
    expect(validateDeckEntries(entries).ok).toBe(true);
  });

  // 「好きな枚数入れてもよい」
  // 既知の不具合: 01-D4（無制限カードが40枚で頭打ち）
  it.fails("R-DECK-03: 無制限カードは41枚以上でもよい（RS-080 ×41）（出典: atwiki/page-326, page-71）", () => {
    const entries = [{ cardId: "RS-080", count: 41 }];
    expect(validateDeckEntries(entries).errors).toEqual([]);
    expect(validateDeckEntries(entries).ok).toBe(true);
  });

  // 「戦闘員等無制限で入れることのできるカードもある」— 例外は注記で決まる
  it("R-DECK-03: 注記の無い特徴「戦闘員」のカードは3枚まで（出典: atwiki/page-1739, page-71）", () => {
    const grunt: CardDefinition = {
      id: "TST-GRUNT",
      name: "テスト戦闘員",
      type: "unit",
      category: "DA",
      rarity: "N",
      expansion: "test",
      powerCost: 0,
      bp: 500,
      sp: 1,
      size: "S",
      features: ["戦闘員"],
      text: "【テスト】効果なし",
    };
    const catalog: CardCatalog = { ...allCardsCatalog, cards: [...allCardsCatalog.cards, grunt] };
    const entries = [{ cardId: "TST-GRUNT", count: 4 }, ...fillerEntries(36)];
    expect(validateDeckEntries(entries, catalog).ok).toBe(false);
  });

  // 「好きな枚数入れてもよい」（RK-137 と RK-303 は同名「ワームサナギ体」）
  it("R-DECK-03: 同名の無制限カード RK-137 と RK-303 は合算しても制限されない（出典: atwiki/page-1278）", () => {
    const entries = [
      { cardId: "RK-137", count: 5 },
      { cardId: "RK-303", count: 5 },
      ...fillerEntries(30, ["ワームサナギ体"]),
    ];
    expect(nameErrors(entries)).toEqual([]);
    expect(validateDeckEntries(entries).ok).toBe(true);
  });
});

describe("R-DECK-04 2nd は同名扱い", () => {
  // 「同名のカードはデッキに３枚までである」
  it("R-DECK-04: 1st（RK-033/RK-063）と 2nd（RK-332）の仮面ライダー龍騎は合計3枚まで（出典: atwiki/page-1646）", () => {
    const three = [
      { cardId: "RK-033", count: 1 },
      { cardId: "RK-063", count: 1 },
      { cardId: "RK-332", count: 1 },
      ...fillerEntries(37, ["仮面ライダー龍騎"]),
    ];
    expect(validateDeckEntries(three).ok).toBe(true);
    const four = [
      { cardId: "RK-033", count: 1 },
      { cardId: "RK-063", count: 1 },
      { cardId: "RK-332", count: 2 },
      ...fillerEntries(36, ["仮面ライダー龍騎"]),
    ];
    expect(validateDeckEntries(four).ok).toBe(false);
  });

  // 「同名のカードはデッキに３枚までである」
  it("R-DECK-04: RK-062 電王AF と RK-306 電王AF（2nd）も同名として合算（2+2 は不可）（出典: atwiki/page-1646）", () => {
    const four = [
      { cardId: "RK-062", count: 2 },
      { cardId: "RK-306", count: 2 },
      ...fillerEntries(36, ["仮面ライダー電王AF"]),
    ];
    expect(validateDeckEntries(four).ok).toBe(false);
  });

  it.todo("R-DECK-04: [未確定] 印刷名と wiki 区別表記（（2nd）等）の対応（01-D2）");
});

describe("R-DECK-05 「『○○』としてつかえる」カード", () => {
  // 「デッキ構築の際は別のカードとして扱います」
  it("R-DECK-05: マジレッド（マジフェニックスとしてつかえる）3枚とマジフェニックス3枚は同時に入れられる（出典: atwiki/page-1739 Q1/A1）", () => {
    const entries = [
      { cardId: "RS-057", count: 3 },
      { cardId: "RS-576", count: 3 },
      ...fillerEntries(34, ["マジレッド", "マジフェニックス"]),
    ];
    expect(nameErrors(entries)).toEqual([]);
    expect(validateDeckEntries(entries).ok).toBe(true);
  });

  // 「ゲーム中、同名カードとして扱えます」
  it("R-DECK-05: ゲーム中はマジレッドを「マジフェニックス」名で扱える（出典: atwiki/page-1739 Q1/A1）", () => {
    expect(fusionMaterialAliasNames(def("RS-057").text)).toContain("マジフェニックス");
  });
});

describe("R-DECK-06 禁止カード", () => {
  // 「コマンダーカード以外は今のところ存在しない」
  it("R-DECK-06: 通常大会の禁止カード（コマンダー以外）は無い（出典: atwiki/page-1704）", () => {
    expect(BANNED_CARD_IDS).toEqual([]);
  });

  // 「タッグストライクルールでは…使用が禁止」（通常ルールでは使える）
  it("R-DECK-06: タッグ限定禁止の命の泉・ドラゴンレンジャー・メディテーションは通常デッキに入れられる（出典: atwiki/page-1704, page-2079）", () => {
    for (const id of ["RS-244", "RS-289", "RS-348"]) expect(isBannedCardId(id)).toBe(false);
    const entries = [
      { cardId: "RS-244", count: 3 },
      { cardId: "RS-289", count: 3 },
      { cardId: "RS-348", count: 3 },
      ...fillerEntries(31, ["命の泉", "ドラゴンレンジャー", "メディテーション"]),
    ];
    expect(validateDeckEntries(entries).ok).toBe(true);
  });

  // 「クロスギャザー大会（混合大会）では全てのコマンダーが使用禁止」
  it("R-DECK-06: 混合（XG）大会ではコマンダーを使えない（通常デッキ検証でコマンダーは不可）（出典: atwiki/page-1690）", () => {
    const entries = [...fillerEntries(40), { cardId: "XC-001", count: 1 }];
    expect(validateDeckEntries(entries, extendedCardsCatalog).ok).toBe(false);
  });

  it.todo("R-DECK-06: ドギー・クルーガー（XG2 コマンダー版）2010-04-01 禁止 — カードがカタログ未収録（出典: atwiki/page-2079）");
  it.todo("R-DECK-06: 合体ロボ大会ではコマンダー使用可 — レギュレーション指定が API に無い（出典: atwiki/page-1690）");
});

// コマンダーカードは今回の実装に採用しない（ユーザー決定 2026-10-10、README §5.6.1）。
describe.skip("R-DECK-07 コマンダーカード（実装対象外）", () => {
  it.todo("R-DECK-07: コマンダーは採用しないため検証しない");
});


describe("R-DECK-08 ハイランダー", () => {
  it.todo("R-DECK-08: ハイランダー大会は同名1枚まで（カードナンバー違いも合算）・コマンダー不可 — レギュレーション指定が API に無い（出典: atwiki/page-2252）");
});

// ---------------------------------------------------------------------------
// 3. ゲーム準備
// ---------------------------------------------------------------------------

describe("R-SETUP-01 山札", () => {
  // 「デッキをよくシャッフルして…「山札」…に置いて」
  it("R-SETUP-01: デッキはシャッフルされて山札になる（全カードが山札＋手札に残り、順序は入力と異なる）（出典: 公式ルール準備ページ）", () => {
    const cards = distinctNamedCards(40);
    let i = 0;
    const seq = [0.91, 0.13, 0.57, 0.33, 0.78, 0.05, 0.66, 0.24];
    const state = createGame({
      player1Deck: cards,
      player2Deck: cards,
      rng: () => seq[i++ % seq.length]!,
    });
    const p1 = state.players.player1;
    const order = [...p1.hand, ...p1.deck].map((c) => c.cardId);
    expect([...order].sort()).toEqual(cards.map((c) => c.id).sort());
    expect(order).not.toEqual(cards.map((c) => c.id));
  });
});

describe("R-SETUP-02 相手の山札のシャッフル・カット", () => {
  // 「フリープレイの場合は、対戦相手との同意のもとで」
  it.todo("R-SETUP-02: 相手の山札のシャッフル・カットは大会規定／フリープレイは合意 — 卓上の運用でエンジン外（出典: 公式FAQ リファレンス「山札」、atwiki/page-154 Q2, page-1287 Q2）");
});

describe("R-SETUP-03 初期手札7枚", () => {
  // 「山札からカードを７枚引いて手札にします」
  it("R-SETUP-03: ゲーム開始時、互いに7枚引く（40枚デッキなら山札33枚）（出典: 公式ルール準備ページ、atwiki/page-122）", () => {
    const state = gameWith40();
    for (const pid of ["player1", "player2"] as const) {
      expect(state.players[pid].hand).toHaveLength(7);
      expect(state.players[pid].deck).toHaveLength(33);
    }
  });
});

describe("R-SETUP-04 手札上限なし", () => {
  // 「ありません。何枚でも持つことができます」
  it("R-SETUP-04: 手札15枚でターンを終えても捨てる手順はない（出典: 公式FAQ リファレンス「手札」、atwiki/page-122 Q1/A1）", () => {
    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      player1: { hand: deckOf("h", 15), deck: deckOf("d", 5) },
      player2: { deck: deckOf("e", 5) },
    });
    const next = advanceUntil(state, (s) => s.activePlayer === "player2");
    expect(next.players.player1.hand).toHaveLength(15);
    expect(next.players.player1.discard).toHaveLength(0);
  });

  // 「何枚でも持つことができます」
  it("R-SETUP-04: 手札が多くてもスタートフェイズのドローは行える（出典: 公式FAQ リファレンス「手札」）", () => {
    const state = createTestState({
      phase: "start",
      activePlayer: "player1",
      player1: { hand: deckOf("h", 20), deck: deckOf("d", 5) },
    });
    const next = unwrap(applyAction(state, { type: "draw", playerId: "player1" }));
    expect(next.players.player1.hand).toHaveLength(21);
  });
});

describe("R-SETUP-05 先攻の決め方", () => {
  // 「ジャンケンで勝ったプレイヤーが自動的に先攻になります」
  it("R-SETUP-05: 先攻に決まったプレイヤーが1ターン目のターンプレイヤーになる（出典: 公式FAQ リファレンス「先攻後攻」）", () => {
    for (const first of ["player1", "player2"] as const) {
      const state = gameWith40(first);
      expect(state.firstPlayer).toBe(first);
      expect(state.activePlayer).toBe(first);
      expect(state.turn).toBe(1);
    }
  });

  // 「いいえ、選ぶことはできません」
  it.todo("R-SETUP-05: ジャンケン勝者は先攻・後攻を選べず自動的に先攻 — ジャンケンは卓上で行いエンジンは結果のみ受け取る（UI の選択は 01-D5）（出典: 公式FAQ リファレンス「先攻後攻」）");
});

describe("R-SETUP-06 マリガン", () => {
  // 「先攻・後攻が決定したらいよいよプレイ開始です！」
  it("R-SETUP-06: ゲーム開始直後に引き直し（マリガン）の行動は無い（出典: 公式ルール準備ページ）", () => {
    const state = gameWith40();
    const types = getLegalActions(state).map((a) => a.type);
    expect(types.some((t) => /mulligan|redraw/i.test(t))).toBe(false);
    expect(state.phase).toBe("charge");
  });

  it.todo("R-SETUP-06: [未確定] 明示的な「マリガンなし」の文言は無い／大会規定での扱いは未確認");
});

describe("R-SETUP-07 先攻1ターン目", () => {
  // 「先攻１ターン目はスタートフェイズがスキップされ」
  it("R-SETUP-07: 先攻1ターン目はチャージフェイズから始まりドローしない（出典: 公式ルール スタートフェイズ、atwiki/page-264）", () => {
    for (const first of ["player1", "player2"] as const) {
      const state = gameWith40(first);
      expect(state.phase).toBe("charge");
      expect(state.activePlayer).toBe(first);
      expect(state.players[first].hand).toHaveLength(7);
      expect(state.players[first].deck).toHaveLength(33);
    }
  });

  // 「先攻側は１ターン目のみ、このフェイズを飛ばして」
  it("R-SETUP-07: 後攻の1ターン目はスタートフェイズから始まりドローする（出典: atwiki/page-264、公式ルール スタートフェイズ）", () => {
    const state = gameWith40("player1");
    const atP2Start = advanceUntil(state, (s) => s.activePlayer === "player2");
    expect(atP2Start.phase).toBe("start");
    expect(atP2Start.players.player2.hand).toHaveLength(7);
    const drawn = unwrap(applyAction(atP2Start, { type: "draw", playerId: "player2" }));
    expect(drawn.players.player2.hand).toHaveLength(8);
    expect(drawn.players.player2.deck).toHaveLength(32);
  });

  // 「先攻側は１ターン目のみ」— 2ターン目以降の先攻はスタートフェイズを行う
  it("R-SETUP-07: 先攻の2回目のターンはスタートフェイズから始まる（出典: atwiki/page-264）", () => {
    const state = gameWith40("player1");
    const p2Turn = advanceUntil(state, (s) => s.activePlayer === "player2");
    const back = advanceUntil(p2Turn, (s) => s.activePlayer === "player1");
    expect(back.phase).toBe("start");
    expect(getLegalActions(back).some((a) => a.type === "draw" && a.playerId === "player1")).toBe(true);
  });

  it.todo("R-SETUP-07: [未確定] 先攻1ターン目のバトル・ストライク禁止など追加制限の有無（資料に記載なし）");
});

// ---------------------------------------------------------------------------
// 4. 勝敗
// ---------------------------------------------------------------------------

describe("R-WIN-01 ダメージ7点で敗北", () => {
  // 「相手に７点ダメージを与えた時点…で勝利」
  it("R-WIN-01: 6点の相手にストライクで7点目を与えた時点で勝利（出典: 公式ルール バトルフェイズ、atwiki/page-105）", () => {
    const next = strikeForOne({ damage: 6, power: faceDownPower("fd", 6) });
    expect(next.players.player2.damage).toBe(7);
    expect(next.winner).toBe("player1");
  });

  // 「7点になるとそのプレイヤーは敗北となる」
  it("R-WIN-01: 6点までは敗北しない（出典: atwiki/page-105）", () => {
    const next = strikeForOne({ damage: 5, power: faceDownPower("fd", 5) });
    expect(next.players.player2.damage).toBe(6);
    expect(next.winner).toBeNull();
  });

  // 「自分も相手も、ダメージが9点になるまでゲームに負けない」
  it("R-WIN-01: 命の泉（RS-244）が場にあると7点では負けない（相手の配置でも適用）（出典: RS-244 カード本文）", () => {
    const next = strikeForOne(
      { damage: 6, power: faceDownPower("fd", 6) },
      { operation: [inst("RS-244", "life")] },
    );
    expect(next.players.player2.damage).toBe(7);
    expect(next.winner).toBeNull();
  });

  // 「ダメージが9点になるまでゲームに負けない」
  it("R-WIN-01: 命の泉が場にあっても9点で敗北する（出典: RS-244 カード本文）", () => {
    const next = strikeForOne({
      damage: 8,
      power: faceDownPower("fd", 8),
      operation: [inst("RS-244", "life")],
    });
    expect(next.players.player2.damage).toBe(9);
    expect(next.winner).toBe("player1");
  });
});

describe("R-WIN-02 同時に勝敗条件を満たしたらターンプレイヤーの勝ち", () => {
  function mutualAbared(active: PlayerId): GameState {
    const own = inst("RS-054", "own");
    const foe = inst("RS-054", "foe");
    const other = opponentOf(active);
    const state = createTestState({
      phase: "battle",
      activePlayer: active,
      definitions: withDefs("RS-054"),
      [active]: { battle: [own], damage: 6, power: faceDownPower("a", 6), deck: deckOf("ad", 2) },
      [other]: { battle: [foe], damage: 6, power: faceDownPower("b", 6), deck: deckOf("bd", 2) },
    });
    return unwrap(
      applyAction(state, {
        type: "battle",
        playerId: active,
        attackerInstanceId: own.instanceId,
        defenderInstanceId: foe.instanceId,
      }),
    );
  }

  // 「同時に７点目のダメージを受けた場合はターンプレイヤーがゲームに勝利」
  it("R-WIN-02: アバレッド同士の相討ちで互いに7点目 → ターンプレイヤー player1 の勝利（出典: grnrngr/faq-card-1 RS-054）", () => {
    const next = mutualAbared("player1");
    expect(next.players.player1.damage).toBe(7);
    expect(next.players.player2.damage).toBe(7);
    expect(next.winner).toBe("player1");
  });

  // 「同時に７点目のダメージを受けた場合はターンプレイヤーがゲームに勝利」
  it("R-WIN-02: 同じ局面で player2 がターンプレイヤーなら player2 の勝利（出典: grnrngr/faq-card-1 RS-054）", () => {
    const next = mutualAbared("player2");
    expect(next.players.player1.damage).toBe(7);
    expect(next.players.player2.damage).toBe(7);
    expect(next.winner).toBe("player2");
  });

  // 「「かんしゃく」の効果でお互いに７点目のダメージ」
  it("R-WIN-02: 童鬼ドロップ（RS-093）の「かんしゃく」で互いに7点目 → ターンプレイヤーの勝利（出典: grnrngr/faq-card-2 RS-093）", () => {
    // RS-093 自身はバトルエリアに出られないため、相手（非ターンプレイヤー）の RS-093 をバトルで撃破する局面を盤面配置で作る。
    const attacker = inst("TST-UNIT-2", "atk");
    const drop = inst("RS-093", "drop");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: withDefs("RS-093"),
      player1: { battle: [attacker], damage: 6, power: faceDownPower("a", 6), deck: deckOf("ad", 2) },
      player2: { battle: [drop], damage: 6, power: faceDownPower("b", 6), deck: deckOf("bd", 2) },
    });
    const next = unwrap(
      applyAction(state, {
        type: "battle",
        playerId: "player1",
        attackerInstanceId: attacker.instanceId,
        defenderInstanceId: drop.instanceId,
      }),
    );
    expect(next.players.player1.damage).toBe(7);
    expect(next.players.player2.damage).toBe(7);
    expect(next.winner).toBe("player1");
  });

  // 「このゲームに引き分けは存在しない」
  it("R-WIN-02: 両者が同時に敗北条件を満たしても勝者は必ずどちらか一方（引き分けなし）（出典: atwiki/page-1827）", () => {
    for (const active of ["player1", "player2"] as const) {
      const next = mutualAbared(active);
      expect(["player1", "player2"]).toContain(next.winner);
    }
  });
});

describe("R-WIN-03 デッキアウト", () => {
  // 「山札が無くドローできないときは、ゲームに負けてしまいます」
  it("R-WIN-03: スタートフェイズに山札0枚でドローできないと敗北（出典: 公式ルール スタートフェイズ）", () => {
    const state = createTestState({
      phase: "start",
      activePlayer: "player1",
      player1: { deck: [], hand: [inst("TST-OP", "h1")] },
    });
    const next = unwrap(applyAction(state, { type: "draw", playerId: "player1" }));
    expect(next.winner).toBe("player2");
  });

  // 「山札が無くなっただけではゲームに負けることはありません」
  it("R-WIN-03: 最後の1枚をドローして山札0枚になっただけでは負けない（出典: 公式FAQ リファレンス「山札」、atwiki/page-154 Q1/A1）", () => {
    const state = createTestState({
      phase: "start",
      activePlayer: "player1",
      player1: { deck: [inst("TST-OP", "last")], hand: [] },
    });
    const next = unwrap(applyAction(state, { type: "draw", playerId: "player1" }));
    expect(next.players.player1.deck).toHaveLength(0);
    expect(next.winner).toBeNull();
    // ターンを最後まで進めても（次に引くべきときが来るまで）負けない
    const afterTurn = advanceUntil(next, (s) => s.activePlayer === "player2");
    expect(afterTurn.winner).toBeNull();
  });

  // 「山札が無くなっただけではゲームに負けることはありません」
  it("R-WIN-03: 効果で山札を引き切って0枚になっただけでは負けない（ダイノガッツで必要パワー2・山札2枚）（出典: atwiki/page-154 Q1/A1）", () => {
    const attacker = inst("TST-UNIT-2", "a1");
    const defender = inst("TST-UNIT-2", "d1");
    const counter = inst("RS-027", "dg");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: withDefs("RS-027"),
      player1: { battle: [attacker] },
      player2: {
        battle: [defender],
        hand: [counter],
        command: [releasedWbCommand("cmd")],
        deck: deckOf("d", 2),
        power: deckOf("p", 4),
      },
    });
    const afterBattle = unwrap(
      applyAction(state, {
        type: "battle",
        playerId: "player1",
        attackerInstanceId: attacker.instanceId,
        defenderInstanceId: defender.instanceId,
      }),
    );
    const next = unwrap(counterWithCategoryHold(afterBattle, "player2", counter.instanceId, "TST-OP:cmd"));
    expect(next.players.player2.deck).toHaveLength(0);
    expect(next.winner).toBeNull();
  });

  // 「カードをひくべきときにひけなかった場合はゲームに負けてしまいます」
  it("R-WIN-03: ダイノガッツで山札から引いて捨てる途中で山札が尽きたら敗北（必要パワー2・山札1枚）（出典: grnrngr/faq-card-1 RS-027）", () => {
    const attacker = inst("TST-UNIT-2", "a1");
    const defender = inst("TST-UNIT-2", "d1");
    const counter = inst("RS-027", "dg");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: withDefs("RS-027"),
      player1: { battle: [attacker] },
      player2: {
        battle: [defender],
        hand: [counter],
        command: [releasedWbCommand("cmd")],
        deck: deckOf("d", 1),
        power: deckOf("p", 4),
      },
    });
    const afterBattle = unwrap(
      applyAction(state, {
        type: "battle",
        playerId: "player1",
        attackerInstanceId: attacker.instanceId,
        defenderInstanceId: defender.instanceId,
      }),
    );
    const next = unwrap(counterWithCategoryHold(afterBattle, "player2", counter.instanceId, "TST-OP:cmd"));
    expect(next.winner).toBe("player1");
  });

  // 「自分自身の山札からカードを引くべきときに引けなければゲームに負ける」
  it("R-WIN-03: 命の泉が場にあっても、ドローすべきときに引けなければ負ける（出典: RS-244 カード本文、公式ルール スタートフェイズ）", () => {
    const state = createTestState({
      phase: "start",
      activePlayer: "player1",
      definitions: withDefs("RS-244"),
      player1: { deck: [], hand: [], operation: [inst("RS-244", "life")] },
    });
    const next = unwrap(applyAction(state, { type: "draw", playerId: "player1" }));
    expect(next.winner).toBe("player2");
  });
});

describe("R-WIN-04 効果の発動可否はカードごと", () => {
  function denjiState(deckSize: number) {
    return createTestState({
      phase: "rush",
      activePlayer: "player1",
      definitions: withDefs("RS-004", "RS-020"),
      player1: {
        hand: [inst("RS-004", "op")],
        power: deckOf("p", 4),
        command: [{ ...inst("RS-020", "cmd"), commandHeld: true }],
        deck: deckOf("d", deckSize),
      },
    });
  }

  // 「自軍山札が２枚以下のとき…発動させることはできますか？いいえ」
  it("R-WIN-04: 自軍山札2枚では RS-004 デンジマシーンの効果は発動しない（出典: grnrngr/faq-card-1 RS-004）", () => {
    const state = denjiState(2);
    for (const action of getLegalActions(state)) {
      if (action.type === "end_phase") continue;
      const result = applyAction(state, action);
      if (!result.ok) continue;
      expect(result.state.pendingEffectChoice?.effectId).not.toBe("denji_machine");
      expect(result.state.players.player1.deck).toHaveLength(2);
    }
  });

  // 「コマンドをホールドしたり、手札を減らす目的で…使用する…ことはできます」
  // 既知の不具合: 未登録 — 山札2枚以下だと RS-004 を手札から使用（効果なしで捨札）すること自体ができない
  it.fails("R-WIN-04: 自軍山札2枚でも RS-004 をコスト目的で使用し（効果は解決せず）捨札にできる（出典: grnrngr/faq-card-1 RS-004、公式FAQ リファレンス「オペレーション」）", () => {
    const state = denjiState(2);
    const play = getLegalActions(state).find(
      (a) => a.type !== "end_phase" && "sourceInstanceId" in a && a.sourceInstanceId === "RS-004:op",
    ) ?? getLegalActions(state).find((a) => a.type === "play_operation");
    expect(play).toBeDefined();
  });

  // 「「３枚オモテにする」ことが発動の条件ですので…発動できません」
  it("R-WIN-04: 敵軍山札2枚では RS-237 サイレンビルダーの「トリプルリキッドボンバー」は発動しない（出典: grnrngr/faq-card-4 RS-237）", () => {
    const unit = inst("RS-237", "siren");
    const state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: withDefs("RS-237"),
      player1: { rush: [unit], power: deckOf("p", 6), command: [releasedWbCommand("c1")] },
      player2: { deck: deckOf("e", 2, "TST-UNIT-0"), hand: [] },
    });
    let next = unwrap(
      applyAction(state, { type: "move_to_battle", playerId: "player1", instanceId: unit.instanceId }),
    );
    if (next.pendingBattleEntry) {
      next = unwrap(applyAction(next, { type: "pass_battle_entry", playerId: "player1" }));
    }
    expect(next.players.player1.battle.some((c) => c.instanceId === unit.instanceId)).toBe(true);
    expect(next.players.player2.deck).toHaveLength(2);
    expect(next.players.player2.hand).toHaveLength(0);
    expect(next.winner).toBeNull();
  });

  function kurokoPlayed(): GameState {
    const op = inst("RS-183", "kuroko");
    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      definitions: withDefs("RS-183"),
      player1: {
        hand: [op, ...deckOf("h", 3)],
        power: deckOf("p", 4),
        command: [inst("TST-OP-MA", "cmd")],
        deck: deckOf("d", 2),
      },
      player2: { hand: deckOf("oh", 3), deck: deckOf("e", 5) },
    });
    return unwrap(counterWithCategoryHold(state, "player1", op.instanceId, "TST-OP-MA:cmd"));
  }

  // 「山札にカードを残すようにドローすることで、ゲームに負けてしまうことを回避できます」
  it("R-WIN-04: 黒子ロボの記憶操作（3枚まで）は山札2枚でも負けずに使える（出典: grnrngr/faq-card-4 RS-183）", () => {
    let next = kurokoPlayed();
    expect(next.winner).toBeNull();
    // 以降の選択はすべて「引かない／戻す」側の最小行動で進める
    for (let i = 0; i < 20 && next.pendingEffectChoice; i++) {
      const legal = getLegalActions(next).filter((a) => a.type !== "end_phase");
      const action = legal.find((a) => a.type === "skip_effect_choice") ?? legal[0];
      if (!action) break;
      next = unwrap(applyAction(next, action));
    }
    expect(next.winner).toBeNull();
  });

  // 「その後の「…山札に戻す」は、手札がある限り必ず３回行ってください」
  // 既知の不具合: 未登録 — RS-183 の効果（3枚までドロー＋手札3回戻し）が解決されない
  it.fails("R-WIN-04: 黒子ロボの記憶操作は引く枚数を抑えても「山札に戻す」手順を3回行う（出典: grnrngr/faq-card-4 RS-183）", () => {
    let next = kurokoPlayed();
    for (let i = 0; i < 30 && (next.pendingEffectChoice || next.pendingCommandPayment); i++) {
      const legal = getLegalActions(next).filter((a) => a.type !== "end_phase");
      const action = legal.find((a) => a.type === "skip_effect_choice") ?? legal[0];
      if (!action) break;
      next = unwrap(applyAction(next, action));
    }
    // 手札3枚・追加ホールド用コマンド無し → 自軍山札の上に3枚戻る（引いた枚数 n≤2 に関わらず 2-n+3 ≥ 3）
    expect(next.players.player1.deck.length).toBeGreaterThanOrEqual(3);
  });

  it.todo("R-WIN-04: [未確定] 「まで」の無い2枚引く効果で山札1枚のときの一般則");
});

describe("R-WIN-05 ダメージを置く山札がない場合", () => {
  // 「山札の上から１枚を裏向きのままパワーゾーンに置き１点」
  it("R-WIN-05: オモテ向きパワーが無ければ山札の上から1枚をウラ向きでパワーゾーンに置く（出典: 公式ルール バトルフェイズ、atwiki/page-105）", () => {
    const top = inst("TST-OP", "top");
    const next = strikeForOne({ power: [], deck: [top, inst("TST-OP", "second")] });
    expect(next.players.player2.damage).toBe(1);
    expect(next.players.player2.deck.map((c) => c.instanceId)).toEqual(["TST-OP:second"]);
    const placed = next.players.player2.power.find((c) => c.instanceId === top.instanceId);
    expect(placed?.faceDown).toBe(true);
  });

  it.todo("R-WIN-05: [未確定] オモテ向きパワーも山札も無いときにダメージを受けた場合の処理（R-WIN-03 適用の可否）（01-D14, 03-D8）");
});
