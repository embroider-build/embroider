import { JSDOM } from 'jsdom';

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

  return transformHTML(html);
}

function transformHTML(html: string) {
  if (registry.size === 0) {
    return html;
  }

  let parsed = new JSDOM(html);
  let linkTags = [...parsed.window.document.querySelectorAll('link')] as HTMLLinkElement[];
  let scriptTags = [...parsed.window.document.querySelectorAll('script')] as HTMLScriptElement[];
  for (let linkTag of linkTags) {
    let fingerprinted = registry.get(linkTag.href);
    if (fingerprinted) {
      linkTag.href = fingerprinted;
    }
  }
  for (let scriptTag of scriptTags) {
    if (scriptTag.type !== 'module') {
      let fingerprinted = registry.get(scriptTag.src);
      if (fingerprinted) {
        scriptTag.src = fingerprinted;
      }
    }
  }
  return parsed.serialize();
}
