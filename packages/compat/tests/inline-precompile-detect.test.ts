import { isInlinePrecompilePlugin } from '../src/detect-babel-plugins';

describe('isInlinePrecompilePlugin', () => {
  test('that matchesSourceFile correctly matches paths for both Windows and Unix', () => {
    expect(isInlinePrecompilePlugin('/htmlbars-inline-precompile/index.js')).toBeTruthy;
    expect(isInlinePrecompilePlugin('/htmlbars-inline-precompile/index')).toBeTruthy;
    expect(isInlinePrecompilePlugin('/htmlbars-inline-precompile/lib/require-from-worker.js')).toBeTruthy;
    expect(isInlinePrecompilePlugin('/htmlbars-inline-precompile/lib/require-from-worker')).toBeTruthy;

    expect(isInlinePrecompilePlugin('/ember-cli-htmlbars/index.js')).toBeTruthy;
    expect(isInlinePrecompilePlugin('/ember-cli-htmlbars/index')).toBeTruthy;
    expect(isInlinePrecompilePlugin('/ember-cli-htmlbars/lib/require-from-worker.js')).toBeTruthy;
    expect(isInlinePrecompilePlugin('/ember-cli-htmlbars/lib/require-from-worker')).toBeTruthy;

    // Windows paths
    expect(isInlinePrecompilePlugin('\\htmlbars-inline-precompile\\index.js')).toBeTruthy;
    expect(isInlinePrecompilePlugin('\\htmlbars-inline-precompile\\index')).toBeTruthy;
    expect(isInlinePrecompilePlugin('\\htmlbars-inline-precompile\\lib\\require-from-worker.js')).toBeTruthy;
    expect(isInlinePrecompilePlugin('\\htmlbars-inline-precompile\\lib\\require-from-worker')).toBeTruthy;

    expect(isInlinePrecompilePlugin('\\ember-cli-htmlbars\\index.js')).toBeTruthy;
    expect(isInlinePrecompilePlugin('\\ember-cli-htmlbars\\index')).toBeTruthy;
    expect(isInlinePrecompilePlugin('\\ember-cli-htmlbars\\lib\\require-from-worker.js')).toBeTruthy;
    expect(isInlinePrecompilePlugin('\\ember-cli-htmlbars\\lib\\require-from-worker')).toBeTruthy;

    expect(isInlinePrecompilePlugin('/ember-cli-htmlbars/')).toBeFalsy;
    expect(isInlinePrecompilePlugin('/htmlbars-inline-precompile/')).toBeFalsy;
    expect(isInlinePrecompilePlugin('')).toBeFalsy;
    expect(isInlinePrecompilePlugin('badstring')).toBeFalsy;
  });
});
