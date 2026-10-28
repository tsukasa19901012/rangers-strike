// Deck sharing panels, drawn over the deck builder or the title screen:
//   share  the deck as a QR code, its URL and its text list (共有する);
//   open   a deck from a shared URL, to save and edit or play;
//   paste  a card list typed or pasted into a text box (テキストから取り込む);
//   list   the deck in the builder as card images (デッキ一覧), drawn like open.
// Drawn at fixed rectangles like SettingsPanel; the app hit-tests clicks
// (deckPanelHit). The copy and save buttons are pressed in the host page
// itself (host/host.js "rs.actions"): the clipboard and the share sheet only
// work inside the click, not a frame later.
import { Index, Show } from "solid-js";
import { Text, View } from "@pocketjs/framework/solid/components";
import { fitLine, type DeckEntry, type ImportedDeck } from "@rangers-strike/client-core";
import { qrTexture, type QrBits } from "./qr";
import { at, CardFace, inside, TextureImage, type Box } from "./ui";

export type DeckPanel =
  | {
      kind: "share";
      name: string;
      entries: DeckEntry[];
      text: string;
      /** null while the short URL is being made. */
      url: string | null;
      qr: QrBits | null;
    }
  | { kind: "open"; deck: ImportedDeck; check: { ok: boolean; total: number; errors: string[] } }
  | { kind: "paste"; text: string; parsed: ImportedDeck }
  | { kind: "list"; name: string; entries: DeckEntry[]; check: { ok: boolean; total: number; errors: string[] } };

/** Buttons the guest handles. */
export type PanelAction = "close" | "edit" | "play" | "skip" | "import" | "cancel" | "save" | "share";
/** Buttons the host page handles inside the click. */
export type HostActionId = "copyUrl" | "copyText" | "saveQr";

type Button = { id: PanelAction | HostActionId; rect: Box; label: string; primary?: boolean; enabled: boolean };

export type DeckPanelLayout = {
  frame: Box;
  title: Box;
  lines: { rect: Box; text: string; tone: "head" | "dim" | "warn" | "ok" }[];
  buttons: Button[];
  qr?: Box;
  url?: Box;
  /** The paste box (the host's textarea sits on it). */
  textBox?: Box;
  cards: { cardId: string; count: number; rect: Box }[];
};

const PAD = 16;
const BUTTON_H = 40;
const fit = (text: string, w: number, px = 14) => fitLine(text, { fontPx: px, maxWidthPx: w });
const sum = (entries: readonly DeckEntry[]) => entries.reduce((n, e) => n + e.count, 0);

export const PASTE_PLACEHOLDER = [
  "デッキ共有の「テキストでコピー」で写したカードリストを、ここに貼り付けてください。",
  "",
  "書き方",
  "・1行に1種類ずつ、「枚数 カードID カード名」の順に書きます",
  "・カード名は省略できます（カードIDだけで読み込めます）",
  "・枚数は「RS-421 ×3」のように後ろに書いても大丈夫です",
  "・1行目の「# デッキ名」はデッキ名として使います",
  "・ほかの「#」で始まる行はメモとして読み飛ばします",
  "",
  "例",
  "# 赤の戦士デッキ",
  "3 RS-057 マジレッド",
  "2 RS-148",
  "RS-421 ×3",
].join("\n");

