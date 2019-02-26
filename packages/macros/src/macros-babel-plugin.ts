interface State {
}

export default function main({ types: t} : { types: any }){
  return {
    visitor: {
      ReferencedIdentifier(path: any, state: State) {
        if (path.referencesImport('@embroider/macros', 'modulePresent')) {
          let r = t.identifier('yup');
          path.replaceWith(r);
        }
      },
    }
  };
}
