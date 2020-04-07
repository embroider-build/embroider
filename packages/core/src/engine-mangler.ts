import Package from './package';

export function mangledEngineRoot(pkg: Package) {
  return `${pkg.root}__engine_internal__`;
}