function shareLayout(p: Extract<DeckPanel, { kind: "share" }>, width: number, height: number): DeckPanelLayout {
  const portrait = width < height;
  const w = portrait ? width - 24 : Math.min(580, width - 40);
  const iw = w - PAD * 2;
  const qrSize = portrait ? Math.min(190, iw) : 200;
  const h = portrait ? PAD + 26 + 22 + 20 + 12 + qrSize + 8 + 36 + 14 + 36 + 8 + BUTTON_H + 8 + BUTTON_H + 4 + 20 + 12 + BUTTON_H + PAD : PAD + 26 + 22 + 20 + 12 + qrSize + 8 + 36 + 16 + BUTTON_H + PAD;
  const frame = { x: Math.round((width - w) / 2), y: Math.max(8, Math.round((height - h) / 2)), w, h };
  const x = frame.x + PAD;
  let y = frame.y + PAD;
  const title = { x, y, w: iw, h: 26 };
  y += 26;
  const total = sum(p.entries);
  const lines: DeckPanelLayout["lines"] = [
    { rect: { x, y, w: iw, h: 22 }, text: fit(p.name, iw), tone: "head" },
    { rect: { x, y: y + 22, w: iw, h: 20 }, text: `${total}枚・${p.entries.length}種類`, tone: "dim" },
  ];
  y += 42 + 12;
  const ready = !!p.url;
  const buttons: Button[] = [];
  let qr: Box;
  let url: Box;
  if (portrait) {
    qr = { x: frame.x + Math.round((w - qrSize) / 2), y, w: qrSize, h: qrSize };
    y += qrSize + 8;
    buttons.push({ id: "saveQr", rect: { x: qr.x, y, w: qrSize, h: 36 }, label: "QR画像を保存", enabled: ready });
    y += 36 + 14;
    url = { x, y, w: iw, h: 36 };
    y += 36 + 8;
    buttons.push({ id: "copyUrl", rect: { x, y, w: iw, h: BUTTON_H }, label: "URLをコピー", primary: true, enabled: ready });
    y += BUTTON_H + 8;
    buttons.push({ id: "copyText", rect: { x, y, w: iw, h: BUTTON_H }, label: "テキスト（カードリスト）でコピー", enabled: true });
    y += BUTTON_H + 4;
    lines.push({ rect: { x, y, w: iw, h: 20 }, text: fit("QRはスマホのカメラで読むとこのデッキが開きます", iw, 12), tone: "dim" });
    y += 20 + 12;
  } else {
    qr = { x, y, w: qrSize, h: qrSize };
    buttons.push({ id: "saveQr", rect: { x, y: y + qrSize + 8, w: qrSize, h: 36 }, label: "QR画像を保存", enabled: ready });
    const rx = x + qrSize + 16;
    const rw = frame.x + w - PAD - rx;
    url = { x: rx, y, w: rw, h: 36 };
    buttons.push({ id: "copyUrl", rect: { x: rx, y: y + 36 + 10, w: rw, h: BUTTON_H }, label: "URLをコピー", primary: true, enabled: ready });
    buttons.push({ id: "copyText", rect: { x: rx, y: y + 36 + 10 + BUTTON_H + 8, w: rw, h: BUTTON_H }, label: "テキスト（カードリスト）でコピー", enabled: true });
    lines.push({ rect: { x: rx, y: y + 36 + 10 + (BUTTON_H + 8) * 2, w: rw, h: 20 }, text: fit("QRはスマホのカメラで読むとこのデッキが開きます", rw, 12), tone: "dim" });
    y += qrSize + 8 + 36 + 16;
  }
  buttons.push({ id: "close", rect: { x, y, w: iw, h: BUTTON_H }, label: "閉じる", enabled: true });
  return { frame, title, lines, buttons, qr, url, cards: [] };
}

type GridDeck = { name: string; entries: DeckEntry[]; check: { ok: boolean; errors: string[] }; unreadable: number };
type LabelRow = [PanelAction, string, boolean, boolean];

/** A deck as card images with ×N counts, then its buttons (a phone stacks them): the open and list panels. */
function cardGridLayout(p: GridDeck, labels: LabelRow[], width: number, height: number): DeckPanelLayout {
  const portrait = width < height;
  const w = portrait ? width - 24 : Math.min(840, width - 40);
  const iw = w - PAD * 2;
  const gap = 6;
  const unreadable = p.unreadable > 0;
  const buttonsH = portrait ? BUTTON_H * labels.length + 8 * (labels.length - 1) : BUTTON_H;
  const fixedH = PAD + 26 + 22 + 20 + (unreadable ? 20 : 0) + 10 + 14 + buttonsH + PAD;
  // As many columns as it takes for every card to fit on the screen.
  const n = p.entries.length;
  let cols = portrait ? 5 : 10;
  const tile = () => {
    const tw = Math.floor((iw - gap * (cols - 1)) / cols);
    return { w: tw, h: Math.round((tw * 88) / 63) };
  };
  while (cols < 20 && Math.ceil(n / cols) * (tile().h + gap) > height - 16 - fixedH) cols++;
  const t = tile();
  const gridH = Math.ceil(n / cols) * (t.h + gap) - gap;
  const h = fixedH + gridH;
  const frame = { x: Math.round((width - w) / 2), y: Math.max(8, Math.round((height - h) / 2)), w, h };
  const x = frame.x + PAD;
  let y = frame.y + PAD;
  const title = { x, y, w: iw, h: 26 };
  y += 26;
  const total = sum(p.entries);
  const status = p.check.ok ? "対戦可" : (p.check.errors[0] ?? "このままでは対戦できません");
  const lines: DeckPanelLayout["lines"] = [
    { rect: { x, y, w: iw, h: 22 }, text: fit(p.name || "名前なし", iw), tone: "head" },
    { rect: { x, y: y + 22, w: iw, h: 20 }, text: fit(`${total}枚・${n}種類・${status}`, iw, 13), tone: p.check.ok ? "dim" : "warn" },
  ];
  y += 42;
  if (unreadable) {
    lines.push({ rect: { x, y, w: iw, h: 20 }, text: fit(`この版にないカードを${p.unreadable}種類読み飛ばしました`, iw, 13), tone: "warn" });
    y += 20;
  }
  y += 10;
  const cards = p.entries.map((e, i) => ({
    cardId: e.cardId,
    count: e.count,
    rect: { x: x + (i % cols) * (t.w + gap), y: y + Math.floor(i / cols) * (t.h + gap), w: t.w, h: t.h },
  }));
  y += gridH + 14;
  const buttons: Button[] = portrait
    ? labels.map(([id, label, primary, enabled], i) => ({ id, label, primary, enabled, rect: { x, y: y + i * (BUTTON_H + 8), w: iw, h: BUTTON_H } }))
    : (() => {
        const bw = Math.floor((iw - 8 * (labels.length - 1)) / labels.length);
        return labels.map(([id, label, primary, enabled], i) => ({ id, label, primary, enabled, rect: { x: x + i * (bw + 8), y, w: bw, h: BUTTON_H } }));
      })();
  return { frame, title, lines, buttons, cards };
}

