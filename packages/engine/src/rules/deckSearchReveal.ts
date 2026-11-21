import type { GameAction } from "../types/actions";
import type { CardInstance, GameState, PlayerId, RevealDestination } from "../types/game";
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

// ---------------------------------------------------------------------------
// 2026-11-22 総点検（「公開なのに相手に見えていないもの」）: 選んだカードを見せる効果と、山札の上をオモテにしてから選ぶ・並べる効果。

/**
 * 「自分の手札から…を選び、相手に見せる」・「自軍山札を見て…を選び、相手に見せる（手札に加えない）」: 選び終えたカード
 * （選ぶ窓を答えて、その窓が閉じたとき。複数枚を選ぶ窓は選び終えたとき）を公開する。カード番号 → 選ぶ窓の効果 ID。
 */
export const PICK_SHOW_REVEALS: Readonly<Record<string, readonly string[]>> = {
  "PK-014": ["rk314_monster_fever"],
  "RK-125": ["blay_rouzer_show"],
  "RK-126": ["rk126_garren_rouzer_show"],
  "RK-127": ["rk127_chalice_arrow"],
  "RK-128": ["rk128_rengel_rouzer"],
  "RK-210": ["rk210_burning_shot"],
  "RK-211": ["rk211_lightning_slash"],
  "RK-314": ["rk314_monster_fever"],
  "RM-024": ["rm024_tousai"],
  "RM-042": ["rm042_midare_cho_hand"],
  "RS-186": ["purobaidabesu_deck_top"],
  "RS-462": ["rs462_show_hand"],
  "RS-463": ["rs462_show_hand"],
  "RS-500": ["rs500_cyblade_cutter"],
  "RS-524": ["rs524_goetsu_reveal", "tag_bold_rs524"],
  "RS-525": ["rs525_partner_reveal_l"],
  "RS-568": ["rs568_fusion_call_reveal"],
  "XG1-061": ["xg1_061_spinning_wave"],
  "XG1-059": ["xg1_059_royal_straight_flush_show"],
  "XG1-067": ["xg1_067_attack_ride"],
  "XG4-081": ["xg4081_lightning_reveal"],
  "XG5-033": ["xg5_033_fuuin_reveal"],
  "XG5-055": ["xg5_055_fire_upper"],
  "XG7-038": ["xg7038_blast"],
};

/**
 * 「山札の上から…をオモテにして（にし）、その中から選ぶ／好きな順で戻す」: 選ぶ・並べる窓が開いたときに、窓に出ている山札の
 * カードを公開する（選ぶ本人だけでなく、両プレイヤーに見える）。そのカードの効果の窓すべて（並べる窓 deck_bottom_order 等も）。
 */
export const OPEN_SHOW_REVEALS: ReadonlySet<string> = new Set([
  "RS-237", "RS-257", "RS-294", "RS-353", "RS-457", "RS-515", "RS-556",
  "SR-006", "XG1-054", "XG2-084", "XG4-066", "XG5-072", "XG7-042",
]);

const PLAYERS: readonly PlayerId[] = ["player1", "player2"];
const VIEWED_META_KEYS = new Set(["top", "topId", "topInstanceId", "revealedId", "revealedInstanceIds", "picked", "remainingIds", "target", "ids"]);

/** 効果名（本文の最初の【…】。なければカード名）。 */
function effectLabelOf(state: GameState, cardId: string): string {
  const def = state.definitions[cardId];
  const m = /【([^】]+)】/.exec(def?.text ?? "");
  return m?.[1] ?? def?.name ?? cardId;
}

type Hidden = { card: CardInstance; owner: PlayerId; zone: "deck" | "hand" };

function hiddenPlace(state: GameState, instanceId: string): Hidden | null {
  for (const owner of PLAYERS) {
    for (const zone of ["deck", "hand"] as const) {
      const card = state.players[owner][zone].find((c) => c.instanceId === instanceId);
      if (card) return { card, owner, zone };
    }
  }
  return null;
}

function revealedSince(before: GameState, after: GameState): Set<string> {
  const seq0 = before.lastReveal?.seq ?? 0;
  return new Set(revealNotices(after).filter((n) => n.seq > seq0).flatMap((n) => n.cards.map((c) => c.instanceId)));
}

/** これまでの公開（記録に残っている分）。 */
function revealedAll(state: GameState): Set<string> {
  return new Set(revealNotices(state).flatMap((n) => n.cards.map((c) => c.instanceId)));
}

function destinationIn(after: GameState, card: CardInstance, owner: PlayerId): RevealDestination {
  const p = after.players[owner];
  if (p.hand.some((c) => c.instanceId === card.instanceId)) return "hand";
  const i = p.deck.findIndex((c) => c.instanceId === card.instanceId);
  if (i === 0) return "deck_top";
  if (i > 0 && i === p.deck.length - 1) return "deck_bottom";
  if (i > 0) return "deck_shuffle";
  if (p.discard.some((c) => c.instanceId === card.instanceId)) return "discard";
  if (p.power.some((c) => c.instanceId === card.instanceId)) return "power";
  if (p.rush.some((c) => c.instanceId === card.instanceId)) return "rush";
  return "stay";
}

