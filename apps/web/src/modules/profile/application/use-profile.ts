import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { ProfileDto, UpdateProfileInput } from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { profileApi } from '../infrastructure/profile-api';

/**
 * The profile, and the one way to change it. The change is shown before the
 * PATCH answers — on a phone that is the difference between a settings screen
 * and a settings screen that feels broken — and taken back if it fails.
 */
export function useProfile() {
  const api = profileApi(useApi());
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['me'], queryFn: api.get });
  const mutation = useMutation({
    mutationFn: api.update,
    onMutate: async (input: UpdateProfileInput) => {
      await qc.cancelQueries({ queryKey: ['me'] });
      const prev = qc.getQueryData<ProfileDto>(['me']);
      if (prev) qc.setQueryData(['me'], { ...prev, ...input });
      return { prev };
    },
    onError: (_e, _i, ctx) => {
      if (ctx?.prev) qc.setQueryData(['me'], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });

  return {
    profile: query.data,
    isLoading: query.isLoading,
    update: (input: UpdateProfileInput): Promise<void> => mutation.mutateAsync(input).then(() => undefined),
  };
}
