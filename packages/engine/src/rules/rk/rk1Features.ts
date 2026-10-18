/**
 * RK-001 改造人間（※常駐）・RK-013 Jパワー による特徴とサイズの変更（rules/addedFeatures.ts 等の低い層から使う小さなモジュール）。
 * カードの効果そのものは rules/rk/rk1NamedEffects.ts。
 */
import { isRm1StackedUnderUnitOperation } from "../rm/rm1Fields";
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import { getDefinition } from "../../core/catalog";
import { rk12ResidentsNegated } from "./rk12Fields";

export const J_POWER_CARD_ID = "RK-013";
/** RK-079 仮面ライダーの称号（J パワーと同じくユニットの下に重ねる。rules/rk/rk4UnitEffects.ts）。 */
export const KAMEN_TITLE_CARD_ID = "RK-079";

/** 仮面ライダーの称号を重ねたユニットか（ナンバーが RC になり、特徴「仮面ライダー」が追加される）。 */
export function hasKamenRiderTitle(instance: Pick<CardInstance, "stackedCards"> | undefined): boolean {
  return (instance?.stackedCards ?? []).some((c) => isSameCardIdentity(c.cardId, KAMEN_TITLE_CARD_ID));
}

/** ユニットでなくなったら捨札になる、ユニットの下に重ねたオペレーション（J パワー・仮面ライダーの称号・イマジンとの契約）。 */
export function isStackedUnderUnitOperation(cardId: string): boolean {
  // RK-088 イマジンとの契約も同じ（atwiki/page-710「重ねたユニットがユニットでなくなるとき、このカードは捨札になる」）。
  // RK-173 鬼の鎧も同じ（atwiki/page-907「重ねたユニットがユニットでなくなるとき、このカードは捨札になる」）。
  // RK-250 サバイブも、留まらずに場を離れたら捨札になる（その場に留まる置換は rules/rk/rk12UnitEffects.ts）。
  return (
    cardId === J_POWER_CARD_ID ||
    isSameCardIdentity(cardId, KAMEN_TITLE_CARD_ID) ||
    isSameCardIdentity(cardId, "RK-088") ||
    isSameCardIdentity(cardId, "RK-173") ||
    isSameCardIdentity(cardId, "RK-250") ||
    // RM-009 マルチパック・RM-011 ターボユニット-W も同じ（atwiki/page-830・page-882。rules/rm/rm1Fields.ts）。
    isRm1StackedUnderUnitOperation(cardId)
  );
}
const GIANT_BOMB_CARD_ID = "RS-255";

function isUnitCard(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return getDefinition(state.definitions, cardId)?.type === "unit";
}

function hasResident(state: Pick<GameState, "players">, playerId: PlayerId, cardId: string): boolean {
  // RK-248 パラダイス・ロストで、このターン無効になった常駐（rules/rk/rk12Fields.ts）。
  if (rk12ResidentsNegated(state, playerId)) return false;
  return state.players[playerId].operation.some((c) => c.cardId === cardId);
}

function hasGiantBomb(instance: Pick<CardInstance, "stackedCards">): boolean {
  return (instance.stackedCards ?? []).some((c) => c.cardId === GIANT_BOMB_CARD_ID);
}

/** J パワーを重ねたユニットか（J パワーはユニットの下に重ねる。grnrngr/faq-rider-2 RK-088 Q）。 */
export function hasJPower(instance: Pick<CardInstance, "stackedCards">): boolean {
  return (instance.stackedCards ?? []).some((c) => c.cardId === J_POWER_CARD_ID);
}

/** 「その特徴に「改造人間」を追加する」（RK-001）— 持ち主が改造人間を常駐させていて、「男」か「女」を持つユニットカード。 */
function kaizoNingenAdds(state: Pick<GameState, "players" | "definitions">, ownerId: PlayerId, cardId: string, features: string[]): boolean {
  if (!hasResident(state, ownerId, "RK-001")) return false;
  if (!isUnitCard(state, cardId)) return false;
  return features.includes("男") || features.includes("女");
}

/**
 * 場のユニットに追加される特徴（rules/addedFeatures.ts の unitFeatures から呼ぶ）。追加は既存の特徴の後ろ
 * （grnrngr/faq-rider-1 RK-013 Q7「追加される特徴は、既存の特徴の後ろに順番に追加されていきます」）。
 */
export function rk1AddedUnitFeatures(
  state: Pick<GameState, "players" | "definitions">,
  ownerId: PlayerId,
  instance: Pick<CardInstance, "cardId" | "instanceId">,
  base: string[],
): string[] {
  const extra: string[] = [];
  if (kaizoNingenAdds(state, ownerId, instance.cardId, base)) extra.push("改造人間");
  // J パワーは場のユニットの下にだけある（場を離れたら捨札になる）。渡されたカードの重ねたカードを見る。
  if (hasJPower(instance as CardInstance)) extra.push("人型");
  // RK-079 仮面ライダーの称号「特徴「仮面ライダー」が追加される」（atwiki/page-661）。
  if (hasKamenRiderTitle(instance as CardInstance)) extra.push("仮面ライダー");
  return extra;
}

/** 場以外（山札・手札・パワー・コマンド・捨札）のユニットカードの特徴（RK-001 の追加を含む）。 */
export function rk1ZoneCardFeatures(state: Pick<GameState, "players" | "definitions">, ownerId: PlayerId, cardId: string): string[] {
  const base = getDefinition(state.definitions, cardId)?.features ?? [];
  return kaizoNingenAdds(state, ownerId, cardId, base) && !base.includes("改造人間") ? [...base, "改造人間"] : base;
}

/** いまのサイズが S か（J パワー・RS-255 巨大化爆弾を重ねたユニットは L）。 */
export function rk1IsSmallNow(state: Pick<GameState, "definitions">, instance: CardInstance): boolean {
  // RK-154【頭が高い！】で、このターン S ユニットになった M ユニット（rules/pendingChoices.ts）。
  if (instance.sizeOverride === "S") return true;
  if (getDefinition(state.definitions, instance.cardId)?.size !== "S") return false;
  return !hasJPower(instance) && !hasGiantBomb(instance);
}

