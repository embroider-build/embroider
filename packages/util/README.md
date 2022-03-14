# @embroider/util

Utilities to help apps and addons with Embroider support.

## Compatibility

- Ember.js v3.13 or above
- Ember CLI v2.13 or above
- Node.js v10 or above

## Installation

```
ember install @embroider/util
```

## The Utilities

### `ensureSafeComponent`

This function aids you in eliminating un-analyzable usage of the `{{component}}` helper. For the full explanation of why and how you would do this, see [the Addon Author Guide](https://github.com/embroider-build/embroider/blob/main/ADDON-AUTHOR-GUIDE.md).

Example usage in Javascript:

```js
import { ensureSafeComponent } from '@embroider/util';
import Component from '@glimmer/component';
import DefaultTitleComponent from './default-title';

export default class extends Component {
  get title() {
    return ensureSafeComponent(this.args.title || DefaultTitleComponent, this);
  }
}
```

```hbs
<this.title />
```

Example usage in a template:

```hbs
{{#let (ensure-safe-component (or @title (component "default-title"))) as |Title|}}
  <Title />
{{/let}}
```

The first argument is allowed to be:

- a string. If we see a string, we will emit a deprecation warning because passing components-as-strings doesn't work safely under Embroider with `staticComponents` enabled. We will return a value that is safe to invoke (via angle brackets) on your current Ember version.
- a curried component definition (which is the kind of value you receive when someone does `<YourComponent @customThing={{component "fancy"}}/>`). These are returned unchanged, because they're always safe to invoke.
- a component class, in which case if your ember version does not yet support directly invoking component classes, we will convert it to a curried component definition for you.

In the Javascript version, you must pass a second argument that is any object with an owner (a `Component` instance works great).

## Contributing

See the [Contributing](CONTRIBUTING.md) guide for details.

## License

This project is licensed under the [MIT License](LICENSE.md).
