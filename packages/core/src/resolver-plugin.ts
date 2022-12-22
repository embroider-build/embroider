import { createUnplugin } from 'unplugin';
import { externalShim, Options as ResolverPluginOptions, Resolver } from './module-resolver';
import assertNever from 'assert-never';

export { ResolverPluginOptions };

export const resolverPlugin = createUnplugin((resolverOptions: ResolverPluginOptions) => {
  return {
    name: 'unplugin-embroider-resolver',
    async resolveId(
      id: string,
      importer: string | undefined,
      _options: {
        isEntry: boolean;
      }
    ) {
      if (!importer) {
        return null;
      }

      let resolution = resolverFor(importer, resolverOptions).resolve(id);

      switch (resolution.result) {
        case 'external':
          // according to the docs we should be allowed to return `{ external:
          // true, id: resolution.specifier }` here and that would take care of
          // externalizing. But due to https://github.com/unjs/unplugin/issues/238
          // that doesn't work, so we will generate our own runtime stubs via the
          // load hook below.
          return `@embroider/externals/${resolution.specifier}`;
        case 'continue':
          // null is the "defer to other plugins and default resolution" outcome
          return null;
        case 'redirect-to':
          return null;
        default:
          throw assertNever(resolution);
      }
    },
    async load(id: string) {
      if (id.startsWith('@embroider/externals/')) {
        let moduleName = id.slice('@embroider/externals/'.length);
        return externalShim({ moduleName });
      }
    },
  };
});

let prev:
  | {
      importer: string;
      resolver: Resolver;
    }
  | undefined;

function resolverFor(importer: string, resolverOptions: ResolverPluginOptions): Resolver {
  // as a very simple cache, reuse the same Resolver if we're still working
  // from the same importer as the last call. We'd expect that is a common
  // case, and we can avoid re-discovering things like the owning package of
  // the importer.
  let resolver = prev?.importer === importer ? prev.resolver : new Resolver(importer, resolverOptions);
  prev = { importer, resolver };
  return resolver;
}
