/**
 * 再録・プロモ（PR/PK/SK/SR/SX/XP 等）を、ID で分岐する実装（`switch (cardId)` や `cardId === "RS-..."`）に届かせる補助。
 * 同名・同文（または packages/cards/src/reprints.ts の PROMO_REPRINT_OF）の別 ID を、分岐に並んだ元カードの ID に読み替える。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";

/** cardId が ids のどれかと同じカードならその ID、どれとも違えば cardId のまま。 */
export function canonicalCardIdAmong(cardId: string, ids: readonly string[]): string {
  if (ids.includes(cardId)) return cardId;
  for (const id of ids) if (isSameCardIdentity(cardId, id)) return id;
  return cardId;
}
