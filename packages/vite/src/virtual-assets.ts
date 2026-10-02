import type { ResolvedConfig } from 'vite';

export const VIRTUAL_URL_PREFIX = '/@embroider/virtual/';

// '/@embroider/virtual/filename' => '__VITE_ASSET__${referenceId}__'
type Registry = Map<string, string>;

const registries = new WeakMap<ResolvedConfig, Registry>();

export function virtualAssetRegistry(config: ResolvedConfig): Registry {
  let registry = registries.get(config);
  if (!registry) {
    registry = new Map();
    registries.set(config, registry);
  }
  return registry;
}

export function emitVirtualAsset(
  config: ResolvedConfig,
  context: { emitFile: (emittedFile: { type: 'asset'; name: string; source: string | Uint8Array }) => string },
  { url, name, source }: { url: string; name: string; source: string | Uint8Array }
): void {
  let referenceId = context.emitFile({ type: 'asset', name, source });
  virtualAssetRegistry(config).set(url, `__VITE_ASSET__${referenceId}__`);
}

export function rewriteVirtualAssetUrls(html: string, config: ResolvedConfig | undefined, isDev: boolean): string {
  if (isDev) {
    let base = config?.base ?? '/';
    return html.split(VIRTUAL_URL_PREFIX).join(base + VIRTUAL_URL_PREFIX.slice(1));
  }

  let out = html;
  for (let [url, placeholder] of config ? virtualAssetRegistry(config) : []) {
    out = out.split(url).join(placeholder);
  }
  return out;
}
