import type { Plugin } from 'vite';
import type { EmittedFile } from 'rollup';
import { HTMLRewriter } from 'htmlrewriter';
import fs from 'fs-extra';
const { readFileSync, readJSONSync, existsSync } = fs;
import { dirname, posix, resolve } from 'path';

// This is a type-only import, so it gets compiled away. At runtime, we load
// terser lazily so it's only loaded for production builds that use it. Don't
// add any non-type-only imports here.
import type { MinifyOptions } from 'terser';

const defaults = ['/assets/vendor.js', '/assets/test-support.js'];

export function scripts(params?: { include?: string[]; exclude?: string[] }): Plugin {
  let optimizer: ScriptOptimizer;

  // configured names are always interpreted as origin-absolute URLs.
  let names = (params?.include ?? defaults)
    .filter(name => !params?.exclude?.includes(name))
    .map(name => {
      if (name.startsWith('/')) {
        return name;
      } else {
        return '/' + name;
      }
    });

  let config: any = null;

  return {
    name: 'embroider-scripts',
    enforce: 'pre',

    configResolved(resolvedConfig) {
      config = resolvedConfig;
      optimizer = new ScriptOptimizer(resolvedConfig.root);
    },

    async generateBundle() {
      // this hook only runs in `vite build`
      for (let name of names) {
        for (let file of await optimizer.optimizedScript(name)) {
          this.emitFile(file);
        }
      }
    },

    async transformIndexHtml(htmlIn, context) {
      // we don't do anything in `vite dev`, we only need to work in `vite
      // build`
      if (!context.server) {
        return await optimizer.transformHTML(htmlIn, config.base);
      }
    },
  };
}

export class ScriptOptimizer {
  private emitted = new Map<string, string>();
  private transformState:
    | {
        htmlIn: string;
        htmlOut: string;
      }
    | undefined;

  constructor(private rootDir: string) {}

  async optimizedScript(script: string): Promise<EmittedFile[]> {
    let fullName = resolve(this.rootDir, script.slice(1));
    if (!existsSync(fullName)) {
      // in prod builds, test-support.js isn't going to exist (for example)
      return [];
    }

    // loading these lazily here so they never load in non-production builds.
    // The node cache will ensures we only load them once.
    const [Terser, srcURL] = await Promise.all([import('terser'), import('source-map-url')]);

    let inCode = readFileSync(fullName, 'utf8');
    let terserOpts: MinifyOptions = {};
    let fileRelativeSourceMapURL;
    let appRelativeSourceMapURL;
    if (srcURL.default.existsIn(inCode)) {
      fileRelativeSourceMapURL = srcURL.default.getFrom(inCode)!;
      appRelativeSourceMapURL = posix.join(dirname(script.slice(1)), fileRelativeSourceMapURL);
      let content;
      try {
        content = readJSONSync(resolve(this.rootDir, appRelativeSourceMapURL));
      } catch (err) {
        // the script refers to a sourcemap that doesn't exist, so we just leave
        // the map out.
      }
      if (content) {
        terserOpts.sourceMap = { content, url: fileRelativeSourceMapURL };
      }
    }
    let { code: outCode, map: outMap } = await Terser.minify(inCode, terserOpts);
    let finalFilename = await this.getFingerprintedFilename(script, outCode!);
    let emit: EmittedFile[] = [];
    emit.push({
      type: 'asset',
      fileName: finalFilename.slice(1),
      source: outCode!,
    });
    this.emitted.set(script, finalFilename);
    if (appRelativeSourceMapURL && outMap) {
      emit.push({
        type: 'asset',
        fileName: appRelativeSourceMapURL,
        source: JSON.stringify(outMap, null, 2),
      });
    }
    return emit;
  }

  async getFingerprintedFilename(filename: string, content: string): Promise<string> {
    let crypto = await import('crypto');
    let md5 = crypto.createHash('md5');
    md5.update(content);
    let hash = md5.digest('hex');
    let fileParts = filename.split('.');
    fileParts.splice(fileParts.length - 1, 0, hash);
    return fileParts.join('.');
  }

  async transformHTML(htmlIn: string, baseUrl: string) {
    if (this.transformState?.htmlIn !== htmlIn) {
      const rewriter = new HTMLRewriter();
      const emitted = this.emitted;

      rewriter.on('link', {
        element(element: Element) {
          if (element.getAttribute('href')?.startsWith('/@embroider/virtual')) {
            element.setAttribute('href', baseUrl + element.getAttribute('href')!.slice(1));
          }
        },
      });

      rewriter.on('script', {
        element(element: Element) {
          if (element.getAttribute('type') !== 'module') {
            let fingerprinted = emitted.get(element.getAttribute('src')!);
            if (fingerprinted) {
              element.setAttribute('src', fingerprinted);
            }
            if (element.getAttribute('src')?.startsWith('/@embroider/virtual')) {
              element.setAttribute('src', baseUrl + element.getAttribute('src')!.slice(1));
            }
          }
        },
      });

      const res = rewriter.transform(new Response(htmlIn));

      const htmlOut = await res.text();

      this.transformState = { htmlIn, htmlOut };
    }

    return this.transformState.htmlOut;
  }
}
