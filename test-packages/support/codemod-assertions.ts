import type { PreparedApp } from 'scenario-tester';
import { resolve } from 'path';
import { existsSync, readFileSync, outputFileSync } from 'fs-extra';
import { removeSync } from 'fs-extra';

declare global {
  interface Assert {
    codeMod: (params: { from: Record<string, string>; to: Record<string, string>; via: string }) => Promise<void>;
    codeModFailure: (params: { from: Record<string, string>; matches: RegExp; via: string }) => Promise<void>;
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
        outputFileSync(resolve(app().dir, name), content, 'utf8');
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

    async function codeModFailure(
      this: Assert,
      params: { from: Record<string, string>; matches: RegExp; via: string }
    ) {
      for (let [name, content] of Object.entries(params.from)) {
        cleanup.add(name);
        outputFileSync(resolve(app().dir, name), content, 'utf8');
      }
      let result = await app().execute(params.via, {
        env: {
          EMBROIDER_VITE_COMMAND: 'prebuild',
        },
      });
      assert.notStrictEqual(result.exitCode, 0, result.output);
      if (result.exitCode === 0) {
        assert.ok(false, `Expected codemod to fail but it succeeded`);
        return;
      }
      if (params.matches.test(result.output)) {
        assert.ok(true, `Failure log matched expected ${params.matches}`);
      } else {
        assert.ok(false, `Failure log did not match ${params.matches}:\n${result.output}`);
      }
    }

    assert.codeMod = codeMod;
    assert.codeModFailure = codeModFailure;
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
