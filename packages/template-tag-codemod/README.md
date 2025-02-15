# @embroider/template-tag-codemod

This codemod converts all usage of non-strict handlebars in an Ember app to the newer, strict Template Tag syntax. It uses the Embroider build infrastructure to do build-time resolution of all components, helpers, and modifiers so that you don't need to figure them out yourself.

## Instructions

1. Ensure your app has support for Template Tag, and that you can write a new component in .gjs (or .gts if you're using typescript) format and it all works.
2. Ensure your prettier setup supports .gjs format (and .gts, if you're using typescript). This is not strictly necessary, but the codemod assumes you will leave formatting up to another tool like prettier after it runs.
3. Upgrade @ember/test-helpers to >= 5.0.1 (because you may need [this feature](https://github.com/emberjs/ember-test-helpers/pull/1527/)).
4. Decide what options you will want to pass to the codemod. See "Options" below.
5. Start with clean source control. We're going to mutate all your files. Use git to give you control over what changed.
5. Run the codemod via `npx @embroider/template-tag-codemod YOUR_OPTIONS_HERE`
6. Use `prettier` to apply nice formatting to the results.

## Options

This section explains the important options you should know about before deciding when and how to run the codemod. Additional options are available via interactive `--help`.

### --relativeLocalPaths

By default, imports within your own app will use relative paths *with* a file extension. This is Node's standard for valid ES modules and it is the most future-proof output, since automatically mapping file extensions can be complex.

But if you're using the classic build, or if you prefer the traditional extensionless imports from the app's name, you can pass `--relativeLocalPaths false`.

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
