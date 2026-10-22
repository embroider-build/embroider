import { copyFileSync, mkdirSync, symlinkSync } from 'fs';
import { dirname, join } from 'path';

/**
 * A broccoli node that puts some files of its input at new paths.
 *
 * It does the one job that addon-shim needs from broccoli-funnel,
 * without the dependency tree of broccoli-funnel and broccoli-plugin.
 *
 * `files` maps a path in the input to a path in the output.
 */
export class CopyFiles {
  readonly __broccoliFeatures__ = Object.freeze({
    persistentOutputFlag: true,
    sourceDirectories: true,
    needsCacheFlag: true,
    volatileFlag: true,
    trackInputChangesFlag: true,
    fsFacadeFlag: true,
  });

  private instantiationStack = new Error().stack ?? '';

  constructor(
    private inputNode: unknown,
    private files: Record<string, string>,
    private annotation: string
  ) {}

  __broccoliGetInfo__() {
    let files = this.files;
    let inputPath = '';
    let outputPath = '';

    return {
      nodeType: 'transform',
      name: 'CopyFiles',
      annotation: this.annotation,
      instantiationStack: this.instantiationStack,
      inputNodes: [this.inputNode],
      /**
       * broccoli empties the output directory before each build,
       * so a build never sees the links of an earlier build.
       */
      persistentOutput: false,
      needsCache: false,
      volatile: false,
      trackInputChanges: false,
      fsFacade: false,
      setup(
        _features: unknown,
        options: { inputPaths: string[]; outputPath: string }
      ) {
        inputPath = options.inputPaths[0];
        outputPath = options.outputPath;
      },
      getCallbackObject() {
        return {
          build() {
            for (let [from, to] of Object.entries(files)) {
              linkOrCopy(join(inputPath, from), join(outputPath, to));
            }
          },
        };
      },
    };
  }
}

function linkOrCopy(source: string, destination: string) {
  mkdirSync(dirname(destination), { recursive: true });

  try {
    symlinkSync(source, destination);
  } catch {
    /**
     * Windows refuses symlinks without developer mode or admin rights.
     */
    copyFileSync(source, destination);
  }
}
