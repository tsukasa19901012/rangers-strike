import type { EffectPrimitive } from "@rangers-strike/cards/dsl/types";
import { openHolography, openMagnetFist } from "../rs4NcEffects";
import { registerPinkBarrier } from "../powerFlipEffects";
import { buildCatchallStructuredPrimitives } from "../../dsl/catchallTextPrimitives";
import type { DslCardContext } from "../../dsl/cardInterpreter";
import { buildRematchContext } from "../../dsl/hashGrantKeywordBridge";
import type { InterpretFn } from "../../dsl/interpretEffectRuntime";
import { getDslEffectById } from "../../dsl/effectLookup";
import { grantSp1ToBattleUnit, markBattleNcEffect } from "../namedUnitEffects";
import { addTurnRuleModifier } from "../../core/scopedModifiers";
import { opponent, updatePlayer } from "../../core/helpers";
import { effectiveBp } from "../../core/catalog";
import type { GameState, PlayerId } from "../../types/game";
import { applyPickEffectBranch } from "../bkOperationEffects";
import type { GrantKeywordContext } from "../../dsl/grantKeyword";
import { tryLeaveField } from "../operationCounters";
import {
  adjacentPairCandidates,
  openEffectChoice,
  startEnterHoldEnemyPowerLeDamageChoice,
  startSelectHandChoice,
} from "../pendingChoices";
import {
  collectEnemyUnits,
  countFieldFeatureUnits,
  parseEnemyTargetZone,
  parseEnemyUnitFilter,
  parseFeatureThreshold,
  playerHasFieldCard,
  startGenericEnemyUnitChoice,
} from "./rsCatchallChoices";
import { RS_CATCHALL_SPECS } from "./rsCatchallSpecs.generated";
import { startSwanWingChoice } from "../swanWing";

const PASSIVE_FIELD_PATTERNS = new Set([
  "while_in_field_body",
  "grant_ability_generic",
  "bp_modify",
  "cannot_restrict",
  "ignore_rule_text_override",
  "register_resist",
  "category_modify",
  "wb_category",
  "adjacent_units",
  "ride_s_grant_ability",
  "combo_l_grant_effect",
  "combo_l_attack_or_strike_grant",
  "battle_win",
  "optional_then",
  "ride_discard_trigger_effect",
  "ride_action",
]);

const PASSIVE_COMBO_PATTERNS = new Set([
  "combo_action",
  "combo_from_named_card",
  "combo_hold_on_s_combo",
  "number_combo",
]);

type PatternHandler = (
  state: GameState,
  ctx: DslCardContext,
  body: string,
  interpret: InterpretFn,
) => { state: GameState; detail?: string } | null;

function registerTurnKeyword(
  state: GameState,
  playerId: PlayerId,
  ruleId: string,
  sourceCardId: string,
  payload?: unknown,
): GameState {
  const player = addTurnRuleModifier(state.players[playerId], ruleId, {
    sourceCardId,
    payload,
  });
  return { ...state, ...updatePlayer(state, playerId, player) };
}

function destroyUnit(
  state: GameState,
  instanceId: string,
  ownerPlayerId: PlayerId,
  phasePlayerId: PlayerId,
): GameState | null {
  const player = state.players[ownerPlayerId];
  const zone =
    player.battle.find((c) => c.instanceId === instanceId) ? "battle" : "rush";
  const found = player[zone].find((c) => c.instanceId === instanceId);
  if (!found) return null;
  const leave = tryLeaveField(state, {
    ownerPlayerId,
    instanceId,
    fromZone: zone,
    toZone: "discard",
    leavingCardId: found.cardId,
    phasePlayerId,
  });
  if (leave.deferred) return leave.state;
  return leave.state;
}

const handleEnemyToPowerDamage: PatternHandler = (state, ctx, body) => {
  const filter = parseEnemyUnitFilter(body);
  const withChoice = startGenericEnemyUnitChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    filter,
    destination: "power",
    // 「置いてもよい」等も任意（RS-368【ゴッドハンド】、RS-639【ネジスリング】）。
    optional: /てもよい/.test(body),
    placeAsDamage: /ダメージにして置/.test(body),
  });
  if (!withChoice) return { state, detail: `${ctx.effectId}:no_targets` };
  return { state: withChoice, detail: ctx.effectId };
};

