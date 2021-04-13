import V1Addon from '../../v1-addon';

export default class VerticalCollection extends V1Addon {
  // `@html-next/vertical-collection` does some custom Babel stuff, so we'll let it do it's own thing
  customizes(...names: string[]) {
    return super.customizes(...names.filter(n => n !== 'treeForAddon'));
  }
}
