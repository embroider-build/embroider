import Plugin from 'broccoli-plugin';
import { Node } from 'broccoli-node-api';
import { join, basename } from 'path';
import walkSync from 'walk-sync';
import { remove, outputFileSync, pathExistsSync } from 'fs-extra';

const source = `import templateOnlyComponent from '@ember/component/template-only';
export default templateOnlyComponent();`;

const templateExtension = '.hbs';

const jsExtensions = ['.js', '.ts', '.mjs', '.mts'];

export default class SynthesizeTemplateOnlyComponents extends Plugin {
  private emitted = new Set() as Set<string>;

  constructor(tree: Node, private allowedPaths: string[]) {
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
      // special case: ember-cli doesn't allow template-only components named
      // "template.hbs" because there are too many people doing a "pods-like"
      // layout that happens to match that pattern.🤮
      if (basename(filename) !== 'template') {
        outputFileSync(filename + '.js', source, 'utf8');
      }
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
  const needed = new Set<string>();
  const seen = new Set<string>();
  if (pathExistsSync(dir)) {
    for (let file of walkSync(dir, { directories: false })) {
      if (file.endsWith(templateExtension)) {
        needed.add(file.slice(0, -1 * templateExtension.length));
      } else {
        const jsExtension = jsExtensions.find(ext => file.endsWith(ext));
        if (jsExtension) {
          seen.add(file.slice(0, -1 * jsExtension.length));
        }
      }
    }
  }
  return { needed, seen };
}
