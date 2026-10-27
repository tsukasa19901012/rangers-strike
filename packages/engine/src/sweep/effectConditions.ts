/**
 * 効果の条件の確認（effectsAllCards.test.ts の「条件」）。「敵軍ビークルが2体以上あれば、…」のように、盤面で決まる条件の
 * 後に動きが書かれた文について、条件を満たす盤面では動きが起き、満たさない盤面では起きないことを確かめる。
 *
 * 条件の書き方ごとに、満たす／満たさない盤面の作り方（Tweak）を下の CONDITIONS に書く。書き方が無い条件は確かめない。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerState } from "../types/game";
import { mk, type Tweak } from "./effectBoard";
import { abilityText, verbsOf } from "./effectResult";
import { all, plainUnits, real } from "./rushBoard";

type Players = GameState["players"];
const withPlayers = (s: GameState, f: (p: Players) => Partial<Players>): GameState => ({ ...s, players: { ...s.players, ...f(s.players) } });
const set = (s: GameState, id: "player1" | "player2", patch: Partial<PlayerState>): GameState => withPlayers(s, (p) => ({ [id]: { ...p[id], ...patch } }));

const def = (id: string) => all.find((d) => d.id === id);
const isVehicle = (cardId: string) => def(cardId)?.type === "vehicle";
const hasFeature = (cardId: string, f: string) => (def(cardId)?.features ?? []).includes(f);
const sVehicle = all.find((d) => real(d) && d.type === "vehicle" && d.size === "S" && !/※/.test(d.text ?? ""))!;
const sUnit = plainUnits[0]!;
const byName = (name: string) => all.find((d) => real(d) && (d.type === "unit" || d.type === "vehicle") && d.name === name);
const withFeature = (f: string, size = "S") => all.find((d) => real(d) && d.type === "unit" && d.size === size && (d.features ?? []).includes(f));

/** 条件の書き方と、満たす（true）／満たさない（false）盤面の作り方。 */
const CONDITIONS: Array<{ text: RegExp; tweak: (m: RegExpExecArray, satisfied: boolean) => Tweak | null }> = [
  {
    text: /^敵軍ビークルが(\d+)体以上あれば$/,
    tweak: (m, sat) => (s) => {
      const n = Number(m[1]) - (sat ? 0 : 1);
      const battle = s.players.player2.battle.filter((c) => !isVehicle(c.cardId));
      return set(s, "player2", { battle: [...battle, ...Array.from({ length: n }, () => mk(sVehicle.id))] });
    },
  },
  {
    text: /^敵軍バトルエリアのユニットが(\d+)体なら$/,
    tweak: (m, sat) => (s) => set(s, "player2", { battle: s.players.player2.battle.slice(0, Number(m[1]) + (sat ? 0 : -1)) }),
  },
  {
    text: /^敵軍バトルエリアのユニットがSユニット1体だけなら$/,
    tweak: (_m, sat) => (s) => set(s, "player2", { battle: sat ? [mk(sUnit.id)] : [mk(sUnit.id), mk(sUnit.id)] }),
  },
  {
    // 支払いでホールドした後のことなので、満たさない盤面は支払いの分（buildRushBoard の「#」のカード）だけにする
    text: /^リリース状態の自軍コマンドがあれば$/,
    tweak: (_m, sat) => (sat ? (s) => s : (s) => set(s, "player1", { command: s.players.player1.command.filter((c) => c.instanceId.includes("#")) })),
  },
  {
    text: /^敵軍パワーゾーンにダメージになっているカードがあれば$/,
    tweak: (_m, sat) => (s) =>
      set(s, "player2", { power: s.players.player2.power.map((c, i) => ({ ...c, faceDown: sat && i === 0 })), damage: sat ? 1 : 0 }),
  },
  {
    text: /^ライドされていないSビークルがあれば$/,
    tweak: (_m, sat) => (s) =>
      withPlayers(s, (p) => ({
        player1: { ...p.player1, rush: p.player1.rush.filter((c) => !isVehicle(c.cardId)), battle: p.player1.battle.filter((c) => !isVehicle(c.cardId)) },
        player2: {
          ...p.player2,
          rush: [...p.player2.rush.filter((c) => !isVehicle(c.cardId)), ...(sat ? [mk(sVehicle.id)] : [])],
          battle: p.player2.battle.filter((c) => !isVehicle(c.cardId)),
        },
      })),
  },
  {
    text: /^自軍エリアに「([^」]+)」があれば$/,
    tweak: (m, sat) => {
      const named = byName(m[1]!);
      if (!named) return null;
      return (s) => {
        const p1 = s.players.player1;
        const drop = (cs: typeof p1.rush) => cs.filter((c) => def(c.cardId)?.name !== m[1]);
        return set(s, "player1", { rush: [...drop(p1.rush), ...(sat ? [mk(named.id)] : [])], battle: drop(p1.battle) });
      };
    },
  },
  {
    text: /^お互いのダメージの点数が違うなら$/,
    tweak: (_m, sat) => (s) => {
      const damaged = (p: PlayerState, n: number) => ({ power: p.power.map((c, i) => ({ ...c, faceDown: i < n })), damage: n });
      return withPlayers(s, (p) => ({
        player1: { ...p.player1, ...damaged(p.player1, 0) },
        player2: { ...p.player2, ...damaged(p.player2, sat ? 2 : 0) },
      }));
    },
  },
  {
    text: /^敵軍コマンドゾーンか、敵軍パワーゾーンのダメージ以外のカードに特徴「([^」]+)」を持つユニットカードがあれば$/,
    tweak: (m, sat) => {
      const f = m[1]!;
      const unit = withFeature(f);
      if (!unit) return null;
      return (s) => {
        const p2 = s.players.player2;
        const command = p2.command.filter((c) => !hasFeature(c.cardId, f));
        const power = p2.power.filter((c) => c.faceDown || !hasFeature(c.cardId, f));
        return set(s, "player2", { command: sat ? [...command.slice(0, 4), mk(unit.id, { commandHeld: false })] : command, power });
      };
    },
  },
];

export type ConditionPlan = { condition: string; verbs: string[]; tweak: (satisfied: boolean) => Tweak | null };

/** 本文の条件の文を読む。条件の書き方が CONDITIONS に無い、動きが書かれていない、他の文にも同じ動きがあるものは null。 */
export function conditionPlan(card: CardDefinition, trigger?: RegExp): ConditionPlan | null {
  const seg = abilityText(card, trigger);
  if (!seg) return null;
  const sentences = seg.split("。").map((x) => x.trim()).filter(Boolean);
  const first = sentences[0] ?? "";
  const m = /^(.+?(なら|あれば))、?(.+)$/.exec(first);
  if (!m) return null;
  const condition = m[1]!;
  const body = m[3]!.replace(/^次の効果を発動(でき|す)る[⇒→]/, "");
  const verbs = verbsOf(body);
  if (verbs.length === 0) return null;
  // 「9体以下なら、…撃破する」のように、条件を満たさないときの文にも同じ動きがあると、満たさない盤面で起きないとは言えない
  if (sentences.slice(1).some((x) => verbsOf(x).some((v) => verbs.includes(v)))) return null;
  for (const c of CONDITIONS) {
    const cm = c.text.exec(condition);
    if (cm) return { condition, verbs, tweak: (sat) => c.tweak(cm, sat) };
  }
  return null;
}
