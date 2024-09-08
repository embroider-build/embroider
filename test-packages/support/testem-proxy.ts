import httpProxy from 'http-proxy';
import type { Application } from 'express';

/*
  This can be installed as a testem middleware to make testem run against an
  arbitrary real webserver at targetURL.

  It allows testem to handle the well-known testem-specific paths and proxies
  everything else, while rewriting the testem-added prefix out of your
  "/tests/index.html" URL.
*/

export function testemProxy(targetURL: string) {
  return function testemProxyHandler(app: Application) {
    const proxy = httpProxy.createProxyServer({
      changeOrigin: true,
      ignorePath: true,
    });

    proxy.on('error', (err, _req, res: any) => {
      res && res.status && res.status(500).json(err);
    });

    app.all('*', (req, res, next) => {
      let url = req.url;
      if (url === '/testem.js' || url.startsWith('/testem/')) {
        return next();
      }
      let m = /^(\/\d+)\/tests\/index.html/.exec(url);
      if (m) {
        url = url.slice(m[1].length);
      }
      proxy.web(req, res, { target: targetURL + url });
    });
  };
}
