import type { QueryClient } from '@tanstack/vue-query';
import type { ProfileDto, UpdateProfileInput } from '@magermoney/contracts';
import type { ApiClient } from '@/shared/api/client';
import { assertOwner } from '@/shared/api/offline-write';
import { profileApi } from '../infrastructure/profile-api';

/** The profile cache. One row, so the key has nothing to vary by. */
export const PROFILE_KEY = ['me'] as const;

/**
 * Changing the profile survives a closed tab, the same way recording a balance
 * does. It matters most for the display switch: a person reorders the
 * currencies on the train, and the change has to still be there when the
 * network comes back rather than quietly reverting to what the server last
 * said.
 */
export const UPDATE_PROFILE_KEY = ['me', 'update'] as const;

export interface UpdateProfileVars {
  /** Whose profile; checked against the session before it is sent, never part of the body. */
  ownerId: string | null;
  input: UpdateProfileInput;
}

/**
 * Registers what an `updateProfile` mutation does on the given client. Called by
 * the composition root at start-up and again by the composable, so a restored
 * mutation and a fresh one run the same code.
 */
export function registerProfileMutations(
  queryClient: QueryClient,
  client: ApiClient,
  signedInId: () => string | null = () => null,
): void {
  const api = profileApi(client);
  queryClient.setMutationDefaults(UPDATE_PROFILE_KEY, {
    /*
     * One write at a time. Picking an avatar with the arrow keys saves on every
     * step, and two PATCHes in flight can reach the server in either order —
     * the profile would keep whichever landed last, not the one picked last.
     */
    scope: { id: 'profile' },
    mutationFn: ({ ownerId, input }: UpdateProfileVars): Promise<ProfileDto> => {
      assertOwner(ownerId, signedInId());
      return api.update(input);
    },
    onMutate: async ({ input }: UpdateProfileVars) => {
      await queryClient.cancelQueries({ queryKey: PROFILE_KEY });
      const prev = queryClient.getQueryData<ProfileDto>(PROFILE_KEY);
      /*
       * Shown before the PATCH answers: on a phone that is the difference
       * between a settings screen and one that feels broken.
       */
      if (prev) queryClient.setQueryData(PROFILE_KEY, { ...prev, ...input });
      return { prev };
    },
    onError: (_e: unknown, _v: UpdateProfileVars, ctx: { prev?: ProfileDto } | undefined) => {
      if (ctx?.prev) queryClient.setQueryData(PROFILE_KEY, ctx.prev);
    },
    onSettled: (): Promise<unknown> => queryClient.invalidateQueries({ queryKey: PROFILE_KEY }),
  });
}
