import { registerDslListeners } from "../dsl/registry";
import { loadCardDslEffectsFromCatalog } from "../dsl/loadFromCards";
import { EventDispatcher } from "./EventDispatcher";
import { registerEngineEventListeners } from "./registerListeners";

let engineDispatcher: EventDispatcher | undefined;
let dslLoaded = false;

function ensureDslLoaded(): void {
  if (dslLoaded) return;
  loadCardDslEffectsFromCatalog();
  dslLoaded = true;
}

/** カード効果 Listener 登録済みの共有 Dispatcher。 */
export function getEngineEventDispatcher(): EventDispatcher {
  if (!engineDispatcher) {
    ensureDslLoaded();
    engineDispatcher = new EventDispatcher();
    registerEngineEventListeners(engineDispatcher);
    registerDslListeners(engineDispatcher);
  }
  return engineDispatcher;
}

/** テスト用: 共有 Dispatcher をリセットする。 */
export function resetEngineEventDispatcherForTests(): void {
  engineDispatcher = undefined;
  dslLoaded = false;
}
