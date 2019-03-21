import Plugin, { Tree } from 'broccoli-plugin';
import walkSync from 'walk-sync';
import { unlinkSync, rmdirSync, mkdirSync, readFileSync, existsSync, mkdirpSync } from 'fs-extra';
import FSTree from 'fs-tree-diff';
import makeDebug from 'debug';
import { Pipeline, File } from 'babel-core';
import { sync as symlinkOrCopySync } from 'symlink-or-copy';
import { join, dirname, extname } from 'path';
import { isEqual, flatten } from 'lodash';

const debug = makeDebug('embroider:import-parser');

async function parserFor(babelMajorVersion: number, parserOptions: any) {
  if (babelMajorVersion === 7) {
    const { parseSync } = await import('@babel/core');
    return (content: string) => parseSync(content) as any;
  } else if (babelMajorVersion === 6) {
    const { parse } = await import('babylon');
    return (content: string) => parse(content, parserOptions) as any;
  } else  {
    throw new Error(`Embroider:Compat#importParser only supports babel '6' or '7', but got: '${babelMajorVersion}'`);
  }
}

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
  private parserOptions: any;
  private modules: Import[] | null = [];
  private paths: Map<string, Import[]> = new Map();
  private parse: (content: string, options?: any) => File = (_) => {
    throw new Error(`ImportParser#parse for babelMajorVersion: '${this.babelMajorVersion}' not implemented`);
  }
  private parserSetup = false;

  readonly babelMajorVersion: number;

  constructor(inputTree: Tree, options: { babelMajorVersion: number } = { babelMajorVersion: 7 },  private extensions = ['.js', '.hbs']) {
    super([inputTree], {
      annotation: 'embroider:core:import-parser',
      persistentOutput: true,
    });

    this.babelMajorVersion = options.babelMajorVersion;
    if (typeof this.babelMajorVersion === 'number' && this.babelMajorVersion !== this.babelMajorVersion) {
      throw new Error(`ImportParser was given an invalid babelMajorVersion of: ${this.babelMajorVersion}`);
    }
    if (this.babelMajorVersion === 6) {
      this.parserOptions = this.buildBabel6ParserOptions();
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

  private buildBabel6ParserOptions() {
    let babelOptions = {};
    let p = new Pipeline();
    let f = new File(babelOptions, p);
    return f.parserOpts;
  }

  async build() {
    if (this.parserSetup === false) {
      this.parse = await parserFor(this.babelMajorVersion, this.parserOptions);
      this.parserSetup = true;
    }

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
      ast = this.parse(source, this.parserOptions);
    } catch(err){
      if (typeof err === 'object' && err !== null && err.name !== 'SyntaxError') {
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
    // @ts-ignore
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

    // @ts-ignore
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
