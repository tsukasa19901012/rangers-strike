import type { EventDispatcher } from "./EventDispatcher";
import { battleDeclaredListener } from "./listeners/battleDeclaredListener";
import { damageAppliedListener } from "./listeners/damageAppliedListener";
import { strikeDeclaredListener } from "./listeners/strikeDeclaredListener";
import { turnEndingListener } from "./listeners/turnEndingListener";
import { unitEnteredBattleListener } from "./listeners/unitEnteredBattleListener";
import { unitLeftZoneListener } from "./listeners/unitLeftZoneListener";
import { unitRushedListener } from "./listeners/unitRushedListener";

/** エンジン標準の Event Listener を Dispatcher に登録する。 */
export function registerEngineEventListeners(dispatcher: EventDispatcher): void {
  dispatcher.on("UnitRushed", unitRushedListener);
  dispatcher.on("UnitEnteredBattle", unitEnteredBattleListener);
  dispatcher.on("BattleDeclared", battleDeclaredListener);
  dispatcher.on("StrikeDeclared", strikeDeclaredListener);
  dispatcher.on("UnitLeftZone", unitLeftZoneListener);
  dispatcher.on("DamageApplied", damageAppliedListener);
  dispatcher.on("TurnEnding", turnEndingListener);
}
