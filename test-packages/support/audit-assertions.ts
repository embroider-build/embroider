import type { AuditBuildOptions, Finding, Module } from '../../packages/compat/src/audit';
import { httpAudit, type HTTPAuditOptions } from '../../packages/compat/src/http-audit';
import type { Import } from '../../packages/compat/src/module-visitor';
import { Audit } from '../../packages/compat/src/audit';
import { cleanUrl, explicitRelative } from '../../packages/shared-internals';
import { install as installCodeEqualityAssertions } from 'code-equality-assertions/qunit';
import { posix } from 'path';
import { distance } from 'fastest-levenshtein';
import { sortBy } from 'lodash';
import { getRewrittenLocation } from './rewritten-path';
import { Memoize } from 'typescript-memoize';

export { Import };

// @ts-expect-error we can't import the NestedHooks from qunit here
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type qunit from 'qunit';

/*
  The audit tool in @embroider/compat can be used directly to tell you about
  potential problems in an app that is trying to adopt embroider. But we also
  take advantage of the audit tool within our test suite to help us analyze
  Embroider's output.
*/
export function setupAuditTest(hooks: NestedHooks, opts: () => AuditBuildOptions | HTTPAuditOptions) {
  let result: { modules: { [file: string]: Module }; findings: Finding[] };
  let expectAudit: ExpectAuditResults;

  async function visit() {
    let o = opts();
    if ('appURL' in o) {
      result = await httpAudit(o);
    } else {
      result = await Audit.run(o);
    }
  }

  async function visitWithRetries() {
    for (let i = 0; i < 30; i++) {
      try {
        await visit();
        return;
      } catch (e) {
        if (e.message.includes('oops status code 504 - Outdated Optimize Dep for')) {
          continue;
        }
        if (e.message.includes('oops status code 404') && e.message.includes('.vite/deps')) {
          continue;
        }
        throw e;
      }
    }
    throw new Error('failed to rerun');
  }

  function prepareResult(assert: Assert) {
    let o = opts();
    let pathRewriter: (p: string) => string;
    if ('appURL' in o) {
      pathRewriter = p => p;
    } else {
      pathRewriter = p => getRewrittenLocation(o.app, p);
    }
    expectAudit = new ExpectAuditResults(result, assert, pathRewriter);
  }

  hooks.before(async () => {
    await visitWithRetries();
  });

  hooks.beforeEach(assert => {
    installAuditAssertions(assert);
    prepareResult(assert);
  });

  return {
    async rerun() {
      await visitWithRetries();
      prepareResult(expectAudit.assert);
    },
    module(name: string | RegExp) {
      return expectAudit.module(name);
    },
    get findings() {
      return expectAudit.findings;
    },
    get modules() {
      return expectAudit.result.modules;
    },
    hasNoFindings() {
      return expectAudit.hasNoProblems();
    },
  };
}

async function audit(this: Assert, opts: AuditBuildOptions): Promise<ExpectAuditResults> {
  return new ExpectAuditResults(await Audit.run(opts), this, p => getRewrittenLocation(opts.app, p));
}

export function installAuditAssertions(assert: Assert) {
  installCodeEqualityAssertions(assert);
  assert.audit = audit;
}

declare global {
  interface Assert {
    audit: typeof audit;
  }
}

export class ExpectAuditResults {
  constructor(
    readonly result: { modules: { [file: string]: Module }; findings: Finding[] },
    readonly assert: Assert,
    // input and output paths are relative to getAppDir()
    readonly toRewrittenPath: (path: string) => string
  ) {}

  module(inputName: string | RegExp): PublicAPI<ExpectModule> {
    return new ExpectModule(this, inputName);
  }

  get findings() {
    return this.result.findings;
  }

  hasNoProblems() {
    this.assert.deepEqual(
      this.result.findings.map(f => ({ ...f, codeFrame: '<elided>' })),
      [],
      'audit problems'
    );
  }
}

export class ExpectModule {
  constructor(private expectAudit: ExpectAuditResults, private inputName: string | RegExp) {}

  @Memoize()
  private get outputName() {
    if (typeof this.inputName === 'string') {
      return this.expectAudit.toRewrittenPath(this.inputName);
    } else {
      return this.inputName.toString();
    }
  }

  @Memoize()
  private get module() {
    for (let [key, value] of Object.entries(this.expectAudit.result.modules)) {
      if (typeof this.inputName === 'string') {
        if (cleanUrl(key) === this.outputName) {
          return value;
        }
      } else {
        if (this.inputName.test(cleanUrl(key))) {
          return value;
        }
      }
    }
    return this.expectAudit.result.modules[this.outputName];
  }

  private emitMissingModule() {
    const showNearMisses = 4;
    let actuals = sortBy(Object.keys(this.expectAudit.result.modules), candidate =>
      distance(candidate, this.outputName)
    );
    this.expectAudit.assert.pushResult({
      result: false,
      actual:
        actuals.length > showNearMisses ? actuals.slice(0, showNearMisses).join(', ') + '...' : actuals.join(', '),
      expected: this.outputName,
      message: `Can't locate module ${this.inputName}`,
    });
  }

  doesNotExist() {
    this.expectAudit.assert.pushResult({
      result: !this.module,
      actual: `${this.inputName} exists`,
      expected: `${this.inputName} not to exist`,
      message: `Expected ${this.inputName} not to exist`,
    });
  }

