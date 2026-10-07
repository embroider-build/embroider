export const VIRTUAL_URL_PREFIX = '/@embroider/virtual/';

// '/@embroider/virtual/filename' => '__VITE_ASSET__${referenceId}__'
const registry: Map<string, string> = new Map();

export function emitVirtualAsset(
  context: { emitFile: (emittedFile: { type: 'asset'; name: string; source: string | Uint8Array }) => string },
  { url, name, source }: { url: string; name: string; source: string | Uint8Array }
): void {
  // This is documented API https://vite.dev/guide/api-plugin#referencing-emitted-assets
  let referenceId = context.emitFile({ type: 'asset', name, source });
  registry.set(url, `__VITE_ASSET__${referenceId}__`);
}

export function rewriteVirtualAssetUrls(html: string, base: string | undefined, isDev: boolean): string {
  if (isDev) {
    let _base = base || '/';
    return html.split(VIRTUAL_URL_PREFIX).join(_base + VIRTUAL_URL_PREFIX.slice(1));
  }

  let out = html;
  for (let [url, placeholder] of registry) {
    out = out.split(url).join(placeholder);
  }
  return out;
}
