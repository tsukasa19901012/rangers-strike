import type { GameAction } from "@rangers-strike/engine";

/**
 * RS-586 巨神ゴードム【魔神に不足する物】: 捨札にする「戦闘員」のユニットの選び方ごとに分かれたラッシュの宣言
 * （rush / initiate_command_payment / begin_zord_setup の godomDiscardInstanceIds）。
 */
export type GodomRushVariant = Extract<
  GameAction,
  { type: "rush" } | { type: "initiate_command_payment" } | { type: "begin_zord_setup" }
>;

function sourceOf(action: GameAction): string | undefined {
  if (action.type === "rush") return action.instanceId;
  if (action.type === "initiate_command_payment" && action.kind === "category_use") return action.sourceInstanceId;
  if (action.type === "begin_zord_setup") return action.zordInstanceId;
  return undefined;
}

/** 手札のカード handInstanceId のラッシュで、ゴードムの選び方が分かれている宣言。 */
export function listGodomRushVariants(legalActions: GameAction[], handInstanceId: string): GodomRushVariant[] {
  return legalActions.filter(
    (a): a is GodomRushVariant =>
      sourceOf(a) === handInstanceId &&
      (a.type === "rush" || a.type === "initiate_command_payment" || a.type === "begin_zord_setup") &&
      a.godomDiscardInstanceIds !== undefined,
  );
}

const key = (ids: readonly string[]) => [...ids].sort().join(",");

/** 選び方を尋ねる必要があるか（捨札にする組が2通り以上、またはゴードムを使わない選択もある）。 */
export function godomChoiceNeeded(variants: GodomRushVariant[]): boolean {
  return new Set(variants.map((v) => key(v.godomDiscardInstanceIds ?? []))).size > 1;
}

/** 捨札にする「戦闘員」の候補と、捨札にする数。 */
export function godomDiscardCandidates(variants: GodomRushVariant[]): { candidateIds: string[]; needed: number } {
  const using = variants.filter((v) => (v.godomDiscardInstanceIds?.length ?? 0) > 0);
  return {
    candidateIds: [...new Set(using.flatMap((v) => v.godomDiscardInstanceIds ?? []))],
    needed: using[0]?.godomDiscardInstanceIds?.length ?? 0,
  };
}

/** 選んだユニットの組に対応する宣言（[] はゴードムを使わない）。 */
export function matchGodomVariant(variants: GodomRushVariant[], selectedIds: readonly string[]): GodomRushVariant | undefined {
  const wanted = key(selectedIds);
  return variants.find((v) => key(v.godomDiscardInstanceIds ?? []) === wanted);
}
