/**
 * カード保存則の不変条件: ゲーム中、各プレイヤーのカード総数（山札＋手札＋捨札＋パワー＋コマンド＋ラッシュ＋
 * バトル＋常駐置き場＋除外。重ねたカードを含む）は変わらない。どのカードもゾーンにちょうど 1 枚ずつ存在する
 * （効果の解決途中で保留中の処理が保持しているカードだけは一時的にゾーン外でもよい）。
 *
 * 使ったオペレーションの解決が選択待ちで中断したとき、使ったカードがどのゾーンにも置かれずに消える不具合
 * （RS-349 スーパー戦隊アドレスブック・BK-015/017/019・RK-018・RK-079・RS-250・RS-606 等）と、
 * 重ねたカードのある常駐オペレーションが捨札になるとき重ねたカードが二重になる不具合の回帰テスト。
 */
import { describe, expect, it } from "vitest";
import { fullPlayableCatalog, type CardDefinition } from "@rangers-strike/cards";
import { applyAction } from "../core/applyAction";
import {
  captureCardBaseline,
  findCardConservationViolations,
  totalCardCount,
  type CardConservationBaseline,
} from "../core/cardConservation";
import { createGame } from "../core/createGame";
import { getLegalActions } from "../core/legalActions";
import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import { createFullPromotedGame } from "./createPromotedGame";
import { createStarterGame } from "./createStarterGame";
import { playStarterMatchUntilEnd } from "./playStarterMatch";

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

const POOL = fullPlayableCatalog.cards.filter(
  (c) => c.type === "unit" || c.type === "operation" || c.type === "vehicle",
);

/** 全カードプールから、オペレーション多めの同名 1 枚 40 枚デッキを作る。 */
function randomDeck(rng: () => number, mustInclude: CardDefinition[] = []): CardDefinition[] {
  const pool = shuffled(POOL, rng);
  const ops = pool.filter((c) => c.type === "operation").slice(0, 16);
  const picks: CardDefinition[] = [];
  const names = new Set<string>();
  for (const card of [...mustInclude, ...ops, ...pool]) {
    if (picks.length >= 40) break;
    if (names.has(card.name)) continue;
    names.add(card.name);
    picks.push(card);
  }
  return picks;
}

function assertConserved(
  baseline: CardConservationBaseline,
  state: GameState,
  context: string,
): void {
  const violations = findCardConservationViolations(baseline, state);
  if (violations.length > 0) {
    throw new Error(
      `card conservation violated (${context}): ${JSON.stringify(violations)}\n${state.log.slice(-8).join("\n")}`,
    );
  }
  // 保留中の処理がなく、解決中のオペレーションもなければ、ゾーンのカード総数は最初と同じ。
  const settled =
    !state.resolvingOperations?.length &&
    !Object.entries(state).some(([key, value]) => key.startsWith("pending") && value);
  if (settled) {
    const totals = totalCardCount(state);
    for (const pid of ["player1", "player2"] as const) {
      if (totals[pid] !== baseline[pid].length) {
        throw new Error(
          `card total changed for ${pid} (${context}): ${baseline[pid].length} -> ${totals[pid]}`,
        );
      }
    }
  }
}

/** ランダムに合法手を選んで進め、毎手カード保存則を確かめる。prefer が返す手を優先する。 */
function randomPlayout(
  initial: GameState,
  rng: () => number,
  options: {
    maxSteps: number;
    prefer?: (a: GameAction, s: GameState) => boolean;
    avoid?: (a: GameAction) => boolean;
    stop?: (s: GameState) => boolean;
  },
): GameState {
  const baseline = captureCardBaseline(initial);
  let state = initial;
  assertConserved(baseline, state, "initial");
  for (let step = 0; step < options.maxSteps && !state.winner; step += 1) {
    if (options.stop?.(state)) break;
    const actions = shuffled(getLegalActions(state), rng).filter((a) => !options.avoid?.(a));
    const ordered = [
      ...actions.filter((a) => options.prefer?.(a, state)),
      ...actions.filter((a) => !options.prefer?.(a, state) && a.type !== "end_phase"),
      ...actions.filter((a) => !options.prefer?.(a, state) && a.type === "end_phase"),
    ];
    let next: GameState | undefined;
    for (const action of ordered) {
      const result = applyAction(state, action);
      if (result.ok) {
        next = result.state;
        assertConserved(baseline, next, `step ${step} ${JSON.stringify(action)}`);
        break;
      }
    }
    if (!next) break;
    state = next;
  }
  return state;
}

