import { ACCOUNT_COLORWAYS } from './account.js';
import { isAvatarEmoji } from './avatar.js';

/**
 * What a Goal or an Asset is marked with so a list of them reads at a glance:
 * one emoji and one colour, drawn as a disc beside the name — the profile
 * disc's language, used for things instead of the person.
 *
 * The colours are the card palette by name, for the reason the avatar gives:
 * each fill already carries its ink and a contrast proof in both themes, and a
 * second list would need a second proof. Append-only, mirrored by the check
 * constraints on `goals.color` and `assets.color`.
 */
export const MARK_COLORS = ACCOUNT_COLORWAYS;
export type MarkColor = (typeof MARK_COLORS)[number];

/** Exactly one emoji — the rule the profile disc already holds, for the same disc. */
export const isMarkEmoji = isAvatarEmoji;
