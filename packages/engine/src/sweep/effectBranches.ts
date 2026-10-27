/**
 * 効果の分岐の確認（effectsAllCards.test.ts の「分岐」）。そのカードの効果の最初の選択を候補ごとに選び分けて進め、
 * 分岐ごとに書かれた動きが起きるかを確かめる。
 *
 * - 「〜してもよい。そうしたとき…」: 見送ると何も動かない。行うと、その文と「そうしたとき」の後の文の動きが起きる。
 * - 「次の効果から1つ選び ◎A ◎B」: A・B それぞれの動きが、どれかの選び方で起きる。
 * - 「相手は A か B かを選ぶ」: 相手の選び方を分けて、A・B それぞれの動きがどれかで起きる。
 *
 * 条件や細かい数を含む文は確かめない（effectResult.ts の isCertain）。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { Branch, DriveResult } from "./effectBoard";
import { SELF_SUBJECT, abilityText, isCertain, movesBetween, seenVerbs, verbsOf } from "./effectResult";

/** 1 つの選択で分ける候補の上限（対象のユニットを選ぶ選択では候補が多い）。 */
const MAX_BRANCHES = 8;

export type BranchKind = "optional" | "modes" | "opponent";

/** 確かめる分岐。expect は「どれかの分岐で起きるはずの動詞」の組（1 組ずつ全部起きる）。 */
export type BranchPlan = {
  kind: BranchKind;
  actor: Branch["actor"];
  expect: string[][];
  skipMovesNothing: boolean;
  /** 「これを…」のように使ったカード自身を動かす文がある。 */
  selfMoves: boolean;
  text: string;
};

const MODE_UNCERTAIN = /「|なら|とき|まで|見て|オモテ|このターン|得る|ごとに|につき|宣言|可能な限り/;

const stripLead = (s: string) => s.replace(/^(そうしたとき|その後)、/, "");

/** 本文から確かめる分岐を読む（読めなければ null）。 */
export function branchPlan(card: CardDefinition, trigger?: RegExp): BranchPlan | null {
  const seg = abilityText(card, trigger);
  if (!seg) return null;
  const sentences = seg.split("。").map((x) => x.trim()).filter(Boolean);
  const first = sentences[0] ?? "";

  if (seg.includes("◎")) {
    // 「(コマンドゾーンに置けるカードは通常5枚まで)」「置けなければ」のように置き場所しだいのものは除く
    const clauses = seg
      .split("◎")
      .slice(1)
      .filter((c) => !/置けなければ|5枚まで/.test(c))
      .map((c) => (c.split("。")[0] ?? "").trim());
    // 選択肢の最初の文。名前を指定したカード（盤面に無いことが多い）・条件・能力の付与を含むものは確かめない
    const expect = clauses.filter((c) => !MODE_UNCERTAIN.test(c)).map(verbsOf).filter((v) => v.length > 0);
    return expect.length >= 1 ? { kind: "modes", actor: "player1", expect, skipMovesNothing: false, selfMoves: clauses.some((c) => SELF_SUBJECT.test(c)), text: seg } : null;
  }

  const opp = /相手は(.+?)かを選ぶ/.exec(first);
  if (opp) {
    const alternatives = opp[1]!.split(/か、/).map((a) => a.trim());
    if (alternatives.length < 2 || !alternatives.every(isCertain)) return null;
    const expect = alternatives.map(verbsOf);
    return expect.every((v) => v.length > 0) ? { kind: "opponent", actor: "player2", expect, skipMovesNothing: false, selfMoves: false, text: first } : null;
  }

  if (/してもよい$/.test(first)) {
    const head = first.replace(/してもよい$/, "する");
    if (!isCertain(head)) return null;
    // 見送ったら何も起きないと言えるのは、後ろの文がすべて「そうしたとき」で始まるときだけ
    const rest = sentences.slice(1);
    const allConsequent = rest.every((x) => /^そうし(た|て)/.test(x));
    const consequents = allConsequent ? rest.map(stripLead).filter(isCertain) : [];
    const expect = [[...new Set([...verbsOf(head), ...consequents.flatMap(verbsOf)])]];
    if (expect[0]!.length === 0) return null;
    return { kind: "optional", actor: "player1", expect, skipMovesNothing: allConsequent, selfMoves: SELF_SUBJECT.test(head), text: seg };
  }
  return null;
}

/** 分岐を全部試し、計画と合わないところを返す（空なら合っている）。分岐の選択が出なければ null。 */
export function checkBranches(plan: BranchPlan, run: (branch: Branch) => DriveResult): string[] | null {
  const results: DriveResult[] = [];
  const firstRun = run({ actor: plan.actor, index: 0 });
  if (firstRun.kind === "error") return [`error: ${firstRun.why}`];
  const n = firstRun.branches ?? 0;
  if (n === 0) return null;
  results.push(firstRun);
  // 候補が多いとき（対象のユニットを選ぶ等）は先頭と末尾から MAX_BRANCHES 個（「ダメージを受ける」等は末尾に来やすい）
  const half = MAX_BRANCHES / 2;
  const indices = n <= MAX_BRANCHES ? [...Array(n).keys()] : [...Array(half).keys(), ...Array.from({ length: half }, (_, k) => n - half + k)];
  for (const i of indices) {
    if (i === 0) continue;
    const r = run({ actor: plan.actor, index: i });
    if (r.kind === "error") return [`error (分岐 ${i}): ${r.why}`];
    results.push(r);
  }
  const problems: string[] = [];
  // 分けた選択が出た盤面から比べる（ラッシュの素材・支払いは比べない）。「これを…」は使ったカード自身も見る。
  const skip = (r: DriveResult) => (plan.selfMoves ? new Set<string>() : new Set([r.source!]));
  const seen = (r: DriveResult) => (r.state && r.branchState ? seenVerbs(r.branchState, r.state, skip(r)) : new Set<string>());
  const declines = results.filter((r) => r.picked && /^skip_|^pass_|decline/.test(r.picked.type));
  const takes = results.filter((r) => !declines.includes(r));
  if (plan.kind === "optional") {
    if (declines.length === 0) problems.push("見送りの選択肢がない");
    if (plan.skipMovesNothing) {
      for (const r of declines) {
        const moves = r.state && r.branchState ? movesBetween(r.branchState, r.state, new Set()) : [];
        if (moves.length > 0) problems.push(`見送ったのにカードが動いた（${moves.map((m) => m.id).join(", ")}）`);
      }
    }
  }
  for (const group of plan.expect) {
    if (!takes.some((r) => group.every((v) => seen(r).has(v)))) problems.push(`${group.join("・")}が起きる選び方がない`);
  }
  return problems;
}
