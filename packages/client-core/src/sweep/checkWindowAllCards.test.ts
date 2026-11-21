/**
 * 「N枚まで選ぶ」選択（1枚選んでも同じ選択が開いたままのもの）が、全部チェック式の窓（PR #87）で開くかを、全カードで確かめる。
 * ユーザー報告（2026-11-21）「ライダーパスを発動して重ねるカードを選択する際…一枚ずつのままとなっている」: RK-022 の選択は
 * selectCount が 1 だったので、チェック式の窓の判定（selectCount ≥ 2）から外れていた。XG2-070・XG3-027・XP-025・XG6-063・RK-150 も同じ。
 *
 * 見ること（人の軍が選ぶ窓ごと）:
 * - 1枚チェックしても、まだ何も送らない（カードは窓に残り、チェックが付く）。
 * - 「選択を確定（N枚）」を押すと、チェックしたカードを送って、その選択が閉じる（同じ選択が残って止まらない）。
 * - 選んだ順で結果が変わる選択（出す順番・好きな順・1体目/2体目）は1枚ずつのまま（ORDERED）。
 */
import { describe, expect, it } from "vitest";
import { applyAction, getLegalActions, type GameState } from "@rangers-strike/engine";
import { allFieldCards, allOperations, checkActivations, checkEnterBattle, checkOnRush, checkOperation, type Probe } from "../../../engine/src/sweep/effectBoard";
import { AppController } from "../app/controller";
import { parseSharePayload } from "../app/share";
import { input } from "../input/actions";
import { testPlatform } from "../testing/engine";

/** 選んだ順が結果に効くので、1枚ずつ選ぶ選択。 */
const ORDERED = new Set([
  "green_crush", // RS-108 出す順番は自分が選ぶ
  "rk087_zectmizer_enter", // RK-087 出す順番は自分が選ぶ
  "rk087_zectmizer_order", // RK-087 好きな順に並べ替える
  "submerge", // RS-137 山札の下に好きな順で
  "sk004_majiki_stack", // SK-004 好きな順でウラ向きに重ねる
  "xg1078_copy_vent", // XG1-078 1体目・2体目
  "pit_in_dive_order", // RS-658 順番
]);

/** 確定のかわりに「選ばない」で選び終える（それまでに選んだカードは残る）選択。 */
const STOP_BY_SKIP = new Set(["rk022_pass_search", "xg2_070_book_search", "xg3027_fireball", "xp025_niten_ichiryu", "houou_tornado", "kamen_ride_deploy"]);

type Window = { cardId: string; state: GameState };

/** 1枚選んでも同じ選択が開いたままの、人の軍の選択の盤面を全カードから集める。 */
function multiPickWindows(): Window[] {
  const out: Window[] = [];
  const keys = new Set<string>();
  for (const d of [...allFieldCards, ...allOperations]) {
    const seen: GameState[] = [];
    const probe = (): Probe => ({ injected: true, see: (s) => seen.push(s) });
    try {
      if (d.type === "operation") checkOperation(d, "first", undefined, undefined, probe());
      else {
        checkOnRush(d, "first", undefined, undefined, probe());
        checkEnterBattle(d, "first", undefined, undefined, probe());
        checkActivations(d, "first", undefined, probe);
      }
    } catch {
      continue;
    }
    for (const s of seen) {
      const c = s.pendingEffectChoice;
      if (!c || c.playerId !== "player1" || c.deckOrderMeta || c.mayConfirm || c.revealGate) continue;
      const key = `${d.id}|${c.effectId}`;
      if (keys.has(key)) continue;
      const picks = getLegalActions(s).filter((a) => a.type === "resolve_effect_choice" && a.playerId === "player1");
      if (picks.length < 2) continue;
      const r = applyAction(s, picks[0]!);
      const n = r.ok ? r.state!.pendingEffectChoice : undefined;
      if (!n || n.effectId !== c.effectId || n.sourceInstanceId !== c.sourceInstanceId || n.playerId !== c.playerId) continue;
      if (!n.validInstanceIds.every((id) => c.validInstanceIds.includes(id))) continue;
      keys.add(key);
      out.push({ cardId: d.id, state: s });
    }
  }
  return out;
}

function gui(): AppController {
  const app = new AppController({ platform: testPlatform(), viewport: { width: 480, height: 272 }, cpuDelayFrames: 0, seed: () => 5, gui: true });
  app.dispatch(input.select(3, true));
  return app;
}

