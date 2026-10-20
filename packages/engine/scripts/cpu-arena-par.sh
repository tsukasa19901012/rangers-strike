#!/usr/bin/env bash
# cpu-arena.ts を 4 プロセスに分けて回し、結果を合算する。引数は cpu-arena.ts と同じ。
cd "$(dirname "$0")/.."
N=${ARENA_PROCS:-4}
tmp=$(mktemp -d)
for k in $(seq 0 $((N-1))); do npx tsx scripts/cpu-arena.ts "$@" --shard $k --shards $N --json > "$tmp/$k" 2>"$tmp/$k.err" & done
wait
cat "$tmp"/?.err | grep -v "^$" | head -5
node -e '
const fs=require("fs");const d=process.argv[1];let a=0,b=0,dr=0,ma=0,mb=0,xa=0,xb=0,na=0,nb=0;
for(const f of fs.readdirSync(d).filter(f=>/^\d+$/.test(f))){const r=JSON.parse(fs.readFileSync(d+"/"+f,"utf8").trim().split("\n").pop());a+=r.a;b+=r.b;dr+=r.draws;ma+=r.msA;mb+=r.msB;xa=Math.max(xa,r.maxA||0);xb=Math.max(xb,r.maxB||0);na+=r.movesA||0;nb+=r.movesB||0;}
const n=a+b,p=n?a/n:0,se=n?Math.sqrt(p*(1-p)/n):0;
console.log(`A ${a} - ${b} B, draws ${dr}; A ${(p*100).toFixed(1)}% ±${(se*196).toFixed(1)}; think A ${(ma/1000).toFixed(0)}s B ${(mb/1000).toFixed(0)}s; per move A avg ${(ma/Math.max(1,na)).toFixed(1)}ms max ${xa.toFixed(0)}ms, B avg ${(mb/Math.max(1,nb)).toFixed(1)}ms max ${xb.toFixed(0)}ms`);' "$tmp"
rm -rf "$tmp"
