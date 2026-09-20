<script setup lang="ts">
/**
 * A yes/no answer in the shape of `FormFieldRow`: the same surface, the same
 * 56px height, the question on the left and the switch on the right.
 *
 * It is a div rather than a `<label>`, which is the one thing it cannot borrow
 * from `FormFieldRow`: a label wrapping a button toggles it twice on one click.
 * The question is tied to the switch by id instead.
 */
import { useId } from 'vue';
import { Switch } from '@magermoney/ui';

const model = defineModel<boolean>({ required: true });
defineProps<{ label: string; testid?: string }>();

const labelId = useId();
</script>

<template>
  <div
    class="flex min-h-14 w-full items-center gap-3 rounded-lg bg-surface px-3 py-2 text-ink"
    data-slot="form-field-row"
  >
    <span :id="labelId" class="min-w-0 flex-1 text-sm">{{ label }}</span>
    <Switch v-model="model" :aria-labelledby="labelId" :data-testid="testid" />
  </div>
</template>
