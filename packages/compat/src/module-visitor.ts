// TODO: split this so we have the import-analysis part as part of
// module-visitor and Audit adds its problem-detectoin stuff in the (optional)
// babel config
import { explicitRelative } from '@embroider/core';
import {
  type CodeFrameStorage,
  auditJS,
  type ExportAll,
  type InternalImport,
  type NamespaceMarker,
} from './audit/babel-visitor';
import fromPairs from 'lodash/fromPairs';
import assertNever from 'assert-never';
import { JSDOM } from 'jsdom';

// TODO: this is an audit concern
import type { Finding } from './audit';
import type { TransformOptions } from '@babel/core';

export interface Module {
  appRelativePath: string;
  consumedFrom: (string | RootMarker)[];
  imports: Import[];
  exports: string[];
  resolutions: { [source: string]: string | null };
  content: string;
}

interface InternalModule {
  consumedFrom: (string | RootMarker)[];

  parsed?: {
    imports: InternalImport[];
    exports: Set<string | ExportAll>;
    isCJS: boolean;
    isAMD: boolean;
    dependencies: string[];
    transpiledContent: string | Buffer;
  };

  resolved?: Map<string, string | ResolutionFailure>;

  linked?: {
    exports: Set<string>;
  };
}

type ParsedInternalModule = Omit<InternalModule, 'parsed'> & {
  parsed: NonNullable<InternalModule['parsed']>;
};

type ResolvedInternalModule = Omit<ParsedInternalModule, 'resolved'> & {
  resolved: NonNullable<ParsedInternalModule['resolved']>;
};

function isResolved(module: InternalModule | undefined): module is ResolvedInternalModule {
  return Boolean(module?.parsed && module.resolved);
}

type LinkedInternalModule = Omit<ResolvedInternalModule, 'linked'> & {
  linked: NonNullable<ResolvedInternalModule['linked']>;
};

export function isLinked(module: InternalModule | undefined): module is LinkedInternalModule {
  return Boolean(module?.parsed && module.resolved && module.linked);
}

export interface Import {
  source: string;
  specifiers: {
    name: string | NamespaceMarker;
    local: string | null; // can be null when re-exporting, because in that case we import `name` from `source` but don't create any local binding for it
    codeFrameIndex: number | undefined;
  }[];
  codeFrameIndex: number | undefined;
}

interface VisitorParams {
  base: string;
  resolveId: (specifier: string, fromFile: string) => Promise<string | undefined>;
  // TODO: remove Finding[] from this type
  load: (id: string) => Promise<Finding[] | { content: string | Buffer; type: ContentType }>;
  entrypoints: string[];
  debug?: boolean;

  // TODO: remove below this point
  findings: Finding[];
  frames: CodeFrameStorage;
  babelConfig: TransformOptions;
}

export async function visitModules(params: VisitorParams): Promise<Record<string, Module>> {
  let visitor = new ModuleVisitor(params);
  return await visitor.run();
}

export type ContentType = 'javascript' | 'html';

class ModuleVisitor {
  private modules: Map<string, InternalModule> = new Map();

  private moduleQueue = new Set<string>();
  private base: string;
  private debugEnabled: boolean;
  private resolveId: (specifier: string, fromFile: string) => Promise<string | undefined>;
  // TODO: remove Finding[] from return type
  private load: (id: string) => Promise<Finding[] | { content: string | Buffer; type: ContentType }>;
  private entrypoints: string[];

  constructor(private params: VisitorParams) {
    this.base = params.base;
    this.debugEnabled = Boolean(params.debug);
    this.resolveId = params.resolveId;
    this.load = params.load;
    this.entrypoints = params.entrypoints;
  }

  async run(): Promise<Record<string, Module>> {
    for (let entry of this.entrypoints) {
      this.scheduleVisit(entry, { isRoot: true });
    }
    await this.drainQueue();
    this.linkModules();
    return this.buildResults();
  }

  private async drainQueue() {
    while (this.moduleQueue.size > 0) {
      let id = this.moduleQueue.values().next().value as string;
      this.moduleQueue.delete(id);
      this.debug('visit', id);
      let loaded = await this.load(id);
      if (Array.isArray(loaded)) {
        for (let finding of loaded) {
          this.params.findings.push(finding);
        }
        continue;
      }
      let { content, type } = loaded;

      let visitor = this.visitorFor(type);

      // cast is safe because the only way to get into the queue is to go
      // through scheduleVisit, and scheduleVisit creates the entry in
      // this.modules.
      let module: InternalModule = this.modules.get(id)!;
      let visitResult = await visitor.call(this, id, content);
      if (Array.isArray(visitResult)) {
        // the visitor was unable to figure out the ParseFields and returned
        // some number of Findings to us to explain why.
        for (let finding of visitResult) {
          this.params.findings.push(finding);
        }
      } else {
        module.parsed = visitResult;
        module.resolved = await this.resolveDeps(visitResult.dependencies, id);
      }
    }
  }

  private linkModules() {
    for (let module of this.modules.values()) {
      if (isResolved(module)) {
        this.linkModule(module);
      }
    }
  }

