import { sep } from 'path';
import { isInlinePrecompilePlugin } from '../src/detect-babel-plugins';

function path(...parts: string[]) {
  return sep + parts.join(sep);
}

describe('isInlinePrecompilePlugin', () => {
  test('matches the inline precompile plugins', () => {
    expect(isInlinePrecompilePlugin(path('htmlbars-inline-precompile', 'index.js'))).toBe(true);
    expect(isInlinePrecompilePlugin(path('htmlbars-inline-precompile', 'index'))).toBe(true);
    expect(isInlinePrecompilePlugin(path('htmlbars-inline-precompile', 'lib', 'require-from-worker.js'))).toBe(true);
    expect(isInlinePrecompilePlugin(path('htmlbars-inline-precompile', 'lib', 'require-from-worker'))).toBe(true);

    expect(isInlinePrecompilePlugin(path('ember-cli-htmlbars', 'index.js'))).toBe(true);
    expect(isInlinePrecompilePlugin(path('ember-cli-htmlbars', 'index'))).toBe(true);
    expect(isInlinePrecompilePlugin(path('ember-cli-htmlbars', 'lib', 'require-from-worker.js'))).toBe(true);
    expect(isInlinePrecompilePlugin(path('ember-cli-htmlbars', 'lib', 'require-from-worker'))).toBe(true);
  });

  test('matches babel-plugin-ember-template-compilation 2.x and 3.x+', () => {
    expect(isInlinePrecompilePlugin(path('babel-plugin-ember-template-compilation', 'src', 'node-main.js'))).toBe(true);
    expect(
      isInlinePrecompilePlugin(path('babel-plugin-ember-template-compilation', 'dist', 'src', 'node-main.js'))
    ).toBe(true);
    expect(
      isInlinePrecompilePlugin([path('babel-plugin-ember-template-compilation', 'dist', 'src', 'node-main.js'), {}])
    ).toBe(true);
  });

  test('does not match other paths', () => {
    expect(isInlinePrecompilePlugin(path('ember-cli-htmlbars', ''))).toBe(false);
    expect(isInlinePrecompilePlugin(path('htmlbars-inline-precompile', ''))).toBe(false);
    expect(isInlinePrecompilePlugin('')).toBe(false);
    expect(isInlinePrecompilePlugin('badstring')).toBe(false);
  });
});