const handleDestroyPatterns: PatternHandler = (state, ctx, body) => {
  // 候補エリアは対象の表記どおり（「これをラッシュしたとき」等の「ラッシュ」で敵軍ラッシュエリアに絞らない）。
  const filter = { ...parseEnemyUnitFilter(body), zone: parseEnemyTargetZone(body) };
  const withChoice = startGenericEnemyUnitChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    filter,
    destination: "discard",
    optional: /してもよい|選んでもよい/.test(body),
  });
  if (!withChoice) return { state, detail: `${ctx.effectId}:no_targets` };
  return { state: withChoice, detail: ctx.effectId };
};

const handleFeatureMatch: PatternHandler = (state, ctx, body) => {
  const threshold = parseFeatureThreshold(body);
  if (!threshold) return { state, detail: ctx.effectId };
  const count = countFieldFeatureUnits(state, ctx.playerId, threshold.feature, "rush");
  if (count < threshold.count) return { state, detail: `${ctx.effectId}:unmet` };
  const instanceId = ctx.triggerSourceInstanceId;
  if (!instanceId) return { state, detail: ctx.effectId };
  return { state: grantSp1ToBattleUnit(state, ctx.playerId, instanceId), detail: ctx.effectId };
};

const handleDestroyRemaining: PatternHandler = (state, ctx, body) => {
  const bpMatch = body.match(/BP(\d+)以下/);
  const maxBp = bpMatch ? Number(bpMatch[1]) : 4000;
  const ruleId = `rs_destroy_on_enemy_rush_bp_le_${maxBp}::${ctx.sourceCardId}`;
  return {
    state: registerTurnKeyword(state, ctx.playerId, ruleId, ctx.sourceCardId, { maxBp }),
    detail: ctx.effectId,
  };
};

const handleOpponentMust: PatternHandler = (state, ctx, body) => {
  // 「これがバトルでユニットを撃破したとき」の NC 効果（RS-211【稲妻超力トンファ】）は、出たときには何もせず
  // NC 成立だけを記録する。撃破時の処理はバトル解決（operationCounters の openInazumaTonfaChoice）。
  if (/これがバトルでユニットを撃破したとき/.test(body) && ctx.triggerSourceInstanceId) {
    return {
      state: markBattleNcEffect(state, ctx.playerId, ctx.triggerSourceInstanceId, ctx.effectId),
      detail: ctx.effectId,
    };
  }
  if (/コマンドゾーンからカードを1枚選び.*パワーゾーン/.test(body)) {
    const enemyId = opponent(ctx.playerId);
    const instanceId = ctx.triggerSourceInstanceId ?? `${ctx.sourceCardId}:field`;
    const withChoice = startSelectHandChoice(state, {
      playerId: enemyId,
      effectId: `${ctx.effectId}_opponent_discard_to_power`,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: instanceId,
      phasePlayerId: ctx.phasePlayerId,
      optional: false,
    });
    if (withChoice) return { state: withChoice, detail: ctx.effectId };
  }
  if (/ラッシュエリアからユニットを1体選ぶ/.test(body)) {
    const enemyId = opponent(ctx.playerId);
    const withChoice = startGenericEnemyUnitChoice(state, {
      playerId: enemyId,
      effectId: `${ctx.effectId}_opponent_pick_rush`,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      phasePlayerId: ctx.phasePlayerId,
      filter: { zone: "rush" },
      destination: "rush",
      optional: false,
    });
    if (withChoice) return { state: withChoice, detail: ctx.effectId };
  }
  return { state, detail: ctx.effectId };
};

const SWAN_WING_BODY = /敵軍コマンドゾーンにあるSユニットのカードをすべてラッシュエリアに出/;

