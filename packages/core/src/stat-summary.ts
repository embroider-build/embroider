import { Variant } from './packager';

export interface StatSummary {
  // entrypoints.get(inputAsset).get(variantIndex) === outputAssets
  entrypoints: Map<string, Map<number, string[]>>;

  // lazyBundles are tracked specifically for fastboot, so these always come
  // from the fastboot variant, if any
  lazyBundles: Set<string>;

  variants: Variant[];
}
