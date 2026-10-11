import type { GameState, PlayerId } from "../types/game";
import { cardName, getDefinition } from "../core/catalog";
import { updatePlayer, removeAt } from "../core/helpers";
import { resolveLegend2OnDestroy } from "./legend2/destroyEffects";
import { tryResolveDslTriggeredEffects } from "../dsl/triggerResolver";
import { startSelectUnitChoice, startSelectCommandChoice } from "./pendingChoices";
import { applyReanimate } from "./reanimate";
import { startSuperGekiRedChoice } from "./legend1/set6AuditFixes";
import { buildLogEntry } from "../log/formatLog";
import { resolveZordFusionPartnerIds } from "../dsl/zordBridge";
import { applyHungerGodCeaseShuffle } from "./batch04FieldEffects";
import { resolveAbaRedDestroyDamage } from "./namedUnitEffects";
import { tagOpenedDestroyTrigger } from "./destroyTriggerTiming";
import type { DeferredDestroyTrigger, DestroyedFactInfo } from "../types/game";
import { GRAND_LINER_RUSH, gekidoSourcesForDestroyed, openGekidoZan, openGrandLinerRush } from "./legend1/set7NamedEffectsB";


/** Finds a named unit in the player's command OR discard zone and rushes it. */
function reanimateNamedToRush(
  state: GameState,
  ctx: UnitLeftZoneContext,
  targetName: string,
  effectId: string,
): { state: GameState; log: string | null } {
  const player = state.players[ctx.ownerPlayerId];
  const inCommand = player.command.filter(
    (c) => cardName(state.definitions, c.cardId) === targetName,
  );
  const inDiscard = player.discard.filter(
    (c) => cardName(state.definitions, c.cardId) === targetName,
  );
  const total = inCommand.length + inDiscard.length;
  if (total === 0) return { state, log: null };

  if (inDiscard.length >= 1 && inCommand.length === 0) {
    if (inDiscard.length === 1) {
      const ns = applyReanimate(state, {
        playerId: ctx.ownerPlayerId,
        instanceId: inDiscard[0]!.instanceId,
        from: "discard",
        to: "rush",
      });
      return { state: ns, log: buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, ns.definitions, effectId) };
    }
    const withChoice = startSelectUnitChoice(state, {
      playerId: ctx.ownerPlayerId,
      effectId,
      sourceCardId: ctx.cardId,
      phasePlayerId: ctx.phasePlayerId,
      validInstanceIds: inDiscard.map((c) => c.instanceId),
      unitDestination: "rush_from_discard",
      optional: false,
    });
    if (withChoice) {
      return { state: withChoice, log: buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, withChoice.definitions, `${effectId}_choice`) };
    }
    return { state, log: null };
  }

  if (inCommand.length >= 1 && inDiscard.length === 0) {
    if (inCommand.length === 1) {
      const target = inCommand[0]!;
      const idx = player.command.findIndex((c) => c.instanceId === target.instanceId);
      const [, newCommand] = removeAt(player.command, idx);
      const ns = {
        ...state,
        ...updatePlayer(state, ctx.ownerPlayerId, {
          ...player,
          command: newCommand,
          rush: [...player.rush, target],
        }),
      };
      return { state: ns, log: buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, ns.definitions, effectId) };
    }
    const withChoice = startSelectCommandChoice(state, {
      playerId: ctx.ownerPlayerId,
      effectId,
      sourceCardId: ctx.cardId,
      phasePlayerId: ctx.phasePlayerId,
      commandFilter: "any",
      commandAction: "rush",
      validInstanceIds: inCommand.map((c) => c.instanceId),
      optional: false,
    });
    if (withChoice) {
      return { state: withChoice, log: buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, withChoice.definitions, `${effectId}_choice`) };
    }
    return { state, log: null };
  }

  // Mixed: auto-take first from discard (command copy stays)
  const target = inDiscard[0]!;
  const ns = applyReanimate(state, {
    playerId: ctx.ownerPlayerId,
    instanceId: target.instanceId,
    from: "discard",
    to: "rush",
  });
  return { state: ns, log: buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, ns.definitions, effectId) };
}

