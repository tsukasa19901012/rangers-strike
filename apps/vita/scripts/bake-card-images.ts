// Bakes the starter-deck card images into PocketJS IMG pak entries.
//
// Each card (apps/web/public/cards/*/<id>.jpg, 130x190) becomes one 128x128
// CLUT8 texture (256-color palette + index bytes, ~17 KiB). The core stretches
// a texture over its image node, so the shell draws it back at the card's
// aspect ratio. Entries are listed in src/pak.json under `app:card.<id>` (and
// `app:card.back`), NOT `ui:img.*`, so the host does not upload them at boot:
// the shell uploads only the two decks' cards when a match starts.
//
// Outputs (gitignored): src/generated/cards/<id>.img, src/pak.json.
// Re-runs skip cards whose output is newer than the source JPEG.
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

const TEX = 128;
const PSM_T8 = 5;
const PREFIX = "app:card.";

type Sharp = (input: string) => {
  resize(w: number, h: number, o: { fit: string }): ReturnType<Sharp>;
  png(o: { palette: boolean; colours: number; dither: number }): ReturnType<Sharp>;
  toBuffer(): Promise<Buffer>;
};

/** Minimal indexed-PNG decoder (color type 3, bit depth 1/2/4/8, no interlace). */
function decodeIndexedPng(png: Buffer): { width: number; height: number; indices: Uint8Array; palette: Uint8Array } {
  let pos = 8;
  let width = 0, height = 0, depth = 0;
  let plte: Buffer | null = null;
  let trns: Buffer | null = null;
  const idat: Buffer[] = [];
  while (pos < png.length) {
    const len = png.readUInt32BE(pos);
    const type = png.toString("latin1", pos + 4, pos + 8);
    const data = png.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8]!;
      if (data[9] !== 3 || data[12] !== 0) throw new Error("expected a non-interlaced indexed PNG");
    } else if (type === "PLTE") plte = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IDAT") idat.push(data);
    pos += 12 + len;
  }
  if (!plte) throw new Error("indexed PNG without PLTE");
  const raw = inflateSync(Buffer.concat(idat));
  const stride = Math.ceil((width * depth) / 8);
  const rows = new Uint8Array(stride * height);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const a = x > 0 ? cur[x - 1]! : 0, b = prev[x]!, c = x > 0 ? prev[x - 1]! : 0;
      let p = line[x]!;
      if (filter === 1) p += a;
      else if (filter === 2) p += b;
      else if (filter === 3) p += (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        p += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = p & 0xff;
    }
    rows.set(cur, y * stride);
    prev = cur;
  }
  const indices = new Uint8Array(width * height);
  const perByte = 8 / depth, mask = (1 << depth) - 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const byte = rows[y * stride + Math.floor(x / perByte)]!;
      const shift = 8 - depth * ((x % perByte) + 1);
      indices[y * width + x] = (byte >> shift) & mask;
    }
  }
  // CLUT: 256 x u32 ABGR little-endian == bytes R, G, B, A.
  const palette = new Uint8Array(1024);
  for (let i = 0; i < plte.length / 3; i++) {
    palette[i * 4] = plte[i * 3]!;
    palette[i * 4 + 1] = plte[i * 3 + 1]!;
    palette[i * 4 + 2] = plte[i * 3 + 2]!;
    palette[i * 4 + 3] = trns && i < trns.length ? trns[i]! : 255;
  }
  return { width, height, indices, palette };
}

/** IMG entry: u16 w, u16 h, u8 psm, u8 flags, u16 reserved, then CLUT + indices. */
function imgEntry(palette: Uint8Array, indices: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + palette.length + indices.length);
  const view = new DataView(out.buffer);
  view.setUint16(0, TEX, true);
  view.setUint16(2, TEX, true);
  out[4] = PSM_T8;
  out.set(palette, 8);
  out.set(indices, 8 + palette.length);
  return out;
}

function findImages(cardsDir: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const set of readdirSync(cardsDir)) {
    const dir = join(cardsDir, set);
    if (!statSync(dir).isDirectory()) continue;
    for (const name of readdirSync(dir)) if (name.endsWith(".jpg")) found.set(name.slice(0, -4), join(dir, name));
  }
  const back = join(cardsDir, "back.jpg");
  if (existsSync(back)) found.set("back", back);
  return found;
}

export async function bakeCardImages(appRoot: string, repo: string, cardIds: Iterable<string>): Promise<void> {
  const started = Date.now();
  const pakJson = join(appRoot, "src/pak.json");
  let sharp: Sharp;
  try {
    sharp = createRequire(join(repo, "package.json"))("sharp") as Sharp;
  } catch {
    console.warn("card images: sharp is not installed (run npm install at the repo root); building without images");
    writeFileSync(pakJson, "[]\n");
    return;
  }
  const outDir = join(appRoot, "src/generated/cards");
  mkdirSync(outDir, { recursive: true });
  const images = findImages(join(repo, "apps/web/public/cards"));
  const entries: { key: string; file: string }[] = [];
  let baked = 0, missing = 0, bytes = 0;
  for (const id of ["back", ...[...cardIds].sort()]) {
    const src = images.get(id);
    if (!src) {
      missing++;
      continue;
    }
    const out = join(outDir, `${id}.img`);
    if (!existsSync(out) || statSync(out).mtimeMs < statSync(src).mtimeMs) {
      const png = await sharp(src).resize(TEX, TEX, { fit: "fill" }).png({ palette: true, colours: 256, dither: 0.5 }).toBuffer();
      const { width, height, indices, palette } = decodeIndexedPng(png);
      if (width !== TEX || height !== TEX) throw new Error(`card image ${id}: ${width}x${height}`);
      writeFileSync(out, imgEntry(palette, indices));
      baked++;
    }
    bytes += statSync(out).size;
    entries.push({ key: `${PREFIX}${id}`, file: `generated/cards/${id}.img` });
  }
  writeFileSync(pakJson, JSON.stringify(entries) + "\n");
  console.log(
    `card images: ${entries.length} in src/pak.json (${(bytes / 1024 / 1024).toFixed(1)} MiB, ${baked} baked, ${missing} without an image) in ${Date.now() - started} ms`,
  );
}
