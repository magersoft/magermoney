/**
 * A deliberate violation, linted only by `scripts/check-boundaries.ts`.
 *
 * `packages/domain` is the pure model: it may not know the wire format. The
 * file is linted under the path in `check-boundaries.ts`, not this one, because
 * the rule places a file in an element by where it lives.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ErrorDtoSchema } from '@magermoney/contracts';
