import packageName from './package-name';
import { join } from 'path';

function maybeRelativize(specifier, sourceFileName, opts) {
  let name = packageName(specifier);
  if (name && name === opts.ownName) {
    let depth = sourceFileName.split('/').length;
    let relative;
    if (depth === 1) {
      relative = ['.'];
    } else {
      relative = [];
      while (depth > 1) {
        relative.push('..');
        depth -= 1;
      }
    }
    return specifier.replace(name, relative.join('/'));
  } else {
    return specifier;
  }
}

function makeHBSExplicit(specifier, _) {
  // as an optimization, we only detect relative paths to templates. That is by
  // far the common case, and it's probably much cheaper to check than full
  // package resolution.
  //
  // we can revisit this if it turns out there are lots of examples in the wild
  // of addons importing templates from other packages.
  if (specifier[0] === '.') {
    // this is gross, but unforunately we can't get enough information to locate
    // the original file on disk in order to go check whether it's really
    // referring to a template. To fix this, we would need to modify
    // broccoli-babel-transpiler, but a typical app has many many copies of that
    // library at various different verisons (a symptom of the very problem
    // ember-cli-vanilla exists to solve).
    if (/\btemplates\b/.test(specifier) && !/\.hbs$/.test(specifier)) {
      return specifier + '.hbs';
    }
  }
  return specifier;
}

export default function main(){
  return {
    visitor: {
      'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'(path, { opts }) {
        const {source} = path.node;
        if (source === null) {
          return;
        }
        let sourceFileName = path.hub.file.opts.filename;
        let specifier = maybeRelativize(source.value, sourceFileName, opts);
        source.value = makeHBSExplicit(specifier, sourceFileName);
      },
    }
  };
}

(main as any).baseDir = function() {
  return join(__dirname, '..');
};
