#!/usr/bin/env node
// Minimal static server for dist/ (development only).
//   node scripts/serve.mjs [--port=8140]
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const port = Number((process.argv.find((a) => a.startsWith("--port=")) ?? "--port=8140").slice(7));
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".pak": "application/octet-stream",
  ".jpg": "image/jpeg",
  ".png": "image/png",
};

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  let file = normalize(join(DIST, path));
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
  createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`Rangers Strike (PocketJS web): http://127.0.0.1:${port}/`));