describe("card conservation invariant", () => {
  it("CPU vs CPU simulations never create or lose cards", () => {
    const games: Array<() => GameState> = [
      () => createFullPromotedGame({ rng: mulberry32(11), firstPlayer: "player1" }),
      () => createFullPromotedGame({ rng: mulberry32(12), firstPlayer: "player2" }),
      () => createStarterGame({ rng: mulberry32(13) }),
    ];
    for (const make of games) {
      const initial = make();
      const baseline = captureCardBaseline(initial);
      let checked = 0;
      const result = playStarterMatchUntilEnd(initial, {
        maxSteps: 3_000,
        onState: (state) => {
          assertConserved(baseline, state, `cpu step ${checked}`);
          checked += 1;
        },
      });
      assertConserved(baseline, result.state, "cpu final");
      expect(checked).toBeGreaterThan(20);
    }
  }, 600_000);

  it("random play with the full card pool never creates or loses cards", () => {
    for (let seed = 1; seed <= 120; seed += 1) {
      const rng = mulberry32(seed);
      const initial = createGame({
        player1Deck: randomDeck(rng),
        player2Deck: randomDeck(rng),
        rng,
        firstPlayer: seed % 2 === 0 ? "player2" : "player1",
      });
      randomPlayout(initial, rng, { maxSteps: 1_200 });
    }
  }, 600_000);

  /**
   * 選択を開くオペレーションを使い、解決が終わると捨札（常駐なら常駐置き場）にあること。
   * 選択の途中でもカードは保留中の処理（resolvingOperations 等）に保持されていて消えない。
   */
  const PAUSING_OPERATIONS = [
    "RS-349", // スーパー戦隊アドレスブック（address_book_search）
    "BK-015", // ブレイバックル（効果の選択）
    "BK-017", // カブトゼクター
    "BK-019", // キバットベルト
    "RK-018", // ラウズカード
    "RK-079", // 仮面ライダーの称号
    "RS-250", // ジャッジメント
    "RS-606", // 雷鳴剣ヒカリマル
    "RS-185", // カーナビック
    "RS-186", // プロバイダーベース
  ];

  for (const cardId of PAUSING_OPERATIONS) {
    it(`${cardId}: the used operation ends in discard / operation zone after its choice resolves`, () => {
      const card = POOL.find((c) => c.id === cardId);
      expect(card, `${cardId} is playable`).toBeDefined();
      let played = false;
      for (let seed = 1; seed <= 60 && !played; seed += 1) {
        const rng = mulberry32(seed * 7919);
        let initial = createGame({
          player1Deck: randomDeck(rng, [card!]),
          player2Deck: randomDeck(rng),
          rng,
          firstPlayer: "player1",
        });
        // 対象のカードを最初の手札に入れる。
        const p1 = initial.players.player1;
        const deckIndex = p1.deck.findIndex((c) => c.cardId === cardId);
        if (deckIndex >= 0) {
          const deck = [...p1.deck];
          const hand = [...p1.hand];
          const [target] = deck.splice(deckIndex, 1);
          const [swapped] = hand.splice(0, 1, target!);
          deck.push(swapped!);
          initial = { ...initial, players: { ...initial.players, player1: { ...p1, deck, hand } } };
        }
        const instanceId = initial.players.player1.hand.find((c) => c.cardId === cardId)!.instanceId;
        let usedAt = -1;
        let steps = 0;
        const final = randomPlayout(initial, rng, {
          maxSteps: 800,
          prefer: (a, s) =>
            (a.type === "play_operation" && a.instanceId === instanceId) ||
            (a.type === "play_counter" && a.instanceId === instanceId) ||
            (a.type === "resolve_command_payment" && s.pendingCommandPayment?.sourceInstanceId === instanceId),
          // 使う前にチャージで手放さない。
          avoid: (a) =>
            (a.type === "charge_power" || a.type === "charge_command") &&
            "instanceId" in a &&
            a.instanceId === instanceId,
          stop: (s) => {
            steps += 1;
            if (
              usedAt < 0 &&
              s.log.some((line) => line.startsWith(`player1|play_operation|${cardId}|`) || line.startsWith(`player1|play_counter|${cardId}|`))
            ) {
              usedAt = steps;
            }
            // 使ってから解決が終わるまで進める。
            return (
              usedAt >= 0 &&
              !s.resolvingOperations?.length &&
              !s.pendingEffectChoice &&
              !s.pendingCommandPayment
            );
          },
        });
        if (usedAt < 0 || final.winner) continue;
        played = true;
        const zones: Array<[PlayerId, keyof GameState["players"]["player1"]]> = [];
        for (const pid of ["player1", "player2"] as const) {
          for (const zone of ["deck", "hand", "discard", "power", "command", "rush", "battle", "operation", "exile"] as const) {
            if ((final.players[pid][zone] ?? []).some((c) => c.instanceId === instanceId)) zones.push([pid, zone]);
            for (const c of final.players[pid][zone] ?? []) {
              if (c.stackedCards?.some((x) => x.instanceId === instanceId)) zones.push([pid, zone]);
            }
          }
        }
        expect(zones, `${cardId} must be in exactly one zone after resolution`).toHaveLength(1);
      }
      expect(played, `${cardId} was used in one of the seeded games`).toBe(true);
    }, 120_000);
  }
});
