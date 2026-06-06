/** true のとき横向きコンパクト CSS と任意の JS プレイシート fit を適用。 */
export const COMPACT_VIEWPORT_MQ = "(orientation: landscape) and (max-height: 520px)";

import { useEffect, useState } from "react";

export function useCompactGameViewport(): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_VIEWPORT_MQ);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return matches;
}
