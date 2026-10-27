/**
 * 効果の結果の確認（effectsAllCards.test.ts の「結果」）。効果の文の動詞（破壊する・引く・手札に戻す・ホールドする等）
 * ごとに、盤面でカードがそのとおりに動いたかを、使う前と後のカードの置き場所を比べて確かめる。
 *
 * 比べるのはカードの置き場所（どちらの、どのゾーン）とホールド・オモテ／ウラ、ダメージだけ。BP・能力の付与・
 * 山札の並びは見ない。使ったカード自身と、その支払い・追加条件で動かしたカードは比べない（effectBoard の drive が集める）。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";

type Place = { owner: PlayerId; zone: string; held: boolean; faceDown: boolean };

const FIELD = new Set(["battle", "rush"]);
// プレイヤーの他の配列（modifiers 等）はカードを指すだけなので見ない。
const ZONES = ["deck", "hand", "discard", "power", "command", "rush", "battle", "operation", "exile", "commander"] as const;

/** カードごとの置き場所。重なったカード（ユニットの下等）は「battle/下のキー」のように置き場所に入れる。 */
export function placesOf(state: GameState): Map<string, Place> {
  const out = new Map<string, Place>();
  const walk = (owner: PlayerId, zone: string, cards: unknown) => {
    if (!Array.isArray(cards)) return;
    for (const c of cards) {
      if (!c || typeof c !== "object" || !("instanceId" in c)) continue;
      const card = c as Record<string, unknown>;
      out.set(String(card.instanceId), { owner, zone, held: card.commandHeld === true, faceDown: card.faceDown === true });
      for (const [k, v] of Object.entries(card)) if (Array.isArray(v)) walk(owner, `${zone}/${k}`, v);
    }
  };
  for (const owner of ["player1", "player2"] as const) {
    for (const zone of ZONES) walk(owner, zone, state.players[owner][zone]);
  }
  return out;
}

export type Move = { id: string; from?: Place; to?: Place };

/** 使う前と後で置き場所・ホールド・オモテウラが変わったカード（excluded は除く）。 */
export function movesBetween(before: GameState, after: GameState, excluded: ReadonlySet<string>): Move[] {
  const a = placesOf(before);
  const b = placesOf(after);
  const moves: Move[] = [];
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    if (excluded.has(id)) continue;
    const from = a.get(id);
    const to = b.get(id);
    if (from && to && from.owner === to.owner && from.zone === to.zone && from.held === to.held && from.faceDown === to.faceDown) continue;
    moves.push({ id, from, to });
  }
  return moves;
}

const top = (p?: Place) => p?.zone.split("/")[0];
const moved = (m: Move, from: (z?: string) => boolean, to: (z?: string) => boolean) =>
  (top(m.from) !== top(m.to) || m.from?.owner !== m.to?.owner) && from(top(m.from)) && to(top(m.to));
const any = () => true;
const is = (...zones: string[]) => (z?: string) => z !== undefined && zones.includes(z);
const onField = (z?: string) => z !== undefined && FIELD.has(z);

