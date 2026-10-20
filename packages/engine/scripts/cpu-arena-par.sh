#!/usr/bin/env bash
# cpu-arena.ts を 4 プロセスに分けて回し、結果を合算する。引数は cpu-arena.ts と同じ。
cd "$(dirname "$0")/.."
N=${ARENA_PROCS:-4}
tmp=$(mktemp -d)
for k in $(seq 0 $((N-1))); do npx tsx scripts/cpu-arena.ts "$@" --shard $k --shards $N --json > "$tmp/$k" 2>"$tmp/$k.err" & done
wait
cat "$tmp"/?.err | grep -v "^$" | head -5
node -e '
const fs=require("fs");const d=process.argv[1];let a=0,b=0,dr=0,ma=0,mb=0;
for(const f of fs.readdirSync(d).filter(f=>/^\d+$/.test(f))){const r=JSON.parse(fs.readFileSync(d+"/"+f,"utf8").trim().split("\n").pop());a+=r.a;b+=r.b;dr+=r.draws;ma+=r.msA;mb+=r.msB;}
const n=a+b,p=n?a/n:0,se=n?Math.sqrt(p*(1-p)/n):0;
console.log(`A ${a} - ${b} B, draws ${dr}; A ${(p*100).toFixed(1)}% ±${(se*196).toFixed(1)}; think A ${(ma/1000).toFixed(0)}s B ${(mb/1000).toFixed(0)}s`);' "$tmp"
rm -rf "$tmp"
