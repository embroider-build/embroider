import { matchesSourceFile } from '../src/template-compiler-common';

describe('template-compiler-common', () => {
  test('that matchesSourceFile correctly matches paths for both Windows and Unix', () => {
    expect(matchesSourceFile('/htmlbars-inline-precompile/index.js')).toBeTruthy;
    expect(matchesSourceFile('/htmlbars-inline-precompile/index')).toBeTruthy;
    expect(matchesSourceFile('/htmlbars-inline-precompile/lib/require-from-worker.js')).toBeTruthy;
    expect(matchesSourceFile('/htmlbars-inline-precompile/lib/require-from-worker')).toBeTruthy;

    expect(matchesSourceFile('/ember-cli-htmlbars/index.js')).toBeTruthy;
    expect(matchesSourceFile('/ember-cli-htmlbars/index')).toBeTruthy;
    expect(matchesSourceFile('/ember-cli-htmlbars/lib/require-from-worker.js')).toBeTruthy;
    expect(matchesSourceFile('/ember-cli-htmlbars/lib/require-from-worker')).toBeTruthy;

    // Windows paths
    expect(matchesSourceFile('\\htmlbars-inline-precompile\\index.js')).toBeTruthy;
    expect(matchesSourceFile('\\htmlbars-inline-precompile\\index')).toBeTruthy;
    expect(matchesSourceFile('\\htmlbars-inline-precompile\\lib\\require-from-worker.js')).toBeTruthy;
    expect(matchesSourceFile('\\htmlbars-inline-precompile\\lib\\require-from-worker')).toBeTruthy;

    expect(matchesSourceFile('\\ember-cli-htmlbars\\index.js')).toBeTruthy;
    expect(matchesSourceFile('\\ember-cli-htmlbars\\index')).toBeTruthy;
    expect(matchesSourceFile('\\ember-cli-htmlbars\\lib\\require-from-worker.js')).toBeTruthy;
    expect(matchesSourceFile('\\ember-cli-htmlbars\\lib\\require-from-worker')).toBeTruthy;

    expect(matchesSourceFile('/ember-cli-htmlbars/')).toBeFalsy;
    expect(matchesSourceFile('/htmlbars-inline-precompile/')).toBeFalsy;
    expect(matchesSourceFile('')).toBeFalsy;
    expect(matchesSourceFile('badstring')).toBeFalsy;
  });
});
