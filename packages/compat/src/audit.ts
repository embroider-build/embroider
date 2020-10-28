import { readFileSync, readJSONSync } from 'fs-extra';
import { dirname, join, resolve as resolvePath } from 'path';
import resolveModule from 'resolve';
import { applyVariantToTemplateCompiler, AppMeta, explicitRelative } from '@embroider/core';
import { Memoize } from 'typescript-memoize';
import execa from 'execa';
import chalk from 'chalk';
import jsdom from 'jsdom';
import { transformSync } from '@babel/core';
import traverse, { NodePath, Node } from '@babel/traverse';
import { codeFrameColumns, SourceLocation } from '@babel/code-frame';
import {
  CallExpression,
  ExportDefaultDeclaration,
  ExportSpecifier,
  Identifier,
  ImportDeclaration,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
  ImportSpecifier,
  isImport,
  isStringLiteral,
  StringLiteral,
} from '@babel/types';
import groupBy from 'lodash/groupBy';
import fromPairs from 'lodash/fromPairs';
const { JSDOM } = jsdom;

export interface AuditOptions {
  debug?: boolean;
}

export interface AuditBuildOptions extends AuditOptions {
  'reuse-build': boolean;
  app: string;
}

export interface Finding {
  message: string;
  filename: string;
  detail: string;
  codeFrame?: string;
}

export interface Module {
  consumedFrom: (string | RootMarker)[];
  imports: Import[];
  exports: string[];
  resolutions: { [source: string]: string };
}

interface InternalModule {
  consumedFrom: (string | RootMarker)[];
  imports: InternalImport[];
  exports: Set<string>;
  resolutions: Map<string, string>;
}

export interface Import {
  name: string | NamespaceMarker;
  local: string;
  source: string;
}

interface InternalImport extends Import {
  codeFrameIndex: number | undefined;
}

export interface NamespaceMarker {
  isNamespace: true;
}

export class AuditResults {
  modules: { [file: string]: Module } = {};
  findings: Finding[] = [];

  constructor(baseDir: string, findings: Finding[], modules: Map<string, InternalModule>) {
    for (let [filename, module] of modules) {
      let publicModule: Module = {
        consumedFrom: module.consumedFrom.map(entry => {
          if (isRootMarker(entry)) {
            return entry;
          } else {
            return explicitRelative(baseDir, entry);
          }
        }),
        resolutions: fromPairs(
          [...module.resolutions].map(([source, target]) => [source, explicitRelative(baseDir, target)])
        ),
        imports: module.imports.map(i => ({
          name: i.name,
          local: i.local,
          source: i.source,
        })),
        exports: [...module.exports],
      };
      this.modules[explicitRelative(baseDir, filename)] = publicModule;
    }
    for (let finding of findings) {
      let relFinding = Object.assign({}, finding, { filename: explicitRelative(baseDir, finding.filename) });
      this.findings.push(relFinding);
    }
  }

  humanReadable(): string {
    let output = [] as string[];
    let findingsByFile = groupBy(this.findings, f => f.filename);
    for (let [filename, findings] of Object.entries(findingsByFile)) {
      output.push(`${chalk.yellow(filename)}`);
      for (let finding of findings) {
        output.push(indent(chalk.red(finding.message), 1));
        output.push(indent(finding.detail, 2));
        if (finding.codeFrame) {
          output.push(indent(finding.codeFrame, 2));
        }
      }
      output.push(indent(chalk.blueBright(`file was included because:`), 1));
      let pointer: string | RootMarker = filename;
      while (!isRootMarker(pointer)) {
        // the zero here means we only display the first path we found. I think
        // that's a fine tradeoff to keep the output smaller.
        let nextPointer: string | RootMarker | undefined = this.modules[pointer]?.consumedFrom[0];
        if (!nextPointer) {
          output.push(
            indent(
              chalk.red(`couldn't figure out why this was included. Please file a bug against @embroider/compat.`),
              2
            )
          );
          break;
        }
        if (isRootMarker(nextPointer)) {
          output.push(indent('packageJSON.ember-addon.assets', 2));
        } else {
          output.push(indent(nextPointer, 2));
        }
        pointer = nextPointer;
      }
    }
    output.push(''); // always end with a newline because `yarn run` can overwrite our last line otherwise
    return output.join('\n');
  }
}

export class Audit {
  private modules: Map<string, InternalModule> = new Map();
  private moduleQueue = new Set<string>();
  private findings = [] as Finding[];

  private codeFrames = [] as { rawSourceIndex: number; loc: SourceLocation }[];
  private rawSources = [] as string[];

  static async run(options: AuditBuildOptions): Promise<AuditResults> {
    let dir = await this.buildApp(options);
    return new this(dir, options).run();
  }

  private static async buildApp(options: AuditBuildOptions): Promise<string> {
    if (!options['reuse-build']) {
      try {
        await execa('ember', ['build'], {
          all: true,
          cwd: options.app,
          env: {
            STAGE2_ONLY: 'true',
          },
        });
      } catch (err) {
        throw new BuildError(err.all);
      }
    }
    return readFileSync(join(options.app, 'dist/.stage2-output'), 'utf8');
  }

