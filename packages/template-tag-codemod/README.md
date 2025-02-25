# @embroider/template-tag-codemod

This codemod converts all usage of non-strict handlebars in an Ember app to the newer, strict Template Tag syntax. It uses the Embroider build infrastructure to do build-time resolution of all components, helpers, and modifiers so that you don't need to figure them out yourself.

## Instructions

1. Decide what options you will want to pass to the codemod. See "Important Options" below.
1. Ensure your app has the prerequisites to use Template Tag. See "Prerequisites" below.
4. Start with clean source control. We're going to mutate all your files. Use git to give you control over what changed.
5. Run the codemod via `npx @embroider/template-tag-codemod YOUR_OPTIONS_HERE`
6. Use `prettier` to apply nice formatting to the results.


## Important Options

This section explains the important options you should know about before deciding when and how to run the codemod. Additional options are available via interactive `--help`.

### --relativeLocalPaths

By default, imports within your own app will use relative paths *with* a file extension. This is Node's standard for valid ES modules and it is the most future-proof output, since automatically mapping file extensions can be complex.

But there are several reasons you might prefer the traditional extensionless imports from the app's module namespace instead
 - the classic build requires it
 - `@embroider/webpack` 3.x does not support using the true file extension of some file types like .gjs

To get that behavior you can pass `--relativeLocalPaths false`.

```js
// relativeLocalPaths true (default):
import TheButton from './components/the-button.js';

// relativeLocalpaths false:
import TheButton from 'your-app/components/the-button';
```

### --nativeRouteTemplates

Starting at Ember 6.3.0, your route templates (`app/templates/**/*.hbs`) are allowed to directly export components, meaning you can write them as `.gjs` or `.gts` files. The codemod will produce this output by default.

However, if you want support for earlier Ember versions, you can pass `--nativeRouteTemplates false` and install the `ember-route-template` addon.

```js
// app/templates/example.gjs

// nativeRouteTemplates true (default)
import MessageBox from '../components/message-box.js';
<template>
  <MessageBox>Hello world</MessageBox>
</template>

// nativeRouteTemplates false
import MessageBox from '../components/message-box.js';
import RouteTemplate from 'ember-route-template'
export default RouteTemplate(
  <template>
    <MessageBox>Hello world</MessageBox>
  </template>
)
```
### --nativeLexicalThis

This flag is a workaround for a bug in Ember < 6.4.0 (still unreleased at the time of writing). These versions have a bug that prevents you from accessing lexically scoped `this` in template tags that are used as expressions. The typical use case for this is in rendering tests:

```js
// Input example:
test("some test", function(assert) {
  this.set('message', 'hi');
  render(hbs`{{this.message}}`);
})

// nativeLexicalThis true (default)
test("some test", function(assert) {
  this.set('message', 'hi');
  render(<template>{{this.message}}</template>);
})

// nativeLexicalThis false
test("some test", function(assert) {
  this.set('message', 'hi');
  const self = this;
  render(<template>{{self.message}}</template>);
})
```

If you want your code to work on Ember < 6.4.0, pass `--nativeLexicalThis false`. If you'd rather not pollute your tests with these extra lines, upgrade Ember first and keep the default value of the flag.

### --defaultFormat

When converting an existing `.js` file to template tag, the codemod always produces a `.gjs` output file. When converting an existing `.ts` file, the codemod always produces a `.gts` file. But there are ambiguous cases:
 - a component that has only an `.hbs` with no corresponding `.js` or `.ts`.
 - a route template, which is traditionally always a standalone `.hbs` file

In these cases, the codemod's output is controlled by `--defaultFormat`.

`--defaultFormat gjs` is the default. 

Pass `--defaultFormat gts` instead if you prefer to produce typescript. Also see the interactive docs for `--routeTemplateSignature` and `--templateOnlyComponentSignature` if you want to customize the default type signatures emitted by the codemod. 

## Prerequisites

1. Your build must support Template Tag. 

    On classic builds or on `@embroider/core` 3.x this means installing the `ember-template-imports` addon.

    On `@embroider/core` 4.x it is natively supported.

    To confirm this step worked, you should be able to write a new component in a .gjs file and see it working in your app.

2. Your prettier configuration should support Template Tag. This was added to the default Ember app blueprint at ember-cli 6.1.0, but you can also set it up manually on earlier blueprint versions. You need the dependency `prettier-plugin-ember-template-tag` and the configuration in `.prettierrc.js` that goes with it.

3. Your ESLint configuration should support Template Tag. This was added to the default Ember app blueprint at ember-cli 6.1.0, but you can also set it up manually on earlier blueprint versions. If you're using ember-cli 6.1.0 as a guide, note that the whole eslint configuration was upgraded to the newer flat-config style. To use Template Tag support in the older style of config, you need a section like:
 
    ```
    overrides: [
      {
        files: ['**/*.{gts,gjs}'],
        parser: 'ember-eslint-parser',
      },
    ```

    And the `ember-eslint-parser` dependency.

4. Upgrade @ember/test-helpers to >= 5.0.1 (because you may need [this feature](https://github.com/emberjs/ember-test-helpers/pull/1527/)).

5. If you're planning to use `--nativeRouteTemplates false` to support Ember < 6.3.0, make sure you have installed the `ember-route-template` addon.

# Known Compatibility Issues

## ember-css-modules

If the codemod crashes with:

```BuildError: BroccoliBridge placeholder 'modules' was never fulfilled.```

this is probably because you have [ember-css-modules](https://github.com/salsify/ember-css-modules), and it does extremely cursed things in the classic build pipeline. You can work around this problem by **temporarily removing it from your package.json** while you run the codemod.
