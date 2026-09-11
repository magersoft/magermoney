<script setup lang="ts">
/**
 * Where the magic link and the OAuth redirect land. It exchanges the code for a
 * session and leaves immediately; the only thing worth rendering is the failure,
 * because an expired link is the one outcome the person has to act on.
 */
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { Button } from '@magermoney/ui';
import { safeRedirect } from '../domain/redirect';
import { supabase } from '../infrastructure/supabase';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const error = ref<string | null>(null);

onMounted(async () => {
  const { error: exchangeError } = await supabase().auth.exchangeCodeForSession(location.href);
  if (exchangeError) {
    error.value = exchangeError.message;
    return;
  }
  await router.replace(safeRedirect(route.query.redirect) ?? '/');
});
</script>

<template>
  <div class="mx-auto flex w-full max-w-sm flex-col justify-center py-16">
    <template v-if="error">
      <h1 class="text-2xl font-semibold tracking-[-0.01em]">
        {{ t('auth.callback.failedTitle') }}
      </h1>
      <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
        {{ t('auth.callback.failedBody') }}
      </p>
      <Button type="button" class="mt-6 h-11 w-full" @click="router.replace({ name: 'sign-in' })">
        {{ t('auth.callback.retry') }}
      </Button>
    </template>
    <p v-else class="text-sm text-muted-foreground" role="status">
      {{ t('auth.callback.working') }}
    </p>
  </div>
</template>
