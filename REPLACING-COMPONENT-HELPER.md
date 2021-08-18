# Replacing the Component Helper

Using the `{{component}}` helper can prevent your app or addon from being
statically analyzed, which will prevent you from taking advantage of
`staticComponents` and `splitAtRoutes`.

The exact rules for `{{component}}` are:

- it's OK to pass a string literal component name like `{{component "my-title-bar"}}`
- it's OK to pass a value wrapped in the ensure-safe-component helper from `@embroider/util`, like `{{component (ensure-safe-component this.titleBar) }}`
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

The first step is to switch to angle bracket invocation:

```hbs
<this.titleBar />
```

Now we eliminated the `{{component}}` helper. And this actually works, but with two big caveats:

- it only works reliably on Ember versions before 3.23, because we might get passed a string, and invoking a string via angle brackets was an accidental behavior that was never intended, and it's fixed in that release.
- and we haven't really solved the underlying problem, which is that we can sneakily convert strings into components in a way that lets them escape Embroider's analysis.

So we need another step. Add `@embroider/util` to your project, and use `ensureSafeComponent`:

```js
import Component from '@glimmer/component';
import { ensureSafeComponent } from '@embroider/util';

export default class extends Component {
  get titleBar() {
    return ensureSafeComponent(this.args.titleBar || 'default-title-bar', this);
  }
}
```

```hbs
<this.titleBar />
```

This now works even on newer Ember versions. If the user passes a string, it emits a deprecation warning while converting the value to an actual component definition so the angle bracket invocation works. This will help your users migrate away from passing strings to your component.

Notice also that if the user doesn't provide a component, we will trigger the deprecation warning by passing our own string `"default-title-bar"` into `ensureSafeComponent`. So we need one more step to clear this deprecation (and make our code truly understandable by embroider). Import the component class instead:

```js
import Component from '@glimmer/component';
import { ensureSafeComponent } from '@embroider/util';
import DefaultTitleBar from './default-title-bar';

export default class extends Component {
  get titleBar() {
    return ensureSafeComponent(this.args.titleBar || DefaultTitleBar, this);
  }
}
```

```hbs
<this.titleBar />
```

When `ensureSafeComponent` sees a component class, it converts it into a component definition so it can be safely invoked. In the future, we expect Ember to gain the ability to natively invoke component classes, at which point we can make `ensureSafeComponent` pass component classes through unchanged when it sees those Ember versions.

**Caution**: old-style components that have their template in `app/templates/components` instead of co-located next to their Javascript in `app/components` can't work correctly when discovered via their component class, because there's no way to locate the template. They should either port to being co-located (which is a simple mechanical transformation and highly recommended) or should import their own template and set it as `layout` as was traditional in addons before co-location was available.

## When you're passing a component to someone else

Here's an example `<Menu/>` component that accepts a `@titleBar=`. When the author of `<Menu/>` follows the steps from the previous section, if we try to call it like this:

```hbs
<Menu @titleBar="fancy-title-bar" />
```

we'll get a deprecation message like

> You're trying to invoke the component "fancy-title-bar" by passing its name as a string...

The simplest fix is to add the `{{component}}` helper:

```hbs
<Menu @titleBar={{component "fancy-title-bar"}} />
```

This is one of the two safe ways to use `{{component}}`, because we're passing it a **string literal**. String literals are safe because they are statically analyzable, so Embroider can tell exactly what component you're talking about.

But if instead you need anything other than a string literal, you'll need a different solution. For example, this is not OK:

```hbs
<Menu @titleBar={{component (if this.fancy "fancy-title-bar" "plain-title-bar") }} />
```

You can refactor this example into two uses with only string literals inside `{{component}}`, and that makes it OK:

```hbs
<Menu @titleBar={{if this.fancy (component "fancy-title-bar") (component "plain-title-bar") }} />
```

But if your template is getting complicated, you can always move to Javascript and import the components directly:

```js
import Component from '@glimmer/component';
import FancyTitleBar from './fancy-title-bar';
import PlainTitleBar from './plain-title-bar';

export default class extends Component {
  get whichComponent() {
    return this.fancy ? FancyTitleBar : PlainTitleBar;
  }
}
```

```hbs
<Menu @titleBar={{ this.whichComponent }} />
```

Note that we didn't use `ensureSafeComponent` here because we already stipulated
that `<Menu/>` is itself using `ensureSafeComponent`, and so `<Menu/>`'s public
API accepts component classes _or_ component definitions. But if you were unsure
whether `<Menu/>` accepts classes, it's always safe to run them through
`ensureSafeComponent` yourself first (`ensureSafeComponent` is idempotent).

## When you need to curry arguments onto a component

A common pattern is yielding a component with some curried arguments:

```hbs
{{yield (component "the-header" mode=this.mode) }}
```

In this particular example, we're using a **string literal** for the component name, which makes it OK, and you don't need to change it.

But what if you need to curry arguments onto a component somebody else has passed you?

```hbs
{{yield (component this.args.header mode=this.mode) }}
```

Because we're only adding a `mode=` argument to this component and not invoking it, we can't switch to angle bracket invocation. Instead, we can wrap our component in the `ensure-safe-component` helper from the `@embroider/util` package:

```hbs
{{yield (component (ensure-safe-component this.args.header) mode=this.mode) }}
```

This works the same as the Javascript `ensureSafeComponent` function, and by appearing **directly** as the argument of the `{{component}}` helper, Embroider will trust that this spot can't unsafely resolve a string into a component.

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

```js
import Component from '@glimmer/component';
import { importSync } from '@embroider/macros';
import { ensureSafeComponent } from '@embroider/util';

export default class extends Component {
  get whichComponent() {
    let module = importSync(`./feed-items/${this.args.model.type}`);
    return ensureSafeComponent(module.default, this);
  }
}
```

```hbs
<this.whichComponent @feedItem={{@model}} />
```

This code will cause every modules under the `./feed-items/` directory to be eagerly included in your build.

To instead _lazily_ include them, refactor to use asynchronous `import()` instead of `importSync`. BUT CAUTION: using `import()` of your own app code is one of the few things that works _only_ under Embroider and not in classic builds, so don't do it until you have committed to Embroider.

## When using one-off components in tests

If you find yourself defining custom, one-off components to be used in your tests, you might have been using a syntax like this:

```js
import { setComponentTemplate } from '@ember/component';
import Component from '@glimmer/component';

test('my test', async function(assert) {
  class TestComponent extends Component {}

  setComponentTemplate(
    hbs`Test content: {{@message}}`,
    TestComponent
  );

  this.owner.register('component:test-component', TestComponent);

  await render(hbs`
    <MyComponent @display={{component 'test-component'}} />
  `);
});
```

This will fail, as `test-component`cannot be statically found. Instead, you can directly reference the component class:

```js
import { setComponentTemplate } from '@ember/component';
import Component from '@glimmer/component';

test('my test', async function(assert) {
  class TestComponent extends Component {}

  setComponentTemplate(
    hbs`Test content: {{@message}}`,
    TestComponent
  );

  this.testComponent = TestComponent;

  await render(hbs`
    <MyComponent @display={{this.testComponent}} />
  `);
});
```