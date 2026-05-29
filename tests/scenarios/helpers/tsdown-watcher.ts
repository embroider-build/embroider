import CommandWatcher from './command-watcher';

// tsdown prints one of these (with a leading check mark, stripped by
// CommandWatcher) at the end of every (re)build. In watch mode it reports
// "Rebuilt in <n>ms"; a one-shot build reports "Build complete in <n>ms".
const BUILD_COMPLETE = /Rebuilt in|Build complete/;

// Drives `tsdown --watch` as a subprocess. The rollup-based `DevWatcher`
// (helpers/v2-addon.ts) is hard-wired to `rollup.watch`/`loadConfigFile` and
// cannot drive tsdown, so the tsdown watch tests use this instead.
export class TsdownWatcher {
  static async start(cwd: string): Promise<TsdownWatcher> {
    const command = CommandWatcher.launch('tsdown', ['--watch'], { cwd });
    const watcher = new TsdownWatcher(command);
    // wait for the initial build to settle
    await command.waitFor(BUILD_COMPLETE);
    return watcher;
  }

  private constructor(private command: CommandWatcher) {}

  async stop(): Promise<void> {
    await this.command.shutdown();
  }
}

// Polls `fn` until it resolves truthy or the timeout elapses. Used by the watch
// tests instead of counting rebuilds, since tsdown's watch rebuild cadence (and
// the addon-dev `clean` plugin, which skips rewriting unchanged output) make an
// exact build count unreliable.
export async function waitUntil(
  fn: () => boolean | Promise<boolean>,
  { timeout = 30000, interval = 100 }: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (await fn()) return;
    if (Date.now() - start > timeout) {
      throw new Error(`waitUntil timed out after ${timeout}ms`);
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}
