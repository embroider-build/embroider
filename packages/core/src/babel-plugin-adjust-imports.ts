import packageName from './package-name';
import { join, relative, dirname } from 'path';
import { NodePath } from '@babel/traverse';
import { Program, importDeclaration, stringLiteral } from '@babel/types';

interface State {
  emberCLIVanillaJobs: Function[];
  generatedRequires: Set<Node>;
  opts: {
    ownName?: string;
    basedir?: string;
    rename?: {
      [fromName: string]: string;
    },
    extraImports?: {
      absPath: string,
      target: string,
    }[]
  };
}

export type Options = State["opts"];

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

export default function main({ types: t} : { types: any }){
  return {
    visitor: {
      Program: {
        enter: function(path: NodePath<Program>, state: State) {
          state.emberCLIVanillaJobs = [];
          state.generatedRequires = new Set();
          if (state.opts.extraImports) {
            for (let { absPath, target } of state.opts.extraImports) {
              if (absPath === path.hub.file.opts.filename) {
                path.node.body.push(importDeclaration([], stringLiteral(target)));
              }
            }
          }
        },
        exit: function(_: any, state: State) {
          state.emberCLIVanillaJobs.forEach(job => job());
        }
      },
      ReferencedIdentifier(path: any, state: State) {
        if (path.node.name === 'require' && !state.generatedRequires.has(path.node) && !path.scope.hasBinding('require')) {
          // any existing bare "require" should remain a *runtime* require, so
          // we rename it to window.require so that final stage packagers will
          // leave it alone.
          path.replaceWith(
            t.memberExpression(t.identifier('window'), path.node)
          );
        }
        if (path.referencesImport('@embroider/core', 'require')) {
          // whereas our own explicit *build-time* require (used in the
          // generated entrypoints) gets rewritten to a plain require so that
          // final stage packagers *will* see it.
          let r = t.identifier('require');
          state.generatedRequires.add(r);
          path.replaceWith(r);
        }
      },
      'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'(path: any, state: State) {
        let { opts, emberCLIVanillaJobs } = state;
        const { source } = path.node;
        if (source === null) {
          return;
        }

        // strip our own build-time-only require directive
        if (source.value === '@embroider/core' &&
            path.node.specifiers.length === 1 &&
            path.node.specifiers[0].imported.name === 'require'
        ) {
          emberCLIVanillaJobs.push(() => path.remove());
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