  constructor(private appDir: string, private options: AuditOptions = {}) {}

  @Memoize()
  private get pkg() {
    return readJSONSync(join(this.appDir, 'package.json'));
  }

  private get meta() {
    return this.pkg['ember-addon'] as AppMeta;
  }

  @Memoize()
  private get babelConfig() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    let config = require(join(this.appDir, this.meta.babel.filename));
    config = Object.assign({}, config);
    config.plugins = config.plugins.filter((p: any) => !isMacrosPlugin(p));
    config.ast = true;
    return config;
  }

  @Memoize()
  private get templateCompiler(): (filename: string, content: string) => string {
    return applyVariantToTemplateCompiler(
      { name: 'default', runtime: 'all', optimizeForProduction: false },
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require(join(this.appDir, this.meta['template-compiler'].filename)).compile
    );
  }

  private debug(message: string, ...args: any[]) {
    if (this.options.debug) {
      console.log(message, ...args);
    }
  }

  private visitorFor(
    filename: string
  ): (this: Audit, filename: string, content: Buffer | string, module: InternalModule) => Promise<string[]> {
    if (filename.endsWith('.html')) {
      return this.visitHTML;
    } else if (filename.endsWith('.hbs')) {
      return this.visitHBS;
    } else {
      return this.visitJS;
    }
  }

  private async drainQueue() {
    while (this.moduleQueue.size > 0) {
      let filename = this.moduleQueue.values().next().value as string;
      this.moduleQueue.delete(filename);
      this.debug('visit', filename);
      let visitor = this.visitorFor(filename);
      let content = readFileSync(filename);
      // cast is safe because the only way to get into the queue is to go
      // through scheduleVisit, and scheduleVisit creates the entry in
      // this.modules.
      let module = this.modules.get(filename)!;
      let dependencies = await visitor.call(this, filename, content, module);
      for (let dep of dependencies) {
        let depFilename = await this.resolve(dep, filename);
        if (depFilename) {
          module.resolutions.set(dep, depFilename);
          this.scheduleVisit(depFilename, filename);
        }
      }
    }
  }

  async run(): Promise<AuditResults> {
    this.debug(`meta`, this.meta);
    for (let asset of this.meta.assets) {
      if (asset.endsWith('.html')) {
        this.scheduleVisit(resolvePath(this.appDir, asset), { isRoot: true });
      }
    }
    await this.drainQueue();
    await this.inspectModules();
    return new AuditResults(this.appDir, this.findings, this.modules);
  }

  private async inspectModules() {
    for (let [filename, module] of this.modules) {
      for (let imp of module.imports) {
        if (imp.name === 'default') {
          let resolved = module.resolutions.get(imp.source);
          if (resolved) {
            let target = this.modules.get(resolved)!;
            if (!target.exports.has('default')) {
              let backtick = '`';
              this.findings.push({
                filename,
                message: 'importing a non-existent default export',
                detail: `"${imp.source}" has no default export. Did you mean ${backtick}import * as ${imp.local} from "${imp.source}"${backtick}?`,
                codeFrame: this.renderCodeFrame(imp.codeFrameIndex),
              });
            }
          }
        }
      }
    }
  }

  private async visitHTML(filename: string, content: Buffer | string): Promise<string[]> {
    let dom = new JSDOM(content);
    let scripts = dom.window.document.querySelectorAll('script[type="module"]') as NodeListOf<HTMLScriptElement>;
    let dependencies = [] as string[];
    for (let script of scripts) {
      let src = script.src;
      if (!src) {
        continue;
      }
      if (new URL(src, 'http://example.com:4321').origin !== 'http://example.com:4321') {
        // src was absolute, we don't handle it
        continue;
      }
      if (src.startsWith(this.meta['root-url'])) {
        // root-relative URLs are actually relative to the appDir
        src = explicitRelative(dirname(filename), resolvePath(this.appDir, src.replace(this.meta['root-url'], '')));
      }
      dependencies.push(src);
    }
    return dependencies;
  }

  private async visitJS(filename: string, content: Buffer | string, module: InternalModule): Promise<string[]> {
    let dependencies = [] as string[];
    let rawSource = content.toString('utf8');
    let saveCodeFrame = this.codeFrameMaker(rawSource);
    try {
      let result = transformSync(rawSource, Object.assign({ filename: filename }, this.babelConfig));

      let currentImportDeclaration: ImportDeclaration | undefined;

      traverse(result!.ast!, {
        ImportDeclaration: {
          enter(path: NodePath<ImportDeclaration>) {
            dependencies.push(path.node.source.value);
            currentImportDeclaration = path.node;
          },
          exit() {
            currentImportDeclaration = undefined;
          },
        },
        CallExpression(path: NodePath<CallExpression>) {
          let callee = path.get('callee');
          if (callee.referencesImport('@embroider/macros', 'importSync') || isImport(callee)) {
            let arg = path.node.arguments[0];
            if (arg.type === 'StringLiteral') {
              dependencies.push(arg.value);
            } else {
              throw new Error(`unimplemented: non literal importSync`);
            }
          }
        },
        ImportDefaultSpecifier: (path: NodePath<ImportDefaultSpecifier>) => {
          module.imports.push({
            name: 'default',
            local: path.node.local.name,
            // cast is OK because ImportDefaultSpecifier can only be a child of ImportDeclaration
            source: currentImportDeclaration!.source.value,
            codeFrameIndex: saveCodeFrame(path.node),
          });
        },
        ImportNamespaceSpecifier(path: NodePath<ImportNamespaceSpecifier>) {
          module.imports.push({
            name: { isNamespace: true },
            local: path.node.local.name,
            // cast is OK because ImportNamespaceSpecifier can only be a child of ImportDeclaration
            source: currentImportDeclaration!.source.value,
            codeFrameIndex: saveCodeFrame(path.node),
          });
        },
        ImportSpecifier(path: NodePath<ImportSpecifier>) {
          module.imports.push({
            name: name(path.node.imported),
            local: path.node.local.name,
            // cast is OK because ImportSpecifier can only be a child of ImportDeclaration
            source: currentImportDeclaration!.source.value,
            codeFrameIndex: saveCodeFrame(path.node),
          });
        },
        ExportDefaultDeclaration(_path: NodePath<ExportDefaultDeclaration>) {
          module.exports.add('default');
        },
        ExportSpecifier(path: NodePath<ExportSpecifier>) {
          module.exports.add(name(path.node.exported));
        },
      });
    } catch (err) {
      if (err.code === 'BABEL_PARSE_ERROR') {
        this.pushFinding({
          filename,
          message: `failed to parse`,
          detail: err.toString(),
        });
      } else {
        throw err;
      }
    }
    return dependencies;
  }

  private async visitHBS(filename: string, content: Buffer | string, module: InternalModule): Promise<string[]> {
    let js;
    try {
      js = this.templateCompiler(filename, content.toString('utf8'));
    } catch (err) {
      this.pushFinding({
        filename,
        message: `failed to compile template`,
        detail: err.toString(),
      });
      return [];
    }
    return this.visitJS(filename, js, module);
  }

  private codeFrameMaker(rawSource: string): (node: Node) => number | undefined {
    let rawSourceIndex: number | undefined;
    return (node: Node) => {
      let loc = node.loc;
      if (!loc) {
        return;
      }
      if (rawSourceIndex == null) {
        rawSourceIndex = this.rawSources.length;
        this.rawSources.push(rawSource);
      }
      let codeFrameIndex = this.codeFrames.length;
      this.codeFrames.push({
        rawSourceIndex,
        loc,
      });
      return codeFrameIndex;
    };
  }

  private renderCodeFrame(codeFrameIndex: number | undefined): string | undefined {
    if (codeFrameIndex != null) {
      let { loc, rawSourceIndex } = this.codeFrames[codeFrameIndex];
      return codeFrameColumns(this.rawSources[rawSourceIndex], loc, { highlightCode: true });
    }
  }

  private async resolve(specifier: string, fromPath: string): Promise<string | undefined> {
    if (specifier === '@embroider/macros') {
      return;
    }
    try {
      return resolveModule.sync(specifier, {
        basedir: dirname(fromPath),
        extensions: this.meta['resolvable-extensions'],
      });
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        this.pushFinding({
          filename: fromPath,
          message: `unable to resolve dependency`,
          detail: specifier,
        });
      } else {
        throw err;
      }
    }
  }

  private pushFinding(finding: Finding) {
    this.findings.push(finding);
  }

  private scheduleVisit(filename: string, parent: string | RootMarker) {
    let record = this.modules.get(filename);
    if (!record) {
      this.debug(`discovered`, filename);
      record = {
        consumedFrom: [parent],
        imports: [],
        exports: new Set(),
        resolutions: new Map(),
      };
      this.modules.set(filename, record);
      this.moduleQueue.add(filename);
    } else {
      record.consumedFrom.push(parent);
    }
  }
}

export class BuildError extends Error {
  isBuildError = true;
  constructor(buildOutput: string) {
    super(buildOutput);
  }
}

export function isBuildError(err: any): err is BuildError {
  return err?.isBuildError;
}

function isMacrosPlugin(p: any) {
  return Array.isArray(p) && p[1] && p[1].embroiderMacrosConfigMarker;
}

function indent(str: string, level: number) {
  const spacesPerLevel = 2;
  let spaces = '';
  for (let i = 0; i < level * spacesPerLevel; i++) {
    spaces += ' ';
  }

  return str
    .split('\n')
    .map(line => spaces + line)
    .join('\n');
}

export interface RootMarker {
  isRoot: true;
}

export function isRootMarker(value: string | RootMarker | undefined): value is RootMarker {
  return Boolean(value && typeof value !== 'string' && value.isRoot);
}

function name(node: StringLiteral | Identifier): string {
  if (isStringLiteral(node)) {
    return node.value;
  } else {
    return node.name;
  }
}
