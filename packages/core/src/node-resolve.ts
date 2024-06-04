import { virtualContent } from './virtual-content';
import { dirname, resolve, isAbsolute } from 'path';
import { explicitRelative } from '@embroider/shared-internals';
import assertNever from 'assert-never';

// these would be circular, but they're type-only so it's fine
import type { ModuleRequest, Resolution, Resolver } from './module-resolver';

export class NodeModuleRequest implements ModuleRequest {
  constructor(
    private resolver: Resolver,
    readonly specifier: string,
    readonly fromFile: string,
    readonly isVirtual: boolean,
    readonly meta: Record<string, any> | undefined,
    readonly isNotFound: boolean,
    readonly resolvedTo: Resolution<NodeResolution, Error> | undefined
  ) {}

  get debugType() {
    return 'node';
  }

  alias(specifier: string): this {
    return new NodeModuleRequest(this.resolver, specifier, this.fromFile, false, this.meta, false, undefined) as this;
  }
  rehome(fromFile: string): this {
    if (this.fromFile === fromFile) {
      return this;
    } else {
      return new NodeModuleRequest(this.resolver, this.specifier, fromFile, false, this.meta, false, undefined) as this;
    }
  }
  virtualize(filename: string): this {
    return new NodeModuleRequest(this.resolver, filename, this.fromFile, true, this.meta, false, undefined) as this;
  }
  withMeta(meta: Record<string, any> | undefined): this {
    return new NodeModuleRequest(
      this.resolver,
      this.specifier,
      this.fromFile,
      this.isVirtual,
      meta,
      this.isNotFound,
      this.resolvedTo
    ) as this;
  }
  notFound(): this {
    return new NodeModuleRequest(
      this.resolver,
      this.specifier,
      this.fromFile,
      this.isVirtual,
      this.meta,
      true,
      undefined
    ) as this;
  }

  resolveTo(resolution: Resolution<NodeResolution, Error>): this {
    return new NodeModuleRequest(
      this.resolver,
      this.specifier,
      this.fromFile,
      this.isVirtual,
      this.meta,
      this.isNotFound,
      resolution
    ) as this;
  }

  async defaultResolve(): Promise<Resolution<NodeResolution, Error>> {
    const request = this;
    if (request.isVirtual) {
      return {
        type: 'found',
        filename: request.specifier,
        isVirtual: true,
        result: {
          type: 'virtual' as 'virtual',
          content: virtualContent(request.specifier, this.resolver).src,
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

    let initialError;

    for (let candidate of candidates(specifier)) {
      let filename;
      try {
        filename = require.resolve(candidate, {
          paths: [fromDir],
        });
      } catch (err) {
        if (err.code !== 'MODULE_NOT_FOUND') {
          throw err;
        }

        if (!initialError) {
          initialError = err;
        }

        continue;
      }
      return { type: 'found', filename, result: { type: 'real' as 'real', filename }, isVirtual: false };
    }

    return { type: 'not_found', err: initialError };
  }
}

function* candidates(specifier: string) {
  yield specifier;

  const extensions = ['.hbs.js', '.hbs'];

  for (let ext of extensions) {
    yield `${specifier}${ext}`;
  }
}

type NodeResolution = { type: 'virtual'; filename: string; content: string } | { type: 'real'; filename: string };

type NodeResolutionError = { type: 'not_found'; err: Error };

export async function nodeResolve(
  resolver: Resolver,
  specifier: string,
  fromFile: string
): Promise<NodeResolution | NodeResolutionError> {
  let resolution = await resolver.resolve(
    new NodeModuleRequest(resolver, specifier, fromFile, false, undefined, false, undefined)
  );
  switch (resolution.type) {
    case 'not_found':
      return resolution;
    case 'found':
      return resolution.result;
    case 'ignored':
      throw new Error(
        `bug: this is supposed to be impossible because NodeModuleRequest.prototype.defaultResove does not use "ignored"`
      );
    default:
      throw assertNever(resolution);
  }
}
