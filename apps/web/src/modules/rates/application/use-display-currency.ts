import { computed, ref, watch, type Ref } from 'vue';
import { useProfile } from '@/modules/profile';
import { onClearClientCaches } from '@/shared/cache/client-caches';

type Storage = { get(): string | null; set(v: string): void };

export interface DisplayCurrency {
  current: Ref<string>;
  options: Ref<string[]>;
  set(code: string): void;
}

/**
 * Which currency the screen shows amounts in. Pure and injected with its own
 * storage: the rule worth testing is that only a reporting currency can be
 * chosen, and that a remembered choice dropped from the list falls back.
 */
export function createDisplayCurrency(
  profile: Ref<{ defaultCurrency: string; reportingCurrencies: string[] } | undefined>,
  storage: Storage,
): DisplayCurrency {
  const options = computed(() => profile.value?.reportingCurrencies ?? []);

  /** A choice made this session outranks storage: it is the most recent thing the person did. */
  let chosen: string | null = null;

  const pick = () => {
    const saved = chosen ?? storage.get();
    return saved && options.value.includes(saved)
      ? saved
      : (profile.value?.defaultCurrency ?? 'USD');
  };

  const current = ref(pick());

  /*
   * The first pick happens while the profile is still loading, so it can only
   * be a guess. Re-picking when the profile arrives — and whenever the list
   * changes — is what makes the remembered choice and the account's default
   * survive a cold start.
   */
  watch([options, profile], () => {
    const next = pick();
    if (next !== current.value) current.value = next;
  });

  const set = (code: string) => {
    // An empty list means the profile has not arrived, not that nothing is allowed.
    if (options.value.length > 0 && !options.value.includes(code)) return;
    chosen = code;
    current.value = code;
    storage.set(code);
  };

  return { current, options, set };
}

const STORAGE_KEY = 'displayCurrency';

/** Per device, not per account: the phone in a shop and the laptop at home differ. */
const localStorageBacked: Storage = {
  get: () => {
    if (typeof localStorage === 'undefined') return null;
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  set: (v) => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* The choice still holds for this session. */
    }
  },
};

let instance: DisplayCurrency | undefined;

/**
 * One switch for the whole app: the header's control and every amount on screen
 * read the same ref, so flipping it changes everything at once.
 */
export function useDisplayCurrency(): DisplayCurrency {
  instance ??= createDisplayCurrency(useProfile().profile, localStorageBacked);
  return instance;
}

/**
 * The switch is per device, but it is still a fact about the account that was
 * signed in, so it goes with the rest of the caches. The singleton is dropped
 * too: the next sign-in rebuilds it against its own profile.
 */
export function resetDisplayCurrency(): void {
  instance = undefined;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Nothing is remembered anyway if storage refuses. */
  }
}

onClearClientCaches(resetDisplayCurrency);
