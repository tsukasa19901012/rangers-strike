/**
 * RS-222 タイムピンク【戦闘指揮】
 * 「自軍ターン中、Sユニットがこのユニットからコンビネーションするとき、そのユニットのＮＣの効果は、
 * ナンバーに関係なく発動できる。ただし、そのユニットのナンバーと同じ数だけ敵軍コマンドをリリースしなければならない。」
 *
 * 直前（左隣）がタイムピンクで、ナンバーと並び順が一致しない S ユニットが出たとき、敵軍のホールド状態の
 * コマンドがナンバー（コロン等で変わった値。faq-card-3 RS-140 Q2）以上あれば、発動するかを選ぶ（任意）。
 * 発動するなら敵軍コマンドをナンバーと同じ数だけリリースし、NC が成立したものとして扱う。
 * 出典: atwiki（RS-222）、grnrngr/faq-card-3 RS-140 Q2。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingEffectChoice, PlayerId } from "../types/game";
import { getDefinition, isSmallUnit } from "../core/catalog";
import { opponent, updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { openOptionalEffectConfirm, registerOptionalEffect } from "./optionalEffects";
import { ncGateAllows } from "./ncGatedEffects";
import { listNcColumnNamedEffects } from "@rangers-strike/cards";

export const BATTLE_COMMAND_EFFECT_ID = "battle_command";

const JUU_KUN_DO_IDS = new Set(["RS-106", "PR-006"]);

/** 【戦闘指揮】で成立させた【ジュウクンドー】を発動するときに、敵軍コマンドをリリースする。 */
export function payBattleCommandReleaseCost(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState | null {
  const player = state.players[playerId];
  const card = player.battle.find((c) => c.instanceId === instanceId);
  const cost = card?.battleCommandReleaseCost;
  if (!card || !cost) return state;
  const held = heldEnemyCommands(state, playerId);
  if (held.length < cost) return null;
  const toRelease = new Set(held.slice(0, cost));
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  const withRelease: GameState = {
    ...state,
    ...updatePlayer(state, enemyId, {
      ...enemy,
      command: enemy.command.map((c) => (toRelease.has(c.instanceId) ? { ...c, commandHeld: false } : c)),
    }),
  };
  const owner = withRelease.players[playerId];
  return {
    ...withRelease,
    ...updatePlayer(withRelease, playerId, {
      ...owner,
      battle: owner.battle.map((c) =>
        c.instanceId === instanceId ? { ...c, battleCommandReleaseCost: undefined } : c,
      ),
    }),
  };
}

/** 【戦闘指揮】のリリースを支払えるか（支払いが要らなければ true）。 */
export function canPayBattleCommandReleaseCost(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  const cost = card.battleCommandReleaseCost;
  return !cost || heldEnemyCommands(state, playerId).length >= cost;
}

type NcHooks = {
  ncEffectiveNumber: (state: GameState, playerId: PlayerId, card: CardInstance, def: CardDefinition) => number;
  hasNcEffect: (card: CardInstance) => boolean;
  /** NC が成立したものとして記録・発動する（並び順＝ナンバーとして扱う）。 */
  establishNc: (state: GameState, playerId: PlayerId, card: CardInstance, number: number) => { state: GameState; logs: string[] };
};

let hooks: NcHooks | undefined;

export function registerBattleCommandHooks(next: NcHooks): void {
  hooks = next;
}

const GRANT_NC_REGARDLESS_RE = /このユニットからコンビネーションするとき、そのユニットの[ＮN][ＣC]の効果は、ナンバーに関係なく発動できる/;

/**
 * 左隣のユニットが「Sユニットがこのユニットからコンビネーションするとき、そのユニットのＮＣの効果は、
 * ナンバーに関係なく発動できる」（【戦闘指揮】等）を、いま有効な効果として持つか。
 * ナンバーの欄（CN）の効果なら、そのユニット自身の NC が成立しているときだけ有効（R-CN-02。
 * RS-222 タイムピンクは CN4 なので4番目に出たときだけ）。
 */
function grantsNcRegardlessOfNumber(state: GameState, left: CardInstance): boolean {
  const named = listNcColumnNamedEffects(left.cardId).find((n) => GRANT_NC_REGARDLESS_RE.test(n.text ?? ""));
  if (named) return ncGateAllows(left, named.effectId);
  return GRANT_NC_REGARDLESS_RE.test(getDefinition(state.definitions, left.cardId)?.text ?? "");
}

function heldEnemyCommands(state: GameState, playerId: PlayerId): string[] {
  return state.players[opponent(playerId)].command.filter((c) => c.commandHeld).map((c) => c.instanceId);
}

/** 【戦闘指揮】で NC を発動できるなら、発動するかの確認を開く。 */
export function tryOpenBattleCommand(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  definition: CardDefinition,
  battlePosition: number,
  battleBeforeEnter: CardInstance[],
): GameState | null {
  if (!hooks || state.phase !== "battle" || state.activePlayer !== playerId) return null;
  if (state.pendingEffectChoice) return null;
  if (!isSmallUnit(state.definitions, card) || typeof definition.comboNumber !== "number") return null;
  const left = battleBeforeEnter.filter((c) => c.instanceId !== card.instanceId).at(-1);
  if (!left || !grantsNcRegardlessOfNumber(state, left)) return null;
  const number = hooks.ncEffectiveNumber(state, playerId, card, definition);
  if (number === battlePosition) return null;
  if (!hooks.hasNcEffect(card)) return null;
  if (heldEnemyCommands(state, playerId).length < number) return null;
  if (JUU_KUN_DO_IDS.has(card.cardId)) {
    // 【ジュウクンドー】は「アタックするかわりに…発動できる」効果なので、発動するとき（use_juu_kun_do）に
    // 敵軍コマンドをリリースする（rules/juuKunDo.ts）。ここでは NC の成立だけを記録する。
    const player = state.players[playerId];
    return {
      ...state,
      ...updatePlayer(state, playerId, {
        ...player,
        battle: player.battle.map((c) =>
          c.instanceId === card.instanceId
            ? {
                ...c,
                activatedNcEffects: [...new Set([...(c.activatedNcEffects ?? []), "juu_kun_do"])],
                battleCommandReleaseCost: number,
              }
            : c,
        ),
      }),
    };
  }
  return openOptionalEffectConfirm(state, {
    playerId,
    effectId: BATTLE_COMMAND_EFFECT_ID,
    sourceCardId: left.cardId,
    sourceInstanceId: card.instanceId,
    phasePlayerId: playerId,
  });
}

registerOptionalEffect(BATTLE_COMMAND_EFFECT_ID, {
  apply: (state: GameState, pending: PendingEffectChoice) => {
    if (!hooks || !pending.sourceInstanceId) return state;
    const playerId = pending.playerId;
    const card = state.players[playerId].battle.find((c) => c.instanceId === pending.sourceInstanceId);
    const definition = card ? getDefinition(state.definitions, card.cardId) : undefined;
    if (!card || !definition) return state;
    const number = hooks.ncEffectiveNumber(state, playerId, card, definition);
    const enemyId = opponent(playerId);
    const toRelease = new Set(heldEnemyCommands(state, playerId).slice(0, number));
    if (toRelease.size < number) return state;
    const enemy = state.players[enemyId];
    let next: GameState = {
      ...state,
      ...updatePlayer(state, enemyId, {
        ...enemy,
        command: enemy.command.map((c) => (toRelease.has(c.instanceId) ? { ...c, commandHeld: false } : c)),
      }),
    };
    const established = hooks.establishNc(next, playerId, card, number);
    next = established.state;
    return {
      ...next,
      log: [
        ...next.log,
        buildLogEntry(playerId, "named_effect", pending.sourceCardId, state.definitions, BATTLE_COMMAND_EFFECT_ID),
        ...established.logs,
      ],
    };
  },
});