  withContents(fn: (src: string, imports: Import[]) => boolean, message?: string): PublicAPI<this> {
    if (!this.module) {
      this.emitMissingModule();
      return this;
    }
    if (this.module.type === 'unparseable') {
      this.emitUnparsableModule(message);
      return this;
    }
    const result = fn(this.module.content, this.module.imports);
    this.expectAudit.assert.pushResult({
      result,
      actual: result,
      expected: true,
      message: message ?? `Expected passed function to return true for the contents of ${this.inputName}`,
    });
    return this;
  }

  private emitUnparsableModule(message?: string) {
    this.expectAudit.assert.pushResult({
      result: false,
      actual: `${this.inputName} failed to parse`,
      expected: true,
      message: `${this.inputName} failed to parse${message ? `: (${message})` : ''}`,
    });
  }

  codeEquals(expectedSource: string) {
    if (!this.module) {
      this.emitMissingModule();
      return;
    }
    if (this.module.type === 'unparseable') {
      this.emitUnparsableModule();
      return;
    }
    this.expectAudit.assert.codeEqual(this.module.content, expectedSource);
  }

  codeContains(expectedSource: string) {
    if (!this.module) {
      this.emitMissingModule();
      return;
    }
    if (this.module.type === 'unparseable') {
      this.emitUnparsableModule();
      return;
    }
    this.expectAudit.assert.codeContains(this.module.content, expectedSource);
  }

  resolves(specifier: string | RegExp): PublicAPI<ExpectResolution> {
    if (!this.module) {
      this.emitMissingModule();
      return new EmptyExpectResolution();
    }

    if (this.module.type === 'unparseable') {
      this.emitUnparsableModule();
      return new EmptyExpectResolution();
    }

    let resolution: string | undefined | null;
    if (typeof specifier === 'string') {
      resolution = this.module.resolutions[specifier];
    } else {
      for (let [source, module] of Object.entries(this.module.resolutions)) {
        if (specifier.test(source)) {
          resolution = module;
          break;
        }
      }
    }

    if (resolution === undefined) {
      this.expectAudit.assert.pushResult({
        result: false,
        expected: `${this.module.appRelativePath} does not refer to ${specifier}`,
        actual: Object.keys(this.module.resolutions),
      });
      return new EmptyExpectResolution();
    }

    if (resolution === null) {
      this.expectAudit.assert.pushResult({
        result: false,
        expected: `${specifier} fails to resolve in ${this.module.appRelativePath}`,
        actual: `${specifier} to resolve to something`,
      });
      return new EmptyExpectResolution();
    }
    let target = this.expectAudit.result.modules[resolution];
    if (!target) {
      this.expectAudit.assert.pushResult({
        result: false,
        expected: `${specifier} resolves to ${resolution} but ${resolution} is not found in audit results`,
        actual: `${resolution} exists`,
      });
      return new EmptyExpectResolution();
    }
    return new ExpectResolution(this.expectAudit, target, resolution);
  }

  // this is testing explicitly for the template-only component modules that we
  // synthesize in our module-resolver
  isTemplateOnlyComponent(template: string, message?: string) {
    if (!this.module) {
      this.emitMissingModule();
      return;
    }
    this.resolves(
      explicitRelative(
        posix.dirname(posix.resolve('/APP', this.module.appRelativePath)),
        posix.resolve('/APP', this.expectAudit.toRewrittenPath(template))
      )
    ).to(template, message);
    this.resolves('@ember/component/template-only');
  }

  hasConsumers(paths: string[]) {
    if (!this.module) {
      this.emitMissingModule();
      return;
    }

    let consumedFrom = this.module.consumedFrom.map(m => {
      if (typeof m === 'string') {
        return cleanUrl(m);
      }
      return m;
    });

    this.expectAudit.assert.deepEqual(consumedFrom, paths.map(this.expectAudit.toRewrittenPath));
  }
}

export class ExpectResolution {
  constructor(private expectAudit: ExpectAuditResults, private module: Module, private moduleInputName: string) {}

  to(targetInputName: string | null, message?: string) {
    let targetOutputName: string | null = null;
    if (targetInputName) {
      targetOutputName = this.expectAudit.toRewrittenPath(targetInputName);
    }

    this.expectAudit.assert.pushResult({
      result: this.module.appRelativePath === targetOutputName,
      expected: targetInputName,
      actual: this.module.appRelativePath,
      message,
    });
  }

  toModule(): PublicAPI<ExpectModule> {
    return new ExpectModule(this.expectAudit, this.moduleInputName);
  }
}

type PublicAPI<T> = { [K in keyof T]: T[K] };

class EmptyExpectModule implements PublicAPI<ExpectModule> {
  doesNotExist() {}
  codeEquals() {}
  codeContains() {}
  withContents() {
    return this;
  }

  resolves(): PublicAPI<ExpectResolution> {
    return new EmptyExpectResolution() as PublicAPI<ExpectResolution>;
  }
  isTemplateOnlyComponent() {}
  hasConsumers() {}
}

class EmptyExpectResolution implements PublicAPI<ExpectResolution> {
  to() {}
  toModule() {
    return new EmptyExpectModule() as PublicAPI<ExpectModule>;
  }
}
