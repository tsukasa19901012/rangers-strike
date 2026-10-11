import type { RushAdditionalCondition } from "@rangers-strike/cards";
import { resolveRushAdditionalCondition } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { isSmallUnit } from "../core/catalog";
import { cardHasGrantKeyword } from "../dsl/promotedKeywordBridge";
import { cardHasKeyword } from "../keywords/cardKeywords";
import { playerHasAllyWithLeadOnField } from "./callLead";

const CONDITION_CHANGE =
  /※このカードの追加条件は、(.+?)のとき、次のように変更される(?:⇒|→)\s*(.+?)(?:。|\s*【)/;

function countDiscardUnitCardsMatching(
  player: GameState["players"][PlayerId],
  definitions: GameState["definitions"],
  predicate: (cardId: string) => boolean,
): number {
  return player.discard.filter((card) => {
    const def = definitions[card.cardId];
    return def?.type === "unit" && predicate(card.cardId);
  }).length;
}

function rushConditionGateMet(
  state: GameState,
  playerId: PlayerId,
  gateText: string,
): boolean {
  const player = state.players[playerId];

  const discardCountMatch = gateText.match(/自軍捨札が(\d+)枚以上/);
  if (discardCountMatch) {
    return player.discard.length >= Number(discardCountMatch[1]);
  }

  const leadSDiscardMatch = gateText.match(
    /自軍捨札にリードを持つSユニットのカードが(\d+)枚以上/,
  );
  if (leadSDiscardMatch) {
    const count = countDiscardUnitCardsMatching(player, state.definitions, (cardId) => {
      if (!isSmallUnit(state.definitions, cardId)) return false;
      for (const cat of ["MA", "ET", "OT", "WB", "DA"] as const) {
        if (cardHasGrantKeyword(cardId, `lead_${cat}`)) return true;
      }
      const def = state.definitions[cardId];
      return !!def?.text?.includes("リード");
    });
    return count >= Number(leadSDiscardMatch[1]);
  }

  const wingSDiscardMatch = gateText.match(
    /自軍捨札にウイングを持つSユニットのカードが(\d+)枚以上/,
  );
  if (wingSDiscardMatch) {
    const count = countDiscardUnitCardsMatching(player, state.definitions, (cardId) => {
      return (
        isSmallUnit(state.definitions, cardId) &&
        cardHasKeyword(state.definitions, cardId, "wing")
      );
    });
    return count >= Number(wingSDiscardMatch[1]);
  }

  return false;
}

function parseAlternateConditionText(text: string): RushAdditionalCondition | undefined {
  const holdMatch = text.match(/追加で自軍コマンドを(\d+)つホールド/);
  if (holdMatch) {
    return {
      conditionId: "hold_extra_command",
      text: holdMatch[0]!,
    };
  }

  // 「特徴「母艦」を持つ自軍ユニットを1体捨札にする」（RS-440 バトルフィーバーロボ（2nd）atwiki/page-780）。
  const featureDiscard = text.match(/^特徴「([^」]+)」を持つ自軍(S|M|L)?ユニットを(\d+)体捨札にする$/);
  if (featureDiscard) {
    return {
      conditionId: "discard_feature_unit",
      text,
      requiredFeature: featureDiscard[1],
      ...(featureDiscard[2] ? { requiredSize: featureDiscard[2] as "S" | "M" | "L" } : {}),
      unitCount: Number(featureDiscard[3]),
    };
  }

  const namedDiscard = text.match(/自軍「([^」]+)」1体を捨札に/);
  if (namedDiscard) {
    return {
      conditionId: "discard_named_unit",
      text,
      partnerName: namedDiscard[1],
    };
  }

  return undefined;
}

/** ゲーム状態に応じた実効ラッシュ追加条件（※追加条件変更 等）。 */
export function effectiveRushAdditionalCondition(
  state: Pick<GameState, "players" | "definitions">,
  playerId: PlayerId,
  cardId: string,
  definition?: CardDefinition,
): RushAdditionalCondition | undefined {
  const base = resolveRushAdditionalCondition(cardId, definition);
  const text = definition?.text ?? state.definitions[cardId]?.text ?? "";
  const changeMatch = text.match(CONDITION_CHANGE);
  if (!changeMatch || !base) return base;

  const gateText = changeMatch[1]!.trim();
  const overrideText = changeMatch[2]!.trim();
  if (!rushConditionGateMet(state as GameState, playerId, gateText)) return base;

  return parseAlternateConditionText(overrideText) ?? base;
}

type OverridableDefinition = CardDefinition & { rushAdditionalConditionOverride?: RushAdditionalCondition };

function hasConditionChangeText(text: string): boolean {
  return text.includes("このカードの追加条件は") && CONDITION_CHANGE.test(text);
}

/**
 * 「※このカードの追加条件は、…のとき、次のように変更される⇒…」を、評価中の定義に反映した state を返す
 * （core/legalActions.ts getLegalActions・core/applyAction.ts applyAction の入口で使い、結果の state には元の定義を戻す）。
 * 追加条件の判定・支払い（rules/zord.ts 等）は定義から追加条件を読むので、定義に変更後の追加条件
 * （rushAdditionalConditionOverride。@rangers-strike/cards resolveRushAdditionalCondition が優先する）を付ける。
 * 変更が必要なカードが手札になければ、同じ state をそのまま返す。
 */
export function withEffectiveRushConditionDefinitions(state: GameState): GameState {
  let patched: Record<string, CardDefinition> | null = null;
  // ターンプレイヤーの判定を優先する（同じカードを両プレイヤーが持つとき）。
  const order: PlayerId[] = state.activePlayer === "player1" ? ["player2", "player1"] : ["player1", "player2"];
  for (const pid of order) {
    for (const card of state.players[pid].hand) {
      const current = state.definitions[card.cardId] as OverridableDefinition | undefined;
      if (!current?.text || !hasConditionChangeText(current.text)) continue;
      const { rushAdditionalConditionOverride: previous, ...original } = current;
      const base = resolveRushAdditionalCondition(card.cardId, original as CardDefinition);
      const effective = effectiveRushAdditionalCondition(state, pid, card.cardId, original as CardDefinition);
      const desired = effective && JSON.stringify(effective) !== JSON.stringify(base) ? effective : undefined;
      if (JSON.stringify(desired) === JSON.stringify(previous)) continue;
      patched ??= { ...state.definitions };
      patched[card.cardId] = (desired
        ? { ...original, rushAdditionalConditionOverride: desired }
        : original) as CardDefinition;
    }
  }
  return patched ? { ...state, definitions: patched } : state;
}

export function effectiveBattleEntryHoldCount(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  rawHoldCount: number,
): number {
  if (rawHoldCount <= 0) return 0;

  const def = state.definitions[cardId];
  const text = def?.text ?? "";
  if (!text.includes("リード") || !text.includes("無効")) return rawHoldCount;
  if (!cardHasGrantKeyword(cardId, "require_command_hold_entry")) return rawHoldCount;

  const leadMatch = text.match(/リード(MA|ET|DA|WB|OT)を持つ自軍ユニットがあるとき無効/);
  const categories = leadMatch ? [leadMatch[1] as "MA" | "ET" | "DA" | "WB" | "OT"] : undefined;

  if (playerHasAllyWithLeadOnField(state, playerId, categories)) {
    return 0;
  }

  return rawHoldCount;
}