const handleDeployRush: PatternHandler = (state, ctx, body) => {
  // RS-284【スワンウィング】: 敵軍コマンドゾーンの S ユニットのカードをすべて（相手の）ラッシュエリアに出してもよい。
  if (SWAN_WING_BODY.test(body)) {
    const withChoice = startSwanWingChoice(state, {
      playerId: ctx.playerId,
      phasePlayerId: ctx.phasePlayerId,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
    });
    if (!withChoice) return { state, detail: `${ctx.effectId}:no_targets` };
    return { state: withChoice, detail: ctx.effectId };
  }
  const filter = parseEnemyUnitFilter(body);
  filter.zone = "both";
  if (!filter.size && /Sユニット/.test(body)) filter.size = "S";
  const withChoice = startGenericEnemyUnitChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    filter,
    destination: "rush",
    optional: /してもよい/.test(body),
  });
  if (!withChoice) return { state, detail: `${ctx.effectId}:no_targets` };
  return { state: withChoice, detail: ctx.effectId };
};

const handleHoldEnemyUnit: PatternHandler = (state, ctx, body) => {
  // 「敵軍ユニットを1体選びホールドする（してもよい）」— コマンドゾーンに置くのではなく、その場でホールド状態にする
  // （RS-648【イカロスバインド】）。「持ち主のコマンドゾーンにホールド状態で置く」はコマンドゾーンへ移す。
  if (!/コマンドゾーン/.test(body) && /ユニットを\d体選びホールド/.test(body.normalize("NFKC"))) {
    return holdEnemyUnitInPlace(state, ctx, body);
  }
  // RS-563【ライジングホーン】型（必要パワーが相手のダメージ以下の敵軍ユニット）は、その条件を持つ本文だけ。
  const withChoice = !/必要パワー/.test(body) || !/ダメージ/.test(body) ? null : startEnterHoldEnemyPowerLeDamageChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
  });
  if (withChoice) return { state: withChoice, detail: ctx.effectId };
  const filter = parseEnemyUnitFilter(body);
  const choice = startGenericEnemyUnitChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    filter,
    destination: "enemy_command",
    optional: true,
  });
  if (!choice) return { state, detail: `${ctx.effectId}:no_targets` };
  return { state: choice, detail: ctx.effectId };
};

/**
 * 「（…とき、）敵軍ユニットを1体選びホールドしてもよい。」— 選んだユニットをその場でホールド状態にする（unitDestination "hold"）。
 * 候補は選ぶ文（最初の文の「…とき、」より後）の条件で絞る。エリアの指定がなければバトル・ラッシュエリアの両方
 * （「敵軍ユニット」はエリアを問わない）。すでにホールド状態のユニットはホールドできないので候補にしない。
 */
function holdEnemyUnitInPlace(state: GameState, ctx: GrantKeywordContext, body: string): { state: GameState; detail: string } {
  const sentence = body.split("。")[0] ?? body;
  const clause = sentence.includes("とき、") ? sentence.slice(sentence.lastIndexOf("とき、") + 3) : sentence;
  const filter = parseEnemyUnitFilter(clause);
  if (!/バトルエリア|ラッシュエリア/.test(clause)) filter.zone = "both";
  const valid = collectEnemyUnits(state, ctx.playerId, filter).filter((id) => {
    const enemy = state.players[opponent(ctx.playerId)];
    return ![...enemy.battle, ...enemy.rush].some((c) => c.instanceId === id && c.commandHeld);
  });
  if (valid.length === 0) return { state, detail: `${ctx.effectId}:no_targets` };
  return {
    state: openEffectChoice(state, {
      playerId: ctx.playerId,
      effectId: ctx.effectId,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      phasePlayerId: ctx.phasePlayerId,
      kind: "select_unit",
      validInstanceIds: valid,
      unitDestination: "hold",
      selectCount: 1,
      optional: /してもよい/.test(clause),
    }),
    detail: ctx.effectId,
  };
}

