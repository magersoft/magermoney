import { ProfileDtoSchema, type ProfileDto, type UpdateProfileInput } from '@magermoney/contracts';
import { parse, type ApiClient } from '@/shared/api/client';

/** `/me`, and nothing else. The only place that knows the profile's transport. */
export const profileApi = (client: ApiClient) => ({
  get: async (): Promise<ProfileDto> =>
    parse(await client.fetch('/me', { method: 'GET' }), ProfileDtoSchema),
  update: async (input: UpdateProfileInput): Promise<ProfileDto> =>
    parse(
      await client.fetch('/me', { method: 'PATCH', body: JSON.stringify(input) }),
      ProfileDtoSchema,
    ),
});
