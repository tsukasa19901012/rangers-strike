export type {
  BattleDeclaredEvent,
  DamageAppliedEvent,
  EventListener,
  EventListenerRegistration,
  EventListenerResult,
  GameEvent,
  GameEventBase,
  GameEventType,
  StrikeDeclaredEvent,
  TurnEndingEvent,
  UnitEnteredBattleEvent,
  UnitLeftZoneEvent,
  UnitRushedEvent,
} from "./types";

export {
  createEventId,
  eventContextFromState,
  nextEventSeqNumber,
  normalizeListenerResult,
  resetEventSeqForTests,
} from "./types";

export { EventQueue } from "./EventQueue";

export {
  createDefaultEventDispatcher,
  EventDispatcher,
  resetListenerIdsForTests,
} from "./EventDispatcher";

export {
  EventResolver,
  resolveUntilBlocked,
  type ResolveUntilBlockedOptions,
  type ResolveUntilBlockedResult,
} from "./EventResolver";

export {
  resolutionStopReason,
  shouldStopEventResolution,
  type EventResolutionStopReason,
} from "./blocking";

export {
  buildBattleDeclaredEvent,
  buildDamageAppliedEvent,
  buildStrikeDeclaredEvent,
  buildTurnEndingEvent,
  buildUnitEnteredBattleEvent,
  buildUnitLeftZoneEvent,
  buildUnitRushedEvent,
  isGameEvent,
} from "./builders";

export { emitUnitRushedAndFinalize } from "./emitUnitRushed";
export { emitUnitEnteredBattleEffects } from "./emitUnitEnteredBattle";
export { emitBattleDeclaredAndResolve } from "./emitBattleDeclared";
export { emitStrikeDeclared } from "./emitStrikeDeclared";
export { emitUnitLeftZoneAndResolve } from "./emitUnitLeftZone";
export { emitDamageAppliedAndResolve } from "./emitDamageApplied";
export { emitTurnEndingAndResolve } from "./emitTurnEnding";

export {
  getEngineEventDispatcher,
  resetEngineEventDispatcherForTests,
} from "./globalDispatcher";

export { registerEngineEventListeners } from "./registerListeners";

export { unitRushedListener } from "./listeners/unitRushedListener";
export {
  registerEnterBattleEffectsImpl,
  resetEnterBattleEffectsImplForTests,
  unitEnteredBattleListener,
} from "./listeners/unitEnteredBattleListener";
export {
  battleDeclaredListener,
  registerBattlePendingResolver,
  resetBattlePendingResolverForTests,
} from "./listeners/battleDeclaredListener";
