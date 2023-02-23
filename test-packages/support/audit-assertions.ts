import { Audit, AuditBuildOptions, AuditResults, Module } from '@embroider/compat/src/audit';

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

export class ExpectAuditResults {
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
    return new ExpectModule(this.assert, this.result, m);
  }

  get findings() {
    return this.result.findings;
  }
}

export class ExpectModule {
  constructor(private assert: Assert, private result: AuditResults, private module: Module | undefined) {}

  codeEquals(expectedSource: string) {
    if (this.module) {
      this.assert.codeEqual(this.module.content, expectedSource);
    }
  }

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
      toModule: (message?: string): ExpectModule => {
        let foundName = this.module?.resolutions[specifier];
        let foundModule: Module | undefined;
        if (foundName) {
          foundModule = this.result.modules[foundName];
          if (!foundModule) {
            this.assert.pushResult({
              result: false,
              expected: `${foundName} in audit results`,
              actual: `${foundName} not in audit results`,
              message,
            });
          }
        } else {
          this.assert.pushResult({
            result: false,
            expected: `specifier ${specifier} to resolve to something`,
            actual: `specifier ${specifier} did not resolve to anything`,
            message,
          });
        }
        return new ExpectModule(this.assert, this.result, foundModule);
      },
    };
  }
}
