import { install as installCodeEqualityAssertions } from 'code-equality-assertions/qunit';

export type ModuleAt = (path: string) => Module;

export function fetchAssertions(serverURL: string, assert: Assert) {
  installCodeEqualityAssertions(assert);
  return function moduleAt(path: string): Module {
    return new Module(assert, serverURL, path);
  };
}

class Module {
  constructor(private assert: Assert, private serverURL: string, private path: string) {}

  get url() {
    return new URL(this.path, this.serverURL).href;
  }

  private get urlWithCacheBuster() {
    let u = new URL(this.path, this.serverURL);
    u.searchParams.set('v', String(Math.floor(Math.random() * 1000)));
    return u.href;
  }

  async isNotFound(message?: string) {
    let response = await fetch(this.urlWithCacheBuster, {
      headers: {
        accept: 'application/javascript',
      },
    });
    await response.text(); // consume body
    let detail = `expecting 404 for ${this.url}`;
    if (message) {
      detail = message + '.  ' + detail;
    }
    this.assert.strictEqual(response.status, 404, detail);
  }

  async contains(expected: string, message?: string) {
    let response = await fetch(this.urlWithCacheBuster, {
      headers: {
        accept: 'application/javascript',
      },
    });
    if (!response.ok) {
      await response.text(); // still consume body
      this.assert.strictEqual(
        response.status,
        200,
        `${message}${message ? '.  ' : ''}unexpected response for ${this.url}`
      );
      return;
    }
    let actual = await response.text();
    let detail = this.url;
    if (message) {
      detail = message + '.  ' + detail;
    }
    this.assert.codeContains(actual, expected, detail);
  }
}
