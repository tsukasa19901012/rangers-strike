/**
 * テスト用: イベントループに1回譲る。
 *
 * 長いシミュレーション（同期のゲームループ）を続けて回すと、vitest のワーカーがメインプロセスへ送る進捗の RPC（onTaskUpdate）が
 * 待たされ、「Timeout calling "onTaskUpdate"」で test:sim が失敗する（すべてのテストが通っていても終了コード 1）。
 * ゲームの合間にこれを await して RPC を処理させる。判定・回数・上限は変えない。
 */
export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
