// Japanese-aware line wrapping. Renderers without automatic CJK line breaking
// (PocketJS baked glyph atlases) receive pre-wrapped lines from here, so the
// result is identical on every platform.

/** Approximate advance of one character in px for a font of `fontPx`. */
export type CharWidth = (ch: string, fontPx: number) => number;

/** Full-width (CJK, kana, full-width forms) characters advance one em. */
export function isWide(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0x303e) ||
    (cp >= 0x3041 && cp <= 0x33ff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x20000 && cp <= 0x3fffd) ||
    // Geometric shapes and arrows used in card text (◎ ⇒ ※ ★ ●) render one em
    // in the Japanese fallback face.
    (cp >= 0x2190 && cp <= 0x21ff) ||
    (cp >= 0x25a0 && cp <= 0x25ff) ||
    (cp >= 0x2600 && cp <= 0x26ff) ||
    cp === 0x203b
  );
}

/** Default metric: wide = 1 em, everything else ≈ 0.62 em (Inter digits/latin). */
export const defaultCharWidth: CharWidth = (ch, fontPx) => (isWide(ch) ? fontPx : fontPx * 0.62);

export function measureText(text: string, fontPx: number, width: CharWidth = defaultCharWidth): number {
  let total = 0;
  for (const ch of text) total += width(ch, fontPx);
  return total;
}

/** 行頭禁則: characters that must not start a line. */
const NO_LINE_START = new Set(
  Array.from("、。，．,.)）]］｝」』】〕〉》’”・ー～ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ!?！？:;：；%％"),
);
/** 行末禁則: characters that must not end a line. */
const NO_LINE_END = new Set(Array.from("(（[［｛「『【〔〈《‘“"));

export type WrapOptions = {
  fontPx: number;
  maxWidthPx: number;
  charWidth?: CharWidth;
  /** Hard cap on the number of output lines; the last line gets an ellipsis. */
  maxLines?: number;
};

/**
 * Wraps text into lines that fit `maxWidthPx`. Explicit "\n" breaks are kept.
 * CJK text breaks between any two characters, subject to simple kinsoku rules;
 * runs of ASCII letters/digits are kept together when they fit on a line.
 */
export function wrapText(text: string, options: WrapOptions): string[] {
  const width = options.charWidth ?? defaultCharWidth;
  const { fontPx } = options;
  const max = Math.max(options.maxWidthPx, fontPx * 2);
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    const chars = Array.from(paragraph);
    if (chars.length === 0) {
      out.push("");
      continue;
    }
    let line: string[] = [];
    let lineWidth = 0;
    let i = 0;
    while (i < chars.length) {
      // Treat an ASCII word as one unit when possible.
      let unit = [chars[i]!];
      if (/[A-Za-z0-9]/.test(chars[i]!)) {
        let j = i + 1;
        while (j < chars.length && /[A-Za-z0-9_\-+./]/.test(chars[j]!)) j++;
        unit = chars.slice(i, j);
      }
      const unitWidth = unit.reduce((sum, ch) => sum + width(ch, fontPx), 0);
      if (lineWidth + unitWidth <= max || line.length === 0) {
        if (unitWidth > max && line.length === 0) {
          // A single unit longer than the line: break it by character.
          for (const ch of unit) {
            const w = width(ch, fontPx);
            if (lineWidth + w > max && line.length > 0) {
              out.push(line.join(""));
              line = [];
              lineWidth = 0;
            }
            line.push(ch);
            lineWidth += w;
          }
        } else {
          line.push(...unit);
          lineWidth += unitWidth;
        }
        i += unit.length;
        continue;
      }
      // Break before `unit`. Apply kinsoku by moving characters to the next line.
      const carry: string[] = [];
      if (NO_LINE_START.has(unit[0]!)) {
        // Pull the last character down with the forbidden line-start char.
        if (line.length > 1) carry.unshift(line.pop()!);
      }
      while (line.length > 1 && NO_LINE_END.has(line[line.length - 1]!)) carry.unshift(line.pop()!);
      out.push(line.join("").trimEnd());
      line = carry;
      lineWidth = carry.reduce((sum, ch) => sum + width(ch, fontPx), 0);
      // Do not start a line with a space.
      if (line.length === 0 && unit[0] === " ") i += 1;
    }
    if (line.length) out.push(line.join(""));
  }
  if (options.maxLines !== undefined && out.length > options.maxLines) {
    const kept = out.slice(0, Math.max(options.maxLines, 1));
    kept[kept.length - 1] = ellipsize(kept[kept.length - 1]!, options);
    return kept;
  }
  return out;
}

/** Truncates a single line so that it plus "…" fits the width. */
export function ellipsize(line: string, options: WrapOptions): string {
  const width = options.charWidth ?? defaultCharWidth;
  const budget = options.maxWidthPx - width("…", options.fontPx);
  const chars = Array.from(line);
  let used = 0;
  let n = 0;
  for (; n < chars.length; n++) {
    const w = width(chars[n]!, options.fontPx);
    if (used + w > budget) break;
    used += w;
  }
  return chars.slice(0, n).join("") + "…";
}

/** Fits one line: returns it unchanged when it fits, otherwise ellipsized. */
export function fitLine(line: string, options: WrapOptions): string {
  return measureText(line, options.fontPx, options.charWidth) <= options.maxWidthPx
    ? line
    : ellipsize(line, options);
}

/** Cuts one line to the width without an ellipsis (tiny labels where every glyph counts). */
export function clipLine(line: string, options: WrapOptions): string {
  const width = options.charWidth ?? defaultCharWidth;
  let used = 0;
  let out = "";
  for (const ch of line) {
    const w = width(ch, options.fontPx);
    if (used + w > options.maxWidthPx) break;
    used += w;
    out += ch;
  }
  return out;
}
