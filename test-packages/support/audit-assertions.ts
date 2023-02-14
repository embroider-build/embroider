import { Audit, AuditResults } from '@embroider/compat/src/audit';

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

  hooks.after(assert => {
    assert.deepEqual(
      expectAudit.findings.map(f => ({ ...f, codeFrame: '<elided>' })),
      [],
      'expected no problem findings in audit'
    );
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

class ExpectAuditResults {
  constructor(private result: AuditResults, private assert: Assert) {}

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
              message: message ?? `unexpected resolution`,
            });
          } else {
            this.assert.pushResult({
              result: false,
              expected: specifier,
              actual: `only resolutions present were: ${Object.keys(this.module.resolutions).join(', ')}`,
              message: message ?? `missing resolution`,
            });
          }
        }
      },
    };
  }
}
