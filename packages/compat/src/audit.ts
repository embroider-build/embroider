import { readFileSync, readJSONSync } from 'fs-extra';
import { join, resolve as resolvePath, dirname } from 'path';
import type { AppMeta, ResolverOptions } from '@embroider/core';
import { explicitRelative, hbsToJS, locateEmbroiderWorkingDir, Resolver, RewrittenPackageCache } from '@embroider/core';
import { Memoize } from 'typescript-memoize';
import chalk from 'chalk';
import groupBy from 'lodash/groupBy';
import type { NamespaceMarker } from './audit/babel-visitor';
import { CodeFrameStorage, isNamespaceMarker } from './audit/babel-visitor';
import { AuditBuildOptions, AuditOptions } from './audit/options';
import { buildApp, BuildError, isBuildError } from './audit/build';
import {
  type ContentType,
  type Module,
  visitModules,
  type RootMarker,
  isRootMarker,
  type CompleteModule,
} from './module-visitor';

export interface AuditMessage {
  message: string;
  detail: string;
  loc: Loc;
  source: string;
  filename: string;
}

export interface Loc {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export { AuditOptions, AuditBuildOptions, BuildError, isBuildError };

export interface Finding {
  message: string;
  filename: string;
  detail: string;
  codeFrame?: string;
}

export class AuditResults {
  modules: { [file: string]: Module } = {};
  findings: Finding[] = [];

  static create(baseDir: string, findings: Finding[], modules: Record<string, Module>) {
    let results = new this();
    results.modules = modules;
    for (let finding of findings) {
      const filename = finding.filename.startsWith('./')
        ? finding.filename
        : explicitRelative(baseDir, finding.filename);

      let relFinding = Object.assign({}, finding, { filename });
      results.findings.push(relFinding);
    }
    return results;
  }

