/**
 * ジョイントコンビネーション（JC）で得た能力・発動した効果の記録と参照。
 *
 * 並びは「L ナンバーのカードが左、L ユニットが右」（L ユニットは L ナンバーのカードから
 * コンビネーションする）、「L ユニットが左、R ナンバーのカードが右」（R ナンバーのカードは L ユニットから
 * コンビネーションする）。コンビネーションは直前に出たユニット（左隣）との間に成立する（R-CN-05）。
 *
 * - L ナンバーのカードの「このユニットからコンビネーションする…Lユニットは、次の能力を得る⇒…」は、
 *   成立したとき L ユニットに能力として記録する（kind "l"）。一度得た能力は、L ナンバーのカードが
 *   場を離れても有効（R-CN-06、faq-card-3 RS-167 Q1）。
 * - R ナンバーのカードの「このコンビネーションが成立している間、…」は、発動したとき R ナンバーのカードに
 *   記録し（kind "r"）、記録した相手が左隣にいる間だけ有効（R-CN-06「一度でも隣り合わなくなれば無効」）。
 */
import { findNamedEffectByEffectId } from "@rangers-strike/cards";
import type { CardInstance, GameState, JointComboGrant, PlayerId } from "../types/game";
import { patchPlayer } from "./playerPatches";

export function addJointComboGrant(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  grant: JointComboGrant,
): GameState {
  return patchPlayer(state, playerId, (player) => ({
    ...player,
    battle: player.battle.map((c) => {
      if (c.instanceId !== instanceId) return c;
      const grants = c.jointComboGrants ?? [];
      return { ...c, jointComboGrants: [...grants, grant] };
    }),
  }));
}

/** L ナンバーのカードから得た能力の effectId（得た回数分。R-CONT-01 で重複する）。 */
export function jointLGrantEffectIds(card: Pick<CardInstance, "jointComboGrants">): string[] {
  return (card.jointComboGrants ?? []).filter((g) => g.kind === "l").map((g) => g.effectId);
}

export function countJointLGrant(card: Pick<CardInstance, "jointComboGrants">, effectId: string): number {
  return jointLGrantEffectIds(card).filter((id) => id === effectId).length;
}

/**
 * R ナンバーのカード rCard の「このコンビネーションが成立している間」の効果 effectId が有効か。
 * rCard がバトルエリアにあり、発動したときの相手（L ユニット）が今も左隣にいること。
 */
export function jointRGrantActive(
  state: GameState,
  playerId: PlayerId,
  rCard: CardInstance,
  effectId: string,
): boolean {
  const battle = state.players[playerId].battle;
  const index = battle.findIndex((c) => c.instanceId === rCard.instanceId);
  if (index <= 0) return false;
  const left = battle[index - 1]!;
  return (battle[index]!.jointComboGrants ?? []).some(
    (g) => g.kind === "r" && g.effectId === effectId && g.partnerInstanceId === left.instanceId,
  );
}

/** 得た能力「SP+N」（RS-224 トータスハンマー【ロックドバスター】等）の合計。 */
export function jointLGrantSpPlus(card: Pick<CardInstance, "jointComboGrants">): number {
  let total = 0;
  for (const grant of card.jointComboGrants ?? []) {
    if (grant.kind !== "l") continue;
    const text = findNamedEffectByEffectId(grant.sourceCardId, grant.effectId)?.text ?? "";
    const m = text.match(/次の能力を得る⇒「SP[+＋](\d+)」/);
    if (m) total += Number(m[1]);
  }
  return total;
}
