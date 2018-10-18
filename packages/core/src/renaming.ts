
export function renamed(addons) {
  let output = {};
  for (let addon of addons) {
    if (addon.name !== addon.pkg.name) {
      output[addon.name] = addon.pkg.name;
    }
  }
  return output;
}