  private linkModule(module: ResolvedInternalModule) {
    let exports = new Set<string>();
    for (let exp of module.parsed.exports) {
      if (typeof exp === 'string') {
        exports.add(exp);
      } else {
        let moduleName = module.resolved.get(exp.all)!;
        if (!isResolutionFailure(moduleName)) {
          let target = this.modules.get(moduleName)!;
          if (!isLinked(target) && isResolved(target)) {
            this.linkModule(target);
          }
          if (isLinked(target)) {
            for (let innerExp of target.linked.exports) {
              exports.add(innerExp);
            }
          } else {
            // our module doesn't successfully enter linked state because it
            // depends on stuff that also couldn't
            return;
          }
        }
      }
    }
    module.linked = {
      exports,
    };
  }

  private async resolveDeps(deps: string[], fromFile: string): Promise<InternalModule['resolved']> {
    let resolved = new Map() as NonNullable<InternalModule['resolved']>;
    for (let dep of deps) {
      if (['@embroider/macros'].includes(dep)) {
        // the audit process deliberately removes the @embroider/macros babel
        // plugins, so the imports are still present and should be left alone.
        continue;
      }

      let resolution = await this.resolveId(dep, fromFile);
      if (resolution) {
        resolved.set(dep, resolution);
        this.scheduleVisit(resolution, fromFile);
        break;
      } else {
        resolved.set(dep, { isResolutionFailure: true as true });
        break;
      }
    }
    return resolved;
  }

  private scheduleVisit(id: string, parent: string | RootMarker) {
    let record = this.modules.get(id);
    if (!record) {
      this.debug(`discovered`, id);
      record = {
        consumedFrom: [parent],
      };
      this.modules.set(id, record);
      this.moduleQueue.add(id);
    } else {
      record.consumedFrom.push(parent);
    }
  }

  private visitorFor(
    type: ContentType
  ): (
    this: ModuleVisitor,
    filename: string,
    content: Buffer | string
  ) => Promise<NonNullable<InternalModule['parsed'] | Finding[]>> {
    switch (type) {
      case 'html':
        return this.visitHTML;
      case 'javascript':
        return this.visitJS;
      default:
        throw assertNever(type);
    }
  }

  private async visitHTML(_filename: string, content: Buffer | string): Promise<ParsedInternalModule['parsed']> {
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
      dependencies.push(src);
    }

    return {
      imports: [],
      exports: new Set(),
      isCJS: false,
      isAMD: false,
      dependencies,
      transpiledContent: content,
    };
  }

  private async visitJS(
    filename: string,
    content: Buffer | string
  ): Promise<ParsedInternalModule['parsed'] | Finding[]> {
    let rawSource = content.toString('utf8');
    try {
      let result = auditJS(rawSource, filename, this.params.babelConfig, this.params.frames);

      for (let problem of result.problems) {
        this.params.findings.push({
          filename,
          message: problem.message,
          detail: problem.detail,
          codeFrame: this.params.frames.render(problem.codeFrameIndex),
        });
      }
      return {
        exports: result.exports,
        imports: result.imports,
        isCJS: result.isCJS,
        isAMD: result.isAMD,
        dependencies: result.imports.map(i => i.source),
        transpiledContent: result.transpiledContent,
      };
    } catch (err) {
      if (['BABEL_PARSE_ERROR', 'BABEL_TRANSFORM_ERROR'].includes(err.code)) {
        return [
          {
            filename,
            message: `failed to parse`,
            detail: err.toString().replace(filename, explicitRelative(this.base, filename)),
          },
        ];
      } else {
        throw err;
      }
    }
  }

  private debug(message: string, ...args: any[]) {
    if (this.debugEnabled) {
      console.log(message, ...args);
    }
  }

  private buildResults() {
    let publicModules: Record<string, Module> = {};
    for (let [filename, module] of this.modules) {
      let publicModule: Module = {
        appRelativePath: explicitRelative(this.base, filename),
        consumedFrom: module.consumedFrom.map(entry => {
          if (isRootMarker(entry)) {
            return entry;
          } else {
            return explicitRelative(this.base, entry);
          }
        }),
        resolutions: module.resolved
          ? fromPairs(
              [...module.resolved].map(([source, target]) => [
                source,
                isResolutionFailure(target) ? null : explicitRelative(this.base, target),
              ])
            )
          : {},
        imports: module.parsed?.imports
          ? module.parsed.imports.map(i => ({
              source: i.source,
              specifiers: i.specifiers.map(s => ({
                name: s.name,
                local: s.local,
                codeFrameIndex: s.codeFrameIndex,
              })),
              codeFrameIndex: i.codeFrameIndex,
            }))
          : [],
        exports: module.linked?.exports ? [...module.linked.exports] : [],
        content: module.parsed?.transpiledContent
          ? module.parsed?.transpiledContent.toString()
          : 'module failed to transpile',
      };
      publicModules[explicitRelative(this.base, filename)] = publicModule;
    }
    return publicModules;
  }
}

export interface RootMarker {
  isRoot: true;
}

export function isRootMarker(value: string | RootMarker | undefined): value is RootMarker {
  return Boolean(value && typeof value !== 'string' && value.isRoot);
}

interface ResolutionFailure {
  isResolutionFailure: true;
}

function isResolutionFailure(result: string | ResolutionFailure | undefined): result is ResolutionFailure {
  return typeof result === 'object' && 'isResolutionFailure' in result;
}
