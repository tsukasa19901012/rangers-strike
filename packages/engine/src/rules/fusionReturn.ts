import { markRushedThisTurn } from "./turnModifiers";
import {
  fusionPartnerReturnCount,
  isFusionUnit,
  listZordFusionPartnerIds,
  requiresFusionPartnerReturn,
} from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { removeAt, updatePlayer } from "../core/helpers";
import { clearCostWindow } from "../core/costWindow";
import {
  autoHoldForBattleEntry,
  canMoveUnitToBattle,
} from "./restrictions";

export type FusionReturnDestination = "battle" | "hand";

function findNextFusionMaterialIndex(
  discard: CardInstance[],
  destroyedCardId: string,
  usedInstanceIds: Set<string>,
): number {
  const partners = listZordFusionPartnerIds(destroyedCardId);
  if (partners.length > 0) {
    for (const partnerId of partners) {
      const index = discard.findIndex(
        (card) => card.cardId === partnerId && !usedInstanceIds.has(card.instanceId),
      );
      if (index >= 0) return index;
    }
    return -1;
  }
  return discard.findIndex(
    (card) => isFusionUnit(card.cardId) && !usedInstanceIds.has(card.instanceId),
  );
}

/** 合体ゾードがフィールドを離れた後、捨札から合体パートナーを戻す。 */
export function returnFusionPartnersFromDiscard(
  state: GameState,
  ownerId: PlayerId,
  destroyedCardId: string,
  destination: FusionReturnDestination,
): GameState {
  if (!requiresFusionPartnerReturn(destroyedCardId)) {
    return state;
  }

  let owner = state.players[ownerId];
  let discard = [...owner.discard];
  let battle = [...owner.battle];
  let hand = [...owner.hand];
  const quota = fusionPartnerReturnCount(destroyedCardId);
  const used = new Set<string>();
  let returned = 0;

  while (returned < quota) {
    const index = findNextFusionMaterialIndex(discard, destroyedCardId, used);
    if (index < 0) break;

    const [card, rest] = removeAt(discard, index);
    discard = rest;
    used.add(card.instanceId);

    if (destination === "hand") {
      hand = [...hand, card];
      returned += 1;
      continue;
    }

    // ルール: R-ADD-07 — 効果で出す合体素材も1体ごとに「ホールドしなければ出られない」制限を満たす
    // （RS-009 Q3）。ホールドできなくなったら残りは捨札のまま。
    const current = { ...owner, discard, battle, hand };
    const beforeHold = { ...state, ...updatePlayer(state, ownerId, current) };
    const prepared = autoHoldForBattleEntry(beforeHold, ownerId, card);
    if (!prepared) {
      discard = [...discard, card];
      break;
    }
    owner = prepared;
    const withPrepared = { ...state, ...updatePlayer(state, ownerId, owner) };
    if (!canMoveUnitToBattle(withPrepared, ownerId, card, "rush")) {
      discard = [...discard, card];
      break;
    }
    battle = [...battle, { ...card, battleActed: false }];
    // ルール: R-RUSH-02 — 捨札からバトルエリアに直接出た合体素材も「ラッシュされた」扱い（RS-009 Q2）。
    owner = markRushedThisTurn(clearCostWindow(owner, "battle_entry_hold"), card.instanceId);
    returned += 1;
  }

  return {
    ...state,
    ...updatePlayer(state, ownerId, { ...owner, discard, battle, hand }),
  };
}
