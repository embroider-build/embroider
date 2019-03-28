declare module 'ember-cli/lib/broccoli/ember-app' {
  export default class EmberApp {
    constructor(...optLists: any[]);
  }
}

declare module 'ember-cli/lib/broccoli/ember-addon' {
  export default class EmberAddon {
    constructor(...optLists: any[]);
  }
}

declare module 'ember-cli/lib/models/project' {
  export default class Project {
    constructor(root: string, pkg: any, ui: any, cli: any);
  }
}

declare module 'ember-cli/lib/models/instrumentation' {
  export default class Instrumentation {
    constructor(opts: any);
  }
}

declare module 'ember-cli/lib/models/package-info-cache' {
  export default class PacakgeInfoCache {
    constructor(ui: any);
  }
}
