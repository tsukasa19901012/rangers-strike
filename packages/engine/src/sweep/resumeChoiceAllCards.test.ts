/**
 * 選択の後ろで待っている選択（resumeChoice）が消えないかの確認（2026-11-06 の報告: ライドラプターの選択を閉じると、
 * 後ろで待っていた RS-558 ガンマジンのドローが消えていた）。
 *
 * effectsAllCards.test.ts と同じ盤面・進め方で、そのカードの効果の最初の選択が開いたときに、別のカードの選択
 * （見張り役。ガンマジンの「1枚ドローしてもよい」と同じ形）をその後ろに積む。効果を最後まで進めたあと、見張り役の
 * 選択が一度でも開いていれば合格。開かずに終わったら、その効果の処理のどこかで後ろの選択を落としている。
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
  type DriveResult,
  type Probe,
} from "./effectBoard";
import { appendResumeChoice } from "../rules/pendingChoices";
import type { PendingEffectChoice } from "../types/game";

const PROBE_ID = "PROBE-WAITING";
const probeChoice: PendingEffectChoice = {
  playerId: "player1",
  phasePlayerId: "player1",
  effectId: "rs558_key_holder_wish",
  sourceCardId: "RS-558",
  sourceInstanceId: PROBE_ID,
  kind: "optional_deck_draw",
  validInstanceIds: ["draw"],
  selectedInstanceIds: [],
  optional: true,
};
const makeProbe = (): Probe => ({
  inject: (s) => (s.pendingEffectChoice ? { ...s, pendingEffectChoice: appendResumeChoice(s.pendingEffectChoice, probeChoice) } : s),
  isProbe: (c) => c.sourceInstanceId === PROBE_ID,
});

const TIMEOUT = 180_000;
let sinceYield = 0;
const breathe = async () => {
  if (++sinceYield % 20 === 0) await new Promise((resolve) => setImmediate(resolve));
};
const POLICIES: ChoicePolicy[] = ["first", "decline"];

/** 見張り役を積んだのに一度も開かずに終わった（エラーで止まったものは effectsAllCards.test.ts の担当なので数えない）。 */
const dropped = (o: DriveResult, p: Probe) => o.kind !== "error" && !!p.injected && !p.seen;

describe("選択の後ろで待つ選択が消えない", () => {
  for (const policy of POLICIES) {
    it(`「ラッシュしたとき」（選び方: ${policy}）`, async () => {
      const bad: string[] = [];
      for (const u of allEffectUnits.filter(hasOnRushTrigger)) {
        await breathe();
        const p = makeProbe();
        if (dropped(checkOnRush(u, policy, undefined, undefined, p), p)) bad.push(`${u.id} ${u.name}`);
      }
      expect(bad).toEqual([]);
    }, TIMEOUT);

    it(`「バトルエリアに出たとき」（選び方: ${policy}）`, async () => {
      const bad: string[] = [];
      for (const u of allEffectUnits.filter(hasEnterBattleTrigger)) {
        await breathe();
        const p = makeProbe();
        if (dropped(checkEnterBattle(u, policy, undefined, undefined, p), p)) bad.push(`${u.id} ${u.name}`);
      }
      expect(bad).toEqual([]);
    }, TIMEOUT);

    it(`オペレーション（選び方: ${policy}）`, async () => {
      const bad: string[] = [];
      for (const op of allOperations) {
        await breathe();
        const p = makeProbe();
        if (dropped(checkOperation(op, policy, undefined, undefined, p), p)) bad.push(`${op.id} ${op.name}`);
      }
      expect(bad).toEqual([]);
    }, TIMEOUT);

    it(`起動効果（選び方: ${policy}）`, async () => {
      const bad: string[] = [];
      for (const card of allFieldCards) {
        await breathe();
        for (const { where, outcome, probe } of checkActivations(card, policy, undefined, makeProbe)) {
          if (probe && dropped(outcome, probe)) bad.push(`${card.id} ${card.name} ${where}`);
        }
      }
      expect(bad).toEqual([]);
    }, TIMEOUT);
  }
});
