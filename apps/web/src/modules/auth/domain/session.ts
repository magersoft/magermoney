/**
 * What the app knows about the person using it. Supabase hands back a much
 * larger user object; everything past these two fields is either a secret or a
 * detail of the provider, so it stops at this boundary.
 */
export interface SessionUser {
  id: string;
  email: string | null;
}

/** The session as the rest of the app sees it: someone, or nobody, or not yet known. */
export interface SessionState {
  user: SessionUser | null;
  /** `false` until the stored session has been read, so the guard never fires early. */
  ready: boolean;
}
