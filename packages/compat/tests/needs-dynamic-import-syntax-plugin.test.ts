import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { needsDynamicImportSyntaxPlugin } from '../src/detect-babel-plugins';

const roots: string[] = [];

function emberCLIBabelWithCore(corePackageJSON: object): string {
  let root = mkdtempSync(join(tmpdir(), 'ember-cli-babel-'));
  roots.push(root);
  let core = join(root, 'node_modules', '@babel', 'core');
  mkdirSync(core, { recursive: true });
  writeFileSync(join(core, 'package.json'), JSON.stringify(corePackageJSON));
  return root;
}

function withCore(version: string): string {
  return emberCLIBabelWithCore({ name: '@babel/core', version });
}

describe('needsDynamicImportSyntaxPlugin', () => {
  afterAll(() => {
    for (let root of roots) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('Babel before 7.8 needs the syntax plugin', () => {
    expect(needsDynamicImportSyntaxPlugin(withCore('7.7.7'))).toBe(true);
  });

  test('Babel 7.8 and later parse import() on their own', () => {
    expect(needsDynamicImportSyntaxPlugin(withCore('7.8.0'))).toBe(false);
    expect(needsDynamicImportSyntaxPlugin(withCore('7.29.13'))).toBe(false);
  });

  test('Babel 8 parses import() on its own', () => {
    expect(needsDynamicImportSyntaxPlugin(withCore('8.1.3'))).toBe(false);
  });

  test('keeps the plugin when the Babel version is unknown', () => {
    expect(needsDynamicImportSyntaxPlugin(undefined)).toBe(true);
    expect(needsDynamicImportSyntaxPlugin(emberCLIBabelWithCore({ name: '@babel/core' }))).toBe(true);
  });
});