function openLayout(p: Extract<DeckPanel, { kind: "open" }>, width: number, height: number): DeckPanelLayout {
  const deck = { name: p.deck.name, entries: p.deck.entries, check: p.check, unreadable: p.deck.unreadable.length };
  return cardGridLayout(
    deck,
    [
      ["edit", "保存してデッキ構築で開く", true, true],
      ["play", "保存して自分のデッキで対戦", false, p.check.ok],
      ["skip", "取り込まない", false, true],
    ],
    width,
    height,
  );
}

function listLayout(p: Extract<DeckPanel, { kind: "list" }>, width: number, height: number): DeckPanelLayout {
  return cardGridLayout(
    { ...p, unreadable: 0 },
    [
      ["save", "保存して戻る", true, true],
      ["close", "編集を続ける", false, true],
      ["share", "共有する", false, true],
    ],
    width,
    height,
  );
}

function pasteLayout(p: Extract<DeckPanel, { kind: "paste" }>, width: number, height: number): DeckPanelLayout {
  const portrait = width < height;
  const w = portrait ? width - 24 : Math.min(640, width - 40);
  const iw = w - PAD * 2;
  // A phone keeps 16 px type in the box (smaller makes iOS zoom in): it gets the height for the whole placeholder.
  const boxH = portrait ? Math.min(720, height - 250) : Math.min(440, height - 200);
  const h = PAD + 30 + boxH + 8 + 20 + 8 + BUTTON_H + PAD;
  const frame = { x: Math.round((width - w) / 2), y: Math.max(8, Math.round((height - h) / 2)), w, h };
  const x = frame.x + PAD;
  let y = frame.y + PAD;
  const title = { x, y, w: iw, h: 26 };
  y += 30;
  const textBox = { x, y, w: iw, h: boxH };
  y += boxH + 8;
  const lines: DeckPanelLayout["lines"] = [];
  const bad = p.parsed.unreadable;
  if (bad.length) lines.push({ rect: { x, y, w: iw, h: 20 }, text: fit(`読めなかった行が${bad.length}行あります: 「${bad[0]}」`, iw, 13), tone: "warn" });
  else if (p.parsed.entries.length) lines.push({ rect: { x, y, w: iw, h: 20 }, text: fit(`${sum(p.parsed.entries)}枚・${p.parsed.entries.length}種類を読み込めます`, iw, 13), tone: "ok" });
  y += 20 + 8;
  const total = sum(p.parsed.entries);
  const cancelW = Math.round(iw * 0.3);
  const buttons: Button[] = [
    { id: "import", rect: { x, y, w: iw - cancelW - 8, h: BUTTON_H }, label: total ? `${total}枚を取り込む` : "取り込む", primary: true, enabled: total > 0 },
    { id: "cancel", rect: { x: x + iw - cancelW, y, w: cancelW, h: BUTTON_H }, label: "やめる", enabled: true },
  ];
  return { frame, title, lines, buttons, textBox, cards: [] };
}

export function deckPanelLayout(panel: DeckPanel, width: number, height: number): DeckPanelLayout {
  if (panel.kind === "share") return shareLayout(panel, width, height);
  if (panel.kind === "open") return openLayout(panel, width, height);
  if (panel.kind === "list") return listLayout(panel, width, height);
  return pasteLayout(panel, width, height);
}

export const PANEL_TITLES: Record<DeckPanel["kind"], string> = { share: "デッキを共有", open: "共有されたデッキ", paste: "テキストから取り込む", list: "デッキ一覧" };

const HOST_ACTIONS = new Set<string>(["copyUrl", "copyText", "saveQr"]);
export const isHostAction = (id: string): id is HostActionId => HOST_ACTIONS.has(id);

