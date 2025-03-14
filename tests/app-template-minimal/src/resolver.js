export class Resolver {
  #modules = new Map();
  #plurals = new Map();

  constructor(modules, plurals = undefined) {
    this.addModules(modules);
    if (plurals) {
      for (let [singular, plural] of Object.entries(plurals)) {
        this.#plurals.set(singular, plural);
      }
    }
  }

  create() {
    // The ember Application expects to a receive a class but there's no reason
    // not to just give it our instance and let us "create" ourself when asked.
    // We don't have any state that should be reset between, for example, test
    // runs. We represent a real set of ES modules, and ES modules never unload
    // and never change.
    return this;
  }

  addModules(modules) {
    for (let [moduleName, module] of Object.entries(modules)) {
      this.#modules.set(this.#normalizeModule(moduleName), module);
    }
  }

  #normalizeModule(moduleName) {
    return moduleName.replace(fileExtension, '').replace(leadingDotSlash, '');
  }

  #plural(s) {
    return this.#plurals.get(s) ?? s + 's';
  }

  resolve(fullName) {
    let [type, name] = fullName.split(':');
    for (let strategy of [this.#resolveSelf, this.#mainLookup, this.#defaultLookup]) {
      let result = strategy.call(this, type, name);
      if (result) {
        return result.hit;
      }
    }
  }

  #resolveSelf(type, name) {
    if (type === 'resolver' && name === 'current') {
      return {
        hit: {
          create: () => this,
        },
      };
    }
  }

  #mainLookup(type, name) {
    if (name === 'main') {
      let module = this.#modules.get(type);
      if (module) {
        console.log(`newResolve mainLookup(${type}, ${name}) => ${String(module.default)}`);
        return { hit: module.default };
      }
    }
  }

  #defaultLookup(type, name) {
    let dir = this.#plural(type);
    let target = `${dir}/${name}`;
    let module = this.#modules.get(target);
    if (module) {
      console.log(`newResolve(${type}, ${name}) => ${String(module.default)}`);
      return { hit: module.default };
    }
  }
}

const fileExtension = /\.\w{1,4}$/;
const leadingDotSlash = /^\.\//;
