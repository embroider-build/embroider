import Application from '@ember/application';
import Resolver from 'ember-resolver';
import SimpleDOM from 'simple-dom/dist/commonjs/es5/index.js';
import { precompileTemplate } from '@ember/template-compilation';

const HTMLSerializer = new SimpleDOM.HTMLSerializer(SimpleDOM.voidMap);

class App extends Application {
  Resolver = Resolver.withModules({
    'spike/templates/application': precompileTemplate(`yay spike`),
  });
}

function buildBootOptions() {
  let doc = new SimpleDOM.Document();
  let rootElement = doc.body;
  return {
    isBrowser: false,
    document: doc,
    rootElement,
    shouldRender: true,
  };
}

export async function render(url) {
  let instance = App.create({
    autoboot: false,
    modulePrefix: 'spike',
  });
  let bootOptions = buildBootOptions();
  await instance.visit(url, bootOptions);
  let html = await HTMLSerializer.serializeChildren(bootOptions.document.body);
  return html;
}
