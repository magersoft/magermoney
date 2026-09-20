import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { ProfileDto, UpdateProfileInput } from '@magermoney/contracts';
import { useApi, useOwnerId } from '@/shared/api/use-api';
import { profileApi } from '../infrastructure/profile-api';
import {
  PROFILE_KEY,
  registerProfileMutations,
  UPDATE_PROFILE_KEY,
  type UpdateProfileVars,
} from './mutation-defaults';

/**
 * The profile, and the one way to change it.
 *
 * The change goes through the offline mutation queue rather than a plain
 * `mutationFn`: reordering the display switch on a train has to survive the
 * tunnel and the closed tab, not revert to whatever the server last said. The
 * optimistic update and the rollback live with the registration, so a mutation
 * restored from IndexedDB behaves exactly like a fresh one.
 */
export function useProfile() {
  const api = profileApi(useApi());
  const qc = useQueryClient();
  const ownerId = useOwnerId();
  registerProfileMutations(qc, useApi(), ownerId);

  const query = useQuery({ queryKey: PROFILE_KEY, queryFn: api.get });
  const mutation = useMutation<ProfileDto, Error, UpdateProfileVars>({
    mutationKey: UPDATE_PROFILE_KEY,
  });

  return {
    profile: query.data,
    isLoading: query.isLoading,
    update: (input: UpdateProfileInput): Promise<void> =>
      mutation.mutateAsync({ ownerId: ownerId(), input }).then(() => undefined),
    /** True while the write is parked offline, waiting for a connection. */
    isPaused: mutation.isPaused,
  };
}
