import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import type { IncomingMessage } from 'http';
// @ts-ignore no upstream types
import SimpleDOM from 'simple-dom/dist/commonjs/es5/index.js';

export function ssrPlugin(): Plugin {
  return {
    name: 'configure-server',
    configureServer(server) {
      server.middlewares.use('/', async (_req, res, next) => {
        // vite's types don't seem to be incorporating a correct version of this
        // type.
        let req = _req as IncomingMessage;

        if (!(req.headers['accept']?.split(',') ?? []).includes('text/html')) {
          return next();
        }

        const url = req.url!;

        try {
          let template = fs.readFileSync(path.resolve('index.html'), 'utf-8');
          template = await server.transformIndexHtml('/index.html', template, url);
          const { default: App } = await server.ssrLoadModule('/app/app-ssr.js');
          const appHtml = await render(url, App);
          const html = template.replace(`<!--ssr-outlet-->`, appHtml);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html');
          res.end(html);
        } catch (e) {
          server.ssrFixStacktrace(e);
          next(e);
        }
      });
    },
  };
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

const HTMLSerializer = new SimpleDOM.HTMLSerializer(SimpleDOM.voidMap);

async function render(url: string, App: any) {
  let instance = App.create({
    autoboot: false,
    modulePrefix: 'spike',
  });
  let bootOptions = buildBootOptions();
  await instance.visit(url, bootOptions);
  let html = await HTMLSerializer.serializeChildren(bootOptions.document.body);
  return html;
}
