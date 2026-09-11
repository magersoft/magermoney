import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';

vi.mock('@/modules/auth/application/use-session', () => ({
  useSession: () => ({
    user: ref(null),
    ready: ref(true),
    signInWithGoogle: vi.fn(),
    signInWithMagicLink: vi.fn(),
    signOut: vi.fn(),
    getAccessToken: vi.fn(),
  }),
}));

const { default: SignInPage } = await import('../src/modules/auth/ui/SignInPage.vue');

async function mountSignInPage() {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages: { ru, en },
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/sign-in', name: 'sign-in', component: SignInPage }],
  });
  router.push('/sign-in');
  await router.isReady();

  return mount(SignInPage, { global: { plugins: [i18n, router] } });
}

describe('SignInPage', () => {
  it('renders the escaped email placeholder as a plain, unbroken address', async () => {
    const wrapper = await mountSignInPage();

    expect(wrapper.get('#email').attributes('placeholder')).toBe('you@example.com');
  });
});