function sourceOwner(state: GameState, pending: NonNullable<GameState["pendingEffectChoice"]>): PlayerId {
  const id = pending.sourceInstanceId;
  if (id) {
    for (const owner of PLAYERS) {
      const p = state.players[owner] as unknown as Record<string, unknown>;
      for (const zone of Object.values(p)) {
        if (Array.isArray(zone) && zone.some((c) => (c as CardInstance)?.instanceId === id)) return owner;
      }
    }
  }
  return pending.phasePlayerId ?? pending.playerId;
}

function chainOf(state: GameState): Array<NonNullable<GameState["pendingEffectChoice"]>> {
  const out: Array<NonNullable<GameState["pendingEffectChoice"]>> = [];
  let c = state.pendingEffectChoice;
  for (let d = 0; c && d < 8; d += 1) {
    out.push(c);
    c = c.resumeChoice;
  }
  return out;
}

/** 選び終えた「見せる」カードを公開する（PICK_SHOW_REVEALS）。 */
export function revealShownPicks(before: GameState, after: GameState, action: GameAction): GameState {
  const pending = before.pendingEffectChoice;
  if (!pending || !CHOICE_ACTIONS.has(action.type)) return after;
  const effectIds = PICK_SHOW_REVEALS[pending.sourceCardId];
  if (!effectIds?.includes(pending.effectId)) return after;
  const a = action as { instanceId?: unknown; instanceIds?: unknown };
  const ids = new Set<string>([
    ...(pending.selectedInstanceIds ?? []),
    ...(typeof a.instanceId === "string" ? [a.instanceId] : []),
    ...(Array.isArray(a.instanceIds) ? a.instanceIds.filter((x): x is string => typeof x === "string") : []),
  ]);
  // 同じ窓で選び続けている（選んだカードを足しただけ）なら、選び終えたときに公開する。
  const still = chainOf(after).find((c) => c.sourceCardId === pending.sourceCardId && c.effectId === pending.effectId && c.playerId === pending.playerId);
  if (still && (still.selectedInstanceIds ?? []).some((id) => ids.has(id))) return after;
  const done = new Set([...revealedAll(before), ...revealedSince(before, after)]);
  const picked: Hidden[] = [];
  for (const id of ids) {
    const place = hiddenPlace(before, id);
    if (place && !done.has(id)) picked.push(place);
  }
  if (picked.length === 0) return after;
  const from = picked.every((p) => p.zone === "hand") ? "hand" : "deck";
  return recordReveal(after, {
    playerId: pending.playerId,
    ownerId: pending.playerId,
    sourceCardId: pending.sourceCardId,
    effectLabel: effectLabelOf(after, pending.sourceCardId),
    from,
    cards: picked.map((p) => ({
      instanceId: p.card.instanceId,
      cardId: p.card.cardId,
      destination: p.zone === "hand" && destinationIn(after, p.card, p.owner) === "hand" ? "stay" : destinationIn(after, p.card, p.owner),
      ...(p.owner !== pending.playerId ? { ownerId: p.owner } : {}),
    })),
  });
}

/** 山札の上をオモテにしてから選ぶ・並べる窓が開いたら、窓に出ている山札のカードを公開する（OPEN_SHOW_REVEALS）。 */
export function revealOpenedDeckCards(before: GameState, after: GameState): GameState {
  const chain = chainOf(after).filter((c) => OPEN_SHOW_REVEALS.has(c.sourceCardId) && !c.revealGate);
  if (chain.length === 0) return after;
  const done = new Set([...revealedAll(before), ...revealedSince(before, after)]);
  let next = after;
  for (const choice of chain) {
    const ids = new Set<string>([...choice.validInstanceIds, ...(choice.viewedInstanceIds ?? [])]);
    for (const [k, v] of Object.entries(choice)) {
      if (!k.endsWith("Meta") || !v || typeof v !== "object") continue;
      for (const [f, x] of Object.entries(v as Record<string, unknown>)) {
        if (!VIEWED_META_KEYS.has(f)) continue;
        for (const y of Array.isArray(x) ? x : [x]) if (typeof y === "string") ids.add(y);
      }
    }
    const cards: Hidden[] = [];
    for (const id of ids) {
      const place = hiddenPlace(next, id);
      if (place && place.zone === "deck" && !done.has(id)) cards.push(place);
    }
    if (cards.length === 0) continue;
    for (const c of cards) done.add(c.card.instanceId);
    const owners = new Set(cards.map((c) => c.owner));
    const ownerId = owners.size === 1 ? cards[0]!.owner : sourceOwner(next, choice);
    next = recordReveal(next, {
      playerId: sourceOwner(next, choice),
      ownerId,
      sourceCardId: choice.sourceCardId,
      effectLabel: effectLabelOf(next, choice.sourceCardId),
      from: "deck_top",
      cards: cards.map((c) => ({
        instanceId: c.card.instanceId,
        cardId: c.card.cardId,
        destination: "stay" as const,
        ...(c.owner !== ownerId ? { ownerId: c.owner } : {}),
      })),
    });
  }
  return next;
}
