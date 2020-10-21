import FakeOther from 'fake-module';

const {
  foo, bar
} = FakeOther;

export default function exampleAddonFunction() {
  if (foo.isFoo && bar.isBar) {
    return true;
  } else {
    throw new Error('fake-module is not properly importable');
  }
}
