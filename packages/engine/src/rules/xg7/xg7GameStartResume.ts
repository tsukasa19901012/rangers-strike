/**
 * XG7-059 トリガー・ドーパント【ゲームスタート……】の続きの登録先（rules/xg7/xg7cEffects.ts）。
 * 手札からのラッシュ以外で発動した「ラッシュしたとき」の効果（XG5-010 恐竜剣ゴッドホーンで発動したもの。atwiki/page-2277 Q2）は、
 * 【ゲームスタート……】を見送った（または無効にできなかった）ときに、その効果を発動した側の処理で続ける。
 * 循環 import を避けるため、このファイルは型以外を import しない。
 */
import type { GameState, PlayerId } from "../../types/game";

export type Xg7GameStartResume = (state: GameState, ownerId: PlayerId, instanceId: string, phasePlayerId: PlayerId) => GameState;

function resumes(): Record<string, Xg7GameStartResume> {
  const holder = resumes as unknown as { s?: Record<string, Xg7GameStartResume> };
  return (holder.s ??= {});
}

export function registerXg7GameStartResume(kind: string, fn: Xg7GameStartResume): void {
  resumes()[kind] = fn;
}

export function xg7GameStartResume(kind: string | undefined): Xg7GameStartResume | undefined {
  return kind ? resumes()[kind] : undefined;
}
