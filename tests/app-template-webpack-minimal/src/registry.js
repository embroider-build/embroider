import Router from './router.js';
import PageTitleService from 'ember-page-title/services/page-title';

const appName = `app-template-webpack-minimal`;

// The vite minimal app uses `import.meta.glob(..., { eager: true })` here.
// That's a Vite/Rollup feature; the webpack-native ESM equivalent is
// `import.meta.webpackContext` (`require.context` is CJS-only and isn't
// available in a `"type": "module"` app). Each context's keys are relative to
// the context dir (e.g. `./application.gjs`), so we re-prefix with the logical
// sub-namespace (templates/services/routes) to match the resolver names
// ember-resolver expects, exactly like the vite version's glob keys did.
function contextEntries(context, namespace) {
  return Object.fromEntries(
    context
      .keys()
      .map(key => [`${appName}/${namespace}/` + key.replace(/^\.\//, '').replace(/\.g?(j|t)s$/, ''), context(key)])
  );
}

/**
 * A global registry is needed until:
 * - Services can be referenced via import paths (rather than strings)
 * - we design a new routing system
 */
const resolverRegistry = {
  ...contextEntries(
    import.meta.webpackContext('./templates', { recursive: true, regExp: /\.(?:gjs|gts|js|ts)$/ }),
    'templates'
  ),
  ...contextEntries(import.meta.webpackContext('./services', { recursive: true, regExp: /\.(?:js|ts)$/ }), 'services'),
  ...contextEntries(import.meta.webpackContext('./routes', { recursive: true, regExp: /\.(?:js|ts)$/ }), 'routes'),
  [`${appName}/router`]: Router,
};

export const registry = {
  ...resolverRegistry,
  [`${appName}/services/page-title`]: PageTitleService,
};
