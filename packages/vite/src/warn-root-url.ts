import type { Plugin } from 'vite';
import { JSDOM } from 'jsdom';
import chalk from 'chalk';

const ROOT_URL_TOKEN_REGEX = /{{\s?rootURL\s?}}/g; // https://github.com/ember-cli/ember-cli/blob/d8f073aa8c5a73f50d0bc16f1d96d371c94a43f4/lib/utilities/ember-app-utils.js#L158

export function warnRootUrl(): Plugin {
  return {
    name: 'embroider-warn-root-url',
    transformIndexHtml: {
      order: 'pre',
      handler(html, { filename }) {
        if (process.env.EMBROIDER_WARN_ROOT_URL === 'false') {
          return html;
        }

        if (!html.match(ROOT_URL_TOKEN_REGEX)) {
          return html;
        }

        console.log(
          `\n${chalk.bold.yellow('WARNING')}\n${chalk.yellow(
            `Using ${chalk.blue('{{rootURL}}')} in ${filename} is no longer supported.\n`
          )}`
        );

        const matches = html.matchAll(ROOT_URL_TOKEN_REGEX);
        const count = [...matches].length;

        const dom = new JSDOM(html, {
          includeNodeLocations: true,
        });
        const document = dom.window.document;
        const nodes = [...document.querySelectorAll('*')].filter(node =>
          node.getAttributeNames().some(key => node.getAttribute(key)?.match(ROOT_URL_TOKEN_REGEX))
        );

        if (nodes.length === 0) {
          console.log(`You need to update ${count} occurence(s)`);

          return html;
        } else {
          console.log(`You need to update ${nodes.length} attribute(s):`);
        }

        let remaining = count;

        for (const node of nodes) {
          const attribute = node.getAttributeNames().find(key => node.getAttribute(key)?.match(ROOT_URL_TOKEN_REGEX));
          const nodeLocation = dom.nodeLocation(node);

          if (!attribute || !nodeLocation) {
            continue;
          }

          const { startLine, startCol } = nodeLocation?.attrs?.[attribute]!;

          console.log(`  ${chalk.dim('L')}${startLine}${chalk.dim(':')}${startCol} ${chalk.dim(node.outerHTML)}`);

          remaining--;
        }

        if (remaining) {
          console.log(`You also need to update ${remaining} other occurence(s) elsewhere in the same file.`);
        }

        console.log('\nTo disable this warning set environment variable "EMBROIDER_WARN_ROOT_URL" to "false"\n');

        return html;
      },
    },
  };
}