  humanReadable(): string {
    let output = [] as string[];
    let findingsByFile = groupBy(this.findings, f => f.filename);
    output.push(`=== Audit Results ===`);
    for (let [filename, findings] of Object.entries(findingsByFile)) {
      output.push(`${chalk.yellow(filename)}`);
      for (let finding of findings) {
        output.push(indent(chalk.red(finding.message) + ': ' + finding.detail, 1));
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
    let summaryColor;
    if (this.perfect) {
      summaryColor = chalk.green;
    } else {
      summaryColor = chalk.yellow;
    }
    output.push(summaryColor(`${this.findings.length} issues found`));
    output.push(`=== End Audit Results ===`);
    output.push(''); // always end with a newline because `yarn run` can overwrite our last line otherwise
    return output.join('\n');
  }

  get perfect() {
    return this.findings.length === 0;
  }
}

export class Audit {
  private virtualModules: Map<string, string> = new Map();
  private findings = [] as Finding[];

  private frames = new CodeFrameStorage();

  static async run(options: AuditBuildOptions): Promise<AuditResults> {
    if (!options['reuse-build']) {
      await buildApp(options);
    }

    let audit = new this(options.app, options);
    return audit.run();
  }

  constructor(private originAppRoot: string, private options: AuditOptions = {}) {}

  @Memoize()
  private get pkg() {
    return readJSONSync(join(this.movedAppRoot, 'package.json'));
  }

  @Memoize()
  private get movedAppRoot() {
    let cache = RewrittenPackageCache.shared('embroider', this.originAppRoot);
    return cache.maybeMoved(cache.get(this.originAppRoot)).root;
  }

  private get meta() {
    return this.pkg['ember-addon'] as AppMeta;
  }

  @Memoize()
  private get babelConfig() {
    let origCwd = process.cwd();
    process.chdir(this.originAppRoot);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      let config = require(join(this.originAppRoot, 'babel.config.cjs'));

      config = Object.assign({}, config);
      config.plugins = config.plugins.filter((p: any) => !isMacrosPlugin(p));

      config.ast = true;
      return config;
    } finally {
      process.chdir(origCwd);
    }
  }

  private get resolverParams(): ResolverOptions {
    return readJSONSync(join(locateEmbroiderWorkingDir(this.originAppRoot), 'resolver.json'));
  }

  private resolver = new Resolver(this.resolverParams);

  private debug(message: string, ...args: any[]) {
    if (this.options.debug) {
      console.log(message, ...args);
    }
  }

  async run(): Promise<AuditResults> {
    (globalThis as any).embroider_audit = this.handleResolverError.bind(this);

    try {
      this.debug(`meta`, this.meta);
      let entrypoints = this.meta.assets.filter(a => a.endsWith('html')).map(a => resolvePath(this.movedAppRoot, a));

      let modules = await visitModules({
        base: this.originAppRoot,
        entrypoints,
        resolveId: this.resolveId,
        load: this.load,
        findings: this.findings,
        frames: this.frames,
        babelConfig: this.babelConfig,
      });

      this.inspectModules(modules);

      return AuditResults.create(this.originAppRoot, this.findings, modules);
    } finally {
      delete (globalThis as any).embroider_audit;
    }
  }

  private resolveId = async (specifier: string, fromFile: string): Promise<string | undefined> => {
    if (['@embroider/macros'].includes(specifier)) {
      // the audit process deliberately removes the @embroider/macros babel
      // plugins, so the imports are still present and should be left alone.
      return undefined;
    }

    if (fromFile.endsWith('.html') && specifier.startsWith(this.meta['root-url'])) {
      // root-relative URLs in HTML are actually relative to the appDir
      specifier = explicitRelative(
        dirname(fromFile),
        resolvePath(this.movedAppRoot, specifier.replace(this.meta['root-url'], ''))
      );
    }

    let resolution = await this.resolver.nodeResolve(specifier, fromFile);
    switch (resolution.type) {
      case 'virtual':
        this.virtualModules.set(resolution.filename, resolution.content);
        return resolution.filename;
      case 'not_found':
        return undefined;
      case 'real':
        return resolution.filename;
    }
  };

  private load = async (id: string): Promise<{ content: string | Buffer; type: ContentType } | undefined> => {
    let content: string | Buffer;
    if (this.virtualModules.has(id)) {
      content = this.virtualModules.get(id)!;
    } else {
      content = readFileSync(id);
    }

    if (id.endsWith('.html')) {
      return { content, type: 'html' };
    } else if (id.endsWith('.hbs')) {
      return { content: hbsToJS(content.toString('utf8')), type: 'javascript' };
    } else if (id.endsWith('.json')) {
      return this.handleJSON(id, content);
    } else {
      return { content, type: 'javascript' };
    }
  };

  private handleResolverError(msg: AuditMessage) {
    this.pushFinding({
      message: msg.message,
      filename: msg.filename,
      detail: msg.detail,
      codeFrame: this.frames.render(this.frames.forSource(msg.source)(msg)),
    });
  }

  private inspectModules(modules: Record<string, Module>) {
    for (let [filename, module] of Object.entries(modules)) {
      if (module.type === 'complete') {
        this.inspectImports(filename, module, modules);
      }
    }
  }

  private inspectImports(filename: string, module: CompleteModule, modules: Record<string, Module>) {
    for (let imp of module.imports) {
      // our Audit should always ignore any imports of @embroider/macros because we already ignored them
      // in resolveId above
      if (imp.source === '@embroider/macros') {
        continue;
      }
      let resolved = module.resolutions[imp.source];
      if (!resolved) {
        this.findings.push({
          filename,
          message: 'unable to resolve dependency',
          detail: imp.source,
          codeFrame: this.frames.render(imp.codeFrameIndex),
        });
      } else if (resolved) {
        let target = modules[resolved]!;
        for (let specifier of imp.specifiers) {
          if (target.type === 'complete' && !this.moduleProvidesName(target, specifier.name)) {
            if (specifier.name === 'default') {
              let backtick = '`';
              this.findings.push({
                filename,
                message: 'importing a non-existent default export',
                detail: `"${imp.source}" has no default export. Did you mean ${backtick}import * as ${specifier.local} from "${imp.source}"${backtick}?`,
                codeFrame: this.frames.render(specifier.codeFrameIndex),
              });
            } else {
              this.findings.push({
                filename,
                message: 'importing a non-existent named export',
                detail: `"${imp.source}" has no export named "${specifier.name}".`,
                codeFrame: this.frames.render(specifier.codeFrameIndex),
              });
            }
          }
        }
      }
    }
  }

  private moduleProvidesName(target: CompleteModule, name: string | NamespaceMarker) {
    // any module can provide a namespace.
    // CJS and AMD are too dynamic to be sure exactly what names are available,
    // so they always get a pass
    return isNamespaceMarker(name) || target.isCJS || target.isAMD || target.exports.includes(name);
  }

  private handleJSON(filename: string, content: Buffer | string): { content: string; type: ContentType } | undefined {
    let js;
    try {
      let structure = JSON.parse(content.toString('utf8'));
      js = `export default ${JSON.stringify(structure)}`;
    } catch (err) {
      this.findings.push({
        filename,
        message: `failed to parse JSON`,
        detail: err.toString().replace(filename, explicitRelative(this.originAppRoot, filename)),
      });
      return;
    }
    return { content: js, type: 'javascript' };
  }

  private pushFinding(finding: Finding) {
    this.findings.push(finding);
  }
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

export { Module };
