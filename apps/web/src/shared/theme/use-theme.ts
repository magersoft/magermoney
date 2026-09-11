import { ref, watchEffect, type Ref } from 'vue';
import { applyTheme, THEMES, type Theme } from './theme';

const STORAGE_KEY = 'theme';

/** Storage is unavailable in private mode and in tests; a missing preference is not an error. */
function readStored(): Theme {
  if (typeof localStorage === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null && (THEMES as readonly string[]).includes(stored)
      ? (stored as Theme)
      : 'system';
  } catch {
    return 'system';
  }
}

function writeStored(t: Theme): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {
    /* The theme still applies for this session. */
  }
}

const theme = ref<Theme>(readStored());

/**
 * The preference, applied to the document and remembered across visits. One
 * module-scope ref, so the shell's toggle and the settings screen are the same
 * switch rather than two that drift apart.
 */
export function useTheme(): { theme: Ref<Theme>; set: (t: Theme) => void } {
  watchEffect(() => {
    applyTheme(theme.value);
    writeStored(theme.value);
  });
  return {
    theme,
    set: (t: Theme) => {
      theme.value = t;
    },
  };
}
