import { version as viteVersion } from 'vite';

function escapeRE(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseVersion(v: string): [number, number, number] {
  const [major = 0, minor = 0, patch = 0] = v.split('.').map(Number);
  return [major, minor, patch];
}

/**
 * Object-form transform hooks (`transform: { filter, handler }`) are supported
 * in Vite >=6.3.0 and Rollup >=4.38.0. Older versions only support function-form.
 */
export const supportsObjectHooks: boolean = (() => {
  const [major, minor] = parseVersion(viteVersion);
  return major > 6 || (major === 6 && minor >= 3);
})();

/**
 * Builds a RegExp that matches file IDs by extension(s),
 * looking for them at the end of the string or directly before the first ? or #.
 *
 * Taken from https://github.com/sveltejs/vite-plugin-svelte/blob/170bacc73d95d268e3673a5ec339da187adb82e0/packages/vite-plugin-svelte/src/utils/id.js#L174
 */
export function extFilter(...extensions: string[]): RegExp {
  return new RegExp(
    `^[^?#]+\\.(?:${extensions
      .map(e => (e.startsWith('.') ? e.slice(1) : e))
      .map(escapeRE)
      .join('|')})(?:[?#]|$)`
  );
}
