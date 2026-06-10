import type { GameState, PlayerId } from "../types/game";

export type EffectDelegateContext = {
  playerId: PlayerId;
  phasePlayerId: PlayerId;
  sourceCardId: string;
  effectId: string;
  triggerSourceInstanceId?: string;
  operationInstanceId?: string;
  extraInstanceIds?: string[];
  leavingCardId?: string;
};

export type EffectDelegateResult = {
  state: GameState;
  detail?: string;
};

export type EffectDelegateResolver = (
  state: GameState,
  ctx: EffectDelegateContext,
  keyword: string,
) => EffectDelegateResult | null;

export const effectDelegateSlot: { resolver: EffectDelegateResolver | null } = {
  resolver: null,
};

export function setEffectDelegateResolver(resolver: EffectDelegateResolver): void {
  effectDelegateSlot.resolver = resolver;
}
