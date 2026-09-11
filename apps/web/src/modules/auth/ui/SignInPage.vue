<script setup lang="ts">
/**
 * The one page a signed-out person can reach. Two ways in, one of which needs
 * no password at all; the screen keeps its own submit state because nothing is
 * cached here and nothing is worth a query.
 *
 * Visually it is the ledger's title page: paper, one rule, the wordmark set in
 * the amount lockup's own type, and the accent spent on exactly one control.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { Button, Input } from '@magermoney/ui';
import { useSession } from '../application/use-session';
import { safeRedirect } from '../domain/redirect';

const { t } = useI18n();
const route = useRoute();
const session = useSession();

/** Where the guard wanted to go. It rides along so the round trip ends there. */
const redirect = computed(() => safeRedirect(route.query.redirect));

const email = ref('');
const pending = ref(false);
const sent = ref(false);
const error = ref<string | null>(null);

const canSend = computed(() => /.+@.+\..+/.test(email.value.trim()) && !pending.value);

async function sendLink(): Promise<void> {
  if (!canSend.value) return;
  pending.value = true;
  error.value = null;
  const result = await session.signInWithMagicLink(email.value.trim(), redirect.value);
  pending.value = false;
  result.match(
    () => {
      sent.value = true;
    },
    (e) => {
      error.value = e.message;
    },
  );
}

async function google(): Promise<void> {
  error.value = null;
  try {
    await session.signInWithGoogle(redirect.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-sm flex-col justify-center py-10 md:py-16">
    <p class="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
      {{ t('app.name') }}
    </p>
    <h1 class="mt-3 text-[32px] font-semibold leading-[1.1] tracking-[-0.01em]">
      {{ t('auth.signIn.title') }}
    </h1>
    <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
      {{ t('auth.signIn.subtitle') }}
    </p>

    <template v-if="sent">
      <div class="mt-8 border-t border-border pt-6">
        <h2 class="text-base font-medium">
          {{ t('auth.signIn.sentTitle') }}
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
          {{ t('auth.signIn.sentBody', { email }) }}
        </p>
        <Button
          variant="link"
          type="button"
          class="mt-4 px-0"
          @click="sent = false"
        >
          {{ t('auth.signIn.useAnother') }}
        </Button>
      </div>
    </template>

    <template v-else>
      <Button
        variant="outline"
        type="button"
        class="mt-8 h-11 w-full gap-2"
        @click="google"
      >
        <svg
          viewBox="0 0 18 18"
          class="size-4"
          aria-hidden="true"
        >
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
          />
          <path
            fill="#FBBC05"
            d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.32Z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58Z"
          />
        </svg>
        {{ t('auth.signIn.google') }}
      </Button>

      <div class="my-6 flex items-center gap-3">
        <span class="h-px flex-1 bg-border" />
        <span class="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {{ t('auth.signIn.or') }}
        </span>
        <span class="h-px flex-1 bg-border" />
      </div>

      <form
        class="flex flex-col gap-2"
        novalidate
        @submit.prevent="sendLink"
      >
        <label
          for="email"
          class="text-sm font-medium"
        >
          {{ t('auth.signIn.emailLabel') }}
        </label>
        <Input
          id="email"
          v-model="email"
          type="email"
          name="email"
          autocomplete="email"
          inputmode="email"
          class="h-11"
          :placeholder="t('auth.signIn.emailPlaceholder')"
          :aria-invalid="error ? true : undefined"
          :aria-describedby="error ? 'email-error' : undefined"
        />
        <p
          v-if="error"
          id="email-error"
          role="alert"
          class="text-sm text-destructive"
        >
          {{ error }}
        </p>
        <Button
          type="submit"
          class="mt-2 h-11 w-full"
          :disabled="!canSend"
        >
          {{ pending ? t('auth.signIn.sending') : t('auth.signIn.send') }}
        </Button>
      </form>
    </template>
  </div>
</template>
