import dslReadyIdsData from "./generated/dsl-ready-ids.json";

const DSL_READY = new Set(dslReadyIdsData.dslReady as string[]);
const UNIMPLEMENTED = new Set(dslReadyIdsData.unimplemented as string[]);

export function isCardDslReady(cardId: string): boolean {
  return DSL_READY.has(cardId);
}

export function isCardDslUnimplemented(cardId: string): boolean {
  return UNIMPLEMENTED.has(cardId);
}