/**
 * RS-256 闇の戒律（常駐）の一部:「自軍バトルフェイズに敵軍ユニットを1体撃破するたび、重ねたカードの上から1枚を手札に加える」。
 * 撃破の方法は問わない（タイムイエロー等で敵軍ユニット同士をバトルさせて撃破しても満たす。faq-card-5 RS-256）。
 * 重ねたカード（stackedCards）は後から重ねたものが上。
 */
function applyDarkLawDrawOnEnemyDestroyed(state: GameState, ctx: UnitLeftZoneContext): GameState {
  if (state.phase !== "battle") return state;
  const lawOwner = ctx.phasePlayerId;
  if (lawOwner === ctx.ownerPlayerId) return state;
  const player = state.players[lawOwner];
  const index = player.operation.findIndex((c) => c.cardId === "RS-256" && (c.stackedCards?.length ?? 0) > 0);
  if (index < 0) return state;
  const law = player.operation[index]!;
  const stacked = [...(law.stackedCards ?? [])];
  const top = stacked.pop()!;
  const operation = [...player.operation];
  operation[index] = { ...law, stackedCards: stacked };
  return {
    ...state,
    ...updatePlayer(state, lawOwner, {
      ...player,
      operation,
      hand: [...player.hand, { ...top, faceDown: undefined }],
    }),
  };
}

export type UnitLeftZoneContext = {
  ownerPlayerId: PlayerId;
  instanceId: string;
  cardId: string;
  fromZone: "rush" | "battle";
  toZone: string;
  phasePlayerId: PlayerId;
  /** ルール: R-DESTROY-02 — 撃破による移動か。省略時は捨札への移動を撃破とみなす。 */
  destroyed?: boolean;
  /** バトルによる撃破のとき、バトルの相手のユニット（RS-453【激怒斬り】）。 */
  battleOpponentInstanceId?: string;
};

/**
 * 「撃破されたとき」の効果（捨札になったかどうかを問わない）。
 * ルール: R-DESTROY-01, R-DESTROY-02 — 撃破と捨札は別。撃破されたユニットが置換・カウンター・レジストで
 * 場に留まっても、捨札以外へ置かれても、「撃破された」事実は残るので発動する。
 * 「撃破されて捨札になったとき」は捨札に置かれたときだけ（resolveUnitLeftZoneEffectsImpl）。
 * ルール: R-DESTROY-03 — 除外は撃破ではないので、除外ではこれを呼ばない。
 * ルール: R-TIME-01 — 段階 2 の誘発（1「撃破したとき」→ 2「撃破されたとき」→ 3 捨札へ移動 → 4「撃破されて捨札になったとき」）。
 */
export function resolveDestroyedFactEffects(
  state: GameState,
  ownerPlayerId: PlayerId,
  cardId: string,
  info?: DestroyedFactInfo,
): { state: GameState; logs: string[] } {
  // RS-054 アバレッド等「※これが撃破されたとき、1点ダメージを受ける。」
  const aba = resolveAbaRedDestroyDamage(state, ownerPlayerId, cardId);
  // RS-093【かんしゃく】・RS-116【鳴き声】「これが撃破されたとき、…」
  const legend2 = resolveLegend2OnDestroy(aba.state, ownerPlayerId, cardId);
  // RS-453 サムライマン【激怒斬り】「…自軍ユニットがユニットサイズの違うユニットとバトルして撃破された時」（rules/legend1/set7NamedEffectsB.ts）。
  const gekido = info?.gekidoSources?.length
    ? openGekidoZan(legend2.state, ownerPlayerId, info.gekidoSources, info.phasePlayerId ?? ownerPlayerId)
    : legend2.state;
  // ルール: R-TIME-01 — ここで開いた選択は段階 2（「撃破されたとき」）の誘発。
  return { state: tagOpenedDestroyTrigger(state, gekido, "destroyed"), logs: [...aba.logs, ...legend2.logs] };
}

