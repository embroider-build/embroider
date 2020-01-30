import Plugin, { Tree } from 'broccoli-plugin';
import { join } from 'path';
import walkSync from 'walk-sync';
import { remove, outputFileSync, pathExistsSync } from 'fs-extra';

const source = `export default Ember._templateOnlyComponent();`;

const templateExtension = '.hbs';

// we don't need to worry about all resolvable extensions in here (like .ts)
// because by the time we see the code it has already been preprocessed down to
// js.
const jsExtension = '.js';

export default class SynthesizeTemplateOnlyComponents extends Plugin {
  private emitted = new Set() as Set<string>;

  constructor(tree: Tree, private allowedPaths: string[]) {
    super([tree], {
      annotation: `synthesize-template-only-components:${allowedPaths.join(':')}`,
      persistentOutput: true,
      needsCache: false,
    });
  }

  async build() {
    for (let dir of this.allowedPaths) {
      let { needed, seen } = crawl(join(this.inputPaths[0], dir));
      for (let file of needed) {
        let fullName = join(this.outputPath, dir, file);
        if (seen.has(file)) {
          this.remove(fullName);
        } else {
          this.add(fullName);
        }
      }
    }
  }
  private add(filename: string) {
    if (!this.emitted.has(filename)) {
      outputFileSync(filename + '.js', source, 'utf8');
      this.emitted.add(filename);
    }
  }

  private remove(filename: string) {
    if (this.emitted.has(filename)) {
      remove(filename + '.js');
      this.emitted.delete(filename);
    }
  }
}

function crawl(dir: string) {
  let needed = new Set();
  let seen = new Set();
  if (pathExistsSync(dir)) {
    for (let file of walkSync(dir, { directories: false })) {
      if (file.endsWith(templateExtension)) {
        needed.add(file.slice(0, -1 * templateExtension.length));
      } else if (file.endsWith(jsExtension)) {
        seen.add(file.slice(0, -1 * jsExtension.length));
      }
    }
  }
  return { needed, seen };
}