/** 効果の文の動詞と、それが起きたと言える動き。 */
const VERBS: Array<{ name: string; text: RegExp; seen: (moves: Move[], before: GameState, after: GameState) => boolean }> = [
  { name: "撃破", text: /撃破する|破壊する/, seen: (ms) => ms.some((m) => moved(m, onField, (z) => !onField(z))) },
  { name: "引く", text: /\d枚引く|カードを引く|ドローする/, seen: (ms) => ms.some((m) => moved(m, is("deck"), is("hand"))) },
  { name: "手札に戻す", text: /手札に戻す/, seen: (ms) => ms.some((m) => moved(m, (z) => z !== "hand", is("hand"))) },
  { name: "手札に加える", text: /手札に加える/, seen: (ms) => ms.some((m) => moved(m, (z) => z !== "hand", is("hand"))) },
  { name: "捨札にする", text: /捨札にする|捨札に置く/, seen: (ms) => ms.some((m) => moved(m, any, is("discard"))) },
  { name: "ラッシュエリアに戻す", text: /ラッシュエリアに戻す/, seen: (ms) => ms.some((m) => moved(m, is("battle"), is("rush"))) },
  { name: "バトルエリアに出す", text: /バトルエリアに出す/, seen: (ms) => ms.some((m) => moved(m, any, is("battle"))) },
  { name: "ラッシュエリアに出す", text: /ラッシュエリアに出す|ラッシュエリアに置く/, seen: (ms) => ms.some((m) => moved(m, any, is("rush"))) },
  { name: "山札に戻す", text: /山札の(上|下)に(戻す|置く)|山札に戻す|山札に加え/, seen: (ms) => ms.some((m) => moved(m, any, is("deck"))) },
  { name: "パワーゾーンに置く", text: /パワーゾーンに置く/, seen: (ms) => ms.some((m) => moved(m, any, is("power"))) },
  { name: "除外", text: /除外する|ゲームから取り除く/, seen: (ms) => ms.some((m) => moved(m, any, is("exile"))) },
  { name: "ホールドする", text: /ホールドする/, seen: (ms) => ms.some((m) => top(m.to) === "command" && m.to?.held === true && m.from?.held !== true) },
  { name: "リリースする", text: /リリースする/, seen: (ms) => ms.some((m) => top(m.from) === "command" && m.from?.held === true && m.to?.held === false) },
  {
    name: "ダメージ",
    text: /ダメージを(\d|与え)|ダメージ\+|ダメージを受ける/,
    seen: (_ms, b, a) => (["player1", "player2"] as const).some((p) => a.players[p].damage !== b.players[p].damage),
  },
];

/**
 * 効果の文のうち、必ず起きる最初の 1 文。trigger（「これをラッシュしたとき」等）を含む【能力】の、trigger の後の最初の文
 * （trigger が無ければ本文の最初の文）。条件・分岐・選択肢・能力の付与・山札をオモテにする等を含む文は、
 * 盤面や選び方しだいで起きないことがあるので null（確かめない）。※の注記と「〜しなければ」の条件文は先に除く。
 */
export function certainSentence(card: CardDefinition, trigger?: RegExp): string | null {
  const text = (card.text ?? "").normalize("NFKC").replace(/※[^【。]*。?/g, "");
  let seg = text;
  if (trigger) {
    const part = text.split(/(?=【)/).find((p) => trigger.test(p));
    if (!part) return null;
    // 「自軍の手札が1枚のとき次の能力を得る⇒…これがバトルエリアに出たとき」のように、trigger の前に条件があるものは確かめない
    if (/能力を得|なら|とき|場合/.test(part.slice(0, part.search(trigger)))) return null;
    seg = part.slice(part.search(trigger)).replace(/^[^、]*、/, "");
  }
  seg = seg.replace(/[^。]*しなければ[^。]*。/g, "").trim();
  const sentence = seg.split("。")[0] ?? "";
  if (!sentence || UNCERTAIN.test(sentence)) return null;
  return sentence;
}

const UNCERTAIN =
  /なら|場合|とき|たび|ごとに|につき|か、|かを選|か(撃破|ホールド|リリース|捨札)|◎|⇒|→|次の効果|能力を得|オモテに|見て|見せ|まで|好きな|できる|ターン中|間、|常駐|ただし|代わりに|以外/;

/** 文に書かれているのに盤面で起きなかった動詞。「このカードを…」「これを…」の文は、使ったカード自身の動きも見る。 */
export function missingVerbs(
  sentence: string,
  before: GameState,
  after: GameState,
  excluded: ReadonlySet<string>,
  sourceInstanceId: string,
): string[] {
  const skip = /^(このカード|これ)を/.test(sentence) ? new Set([...excluded].filter((id) => id !== sourceInstanceId)) : excluded;
  const moves = movesBetween(before, after, skip);
  return VERBS.filter((v) => v.text.test(sentence) && !v.seen(moves, before, after)).map((v) => v.name);
}
