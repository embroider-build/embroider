---
'@embroider/shared-internals': major
---

The second argument to `hbsToJS()` has changed formats to accomodate new additional options.

```diff
import { hbsToJS } from '@embroider/shared-internals';

-hbsToJS('<SomeTemplate />', 'my-component.hbs');
+hbsToJS('<SomeTemplate />', { moduleName: 'my-component.hbs' });
```
