/** Public API of the profile module. */
export { greetingName, LOCALES, type Locale } from './domain/profile';
export { useProfile } from './application/use-profile';
export { default as ProfileAvatar } from './ui/ProfileAvatar.vue';
export { default as SettingsPage } from './ui/SettingsPage.vue';
