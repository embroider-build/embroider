function escapeRE(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Taken from https://github.com/sveltejs/vite-plugin-svelte/blob/170bacc73d95d268e3673a5ec339da187adb82e0/packages/vite-plugin-svelte/src/utils/id.js#L174
 */
export function buildIdFilter(options: { include?: string[]; exclude?: string[]; extensions: string[] }) {
  const { include = [], exclude = [], extensions } = options;
  // this regex combines configured extensions and looks for them at the end of the string or directly before first ? or #
  const extensionsRE = new RegExp(
    `^[^?#]+\\.(?:${extensions
      .map(e => (e.startsWith('.') ? e.slice(1) : e))
      .map(escapeRE)
      .join('|')})(?:[?#]|$)`
  );
  return {
    id: {
      include: [extensionsRE, ...include],
      exclude: [...exclude],
    },
  };
}
