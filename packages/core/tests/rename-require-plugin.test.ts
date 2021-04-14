import renameRequire from '../src/rename-require-plugin';
import { transformSync } from '@babel/core';

describe('babel-plugin-adjust-imports', function () {
  test('can rename require', function () {
    let code = transformSync(
      `
      import require from "require";
      function whatever() {
        require("x");
      }
    `,
      { plugins: [renameRequire] }
    )!.code!;
    expect(code).not.toMatch(/ require /);
    expect(code).not.toMatch(/ require\(/);
  });
});
