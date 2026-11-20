/**
 * 「山札の上から…を見る（オモテにする）」効果は、見た（オモテにした）カードを UI に見せてから進む。
 * ユーザー報告（2026-11-20）「山札の上を見る効果で、見たカードが何か確認できずに処理が進んでしまう」から、本文に
 * 「山札の上（から N 枚）を見る／オモテにする」があるカードを全部確かめる。
 *
 * 見せ方は 2 つ: 公開の記録（GameState.lastReveal。client-core の「オモテにしたカード」の窓。1 つの操作で 2 回以上公開しても
 * lastReveal.earlier に残る）か、そのカードの選択の候補・見ているカード（client-core view/board.ts viewedCardIds が出すもの）。
 * 見ること: 効果が山札の上のカードを使った（発動した）なら、効果の前の山札の上のカードのどれかが、そのどちらかで見えていたこと。
 * 盤面は effectBoard.ts（ラッシュしたとき・出たとき・オペレーション・起動効果）と、NC（cardSpec の ncBoard）。発動を選ぶ確認
 * （revealGate）は「発動する」を選ぶ。
 */
import { describe, expect, it } from "vitest";
import { applyAction } from "../core/applyAction";
import { getActionPlayerId, getLegalActions } from "../core/legalActions";
import { revealNotices } from "../rules/revealNotice";
import type { GameState, PlayerId } from "../types/game";
import { ncBoard } from "../cardSpec/XG7-001-023.helpers";
import { allFieldCards, allOperations, checkActivations, checkEnterBattle, checkOnRush, checkOperation, type DriveResult, type Probe } from "./effectBoard";

const TOP = /山札の(一番)?上(から\d+枚)?を見|その上から\d+枚をオモテ|山札の(一番)?上(から\d+枚)?をオモテ/;
const targets = [...allFieldCards, ...allOperations].filter((d) => TOP.test((d.text ?? "").normalize("NFKC")));

/** client-core view/board.ts の VIEWED_META_KEYS と同じ（選択の付加情報のうち、見ている山札のカード）。 */
const VIEWED_META_KEYS = new Set(["top", "topId", "topInstanceId", "revealedId", "revealedInstanceIds", "picked", "remainingIds", "target", "ids"]);

/** その盤面で開いているそのカードの選択が、UI で見せているカード（発動の確認の間は何も見せない）。 */
function choiceShows(s: GameState, cardId: string): string[] {
  const c = s.pendingEffectChoice;
  if (!c || c.sourceCardId !== cardId || c.revealGate) return [];
  const ids: unknown[] = [...c.validInstanceIds, ...(c.viewedInstanceIds ?? []), ...(c.deckLookInstanceIds ?? [])];
  for (const [k, v] of Object.entries(c)) {
    if (!k.endsWith("Meta") || !v || typeof v !== "object") continue;
    for (const [f, x] of Object.entries(v)) if (VIEWED_META_KEYS.has(f)) ids.push(...(Array.isArray(x) ? x : [x]));
  }
  return ids.filter((i): i is string => typeof i === "string");
}

/** 効果の前の、お互いの山札の上 5 枚。 */
const topsOf = (s: GameState) => new Set((["player1", "player2"] as PlayerId[]).flatMap((p) => s.players[p].deck.slice(0, 5).map((c) => c.instanceId)));
const deckKey = (s: GameState) => (["player1", "player2"] as PlayerId[]).map((p) => s.players[p].deck.map((c) => c.instanceId).join(",")).join("|");

type Run = { where: string; start: GameState; end: GameState; shown: Set<string> };

function noticesSince(start: GameState, end: GameState): string[] {
  const from = start.lastReveal?.seq ?? 0;
  return revealNotices(end).filter((n) => n.seq > from).flatMap((n) => n.cards.map((c) => c.instanceId));
}

/** effectBoard の盤面で使う（発動する／候補の最初を選ぶ）。 */
function boardRuns(cardId: string): Run[] {
  const d = targets.find((x) => x.id === cardId)!;
  const out: Run[] = [];
  const probe = (): Probe & { ids: Set<string> } => {
    const ids = new Set<string>();
    return { ids, see: (s) => choiceShows(s, cardId).forEach((i) => ids.add(i)) };
  };
  const push = (where: string, o: DriveResult, p: { ids: Set<string> }) => {
    if (!o.start || !o.state) return;
    noticesSince(o.start, o.state).forEach((i) => p.ids.add(i));
    out.push({ where, start: o.start, end: o.state, shown: p.ids });
  };
  if (d.type === "operation") {
    const p = probe();
    push("op", checkOperation(d, "first", undefined, undefined, p), p);
    return out;
  }
  const r = probe();
  push("rush", checkOnRush(d, "first", undefined, undefined, r), r);
  const e = probe();
  push("enter", checkEnterBattle(d, "first", undefined, undefined, e), e);
  const probes: Array<Probe & { ids: Set<string> }> = [];
  for (const a of checkActivations(d, "first", undefined, () => {
    const p = probe();
    probes.push(p);
    return p;
  })) {
    push(`act ${a.where}`, a.outcome, probes.shift()!);
  }
  return out;
}

