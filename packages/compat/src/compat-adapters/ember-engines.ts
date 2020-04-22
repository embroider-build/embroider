import V1Addon from '../v1-addon';
import Filter from 'broccoli-persistent-filter';

class Awk extends Filter {
  search: string;
  replace: string;
  constructor(inputNode: any, search: string, replace: string) {
    super(inputNode, {} as any);
    this.search = search;
    this.replace = replace;
  }
  processString(content: string) {
    return content.replace(this.search, this.replace);
  }
}

export default class extends V1Addon {
  get v2Tree() {
    // dont allow ember-engines to reopen the router as we are doing things with it.
    // this simple deletes the import so the reopen doesn't happen
    return new Awk(super.v2Tree, `import '../-private/router-ext';`, '');
  }
}
