import type { Plugin } from 'vite';
import chalk from 'chalk';

const VIRTUAL_APP_CSS = '@embroider/virtual/app.css';
const DEPRECATION_GUIDE = 'https://deprecations.emberjs.com/id/broccoli-css-pipeline';

export function warnVirtualAppCss(): Plugin {
  return {
    name: 'embroider-warn-virtual-app-css',
    transformIndexHtml: {
      order: 'pre',
      handler(html, { filename }) {
        if (process.env.EMBROIDER_WARN_VIRTUAL_APP_CSS === 'false') {
          return html;
        }

        if (!html.includes(VIRTUAL_APP_CSS)) {
          return html;
        }

        console.log(
          `\n${chalk.bold.yellow('WARNING')}\n${chalk.yellow(
            `Referencing ${chalk.blue(VIRTUAL_APP_CSS)} in ${filename} is deprecated.\n`
          )}`
        );

        console.log(
          `The Broccoli CSS pipeline is deprecated. Vite apps should let Vite process\n` +
            `application CSS. Update the stylesheet link to ${chalk.blue('/app/styles/app.css')}.\n\n` +
            `See ${DEPRECATION_GUIDE}`
        );

        console.log('\nTo disable this warning set environment variable "EMBROIDER_WARN_VIRTUAL_APP_CSS" to "false"\n');

        return html;
      },
    },
  };
}
