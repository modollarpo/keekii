const CONTINUOUS_MIX_KEY = 'keekii.continuousMix';

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