/** The enabled button at `p`, "outside" off the panel, or null. */
export function deckPanelHit(layout: DeckPanelLayout, p: { x: number; y: number }): Button["id"] | "outside" | null {
  if (!inside(layout.frame, p)) return "outside";
  const button = layout.buttons.find((b) => inside(b.rect, p));
  return button?.enabled ? button.id : null;
}

const TONES = { head: "text-sm text-white font-bold", dim: "text-sm text-slate-400", warn: "text-sm text-amber-300", ok: "text-sm text-emerald-300" } as const;

export function DeckSharePanelView(props: { panel: DeckPanel; layout: DeckPanelLayout; width: number; height: number; hot: string | null; notice: string | null }) {
  const l = () => props.layout;
  const share = () => (props.panel.kind === "share" ? props.panel : null);
  const qrHandle = () => {
    const qr = share()?.qr;
    return qr ? qrTexture(qr) : -1;
  };
  return (
    <>
      <View class="absolute bg-[#020617c8]" style={at({ x: 0, y: 0, w: props.width, h: props.height })} />
      <View class="absolute rounded-[12] bg-[#0b1220f5] border-[2] border-sky-400 shadow-lg" style={at(l().frame)} />
      <View class="absolute flex-row items-center" style={at(l().title)}>
        <Text class="text-base text-sky-300 font-bold">{PANEL_TITLES[props.panel.kind]}</Text>
      </View>
      <Index each={l().lines}>
        {(line) => (
          <View class="absolute flex-row items-center" style={at(line().rect)}>
            <Text class={TONES[line().tone]}>{line().text}</Text>
          </View>
        )}
      </Index>
      <Show when={l().qr}>
        {(box) => (
          <View class="absolute flex-row items-center justify-center rounded-[6] bg-white" style={at(box())}>
            <Show when={qrHandle() >= 0} fallback={<Text class="text-sm text-slate-500">{share()?.url ? "QR" : "作成中…"}</Text>}>
              <TextureImage texture={qrHandle()} style={{ posType: 1, insetL: 0, insetT: 0, width: box().w, height: box().h }} />
            </Show>
          </View>
        )}
      </Show>
      <Show when={l().url}>
        {(box) => (
          <View class="absolute flex-row items-center px-[10] rounded-[8] bg-[#0b1220] border border-[#475569]" style={at(box())}>
            <Text class="text-sm text-slate-200">{share()?.url ? fit(share()!.url!, box().w - 22, 14) : "URL を作成中…"}</Text>
          </View>
        )}
      </Show>
      <Show when={l().textBox}>{(box) => <View class="absolute rounded-[8] bg-[#0b1220] border border-[#475569]" style={at(box())} />}</Show>
      <Index each={l().cards}>
        {(card) => (
          <>
            <CardFace cardId={card().cardId} rect={card().rect} />
            <View
              class="absolute flex-row items-center justify-center rounded-[10] bg-gradient-to-r from-amber-400 to-orange-500 border-[2] border-white"
              style={at({ x: card().rect.x + card().rect.w - 36, y: card().rect.y + card().rect.h - 22, w: 34, h: 20 })}
            >
              <Text class="text-xs text-slate-950 font-bold">{`×${card().count}`}</Text>
            </View>
          </>
        )}
      </Index>
      <Index each={l().buttons}>
        {(button) => (
          <View
            class={
              !button().enabled
                ? "absolute flex-row items-center justify-center rounded-[8] bg-[#1e293b80] border border-[#334155]"
                : button().primary
                  ? props.hot === button().id
                    ? "absolute flex-row items-center justify-center rounded-[8] bg-gradient-to-r from-sky-500 to-blue-600 border border-sky-200"
                    : "absolute flex-row items-center justify-center rounded-[8] bg-gradient-to-r from-sky-600 to-blue-700 border border-sky-400"
                  : props.hot === button().id
                    ? "absolute flex-row items-center justify-center rounded-[8] bg-slate-600 border border-slate-400"
                    : "absolute flex-row items-center justify-center rounded-[8] bg-[#1e293b] border border-[#334155]"
            }
            style={at(button().rect)}
          >
            <Text class={!button().enabled ? "text-sm text-slate-500" : button().primary ? "text-sm text-white font-bold" : "text-sm text-slate-100"}>
              {fit(button().label, button().rect.w - 12)}
            </Text>
          </View>
        )}
      </Index>
      <Show when={props.notice}>
        <View
          class="absolute flex-row items-center justify-center rounded-[16] bg-gradient-to-r from-emerald-600 to-teal-700 shadow-md"
          style={at({ x: Math.round(props.width / 2 - Math.min(160, props.width / 2 - 12)), y: Math.max(6, l().frame.y - 40), w: Math.min(320, props.width - 24), h: 32 })}
        >
          <Text class="text-sm text-white font-bold">{props.notice}</Text>
        </View>
      </Show>
    </>
  );
}
