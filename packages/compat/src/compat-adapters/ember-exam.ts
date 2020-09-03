import V1Addon from '../v1-addon';
import Filter from 'broccoli-persistent-filter';

class Awk extends Filter {
  searchReplaceObj: { [key: string]: string };

  constructor(inputNode: any, searchReplaceObj: { [key: string]: string }) {
    super(inputNode, {} as any);
    this.searchReplaceObj = searchReplaceObj;
  }

  processString(content: string) {
    let modifiedContent = content;

    Object.entries(this.searchReplaceObj).forEach(([search, replace]) => {
      modifiedContent = modifiedContent.replace(search, replace);
    });

    return modifiedContent;
  }
}

export default class extends V1Addon {
  get v2Tree() {
    return new Awk(super.v2Tree, {
      "require('./ember-exam-qunit-test-loader');":
        "require('ember-exam/test-support/-private/ember-exam-qunit-test-loader');",
      "require('./ember-exam-mocha-test-loader')":
        "require('ember-exam/test-support/-private/ember-exam-mocha-test-loader');",
    });
  }
}
