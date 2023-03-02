import { Audit, AuditBuildOptions, AuditResults, Module } from '@embroider/compat/src/audit';
import { explicitRelative } from '@embroider/shared-internals';
import { install as installCodeEqualityAssertions } from 'code-equality-assertions/qunit';
import { posix } from 'path';
import { distance } from 'fastest-levenshtein';
import { sortBy } from 'lodash';

/*
  The audit tool in @embroider/compat can be used directly to tell you about
  potential problems in an app that is trying to adopt embroider. But we also
  take advantage of the audit tool within our test suite to help us analyze
  Embroider's output.
*/
export function setupAuditTest(hooks: NestedHooks, getAppDir: () => string) {
  let result: AuditResults;
  let expectAudit: ExpectAuditResults;

  hooks.before(async () => {
    result = await Audit.run({ app: getAppDir(), 'reuse-build': false });
  });

  hooks.beforeEach(assert => {
    installAuditAssertions(assert);
    expectAudit = new ExpectAuditResults(result, assert);
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
  return new ExpectAuditResults(await Audit.run(opts), this);
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
  constructor(readonly result: AuditResults, private assert: Assert) {}

  module(name: string) {
    let m = this.result.modules[name];
    const showNearMisses = 4;
    if (!m) {
      let actuals = sortBy(Object.keys(this.result.modules), candidate => distance(candidate, name));
      this.assert.pushResult({
        result: false,
        actual:
          actuals.length > showNearMisses ? actuals.slice(0, showNearMisses).join(', ') + '...' : actuals.join(', '),
        expected: name,
      });
    }
    return new ExpectModule(this.assert, this.result, m);
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
  constructor(private assert: Assert, private result: AuditResults, private module: Module | undefined) {}

  codeEquals(expectedSource: string) {
    if (this.module) {
      this.assert.codeEqual(this.module.content, expectedSource);
    }
  }

  resolves(specifier: string): ExpectResolution {
    if (!this.module) {
      // the place that instantiated us already pushed the exception that this
      // module doesn't exist
      return new ExpectResolution(this.assert, this.result, undefined);
    }
    if (!(specifier in this.module.resolutions)) {
      this.assert.pushResult({
        result: false,
        expected: `${this.module.appRelativePath} does not refer to ${specifier}`,
        actual: Object.keys(this.module.resolutions),
      });
      return new ExpectResolution(this.assert, this.result, undefined);
    }
    let resolution = this.module.resolutions[specifier];
    if (!resolution) {
      this.assert.pushResult({
        result: false,
        expected: `${specifier} fails to resolve in ${this.module.appRelativePath}`,
        actual: `${specifier} to resolve to something`,
      });
      return new ExpectResolution(this.assert, this.result, undefined);
    }
    let target = this.result.modules[resolution];
    if (!target) {
      this.assert.pushResult({
        result: false,
        expected: `${specifier} resolves to ${resolution} but ${resolution} is not found in audit results`,
        actual: `${resolution} exists`,
      });
      return new ExpectResolution(this.assert, this.result, undefined);
    }
    return new ExpectResolution(this.assert, this.result, target);
  }

  // this is testing explicitly for the template-only component moduels that we
  // synthesize in our module-resolver
  isTemplateOnlyComponent(template: string, message?: string) {
    if (this.module) {
      this.resolves(
        explicitRelative(
          posix.dirname(posix.resolve('/APP', this.module.appRelativePath)),
          posix.resolve('/APP', template)
        )
      ).to(template, message);
      this.resolves('@ember/component/template-only');
    }
  }
}

export class ExpectResolution {
  constructor(private assert: Assert, private result: AuditResults, private module: Module | undefined) {}

  to(filename: string | null, message?: string) {
    if (this.module) {
      this.assert.pushResult({
        result: this.module.appRelativePath === filename,
        expected: filename,
        actual: this.module.appRelativePath,
        message,
      });
    }
  }

  toModule(): ExpectModule {
    return new ExpectModule(this.assert, this.result, this.module);
  }
}
