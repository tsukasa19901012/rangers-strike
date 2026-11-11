/**
 * 山札のカードを見る効果の選択窓（GUI）を、本文に「山札…見」があるカード全部で開いて、カードの下の表示を確かめる。
 * ユーザー報告（2026-11-11、共有盤面 PV34qCqV）「ドレイクMFの効果対象がない場合、山札の全てのカードが選択対象となってしまう」
 * （XG3-063。選べるカードがない「自軍山札を見て」の窓で、見るだけの山札が全部「選択対象」と出ていた）からの横展開。
 *
 * 盤面と効果の進め方は engine sweep/effectBoard.ts（ラッシュしたとき・出たとき・オペレーション・起動効果）、山札は 3 通り
 * （いろいろ混ぜたもの／オペレーションだけ／特徴の少ない S ユニットだけ）で、選べるカードがある場合とない場合を両方通す。
 *
 * 見ること（人の軍が選ぶ窓ごと）:
 * - 選べるカード（validInstanceIds）は選べる（actionable）。
 * - 選べないカードは、「自軍山札を見て」で見ている山札（deckLookInstanceIds）なら「対象外」。
 * - 選べないカードが「選択対象」と出るのは、カードではなく言葉（山札の上／下 など）で答える窓で、その窓が話題にしているカードだけ。
 *   答えが「選ばない」だけの窓（RS-667 で炎神のMユニットがない。viewedInstanceIds で山札を見せる）は「対象外」。
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "@rangers-strike/engine";
import { allFieldCards, allOperations, checkActivations, checkEnterBattle, checkOnRush, checkOperation, mk, type Probe, type Tweak } from "../../../engine/src/sweep/effectBoard";
import { plainOperations, plainUnits } from "../../../engine/src/sweep/rushBoard";
import { AppController } from "../app/controller";
import { parseSharePayload } from "../app/share";
import { input } from "../input/actions";
import { testPlatform } from "../testing/engine";

const LOOK = /山札.{0,30}見[てるせ]/;
const targets = [...allFieldCards, ...allOperations].filter((d) => LOOK.test((d.text ?? "").normalize("NFKC")));

const withDeck = (cards: () => string[]): Tweak => (s) => ({
  ...s,
  players: {
    player1: { ...s.players.player1, deck: cards().map((id) => mk(id)) },
    player2: { ...s.players.player2, deck: cards().map((id) => mk(id)) },
  },
});
const DECKS: Array<[string, Tweak | undefined]> = [
  ["mixed", undefined],
  ["ops", withDeck(() => Array.from({ length: 12 }, (_, i) => plainOperations[i % plainOperations.length]!.id))],
  ["plain", withDeck(() => Array.from({ length: 12 }, (_, i) => plainUnits[i % plainUnits.length]!.id))],
];

/** そのカードの効果を全部の入り口で使い、人の軍が答える効果の選択の盤面を集める。 */
function windows(cardId: string, tweak: Tweak | undefined): GameState[] {
  const d = targets.find((x) => x.id === cardId)!;
  const seen: GameState[] = [];
  const probe = (): Probe => ({ injected: true, see: (s) => seen.push(s) });
  if (d.type === "operation") checkOperation(d, "first", undefined, tweak, probe());
  else {
    checkOnRush(d, "first", undefined, tweak, probe());
    checkEnterBattle(d, "first", undefined, tweak, probe());
    checkActivations(d, "first", tweak, probe);
  }
  return seen.filter((s) => s.pendingEffectChoice?.playerId === "player1" && !s.pendingEffectChoice.revealGate);
}

function gui(): AppController {
  const app = new AppController({ platform: testPlatform(), viewport: { width: 480, height: 272 }, cpuDelayFrames: 0, seed: () => 5, gui: true });
  app.dispatch(input.select(3, true));
  return app;
}

describe("山札を見る効果の選択窓", () => {
  it("対象のカードを読めている", () => {
    expect(targets.map((d) => d.id)).toEqual(expect.arrayContaining(["XG3-063", "XG1-076", "RM-017", "XG3-061", "RS-186"]));
  });

  it("選べるカードは選べ、見ている山札は「対象外」、「選択対象」は言葉で答える窓のカードだけ", async () => {
    const app = gui();
    const wrong: string[] = [];
    const wordWindows = new Set<string>();
    let opened = 0;
    for (const [i, d] of targets.entries()) {
      if (i % 5 === 0) await new Promise((resolve) => setImmediate(resolve));
      for (const [deckName, tweak] of DECKS) {
        for (const s of windows(d.id, tweak)) {
          app.startSharedMatch(parseSharePayload({ v: 1, cpuLevel: 1, state: s })!);
          const dialog = app.view().gui?.dialog;
          if (!dialog) continue;
          opened++;
          const c = s.pendingEffectChoice!;
          const where = `${d.id} ${d.name} (${deckName}, ${c.effectId})`;
          const valid = new Set(c.validInstanceIds);
          const deckLook = new Set(c.deckLookInstanceIds ?? []);
          const pickable = dialog.cards.some((x) => x.actionable);
          const onlyPass = dialog.buttons.every((b) => b.text === "選ばない");
          for (const card of dialog.cards) {
            const id = card.instanceId!;
            if (valid.has(id) && !card.actionable && !c.selectedInstanceIds?.includes(id)) wrong.push(`${where}: ${id} は候補なのに選べない`);
            if (card.actionable) continue;
            if (deckLook.has(id) && card.caption !== "対象外") wrong.push(`${where}: 見ている山札 ${id} が「${card.caption}」`);
            if (card.caption === "選択対象") {
              // 言葉で答える窓（候補にインスタンスのカードがない）で、話題のカードとして出ているもの。
              if (pickable || deckLook.has(id) || onlyPass) wrong.push(`${where}: 選べない ${id} が「選択対象」`);
              else wordWindows.add(`${d.id} ${c.effectId}`);
            }
          }
        }
      }
    }
    expect(opened).toBeGreaterThan(50);
    expect(wrong).toEqual([]);
    // 「選択対象」と出るのは山札の上を見て上か下かを選ぶような窓（RM-017 おめでトロフィーなど）。
    console.log(`windows ${opened}; 選択対象 windows: ${[...wordWindows].sort().join(" / ")}`);
  }, 600_000);
});
