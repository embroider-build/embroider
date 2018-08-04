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

export default function main(){
  return {
    visitor: {
      'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'(path, { opts }) {
        const {source} = path.node;
        if (source === null) {
          return;
        }
        let sourceFileName = path.hub.file.opts.filename;
        source.value = maybeRelativize(source.value, sourceFileName, opts);
      },
    }
  };
}

(main as any).baseDir = function() {
  return join(__dirname, '..');
};
