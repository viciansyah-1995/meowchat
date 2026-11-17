export function readLocalPreference(key, previousKey) {
  try {
    const current = localStorage.getItem(key);
    if (current !== null || !previousKey) return current;
    const previous = localStorage.getItem(previousKey);
    if (previous !== null) writeLocalPreference(key, previous, previousKey);
    return previous;
  } catch {
    return null;
  }
}

export function writeLocalPreference(key, value, previousKey) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    if (previousKey) localStorage.removeItem(previousKey);
  } catch {
    // Storage may be unavailable in a restricted browser session.
  }
}
