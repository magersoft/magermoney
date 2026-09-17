/** Public API of the transfers module. Real content arrives in Task 15. */
import { defineComponent, h } from 'vue';

export const TransfersPage = defineComponent({
  name: 'TransfersPage',
  setup: () => () => h('div'),
});

/** Placeholder until Task 15 delivers the real sheet. */
export const TransferSheet = defineComponent({
  name: 'TransferSheet',
  props: {
    open: { type: Boolean, required: true },
    fromAccountId: { type: String, default: undefined },
  },
  emits: ['update:open'],
  setup: () => () => h('div'),
});
