import type { Category } from "@rangers-strike/cards";
import { set9AGrantsCallLead } from "./legend1/set9NamedEffectsA";
import { adventGrantsCall } from "./rk/rk249Advent";
import { xg1GrantsCallLead } from "./xg1/xg1Fields";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { cardHasGrantKeyword } from "../dsl/promotedKeywordBridge";
import { effectiveCommandCategories, getDefinition, isUnit } from "../core/catalog";
import { actionContextState } from "./zordFeatureContext";

export type CallLeadKind = "call" | "lead";

const CALL_LEAD_KEYWORD = /^(call|lead)_(MA|ET|DA|WB|OT)$/;

export function parseCallLeadKeyword(
  keyword: string,
): { kind: CallLeadKind; category: Category } | null {
  const match = keyword.match(CALL_LEAD_KEYWORD);
  if (!match) return null;
  return { kind: match[1] as CallLeadKind, category: match[2] as Category };
}

/** owner はユニットの持ち主（渡せば、その常駐置き場の常駐で得た能力も見る）。 */
export function unitHasCallLeadKeyword(
  cardId: string,
  kind: CallLeadKind,
  category: Category,
  owner?: Pick<PlayerState, "operation">,
): boolean {
  return cardHasGrantKeyword(cardId, `${kind}_${category}`) || (!!owner && residentGrantsCallLead(owner, cardId, kind, category));
}

/**
 * 「※常駐 MAを持つSPが空欄のSユニットは、次の能力を得る⇒コールET（…）」（RS-516 アースフォース。atwiki/page-1149）。
 * 得るのは常駐させたプレイヤー（自軍）のユニットだけ（ユーザー決定 2026-10-19「自軍だけ」。docs/rules/README.md §5.7 n。
 * atwiki/page-1149 コメント「敵軍にも適用されます」は採らない）。見るのはユニットの持ち主 owner の常駐置き場。
 * 定義は applyAction / getLegalActions の入口で置いた状態（rules/zordFeatureContext.ts）から読む。
 */
const RESIDENT_CALL_LEAD_GRANT_RE =
  /^※常駐\s*「?(WB|OT|ET|MA|DA)」?を持つSPが空欄のSユニットは、次の能力を得る⇒(コール|リード)「?(WB|OT|ET|MA|DA)」?/;

const residentCallLeadGrantCache = new Map<string, RegExpMatchArray | null>();

/** 常駐オペレーションの本文の RESIDENT_CALL_LEAD_GRANT_RE の一致（本文ごとに覚える。合法手の判定のたびに引かれる）。 */
function residentCallLeadGrantMatch(text: string | undefined): RegExpMatchArray | null | undefined {
  if (text === undefined) return undefined;
  let m = residentCallLeadGrantCache.get(text);
  if (m === undefined) {
    m = text.match(RESIDENT_CALL_LEAD_GRANT_RE);
    residentCallLeadGrantCache.set(text, m);
  }
  return m;
}

function residentGrantsCallLead(owner: Pick<PlayerState, "operation">, cardId: string, kind: CallLeadKind, category: Category): boolean {
  if (owner.operation.length === 0) return false;
  const state = actionContextState();
  if (!state) return false;
  const def = getDefinition(state.definitions, cardId);
  if (!def || def.type !== "unit" || def.size !== "S" || (def.sp !== undefined && def.sp !== null)) return false;
  const cats: string[] = Array.isArray(def.category) ? def.category : [def.category as string];
  for (const op of owner.operation) {
    const m = residentCallLeadGrantMatch(getDefinition(state.definitions, op.cardId)?.text);
    if (!m) continue;
    if ((m[2] === "コール" ? "call" : "lead") !== kind || m[3] !== category) continue;
    if (cats.includes(m[1]!)) return true;
  }
  return false;
}

/** 場のユニットがコール／リードを持つか（カード自身の能力・効果で得た能力）。 */
function fieldUnitHasCallLead(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  card: CardInstance,
  kind: CallLeadKind,
  category: Category,
): boolean {
  return (
    unitHasCallLeadKeyword(card.cardId, kind, category, player) ||
    set9AGrantsCallLead(player, definitions, card, kind, category) ||
    // RK-249 アドベント「このターン、選んだユニットは次の能力を得る⇒※コールWB」（rules/rk/rk249Advent.ts）。
    adventGrantsCall(player, card, kind, category) ||
    // XG1-015 宇宙警察（OT の「警察」の S ユニットはコールOT。rules/xg1/xg1Fields.ts）。
    xg1GrantsCallLead(player, definitions, card.cardId, kind, category)
  );
}

