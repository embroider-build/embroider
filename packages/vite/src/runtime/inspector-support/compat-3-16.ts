// Modules used by Ember Inspector so an app that builds with Vite can be inspected.
// This list should be used in apps using 3.16 <= Ember < 4.8.

export default `export { Application } from '@ember/application';
export { ApplicationNamespace } from '@ember/application/namespace';
export { Array } from '@ember/array';
export { ArrayMutable } from '@ember/array/mutable';
export { ArrayProxy } from '@ember/array/proxy';
export { Component } from '@ember/component';
export { Controller } from '@ember/controller';
export { Debug } from '@ember/debug';
export { EmberDestroyable } from '@ember/destroyable';
export { EmberObject } from '@ember/object';
export { EnumerableMutable } from '@ember/-internals/runtime/lib/mixins/mutable_enumerable';
export { InternalsEnvironment } from '@ember/-internals/environment';
export { InternalsMeta } from '@ember/-internals/meta';
export { InternalsMetal } from '@ember/-internals/metal';
export { InternalsRuntime } from '@ember/-internals/runtime';
export { InternalsUtils } from '@ember/-internals/utils';
export { InternalsViews } from '@ember/-internals/views';
export { Instrumentation } from '@ember/instrumentation';
export { Object } from '@ember/object';
export { ObjectCore } from '@ember/object/core';
export { ObjectEvented } from '@ember/object/evented';
export { ObjectInternals } from '@ember/object/internals';
export { ObjectObservable } from '@ember/object/observable';
export { ObjectPromiseProxyMixin } from '@ember/object/promise-proxy-mixin';
export { ObjectProxy } from '@ember/object/proxy';
export { Runloop } from '@ember/runloop';
export { Service } from '@ember/service';

export { VERSION } from 'ember/version';

export { RSVP } from 'rsvp';

export { GlimmerComponent } from '@glimmer/component';
export { GlimmerManager } from '@glimmer/manager';
export { GlimmerReference } from '@glimmer/reference';
export { GlimmerRuntime } from '@glimmer/runtime';
export { GlimmerUtil } from '@glimmer/util';
export { GlimmerValidator } from '@glimmer/validator';
`;