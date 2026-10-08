const CONTINUOUS_MIX_KEY = 'keekii.continuousMix';
const CROSSFADE_DURATION_KEY = 'keekii.crossfadeDuration';

export const MAX_CROSSFADE_SECONDS = 12;
export const DEFAULT_CROSSFADE_SECONDS = 5;

export function clampCrossfadeDuration(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_CROSSFADE_SECONDS;
  return Math.min(MAX_CROSSFADE_SECONDS, Math.max(0, Math.round(seconds)));
}

export function getCrossfadeDuration(): number {
  try {
    const raw = localStorage.getItem(CROSSFADE_DURATION_KEY);
    if (raw === null) return DEFAULT_CROSSFADE_SECONDS;
    return clampCrossfadeDuration(Number(raw));
  } catch {
    return DEFAULT_CROSSFADE_SECONDS;
  }
}

export function setCrossfadeDuration(seconds: number): void {
  try {
    localStorage.setItem(
      CROSSFADE_DURATION_KEY,
      String(clampCrossfadeDuration(seconds)),
    );
  } catch {
    // best-effort like the toggle: in-memory store state still applies
  }
}

export function getContinuousMixEnabled(): boolean {
  try {
    return localStorage.getItem(CONTINUOUS_MIX_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setContinuousMixEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(CONTINUOUS_MIX_KEY, String(enabled));
  } catch {
    // ignore storage failures (private mode etc) - the preference is
    // best-effort and the in-memory store state still works for the session
  }
}
