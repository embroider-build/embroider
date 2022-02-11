import { createFilter } from '@rollup/pluginutils';
import { readFileSync } from 'fs';
import { hbsToJS } from '@embroider/shared-internals';
import path from 'path';
import { pathExists } from 'fs-extra';

import type { Plugin } from 'rollup';

export default function rollupHbsPlugin(): Plugin {
  const filter = createFilter('**/*.hbs');

  return {
    name: 'rollup-hbs-plugin',
    async resolveId(source: string, importer: string | undefined, options) {
      let resolution = await this.resolve(source, importer, {
        skipSelf: true,
        ...options,
      });

      let id = resolution?.id;

      // if id is undefined, it's possible we're importing a file that that rollup
      // doesn't natively support such as a template-only component that the author
      // doesn't want to be available on the globals resolver
      //
      //  e.g.:
      //    import { default as Button } from './button';
      //
      //    where button.hbs is the sole "button" file.
      //
      //  if someone where to specify the `.hbs` extension themselves as in:
      //
      //    import { default as Button } from './button';
      //
      //  then this whole block will be skipped
      if (importer && !id) {
        // We can't just emit the js side of the template-only component (export default templateOnly())
        // because we can't tell rollup where to put the file -- all emitted files are
        // not-on-disk-area-used-at-build-time -- emitted files are for the build output
        //
        // https://github.com/rollup/rollup/blob/master/docs/05-plugin-development.md
        //
        // So, to deal with this, we need to ensure there _is no corresponding js/ts file_
        // for the imported hbs, and then, add in some meta so that the load hook can
        // generate the setComponentTemplate + templateOnly() combo
        let fileName = path.join(path.dirname(importer), source);
        let hbsExists = await pathExists(fileName + '.hbs');

        if (!hbsExists) return null;

        resolution = await this.resolve(source + '.hbs', importer, {
          skipSelf: true,
          ...options,
        });

        id = resolution?.id;
      }

      if (!filter(id) || !id) return null;

      let isTO = await isTemplateOnly(id);

      // This creates an `*.hbs.js` that we will populate in `load()` hook.
      return {
        ...resolution,
        id: id + '.js',
        meta: {
          'rollup-hbs-plugin': {
            originalId: id,
            isTemplateOnly: isTO,
          },
        },
      };
    },
    load(id: string) {
      const meta = this.getModuleInfo(id)?.meta;
      const pluginMeta = meta?.['rollup-hbs-plugin'];
      const originalId = pluginMeta?.originalId;
      const isTemplateOnly = pluginMeta?.isTemplateOnly;

      if (!originalId) {
        return;
      }

      if (isTemplateOnly) {
        let code = getTemplateOnly(originalId);

        return { code };
      }

      // Co-located js + hbs
      let input = readFileSync(originalId, 'utf8');
      let code = hbsToJS(input);
      return {
        code,
      };
    },
  };
}

const backtick = '`';

async function isTemplateOnly(hbsPath: string) {
  let jsPath = hbsPath.replace(/\.hbs$/, '.js');
  let tsPath = hbsPath.replace(/\.hbs$/, '.ts');

  let [hasJs, hasTs] = await Promise.all([
    pathExists(jsPath),
    pathExists(tsPath),
  ]);

  let hasClass = hasJs || hasTs;

  return !hasClass;
}

function getTemplateOnly(hbsPath: string) {
  let input = readFileSync(hbsPath, 'utf8');
  let code =
    `import { hbs } from 'ember-cli-htmlbars';\n` +
    `import templateOnly from '@ember/component/template-only';\n` +
    `import { setComponentTemplate } from '@ember/component';\n` +
    `export default setComponentTemplate(\n` +
    `hbs${backtick}${input}${backtick}, templateOnly());`;

  return code;
}
