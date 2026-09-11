/**
 * Public API of the auth module. Everything the rest of the app may know about
 * who is signed in passes through here.
 */
export type { SessionUser } from './domain/session';
export { authGuard } from './application/auth-guard';
export { useSession, type Session } from './application/use-session';
export { useSessionStore } from './infrastructure/session-store';
export { default as SignInPage } from './ui/SignInPage.vue';
export { default as AuthCallbackPage } from './ui/AuthCallbackPage.vue';