/** NC（コンビネーション）: 前に 0〜5 体並べて、そのカードの選択が出た盤面から進める。 */
function ncRun(cardId: string): Run | null {
  for (let n = 0; n < 6; n++) {
    let s: GameState;
    try {
      s = ncBoard(`${cardId}:x`, n);
    } catch {
      continue;
    }
    if (s.pendingEffectChoice?.sourceCardId !== cardId) continue;
    const start = s;
    const shown = new Set<string>();
    for (let step = 0; step < 60; step++) {
      choiceShows(s, cardId).forEach((i) => shown.add(i));
      const actor = getActionPlayerId(s);
      const legal = getLegalActions(s).filter((a) => a.playerId === actor && !/cancel|end_phase|end_turn/.test(a.type));
      const pending = Object.entries(s).some(([k, v]) => k.startsWith("pending") && v != null && !(Array.isArray(v) && v.length === 0));
      if (!pending || legal.length === 0) break;
      const use = legal.filter((a) => !/^skip_|^pass_|decline/.test(a.type));
      const next = actor === "player1" ? (use[0] ?? legal[0])! : (legal.find((a) => /^skip_|^pass_|decline/.test(a.type)) ?? legal[0])!;
      const r = applyAction(s, next);
      if (!r.ok) break;
      s = r.state!;
    }
    noticesSince(start, s).forEach((i) => shown.add(i));
    return { where: `nc(${n})`, start, end: s, shown };
  }
  return null;
}

/** その盤面で効果が山札の上のカードを使ったか: 山札が動いたか、公開の記録が増えたか、そのカードの選択が山札のカードを見せたか。 */
function used(run: Run): boolean {
  if (deckKey(run.start) !== deckKey(run.end)) return true;
  if ((run.end.lastReveal?.seq ?? 0) > (run.start.lastReveal?.seq ?? 0)) return true;
  const tops = topsOf(run.start);
  return [...run.shown].some((i) => tops.has(i));
}

/**
 * 山札が動いても、山札の上を見る効果のせいではないもの（この盤面では山札の上を見る効果まで進まない）。
 * BK-002・RK-252・PK-013: 「次の効果から1つ選び発動する」の 1 つ目（山札から探す／手札から出す）を選ぶ。
 */
const OTHER_DECK_CHANGES = new Set(["BK-002", "RK-252", "PK-013"]);

describe("山札の上を見る（オモテにする）効果は、見たカードを見せてから進む", () => {
  it("対象のカードを読めている", () => {
    expect(targets.map((d) => d.id)).toEqual(
      expect.arrayContaining(["RS-596", "RS-641", "RS-665", "XG3-053", "XG3-071", "XG6-028", "RS-293", "BK-002", "XG6-008", "XG1-049", "XG6-044", "RS-071", "XG2-100"]),
    );
  });

  it("山札の上のカードを使った効果は、そのカードを公開の窓か選択の窓で見せている", async () => {
    const hidden: string[] = [];
    const checked = new Set<string>();
    for (const [i, d] of targets.entries()) {
      if (i % 5 === 0) await new Promise((resolve) => setImmediate(resolve));
      const runs = boardRuns(d.id);
      const nc = ncRun(d.id);
      if (nc) runs.push(nc);
      for (const run of runs) {
        if (!used(run)) continue;
        checked.add(d.id);
        const tops = topsOf(run.start);
        if ([...run.shown].some((id) => tops.has(id))) continue;
        if (OTHER_DECK_CHANGES.has(d.id)) continue;
        hidden.push(`${d.id} ${d.name} (${run.where})`);
      }
    }
    expect(hidden).toEqual([]);
    // 見せずに進んでいたカード（2026-11-20 に直した）は、どれかの盤面で効果まで進んでいる。アタック・バトル・RC・常駐から起きる効果
    // （XG1-045・XG3-097・XG1-049・XG1-094・XG2-049・XG6-044・XG2-048・RS-071・XG2-100）は、それぞれの cardSpec で確かめる。
    expect([...checked]).toEqual(expect.arrayContaining(["RS-596", "RS-641", "RS-665", "XG3-043", "XG3-053", "XG3-071", "XG6-028", "RS-293", "XG6-008", "BK-002"]));
  }, 300_000);
});
