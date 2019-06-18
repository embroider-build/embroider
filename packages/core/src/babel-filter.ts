import PackageCache from './package-cache';

export default function babelFilter(appRoot: string) {
  return function shouldTranspileFile(filename: string) {
    if (!isJS(filename)) {
      // quick exit for non JS extensions
      return false;
    }

    let owner = PackageCache.shared('embroider-stage3').ownerOfFile(filename);

    // Not owned by any NPM package? Weird, leave it alone.
    if (!owner) {
      return false;
    }

    // Owned by our app, so use babel. Our own module gets copied into the root of
    // the app before it runs, which is why __dirname works here.
    if (owner.root === appRoot) {
      return true;
    }

    // Lastly, use babel on ember addons, but not other arbitrary libraries.
    // This is more conservative and closer to today's ember-cli behavior,
    // although eventually we are likely to want an option to transpile
    // everything.
    return owner.packageJSON.keywords && owner.packageJSON.keywords.includes('ember-addon');
  };
}

function isJS(filename: string) {
  return /\.js$/i.test(filename);
}
