export default {
  plugins: [
    [
      '@babel/plugin-transform-typescript',
      {
        allExtensions: true,
        allowDeclareFields: true,
        onlyRemoveTypeImports: true,
      },
    ],
    ['babel-plugin-ember-template-compilation'],
  ],

  generatorOpts: {
    compact: false,
  },
};
