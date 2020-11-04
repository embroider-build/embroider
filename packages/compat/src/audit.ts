import { readFileSync, readJSONSync } from 'fs-extra';
import { dirname, join, resolve as resolvePath } from 'path';
import resolveModule from 'resolve';
import { applyVariantToTemplateCompiler, AppMeta, explicitRelative } from '@embroider/core';
import { Memoize } from 'typescript-memoize';
import chalk from 'chalk';
import jsdom from 'jsdom';
import groupBy from 'lodash/groupBy';
import fromPairs from 'lodash/fromPairs';
import { auditJS, CodeFrameStorage, InternalImport, isNamespaceMarker, NamespaceMarker } from './audit/babel-visitor';
import { AuditBuildOptions, AuditOptions } from './audit/options';
import { buildApp, BuildError, isBuildError } from './audit/build';
import CompatResolver from './resolver';
const { JSDOM } = jsdom;

export { AuditOptions, AuditBuildOptions, BuildError, isBuildError };

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
  resolutions: { [source: string]: string | null };
}

interface ResolutionFailure {
  isResolutionFailure: true;
}

function isResolutionFailure(result: string | ResolutionFailure | undefined): result is ResolutionFailure {
  return typeof result === 'object' && 'isResolutionFailure' in result;
}

interface InternalModule {
  consumedFrom: (string | RootMarker)[];
  imports: InternalImport[];
  exports: Set<string>;
  resolutions: Map<string, string | ResolutionFailure>;
  isCJS: boolean;
  isAMD: boolean;
  templateFindings: { message: string; detail: string; codeFrameIndex?: number }[];
  failedToParse: boolean;
}

