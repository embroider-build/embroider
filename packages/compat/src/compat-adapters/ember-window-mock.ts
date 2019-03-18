import V1Addon from "../v1-addon";
import { todo } from "@embroider/core/src/messages";

export default class extends V1Addon {
  /*
    The problem here is that you use the same import in both test and non-test,
    but it's supposed to behave differently. That is problematic, it should be
    replaced with APIs that explicitly import and install test behaviors from
    test code.

    For example, this addon could change so that:

        import { window } from 'ember-window-mock';

    continues to always provide a mockable object, but to enable the test
    behaviors you would also need to do:

        import { setup } from 'ember-window-mock/test-support';
        setup();

  */
  treeForAddon(): undefined {
    todo(`ember-window-mock's API can't work as a v2 package, so we're leaving the test code in all the time`);
    return undefined;
  }
}
