/**
 * 全カードの効果の発動確認。効果の対象になりやすいものを両軍に置いた盤面（effectBoard.ts）で、
 * 「これをラッシュしたとき」「これがバトルエリアに出たとき」のユニット、オペレーション、起動効果を使い、
 * 自分の選択を「先頭」「末尾」「見送り」の 3 通りで最後まで進める。
 *
 * 見ること: 途中で止まらない・合法手が断られない・例外が出ない（全部）。
 * 「ラッシュしたとき」「出たとき」の効果は、選択が出るかログに残る（盤面の条件で発動しないカードは下の一覧）。
 * オペレーションは使える（反応して使うもの・カウンターは除く）。
 * 結果は、効果の文の必ず起きる最初の 1 文（条件・分岐の無いもの）だけ、書かれた動詞（撃破する・引く・手札に戻す・
 * ホールドする等）のとおりにカードが動いたかを見る（effectResult.ts）。BP・能力の付与・細かい数は見ない（カード仕様テストの役目）。
 * 分岐は、「〜してもよい」「◎選択肢」「相手は A か B かを選ぶ」の選択を候補ごとに選び分けて、それぞれの動きを見る（effectBranches.ts）。
 * 条件は、「敵軍ビークルが2体以上あれば」等の盤面で決まる条件を、満たす盤面と満たさない盤面で比べる（effectConditions.ts）。
 */
import type { CardDefinition } from "@rangers-strike/cards";
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
  type DriveResult,
} from "./effectBoard";
import { certainSentence, missingVerbs, verbCounts } from "./effectResult";
import { branchPlan, checkBranches } from "./effectBranches";
import { conditionPlan } from "./effectConditions";

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
/** 文のとおりに動かないのが正しい（この盤面に対象が無い等）カード。 */
const NO_RESULT_ON_THIS_BOARD: Record<string, string> = {
  "RS-125": "選べる数が自軍の WB の M ユニットの数までで、盤面にいない",
};

const RUSH_TRIGGER = /(これ|このユニット)をラッシュした(とき|時)/;
const ENTER_TRIGGER = /(これ|このユニット)がバトルエリアに出(た|る)(とき|時)/;

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

    if (policy === "first") {
      it("効果の文の必ず起きる最初の 1 文のとおりにカードが動く", async () => {
        const bad: string[] = [];
        let count = 0;
        const check = (card: { id: string; name: string }, sentence: string | null, run: () => DriveResult) => {
          if (!sentence || NO_RESULT_ON_THIS_BOARD[card.id]) return;
          const o = run();
          if (!o.state || !o.start || o.kind === "no-target" || o.kind === "silent") return;
          // 「〜してもよい」は選択が出たときだけ（対象が無いと選択が出ない）。相手の「してもよい」は相手が見送る
          if (/てもよい/.test(sentence) && (o.kind !== "prompted" || /^相手は/.test(sentence))) return;
          count++;
          // 支払いでホールドしたコマンド等を効果が選ぶこともあるので、効果の選択が出た盤面からも比べる
          const fromStart = missingVerbs(sentence, o.start, o.state, o.excluded!, o.source!);
          const fromPrompt = o.promptState ? missingVerbs(sentence, o.promptState, o.state, new Set([o.source!]), o.source!) : fromStart;
          const missing = fromStart.filter((v) => fromPrompt.includes(v));
          if (missing.length > 0) bad.push(`${card.id} ${card.name}: ${missing.join("・")}が起きない（${sentence}）`);
        };
        for (const u of onRush) {
          await breathe();
          check(u, certainSentence(u, RUSH_TRIGGER), () => checkOnRush(u, policy));
        }
        for (const u of enter) {
          await breathe();
          check(u, certainSentence(u, ENTER_TRIGGER), () => checkEnterBattle(u, policy));
        }
        for (const op of allOperations) {
          await breathe();
          check(op, certainSentence(op), () => checkOperation(op, policy));
        }
        expect(count).toBeGreaterThan(150);
        expect(bad).toEqual([]);
      }, TIMEOUT);
    }

    if (policy === "first") {
      it("効果の分岐（してもよい・◎選択肢・相手の選択）ごとに書かれた動きが起きる", async () => {
        const bad: string[] = [];
        let count = 0;
        const check = (card: { id: string; name: string }, plan: ReturnType<typeof branchPlan>, run: Parameters<typeof checkBranches>[1]) => {
          if (!plan) return;
          const problems = checkBranches(plan, run);
          if (problems === null) return; // 選択が出なかった（対象が無い等）
          count++;
          if (problems.length > 0) bad.push(`${card.id} ${card.name}: ${problems.join(" / ")}`);
        };
        for (const u of onRush) {
          await breathe();
          check(u, branchPlan(u, RUSH_TRIGGER), (b) => checkOnRush(u, policy, b));
        }
        for (const u of enter) {
          await breathe();
          check(u, branchPlan(u, ENTER_TRIGGER), (b) => checkEnterBattle(u, policy, b));
        }
        for (const op of allOperations) {
          await breathe();
          check(op, branchPlan(op), (b) => checkOperation(op, policy, b));
        }
        expect(count).toBeGreaterThan(60);
        expect(bad).toEqual([]);
      }, TIMEOUT);

      it("盤面で決まる条件（〜があれば・〜なら）を満たすときだけ書かれた動きが起きる", async () => {
        const bad: string[] = [];
        let count = 0;
        const cases: Array<[CardDefinition, RegExp | undefined, typeof checkOnRush]> = [
          ...onRush.map((u) => [u, RUSH_TRIGGER, checkOnRush] as [CardDefinition, RegExp, typeof checkOnRush]),
          ...enter.map((u) => [u, ENTER_TRIGGER, checkEnterBattle] as [CardDefinition, RegExp, typeof checkOnRush]),
          ...allOperations.map((op) => [op, undefined, checkOperation] as [CardDefinition, undefined, typeof checkOnRush]),
        ];
        for (const [card, trigger, run] of cases) {
          await breathe();
          const plan = conditionPlan(card, trigger);
          if (!plan) continue;
          const sat = plan.tweak(true);
          const unsat = plan.tweak(false);
          if (!sat || !unsat) continue;
          count++;
          const [yes, no] = [run(card, policy, undefined, sat), run(card, policy, undefined, unsat)];
          if (yes.kind === "error" || no.kind === "error") {
            bad.push(`${card.id} ${card.name}: ${why(yes.kind === "error" ? yes : no)}`);
            continue;
          }
          // 支払い・追加条件の動きは両方の盤面で同じなので、満たす盤面のほうが多く動くかで見る
          const counts = (o: DriveResult) => (o.state && o.start ? verbCounts(o.start, o.state, o.excluded!) : new Map<string, number>());
          const [cy, cn] = [counts(yes), counts(no)];
          for (const v of plan.verbs) {
            if ((cy.get(v) ?? 0) <= (cn.get(v) ?? 0)) bad.push(`${card.id} ${card.name}: 「${plan.condition}」を満たしても満たさなくても${v}の数が同じ`);
          }
        }
        expect(count).toBeGreaterThan(5);
        expect(bad).toEqual([]);
      }, TIMEOUT);
    }

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
