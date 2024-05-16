import type { Finding } from './audit';
import { CodeFrameStorage } from './audit/babel-visitor';
import { type Module, visitModules, type ContentType } from './module-visitor';

export interface HTTPAuditOptions {
  appURL: string;
  startingFrom: string[];
  fetch?: typeof fetch;
}

export async function httpAudit(
  options: HTTPAuditOptions
): Promise<{ modules: { [file: string]: Module }; findings: Finding[] }> {
  let findings: Finding[] = [];

  async function resolveId(specifier: string, fromFile: string): Promise<string | undefined> {
    return new URL(specifier, fromFile).href;
  }

  async function load(id: string): Promise<{ content: string | Buffer; type: ContentType }> {
    let response = await (options.fetch ?? globalThis.fetch)(id);
    let content = await response.text();
    let type: ContentType;
    if (response.status !== 200) {
      throw new Error(`oops status code ${response.status} - ${response.statusText} for ${id}: ${content}`);
    }
    switch (response.headers.get('content-type')) {
      case 'text/javascript':
        type = 'javascript';
        break;
      case 'text/html':
        type = 'html';
        break;
      default:
        throw new Error(`oops content type ${response.headers.get('content-type')} for ${id}`);
    }
    return { content, type };
  }

  let modules = await visitModules({
    base: options.appURL,
    entrypoints: options.startingFrom.map(s => new URL(s, options.appURL).href),
    babelConfig: { ast: true },
    frames: new CodeFrameStorage(),
    findings,
    resolveId,
    load,
  });

  return {
    modules,
    findings,
  };
}
