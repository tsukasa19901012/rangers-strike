import type { CardDefinition } from "../schema";
import type { CardDocument } from "./types";
import { loadCardById } from "./loader";

/**
 * @deprecated U5 — `loadCardById(id, "core")` を使用。
 * generate-all-dsl / テスト互換の薄いラッパー。
 */
export function cardDefinitionToDocument(def: CardDefinition): CardDocument {
  return loadCardById(def.id, "core");
}
