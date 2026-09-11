/**
 * A deliberate violation, linted only by `scripts/check-boundaries.ts`.
 *
 * `apps/web/src/shared` is the bottom of the app: it may not reach up into the
 * composition root, or every screen drags the router in with it.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { router } from '@/app/router';
