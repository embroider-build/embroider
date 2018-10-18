import stripBom from 'strip-bom';

export default function(compiler) {
  return function(moduleName, contents) {
    let compiled = compiler.precompile(
      stripBom(contents), {
        contents,
        moduleName
      }
    );
    return 'export default Ember.HTMLBars.template('+compiled+');';
  };
}
