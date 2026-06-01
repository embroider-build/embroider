import Component from '@glimmer/component';

export interface SuperTableSignature<T> {
  // We have a `<table>` as our root element
  Element: HTMLTableElement;
  // We accept an array of items, one per row
  Args: {
    items: Array<T>;
  };
  // We accept two named blocks: a parameter-less `header` block
  // and a `row` block which will be invoked with each item and
  // its index sequentially.
  Blocks: {
    header: [];
    row: [item: T, index: number];
  };
}

export class SuperTable<T> extends Component<SuperTableSignature<T>> {
  get label() {
    return 'label';
  }

  <template>
    <table ...attributes aria-label={{this.label}}>
      {{#if (has-block 'header')}}
        <thead>
          <tr>{{yield to='header'}}</tr>
        </thead>
      {{/if}}

      <tbody>
        {{#each @items as |item index|}}
          <tr>{{yield item index to='row'}}</tr>
        {{/each}}
      </tbody>
    </table>
  </template>
}
