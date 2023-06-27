import JSONAPIAdapter from '@ember-data/adapter/json-api';

export default class ApplicationAdapter extends JSONAPIAdapter {
  urlForFindAll(modelName) {
    const path = this.pathForType(modelName);
    return `/${path}/all.json`;
  }
}
