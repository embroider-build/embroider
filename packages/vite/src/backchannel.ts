import makeDebug from 'debug';

const debug = makeDebug('embroider:vite-esbuild-backchannel');

export class BackChannel {
  #state = new Map<string, InternalStatus>();

  constructor() {
    /*
      This is an unfortunate necessity. During depscan, vite deliberately hides
      information from esbuild. Specifically, it treats "not found" and "this is an
      external dependency" as both "external: true". But we really care about the
      difference, since we have fallback behaviors for the "not found" case. Using
      this global state, our rollup resolver plugin can observe what vite is
      actually doing and communicate that knowledge outward to our esbuild resolver
      plugin.
   */
    (globalThis as any).__embroider_vite_resolver_channel__ = this;
  }

  requestStatus(specifier: string, fromFile: string): void {
    let id = stateKey(specifier, fromFile);
    if (!this.#state.has(id)) {
      debug('requestStatus(%s, %s) pending', specifier, fromFile);
      this.#state.set(stateKey(specifier, fromFile), { type: 'pending' });
    } else {
      debug('requestStatus(%s, %s) exists', specifier, fromFile);
    }
  }

  writeStatus(specifier: string, fromFile: string, status: FinalStatus): void {
    let id = stateKey(specifier, fromFile);
    if (this.#state.get(id)?.type === 'pending') {
      debug('writeStatus(%s, %s) = %s', specifier, fromFile, status.type);
      this.#state.set(id, status);
    } else {
      debug('writeStatus(%s, %s) not pending', specifier, fromFile, status.type);
    }
  }

  readStatus(specifier: string, fromFile: string): Status {
    let id = stateKey(specifier, fromFile);
    let found = this.#state.get(id);
    debug('readStatus(%s, %s) = %s', specifier, fromFile, found?.type);
    if (!found) {
      throw new Error(`bug in BackChannel: readStatus before requestStatus`);
    }
    if (found.type === 'pending') {
      return { type: 'indeterminate' };
    }
    return found;
  }
}

export function writeStatus(specifier: string, fromFile: string, status: FinalStatus): void {
  let channel = (globalThis as any).__embroider_vite_resolver_channel__ as BackChannel | undefined;
  channel?.writeStatus(specifier, fromFile, status);
}

function stateKey(specifier: string, fromFile: string): string {
  return `${specifier}\0${fromFile}`;
}

export type FinalStatus = { type: 'not_found' } | { type: 'found'; filename: string };
export type Status = FinalStatus | { type: 'indeterminate' };
type InternalStatus = { type: 'pending' } | FinalStatus;
