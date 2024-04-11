import type { AuditBuildOptions, AuditResults, Import, Module } from '../../packages/compat/src/audit';
import { Audit } from '../../packages/compat/src/audit';
import { explicitRelative } from '../../packages/shared-internals';
import { install as installCodeEqualityAssertions } from 'code-equality-assertions/qunit';
import { posix } from 'path';
import { distance } from 'fastest-levenshtein';
import { sortBy } from 'lodash';
import { getRewrittenLocation } from './rewritten-path';

/*
  The audit tool in @embroider/compat can be used directly to tell you about
  potential problems in an app that is trying to adopt embroider. But we also
  take advantage of the audit tool within our test suite to help us analyze
  Embroider's output.
*/
export function setupAuditTest(hooks: NestedHooks, opts: () => AuditBuildOptions) {
  let result: AuditResults;
  let expectAudit: ExpectAuditResults;

  hooks.before(async () => {
    result = await Audit.run(opts());
  });

  hooks.beforeEach(assert => {
    installAuditAssertions(assert);
    expectAudit = new ExpectAuditResults(result, assert, opts().app);
  });

  return {
    module(name: string) {
      return expectAudit.module(name);
    },
    get findings() {
      return expectAudit.findings;
    },
    hasNoFindings() {
      return expectAudit.hasNoProblems();
    },
  };
}

async function audit(this: Assert, opts: AuditBuildOptions): Promise<ExpectAuditResults> {
  return new ExpectAuditResults(await Audit.run(opts), this, opts.app);
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
  constructor(readonly result: AuditResults, readonly assert: Assert, private appDir: string) {}

  // input and output paths are relative to getAppDir()
  toRewrittenPath = (path: string) => {
    return getRewrittenLocation(this.appDir, path);
  };

  module(inputName: string): PublicAPI<ExpectModule> {
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
  constructor(private expectAudit: ExpectAuditResults, private inputName: string) {}

  private get module() {
    let outputName = this.expectAudit.toRewrittenPath(this.inputName);
    return this.expectAudit.result.modules[outputName];
  }

  private emitMissingModule() {
    let outputName = this.expectAudit.toRewrittenPath(this.inputName);
    const showNearMisses = 4;
    let actuals = sortBy(Object.keys(this.expectAudit.result.modules), candidate => distance(candidate, outputName));
    this.expectAudit.assert.pushResult({
      result: false,
      actual:
        actuals.length > showNearMisses ? actuals.slice(0, showNearMisses).join(', ') + '...' : actuals.join(', '),
      expected: outputName,
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

  withContents(fn: (src: string, imports: Import[]) => boolean, message?: string) {
    if (!this.module) {
      this.emitMissingModule();
      return;
    }
    const result = fn(this.module.content, this.module.imports);
    this.expectAudit.assert.pushResult({
      result,
      actual: result,
      expected: true,
      message: message ?? `Expected passed function to return true for the contents of ${this.inputName}`,
    });
  }

  codeEquals(expectedSource: string) {
    if (!this.module) {
      this.emitMissingModule();
      return;
    }
    this.expectAudit.assert.codeEqual(this.module.content, expectedSource);
  }

  codeContains(expectedSource: string) {
    if (!this.module) {
      this.emitMissingModule();
      return;
    }
    this.expectAudit.assert.codeContains(this.module.content, expectedSource);
  }

  resolves(specifier: string | RegExp): PublicAPI<ExpectResolution> {
    if (!this.module) {
      this.emitMissingModule();
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

  // this is testing explicitly for the template-only component moduels that we
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
    this.expectAudit.assert.deepEqual(this.module.consumedFrom, paths.map(this.expectAudit.toRewrittenPath));
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
  withContents() {}

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
