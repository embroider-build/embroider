import {
  ModuleRequest,
  type RequestAdapter,
  type RequestAdapterCreate,
  type Resolution,
  type Resolver,
  type VirtualResponse,
} from '@embroider/core';
import { join } from 'path';

type Captured = Resolution<VirtualResponse | undefined, Error>;

// A tiny RequestAdapter used to ask the core resolver "if the app imported
// this specifier, what virtual response would you produce?". This is the
// webpack analog of vite's `ensureVirtualResolve`, used so we can emit the
// vendor.js / vendor.css / test-support.* virtual files as real assets the
// same way vite's resolver plugin does in its `buildEnd` hook.
class CaptureAdapter implements RequestAdapter<Captured> {
  static create: RequestAdapterCreate<{ specifier: string; fromFile: string }, Captured> = ({
    specifier,
    fromFile,
  }) => {
    return {
      initialState: { specifier, fromFile, meta: undefined },
      adapter: new CaptureAdapter(),
    };
  };

  get debugType() {
    return 'webpack-virtual-capture';
  }

  async resolve(): Promise<Captured> {
    return { type: 'not_found', err: new Error('not virtual') };
  }

  notFoundResponse(): Captured {
    return { type: 'not_found', err: new Error('not virtual') };
  }

  virtualResponse(_request: ModuleRequest<Captured>, virtual: VirtualResponse): Captured {
    return { type: 'found', filename: virtual.specifier, virtual, result: virtual };
  }
}

export async function resolveVirtual(
  resolver: Resolver,
  specifier: string,
  appRoot: string
): Promise<VirtualResponse | undefined> {
  let request = ModuleRequest.create(CaptureAdapter.create, {
    specifier,
    fromFile: join(appRoot, 'package.json'),
  });
  if (!request) {
    return undefined;
  }
  let resolution = await resolver.resolve(request);
  if (resolution.type === 'found' && resolution.virtual) {
    return resolution.virtual;
  }
  return undefined;
}
