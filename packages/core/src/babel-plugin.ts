import packageName from './package-name';
import { join, relative, dirname } from 'path';

interface State {
  emberCLIVanillaJobs: Function[];
  opts: {
    ownName?: string;
    basedir?: string;
    rename: {
      [fromName: string]: string;
    }
  };
}

function adjustSpecifier(specifier: string, sourceFileName: string, opts: State["opts"]) {
  let name = packageName(specifier);
  if (name && name === opts.ownName) {
    let fullPath = specifier.replace(name, opts.basedir || '.');
    let relativePath = relative(dirname(sourceFileName), fullPath);
    if (relativePath[0] !== '.') {
      relativePath = `./${relativePath}`;
    }
    return relativePath;
  } else if (name && opts.rename && opts.rename[name]) {
    return specifier.replace(name, opts.rename[name]);
  } else {
    return specifier;
  }
}

function makeHBSExplicit(specifier: string, _: string) {
  // this is gross, but unforunately we can't get enough information to locate
  // the original file on disk in order to go check whether it's really
  // referring to a template. To fix this, we would need to modify
  // broccoli-babel-transpiler, but a typical app has many many copies of that
  // library at various different verisons (a symptom of the very problem
  // embroider exists to solve).
  if (/\btemplates\b/.test(specifier) && !/\.hbs$/.test(specifier)) {
    return specifier + '.hbs';
  }
  return specifier;
}

export default function main(){
  return {
    visitor: {
      Program: {
        enter: function(_: any, state: State) {
          state.emberCLIVanillaJobs = [];
        },
        exit: function(_: any, state: State) {
          state.emberCLIVanillaJobs.forEach(job => job());
        }
      },
      'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'(path: any, state: State) {
        let { opts, emberCLIVanillaJobs } = state;
        const {source} = path.node;
        if (source === null) {
          return;
        }
        let sourceFileName = path.hub.file.opts.filename;
        let specifier = adjustSpecifier(source.value, sourceFileName, opts);
        specifier = makeHBSExplicit(specifier, sourceFileName);
        if (specifier !== source.value) {
          emberCLIVanillaJobs.push(() => source.value = specifier);
        }
      },
    }
  };
}

(main as any).baseDir = function() {
  return join(__dirname, '..');
};
