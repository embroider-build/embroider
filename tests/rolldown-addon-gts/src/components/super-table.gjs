import Component from '@glimmer/component';

export class SuperTable extends Component {
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
