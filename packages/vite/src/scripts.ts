import type { Plugin } from 'vite';
import type { EmittedFile } from 'rollup';
import { JSDOM } from 'jsdom';
import { readFileSync, readJSONSync } from 'fs-extra';
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

  return {
    name: 'embroider-scripts',
    enforce: 'pre',

    configResolved(resolvedConfig) {
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

    transformIndexHtml(htmlIn, context) {
      // we don't do anything in `vite dev`, we only need to work in `vite
      // build`
      if (!context.server) {
        return optimizer.transformHTML(htmlIn);
      }
    },
  };
}

class ScriptOptimizer {
  private emitted = new Map<string, string>();
  private transformState:
    | {
        htmlIn: string;
        htmlOut: string;
        parsed: JSDOM;
      }
    | undefined;

  constructor(private rootDir: string) {}

  async optimizedScript(script: string): Promise<EmittedFile[]> {
    // loading these lazily here so they never load in non-production builds.
    // The node cache will ensures we only load them once.
    const [Terser, srcURL] = await Promise.all([import('terser'), import('source-map-url')]);

    let inCode = readFileSync(resolve(this.rootDir, script.slice(1)), 'utf8');
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

  transformHTML(htmlIn: string) {
    if (this.transformState?.htmlIn !== htmlIn) {
      let parsed = new JSDOM(htmlIn);
      let scriptTags = [...parsed.window.document.querySelectorAll('script')] as HTMLScriptElement[];
      for (let scriptTag of scriptTags) {
        if (scriptTag.type !== 'module') {
          let fingerprinted = this.emitted.get(scriptTag.src);
          if (fingerprinted) {
            scriptTag.src = fingerprinted;
          }
        }
      }
      let htmlOut = parsed.serialize();
      this.transformState = { htmlIn, parsed, htmlOut };
    }
    return this.transformState.htmlOut;
  }
}
