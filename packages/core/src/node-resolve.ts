import { virtualContent } from './virtual-content';
import { dirname, resolve, isAbsolute } from 'path';
import { explicitRelative } from '@embroider/shared-internals';
import assertNever from 'assert-never';

// these would be circular, but they're type-only so it's fine
import type { ModuleRequest, Resolver } from './module-resolver';

export class NodeModuleRequest implements ModuleRequest {
  constructor(
    readonly specifier: string,
    readonly fromFile: string,
    readonly isVirtual: boolean,
    readonly meta: Record<string, any> | undefined,
    readonly isNotFound: boolean
  ) {}

  get debugType() {
    return 'node';
  }

  alias(specifier: string): this {
    return new NodeModuleRequest(specifier, this.fromFile, false, this.meta, false) as this;
  }
  rehome(fromFile: string): this {
    if (this.fromFile === fromFile) {
      return this;
    } else {
      return new NodeModuleRequest(this.specifier, fromFile, false, this.meta, false) as this;
    }
  }
  virtualize(filename: string): this {
    return new NodeModuleRequest(filename, this.fromFile, true, this.meta, false) as this;
  }
  withMeta(meta: Record<string, any> | undefined): this {
    return new NodeModuleRequest(this.specifier, this.fromFile, this.isVirtual, meta, this.isNotFound) as this;
  }
  notFound(): this {
    return new NodeModuleRequest(this.specifier, this.fromFile, this.isVirtual, this.meta, true) as this;
  }
}

export function nodeResolve(
  resolver: Resolver,
  specifier: string,
  fromFile: string
):
  | { type: 'virtual'; filename: string; content: string }
  | { type: 'real'; filename: string }
  | { type: 'not_found'; err: Error } {
  let resolution = resolver.resolveSync(
    new NodeModuleRequest(specifier, fromFile, false, undefined, false),
    request => {
      if (request.isVirtual) {
        return {
          type: 'found',
          result: {
            type: 'virtual' as 'virtual',
            content: virtualContent(request.specifier, resolver).src,
            filename: request.specifier,
          },
        };
      }
      if (request.isNotFound) {
        let err = new Error(`module not found ${request.specifier}`);
        (err as any).code = 'MODULE_NOT_FOUND';
        return {
          type: 'not_found',
          err,
        };
      }
      try {
        // require.resolve does not like when we resolve from virtual paths.
        // That is, a request like "../thing.js" from
        // "/a/real/path/VIRTUAL_SUBDIR/virtual.js" has an unambiguous target of
        // "/a/real/path/thing.js", but require.resolve won't do that path
        // adjustment until after checking whether VIRTUAL_SUBDIR actually
        // exists.
        //
        // We can do the path adjustments before doing require.resolve.
        let { specifier } = request;
        let fromDir = dirname(request.fromFile);
        if (!isAbsolute(specifier) && specifier.startsWith('.')) {
          let targetPath = resolve(fromDir, specifier);
          let newFromDir = dirname(targetPath);
          if (fromDir !== newFromDir) {
            specifier = explicitRelative(newFromDir, targetPath);
            fromDir = newFromDir;
          }
        }

        let filename = require.resolve(specifier, {
          paths: [fromDir],
        });
        return { type: 'found', result: { type: 'real' as 'real', filename } };
      } catch (err) {
        if (err.code !== 'MODULE_NOT_FOUND') {
          throw err;
        }
        return { type: 'not_found', err };
      }
    }
  );
  switch (resolution.type) {
    case 'not_found':
      return resolution;
    case 'found':
      return resolution.result;
    default:
      throw assertNever(resolution);
  }
}
