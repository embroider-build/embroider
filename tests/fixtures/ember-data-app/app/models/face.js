import Model, { attr } from '@ember-data/model';

export default class FaceModel extends Model {
  @attr() name;
}
