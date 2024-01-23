import type { Plugin } from 'rollup';
import { execaCommand } from 'execa';
import { fixBadDeclarationOutput } from 'fix-bad-declaration-output';

export default function rollupGlintPlugin(pattern: string): Plugin {
  return {
    name: 'rollup-glint-plugin',

    async closeBundle() {
      /**
       * Generate the types (these include /// <reference types="ember-source/types"
       * but our consumers may not be using those, or have a new enough ember-source that provides them.
       */
      await execaCommand(`pnpm glint --declaration`, { stdio: 'inherit' });
      /**
       * https://github.com/microsoft/TypeScript/issues/56571#
       * README: https://github.com/NullVoxPopuli/fix-bad-declaration-output
       */
      await fixBadDeclarationOutput(pattern || 'declarations/**/*.d.ts', [
        'TypeScript#56571',
        'Glint#628',
      ]);
    },
  };
}