/** UnitLeftZone リスナー本体: 捨札離場時の撃破誘発と自ダメージ。 */
export function resolveUnitLeftZoneEffectsImpl(
  state: GameState,
  ctx: UnitLeftZoneContext,
): { state: GameState; logs: string[] } {
  let nextState = state;
  const logs: string[] = [];

  if (
    (ctx.fromZone === "rush" || ctx.fromZone === "battle") &&
    (ctx.toZone === "discard" || ctx.toZone === "power") &&
    ctx.cardId === "RS-580"
  ) {
    nextState = applyHungerGodCeaseShuffle(nextState, [ctx.instanceId]);
  }

  const wentToDiscard = ctx.toZone === "discard";
  // ルール: R-DESTROY-02 — 撃破を経ずに捨札になった場合は「撃破されたとき」系は発動しない。
  const destroyed = ctx.destroyed ?? wentToDiscard;
  if (!destroyed) {
    return { state: nextState, logs };
  }
  nextState = applyDarkLawDrawOnEnemyDestroyed(nextState, ctx);
  const gekidoSources = gekidoSourcesForDestroyed(nextState, ctx);
  const factInfo: DestroyedFactInfo | undefined =
    gekidoSources.length > 0 ? { gekidoSources, phasePlayerId: ctx.phasePlayerId } : undefined;
  if (nextState.destroyTriggerHold) {
    // ルール: R-TIME-01 — 撃破した側の段階 1「撃破したとき」を先に解決するあいだ、撃破された側の誘発
    // （段階 2・段階 4。自動処理も選択も）は解決せずに待たせる（rules/destroyTriggerQueue.ts）。
    const queued: DeferredDestroyTrigger[] = [
      ...(nextState.deferredDestroyTriggers ?? []),
      {
        kind: "destroyed_fact",
        step: "destroyed",
        ownerPlayerId: ctx.ownerPlayerId,
        cardId: ctx.cardId,
        ...(factInfo ? { battleDestroyInfo: factInfo } : {}),
      },
    ];
    if (wentToDiscard) queued.push({ kind: "after_discard", step: "after_discard", ctx: { ...ctx } });
    return { state: { ...nextState, deferredDestroyTriggers: queued }, logs };
  }
  // ルール: R-TIME-01, R-DESTROY-02 — 段階 2「撃破されたとき」→ 3 捨札へ移動 → 4「撃破されて捨札になったとき」。
  // 段階 2 は捨札以外に置かれても発動し、段階 4 より先に解決する（ユーザー決定 2026-10-11）。
  const fact = resolveDestroyedFactEffects(nextState, ctx.ownerPlayerId, ctx.cardId, factInfo);
  nextState = fact.state;
  logs.push(...fact.logs);
  if (!wentToDiscard) {
    // 撃破されたが捨札以外（パワーゾーン等）に置かれた: 「撃破されて捨札になったとき」は発動しない（R-REPL-02）。
    return { state: nextState, logs };
  }
  const afterDiscard = resolveAfterDiscardDestroyEffects(nextState, ctx);
  return { state: afterDiscard.state, logs: [...logs, ...afterDiscard.logs] };
}

/**
 * 「撃破されて捨札になったとき」を resolveAfterDiscardDestroyEffects の個別処理だけで解決するカード。
 * RS-427 スーパーゲキイエロー・RS-428 スーパーゲキブルー: 「自軍捨札に「X」のカードがあれば1枚選び、自軍ラッシュエリアに出す」
 * （候補が1枚なら選択なしで出す、2枚以上なら選択）。
 */
const ON_DESTROY_HANDLED_BELOW = new Set(["RS-427", "RS-428"]);

/**
 * 段階 4（R-TIME-01）: 撃破されて実際に捨札に置かれたあとの「撃破されて捨札になったとき」「捨札になったとき」。
 * ここで開いた選択は段階 4 のタイミング。
 */
