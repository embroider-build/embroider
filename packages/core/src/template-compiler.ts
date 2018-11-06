import stripBom from 'strip-bom';

export default function(compiler: { precompile: any }) {
  return function(moduleName: string, contents: string) {
    let compiled = compiler.precompile(
      stripBom(contents), {
        contents,
        moduleName
      }
    );
    return 'export default Ember.HTMLBars.template('+compiled+');';
  };
}
