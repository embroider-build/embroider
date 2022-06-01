import {
  allBabelVersions,
  emberTemplateCompilerPath,
} from '@embroider/test-support';
import {
  TemplateTransformPlugin,
  Options,
} from '../src/template-transform-plugin';
import { hbsToJS } from '@embroider/core';
import { AST } from '@glimmer/syntax';
import { join } from 'path';
import tmp from 'tmp';
import { writeFileSync } from 'fs-extra';

describe('template-transform-plugin', () => {
  jest.setTimeout(120000);

  const templateTransformBabelPlugin = join(
    __dirname,
    '../src/template-transform-plugin.js'
  );

  let plugins: any = [];

  function reverseTransform() {
    return {
      name: 'reverse-transform',
      visitor: {
        ElementNode(node: AST.ElementNode) {
          node.tag = node.tag.split('').reverse().join('');
        },
      },
    };
  }

  function setupPlugins(options?: {
    astTransforms: TemplateTransformPlugin[];
  }) {
    const opts: Options = {
      astTransforms: options?.astTransforms,
      compilerPath: emberTemplateCompilerPath(),
    };
    plugins = [[templateTransformBabelPlugin, opts]];
  }

  allBabelVersions({
    babelConfig() {
      return {
        plugins,
      };
    },
    createTests(transform) {
      afterEach(function () {
        plugins = undefined;
      });

      test('no-op', () => {
        setupPlugins();
        const code = hbsToJS('Hello {{@phrase}}');
        let output = transform(code);
        expect(output).toMatch(
          /import { hbs } from ['"]ember-cli-htmlbars['"];/
        );
        expect(output).toMatch(
          /export default hbs\(['"]Hello {{@phrase}}['"]\);/
        );
      });

      test('options.astTransforms empty array', () => {
        setupPlugins({
          astTransforms: [],
        });
        const code = hbsToJS('Hello {{@phrase}}');
        let output = transform(code);
        expect(output).toMatch(
          /import { hbs } from ['"]ember-cli-htmlbars['"];/
        );
        expect(output).toMatch(
          /export default hbs\(['"]Hello {{@phrase}}['"]\);/
        );
      });
      test('options.astTransforms function', () => {
        setupPlugins({
          astTransforms: [reverseTransform],
        });

        const code = hbsToJS('<span>{{@phrase}}</span>');
        let output = transform(code);
        expect(output).toMatch(
          /import { hbs } from ['"]ember-cli-htmlbars['"];/
        );
        expect(output).toMatch(
          /export default hbs\(['"]\<naps\>{{@phrase}}\<\/naps\>['"]\);/
        );
      });

      test('options.astTransforms path', () => {
        const someFile = tmp.fileSync();

        const contents = `module.exports = function reverseTransform() {
        return {
          name: 'reverse-transform',
          visitor: {
            ElementNode(node) {
              node.tag = node.tag.split('').reverse().join('');
            },
          },
        };
      }`;

        writeFileSync(someFile.name, contents, 'utf8');

        setupPlugins({
          astTransforms: [someFile.name],
        });

        const code = hbsToJS('<span>{{@phrase}}</span>');

        let output = transform(code);

        expect(output).toMatch(
          /import { hbs } from ['"]ember-cli-htmlbars['"];/
        );
        expect(output).toMatch(
          /export default hbs\(['"]\<naps\>{{@phrase}}\<\/naps\>['"]\);/
        );

        someFile.removeCallback();
      });

      test('ember-cli-htmlbars alias import name', () => {
        setupPlugins({
          astTransforms: [reverseTransform],
        });

        const code = `import { hbs as render } from 'ember-cli-htmlbars';
      export default render('<span>{{@phrase}}</span>');`;

        let output = transform(code);

        expect(output).toMatch(
          /import { hbs as render } from ['"]ember-cli-htmlbars['"];/
        );
        expect(output).toMatch(
          /export default render\(['"]\<naps\>{{@phrase}}\<\/naps\>['"]\);/
        );
      });
    },
  });
});
