import type { ViteDevServer } from 'vite';
import makeDebug from 'debug';

const debug = makeDebug('embroider:vite');

export class DepTracker {
  #virtualDeps: Map<string, string[]> = new Map();
  #server: ViteDevServer;

  constructor(server: ViteDevServer) {
    this.#server = server;
    server.watcher.on('all', (_eventName, path) => {
      for (let [id, watches] of this.#virtualDeps) {
        for (let watch of watches) {
          if (path.startsWith(watch)) {
            debug('Invalidate %s because %s', id, path);
            server.moduleGraph.onFileChange(id);
            let m = server.moduleGraph.getModuleById(id);
            if (m) {
              server.reloadModule(m);
            }
          }
        }
      }
    });
  }

  trackDeps(id: string, deps: string[]) {
    this.#virtualDeps.set(id, deps);
    this.#server.watcher.add(deps);
  }
}
