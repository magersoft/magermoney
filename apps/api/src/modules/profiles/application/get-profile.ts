import { err, ok, type Result } from 'neverthrow';
import { NotFoundError } from '../../../shared/errors/http.js';
import type { Profile, ProfileRepository } from './profile-repository.js';
export const getProfile =
  (repo: ProfileRepository) =>
  async (userId: string): Promise<Result<Profile, NotFoundError>> => {
    const p = await repo.findById(userId);
    return p ? ok(p) : err(new NotFoundError('profile'));
  };
