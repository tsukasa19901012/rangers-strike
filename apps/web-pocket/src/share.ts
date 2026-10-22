// The 共有 button: the match's board as a short URL (?s=<id>, stored by api/share.js)
// or, when the server cannot store it, as a long URL (#s=<code>).
// The code is the share payload as gzip + base64url, prefixed with its version.
import { parseSharePayload, type SharePayload } from "@rangers-strike/client-core";

const PREFIX = "RS1.";

type BrowserGlobals = {
  location?: { origin: string; pathname: string; search: string; hash: string };
  history?: { replaceState(data: unknown, unused: string, url: string): void };
  navigator?: { clipboard?: { writeText(text: string): Promise<void> } };
  fetch?: typeof fetch;
  prompt?: (message: string, value?: string) => string | null;
  CompressionStream?: new (format: "gzip") => GenericTransformStream;
  DecompressionStream?: new (format: "gzip") => GenericTransformStream;
  Blob?: typeof Blob;
  Response?: typeof Response;
  btoa?: (s: string) => string;
  atob?: (s: string) => string;
  TextEncoder?: typeof TextEncoder;
};
const g = globalThis as unknown as BrowserGlobals;

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: GenericTransformStream): Promise<Uint8Array> {
  const out = new g.Blob!([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new g.Response!(out).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return g.btoa!(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const bin = g.atob!(text.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function encodeShare(payload: SharePayload): Promise<string> {
  const json = new g.TextEncoder!().encode(JSON.stringify(payload));
  return PREFIX + toBase64Url(await pipe(json, new g.CompressionStream!("gzip")));
}

export async function decodeShare(code: string): Promise<SharePayload | null> {
  const body = code.trim();
  if (!body.startsWith(PREFIX)) return null;
  try {
    const bytes = await pipe(fromBase64Url(body.slice(PREFIX.length)), new g.DecompressionStream!("gzip"));
    return parseSharePayload(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

export type ShareResult = { url: string; short: boolean; copied: boolean };

/** Makes the share URL and copies it (the URL also goes to a prompt when the clipboard refuses). */
export async function shareBoard(payload: SharePayload): Promise<ShareResult> {
  const code = await encodeShare(payload);
  const origin = g.location?.origin ?? "";
  let url = `${origin}/#s=${code}`;
  let short = false;
  try {
    const res = await g.fetch!("/api/share", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
    const body = res.ok ? ((await res.json()) as { id?: string }) : null;
    if (body?.id && /^[A-Za-z0-9]{6,16}$/.test(body.id)) {
      url = `${origin}/?s=${body.id}`;
      short = true;
    }
  } catch {
    // no server (static hosting without the function, offline): the long URL works on its own
  }
  let copied = false;
  try {
    await g.navigator!.clipboard!.writeText(url);
    copied = true;
  } catch {
    g.prompt?.("この URL をコピーしてください", url);
  }
  return { url, short, copied };
}

/** The board the page was opened with (?s=<id> or #s=<code>), if any. The address is cleaned so a reload starts normally. */
export async function sharedBoardFromLocation(): Promise<SharePayload | null | "error"> {
  const loc = g.location;
  if (!loc) return null;
  const id = new URLSearchParams(loc.search).get("s");
  const hash = loc.hash.startsWith("#s=") ? loc.hash.slice(3) : null;
  if (!id && !hash) return null;
  g.history?.replaceState(null, "", loc.pathname);
  let code = hash;
  if (id) {
    try {
      const res = await g.fetch!(`/api/share?id=${encodeURIComponent(id)}`);
      code = res.ok ? (((await res.json()) as { code?: string }).code ?? null) : null;
    } catch {
      code = null;
    }
  }
  const payload = code ? await decodeShare(code) : null;
  return payload ?? "error";
}
