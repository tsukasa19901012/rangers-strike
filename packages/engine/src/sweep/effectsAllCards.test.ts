/**
 * 全カードの効果の発動確認。効果の対象になりやすいものを両軍に置いた盤面（effectBoard.ts）で、
 * 「これをラッシュしたとき」「これがバトルエリアに出たとき」のユニット、オペレーション、起動効果を使い、
 * 自分の選択を「先頭」「末尾」「見送り」の 3 通りで最後まで進める。
 *
 * 見ること: 途中で止まらない・合法手が断られない・例外が出ない（全部）。
 * 「ラッシュしたとき」「出たとき」の効果は、選択が出るかログに残る（盤面の条件で発動しないカードは下の一覧）。
 * オペレーションは使える（反応して使うもの・カウンターは除く）。
 * 効果の結果が正しいかは見ない（カード仕様テストの役目）。
 */
import { describe, expect, it } from "vitest";
import {
  allEffectUnits,
  allFieldCards,
  allOperations,
  checkActivations,
  checkEnterBattle,
  checkOnRush,
  checkOperation,
  hasEnterBattleTrigger,
  hasOnRushTrigger,
  type ChoicePolicy,
  type EffectOutcome,
} from "./effectBoard";

/** この盤面では発動しない（条件を満たさない・敵軍ターンのみ等）「ラッシュしたとき」「出たとき」。 */
const QUIET_ON_THIS_BOARD: Record<string, string> = {
  "RK-225:rush": "「ラッシュした」は常駐効果の中の言葉で、ラッシュしたときの効果ではない",
  "XG3-009:rush": "バトルエリアに出られないユニット。効果はスタートフェイズに起きる",
  "XG3-101:rush": "敵軍ターンにラッシュしたときだけ",
  "XG6-044:rush": "パワーに「テディ」があるときだけ",
  "RK-196:enter": "レジストを持つ敵軍ユニットがいないとバトルエリアに出られない",
  "RS-301:enter": "Vコマンダーをホールドしないとバトルエリアに出られない",
  "RS-051:enter": "手札に「爆竜ティラノサウルス」があるときだけ",
  "RS-159:enter": "敵軍のダメージが 0 なので何も起きない",
  "XG1-092:enter": "そのターンのルールを変える効果で、ログに残らない",
  "XG6-016:enter": "合わさったときの効果（出たときの効果ではない）",
  "XG7-024:enter": "ラッシュしたときに自軍「ゲキチョッパー」があればの効果（出たときの効果ではない）",
};

/** 自軍ラッシュフェイズに手札から使えない（何かに反応して使う）オペレーション。カウンターは本文で除く。 */
const REACTION_OPERATIONS: Record<string, string> = {
  "RS-006": "自軍Sユニットがアタックされたとき",
  "RS-016": "自軍ユニットが場を離れるとき",
  "RS-018": "自軍ユニットがアタックされたとき",
  "RS-026": "BP8000以下のユニットがラッシュされたとき",
  "RS-027": "自軍ユニットが場を離れるとき",
};

/** 1 本あたり数秒〜15 秒ほど（起動効果が一番重い）。 */
const TIMEOUT = 120_000;
/**
 * 1 本が十数秒イベントループを止めると、vitest のワーカーの通信（onTaskUpdate）が時間切れになり
 * 「Unhandled Error」で落ちる（CI で起きた）。カード 20 枚ごとに処理を返す。
 */
let sinceYield = 0;
const breathe = async () => {
  if (++sinceYield % 20 === 0) await new Promise((resolve) => setImmediate(resolve));
};
const POLICIES: ChoicePolicy[] = ["first", "last", "decline"];
const fired = (o: EffectOutcome) => o.kind === "prompted" || o.kind === "logged" || o.kind === "no-target";
const why = (o: EffectOutcome) => (o.kind === "error" ? `error: ${o.why}` : o.kind);

describe("全カードの効果の発動", () => {
  const onRush = allEffectUnits.filter(hasOnRushTrigger);
  const enter = allEffectUnits.filter(hasEnterBattleTrigger);

  it("対象のカードを読めている", () => {
    expect(onRush.length).toBeGreaterThan(100);
    expect(enter.length).toBeGreaterThan(150);
    expect(allOperations.length).toBeGreaterThan(200);
  });

  for (const policy of POLICIES) {
    it(`「ラッシュしたとき」は止まらずに発動する（選び方: ${policy}）`, async () => {
      const bad: string[] = [];
      for (const u of onRush) {
        await breathe();
        const o = checkOnRush(u, policy);
        if (o.kind === "error" || (!fired(o) && !QUIET_ON_THIS_BOARD[`${u.id}:rush`])) bad.push(`${u.id} ${u.name}: ${why(o)}`);
      }
      expect(bad).toEqual([]);
    }, TIMEOUT);

    it(`「バトルエリアに出たとき」は止まらずに発動する（選び方: ${policy}）`, async () => {
      const bad: string[] = [];
      for (const u of enter) {
        await breathe();
        const o = checkEnterBattle(u, policy);
        if (o.kind === "error" || (!fired(o) && !QUIET_ON_THIS_BOARD[`${u.id}:enter`])) bad.push(`${u.id} ${u.name}: ${why(o)}`);
      }
      expect(bad).toEqual([]);
    }, TIMEOUT);

    it(`オペレーションは使えて、止まらない（選び方: ${policy}）`, async () => {
      const bad: string[] = [];
      for (const op of allOperations) {
        await breathe();
        const o = checkOperation(op, policy);
        const reaction = /※カウンター/.test(op.text ?? "") || REACTION_OPERATIONS[op.id];
        if (o.kind === "error" || (o.kind === "not-offered" && !reaction)) bad.push(`${op.id} ${op.name}: ${why(o)}`);
      }
      expect(bad).toEqual([]);
    }, TIMEOUT);

    it(`起動効果は止まらない（選び方: ${policy}）`, async () => {
      const bad: string[] = [];
      let count = 0;
      for (const card of allFieldCards) {
        await breathe();
        for (const { where, outcome } of checkActivations(card, policy)) {
          count++;
          if (outcome.kind === "error") bad.push(`${card.id} ${card.name} (${where}): ${why(outcome)}`);
        }
      }
      expect(count).toBeGreaterThan(30);
      expect(bad).toEqual([]);
    }, TIMEOUT);
  }
});
