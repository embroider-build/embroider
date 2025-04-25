import type { Plugin } from 'vite';

// Includes a file that provides Ember Inspector support for Vite.
// Ultimately, this content should be provided directly by ember-source,
// so this plugin should only be used in apps with
// ember-source <= [the version of ember-source that will include it]
export function inspectorSupport(): Plugin {
  return {
    name: 'ember-inspector-support',

    async resolveId(source) {
      if (source === '@embroider/virtual/compat-inspector-support') {
        return '-ember-debug-inspector-support.js';
      }
    },

    load(id) {
      if (id === '-ember-debug-inspector-support.js') {
        return `// This script exposes the modules used by Ember Inspector so an app that
// builds with Vite can be inspected.

import { macroCondition, dependencySatisfies } from '@embroider/macros';

globalThis.emberInspectorLoader = {
  async load() {
    const [
      Application,
      ApplicationNamespace,
      Array,
      ArrayMutable,
      ArrayProxy,
      Component,
      Controller,
      Debug,
      EmberObject,
      EnumerableMutable,
      InternalsEnvironment,
      InternalsMeta,
      InternalsMetal,
      InternalsUtils,
      Instrumentation,
      Object,
      ObjectCore,
      ObjectInternals,
      ObjectEvented,
      ObjectObservable,
      ObjectPromiseProxyMixin,
      ObjectProxy,
      Runloop,
      Service,
      VERSION,
      RSVP,
      GlimmerComponent,
      GlimmerManager,
      GlimmerReference,
      GlimmerRuntime,
      GlimmerUtil,
      GlimmerValidator,
    ] = await Promise.all([
      import('@ember/application'),
      import('@ember/application/namespace'),
      import('@ember/array'),
      import('@ember/array/mutable'),
      import('@ember/array/proxy'),
      import('@ember/component'),
      import('@ember/controller'),
      import('@ember/debug'),
      import('@ember/object'),
      import('@ember/enumerable/mutable'),
      import('@ember/-internals/environment'),
      import('@ember/-internals/meta'),
      import('@ember/-internals/metal'),
      import('@ember/-internals/utils'),
      import('@ember/instrumentation'),
      import('@ember/object'),
      import('@ember/object/core'),
      import('@ember/object/internals'),
      import('@ember/object/evented'),
      import('@ember/object/observable'),
      import('@ember/object/promise-proxy-mixin'),
      import('@ember/object/proxy'),
      import('@ember/runloop'),
      import('@ember/service'),
      import('ember/version'),
      import('rsvp'),
      import('@glimmer/component'),
      import('@glimmer/manager'),
      import('@glimmer/reference'),
      import('@glimmer/runtime'),
      import('@glimmer/util'),
      import('@glimmer/validator'),
    ]);
    let modules = {
      Application,
      ApplicationNamespace,
      Array,
      ArrayMutable,
      ArrayProxy,
      Component,
      Controller,
      Debug,
      EmberObject,
      EnumerableMutable,
      InternalsEnvironment,
      InternalsMeta,
      InternalsMetal,
      InternalsUtils,
      Instrumentation,
      Object,
      ObjectCore,
      ObjectInternals,
      ObjectEvented,
      ObjectObservable,
      ObjectPromiseProxyMixin,
      ObjectProxy,
      Runloop,
      Service,
      VERSION,
      RSVP,
      GlimmerComponent,
      GlimmerManager,
      GlimmerReference,
      GlimmerRuntime,
      GlimmerUtil,
      GlimmerValidator,
    };
    if (macroCondition(dependencySatisfies('ember-source', '<4.8.0'))) {
      modules = {
        ...modules,
        EnumerableMutable: await import('@ember/-internals/runtime/lib/mixins/mutable_enumerable'),
      };
    }
    return modules;
  },
};
`;
      }
    },
  };
}
