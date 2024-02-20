import { explicitRelative, RewrittenPackageCache } from '@embroider/shared-internals';
import { resolve } from 'path';

export function getRewrittenLocation(appDir: string, inputPath: string) {
  let packageCache = RewrittenPackageCache.shared('embroider', appDir);
  let fullInputPath = resolve(appDir, inputPath);
  let owner = packageCache.ownerOfFile(fullInputPath);
  if (!owner) {
    return inputPath;
  }
  let movedOwner = packageCache.maybeMoved(owner);
  if (movedOwner === owner) {
    return inputPath;
  }
  let movedFullPath = fullInputPath.replace(owner.root, movedOwner.root);
  return explicitRelative(appDir, movedFullPath);
}
