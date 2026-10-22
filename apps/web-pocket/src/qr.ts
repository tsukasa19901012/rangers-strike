// QR codes for the deck share panel: the guest computes the modules
// (qrcode-generator), the host page draws them (a texture for the panel and
// the PNG that 「QR画像を保存」 saves; host/host.js globalThis.__rsQr).
import qrcode from "qrcode-generator";

/** The modules, row by row ("1" = dark), and the side length. */
export type QrBits = { bits: string; size: number };

export function qrBits(text: string): QrBits {
  // M keeps a short URL small and still survives a smudge; a long URL (no
  // server) needs the room of L to stay a code a phone camera can read.
  const qr = qrcode(0, text.length > 120 ? "L" : "M");
  qr.addData(text, "Byte");
  qr.make();
  const size = qr.getModuleCount();
  let bits = "";
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) bits += qr.isDark(y, x) ? "1" : "0";
  return { bits, size };
}

type QrHost = { texture(bits: string, size: number): number };
const host = (globalThis as unknown as { __rsQr?: QrHost }).__rsQr;

/** Texture handle of the code (white margin included), or -1 without a host. */
export function qrTexture(qr: QrBits): number {
  return host ? host.texture(qr.bits, qr.size) : -1;
}
