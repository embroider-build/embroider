import { describe, expect, it, vi } from 'vitest';

const virtual = { type: 'route-entrypoint', specifier: '/app/-embroider-route-entrypoint.js:route=application' };
const virtualId = '/app/-embroider-route-entrypoint.js:route=application';

class FakeResolverLoader {
  get resolver() {
    return {
      packageCache: {},
      options: { engines: [] },
      resolve(request) {
        if (request.specifier === '@embroider/core/route/application') {
          return {
            type: 'found',
            virtual,
            result: { id: virtualId, meta: { 'embroider-resolver': { virtual } } },
          };
        }
        return { type: 'not_found', err: undefined };
      },
    };
  }
}

vi.mock('@embroider/core', async importOriginal => {
  let original = await importOriginal();
  return {
    ...original,
    ResolverLoader: FakeResolverLoader,
    // resolver.ts uses a default import, which only exists once core is built.
    default: { ...original, ...(original.default ?? {}), ResolverLoader: FakeResolverLoader },
  };
});

const { resolver } = await import('../src/resolver');

describe('embroider-resolver', () => {
  it('re-resolves an id it already handed out to the same virtual module', async () => {
    let plugin = resolver();
    let context = {};

    let first = await plugin.resolveId.call(context, '@embroider/core/route/application', '/app/package.json', {});
    expect(first.id).toBe(virtualId);

    let second = await plugin.resolveId.call(context, first.id, `${first.id}?rolldown-lazy=1`, {});
    expect(second.id).toBe(virtualId);
  });
});
