/**
 * 「自軍山札を見て…」（山札全体から探す効果）は、選ぶ人に山札の全部を見せる（rules/deckLook.ts）。
 * ユーザー報告（2026-10-31）「ディケイドライバーを使用した後…デッキの中身の確認も出来ない」（XG1-076。山札に選べるカードがなく、
 * 窓が開かずにシャッフルして終わっていた）から、本文に「山札を見て（見る）」があるカードを全部確かめる。
 *
 * 見ること: 効果を使って山札の並び（中身）が変わった軍があれば、その効果の選択のどれかで、その軍の山札の全部が
 * 選ぶ人に見えていたこと（選択の候補か、見るだけのカード deckLookInstanceIds・viewedInstanceIds）。
 * 盤面は effectBoard.ts（ラッシュしたとき・出たとき・オペレーション・起動効果）。山札は 3 通り（いろいろ混ぜたもの／オペレーションだけ／
 * 特徴の少ない S ユニットだけ）にして、選べるカードがある場合とない場合を両方通す。
 */
import { describe, expect, it } from "vitest";
import type { GameState, PlayerId } from "../types/game";
import { allFieldCards, allOperations, checkActivations, checkEnterBattle, checkOnRush, checkOperation, mk, type DriveResult, type Tweak } from "./effectBoard";
import { plainOperations, plainUnits } from "./rushBoard";

const LOOK = /山札を見[てる]/;
const targets = [...allFieldCards, ...allOperations].filter((d) => LOOK.test((d.text ?? "").normalize("NFKC")));

/**
 * 山札が動いても、山札を見る効果のせいではないもの。
 * RM-004: 先に敵軍山札の上をオモテにしてシャッフルする（「自軍山札を見て」は、出したユニットがあったときだけ）。
 */
const OTHER_DECK_CHANGES: Record<string, PlayerId[]> = { "RM-004": ["player2"] };

const deckKey = (s: GameState, p: PlayerId) => s.players[p].deck.map((c) => c.instanceId).join(",");
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

function runs(cardId: string, tweak: Tweak | undefined): Array<[string, DriveResult]> {
  const d = targets.find((x) => x.id === cardId)!;
  if (d.type === "operation") return [["op", checkOperation(d, "first", undefined, tweak)]];
  return [
    ["rush", checkOnRush(d, "first", undefined, tweak)],
    ["enter", checkEnterBattle(d, "first", undefined, tweak)],
    ...checkActivations(d, "first", tweak).map((a): [string, DriveResult] => [a.where, a.outcome]),
  ];
}

describe("「自軍山札を見て」の効果は、選ぶ人に山札の全部を見せる", () => {
  it("対象のカードを読めている", () => {
    expect(targets.map((d) => d.id)).toEqual(expect.arrayContaining(["XG1-076", "XG3-068", "RS-201", "RS-251", "XP-015", "RK-326", "RM-016"]));
  });

  it("山札が動いたら、その軍の山札の全部が見えていた（選べるカードがないときも）", async () => {
    const hidden: string[] = [];
    const shown = new Set<string>();
    for (const [i, d] of targets.entries()) {
      if (i % 5 === 0) await new Promise((resolve) => setImmediate(resolve));
      for (const [deckName, tweak] of DECKS) {
        for (const [where, o] of runs(d.id, tweak)) {
          if (!o.start || !o.state) continue;
          if ((o.wholeDeckShown ?? []).length > 0) shown.add(d.id);
          for (const p of ["player1", "player2"] as const) {
            if (deckKey(o.start, p) === deckKey(o.state, p)) continue;
            if ((OTHER_DECK_CHANGES[d.id] ?? []).includes(p)) continue;
            if (!(o.wholeDeckShown ?? []).includes(p)) hidden.push(`${d.id} ${d.name} (${where}, ${deckName}) ${p}`);
          }
        }
      }
    }
    expect(hidden).toEqual([]);
    // 選べるカードがないときに窓を開くようにしたカード（2026-10-31）は、どれかの盤面で山札の全部を見せている。
    expect([...shown]).toEqual(
      expect.arrayContaining([
        "XG1-076", "XG3-068", "XG5-094", "XG6-061", "XG7-009", "XG7-045", "XP-015", "XP-032", "XG2-087", "SX-009",
        "RK-146", "RK-190", "RK-319", "RK-326", "RK-327", "RK-328", "RM-016",
        "RS-186", "RS-201", "RS-249", "RS-251", "RS-605", "RS-612", "SM-001",
      ]),
    );
  }, 300_000);
});