function fieldZonesForCallLead(kind: CallLeadKind): Array<"rush" | "battle"> {
  return kind === "call" ? ["rush", "battle"] : ["rush", "battle"];
}

export function collectCallLeadFieldUnits(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  kind: CallLeadKind,
  categories: Category[],
): CardInstance[] {
  const results: CardInstance[] = [];
  for (const zone of fieldZonesForCallLead(kind)) {
    for (const card of player[zone]) {
      if (card.commandHeld || card.mothershipHold) continue;
      const def = getDefinition(definitions, card.cardId);
      if (def && !isUnit(def)) continue;
      const matches = categories.some(
        (cat) => fieldUnitHasCallLead(player, definitions, card, kind, cat),
      );
      if (matches) results.push(card);
    }
  }
  return results;
}

export function heldCallLeadMatchesCategories(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  kind: CallLeadKind,
  categories: Category[],
): boolean {
  for (const zone of fieldZonesForCallLead(kind)) {
    for (const card of player[zone]) {
      if (!card.commandHeld || card.mothershipHold) continue;
      const def = getDefinition(definitions, card.cardId);
      if (def && !isUnit(def)) continue;
      if (
        categories.some(
          (cat) => fieldUnitHasCallLead(player, definitions, card, kind, cat),
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

export function holdPaymentSource(
  player: PlayerState,
  instanceId: string,
): PlayerState {
  const commandIndex = player.command.findIndex((c) => c.instanceId === instanceId);
  if (commandIndex >= 0) {
    const command = [...player.command];
    command[commandIndex] = {
      ...command[commandIndex]!,
      commandHeld: true,
      mothershipHold: false,
      // ルール: R-CMD-01 — 支払いに使ったホールドは消費済み（別の使用に再利用できない）。
      paymentHeld: true,
    };
    return { ...player, command };
  }

  for (const zone of ["rush", "battle"] as const) {
    const index = player[zone].findIndex((c) => c.instanceId === instanceId);
    if (index >= 0) {
      const cards = [...player[zone]];
      cards[index] = { ...cards[index]!, commandHeld: true, mothershipHold: false };
      return { ...player, [zone]: cards };
    }
  }

  return player;
}

export function playerHasHeldLead(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  categories?: Category[],
): boolean {
  const cats = categories ?? (["MA", "ET", "DA", "WB", "OT"] as Category[]);
  return heldCallLeadMatchesCategories(player, definitions, "lead", cats);
}

/** 自軍 rush/battle にリード持ちユニットがいるか（※…リードXX…無効 判定用）。 */
export function playerHasAllyWithLeadOnField(
  state: { players: Record<PlayerId, PlayerState>; definitions: Record<string, CardDefinition> },
  playerId: PlayerId,
  categories?: Category[],
): boolean {
  const player = state.players[playerId];
  const cats = categories ?? (["MA", "ET", "DA", "WB", "OT"] as Category[]);
  for (const zone of ["rush", "battle"] as const) {
    for (const card of player[zone]) {
      if (cats.some((cat) => unitHasCallLeadKeyword(card.cardId, "lead", cat, player))) {
        return true;
      }
    }
  }
  return false;
}

export function paymentSourceMatchesCategories(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  instanceId: string,
  categories: Category[],
  kind: CallLeadKind,
): boolean {
  const cmd = player.command.find((c) => c.instanceId === instanceId);
  if (cmd) {
    const cmdCats = effectiveCommandCategories(player, definitions, cmd.cardId);
    return categories.some((cat) => cmdCats.includes(cat));
  }

  for (const zone of fieldZonesForCallLead(kind)) {
    const card = player[zone].find((c) => c.instanceId === instanceId);
    if (!card) continue;
    return categories.some(
      (cat) => fieldUnitHasCallLead(player, definitions, card, kind, cat),
    );
  }

  return false;
}
