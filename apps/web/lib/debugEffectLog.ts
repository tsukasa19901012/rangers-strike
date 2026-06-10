const DEBUG_EFFECTS_KEY = "rangers-strike/debug-effects/v1";

export function isEffectDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DEBUG_EFFECTS_KEY) === "1";
}

export function setEffectDebugEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEBUG_EFFECTS_KEY, enabled ? "1" : "0");
}

export function isEffectDebugToggleVisible(): boolean {
  return process.env.NODE_ENV === "development";
}

export function logEffectDebug(
  message: string,
  append?: (line: string) => void,
): void {
  if (!isEffectDebugEnabled()) return;
  console.info(`[effect-debug] ${message}`);
  append?.(`[debug] ${message}`);
}
