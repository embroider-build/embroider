import type { PreparedApp } from 'scenario-tester';
import { resolve } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { removeSync } from 'fs-extra';

declare global {
  interface Assert {
    codeMod: (params: { from: Record<string, string>; to: Record<string, string>; via: string }) => Promise<void>;
  }
}

export function codeModAssertions(hooks: NestedHooks, app: () => PreparedApp) {
  let cleanup = new Set<string>();
  hooks.beforeEach(assert => {
    async function codeMod(
      this: Assert,
      params: { from: Record<string, string>; to: Record<string, string>; via: string }
    ) {
      for (let [name, content] of Object.entries(params.from)) {
        cleanup.add(name);
        writeFileSync(resolve(app().dir, name), content, 'utf8');
      }
      let result = await app().execute(params.via, {
        env: {
          EMBROIDER_VITE_COMMAND: 'prebuild',
        },
      });
      assert.strictEqual(result.exitCode, 0, result.output);
      if (result.exitCode !== 0) {
        return;
      }
      for (let name of Object.keys(params.from)) {
        this.ok(!existsSync(resolve(app().dir, name)), `${name} should have been removed`);
      }
      for (let [name, content] of Object.entries(params.to)) {
        cleanup.add(name);
        let actual: string;
        try {
          actual = readFileSync(resolve(app().dir, name), 'utf8');
        } catch (err) {
          if (err.code !== 'ENOENT') {
            throw err;
          }
          actual = '<missing file>';
        }
        // we're not using code-equality-assertions (which would be nicer)
        // because that doesn't do template tag.
        this.strictEqual(normalizeWhitespace(actual), normalizeWhitespace(content));
      }
    }
    assert.codeMod = codeMod;
  });
  hooks.afterEach(() => {
    for (let name of cleanup) {
      removeSync(resolve(app().dir, name));
    }
  });
}

function normalizeWhitespace(src: string): string {
  return src
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}