export function resolveAfterDiscardDestroyEffects(
  state: GameState,
  ctx: UnitLeftZoneContext,
): { state: GameState; logs: string[] } {
  let nextState = state;
  const logs: string[] = [];
  const beforeAfterDiscard = nextState;

  // 下で個別に解決するカード（RS-427・RS-428）は DSL（文言の正規化で on_destroy の選択になる）を通さない。
  // 両方を通すと、個別処理がゲキイエロー等を出したあとに DSL の古い選択が残る（二重解決）。
  if (!ON_DESTROY_HANDLED_BELOW.has(ctx.cardId)) {
    const destroyDsl = tryResolveDslTriggeredEffects({
      state: nextState,
      cardId: ctx.cardId,
      instanceId: ctx.instanceId,
      playerId: ctx.ownerPlayerId,
      phasePlayerId: ctx.phasePlayerId,
      triggerType: "on_destroy",
      logAction: "destroy_effect",
    });
    nextState = destroyDsl.state;
    logs.push(...destroyDsl.logs);
  }

  // 「※これが撃破されて捨札になったとき、自軍捨札の「X」を1枚選び…ラッシュエリアに出す」は
  // DSL 正規化（dsl/effectTextNormalization）で on_destroy の効果として上の DSL 解決で扱う。

  if (ctx.cardId === "RS-427") {
    const player = nextState.players[ctx.ownerPlayerId];
    const gekiInDiscard = player.discard.filter(
      (c) => cardName(nextState.definitions, c.cardId) === "ゲキイエロー",
    );
    if (gekiInDiscard.length === 1) {
      nextState = applyReanimate(nextState, {
        playerId: ctx.ownerPlayerId,
        instanceId: gekiInDiscard[0]!.instanceId,
        from: "discard",
        to: "rush",
      });
      logs.push(buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, nextState.definitions, "super_geki_yellow_reanimate"));
    } else if (gekiInDiscard.length > 1) {
      const withChoice = startSelectUnitChoice(nextState, {
        playerId: ctx.ownerPlayerId,
        effectId: "super_geki_yellow_reanimate",
        sourceCardId: ctx.cardId,
        phasePlayerId: ctx.phasePlayerId,
        validInstanceIds: gekiInDiscard.map((c) => c.instanceId),
        unitDestination: "rush_from_discard",
        optional: false,
      });
      if (withChoice) {
        nextState = withChoice;
        logs.push(buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, nextState.definitions, "super_geki_yellow_reanimate_choice"));
      }
    }
  }

  // RS-428: destroyed → bring ゲキブルー from discard to rush
  if (ctx.cardId === "RS-428") {
    const player = nextState.players[ctx.ownerPlayerId];
    const targets = player.discard.filter(
      (c) => cardName(nextState.definitions, c.cardId) === "ゲキブルー",
    );
    if (targets.length === 1) {
      nextState = applyReanimate(nextState, {
        playerId: ctx.ownerPlayerId,
        instanceId: targets[0]!.instanceId,
        from: "discard",
        to: "rush",
      });
      logs.push(buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, nextState.definitions, "geki_blue_reanimate"));
    } else if (targets.length > 1) {
      const withChoice = startSelectUnitChoice(nextState, {
        playerId: ctx.ownerPlayerId,
        effectId: "geki_blue_reanimate",
        sourceCardId: ctx.cardId,
        phasePlayerId: ctx.phasePlayerId,
        validInstanceIds: targets.map((c) => c.instanceId),
        unitDestination: "rush_from_discard",
        optional: false,
      });
      if (withChoice) {
        nextState = withChoice;
        logs.push(buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, nextState.definitions, "geki_blue_reanimate_choice"));
      }
    }
  }

  // XG2-099: destroyed → bring カメロック from command or discard to rush
  if (ctx.cardId === "XG2-099") {
    const result = reanimateNamedToRush(nextState, ctx, "カメロック", "camerock_reanimate");
    nextState = result.state;
    if (result.log) logs.push(result.log);
  }

  // XG3-099: destroyed → bring ロボタック from command or discard to rush
  if (ctx.cardId === "XG3-099") {
    const result = reanimateNamedToRush(nextState, ctx, "ロボタック", "robotack_reanimate");
    nextState = result.state;
    if (result.log) logs.push(result.log);
  }

  // XG5-089: destroyed → bring カバドス from command or discard to rush
  if (ctx.cardId === "XG5-089") {
    const result = reanimateNamedToRush(nextState, ctx, "カバドス", "kabados_reanimate");
    nextState = result.state;
    if (result.log) logs.push(result.log);
  }

  // XG7-063: destroyed → bring シャークラー from command or discard to rush
  if (ctx.cardId === "XG7-063") {
    const result = reanimateNamedToRush(nextState, ctx, "シャークラー", "sharklar_reanimate");
    nextState = result.state;
    if (result.log) logs.push(result.log);
  }

  // RS-332: destroyed → bring each combo part (RS-334, RS-335, RS-336) from discard to rush
  if (ctx.cardId === "RS-332") {
    const partnerIds = resolveZordFusionPartnerIds("RS-332");
    for (const partnerId of partnerIds) {
      const player = nextState.players[ctx.ownerPlayerId];
      const inDiscard = player.discard.filter((c) => c.cardId === partnerId);
      if (inDiscard.length === 0) continue;
      nextState = applyReanimate(nextState, {
        playerId: ctx.ownerPlayerId,
        instanceId: inDiscard[0]!.instanceId,
        from: "discard",
        to: "rush",
      });
      logs.push(buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, nextState.definitions, "maji_lion_parts_reanimate"));
    }
  }

  // RS-426: destroyed → bring スーパーゲキレッド from hand OR ゲキレッド from discard to rush
  if (ctx.cardId === "RS-426") {
    const player = nextState.players[ctx.ownerPlayerId];
    const superInHand = player.hand.filter(
      (c) => cardName(nextState.definitions, c.cardId) === "スーパーゲキレッド",
    );
    const baseInDiscard = player.discard.filter(
      (c) => cardName(nextState.definitions, c.cardId) === "ゲキレッド",
    );
    if (superInHand.length === 0 && baseInDiscard.length > 0) {
      // Only discard option: reanimate ゲキレッド
      nextState = applyReanimate(nextState, {
        playerId: ctx.ownerPlayerId,
        instanceId: baseInDiscard[0]!.instanceId,
        from: "discard",
        to: "rush",
      });
      logs.push(buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, nextState.definitions, "super_geki_red_reanimate"));
    } else if (superInHand.length > 0 && baseInDiscard.length === 0) {
      // Only hand option: move スーパーゲキレッド from hand to rush
      const target = superInHand[0]!;
      const idx = player.hand.findIndex((c) => c.instanceId === target.instanceId);
      const [, newHand] = removeAt(player.hand, idx);
      nextState = {
        ...nextState,
        ...updatePlayer(nextState, ctx.ownerPlayerId, {
          ...nextState.players[ctx.ownerPlayerId],
          hand: newHand,
          rush: [...nextState.players[ctx.ownerPlayerId].rush, target],
        }),
      };
      logs.push(buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, nextState.definitions, "super_geki_red_reanimate"));
    } else if (superInHand.length > 0 && baseInDiscard.length > 0) {
      // 両方あればどちらか1枚をプレイヤーが選ぶ（「どちらか1枚を選び」atwiki/page-509。見送れない）。
      nextState = startSuperGekiRedChoice(
        nextState,
        ctx.ownerPlayerId,
        ctx.phasePlayerId,
        superInHand.map((c) => c.instanceId),
        baseInDiscard.map((c) => c.instanceId),
      );
      logs.push(buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, nextState.definitions, "super_geki_red_reanimate_choice"));
    }
  }

  // RS-471 グランドライナー ※: 敵軍ターン中に撃破されて捨札になったとき、自軍コマンドゾーンの「メカ」の M ユニットのカードを
  // 好きな枚数選び、自軍ラッシュエリアに出してもよい（rules/legend1/set7NamedEffectsB.ts）。
  if (ctx.cardId === "RS-471" && ctx.phasePlayerId !== ctx.ownerPlayerId) {
    const withChoice = openGrandLinerRush(nextState, ctx.ownerPlayerId, ctx.cardId, ctx.phasePlayerId);
    if (withChoice) {
      nextState = withChoice;
      logs.push(buildLogEntry(ctx.ownerPlayerId, "destroy_effect", ctx.cardId, nextState.definitions, GRAND_LINER_RUSH));
    }
  }

  return { state: tagOpenedDestroyTrigger(beforeAfterDiscard, nextState, "after_discard"), logs };
}
