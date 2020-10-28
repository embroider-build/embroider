import { readFileSync, readJSONSync } from 'fs-extra';
import { dirname, join, resolve as resolvePath } from 'path';
import resolveModule from 'resolve';
import { applyVariantToTemplateCompiler, AppMeta, explicitRelative } from '@embroider/core';
import { Memoize } from 'typescript-memoize';
import execa from 'execa';
import chalk from 'chalk';
import jsdom from 'jsdom';
import { transformSync } from '@babel/core';
import traverse, { NodePath } from '@babel/traverse';
import { CallExpression, ImportDeclaration, isImport } from '@babel/types';
import groupBy from 'lodash/groupBy';
const { JSDOM } = jsdom;

export interface AuditOptions {
  debug: boolean;
  'reuse-build': boolean;
  app: string;
}

export interface Finding {
  message: string;
  filename: string;
  detail: string;
}

export interface Module {
  consumedFrom: (string | RootMarker)[];
}

export class AuditResults {
  constructor(public baseDir: string, public findings: Finding[], public modules: Map<string, Module>) {}

  humanReadable(): string {
    let output = [] as string[];
    let findingsByFile = groupBy(this.findings, f => f.filename);
    for (let [filename, findings] of Object.entries(findingsByFile)) {
      output.push(`${chalk.yellow(explicitRelative(this.baseDir, filename))}`);
      for (let finding of findings) {
        output.push(indent(chalk.red(finding.message), 1));
        output.push(indent(finding.detail, 2));
      }
      output.push(indent(chalk.blueBright(`file was included because:`), 1));
      let pointer: string | RootMarker = filename;
      while (!isRootMarker(pointer)) {
        // the zero here means we only display the first path we found. I think
        // that's a fine tradeoff to keep the output smaller.
        let nextPointer: string | RootMarker | undefined = this.modules.get(pointer)?.consumedFrom[0];
        if (!nextPointer) {
          output.push(
            indent(
              chalk.red(`couldn't figure out why this was included. Please file a bug against @embroider/compat.`),
              2
            )
          );
          break;
        }
        if (!isRootMarker(nextPointer)) {
          output.push(indent(explicitRelative(this.baseDir, nextPointer), 2));
        }
        pointer = nextPointer;
      }
    }
    output.push(''); // always end with a newline because `yarn run` can overwrite our last line otherwise
    return output.join('\n');
  }
}

export class Audit {
  private modules = new Map<string, Module>();
  private moduleQueue = new Set<string>();
  private findings = [] as Finding[];

  static async run(options: AuditOptions): Promise<AuditResults> {
    let dir = await this.buildApp(options);
    return new this(dir, options).run();
  }

  private static async buildApp(options: AuditOptions): Promise<string> {
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

  constructor(private appDir: string, private options: AuditOptions) {}

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

  private visitorFor(filename: string): (this: Audit, filename: string, content: Buffer | string) => Promise<string[]> {
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
      let dependencies = await visitor.call(this, filename, content);
      for (let dep of dependencies) {
        let depFilename = await this.resolve(dep, filename);
        if (depFilename) {
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
    return new AuditResults(this.appDir, this.findings, this.modules);
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

  private async visitJS(filename: string, content: Buffer | string): Promise<string[]> {
    let dependencies = [] as string[];
    try {
      let result = transformSync(content.toString('utf8'), Object.assign({ filename: filename }, this.babelConfig));
      traverse(result!.ast!, {
        ImportDeclaration(path: NodePath<ImportDeclaration>) {
          dependencies.push(path.node.source.value);
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

  private async visitHBS(filename: string, content: Buffer | string): Promise<string[]> {
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
    return this.visitJS(filename, js);
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
          message: `unable to resolve dependency in`,
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
