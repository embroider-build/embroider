import { virtualContent, type VirtualResponse } from './virtual-content';
import { dirname, resolve, isAbsolute } from 'path';
import { explicitRelative } from '@embroider/shared-internals';
import assertNever from 'assert-never';

// these would be circular, but they're type-only so it's fine
import { ModuleRequest, type RequestAdapter, type RequestAdapterCreate, type Resolution } from './module-request';
import type { Resolver } from './module-resolver';

export class NodeRequestAdapter implements RequestAdapter<Resolution<NodeResolution, Error>> {
  static create: RequestAdapterCreate<
    { resolver: Resolver; specifier: string; fromFile: string; extensions: string[] },
    Resolution<NodeResolution, Error>
  > = ({ resolver, specifier, fromFile, extensions }) => {
    return {
      initialState: {
        specifier,
        fromFile,
        meta: undefined,
      },
      adapter: new NodeRequestAdapter(resolver, extensions),
    };
  };

  private constructor(private resolver: Resolver, private extensions: string[]) {}

  get debugType() {
    return 'node';
  }

  notFoundResponse(request: ModuleRequest<Resolution<NodeResolution, Error>>): Resolution<NodeResolution, Error> {
    let err = new Error(`module not found ${request.specifier}`);
    (err as any).code = 'MODULE_NOT_FOUND';
    return {
      type: 'not_found',
      err,
    };
  }

  virtualResponse(
    _request: ModuleRequest<Resolution<NodeResolution, Error>>,
    virtual: VirtualResponse
  ): Resolution<NodeResolution, Error> {
    return {
      type: 'found',
      filename: virtual.specifier,
      virtual,
      result: {
        type: 'virtual' as const,
        content: virtualContent(virtual, this.resolver).src,
        filename: virtual.specifier,
      },
    };
  }

  async resolve(request: ModuleRequest<Resolution<NodeResolution, Error>>): Promise<Resolution<NodeResolution, Error>> {
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

    for (let candidate of candidates(specifier, this.extensions)) {
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
      if (filename.endsWith('.hbs') && !candidate.endsWith('.hbs')) {
        // Evaluating the `handlebars` NPM package installs a Node extension
        // that puts `*.hbs` in the automatic search path. But we can't control
        // its priority, and it's really important to us that `.hbs` cannot
        // shadow other extensions with higher priority. For example, when both
        // `.ts` and `.hbs` exist, resolving is supposed to find the `.ts`.
        //
        // This covers the case where we found an hbs "by accident", when we
        // weren't actually expecting it.
        continue;
      }
      return { type: 'found', filename, result: { type: 'real' as 'real', filename }, virtual: false };
    }

    return { type: 'not_found', err: initialError };
  }
}

const defaultExtensions = ['.hbs.js', '.hbs'];

function* candidates(specifier: string, extensions: string[]) {
  yield specifier;

  for (let ext of extensions) {
    yield `${specifier}${ext}`;
  }
}

type NodeResolution = { type: 'virtual'; filename: string; content: string } | { type: 'real'; filename: string };

type NodeResolutionError = { type: 'not_found'; err: Error };

export interface NodeResolveOpts {
  extensions?: string[];
}

export async function nodeResolve(
  resolver: Resolver,
  specifier: string,
  fromFile: string,
  opts?: NodeResolveOpts
): Promise<NodeResolution | NodeResolutionError> {
  let request = ModuleRequest.create(NodeRequestAdapter.create, {
    resolver,
    fromFile,
    specifier,
    extensions: opts?.extensions ?? defaultExtensions,
  });
  let resolution = await resolver.resolve(request!);
  switch (resolution.type) {
    case 'not_found':
      return resolution;
    case 'found':
      return resolution.result;
    default:
      throw assertNever(resolution);
  }
}
