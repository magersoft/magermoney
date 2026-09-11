/**
 * The theme preference lives in `shared/theme`: the settings screen changes it
 * too, and a module may not import `app`. Re-exported here so the composition
 * root keeps one import path.
 */
export { applyTheme, useTheme, type Theme } from '@/shared/theme';
