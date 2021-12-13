declare module 'calculate-cache-key-for-tree' {
  import { AddonInstance } from "@embroider/shared-internals";

  export default function(treeType: string, addonInstance: AddonInstance, additionalCacheKeyParts?: any[]): string;
}
