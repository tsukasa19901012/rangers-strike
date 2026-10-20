import { markRushedThisTurn } from "./turnModifiers";
import {
  canonicalCardName,
  fusionMaterialAliasNames,
  fusionPartnerReturnCount,
  isFusionUnit,
  listZordFusionPartnerIds,
  requiresFusionPartnerReturn,
} from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { removeAt, updatePlayer } from "../core/helpers";
import { applySuperRadarOnRush } from "./legend3/rushEffects";
import {
  autoHoldForBattleEntry,
  clearEffectBattleEntryWindows,
  canMoveUnitToBattle,
} from "./restrictions";

export type FusionReturnDestination = "battle" | "hand";

type FusionSlot = { name: string; ids: string[] };

/** 合体―行の素材枠（同名別収録は1枠）。 */
function fusionSlots(state: GameState, destroyedCardId: string): FusionSlot[] {
  const slots: FusionSlot[] = [];
  for (const partnerId of listZordFusionPartnerIds(destroyedCardId)) {
    const name = canonicalCardName(state.definitions[partnerId]?.name ?? partnerId);
    const slot = slots.find((s) => s.name === name);
    if (slot) slot.ids.push(partnerId);
    else slots.push({ name, ids: [partnerId] });
  }
  return slots;
}

/**
 * 捨札のカードが埋める素材枠。合体元そのもの（カード番号・同名）なら1枠、
 * 「※これは「A＋B」としてつかえる」カード（例: XG6-018 アバレキラー）なら A と B の2枠。
 * ルール: atwiki/page-252 RS-009 Q1（アバレキラーを選んだ時点でトップゲイラーとステゴスライドンの両方を選んだとして扱う）
 */
const COMBINED_ALIAS_PATTERN = /これは「([^」]+[＋+][^」]+)」としてつかえる/;

/** 埋められる枠の組み合わせ（いずれか1つを使う）。 */
function slotCoveringsOf(state: GameState, card: CardInstance, slots: FusionSlot[]): number[][] {
  const def = state.definitions[card.cardId];
  const name = def ? canonicalCardName(def.name) : undefined;
  const exact = slots.findIndex((s) => s.ids.includes(card.cardId) || (name !== undefined && s.name === name));
  if (exact >= 0) return [[exact]];
  const combined = def?.text?.match(COMBINED_ALIAS_PATTERN)?.[1];
  if (combined) {
    const covered = combined
      .split(/[＋+]/)
      .map((part) => slots.findIndex((s) => s.name === canonicalCardName(part)));
    // 「A＋B」のすべてがこの合体の素材枠でなければ素材として使えない。
    return covered.every((i) => i >= 0) ? [covered] : [];
  }
  return fusionMaterialAliasNames(def?.text)
    .map((alias) => slots.findIndex((s) => s.name === alias))
    .filter((i) => i >= 0)
    .map((i) => [i]);
}

/** 戻す素材を枠が重ならないように選ぶ（同名・カード番号一致を優先し、「A＋B」カードは後）。 */
function pickFusionMaterials(state: GameState, discard: CardInstance[], destroyedCardId: string): CardInstance[] {
  const slots = fusionSlots(state, destroyedCardId);
  if (slots.length === 0) {
    const quota = fusionPartnerReturnCount(destroyedCardId);
    return discard.filter((card) => isFusionUnit(card.cardId)).slice(0, quota);
  }
  const filled = new Set<number>();
  const picked: CardInstance[] = [];
  const candidates = discard.map((card) => ({ card, coverings: slotCoveringsOf(state, card, slots) }));
  for (let slot = 0; slot < slots.length; slot += 1) {
    if (filled.has(slot)) continue;
    let best: { card: CardInstance; covered: number[] } | undefined;
    for (const c of candidates) {
      if (picked.includes(c.card)) continue;
      for (const covered of c.coverings) {
        if (!covered.includes(slot) || covered.some((i) => filled.has(i))) continue;
        if (!best || covered.length < best.covered.length) best = { card: c.card, covered };
      }
    }
    if (!best) continue;
    picked.push(best.card);
    for (const i of best.covered) filled.add(i);
  }
  return picked;
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
  const picks = pickFusionMaterials(state, discard, destroyedCardId);
  const placedInBattle: string[] = [];

  for (const pick of picks) {
    const index = discard.findIndex((c) => c.instanceId === pick.instanceId);
    if (index < 0) continue;

    const [card, rest] = removeAt(discard, index);
    discard = rest;

    if (destination === "hand") {
      hand = [...hand, card];
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
    owner = markRushedThisTurn(clearEffectBattleEntryWindows(owner), card.instanceId);
    placedInBattle.push(card.instanceId);
  }

  let next: GameState = {
    ...state,
    ...updatePlayer(state, ownerId, { ...owner, discard, battle, hand }),
  };
  // faq-card-3 RS-124 Q1 — 捨札からバトルエリアに出した S ユニット1体ごとに超電子レーダーを適用する。
  for (const instanceId of placedInBattle) {
    const radar = applySuperRadarOnRush(next, ownerId, instanceId, state.activePlayer);
    if (radar.state !== next) next = { ...radar.state, log: [...radar.state.log, ...radar.logs] };
  }
  return next;
}
