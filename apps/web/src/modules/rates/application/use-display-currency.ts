import { computed, ref, watch, type Ref } from 'vue';
import { useProfile } from '@/modules/profile';

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
  const pick = () => {
    const saved = storage.get();
    return saved && options.value.includes(saved) ? saved : (profile.value?.defaultCurrency ?? 'USD');
  };
  const current = ref(pick());
  watch(options, () => {
    if (!options.value.includes(current.value)) current.value = pick();
  });
  const set = (code: string) => {
    if (options.value.includes(code)) {
      current.value = code;
      storage.set(code);
    }
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
