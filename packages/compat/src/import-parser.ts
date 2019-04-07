import Plugin, { Tree } from 'broccoli-plugin';
import walkSync from 'walk-sync';
import { unlinkSync, rmdirSync, mkdirSync, readFileSync, existsSync, mkdirpSync } from 'fs-extra';
import FSTree from 'fs-tree-diff';
import makeDebug from 'debug';
import { sync as symlinkOrCopySync } from 'symlink-or-copy';
import { join, dirname, extname } from 'path';
import { isEqual, flatten } from 'lodash';
import { TransformOptions } from '@babel/core';
import { File } from '@babel/types';
import assertNever from 'assert-never';
import { Memoize } from 'typescript-memoize';

const debug = makeDebug('embroider:import-parser');

export interface Import {
  path: string;
  specifier: string;
  isDynamic: boolean;
}

/*
  ImportParser discovers and maintains info on all the module imports that
  appear in a broccoli tree.
*/
export default class ImportParser extends Plugin {
  private previousTree = new FSTree();
  private modules: Import[] | null = [];
  private paths: Map<string, Import[]> = new Map();
  private parse: ((contents: string) => File) | undefined;

  constructor(
    inputTree: Tree,
    private babelMajorVersion: 6 | 7,
    private babelConfig: TransformOptions,
    private extensions = ['.js', '.hbs']
  ) {
    super([inputTree], {
      annotation: 'embroider:core:import-parser',
      persistentOutput: true,
    });
  }

  @Memoize()
  private async setupParser() {
    switch (this.babelMajorVersion) {
      case 6:
        this.parse = await babel6Parser(this.babelConfig);
        break;
      case 7:
        this.parse = await babel7Parser(this.babelConfig);
        break;
      default:
        throw assertNever(this.babelMajorVersion);
    }
  }

  get imports(): Import[] {
    if (!this.modules) {
      this.modules = flatten([...this.paths.values()]);
      debug('imports %s', new PrintableImports(this.modules));
    }
    return this.modules;
  }

  get filenames(): string[] {
    return [...this.paths.keys()];
  }

  async build() {
    await this.setupParser();
    this.getPatchset().forEach(([operation, relativePath]) => {
      let outputPath = join(this.outputPath, relativePath);

      switch (operation) {
        case 'unlink':
          if (this.extensions.includes(extname(relativePath))) {
            this.removeImports(relativePath);
          }
          unlinkSync(outputPath);
          break;
        case 'rmdir':
          rmdirSync(outputPath);
          break;
        case 'mkdir':
          mkdirSync(outputPath);
          break;
        case 'create':
        case 'change': {
          let absoluteInputPath = join(this.inputPaths[0], relativePath);
          if (this.extensions.includes(extname(relativePath))) {
            this.updateImports(relativePath, absoluteInputPath);
          }
          copy(absoluteInputPath, outputPath);
        }
      }
    });
  }

  private getPatchset() {
    let input = walkSync.entries(this.inputPaths[0], { globs: ['**/*'] });
    let previous = this.previousTree;
    let next = (this.previousTree = FSTree.fromEntries(input));
    return previous.calculatePatch(next);
  }

  removeImports(relativePath: string) {
    debug(`removing imports for ${relativePath}`);
    let imports = this.paths.get(relativePath);
    if (imports) {
      if (imports.length > 0) {
        this.modules = null; // invalidates cache
      }
      this.paths.delete(relativePath);
    }
  }

  updateImports(relativePath: string, absoluteInputPath: string) {
    let source = readFileSync(absoluteInputPath, 'utf8');
    debug(`updating imports for ${relativePath}, ${source.length}`);
    let newImports = this.parseImports(relativePath, source);
    if (!isEqual(this.paths.get(relativePath), newImports)) {
      this.paths.set(relativePath, newImports);
      this.modules = null; // invalidates cache
    }
  }

  private parseImports(relativePath: string, source: string): Import[] {
    if (extname(relativePath) === '.hbs') {
      // there are no hbs templates yet that have imports. When ember introduces
      // them, this will need to parse them and discover the imports.
      return [];
    }

    let ast;
    try {
      // the "!" is safe because we called setupParser at the start of build()
      ast = this.parse!(source);
    } catch (err) {
      if (err.name !== 'SyntaxError') {
        throw err;
      }
      // This is OK. The file is still going to get sent through the rest of the
      // normal babel processing, which will generate a nice error for it.
      debug('Ignoring an unparseable file');
    }
    let imports: Import[] = [];
    if (!ast) {
      return imports;
    }

    forEachNode(ast.program.body, (node: any) => {
      if (node.type === 'CallExpression' && node.callee && node.callee.type === 'Import') {
        // it's a syntax error to have anything other than exactly one
        // argument, so we can just assume this exists
        let argument = node.arguments[0];
        if (argument.type !== 'StringLiteral') {
          throw new Error('@embroider/core only supports dynamic import() with a string literal argument.');
        }
        imports.push({ isDynamic: true, specifier: argument.value, path: relativePath });
      }
    });

    // No need to recurse here, because we only deal with top-level static import declarations
    for (let node of ast.program.body) {
      let specifier: string | undefined;
      if (node.type === 'ImportDeclaration') {
        specifier = node.source.value;
      }
      if (node.type === 'ExportNamedDeclaration' && node.source) {
        specifier = node.source.value;
      }
      if (specifier) {
        imports.push({
          isDynamic: false,
          specifier,
          path: relativePath,
        });
      }
    }
    return imports;
  }
}

function copy(sourcePath: string, destPath: string) {
  let destDir = dirname(destPath);

  try {
    symlinkOrCopySync(sourcePath, destPath);
  } catch (e) {
    if (!existsSync(destDir)) {
      mkdirpSync(destDir);
    }
    try {
      unlinkSync(destPath);
    } catch (e) {
      // swallow the error
    }
    symlinkOrCopySync(sourcePath, destPath);
  }
}

const skipKeys: { [key: string]: boolean } = {
  loc: true,
  type: true,
  start: true,
  end: true,
};

function forEachNode(node: any, visit: (node: any) => void) {
  visit(node);
  for (let key in node) {
    if (skipKeys[key]) {
      continue;
    }
    let child = node[key];
    if (child && typeof child === 'object' && (child.type || Array.isArray(child))) {
      forEachNode(child, visit);
    }
  }
}

class PrintableImports {
  constructor(private imports: Import[]) {}
  toString() {
    return JSON.stringify(this.imports, null, 2);
  }
}

async function babel6Parser(babelOptions: unknown): Promise<(source: string) => File> {
  let core = import('babel-core');
  let babylon = import('babylon');

  // missing upstream types (or we are using private API, because babel 6 didn't
  // have a good way to construct a parser directly from the general babel
  // options)
  const { Pipeline, File } = (await core) as any;
  const { parse } = await babylon;

  let p = new Pipeline();
  let f = new File(babelOptions, p);
  let options = f.parserOpts;

  return function(source) {
    return (parse(source, options) as unknown) as File;
  };
}

async function babel7Parser(babelOptions: TransformOptions): Promise<(source: string) => File> {
  let core = import('@babel/core');

  const { parseSync } = await core;
  return function(source: string) {
    return parseSync(source, babelOptions) as File;
  };
}
