import type { UserConfig as ActualViteUserConfig } from 'vite';

/**
 * We support a range of vite versions with different types here
 *
 * These subconfigs are minimally what we use, as we don't want to maintain
 * types for someone else's package.
 *
 * This exists at all because we support vite 5 through vite 8 (as of 2025-03-17)
 * and there isn't a package with these types available for us.
 * The types are internal only, and we *should* have enough testing where if we mess
 * something up, runtime catches us.
 */
export type ViteUserConfig = ActualViteUserConfig & Vite8UserConfig & Vite7UserConfig;

/**
 * Subset of:
 * https://npmx.dev/package-code/vite/v/8.0.0/dist%2Fnode%2Findex.d.ts
 */
interface Vite8UserConfig {}

/**
 * Subset of:
 * https://npmx.dev/package-code/vite/v/7.3.1/dist%2Fnode%2Findex.d.ts
 */
interface Vite7UserConfig {}