describe("N枚まで選ぶ選択はチェック式の窓", () => {
  const windows = multiPickWindows();

  it("ライダーパスなどを見つけている", () => {
    const ids = windows.map((w) => `${w.cardId} ${w.state.pendingEffectChoice!.effectId}`);
    expect(ids).toEqual(
      expect.arrayContaining([
        "RK-022 rk022_pass_search",
        "XG2-070 xg2_070_book_search",
        "XG3-027 xg3027_fireball",
        "XP-025 xp025_niten_ichiryu",
        "XG6-063 xg6063_full_fire",
        "RK-150 rk150_drill_pick",
      ]),
    );
  });

  it("チェックしても送らず、「選択を確定」でチェックしたカードを送って閉じる", () => {
    const app = gui();
    const wrong: string[] = [];
    let checked = 0;
    const short: string[] = [];
    for (const { cardId, state } of windows) {
      const c = state.pendingEffectChoice!;
      if (ORDERED.has(c.effectId)) continue;
      const where = `${cardId} ${c.effectId}`;
      app.startSharedMatch(parseSharePayload({ v: 1, cpuLevel: 1, state })!);
      const dialog = app.view().gui?.dialog;
      if (!dialog) {
        wrong.push(`${where}: 窓が開かない`);
        continue;
      }
      // The window pages its cards (moreLeft / moreRight) and buttons (buttonOffset): rows are absolute.
      type D = NonNullable<NonNullable<ReturnType<AppController["view"]>["gui"]>["dialog"]>;
      const total = (x: D) => x.moreLeft + x.cards.length + x.moreRight;
      const pressButton = (x: D, i: number) => app.dispatch(input.select(total(x) + x.buttonOffset + i, true));
      const first = dialog.cards.findIndex((x) => x.actionable);
      app.dispatch(input.select(dialog.moreLeft + first, true));
      let after = app.view().gui!.dialog!;
      const sent = app.session!.state.pendingEffectChoice?.selectedInstanceIds?.length ?? 0;
      if (!after.cards.find((x) => x.instanceId === dialog.cards[first]!.instanceId)?.checked || sent !== (c.selectedInstanceIds?.length ?? 0)) {
        wrong.push(`${where}: 1枚ずつ（チェック式でない）`);
        continue;
      }
      // ちょうどN枚の選択は、確定が出るまでチェックを足す（見えている範囲になければ次のページ）。
      let confirm = after.buttons.findIndex((b) => b.text.startsWith("選択を確定"));
      for (let i = 0; confirm < 0 && i < 40; i++) {
        const next = after.cards.findIndex((x) => x.actionable && !x.checked);
        if (next >= 0) app.dispatch(input.select(after.moreLeft + next, true));
        else if (after.moreRight > 0) app.dispatch(input.select(after.moreLeft + after.cards.length, false));
        else break;
        after = app.view().gui!.dialog!;
        confirm = after.buttons.findIndex((b) => b.text.startsWith("選択を確定"));
      }
      if (confirm < 0) {
        // ちょうどN枚の選択で候補がN枚に足りない盤面（RS-042 ジャスティスフラッシャーのパワー5枚など）は「選ばない」で終えるだけ。
        if (!after.buttons.some((b) => b.text === "選ばない")) wrong.push(`${where}: 確定も「選ばない」もない（${after.buttons.map((b) => b.text).join("/")}）`);
        else short.push(c.effectId);
        continue;
      }
      // 「選ばない」で選び終える選択（チェックしたカードは残る）は、チェックした後は「選択を確定」だけ。
      if (STOP_BY_SKIP.has(c.effectId) && after.buttons.some((b) => b.text === "選ばない")) wrong.push(`${where}: チェックしたのに「選ばない」が残る`);
      const picks = Number(/（(\d+)枚）/.exec(after.buttons[confirm]!.text)?.[1] ?? 0);
      const logBefore = app.session!.state.log.length;
      pressButton(after, confirm);
      const next = app.session!.state.pendingEffectChoice;
      if (app.session!.state.log.length === logBefore) wrong.push(`${where}: 確定しても何も送らない`);
      else if (next && next.effectId === c.effectId && next.sourceInstanceId === c.sourceInstanceId && (next.selectedInstanceIds?.length ?? 0) < picks) {
        wrong.push(`${where}: 確定しても同じ選択が残る`);
      }
      checked++;
    }
    expect(wrong).toEqual([]);
    expect(new Set(short)).toEqual(new Set(["justice_flasher", "xg4054_straight_exile"]));
    expect(checked).toBeGreaterThanOrEqual(20);
  }, 600_000);
});
