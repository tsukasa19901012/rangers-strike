#!/usr/bin/env bash
# selfplay.ts を CPU のコア数ぶんのプロセスに分けて回す。引数は selfplay.ts と同じ（--shard/--shards はここで付ける）。
#   scripts/selfplay-par.sh --games 100000 --out .cache/selfplay/run1
# プロセス数は SELFPLAY_PROCS で変えられる（既定は論理コア数）。途中経過は <out>/log-<k>.txt に出る。
cd "$(dirname "$0")/.."
N=${SELFPLAY_PROCS:-$(node -e 'console.log(require("os").availableParallelism())')}
out=.cache/selfplay/run
for ((i = 1; i <= $#; i++)); do [ "${!i}" = "--out" ] && { j=$((i + 1)); out=${!j}; }; done
mkdir -p "$out"
start=$(date +%s)
for k in $(seq 0 $((N - 1))); do
  npx tsx scripts/selfplay.ts "$@" --shard "$k" --shards "$N" > "$out/log-$k.txt" 2>&1 &
done
wait
tail -qn1 "$out"/log-*.txt | node -e '
let played=0,decided=0,rows=0;for(const l of require("fs").readFileSync(0,"utf8").trim().split("\n")){try{const r=JSON.parse(l);played+=r.played;decided+=r.decided;rows+=r.rows}catch{console.log("shard error: "+l)}}
console.log(`games ${played}, decided ${decided}, rows ${rows}, ${process.argv[1]}s wall`)' "$(( $(date +%s) - start ))"
