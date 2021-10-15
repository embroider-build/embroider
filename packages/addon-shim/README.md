# @embroider/addon-shim

Makes a v2 addon work like a v1 addon so it can be used in a classic (non-Embroider) app.

This allows addons to update to v2 without waiting for all their users to upgrade to Embroider.

## Compatibility

- Ember.js v3.13 or above
- Ember CLI v2.13 or above
- Node.js v10 or above

## Installation

```
ember install @embroider/addon-shim
```

## Usage

To use it:

1. Be prepared to do a semver major release of your addon, because the shim demands that the app has ember-auto-import >= 2.
2. Create an `addon-main.js` file that requires and invokes the shim:

   ```js
   const { addonV1Shim } = require('@embroider/addon-shim');
   module.exports = addonV1Shim(__dirname);
   ```

3. Update your `package.json` to point at addon-main.js:

   ```json
   {
     "ember-addon": {
       "version": 2,
       "type": "addon",
       "main": "addon-main.js"
     }
   }
   ```

### Shim Options

**disabled**: this optional argument lets you control whether your shimmed addon will emit `'app-js'` and `'public-assets'` into non-embroider builds. Example:

```js
module.exports = addonV1Shim(__dirname, {
  disabled(options) {
    let welcomeConfig = options['ember-welcome-page'] || {};
    return process.env.EMBER_ENV === 'production' && !welcomeConfig.enabled;
  },
});
```

This option _only_ works in non-embroider builds. Under embroider, apps just won't import the parts of your addon they don't want.

## Contributing

See the top-level CONTRIBUTING.md in this monorepo.

## License

This project is licensed under the MIT License.
