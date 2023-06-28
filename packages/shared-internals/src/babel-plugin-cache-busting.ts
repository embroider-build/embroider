import { readJSONSync } from 'fs-extra';

export default function makePlugin(): any {
  // Dear future @rwjblue,
  //
  // This plugin exists as a sentinel plugin which has no behavior, but
  // provides a position in the babel configuration to include cache busting
  // meta-data about other plugins. Specifically their versions.
  //
  // Yours sincerely,
  // Contributor
  return {};
}

export const pluginPath = __filename;
export const version = readJSONSync(`${__dirname}/../package.json`);
