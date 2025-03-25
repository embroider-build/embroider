# Replacing the Component Helper

Using the `{{component}}` helper in traditional loose handlebars template can prevent your app or addon from being
statically analyzed, which will prevent you from taking advantage of
`staticComponents` and `splitAtRoutes`.

The exact rules for `{{component}}` are:

- it's always OK to use `{{component}}` in Template Tag (GJS) format because that format follows the [strict handlebars](https://github.com/emberjs/rfcs/blob/7d2ff960370faa7e70f39c6a13e43536f40e3048/text/0496-handlebars-strict-mode.md) rules, which forbid the component helper from dynamically converting strings into component definitions.
- it's OK to pass a string literal component name like `{{component "my-title-bar"}}`
- any other syntax in the first argument to `{{component ...}}` is NOT OK

The following sections explain what to do in the common scenarios where you might have unsafe usage of the `{{component}}` helper.

## When you're invoking a component you've been given

Here's an example of a component that accepts an optional `@titleBar=` argument:

```js
import Component from '@glimmer/component';

export default class extends Component {
  get titleBar() {
    return this.args.titleBar || 'default-title-bar';
  }
}
```

```hbs
{{component this.titleBar}}
```

The solution is to combine the JS and HBS files into a single GJS file:

```gjs
import Component from '@glimmer/component';
import DefaultTitleBar from './default-title-bar';

export default class extends Component {
  <template>
    <this.titleBar />
  </template>
  
  get titleBar() {
    return this.args.titleBar || DefaultTitleBar;
  }
}
```

## When you're passing a component to someone else

Here's an example `<Menu/>` component that accepts a `@titleBar=`. When the author of `<Menu/>` follows the steps from the previous section, if we try to call it like this:

```hbs
<Menu @titleBar='fancy-title-bar' />
```

it will no longer work, because `<Menu />` no longer accepts a string.

We should import the FancyTitleBar component directly and pass it:

```gjs
import FancyTitleBar from './fancy-title-bar';
<template>
  <Menu @titleBar={{FancyTitleBar}} />
</template>
```

## When you need to curry arguments onto a component

A common pattern is yielding a component with some curried arguments:

```hbs
{{yield (component 'the-header' mode=this.mode)}}
```

In this particular example, we're using a **string literal** for the component name, which makes it OK, and you don't need to change it.

But what if you need to curry arguments onto a component somebody else has passed you?

```hbs
{{yield (component this.args.header mode=this.mode)}}
```

In this case, you should convert your component to Template Tag:

```gjs
<template>{{yield (component this.args.header mode=this.mode)}}</template>
```

That makes it safe because Template Tag is always safe, because it follows the strict handlebars rules.


## When you're matching a large set of possible components

Another common pattern is choosing dynamically from within a family of
components:

```js
import Component from '@glimmer/component';

export default class extends Component {
  get whichComponent() {
    return `my-app/components/feed-items/${this.args.model.type}`;
  }
}
```

```hbs
{{component this.whichComponent feedItem=@model}}
```

You can replace this with native `import()` or the `importSync()` macro, because
they support dynamic segments (for full details on what exactly is supported,
see <a
href="https://github.com/emberjs/rfcs/blob/73685c28378118bebb5e359b80e00b839a99f622/text/0507-embroider-v2-package-format.md#supported-subset-of-dynamic-import-syntax">"Supported
subset of dynamic import syntax" in the Embroider V2 Package RFC</a>.

In this case, we're refactoring existing synchronous code so we can use
`importSync`:

```gjs
import Component from '@glimmer/component';
import { importSync } from '@embroider/macros';

export default class extends Component {
  get whichComponent() {
    let module = importSync(`./feed-items/${this.args.model.type}`);
    return module.default;
  }

  <template>
    <this.whichComponent @feedItem={{@model}} />
  </template>
}
```

This code will cause every module under the `./feed-items/` directory to be eagerly included in your build.

To instead _lazily_ include them, refactor to use asynchronous `import()` instead of `importSync`. BUT CAUTION: using `import()` of your own app code is one of the few things that works _only_ under Embroider and not in classic builds, so don't do it until you have committed to Embroider.

## When using one-off components in tests

If you find yourself defining custom, one-off components to be used in your tests, you might have been using a syntax like this:

```js
import { setComponentTemplate } from '@ember/component';
import Component from '@glimmer/component';

test('my test', async function (assert) {
  class TestComponent extends Component {}

  setComponentTemplate(hbs`Test content: {{@message}}`, TestComponent);

  this.owner.register('component:test-component', TestComponent);

  await render(hbs`
    <MyComponent @display={{component 'test-component'}} />
  `);
});
```

This will fail, as `test-component`cannot be statically found. Instead, you can directly reference the component class using Template Tag:

```js
import { setComponentTemplate } from '@ember/component';
import Component from '@glimmer/component';

test('my test', async function (assert) {
  class TestComponent extends Component {
    <template>Test content: {{@message}}</template>
  }

  await render(<template>
    <MyComponent @display={{TestComponent}} />
  </template>);
});
```