const handleDamageAction: PatternHandler = (state, ctx, body) =>
  /次の相手ターン、自軍パワーゾーンのカードをウラ返してダメージにするとき、ウラ返すカードと必要パワーの数字が同じ敵軍ユニットをすべて撃破する/.test(body)
    ? // RS-202 ピンクファイブ【ピンクバリヤー】（rules/powerFlipEffects.ts）。
      { state: registerPinkBarrier(state, ctx.playerId, ctx.sourceCardId), detail: ctx.effectId }
    : ({
  state: registerTurnKeyword(
    state,
    ctx.playerId,
    `rs_damage_action::${ctx.sourceCardId}::${ctx.effectId}`,
    ctx.sourceCardId,
    { body },
  ),
  detail: ctx.effectId,
});

const handleGrantEffectGeneric: PatternHandler = (state, ctx, body) => ({
  state: registerTurnKeyword(
    state,
    ctx.playerId,
    `rs_grant_effect::${ctx.sourceCardId}::${ctx.effectId}`,
    ctx.sourceCardId,
    { body },
  ),
  detail: ctx.effectId,
});

const handleCategoryModify: PatternHandler = (state, ctx, body) => {
  const category = body.match(/「([A-Z]{2,})」になる/)?.[1] ?? "OT";
  return {
    state: registerTurnKeyword(
      state,
      ctx.playerId,
      `rs_category_modify_all_held::${category}`,
      ctx.sourceCardId,
      { category },
    ),
    detail: ctx.effectId,
  };
};

const handleEnterHoldEnemy: PatternHandler = (state, ctx) => {
  const withChoice = startEnterHoldEnemyPowerLeDamageChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
  });
  if (!withChoice) return { state, detail: `${ctx.effectId}:no_targets` };
  return { state: withChoice, detail: ctx.effectId };
};

const handleChoiceBranch: PatternHandler = (state, ctx) => {
  const grantCtx: GrantKeywordContext = {
    playerId: ctx.playerId,
    phasePlayerId: ctx.phasePlayerId,
    sourceCardId: ctx.sourceCardId,
    effectId: ctx.effectId,
    triggerSourceInstanceId: ctx.triggerSourceInstanceId,
    operationInstanceId: ctx.operationInstanceId,
    extraInstanceIds: ctx.extraInstanceIds,
    leavingCardId: ctx.leavingCardId,
    optional: ctx.optional,
  };
  const withChoice = applyPickEffectBranch(state, grantCtx);
  if (withChoice) return { state: withChoice, detail: "pick_effect_branch" };
  return { state, detail: ctx.effectId };
};

const PATTERN_HANDLERS: Record<string, PatternHandler> = {
  enemy_to_power_damage_generic: handleEnemyToPowerDamage,
  destroy_enter_battle: handleDestroyPatterns,
  destroy_on_rush: handleDestroyPatterns,
  destroy_choose_enemy: handleDestroyPatterns,
  destroy_all_enemy: handleDestroyPatterns,
  destroy_remaining: handleDestroyRemaining,
  feature_match: handleFeatureMatch,
  opponent_must: handleOpponentMust,
  deploy_rush_area: handleDeployRush,
  deploy_battle_area: handleDeployRush,
  hold_enemy_unit: handleHoldEnemyUnit,
  hold_on_enter_battle: handleHoldEnemyUnit,
  damage_action: handleDamageAction,
  grant_effect_generic: handleGrantEffectGeneric,
  category_modify: handleCategoryModify,
  enter_battle_hold_enemy_power_le_opponent_damage: handleEnterHoldEnemy,
  choice_one_of_effects: handleChoiceBranch,
};

function isRsCatchallCard(cardId: string): boolean {
  return RS_CATCHALL_SPECS.some((s) => s.cardId === cardId);
}

