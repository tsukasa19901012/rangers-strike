// Locates the isolated PocketJS toolchain (apps/vita/toolchain) and repairs the
// two layout assumptions the published @pocketjs/framework makes about being a
// source checkout:
//   - framework/compiler/jsx-plugin.ts reads solid-js/vue from
//     <framework>/node_modules/, but npm hoists them to toolchain/node_modules/.
//   - npm's install-script policy may skip bun's postinstall; bun/bin/bun.exe is
//     still the real binary, so we call it directly.
import { existsSync, mkdirSync, symlinkSync, lstatSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const TOOLCHAIN = join(APP_ROOT, "toolchain");
export const FRAMEWORK_ROOT = join(TOOLCHAIN, "node_modules/@pocketjs/framework");

export function bunBinary() {
  const candidates = [
    process.env.BUN_BINARY,
    join(TOOLCHAIN, "node_modules/bun/bin/bun.exe"),
    join(TOOLCHAIN, "node_modules/@oven/bun-darwin-aarch64/bin/bun"),
    join(TOOLCHAIN, "node_modules/@oven/bun-darwin-x64/bin/bun"),
    join(TOOLCHAIN, "node_modules/@oven/bun-linux-x64/bin/bun"),
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      "bun not found. Run `npm ci --prefix apps/vita/toolchain` first (see apps/vita/README.md).",
    );
  }
  return found;
}

export function ensureToolchain() {
  if (!existsSync(FRAMEWORK_ROOT)) {
    throw new Error(
      "@pocketjs/framework is not installed. Run `npm ci --prefix apps/vita/toolchain` first.",
    );
  }
  const nested = join(FRAMEWORK_ROOT, "node_modules");
  mkdirSync(nested, { recursive: true });
  for (const name of ["solid-js", "vue"]) {
    const link = join(nested, name);
    let present = false;
    try {
      lstatSync(link);
      present = true;
    } catch {}
    if (!present) symlinkSync(join("..", "..", "..", name), link, "dir");
  }
}

/** Directory with a `bun` symlink; the PocketJS backends look bun up on PATH. */
export function bunBinDir() {
  const dir = join(TOOLCHAIN, ".bin");
  mkdirSync(dir, { recursive: true });
  const link = join(dir, "bun");
  let present = false;
  try {
    lstatSync(link);
    present = true;
  } catch {}
  if (!present) symlinkSync(bunBinary(), link);
  return dir;
}
