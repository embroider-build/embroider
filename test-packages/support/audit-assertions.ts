import { Audit, AuditBuildOptions, AuditResults, Module } from '../../packages/compat/src/audit';
import { explicitRelative, RewrittenPackageCache } from '../../packages/shared-internals';
import { install as installCodeEqualityAssertions } from 'code-equality-assertions/qunit';
import { posix, resolve } from 'path';
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
    expectAudit = new ExpectAuditResults(result, assert, getAppDir());
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
  private packageCache = RewrittenPackageCache.shared('embroider', this.appDir);

  constructor(readonly result: AuditResults, private assert: Assert, private appDir: string) {}

  // input and output paths are relative to getAppDir()
  private toRewritten = (path: string) => {
    let fullPath = resolve(this.appDir, path);
    let owner = this.packageCache.ownerOfFile(fullPath);
    if (!owner) {
      return path;
    }
    let movedOwner = this.packageCache.maybeMoved(owner);
    if (movedOwner === owner) {
      return path;
    }
    let movedFullPath = fullPath.replace(owner.root, movedOwner.root);
    return explicitRelative(this.appDir, movedFullPath);
  };

  module(inputName: string) {
    let outputName = this.toRewritten(inputName);
    let m = this.result.modules[outputName];
    const showNearMisses = 4;
    if (!m) {
      let actuals = sortBy(Object.keys(this.result.modules), candidate => distance(candidate, outputName));
      this.assert.pushResult({
        result: false,
        actual:
          actuals.length > showNearMisses ? actuals.slice(0, showNearMisses).join(', ') + '...' : actuals.join(', '),
        expected: outputName,
        message: `Can't locate module ${inputName}`,
      });
    }
    return new ExpectModule(this.assert, this.result, m, this.toRewritten);
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
  constructor(
    private assert: Assert,
    private result: AuditResults,
    private module: Module | undefined,
    private toRewritten: (s: string) => string
  ) {}

  codeEquals(expectedSource: string) {
    if (this.module) {
      this.assert.codeEqual(this.module.content, expectedSource);
    }
  }

  resolves(specifier: string): ExpectResolution {
    if (!this.module) {
      // the place that instantiated us already pushed the exception that this
      // module doesn't exist
      return new ExpectResolution(this.assert, this.result, undefined, this.toRewritten);
    }
    if (!(specifier in this.module.resolutions)) {
      this.assert.pushResult({
        result: false,
        expected: `${this.module.appRelativePath} does not refer to ${specifier}`,
        actual: Object.keys(this.module.resolutions),
      });
      return new ExpectResolution(this.assert, this.result, undefined, this.toRewritten);
    }
    let resolution = this.module.resolutions[specifier];
    if (!resolution) {
      this.assert.pushResult({
        result: false,
        expected: `${specifier} fails to resolve in ${this.module.appRelativePath}`,
        actual: `${specifier} to resolve to something`,
      });
      return new ExpectResolution(this.assert, this.result, undefined, this.toRewritten);
    }
    let target = this.result.modules[resolution];
    if (!target) {
      this.assert.pushResult({
        result: false,
        expected: `${specifier} resolves to ${resolution} but ${resolution} is not found in audit results`,
        actual: `${resolution} exists`,
      });
      return new ExpectResolution(this.assert, this.result, undefined, this.toRewritten);
    }
    return new ExpectResolution(this.assert, this.result, target, this.toRewritten);
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
  constructor(
    private assert: Assert,
    private result: AuditResults,
    private module: Module | undefined,
    private toRewritten: (s: string) => string
  ) {}

  to(inputName: string | null, message?: string) {
    let outputName: string | null = null;
    if (inputName) {
      outputName = this.toRewritten(inputName);
    }
    if (this.module) {
      this.assert.pushResult({
        result: this.module.appRelativePath === outputName,
        expected: inputName,
        actual: this.module.appRelativePath,
        message,
      });
    }
  }

  toModule(): ExpectModule {
    return new ExpectModule(this.assert, this.result, this.module, this.toRewritten);
  }
}
