import Plugin from 'broccoli-plugin';
import type { Node } from 'broccoli-node-api';
import { join, basename } from 'path';
import walkSync, { type Entry } from 'walk-sync';
import { removeSync, outputFileSync, pathExistsSync, readFileSync } from 'fs-extra';

const source = `import templateOnlyComponent from '@ember/component/template-only';
export default templateOnlyComponent();`;

const jsExtensions = ['.js', '.ts', '.mjs', '.mts'];

type Emitted = { type: 'template-only-component' } | { type: 'template-import'; mtime: number };

type TemplateOnly = { template: Entry; javascript: undefined };
type JavaScriptOnly = { template: undefined; javascript: Entry };
type Colocated = { template: Entry; javascript: Entry };
type ComponentFiles = TemplateOnly | JavaScriptOnly | Colocated;

function importTemplate(files: { template: Entry }): string {
  return `/* import __COLOCATED_TEMPLATE__ from './${basename(files.template.relativePath)}'; */\n`;
}

export default class SynthesizeTemplateOnlyComponents extends Plugin {
  private emitted = new Map() as Map<string, Emitted>;
  private allowedPaths: string[];
  private templateExtensions: string[];

  constructor(tree: Node, params: { allowedPaths: string[]; templateExtensions: string[] }) {
    super([tree], {
      annotation: `synthesize-template-only-components:${params.allowedPaths.join(':')}`,
      persistentOutput: true,
      needsCache: false,
    });
    this.allowedPaths = params.allowedPaths;
    this.templateExtensions = params.templateExtensions;
  }

  async build() {
    let unneeded = new Set(this.emitted.keys());
    for (let dir of this.allowedPaths) {
      let entries = this.crawl(join(this.inputPaths[0], dir));
      for (let [name, files] of entries) {
        let fullName = join(this.outputPath, dir, name);
        unneeded.delete(fullName);
        if (files.javascript && files.template) {
          this.addTemplateImport(fullName, files);
        } else if (files.template) {
          this.addTemplateOnlyComponent(fullName, files);
        } else {
          this.remove(fullName);
        }
      }
    }
    for (let fullName of unneeded) {
      this.remove(fullName);
    }
  }

  private addTemplateOnlyComponent(filename: string, files: TemplateOnly) {
    if (this.emitted.get(filename)?.type !== 'template-only-component') {
      // special case: ember-cli doesn't allow template-only components named
      // "template.hbs" because there are too many people doing a "pods-like"
      // layout that happens to match that pattern.🤮
      if (basename(filename) !== 'template') {
        outputFileSync(filename + '.js', importTemplate(files) + source, 'utf8');
      }

      this.emitted.set(filename, { type: 'template-only-component' });
    }
  }

  private addTemplateImport(filename: string, files: Colocated) {
    const emitted = this.emitted.get(filename);
    const mtime = files.javascript.mtime;

    if (!(emitted?.type === 'template-import' && emitted.mtime === mtime)) {
      const inputSource = readFileSync(files.javascript.fullPath, { encoding: 'utf8' });

      // If we are ok with appending instead, copy + append maybe more efficient?
      outputFileSync(filename + '.js', importTemplate(files) + inputSource, 'utf8');

      this.emitted.set(filename, { type: 'template-import', mtime });
    }
  }

  private remove(filename: string) {
    if (this.emitted.has(filename)) {
      removeSync(filename + '.js');
      this.emitted.delete(filename);
    }
  }

  private crawl(dir: string): Map<string, ComponentFiles> {
    const entries = new Map<string, ComponentFiles>();

    if (pathExistsSync(dir)) {
      for (let entry of walkSync.entries(dir, { directories: false })) {
        const templateExtension = this.templateExtensions.find(ext => entry.relativePath.endsWith(ext));
        if (templateExtension) {
          const key = entry.relativePath.slice(0, -1 * templateExtension.length);
          entries.set(key, { template: entry, javascript: entries.get(key)?.javascript });
          continue;
        }

        const jsExtension = jsExtensions.find(ext => entry.relativePath.endsWith(ext));
        if (jsExtension) {
          const key = entry.relativePath.slice(0, -1 * jsExtension.length);
          entries.set(key, { template: entries.get(key)?.template, javascript: entry });
          continue;
        }
      }
    }

    return entries;
  }
}