function buildExtendedPrimitives(body: string, pattern: string): EffectPrimitive[] | null {
  if (pattern.startsWith("deck_search") || pattern === "rush_discard_deck_search") {
    if (/ラッシュエリアに出/.test(body)) {
      return [
        {
          type: "choose",
          kind: "optional_deck_draw",
          valid: { type: "zone", zone: "deck", owner: "self" },
          count: 1,
          then: [{ type: "move", target: { type: "trigger_source" }, to: "rush" }],
        },
      ];
    }
    if (/手札に加え/.test(body)) {
      return [
        {
          type: "choose",
          kind: "optional_deck_draw",
          valid: { type: "zone", zone: "deck", owner: "self" },
          count: 1,
          then: [{ type: "move", target: { type: "trigger_source" }, to: "hand" }],
        },
      ];
    }
    if (/パワーゾーンに置/.test(body)) {
      return [
        {
          type: "choose",
          kind: "optional_deck_draw",
          valid: { type: "zone", zone: "deck", owner: "self" },
          count: 1,
          then: [{ type: "move", target: { type: "trigger_source" }, to: "power" }],
        },
      ];
    }
  }
  if (pattern === "return_to_zone" && /手札に戻/.test(body)) {
    return [
      {
        type: "choose",
        kind: "select_unit",
        valid: { type: "zone", zone: "battle", owner: "opponent" },
        count: /2体/.test(body) ? 2 : 1,
        then: [{ type: "move", target: { type: "trigger_source" }, to: "hand" }],
      },
    ];
  }
  // 「power_zone_action」（パワーゾーンに触れる文）を「自軍バトルエリアのユニットを1体選びパワーゾーンに送る」に読み替える
  // 汎用の対応は誤り（RS-509【ガレージランチャー】・RS-511【マンタンガン・ロッドモード】は自軍ユニットを送らない）なので置かない。
  // それらのカードはカード固有の処理（rules/legend1/set7NamedEffectsD.ts）で解決する。
  return null;
}

const MAY_TEXT = /てもよい|ても良い/;

const ADJACENT_PAIR_TO_POWER =
  /^敵軍(バトル|ラッシュ)エリアから、BPの合計が(\d+)になるように隣り合う2体の(S|M|L)ユニットを選び、持ち主のパワーゾーンに送ってもよい/;

/**
 * 「敵軍バトルエリアから、BPの合計がNになるように隣り合う2体のSユニットを選び、持ち主のパワーゾーンに送ってもよい」。
 * 候補は条件を満たす組に入るユニットだけで、1体目を選ぶと2体目はその組の相手に絞られる（pairConstraint）。
 */
function startAdjacentPairToPowerChoice(
  state: GameState,
  ctx: DslCardContext,
  body: string,
): { state: GameState; detail?: string } | null {
  const m = body.match(ADJACENT_PAIR_TO_POWER);
  if (!m) return null;
  const zone = m[1] === "ラッシュ" ? "rush" : "battle";
  const bpSum = Number(m[2]);
  const size = m[3] as "S" | "M" | "L";
  const pairConstraint = { adjacentZone: zone, bpSum, size } as const;
  const valid = adjacentPairCandidates(state, ctx.playerId, pairConstraint, []);
  if (valid.length === 0) return { state, detail: `${ctx.effectId}:no_targets` };
  const opened = openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    kind: "select_unit",
    validInstanceIds: valid,
    unitDestination: "power",
    selectCount: 2,
    optional: true,
    pairConstraint,
  });
  return { state: opened, detail: ctx.effectId };
}

