import { Audit, AuditBuildOptions, AuditResults } from '@embroider/compat/src/audit';

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
    expectAudit = new ExpectAuditResults(result, assert);
  });

  return {
    module(name: string) {
      return expectAudit.module(name);
    },
    get findings() {
      return expectAudit.findings;
    },
  };
}

async function audit(this: Assert, opts: AuditBuildOptions): Promise<ExpectAuditResults> {
  return new ExpectAuditResults(await Audit.run(opts), this);
}
QUnit.assert.audit = audit;
declare global {
  interface Assert {
    audit: typeof audit;
  }
}

class ExpectAuditResults {
  constructor(readonly result: AuditResults, private assert: Assert) {}

  module(name: string) {
    let m = this.result.modules[name];
    if (!m) {
      this.assert.pushResult({
        result: false,
        actual: `${name} is not in audit results`,
        expected: `${name} in audit results`,
      });
    }
    return new ExpectModule(this.assert, m);
  }

  get findings() {
    return this.result.findings;
  }
}

class ExpectModule {
  constructor(private assert: Assert, private module: AuditResults['modules'][string] | undefined) {}

  resolves(specifier: string) {
    return {
      to: (filename: string | null, message?: string) => {
        if (this.module) {
          if (specifier in this.module.resolutions) {
            this.assert.pushResult({
              result: this.module.resolutions[specifier] === filename,
              expected: filename,
              actual: this.module.resolutions[specifier],
              message,
            });
          } else {
            this.assert.pushResult({
              result: false,
              expected: specifier,
              actual: Object.keys(this.module.resolutions),
              message,
            });
          }
        }
      },
    };
  }
}
