import type { GameAction } from "../types/actions";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { buildLogEntry } from "../log/formatLog";
import { recordReveal, revealedCards, revealNotices } from "./revealNotice";

/**
 * 「自軍山札から…を1枚選び、相手に見せてから手札に加える」: 山札から選んで手札に加えたカードを、両プレイヤーに公開する
 * （GameState.lastReveal。UI の公開ウィンドウ・対人戦の viewFor がこれで相手にも見せる）。
 *
 * 2026-11-21 報告: RK-146 デネブ【デネブキャンディー】で選んだオペレーションカードを相手に見せていなかった。
 * 同じ文言のカードも、選ぶ窓は選ぶ本人にしか見えず、手札に加えた時点で相手には何が加わったか分からなかった。
 * 選ぶ窓（効果ID）ごとに、その窓を答えたアクションの前後で「選ぶ本人の山札 → 手札」に移ったカードを公開として記録する。
 * カード自身の処理で公開を記録しているもの（XG7-009・XG7-045・XP-015 等）はここに載せない。
 */
export const DECK_SEARCH_REVEALS: Readonly<Record<string, { effectIds: readonly string[]; label: string }>> = {
  "BK-001": { effectIds: ["bk1_belt_search"], label: "タイフーン（1号）" },
  "BK-002": { effectIds: ["bk1_belt_search"], label: "ダブルタイフーン" },
  "BK-003": { effectIds: ["bk1_belt_search"], label: "ライドル" },
  "BK-005": { effectIds: ["bk1_belt_search"], label: "エレクトラー" },
  "BK-006": { effectIds: ["bk1_belt_search"], label: "トルネード" },
  "BK-007": { effectIds: ["bk1_belt_search"], label: "サイクロード" },
  "BK-008": { effectIds: ["bk1_belt_search"], label: "ゼクロスベルト" },
  "BK-014": { effectIds: ["bk1_belt_search"], label: "ファイズドライバー" },
  "RK-146": { effectIds: ["deneb_candy"], label: "デネブキャンディー" },
  "RK-156": { effectIds: ["rk156_denbird"], label: "デンライナー搭乗" },
  "RK-292": { effectIds: ["rk292_three_souls"], label: "三つの魂" },
  "RM-010": { effectIds: ["rm010_sol_indicator"], label: "ソルインジケーター" },
  "RS-178": { effectIds: ["sagas_sniper"], label: "サガスナイパー" },
  "RS-349": { effectIds: ["address_book_search"], label: "スーパー戦隊アドレスブック" },
  "RS-404": { effectIds: ["fx_unknown_e8bfbd"], label: "追跡" },
  "RS-439": { effectIds: ["rs439_all_purpose_battleship"], label: "万能戦艦" },
  "RS-525": { effectIds: ["rs525_partner_search"], label: "頼もしい相棒" },
  "RS-582": { effectIds: ["rs582_mee_megalo"], label: "メー・メガロ" },
  "XG3-098": { effectIds: ["xg3098_jishaku_change_pick"], label: "ジシャックチェンジ" },
  "XG5-094": { effectIds: ["xg5_094_search"], label: "ハカイダー部隊の決起" },
};

const CHOICE_ACTIONS = new Set<GameAction["type"]>(["resolve_effect_choice", "confirm_effect_choice"]);

/** `before` の選ぶ窓を答えた `action` で、選ぶ本人の山札から手札に加わったカードを公開として記録する。 */
export function revealDeckSearchPicks(before: GameState, after: GameState, action: GameAction): GameState {
  const pending = before.pendingEffectChoice;
  if (!pending || !CHOICE_ACTIONS.has(action.type)) return after;
  const spec = DECK_SEARCH_REVEALS[pending.sourceCardId];
  if (!spec || !spec.effectIds.includes(pending.effectId)) return after;
  const playerId: PlayerId = pending.playerId;
  const deckBefore = new Map(before.players[playerId].deck.map((c) => [c.instanceId, c]));
  const handBefore = new Set(before.players[playerId].hand.map((c) => c.instanceId));
  // 入れ子のアクションですでに記録した公開（同じカード）は重ねない。
  const seq0 = before.lastReveal?.seq ?? 0;
  const already = new Set(
    revealNotices(after)
      .filter((n) => n.seq > seq0)
      .flatMap((n) => n.cards.map((c) => c.instanceId)),
  );
  const picked: CardInstance[] = after.players[playerId].hand.filter(
    (c) => deckBefore.has(c.instanceId) && !handBefore.has(c.instanceId) && !already.has(c.instanceId),
  );
  if (picked.length === 0) return after;
  const line = buildLogEntry(playerId, "deck_search_reveal", pending.sourceCardId, after.definitions, `${spec.label}:${picked.map((c) => c.cardId).join(",")}`);
  return recordReveal({ ...after, log: [...after.log, line] }, {
    playerId,
    ownerId: playerId,
    sourceCardId: pending.sourceCardId,
    effectLabel: spec.label,
    from: "deck",
    cards: revealedCards(picked, "hand"),
  });
}
