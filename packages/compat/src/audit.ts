import { readFileSync, readJSONSync } from 'fs-extra';
import { dirname, join, resolve as resolvePath } from 'path';
import resolveModule from 'resolve';
import { AppMeta, explicitRelative } from '@embroider/core';
import { Memoize } from 'typescript-memoize';
import execa from 'execa';
import chalk from 'chalk';
import jsdom from 'jsdom';
import { transformSync } from '@babel/core';
import traverse, { NodePath } from '@babel/traverse';
import { CallExpression, ImportDeclaration, isImport } from '@babel/types';
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

export class AuditResults {
  findings: Finding[] = [];

  constructor(public baseDir: string) {}

  humanReadable(): string {
    let output = [] as string[];
    for (let finding of this.findings) {
      output.push(`${chalk.red(finding.message)} ${explicitRelative(this.baseDir, finding.filename)}`);
      output.push(indent(finding.detail));
    }
    return output.join('\n');
  }
}

export class Audit {
  private modules = new Map<
    string,
    {
      consumedFrom: string[];
    }
  >();
  private moduleQueue = new Set<string>();
  private results = new AuditResults(this.appDir);

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

  private debug(message: string, ...args: any[]) {
    if (this.options.debug) {
      console.log(message, ...args);
    }
  }

  private async drainQueue() {
    while (this.moduleQueue.size > 0) {
      let modulePath = this.moduleQueue.values().next().value as string;
      this.moduleQueue.delete(modulePath);
      await this.crawlJSModule(modulePath);
    }
  }

  async run(): Promise<AuditResults> {
    this.debug(`meta`, this.meta);
    for (let asset of this.meta.assets) {
      if (asset.endsWith('.html')) {
        await this.crawlHTML(join(this.appDir, asset));
      }
    }
    await this.drainQueue();
    return this.results;
  }

  private async crawlHTML(asset: string) {
    this.debug(`crawlHTML`, asset);
    let dom = new JSDOM(readFileSync(asset));
    let scripts = dom.window.document.querySelectorAll('script[type="module"]') as NodeListOf<HTMLScriptElement>;
    for (let script of scripts) {
      let src = resolvePath(this.appDir, script.src.replace(this.meta['root-url'], ''));
      this.follow(asset, src);
    }
  }

  private async crawlJSModule(modulePath: string) {
    this.debug('crawlJSModule', modulePath);
    let dependencies = [] as string[];
    let raw = readFileSync(modulePath, 'utf8');
    try {
      let result = transformSync(raw, Object.assign({ filename: modulePath }, this.babelConfig));
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
          filename: modulePath,
          message: `failed to parse`,
          detail: err.toString(),
        });
      } else {
        throw err;
      }
    }
    for (let dep of dependencies) {
      await this.resolveAndFollow(dep, modulePath);
    }
  }

  private resolveAndFollow(specifier: string, fromPath: string) {
    if (specifier === '@embroider/macros') {
      return;
    }
    try {
      let child = resolveModule.sync(specifier, {
        basedir: dirname(fromPath),
        extensions: this.meta['resolvable-extensions'],
      });
      this.follow(fromPath, child);
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
    this.results.findings.push(finding);
  }

  private follow(parent: string, child: string) {
    let record = this.modules.get(child);
    if (!record) {
      this.debug(`discovered`, child);
      record = {
        consumedFrom: [parent],
      };
      this.modules.set(child, record);
      this.moduleQueue.add(child);
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

function indent(str: string, spaces = '  ') {
  return str
    .split('\n')
    .map(line => spaces + line)
    .join('\n');
}
