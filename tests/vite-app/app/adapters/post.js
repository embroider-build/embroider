import JSONAPIAdapter from '@ember-data/adapter/json-api';
export default class extends JSONAPIAdapter {
  urlForFindRecord(/* id, modelName */) {
    return `${super.urlForFindRecord(...arguments)}.json`;
  }
}