/** RS catchall 効果のパターン別ランタイム解決。 */
export function tryRsCatchallRuntime(
  state: GameState,
  ctx: DslCardContext,
  pattern: string,
  interpret: InterpretFn,
): { state: GameState; detail?: string } | null {
  if (!isRsCatchallCard(ctx.sourceCardId)) return null;

  const effect = getDslEffectById(ctx.sourceCardId, ctx.effectId);
  const body = effect?.text ?? "";

  // RS-284【スワンウィング】は汎用の構造化プリミティブ（場のユニット選択）では表せないので先に処理する。
  if (pattern === "deploy_rush_area" && SWAN_WING_BODY.test(body)) {
    return handleDeployRush(state, ctx, body, interpret);
  }

  if (pattern === "deck_search_operation_to_power" && ctx.sourceCardId === "RS-201") {
    // RS-201【超電子ホログラフィー】: オペレーションのカードだけを選ぶ（rules/rs4NcEffects.ts）。
    return {
      state: openHolography(state, ctx.playerId, ctx.phasePlayerId, ctx.triggerSourceInstanceId),
      detail: ctx.effectId,
    };
  }

  if (ctx.sourceCardId === "RS-295" && ctx.effectId === "chikara_ken") {
    // RS-295【磁力拳】（rules/rs4NcEffects.ts）。
    return {
      state: openMagnetFist(state, ctx.playerId, ctx.phasePlayerId, ctx.triggerSourceInstanceId),
      detail: ctx.effectId,
    };
  }

  // 「…敵軍Sユニットを1体選び、持ち主のパワーゾーンにダメージにして置いてもよい」は、条件（特徴・BP・サイズ）と
  // 任意・ウラ向き（ダメージ）を扱うパターン別ハンドラで処理する（汎用の構造化プリミティブでは条件が落ちる）。
  // 「BPの合計が6000になるように隣り合う2体のSユニットを選び、持ち主のパワーゾーンに送ってもよい」（RS-355）。
  const adjacentPair = startAdjacentPairToPowerChoice(state, ctx, body);
  if (adjacentPair) return adjacentPair;

  const structured =
    pattern === "enemy_to_power_damage_generic" ? null : buildCatchallStructuredPrimitives(body, pattern);
  if (structured) {
    const rematchCtx = buildRematchContext(effect!, ctx);
    // 「…してもよい」「…ても良い」は任意（見送れる）。文言で判断する（R-EFF: 任意効果）。
    if (MAY_TEXT.test(body)) rematchCtx.optional = true;
    return interpret(state, rematchCtx, structured);
  }

  const handler = PATTERN_HANDLERS[pattern];
  if (handler) {
    return handler(state, ctx, body, interpret);
  }

  const extended = buildExtendedPrimitives(body, pattern);
  if (extended) {
    return interpret(state, buildRematchContext(effect!, ctx), extended);
  }

  if (PASSIVE_FIELD_PATTERNS.has(pattern) || PASSIVE_COMBO_PATTERNS.has(pattern)) {
    return {
      state: registerTurnKeyword(
        state,
        ctx.playerId,
        `rs_field_passive::${ctx.sourceCardId}::${ctx.effectId}`,
        ctx.sourceCardId,
        { pattern, body },
      ),
      detail: ctx.effectId,
    };
  }

  return {
    state: registerTurnKeyword(
      state,
      ctx.playerId,
      `rs_catchall::${ctx.sourceCardId}::${ctx.effectId}`,
      ctx.sourceCardId,
      { pattern, body },
    ),
    detail: ctx.effectId,
  };
}

export function tryRsCatchallOnEnemyRush(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
): { state: GameState; logs: string[] } {
  const rusher = state.players[rusherPlayerId];
  const rushed = [...rusher.rush, ...rusher.battle].find(
    (c) => c.instanceId === rushedInstanceId,
  );
  if (!rushed) return { state, logs: [] };

  let next = state;
  const logs: string[] = [];

  for (const playerId of ["player1", "player2"] as const) {
    if (playerId === rusherPlayerId) continue;
    const player = next.players[playerId];
    for (const mod of player.modifiers ?? []) {
      if (mod.kind !== "rule" || !mod.ruleId.startsWith("rs_destroy_on_enemy_rush_bp_le_")) {
        continue;
      }
      const maxBp = (mod.payload as { maxBp?: number })?.maxBp ?? 4000;
      const bp = effectiveBp(next, rusherPlayerId, rushed);
      if (bp > maxBp) continue;
      const destroyed = destroyUnit(next, rushedInstanceId, rusherPlayerId, phasePlayerId);
      if (destroyed) {
        next = destroyed;
        logs.push(`rs_destroy_on_enemy_rush:${rushed.cardId}`);
      }
    }
  }

  return { state: next, logs };
}

export { playerHasFieldCard };