export interface Import {
  source: string;
  specifiers: {
    name: string | NamespaceMarker;
    local: string;
  }[];
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
          [...module.resolutions].map(([source, target]) => [
            source,
            isResolutionFailure(target) ? null : explicitRelative(baseDir, target),
          ])
        ),
        imports: module.imports.map(i => ({
          source: i.source,
          specifiers: i.specifiers.map(s => ({
            name: s.name,
            local: s.local,
          })),
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
    output.push(`=== Audit Results ===`);
    for (let [filename, findings] of Object.entries(findingsByFile)) {
      output.push(`${chalk.yellow(filename)}`);
      for (let finding of findings) {
        output.push(indent(chalk.red(finding.message) + ' ' + finding.detail, 1));
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
  private modules: Map<string, InternalModule> = new Map();
  private moduleQueue = new Set<string>();
  private findings = [] as Finding[];

  private frames = new CodeFrameStorage();

  static async run(options: AuditBuildOptions): Promise<AuditResults> {
    if (!options['reuse-build']) {
      await buildApp(options);
    }
    let dir = await this.findStage2Output(options);

    let audit = new this(dir, options);
    if (options['reuse-build']) {
      if (!audit.meta.babel.isParallelSafe || !audit.meta['template-compiler'].isParallelSafe) {
        throw new BuildError(
          `You can't use the ${chalk.red(
            '--reuse-build'
          )} option because some of your babel or HBS plugins are non-serializable`
        );
      }
    }
    return audit.run();
  }

  private static async findStage2Output(options: AuditBuildOptions): Promise<string> {
    try {
      return readFileSync(join(options.app, 'dist/.stage2-output'), 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new BuildError(
          `${chalk.yellow(
            'Your build'
          )} did not produce expected Embroider stage2 output.\nMake sure you actually have Embroider configured.`
        );
      }
      throw err;
    }
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
  private get templateSetup(): { compile: (filename: string, content: string) => string; resolver: CompatResolver } {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    let templateCompiler = require(join(this.appDir, this.meta['template-compiler'].filename));
    let resolver = templateCompiler.params.resolver as CompatResolver;

    resolver.enableAuditMode();

    let compile = applyVariantToTemplateCompiler(
      { name: 'default', runtime: 'all', optimizeForProduction: false },
      templateCompiler.compile
    );
    return { compile, resolver };
  }

  private get templateCompiler(): (filename: string, content: string) => string {
    return this.templateSetup.compile;
  }

  private get templateResolver(): CompatResolver {
    return this.templateSetup.resolver;
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
    } else if (filename.endsWith('.json')) {
      return this.visitJSON;
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
          if (!isResolutionFailure(depFilename)) {
            this.scheduleVisit(depFilename, filename);
          }
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
    this.inspectModules();
    return new AuditResults(this.appDir, this.findings, this.modules);
  }

  private inspectModules() {
    for (let [filename, module] of this.modules) {
      this.inspectImports(filename, module);
      this.inspectTemplateResolution(filename, module);
    }
  }

  private inspectImports(filename: string, module: InternalModule) {
    for (let imp of module.imports) {
      let resolved = module.resolutions.get(imp.source);
      if (isResolutionFailure(resolved)) {
        this.findings.push({
          filename,
          message: 'unable to resolve dependency',
          detail: imp.source,
          codeFrame: this.frames.render(imp.codeFrameIndex),
        });
      } else if (resolved) {
        let target = this.modules.get(resolved)!;
        for (let specifier of imp.specifiers) {
          if (!target.failedToParse && !this.moduleProvidesName(target, specifier.name)) {
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

  private inspectTemplateResolution(filename: string, module: InternalModule) {
    for (let finding of module.templateFindings) {
      this.findings.push({
        filename,
        message: finding.message,
        detail: finding.detail,
        codeFrame: this.frames.render(finding.codeFrameIndex),
      });
    }
  }

  private moduleProvidesName(target: InternalModule, name: string | NamespaceMarker) {
    // any module can provide a namespace.
    // CJS and AMD are too dynamic to be sure exactly what names are available,
    // so they always get a pass
    return isNamespaceMarker(name) || target.isCJS || target.isAMD || target.exports.has(name);
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
    let rawSource = content.toString('utf8');
    try {
      let result = auditJS(rawSource, filename, this.babelConfig, this.frames);
      module.exports = result.exports;
      module.imports = result.imports;
      module.isCJS = result.isCJS;
      module.isAMD = result.isAMD;
      for (let problem of result.problems) {
        this.pushFinding({
          filename,
          message: problem.message,
          detail: problem.detail,
          codeFrame: this.frames.render(problem.codeFrameIndex),
        });
      }
      return result.imports.map(i => i.source);
    } catch (err) {
      if (err.code === 'BABEL_PARSE_ERROR') {
        this.pushFinding({
          filename,
          message: `failed to parse`,
          detail: err.toString().replace(filename, explicitRelative(this.appDir, filename)),
        });
        module.failedToParse = true;
        return [];
      } else {
        throw err;
      }
    }
  }

  private async visitHBS(filename: string, content: Buffer | string, module: InternalModule): Promise<string[]> {
    let rawSource = content.toString('utf8');
    let js;
    try {
      js = this.templateCompiler(filename, rawSource);
    } catch (err) {
      this.pushFinding({
        filename,
        message: `failed to compile template`,
        detail: err.toString().replace(filename, explicitRelative(this.appDir, filename)),
      });
      module.failedToParse = true;
      return [];
    }
    module.templateFindings = this.templateResolver.errorsIn(filename).map(err => ({
      message: err.message,
      detail: err.detail,
      codeFrameIndex: this.frames.forSource(rawSource)(err),
    }));
    return this.visitJS(filename, js, module);
  }

  private async visitJSON(filename: string, content: Buffer | string, module: InternalModule): Promise<string[]> {
    let js;
    try {
      let structure = JSON.parse(content.toString('utf8'));
      js = `export default ${JSON.stringify(structure)}`;
    } catch (err) {
      this.pushFinding({
        filename,
        message: `failed to parse JSON`,
        detail: err.toString().replace(filename, explicitRelative(this.appDir, filename)),
      });
      module.failedToParse = true;
      return [];
    }
    return this.visitJS(filename, js, module);
  }

  private async resolve(specifier: string, fromPath: string): Promise<string | ResolutionFailure | undefined> {
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
        return { isResolutionFailure: true };
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
        isCJS: false,
        isAMD: false,
        templateFindings: [],
        failedToParse: false,
      };
      this.modules.set(filename, record);
      this.moduleQueue.add(filename);
    } else {
      record.consumedFrom.push(parent);
    }
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

export interface RootMarker {
  isRoot: true;
}

export function isRootMarker(value: string | RootMarker | undefined): value is RootMarker {
  return Boolean(value && typeof value !== 'string' && value.isRoot);
}
