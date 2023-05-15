(function() {
/*!
 * @overview  Ember - JavaScript Application Framework
 * @copyright Copyright 2011 Tilde Inc. and contributors
 *            Portions Copyright 2006-2011 Strobe Inc.
 *            Portions Copyright 2008-2011 Apple Inc. All rights reserved.
 * @license   Licensed under MIT license
 *            See https://raw.github.com/emberjs/ember.js/master/LICENSE
 * @version   5.0.0-beta.3
 */

/* eslint-disable no-var */
/* globals global globalThis self */
/* eslint-disable-next-line no-unused-vars */
var define, require;

(function () {
  var globalObj =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
      ? window
      : typeof global !== 'undefined'
      ? global
      : null;

  if (globalObj === null) {
    throw new Error('unable to locate global object');
  }

  if (typeof globalObj.define === 'function' && typeof globalObj.require === 'function') {
    define = globalObj.define;
    require = globalObj.require;

    return;
  }

  var registry = Object.create(null);
  var seen = Object.create(null);

  function missingModule(name, referrerName) {
    if (referrerName) {
      throw new Error('Could not find module ' + name + ' required by: ' + referrerName);
    } else {
      throw new Error('Could not find module ' + name);
    }
  }

  function internalRequire(_name, referrerName) {
    var name = _name;
    var mod = registry[name];

    if (!mod) {
      name = name + '/index';
      mod = registry[name];
    }

    var exports = seen[name];

    if (exports !== undefined) {
      return exports;
    }

    exports = seen[name] = {};

    if (!mod) {
      missingModule(_name, referrerName);
    }

    var deps = mod.deps;
    var callback = mod.callback;
    var reified = new Array(deps.length);

    for (var i = 0; i < deps.length; i++) {
      if (deps[i] === 'exports') {
        reified[i] = exports;
      } else if (deps[i] === 'require') {
        reified[i] = require;
      } else {
        reified[i] = require(deps[i], name);
      }
    }

    callback.apply(this, reified);

    return exports;
  }

  require = function (name) {
    return internalRequire(name, null);
  };

  define = function (name, deps, callback) {
    registry[name] = { deps: deps, callback: callback };
  };

  // setup `require` module
  require['default'] = require;

  require.has = function registryHas(moduleName) {
    return Boolean(registry[moduleName]) || Boolean(registry[moduleName + '/index']);
  };

  require._eak_seen = require.entries = registry;
})();

define("@ember/-internals/browser-environment/index", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.window = _exports.userAgent = _exports.location = _exports.isFirefox = _exports.isChrome = _exports.history = _exports.hasDOM = void 0;
  // check if window exists and actually is the global
  var hasDom = typeof self === 'object' && self !== null && self.Object === Object && typeof Window !== 'undefined' && self.constructor === Window && typeof document === 'object' && document !== null && self.document === document && typeof location === 'object' && location !== null && self.location === location && typeof history === 'object' && history !== null && self.history === history && typeof navigator === 'object' && navigator !== null && self.navigator === navigator && typeof navigator.userAgent === 'string';
  _exports.hasDOM = hasDom;
  var window = hasDom ? self : null;
  _exports.window = window;
  var location$1 = hasDom ? self.location : null;
  _exports.location = location$1;
  var history$1 = hasDom ? self.history : null;
  _exports.history = history$1;
  var userAgent = hasDom ? self.navigator.userAgent : 'Lynx (textmode)';
  _exports.userAgent = userAgent;
  var isChrome = hasDom ? typeof chrome === 'object' && !(typeof opera === 'object') : false;
  _exports.isChrome = isChrome;
  var isFirefox = hasDom ? /Firefox|FxiOS/.test(userAgent) : false;
  _exports.isFirefox = isFirefox;
});
define("@ember/-internals/environment/index", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.context = _exports.ENV = void 0;
  _exports.getENV = getENV;
  _exports.getLookup = getLookup;
  _exports.global = void 0;
  _exports.setLookup = setLookup;
  // from lodash to catch fake globals
  function checkGlobal(value) {
    return value && value.Object === Object ? value : undefined;
  }
  // element ids can ruin global miss checks
  function checkElementIdShadowing(value) {
    return value && value.nodeType === undefined ? value : undefined;
  }
  // export real global
  var global$1 = checkGlobal(checkElementIdShadowing(typeof global === 'object' && global)) || checkGlobal(typeof self === 'object' && self) || checkGlobal(typeof window === 'object' && window) || typeof mainContext !== 'undefined' && mainContext ||
  // set before strict mode in Ember loader/wrapper
  new Function('return this')(); // eval outside of strict mode

  // legacy imports/exports/lookup stuff (should we keep this??)
  _exports.global = global$1;
  var context = function (global, Ember) {
    return Ember === undefined ? {
      imports: global,
      exports: global,
      lookup: global
    } : {
      // import jQuery
      imports: Ember.imports || global,
      // export Ember
      exports: Ember.exports || global,
      // search for Namespaces
      lookup: Ember.lookup || global
    };
  }(global$1, global$1.Ember);
  _exports.context = context;
  function getLookup() {
    return context.lookup;
  }
  function setLookup(value) {
    context.lookup = value;
  }

  /**
    The hash of environment variables used to control various configuration
    settings. To specify your own or override default settings, add the
    desired properties to a global hash named `EmberENV` (or `ENV` for
    backwards compatibility with earlier versions of Ember). The `EmberENV`
    hash must be created before loading Ember.

    @class EmberENV
    @type Object
    @public
  */
  var ENV = {
    ENABLE_OPTIONAL_FEATURES: false,
    /**
      Determines whether Ember should add to `Array`
      native object prototypes, a few extra methods in order to provide a more
      friendly API.
         We generally recommend leaving this option set to true however, if you need
      to turn it off, you can add the configuration property
      `EXTEND_PROTOTYPES` to `EmberENV` and set it to `false`.
         Note, when disabled (the default configuration for Ember Addons), you will
      instead have to access all methods and functions from the Ember
      namespace.
         @property EXTEND_PROTOTYPES
      @type Boolean
      @default true
      @for EmberENV
      @public
    */
    EXTEND_PROTOTYPES: {
      Array: true
    },
    /**
      The `LOG_STACKTRACE_ON_DEPRECATION` property, when true, tells Ember to log
      a full stack trace during deprecation warnings.
         @property LOG_STACKTRACE_ON_DEPRECATION
      @type Boolean
      @default true
      @for EmberENV
      @public
    */
    LOG_STACKTRACE_ON_DEPRECATION: true,
    /**
      The `LOG_VERSION` property, when true, tells Ember to log versions of all
      dependent libraries in use.
         @property LOG_VERSION
      @type Boolean
      @default true
      @for EmberENV
      @public
    */
    LOG_VERSION: true,
    RAISE_ON_DEPRECATION: false,
    STRUCTURED_PROFILE: false,
    /**
      Whether to insert a `<div class="ember-view" />` wrapper around the
      application template. See RFC #280.
         This is not intended to be set directly, as the implementation may change in
      the future. Use `@ember/optional-features` instead.
         @property _APPLICATION_TEMPLATE_WRAPPER
      @for EmberENV
      @type Boolean
      @default true
      @private
    */
    _APPLICATION_TEMPLATE_WRAPPER: true,
    /**
      Whether to use Glimmer Component semantics (as opposed to the classic "Curly"
      components semantics) for template-only components. See RFC #278.
         This is not intended to be set directly, as the implementation may change in
      the future. Use `@ember/optional-features` instead.
         @property _TEMPLATE_ONLY_GLIMMER_COMPONENTS
      @for EmberENV
      @type Boolean
      @default false
      @private
    */
    _TEMPLATE_ONLY_GLIMMER_COMPONENTS: false,
    /**
      Whether to perform extra bookkeeping needed to make the `captureRenderTree`
      API work.
         This has to be set before the ember JavaScript code is evaluated. This is
      usually done by setting `window.EmberENV = { _DEBUG_RENDER_TREE: true };`
      before the "vendor" `<script>` tag in `index.html`.
         Setting the flag after Ember is already loaded will not work correctly. It
      may appear to work somewhat, but fundamentally broken.
         This is not intended to be set directly. Ember Inspector will enable the
      flag on behalf of the user as needed.
         This flag is always on in development mode.
         The flag is off by default in production mode, due to the cost associated
      with the the bookkeeping work.
         The expected flow is that Ember Inspector will ask the user to refresh the
      page after enabling the feature. It could also offer a feature where the
      user add some domains to the "always on" list. In either case, Ember
      Inspector will inject the code on the page to set the flag if needed.
         @property _DEBUG_RENDER_TREE
      @for EmberENV
      @type Boolean
      @default false
      @private
    */
    _DEBUG_RENDER_TREE: true /* DEBUG */,
    /**
      Whether the app defaults to using async observers.
         This is not intended to be set directly, as the implementation may change in
      the future. Use `@ember/optional-features` instead.
         @property _DEFAULT_ASYNC_OBSERVERS
      @for EmberENV
      @type Boolean
      @default false
      @private
    */
    _DEFAULT_ASYNC_OBSERVERS: false,
    /**
      Controls the maximum number of scheduled rerenders without "settling". In general,
      applications should not need to modify this environment variable, but please
      open an issue so that we can determine if a better default value is needed.
         @property _RERENDER_LOOP_LIMIT
      @for EmberENV
      @type number
      @default 1000
      @private
     */
    _RERENDER_LOOP_LIMIT: 1000,
    EMBER_LOAD_HOOKS: {},
    FEATURES: {}
  };
  _exports.ENV = ENV;
  (EmberENV => {
    if (typeof EmberENV !== 'object' || EmberENV === null) return;
    for (var flag in EmberENV) {
      if (!Object.prototype.hasOwnProperty.call(EmberENV, flag) || flag === 'EXTEND_PROTOTYPES' || flag === 'EMBER_LOAD_HOOKS') continue;
      var defaultValue = ENV[flag];
      if (defaultValue === true) {
        ENV[flag] = EmberENV[flag] !== false;
      } else if (defaultValue === false) {
        ENV[flag] = EmberENV[flag] === true;
      }
    }
    var {
      EXTEND_PROTOTYPES
    } = EmberENV;
    if (EXTEND_PROTOTYPES !== undefined) {
      if (typeof EXTEND_PROTOTYPES === 'object' && EXTEND_PROTOTYPES !== null) {
        ENV.EXTEND_PROTOTYPES.Array = EXTEND_PROTOTYPES.Array !== false;
      } else {
        ENV.EXTEND_PROTOTYPES.Array = EXTEND_PROTOTYPES !== false;
      }
    }
    // TODO this does not seem to be used by anything,
    //      can we remove it? do we need to deprecate it?
    var {
      EMBER_LOAD_HOOKS
    } = EmberENV;
    if (typeof EMBER_LOAD_HOOKS === 'object' && EMBER_LOAD_HOOKS !== null) {
      for (var hookName in EMBER_LOAD_HOOKS) {
        if (!Object.prototype.hasOwnProperty.call(EMBER_LOAD_HOOKS, hookName)) continue;
        var hooks = EMBER_LOAD_HOOKS[hookName];
        if (Array.isArray(hooks)) {
          ENV.EMBER_LOAD_HOOKS[hookName] = hooks.filter(hook => typeof hook === 'function');
        }
      }
    }
    var {
      FEATURES
    } = EmberENV;
    if (typeof FEATURES === 'object' && FEATURES !== null) {
      for (var feature in FEATURES) {
        if (!Object.prototype.hasOwnProperty.call(FEATURES, feature)) continue;
        ENV.FEATURES[feature] = FEATURES[feature] === true;
      }
    }
    if (true /* DEBUG */) {
      ENV._DEBUG_RENDER_TREE = true;
    }
  })(global$1.EmberENV);
  function getENV() {
    return ENV;
  }
});
define("@ember/-internals/utils/index", ["exports", "@glimmer/util", "@ember/debug"], function (_exports, _util, _debug) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.ROOT = _exports.GUID_KEY = _exports.Cache = void 0;
  _exports.canInvoke = canInvoke;
  _exports.checkHasSuper = void 0;
  _exports.dictionary = makeDictionary;
  _exports.enumerableSymbol = enumerableSymbol;
  _exports.generateGuid = generateGuid;
  _exports.getDebugName = void 0;
  _exports.getName = getName;
  _exports.guidFor = guidFor;
  _exports.intern = intern;
  _exports.isInternalSymbol = isInternalSymbol;
  _exports.isObject = isObject;
  _exports.isProxy = isProxy;
  _exports.lookupDescriptor = lookupDescriptor;
  _exports.observerListenerMetaFor = observerListenerMetaFor;
  _exports.setListeners = setListeners;
  _exports.setName = setName;
  _exports.setObservers = setObservers;
  _exports.setProxy = setProxy;
  _exports.teardownMandatorySetter = _exports.symbol = _exports.setupMandatorySetter = _exports.setWithMandatorySetter = void 0;
  _exports.toString = toString;
  _exports.uuid = uuid;
  _exports.wrap = wrap;
  /**
    Strongly hint runtimes to intern the provided string.

    When do I need to use this function?

    For the most part, never. Pre-mature optimization is bad, and often the
    runtime does exactly what you need it to, and more often the trade-off isn't
    worth it.

    Why?

    Runtimes store strings in at least 2 different representations:
    Ropes and Symbols (interned strings). The Rope provides a memory efficient
    data-structure for strings created from concatenation or some other string
    manipulation like splitting.

    Unfortunately checking equality of different ropes can be quite costly as
    runtimes must resort to clever string comparison algorithms. These
    algorithms typically cost in proportion to the length of the string.
    Luckily, this is where the Symbols (interned strings) shine. As Symbols are
    unique by their string content, equality checks can be done by pointer
    comparison.

    How do I know if my string is a rope or symbol?

    Typically (warning general sweeping statement, but truthy in runtimes at
    present) static strings created as part of the JS source are interned.
    Strings often used for comparisons can be interned at runtime if some
    criteria are met.  One of these criteria can be the size of the entire rope.
    For example, in chrome 38 a rope longer then 12 characters will not
    intern, nor will segments of that rope.

    Some numbers: http://jsperf.com/eval-vs-keys/8

    Known Trick™

    @private
    @return {String} interned version of the provided string
  */
  function intern(str) {
    var obj = Object.create(null);
    obj[str] = 1;
    for (var key in obj) {
      if (key === str) {
        return key;
      }
    }
    return str;
  }

  /**
    Returns whether Type(value) is Object.

    Useful for checking whether a value is a valid WeakMap key.

    Refs: https://tc39.github.io/ecma262/#sec-typeof-operator-runtime-semantics-evaluation
          https://tc39.github.io/ecma262/#sec-weakmap.prototype.set

    @private
    @function isObject
  */
  function isObject(value) {
    return value !== null && (typeof value === 'object' || typeof value === 'function');
  }

  /**
   @module @ember/object
  */
  /**
   @private
   @return {Number} the uuid
   */
  var _uuid = 0;
  /**
   Generates a universally unique identifier. This method
   is used internally by Ember for assisting with
   the generation of GUID's and other unique identifiers.

   @public
   @return {Number} [description]
   */
  function uuid() {
    return ++_uuid;
  }
  /**
   Prefix used for guids through out Ember.
   @private
   @property GUID_PREFIX
   @for Ember
   @type String
   @final
   */
  var GUID_PREFIX = 'ember';
  // Used for guid generation...
  var OBJECT_GUIDS = new WeakMap();
  var NON_OBJECT_GUIDS = new Map();
  /**
    A unique key used to assign guids and other private metadata to objects.
    If you inspect an object in your browser debugger you will often see these.
    They can be safely ignored.

    On browsers that support it, these properties are added with enumeration
    disabled so they won't show up when you iterate over your properties.

    @private
    @property GUID_KEY
    @for Ember
    @type String
    @final
  */
  var GUID_KEY = intern("__ember" + Date.now());
  /**
    Generates a new guid, optionally saving the guid to the object that you
    pass in. You will rarely need to use this method. Instead you should
    call `guidFor(obj)`, which return an existing guid if available.

    @private
    @method generateGuid
    @static
    @for @ember/object/internals
    @param {Object} [obj] Object the guid will be used for. If passed in, the guid will
      be saved on the object and reused whenever you pass the same object
      again.

      If no object is passed, just generate a new guid.
    @param {String} [prefix] Prefix to place in front of the guid. Useful when you want to
      separate the guid into separate namespaces.
    @return {String} the guid
  */
  _exports.GUID_KEY = GUID_KEY;
  function generateGuid(obj, prefix) {
    if (prefix === void 0) {
      prefix = GUID_PREFIX;
    }
    var guid = prefix + uuid().toString();
    if (isObject(obj)) {
      OBJECT_GUIDS.set(obj, guid);
    }
    return guid;
  }
  /**
    Returns a unique id for the object. If the object does not yet have a guid,
    one will be assigned to it. You can call this on any object,
    `EmberObject`-based or not.

    You can also use this method on DOM Element objects.

    @public
    @static
    @method guidFor
    @for @ember/object/internals
    @param {Object} obj any object, string, number, Element, or primitive
    @return {String} the unique guid for this instance.
  */
  function guidFor(value) {
    var guid;
    if (isObject(value)) {
      guid = OBJECT_GUIDS.get(value);
      if (guid === undefined) {
        guid = "" + GUID_PREFIX + uuid();
        OBJECT_GUIDS.set(value, guid);
      }
    } else {
      guid = NON_OBJECT_GUIDS.get(value);
      if (guid === undefined) {
        var type = typeof value;
        if (type === 'string') {
          guid = "st" + uuid();
        } else if (type === 'number') {
          guid = "nu" + uuid();
        } else if (type === 'symbol') {
          guid = "sy" + uuid();
        } else {
          guid = "(" + value + ")";
        }
        NON_OBJECT_GUIDS.set(value, guid);
      }
    }
    return guid;
  }
  var GENERATED_SYMBOLS = [];
  function isInternalSymbol(possibleSymbol) {
    return GENERATED_SYMBOLS.indexOf(possibleSymbol) !== -1;
  }
  // Some legacy symbols still need to be enumerable for a variety of reasons.
  // This code exists for that, and as a fallback in IE11. In general, prefer
  // `symbol` below when creating a new symbol.
  function enumerableSymbol(debugName) {
    // TODO: Investigate using platform symbols, but we do not
    // want to require non-enumerability for this API, which
    // would introduce a large cost.
    var id = GUID_KEY + Math.floor(Math.random() * Date.now()).toString();
    var symbol = intern("__" + debugName + id + "__");
    if (true /* DEBUG */) {
      GENERATED_SYMBOLS.push(symbol);
    }
    return symbol;
  }
  var symbol = Symbol;

  // the delete is meant to hint at runtimes that this object should remain in
  // dictionary mode. This is clearly a runtime specific hack, but currently it
  // appears worthwhile in some usecases. Please note, these deletes do increase
  // the cost of creation dramatically over a plain Object.create. And as this
  // only makes sense for long-lived dictionaries that aren't instantiated often.
  _exports.symbol = symbol;
  function makeDictionary(parent) {
    var dict = Object.create(parent);
    dict['_dict'] = null;
    delete dict['_dict'];
    return dict;
  }
  var getDebugName;
  if (true /* DEBUG */) {
    var getFunctionName = fn => {
      var functionName = fn.name;
      if (functionName === undefined) {
        var match = Function.prototype.toString.call(fn).match(/function (\w+)\s*\(/);
        functionName = match && match[1] || '';
      }
      return functionName.replace(/^bound /, '');
    };
    var getObjectName = obj => {
      var name;
      var className;
      if (obj.constructor && obj.constructor !== Object) {
        className = getFunctionName(obj.constructor);
      }
      if ('toString' in obj && obj.toString !== Object.prototype.toString && obj.toString !== Function.prototype.toString) {
        name = obj.toString();
      }
      // If the class has a decent looking name, and the `toString` is one of the
      // default Ember toStrings, replace the constructor portion of the toString
      // with the class name. We check the length of the class name to prevent doing
      // this when the value is minified.
      if (name && name.match(/<.*:ember\d+>/) && className && className[0] !== '_' && className.length > 2 && className !== 'Class') {
        return name.replace(/<.*:/, "<" + className + ":");
      }
      return name || className;
    };
    var getPrimitiveName = value => {
      return String(value);
    };
    getDebugName = value => {
      if (typeof value === 'function') {
        return getFunctionName(value) || "(unknown function)";
      } else if (typeof value === 'object' && value !== null) {
        return getObjectName(value) || "(unknown object)";
      } else {
        return getPrimitiveName(value);
      }
    };
  }
  var getDebugName$1 = getDebugName;
  _exports.getDebugName = getDebugName$1;
  var HAS_SUPER_PATTERN = /\.(_super|call\(this|apply\(this)/;
  var fnToString = Function.prototype.toString;
  var checkHasSuper = (() => {
    var sourceAvailable = fnToString.call(function () {
      return this;
    }).indexOf('return this') > -1;
    if (sourceAvailable) {
      return function checkHasSuper(func) {
        return HAS_SUPER_PATTERN.test(fnToString.call(func));
      };
    }
    return function checkHasSuper() {
      return true;
    };
  })();
  _exports.checkHasSuper = checkHasSuper;
  var HAS_SUPER_MAP = new WeakMap();
  var ROOT = Object.freeze(function () {});
  _exports.ROOT = ROOT;
  HAS_SUPER_MAP.set(ROOT, false);
  function hasSuper(func) {
    var hasSuper = HAS_SUPER_MAP.get(func);
    if (hasSuper === undefined) {
      hasSuper = checkHasSuper(func);
      HAS_SUPER_MAP.set(func, hasSuper);
    }
    return hasSuper;
  }
  class ObserverListenerMeta {
    constructor() {
      this.listeners = undefined;
      this.observers = undefined;
    }
  }
  var OBSERVERS_LISTENERS_MAP = new WeakMap();
  function createObserverListenerMetaFor(fn) {
    var meta = OBSERVERS_LISTENERS_MAP.get(fn);
    if (meta === undefined) {
      meta = new ObserverListenerMeta();
      OBSERVERS_LISTENERS_MAP.set(fn, meta);
    }
    return meta;
  }
  function observerListenerMetaFor(fn) {
    return OBSERVERS_LISTENERS_MAP.get(fn);
  }
  function setObservers(func, observers) {
    var meta = createObserverListenerMetaFor(func);
    meta.observers = observers;
  }
  function setListeners(func, listeners) {
    var meta = createObserverListenerMetaFor(func);
    meta.listeners = listeners;
  }
  var IS_WRAPPED_FUNCTION_SET = new _util._WeakSet();
  /**
    Wraps the passed function so that `this._super` will point to the superFunc
    when the function is invoked. This is the primitive we use to implement
    calls to super.

    @private
    @method wrap
    @for Ember
    @param {Function} func The function to call
    @param {Function} superFunc The super function.
    @return {Function} wrapped function.
  */
  function wrap(func, superFunc) {
    if (!hasSuper(func)) {
      return func;
    }
    // ensure an unwrapped super that calls _super is wrapped with a terminal _super
    if (!IS_WRAPPED_FUNCTION_SET.has(superFunc) && hasSuper(superFunc)) {
      return _wrap(func, _wrap(superFunc, ROOT));
    }
    return _wrap(func, superFunc);
  }
  function _wrap(func, superFunc) {
    function superWrapper() {
      var orig = this._super;
      this._super = superFunc;
      var ret = func.apply(this, arguments);
      this._super = orig;
      return ret;
    }
    IS_WRAPPED_FUNCTION_SET.add(superWrapper);
    var meta = OBSERVERS_LISTENERS_MAP.get(func);
    if (meta !== undefined) {
      OBSERVERS_LISTENERS_MAP.set(superWrapper, meta);
    }
    return superWrapper;
  }
  function lookupDescriptor(obj, keyName) {
    var current = obj;
    do {
      var descriptor = Object.getOwnPropertyDescriptor(current, keyName);
      if (descriptor !== undefined) {
        return descriptor;
      }
      current = Object.getPrototypeOf(current);
    } while (current !== null);
    return null;
  }

  /**
    Checks to see if the `methodName` exists on the `obj`.

    ```javascript
    let foo = { bar: function() { return 'bar'; }, baz: null };

    Ember.canInvoke(foo, 'bar'); // true
    Ember.canInvoke(foo, 'baz'); // false
    Ember.canInvoke(foo, 'bat'); // false
    ```

    @method canInvoke
    @for Ember
    @param {Object} obj The object to check for the method
    @param {String} methodName The method name to check for
    @return {Boolean}
    @private
  */
  function canInvoke(obj, methodName) {
    return obj != null && typeof obj[methodName] === 'function';
  }
  /**
    @module @ember/utils
  */

  var NAMES = new WeakMap();
  function setName(obj, name) {
    if (isObject(obj)) NAMES.set(obj, name);
  }
  function getName(obj) {
    return NAMES.get(obj);
  }
  var objectToString = Object.prototype.toString;
  function isNone(obj) {
    return obj === null || obj === undefined;
  }
  /*
   A `toString` util function that supports objects without a `toString`
   method, e.g. an object created with `Object.create(null)`.
  */
  function toString(obj) {
    if (typeof obj === 'string') {
      return obj;
    }
    if (null === obj) return 'null';
    if (undefined === obj) return 'undefined';
    if (Array.isArray(obj)) {
      // Reimplement Array.prototype.join according to spec (22.1.3.13)
      // Changing ToString(element) with this safe version of ToString.
      var r = '';
      for (var k = 0; k < obj.length; k++) {
        if (k > 0) {
          r += ',';
        }
        if (!isNone(obj[k])) {
          r += toString(obj[k]);
        }
      }
      return r;
    }
    if (typeof obj.toString === 'function') {
      return obj.toString();
    }
    return objectToString.call(obj);
  }
  var PROXIES = new _util._WeakSet();
  function isProxy(value) {
    if (isObject(value)) {
      return PROXIES.has(value);
    }
    return false;
  }
  function setProxy(object) {
    if (isObject(object)) {
      PROXIES.add(object);
    }
  }
  class Cache {
    constructor(limit, func, store) {
      if (store === void 0) {
        store = new Map();
      }
      this.limit = limit;
      this.func = func;
      this.store = store;
      this.size = 0;
      this.misses = 0;
      this.hits = 0;
    }
    get(key) {
      if (this.store.has(key)) {
        this.hits++;
        // SAFETY: we know the value is present because `.has(key)` was `true`.
        return this.store.get(key);
      } else {
        this.misses++;
        return this.set(key, this.func(key));
      }
    }
    set(key, value) {
      if (this.limit > this.size) {
        this.size++;
        this.store.set(key, value);
      }
      return value;
    }
    purge() {
      this.store.clear();
      this.size = 0;
      this.hits = 0;
      this.misses = 0;
    }
  }
  _exports.Cache = Cache;
  var setupMandatorySetter;
  _exports.setupMandatorySetter = setupMandatorySetter;
  var teardownMandatorySetter;
  _exports.teardownMandatorySetter = teardownMandatorySetter;
  var setWithMandatorySetter;
  _exports.setWithMandatorySetter = setWithMandatorySetter;
  function isElementKey(key) {
    return typeof key === 'number' ? isPositiveInt(key) : isStringInt(key);
  }
  function isStringInt(str) {
    var num = parseInt(str, 10);
    return isPositiveInt(num) && str === String(num);
  }
  function isPositiveInt(num) {
    return num >= 0 && num % 1 === 0;
  }
  if (true /* DEBUG */) {
    var SEEN_TAGS = new _util._WeakSet();
    var MANDATORY_SETTERS = new WeakMap();
    var _propertyIsEnumerable = function (obj, key) {
      return Object.prototype.propertyIsEnumerable.call(obj, key);
    };
    _exports.setupMandatorySetter = setupMandatorySetter = function (tag, obj, keyName) {
      if (SEEN_TAGS.has(tag)) {
        return;
      }
      SEEN_TAGS.add(tag);
      if (Array.isArray(obj) && isElementKey(keyName)) {
        return;
      }
      var desc = lookupDescriptor(obj, keyName) || {};
      if (desc.get || desc.set) {
        // if it has a getter or setter, we can't install the mandatory setter.
        // native setters are allowed, we have to assume that they will resolve
        // to tracked properties.
        return;
      }
      if (desc && (!desc.configurable || !desc.writable)) {
        // if it isn't writable anyways, so we shouldn't provide the setter.
        // if it isn't configurable, we can't overwrite it anyways.
        return;
      }
      var setters = MANDATORY_SETTERS.get(obj);
      if (setters === undefined) {
        setters = {};
        MANDATORY_SETTERS.set(obj, setters);
      }
      desc.hadOwnProperty = Object.hasOwnProperty.call(obj, keyName);
      setters[keyName] = desc;
      Object.defineProperty(obj, keyName, {
        configurable: true,
        enumerable: _propertyIsEnumerable(obj, keyName),
        get() {
          if (desc.get) {
            return desc.get.call(this);
          } else {
            return desc.value;
          }
        },
        set(value) {
          (true && !(false) && (0, _debug.assert)("You attempted to update " + this + "." + String(keyName) + " to \"" + String(value) + "\", but it is being tracked by a tracking context, such as a template, computed property, or observer. In order to make sure the context updates properly, you must invalidate the property when updating it. You can mark the property as `@tracked`, or use `@ember/object#set` to do this."));
        }
      });
    };
    _exports.teardownMandatorySetter = teardownMandatorySetter = function (obj, keyName) {
      var setters = MANDATORY_SETTERS.get(obj);
      if (setters !== undefined && setters[keyName] !== undefined) {
        Object.defineProperty(obj, keyName, setters[keyName]);
        delete setters[keyName];
      }
    };
    _exports.setWithMandatorySetter = setWithMandatorySetter = function (obj, keyName, value) {
      var setters = MANDATORY_SETTERS.get(obj);
      if (setters !== undefined && setters[keyName] !== undefined) {
        var setter = setters[keyName];
        if (setter.set) {
          setter.set.call(obj, value);
        } else {
          setter.value = value;
          // If the object didn't have own property before, it would have changed
          // the enumerability after setting the value the first time.
          if (!setter.hadOwnProperty) {
            var desc = lookupDescriptor(obj, keyName);
            desc.enumerable = true;
            Object.defineProperty(obj, keyName, desc);
          }
        }
      } else {
        obj[keyName] = value;
      }
    };
  }
});
define("@ember/canary-features/index", ["exports", "@ember/-internals/environment"], function (_exports, _environment) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.FEATURES = _exports.DEFAULT_FEATURES = void 0;
  _exports.isEnabled = isEnabled;
  /**
    Set `EmberENV.FEATURES` in your application's `config/environment.js` file
    to enable canary features in your application.

    See the [feature flag guide](https://guides.emberjs.com/release/configuring-ember/feature-flags/)
    for more details.

    @module @ember/canary-features
    @public
  */
  var DEFAULT_FEATURES = {
    // FLAG_NAME: true/false
  };
  /**
    The hash of enabled Canary features. Add to this, any canary features
    before creating your application.

    @class FEATURES
    @static
    @since 1.1.0
    @public
  */
  _exports.DEFAULT_FEATURES = DEFAULT_FEATURES;
  var FEATURES = Object.assign(DEFAULT_FEATURES, _environment.ENV.FEATURES);
  /**
    Determine whether the specified `feature` is enabled. Used by Ember's
    build tools to exclude experimental features from beta/stable builds.

    You can define the following configuration options:

    * `EmberENV.ENABLE_OPTIONAL_FEATURES` - enable any features that have not been explicitly
      enabled/disabled.

    @method isEnabled
    @param {String} feature The feature to check
    @return {Boolean}
    @since 1.1.0
    @public
  */
  _exports.FEATURES = FEATURES;
  function isEnabled(feature) {
    var value = FEATURES[feature];
    if (value === true || value === false) {
      return value;
    } else if (_environment.ENV.ENABLE_OPTIONAL_FEATURES) {
      return true;
    } else {
      return false;
    }
  }
  // Uncomment the below when features are present:
  // function featureValue(value: null | boolean) {
  //   if (ENV.ENABLE_OPTIONAL_FEATURES && value === null) {
  //     return true;
  //   }
  //   return value;
  // }
  // export const FLAG_NAME = featureValue(FEATURES.FLAG_NAME);
});
define("@ember/debug/container-debug-adapter", ["exports", "@ember/-internals/string", "@ember/object", "@ember/utils", "@ember/-internals/owner", "@ember/application/namespace"], function (_exports, _string, _object, _utils, _owner, _namespace) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  /**
  @module @ember/debug/container-debug-adapter
  */
  /**
    The `ContainerDebugAdapter` helps the container and resolver interface
    with tools that debug Ember such as the
    [Ember Inspector](https://github.com/emberjs/ember-inspector)
    for Chrome and Firefox.

    This class can be extended by a custom resolver implementer
    to override some of the methods with library-specific code.

    The methods likely to be overridden are:

    * `canCatalogEntriesByType`
    * `catalogEntriesByType`

    The adapter will need to be registered
    in the application's container as `container-debug-adapter:main`.

    Example:

    ```javascript
    Application.initializer({
      name: "containerDebugAdapter",

      initialize(application) {
        application.register('container-debug-adapter:main', require('app/container-debug-adapter'));
      }
    });
    ```

    @class ContainerDebugAdapter
    @extends EmberObject
    @since 1.5.0
    @public
  */
  class ContainerDebugAdapter extends _object.default {
    constructor(owner) {
      super(owner);
      this.resolver = (0, _owner.getOwner)(this).lookup('resolver-for-debugging:main');
    }
    /**
      Returns true if it is possible to catalog a list of available
      classes in the resolver for a given type.
         @method canCatalogEntriesByType
      @param {String} type The type. e.g. "model", "controller", "route".
      @return {boolean} whether a list is available for this type.
      @public
    */
    canCatalogEntriesByType(type) {
      if (type === 'model' || type === 'template') {
        return false;
      }
      return true;
    }
    /**
      Returns the available classes a given type.
         @method catalogEntriesByType
      @param {String} type The type. e.g. "model", "controller", "route".
      @return {Array} An array of strings.
      @public
    */
    catalogEntriesByType(type) {
      var namespaces = _namespace.default.NAMESPACES;
      var types = [];
      var typeSuffixRegex = new RegExp((0, _string.classify)(type) + "$");
      namespaces.forEach(namespace => {
        for (var key in namespace) {
          if (!Object.prototype.hasOwnProperty.call(namespace, key)) {
            continue;
          }
          if (typeSuffixRegex.test(key)) {
            var klass = namespace[key];
            if ((0, _utils.typeOf)(klass) === 'class') {
              types.push((0, _string.dasherize)(key.replace(typeSuffixRegex, '')));
            }
          }
        }
      });
      return types;
    }
  }
  _exports.default = ContainerDebugAdapter;
});
define("@ember/debug/data-adapter", ["exports", "@ember/-internals/owner", "@ember/runloop", "@ember/object", "@ember/-internals/string", "@ember/application/namespace", "@ember/array", "@glimmer/validator", "@ember/debug"], function (_exports, _owner, _runloop, _object, _string, _namespace, _array, _validator, _debug) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  function iterate(arr, fn) {
    if (Symbol.iterator in arr) {
      for (var item of arr) {
        fn(item);
      }
    } else {
      // SAFETY: this cast required to work this way to interop between TS 4.8
      // and 4.9. When we drop support for 4.8, it will narrow correctly via the
      // use of the `in` operator above. (Preferably we will solve this by just
      // switching to require `Symbol.iterator` instead.)
      (0, _debug.assert)('', typeof arr.forEach === 'function');
      arr.forEach(fn);
    }
  }
  class RecordsWatcher {
    getCacheForItem(record) {
      var recordCache = this.recordCaches.get(record);
      if (!recordCache) {
        var hasBeenAdded = false;
        recordCache = (0, _validator.createCache)(() => {
          if (!hasBeenAdded) {
            this.added.push(this.wrapRecord(record));
            hasBeenAdded = true;
          } else {
            this.updated.push(this.wrapRecord(record));
          }
        });
        this.recordCaches.set(record, recordCache);
      }
      return recordCache;
    }
    constructor(records, recordsAdded, recordsUpdated, recordsRemoved, wrapRecord, release) {
      this.wrapRecord = wrapRecord;
      this.release = release;
      this.recordCaches = new Map();
      this.added = [];
      this.updated = [];
      this.removed = [];
      this.recordArrayCache = (0, _validator.createCache)(() => {
        var seen = new Set();
        // Track `[]` for legacy support
        (0, _validator.consumeTag)((0, _validator.tagFor)(records, '[]'));
        iterate(records, record => {
          (0, _validator.getValue)(this.getCacheForItem(record));
          seen.add(record);
        });
        // Untrack this operation because these records are being removed, they
        // should not be polled again in the future
        (0, _validator.untrack)(() => {
          this.recordCaches.forEach((_cache, record) => {
            if (!seen.has(record)) {
              this.removed.push(wrapRecord(record));
              this.recordCaches.delete(record);
            }
          });
        });
        if (this.added.length > 0) {
          recordsAdded(this.added);
          this.added = [];
        }
        if (this.updated.length > 0) {
          recordsUpdated(this.updated);
          this.updated = [];
        }
        if (this.removed.length > 0) {
          recordsRemoved(this.removed);
          this.removed = [];
        }
      });
    }
    revalidate() {
      (0, _validator.getValue)(this.recordArrayCache);
    }
  }
  class TypeWatcher {
    constructor(records, onChange, release) {
      this.release = release;
      var hasBeenAccessed = false;
      this.cache = (0, _validator.createCache)(() => {
        // Empty iteration, we're doing this just
        // to track changes to the records array
        iterate(records, () => {});
        // Also track `[]` for legacy support
        (0, _validator.consumeTag)((0, _validator.tagFor)(records, '[]'));
        if (hasBeenAccessed === true) {
          (0, _runloop.next)(onChange);
        } else {
          hasBeenAccessed = true;
        }
      });
      this.release = release;
    }
    revalidate() {
      (0, _validator.getValue)(this.cache);
    }
  }
  /**
    The `DataAdapter` helps a data persistence library
    interface with tools that debug Ember such
    as the [Ember Inspector](https://github.com/emberjs/ember-inspector)
    for Chrome and Firefox.

    This class will be extended by a persistence library
    which will override some of the methods with
    library-specific code.

    The methods likely to be overridden are:

    * `getFilters`
    * `detect`
    * `columnsForType`
    * `getRecords`
    * `getRecordColumnValues`
    * `getRecordKeywords`
    * `getRecordFilterValues`
    * `getRecordColor`

    The adapter will need to be registered
    in the application's container as `dataAdapter:main`.

    Example:

    ```javascript
    Application.initializer({
      name: "data-adapter",

      initialize: function(application) {
        application.register('data-adapter:main', DS.DataAdapter);
      }
    });
    ```

    @class DataAdapter
    @extends EmberObject
    @public
  */
  class DataAdapter extends _object.default {
    constructor(owner) {
      super(owner);
      this.releaseMethods = (0, _array.A)();
      this.recordsWatchers = new Map();
      this.typeWatchers = new Map();
      this.flushWatchers = null;
      /**
        The container-debug-adapter which is used
        to list all models.
               @property containerDebugAdapter
        @default undefined
        @since 1.5.0
        @public
      **/
      /**
        The number of attributes to send
        as columns. (Enough to make the record
        identifiable).
               @private
        @property attributeLimit
        @default 3
        @since 1.3.0
      */
      this.attributeLimit = 3;
      /**
         Ember Data > v1.0.0-beta.18
         requires string model names to be passed
         around instead of the actual factories.
                This is a stamp for the Ember Inspector
         to differentiate between the versions
         to be able to support older versions too.
                @public
         @property acceptsModelName
       */
      this.acceptsModelName = true;
      this.containerDebugAdapter = (0, _owner.getOwner)(this).lookup('container-debug-adapter:main');
    }
    /**
       Map from records arrays to RecordsWatcher instances
          @private
       @property recordsWatchers
       @since 3.26.0
     */
    /**
      Map from records arrays to TypeWatcher instances
         @private
      @property typeWatchers
      @since 3.26.0
     */
    /**
      Callback that is currently scheduled on backburner end to flush and check
      all active watchers.
         @private
      @property flushWatchers
      @since 3.26.0
        */
    /**
      Stores all methods that clear observers.
      These methods will be called on destruction.
         @private
      @property releaseMethods
      @since 1.3.0
    */
    /**
      Specifies how records can be filtered.
      Records returned will need to have a `filterValues`
      property with a key for every name in the returned array.
         @public
      @method getFilters
      @return {Array} List of objects defining filters.
       The object should have a `name` and `desc` property.
    */
    getFilters() {
      return (0, _array.A)();
    }
    /**
      Fetch the model types and observe them for changes.
         @public
      @method watchModelTypes
         @param {Function} typesAdded Callback to call to add types.
      Takes an array of objects containing wrapped types (returned from `wrapModelType`).
         @param {Function} typesUpdated Callback to call when a type has changed.
      Takes an array of objects containing wrapped types.
         @return {Function} Method to call to remove all observers
    */
    watchModelTypes(typesAdded, typesUpdated) {
      var modelTypes = this.getModelTypes();
      var releaseMethods = (0, _array.A)();
      var typesToSend;
      typesToSend = modelTypes.map(type => {
        var klass = type.klass;
        var wrapped = this.wrapModelType(klass, type.name);
        releaseMethods.push(this.observeModelType(type.name, typesUpdated));
        return wrapped;
      });
      typesAdded(typesToSend);
      var release = () => {
        releaseMethods.forEach(fn => fn());
        this.releaseMethods.removeObject(release);
      };
      this.releaseMethods.pushObject(release);
      return release;
    }
    _nameToClass(type) {
      if (typeof type === 'string') {
        var owner = (0, _owner.getOwner)(this);
        var Factory = owner.factoryFor("model:" + type);
        type = Factory && Factory.class;
      }
      return type;
    }
    /**
      Fetch the records of a given type and observe them for changes.
         @public
      @method watchRecords
         @param {String} modelName The model name.
         @param {Function} recordsAdded Callback to call to add records.
      Takes an array of objects containing wrapped records.
      The object should have the following properties:
        columnValues: {Object} The key and value of a table cell.
        object: {Object} The actual record object.
         @param {Function} recordsUpdated Callback to call when a record has changed.
      Takes an array of objects containing wrapped records.
         @param {Function} recordsRemoved Callback to call when a record has removed.
      Takes an array of objects containing wrapped records.
         @return {Function} Method to call to remove all observers.
    */
    watchRecords(modelName, recordsAdded, recordsUpdated, recordsRemoved) {
      var klass = this._nameToClass(modelName);
      var records = this.getRecords(klass, modelName);
      var {
        recordsWatchers
      } = this;
      var recordsWatcher = recordsWatchers.get(records);
      if (!recordsWatcher) {
        recordsWatcher = new RecordsWatcher(records, recordsAdded, recordsUpdated, recordsRemoved, record => this.wrapRecord(record), () => {
          recordsWatchers.delete(records);
          this.updateFlushWatchers();
        });
        recordsWatchers.set(records, recordsWatcher);
        this.updateFlushWatchers();
        recordsWatcher.revalidate();
      }
      return recordsWatcher.release;
    }
    updateFlushWatchers() {
      if (this.flushWatchers === null) {
        if (this.typeWatchers.size > 0 || this.recordsWatchers.size > 0) {
          this.flushWatchers = () => {
            this.typeWatchers.forEach(watcher => watcher.revalidate());
            this.recordsWatchers.forEach(watcher => watcher.revalidate());
          };
          _runloop._backburner.on('end', this.flushWatchers);
        }
      } else if (this.typeWatchers.size === 0 && this.recordsWatchers.size === 0) {
        _runloop._backburner.off('end', this.flushWatchers);
        this.flushWatchers = null;
      }
    }
    /**
      Clear all observers before destruction
      @private
      @method willDestroy
    */
    willDestroy() {
      this._super(...arguments);
      this.typeWatchers.forEach(watcher => watcher.release());
      this.recordsWatchers.forEach(watcher => watcher.release());
      this.releaseMethods.forEach(fn => fn());
      if (this.flushWatchers) {
        _runloop._backburner.off('end', this.flushWatchers);
      }
    }
    /**
      Detect whether a class is a model.
         Test that against the model class
      of your persistence library.
         @public
      @method detect
      @return boolean Whether the class is a model class or not.
    */
    detect(_klass) {
      return false;
    }
    /**
      Get the columns for a given model type.
         @public
      @method columnsForType
      @return {Array} An array of columns of the following format:
       name: {String} The name of the column.
       desc: {String} Humanized description (what would show in a table column name).
    */
    columnsForType(_klass) {
      return (0, _array.A)();
    }
    /**
      Adds observers to a model type class.
         @private
      @method observeModelType
      @param {String} modelName The model type name.
      @param {Function} typesUpdated Called when a type is modified.
      @return {Function} The function to call to remove observers.
    */
    observeModelType(modelName, typesUpdated) {
      var klass = this._nameToClass(modelName);
      var records = this.getRecords(klass, modelName);
      var onChange = () => {
        typesUpdated([this.wrapModelType(klass, modelName)]);
      };
      var {
        typeWatchers
      } = this;
      var typeWatcher = typeWatchers.get(records);
      if (!typeWatcher) {
        typeWatcher = new TypeWatcher(records, onChange, () => {
          typeWatchers.delete(records);
          this.updateFlushWatchers();
        });
        typeWatchers.set(records, typeWatcher);
        this.updateFlushWatchers();
        typeWatcher.revalidate();
      }
      return typeWatcher.release;
    }
    /**
      Wraps a given model type and observes changes to it.
         @private
      @method wrapModelType
      @param {Class} klass A model class.
      @param {String} modelName Name of the class.
      @return {Object} The wrapped type has the following format:
        name: {String} The name of the type.
        count: {Integer} The number of records available.
        columns: {Columns} An array of columns to describe the record.
        object: {Class} The actual Model type class.
    */
    wrapModelType(klass, name) {
      var records = this.getRecords(klass, name);
      return {
        name,
        count: (0, _object.get)(records, 'length'),
        columns: this.columnsForType(klass),
        object: klass
      };
    }
    /**
      Fetches all models defined in the application.
         @private
      @method getModelTypes
      @return {Array} Array of model types.
    */
    getModelTypes() {
      var containerDebugAdapter = this.containerDebugAdapter;
      var stringTypes = containerDebugAdapter.canCatalogEntriesByType('model') ? containerDebugAdapter.catalogEntriesByType('model') : this._getObjectsOnNamespaces();
      // New adapters return strings instead of classes.
      var klassTypes = stringTypes.map(name => {
        return {
          klass: this._nameToClass(name),
          name
        };
      });
      return klassTypes.filter(type => this.detect(type.klass));
    }
    /**
      Loops over all namespaces and all objects
      attached to them.
         @private
      @method _getObjectsOnNamespaces
      @return {Array} Array of model type strings.
    */
    _getObjectsOnNamespaces() {
      var namespaces = _namespace.default.NAMESPACES;
      var types = [];
      namespaces.forEach(namespace => {
        for (var key in namespace) {
          if (!Object.prototype.hasOwnProperty.call(namespace, key)) {
            continue;
          }
          // Even though we will filter again in `getModelTypes`,
          // we should not call `lookupFactory` on non-models
          if (!this.detect(namespace[key])) {
            continue;
          }
          var name = (0, _string.dasherize)(key);
          types.push(name);
        }
      });
      return types;
    }
    /**
      Fetches all loaded records for a given type.
         @public
      @method getRecords
      @return {Array} An array of records.
       This array will be observed for changes,
       so it should update when new records are added/removed.
    */
    getRecords(_klass, _name) {
      return (0, _array.A)();
    }
    /**
      Wraps a record and observers changes to it.
         @private
      @method wrapRecord
      @param {Object} record The record instance.
      @return {Object} The wrapped record. Format:
      columnValues: {Array}
      searchKeywords: {Array}
    */
    wrapRecord(record) {
      return {
        object: record,
        columnValues: this.getRecordColumnValues(record),
        searchKeywords: this.getRecordKeywords(record),
        filterValues: this.getRecordFilterValues(record),
        color: this.getRecordColor(record)
      };
    }
    /**
      Gets the values for each column.
         @public
      @method getRecordColumnValues
      @return {Object} Keys should match column names defined
      by the model type.
    */
    getRecordColumnValues(_record) {
      return {};
    }
    /**
      Returns keywords to match when searching records.
         @public
      @method getRecordKeywords
      @return {Array} Relevant keywords for search.
    */
    getRecordKeywords(_record) {
      return (0, _array.A)();
    }
    /**
      Returns the values of filters defined by `getFilters`.
         @public
      @method getRecordFilterValues
      @param {Object} record The record instance.
      @return {Object} The filter values.
    */
    getRecordFilterValues(_record) {
      return {};
    }
    /**
      Each record can have a color that represents its state.
         @public
      @method getRecordColor
      @param {Object} record The record instance
      @return {String} The records color.
        Possible options: black, red, blue, green.
    */
    getRecordColor(_record) {
      return null;
    }
  }
  _exports.default = DataAdapter;
});
define("@ember/debug/index", ["exports", "@ember/-internals/browser-environment", "@ember/debug/lib/deprecate", "@ember/debug/lib/testing", "@ember/debug/lib/warn", "@ember/debug/lib/inspect", "@ember/debug/lib/capture-render-tree"], function (_exports, _browserEnvironment, _deprecate2, _testing, _warn2, _inspect, _captureRenderTree) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.assert = _exports._warnIfUsingStrippedFeatureFlags = void 0;
  Object.defineProperty(_exports, "captureRenderTree", {
    enumerable: true,
    get: function () {
      return _captureRenderTree.default;
    }
  });
  _exports.info = _exports.getDebugFunction = _exports.deprecateFunc = _exports.deprecate = _exports.debugSeal = _exports.debugFreeze = _exports.debug = void 0;
  Object.defineProperty(_exports, "inspect", {
    enumerable: true,
    get: function () {
      return _inspect.default;
    }
  });
  Object.defineProperty(_exports, "isTesting", {
    enumerable: true,
    get: function () {
      return _testing.isTesting;
    }
  });
  Object.defineProperty(_exports, "registerDeprecationHandler", {
    enumerable: true,
    get: function () {
      return _deprecate2.registerHandler;
    }
  });
  Object.defineProperty(_exports, "registerWarnHandler", {
    enumerable: true,
    get: function () {
      return _warn2.registerHandler;
    }
  });
  _exports.setDebugFunction = _exports.runInDebug = void 0;
  Object.defineProperty(_exports, "setTesting", {
    enumerable: true,
    get: function () {
      return _testing.setTesting;
    }
  });
  _exports.warn = void 0;
  // These are the default production build versions:
  var noop = () => {};
  var assert = noop;
  _exports.assert = assert;
  var info = noop;
  _exports.info = info;
  var warn = noop;
  _exports.warn = warn;
  var debug = noop;
  _exports.debug = debug;
  var deprecate = noop;
  _exports.deprecate = deprecate;
  var debugSeal = noop;
  _exports.debugSeal = debugSeal;
  var debugFreeze = noop;
  _exports.debugFreeze = debugFreeze;
  var runInDebug = noop;
  _exports.runInDebug = runInDebug;
  var setDebugFunction = noop;
  _exports.setDebugFunction = setDebugFunction;
  var getDebugFunction = noop;
  _exports.getDebugFunction = getDebugFunction;
  var deprecateFunc = function () {
    return arguments[arguments.length - 1];
  };
  _exports.deprecateFunc = deprecateFunc;
  if (true /* DEBUG */) {
    _exports.setDebugFunction = setDebugFunction = function (type, callback) {
      switch (type) {
        case 'assert':
          return _exports.assert = assert = callback;
        case 'info':
          return _exports.info = info = callback;
        case 'warn':
          return _exports.warn = warn = callback;
        case 'debug':
          return _exports.debug = debug = callback;
        case 'deprecate':
          return _exports.deprecate = deprecate = callback;
        case 'debugSeal':
          return _exports.debugSeal = debugSeal = callback;
        case 'debugFreeze':
          return _exports.debugFreeze = debugFreeze = callback;
        case 'runInDebug':
          return _exports.runInDebug = runInDebug = callback;
        case 'deprecateFunc':
          return _exports.deprecateFunc = deprecateFunc = callback;
      }
    };
    _exports.getDebugFunction = getDebugFunction = function (type) {
      switch (type) {
        case 'assert':
          return assert;
        case 'info':
          return info;
        case 'warn':
          return warn;
        case 'debug':
          return debug;
        case 'deprecate':
          return deprecate;
        case 'debugSeal':
          return debugSeal;
        case 'debugFreeze':
          return debugFreeze;
        case 'runInDebug':
          return runInDebug;
        case 'deprecateFunc':
          return deprecateFunc;
      }
    };
  }
  /**
  @module @ember/debug
  */
  if (true /* DEBUG */) {
    /**
      Verify that a certain expectation is met, or throw a exception otherwise.
         This is useful for communicating assumptions in the code to other human
      readers as well as catching bugs that accidentally violates these
      expectations.
         Assertions are removed from production builds, so they can be freely added
      for documentation and debugging purposes without worries of incuring any
      performance penalty. However, because of that, they should not be used for
      checks that could reasonably fail during normal usage. Furthermore, care
      should be taken to avoid accidentally relying on side-effects produced from
      evaluating the condition itself, since the code will not run in production.
         ```javascript
      import { assert } from '@ember/debug';
         // Test for truthiness
      assert('Must pass a string', typeof str === 'string');
         // Fail unconditionally
      assert('This code path should never be run');
      ```
         @method assert
      @static
      @for @ember/debug
      @param {String} description Describes the expectation. This will become the
        text of the Error thrown if the assertion fails.
      @param {any} condition Must be truthy for the assertion to pass. If
        falsy, an exception will be thrown.
      @public
      @since 1.0.0
    */
    setDebugFunction('assert', function assert(desc, test) {
      if (!test) {
        throw new Error("Assertion Failed: " + desc);
      }
    });
    /**
      Display a debug notice.
         Calls to this function are not invoked in production builds.
         ```javascript
      import { debug } from '@ember/debug';
         debug('I\'m a debug notice!');
      ```
         @method debug
      @for @ember/debug
      @static
      @param {String} message A debug message to display.
      @public
    */
    setDebugFunction('debug', function debug(message) {
      console.debug("DEBUG: " + message); /* eslint-disable-line no-console */
    });
    /**
      Display an info notice.
         Calls to this function are removed from production builds, so they can be
      freely added for documentation and debugging purposes without worries of
      incuring any performance penalty.
         @method info
      @private
    */
    setDebugFunction('info', function info() {
      console.info(...arguments); /* eslint-disable-line no-console */
    });
    /**
     @module @ember/debug
     @public
    */
    /**
      Alias an old, deprecated method with its new counterpart.
         Display a deprecation warning with the provided message and a stack trace
      (Chrome and Firefox only) when the assigned method is called.
         Calls to this function are removed from production builds, so they can be
      freely added for documentation and debugging purposes without worries of
      incuring any performance penalty.
         ```javascript
      import { deprecateFunc } from '@ember/debug';
         Ember.oldMethod = deprecateFunc('Please use the new, updated method', options, Ember.newMethod);
      ```
         @method deprecateFunc
      @static
      @for @ember/debug
      @param {String} message A description of the deprecation.
      @param {Object} [options] The options object for `deprecate`.
      @param {Function} func The new function called to replace its deprecated counterpart.
      @return {Function} A new function that wraps the original function with a deprecation warning
      @private
    */
    setDebugFunction('deprecateFunc', function deprecateFunc() {
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }
      if (args.length === 3) {
        var [message, options, func] = args;
        return function () {
          deprecate(message, false, options);
          for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
            args[_key2] = arguments[_key2];
          }
          return func.apply(this, args);
        };
      } else {
        var [_message, _func] = args;
        return function () {
          deprecate(_message);
          return _func.apply(this, arguments);
        };
      }
    });
    /**
     @module @ember/debug
     @public
    */
    /**
      Run a function meant for debugging.
         Calls to this function are removed from production builds, so they can be
      freely added for documentation and debugging purposes without worries of
      incuring any performance penalty.
         ```javascript
      import Component from '@ember/component';
      import { runInDebug } from '@ember/debug';
         runInDebug(() => {
        Component.reopen({
          didInsertElement() {
            console.log("I'm happy");
          }
        });
      });
      ```
         @method runInDebug
      @for @ember/debug
      @static
      @param {Function} func The function to be executed.
      @since 1.5.0
      @public
    */
    setDebugFunction('runInDebug', function runInDebug(func) {
      func();
    });
    setDebugFunction('debugSeal', function debugSeal(obj) {
      Object.seal(obj);
    });
    setDebugFunction('debugFreeze', function debugFreeze(obj) {
      // re-freezing an already frozen object introduces a significant
      // performance penalty on Chrome (tested through 59).
      //
      // See: https://bugs.chromium.org/p/v8/issues/detail?id=6450
      if (!Object.isFrozen(obj)) {
        Object.freeze(obj);
      }
    });
    setDebugFunction('deprecate', _deprecate2.default);
    setDebugFunction('warn', _warn2.default);
  }
  var _warnIfUsingStrippedFeatureFlags;
  _exports._warnIfUsingStrippedFeatureFlags = _warnIfUsingStrippedFeatureFlags;
  if (true /* DEBUG */ && !(0, _testing.isTesting)()) {
    if (typeof window !== 'undefined' && (_browserEnvironment.isFirefox || _browserEnvironment.isChrome) && window.addEventListener) {
      window.addEventListener('load', () => {
        if (document.documentElement && document.documentElement.dataset && !document.documentElement.dataset['emberExtension']) {
          var downloadURL;
          if (_browserEnvironment.isChrome) {
            downloadURL = 'https://chrome.google.com/webstore/detail/ember-inspector/bmdblncegkenkacieihfhpjfppoconhi';
          } else if (_browserEnvironment.isFirefox) {
            downloadURL = 'https://addons.mozilla.org/en-US/firefox/addon/ember-inspector/';
          }
          debug("For more advanced debugging, install the Ember Inspector from " + downloadURL);
        }
      }, false);
    }
  }
});
define("@ember/debug/lib/capture-render-tree", ["exports", "@glimmer/util"], function (_exports, _util) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = captureRenderTree;
  /**
    @module @ember/debug
  */
  /**
    Ember Inspector calls this function to capture the current render tree.

    In production mode, this requires turning on `ENV._DEBUG_RENDER_TREE`
    before loading Ember.

    @private
    @static
    @method captureRenderTree
    @for @ember/debug
    @param app {ApplicationInstance} An `ApplicationInstance`.
    @since 3.14.0
  */
  function captureRenderTree(app) {
    // SAFETY: Ideally we'd assert here but that causes awkward circular requires since this is also in @ember/debug.
    // This is only for debug stuff so not very risky.
    var renderer = (0, _util.expect)(app.lookup('renderer:-dom'), "BUG: owner is missing renderer");
    return renderer.debugRenderTree.capture();
  }
});
define("@ember/debug/lib/deprecate", ["exports", "@ember/-internals/environment", "@ember/debug/index", "@ember/debug/lib/handlers"], function (_exports, _environment, _index, _handlers) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.registerHandler = _exports.missingOptionsIdDeprecation = _exports.missingOptionsDeprecation = _exports.missingOptionDeprecation = _exports.default = void 0;
  /**
   @module @ember/debug
   @public
  */
  /**
    Allows for runtime registration of handler functions that override the default deprecation behavior.
    Deprecations are invoked by calls to [@ember/debug/deprecate](/ember/release/classes/@ember%2Fdebug/methods/deprecate?anchor=deprecate).
    The following example demonstrates its usage by registering a handler that throws an error if the
    message contains the word "should", otherwise defers to the default handler.

    ```javascript
    import { registerDeprecationHandler } from '@ember/debug';

    registerDeprecationHandler((message, options, next) => {
      if (message.indexOf('should') !== -1) {
        throw new Error(`Deprecation message with should: ${message}`);
      } else {
        // defer to whatever handler was registered before this one
        next(message, options);
      }
    });
    ```

    The handler function takes the following arguments:

    <ul>
      <li> <code>message</code> - The message received from the deprecation call.</li>
      <li> <code>options</code> - An object passed in with the deprecation call containing additional information including:</li>
        <ul>
          <li> <code>id</code> - An id of the deprecation in the form of <code>package-name.specific-deprecation</code>.</li>
          <li> <code>until</code> - The Ember version number the feature and deprecation will be removed in.</li>
        </ul>
      <li> <code>next</code> - A function that calls into the previously registered handler.</li>
    </ul>

    @public
    @static
    @method registerDeprecationHandler
    @for @ember/debug
    @param handler {Function} A function to handle deprecation calls.
    @since 2.1.0
  */
  var registerHandler = () => {};
  _exports.registerHandler = registerHandler;
  var missingOptionsDeprecation;
  _exports.missingOptionsDeprecation = missingOptionsDeprecation;
  var missingOptionsIdDeprecation;
  _exports.missingOptionsIdDeprecation = missingOptionsIdDeprecation;
  var missingOptionDeprecation = () => '';
  _exports.missingOptionDeprecation = missingOptionDeprecation;
  var deprecate = () => {};
  if (true /* DEBUG */) {
    _exports.registerHandler = registerHandler = function registerHandler(handler) {
      (0, _handlers.registerHandler)('deprecate', handler);
    };
    var formatMessage = function formatMessage(_message, options) {
      var message = _message;
      if (options != null && options.id) {
        message = message + (" [deprecation id: " + options.id + "]");
      }
      if (options != null && options.until) {
        message = message + (" This will be removed in " + options.for + " " + options.until + ".");
      }
      if (options != null && options.url) {
        message += " See " + options.url + " for more details.";
      }
      return message;
    };
    registerHandler(function logDeprecationToConsole(message, options) {
      var updatedMessage = formatMessage(message, options);
      console.warn("DEPRECATION: " + updatedMessage); // eslint-disable-line no-console
    });

    var captureErrorForStack;
    if (new Error().stack) {
      captureErrorForStack = () => new Error();
    } else {
      captureErrorForStack = () => {
        try {
          __fail__.fail();
          return;
        } catch (e) {
          return e;
        }
      };
    }
    registerHandler(function logDeprecationStackTrace(message, options, next) {
      if (_environment.ENV.LOG_STACKTRACE_ON_DEPRECATION) {
        var stackStr = '';
        var error = captureErrorForStack();
        var stack;
        if (error instanceof Error) {
          if (error.stack) {
            if (error['arguments']) {
              // Chrome
              stack = error.stack.replace(/^\s+at\s+/gm, '').replace(/^([^(]+?)([\n$])/gm, '{anonymous}($1)$2').replace(/^Object.<anonymous>\s*\(([^)]+)\)/gm, '{anonymous}($1)').split('\n');
              stack.shift();
            } else {
              // Firefox
              stack = error.stack.replace(/(?:\n@:0)?\s+$/m, '').replace(/^\(/gm, '{anonymous}(').split('\n');
            }
            stackStr = "\n    " + stack.slice(2).join('\n    ');
          }
        }
        var updatedMessage = formatMessage(message, options);
        console.warn("DEPRECATION: " + updatedMessage + stackStr); // eslint-disable-line no-console
      } else {
        next(message, options);
      }
    });
    registerHandler(function raiseOnDeprecation(message, options, next) {
      if (_environment.ENV.RAISE_ON_DEPRECATION) {
        var updatedMessage = formatMessage(message);
        throw new Error(updatedMessage);
      } else {
        next(message, options);
      }
    });
    _exports.missingOptionsDeprecation = missingOptionsDeprecation = 'When calling `deprecate` you ' + 'must provide an `options` hash as the third parameter.  ' + '`options` should include `id` and `until` properties.';
    _exports.missingOptionsIdDeprecation = missingOptionsIdDeprecation = 'When calling `deprecate` you must provide `id` in options.';
    _exports.missingOptionDeprecation = missingOptionDeprecation = (id, missingOption) => {
      return "When calling `deprecate` you must provide `" + missingOption + "` in options. Missing options." + missingOption + " in \"" + id + "\" deprecation";
    };
    /**
     @module @ember/debug
     @public
     */
    /**
      Display a deprecation warning with the provided message and a stack trace
      (Chrome and Firefox only).
         Ember itself leverages [Semantic Versioning](https://semver.org) to aid
      projects in keeping up with changes to the framework. Before any
      functionality or API is removed, it first flows linearly through a
      deprecation staging process. The staging process currently contains two
      stages: available and enabled.
         Deprecations are initially released into the 'available' stage.
      Deprecations will stay in this stage until the replacement API has been
      marked as a recommended practice via the RFC process and the addon
      ecosystem has generally adopted the change.
         Once a deprecation meets the above criteria, it will move into the
      'enabled' stage where it will remain until the functionality or API is
      eventually removed.
         For application and addon developers, "available" deprecations are not
      urgent and "enabled" deprecations require action.
         * In a production build, this method is defined as an empty function (NOP).
      Uses of this method in Ember itself are stripped from the ember.prod.js build.
         ```javascript
      import { deprecate } from '@ember/debug';
         deprecate(
        'Use of `assign` has been deprecated. Please use `Object.assign` or the spread operator instead.',
        false,
        {
          id: 'ember-polyfills.deprecate-assign',
          until: '5.0.0',
          url: 'https://deprecations.emberjs.com/v4.x/#toc_ember-polyfills-deprecate-assign',
          for: 'ember-source',
          since: {
            available: '4.0.0',
            enabled: '4.0.0',
          },
        }
      );
      ```
         @method deprecate
      @for @ember/debug
      @param {String} message A description of the deprecation.
      @param {Boolean} test A boolean. If falsy, the deprecation will be displayed.
      @param {Object} options
      @param {String} options.id A unique id for this deprecation. The id can be
        used by Ember debugging tools to change the behavior (raise, log or silence)
        for that specific deprecation. The id should be namespaced by dots, e.g.
        "view.helper.select".
      @param {string} options.until The version of Ember when this deprecation
        warning will be removed.
      @param {String} options.for A namespace for the deprecation, usually the package name
      @param {Object} options.since Describes when the deprecation became available and enabled.
      @param {String} [options.url] An optional url to the transition guide on the
            emberjs.com website.
      @static
      @public
      @since 1.0.0
    */
    deprecate = function deprecate(message, test, options) {
      (0, _index.assert)(missingOptionsDeprecation, Boolean(options && (options.id || options.until)));
      (0, _index.assert)(missingOptionsIdDeprecation, Boolean(options.id));
      (0, _index.assert)(missingOptionDeprecation(options.id, 'until'), Boolean(options.until));
      (0, _index.assert)(missingOptionDeprecation(options.id, 'for'), Boolean(options.for));
      (0, _index.assert)(missingOptionDeprecation(options.id, 'since'), Boolean(options.since));
      (0, _handlers.invoke)('deprecate', message, test, options);
    };
  }
  var _default = deprecate;
  _exports.default = _default;
});
define("@ember/debug/lib/handlers", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.registerHandler = _exports.invoke = _exports.HANDLERS = void 0;
  var HANDLERS = {};
  _exports.HANDLERS = HANDLERS;
  var registerHandler = function registerHandler(_type, _callback) {};
  _exports.registerHandler = registerHandler;
  var invoke = () => {};
  _exports.invoke = invoke;
  if (true /* DEBUG */) {
    _exports.registerHandler = registerHandler = function registerHandler(type, callback) {
      var nextHandler = HANDLERS[type] || (() => {});
      HANDLERS[type] = (message, options) => {
        callback(message, options, nextHandler);
      };
    };
    _exports.invoke = invoke = function invoke(type, message, test, options) {
      if (test) {
        return;
      }
      var handlerForType = HANDLERS[type];
      if (handlerForType) {
        handlerForType(message, options);
      }
    };
  }
});
define("@ember/debug/lib/inspect", ["exports", "@glimmer/util", "@ember/debug"], function (_exports, _util, _debug) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = inspect;
  var {
    toString: objectToString
  } = Object.prototype;
  var {
    toString: functionToString
  } = Function.prototype;
  var {
    isArray
  } = Array;
  var {
    keys: objectKeys
  } = Object;
  var {
    stringify
  } = JSON;
  var LIST_LIMIT = 100;
  var DEPTH_LIMIT = 4;
  var SAFE_KEY = /^[\w$]+$/;
  /**
   @module @ember/debug
  */
  /**
    Convenience method to inspect an object. This method will attempt to
    convert the object into a useful string description.

    It is a pretty simple implementation. If you want something more robust,
    use something like JSDump: https://github.com/NV/jsDump

    @method inspect
    @static
    @param {Object} obj The object you want to inspect.
    @return {String} A description of the object
    @since 1.4.0
    @private
  */
  function inspect(obj) {
    // detect Node util.inspect call inspect(depth: number, opts: object)
    if (typeof obj === 'number' && arguments.length === 2) {
      return this;
    }
    return inspectValue(obj, 0);
  }
  function inspectValue(value, depth, seen) {
    var valueIsArray = false;
    switch (typeof value) {
      case 'undefined':
        return 'undefined';
      case 'object':
        if (value === null) return 'null';
        if (isArray(value)) {
          valueIsArray = true;
          break;
        }
        // is toString Object.prototype.toString or undefined then traverse
        if (value.toString === objectToString || value.toString === undefined) {
          break;
        }
        // custom toString
        return value.toString();
      case 'function':
        return value.toString === functionToString ? value.name ? "[Function:" + value.name + "]" : "[Function]" : value.toString();
      case 'string':
        return stringify(value);
      case 'symbol':
      case 'boolean':
      case 'number':
      default:
        return value.toString();
    }
    if (seen === undefined) {
      seen = new _util._WeakSet();
    } else {
      if (seen.has(value)) return "[Circular]";
    }
    seen.add(value);
    return valueIsArray ? inspectArray(value, depth + 1, seen) : inspectObject(value, depth + 1, seen);
  }
  function inspectKey(key) {
    return SAFE_KEY.test(key) ? key : stringify(key);
  }
  function inspectObject(obj, depth, seen) {
    if (depth > DEPTH_LIMIT) {
      return '[Object]';
    }
    var s = '{';
    var keys = objectKeys(obj);
    for (var i = 0; i < keys.length; i++) {
      s += i === 0 ? ' ' : ', ';
      if (i >= LIST_LIMIT) {
        s += "... " + (keys.length - LIST_LIMIT) + " more keys";
        break;
      }
      var key = keys[i];
      (true && !(key) && (0, _debug.assert)('has key', key)); // Looping over array
      s += inspectKey(String(key)) + ": " + inspectValue(obj[key], depth, seen);
    }
    s += ' }';
    return s;
  }
  function inspectArray(arr, depth, seen) {
    if (depth > DEPTH_LIMIT) {
      return '[Array]';
    }
    var s = '[';
    for (var i = 0; i < arr.length; i++) {
      s += i === 0 ? ' ' : ', ';
      if (i >= LIST_LIMIT) {
        s += "... " + (arr.length - LIST_LIMIT) + " more items";
        break;
      }
      s += inspectValue(arr[i], depth, seen);
    }
    s += ' ]';
    return s;
  }
});
define("@ember/debug/lib/testing", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.isTesting = isTesting;
  _exports.setTesting = setTesting;
  var testing = false;
  function isTesting() {
    return testing;
  }
  function setTesting(value) {
    testing = Boolean(value);
  }
});
define("@ember/debug/lib/warn", ["exports", "@ember/debug/index", "@ember/debug/lib/handlers"], function (_exports, _index, _handlers) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.registerHandler = _exports.missingOptionsIdDeprecation = _exports.missingOptionsDeprecation = _exports.default = void 0;
  var registerHandler = () => {};
  _exports.registerHandler = registerHandler;
  var warn = () => {};
  var missingOptionsDeprecation;
  _exports.missingOptionsDeprecation = missingOptionsDeprecation;
  var missingOptionsIdDeprecation;
  /**
  @module @ember/debug
  */
  _exports.missingOptionsIdDeprecation = missingOptionsIdDeprecation;
  if (true /* DEBUG */) {
    /**
      Allows for runtime registration of handler functions that override the default warning behavior.
      Warnings are invoked by calls made to [@ember/debug/warn](/ember/release/classes/@ember%2Fdebug/methods/warn?anchor=warn).
      The following example demonstrates its usage by registering a handler that does nothing overriding Ember's
      default warning behavior.
         ```javascript
      import { registerWarnHandler } from '@ember/debug';
         // next is not called, so no warnings get the default behavior
      registerWarnHandler(() => {});
      ```
         The handler function takes the following arguments:
         <ul>
        <li> <code>message</code> - The message received from the warn call. </li>
        <li> <code>options</code> - An object passed in with the warn call containing additional information including:</li>
          <ul>
            <li> <code>id</code> - An id of the warning in the form of <code>package-name.specific-warning</code>.</li>
          </ul>
        <li> <code>next</code> - A function that calls into the previously registered handler.</li>
      </ul>
         @public
      @static
      @method registerWarnHandler
      @for @ember/debug
      @param handler {Function} A function to handle warnings.
      @since 2.1.0
    */
    _exports.registerHandler = registerHandler = function registerHandler(handler) {
      (0, _handlers.registerHandler)('warn', handler);
    };
    registerHandler(function logWarning(message) {
      /* eslint-disable no-console */
      console.warn("WARNING: " + message);
      /* eslint-enable no-console */
    });

    _exports.missingOptionsDeprecation = missingOptionsDeprecation = 'When calling `warn` you ' + 'must provide an `options` hash as the third parameter.  ' + '`options` should include an `id` property.';
    _exports.missingOptionsIdDeprecation = missingOptionsIdDeprecation = 'When calling `warn` you must provide `id` in options.';
    /**
      Display a warning with the provided message.
         * In a production build, this method is defined as an empty function (NOP).
      Uses of this method in Ember itself are stripped from the ember.prod.js build.
         ```javascript
      import { warn } from '@ember/debug';
      import tomsterCount from './tomster-counter'; // a module in my project
         // Log a warning if we have more than 3 tomsters
      warn('Too many tomsters!', tomsterCount <= 3, {
        id: 'ember-debug.too-many-tomsters'
      });
      ```
         @method warn
      @for @ember/debug
      @static
      @param {String} message A warning to display.
      @param {Boolean} test An optional boolean. If falsy, the warning
        will be displayed.
      @param {Object} options An object that can be used to pass a unique
        `id` for this warning.  The `id` can be used by Ember debugging tools
        to change the behavior (raise, log, or silence) for that specific warning.
        The `id` should be namespaced by dots, e.g. "ember-debug.feature-flag-with-features-stripped"
      @public
      @since 1.0.0
    */
    warn = function warn(message, test, options) {
      if (arguments.length === 2 && typeof test === 'object') {
        options = test;
        test = false;
      }
      (0, _index.assert)(missingOptionsDeprecation, Boolean(options));
      (0, _index.assert)(missingOptionsIdDeprecation, Boolean(options && options.id));
      (0, _handlers.invoke)('warn', message, test, options);
    };
  }
  var _default = warn;
  _exports.default = _default;
});
define("@ember/deprecated-features/index", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.ASSIGN = void 0;
  /* eslint-disable no-implicit-coercion */
  // These versions should be the version that the deprecation was _introduced_,
  // not the version that the feature will be removed.
  var ASSIGN = !!'4.0.0-beta.1';
  _exports.ASSIGN = ASSIGN;
});
define("@glimmer/compiler", ["exports", "@glimmer/syntax", "@glimmer/util"], function (_exports, _syntax, _util) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.WireFormatDebugger = _exports.ProgramSymbols = _exports.NEWLINE = void 0;
  _exports.buildStatement = buildStatement;
  _exports.buildStatements = buildStatements;
  _exports.c = c;
  _exports.defaultId = void 0;
  _exports.precompile = precompile;
  _exports.precompileJSON = precompileJSON;
  _exports.s = s;
  _exports.unicode = unicode;
  class Template extends (0, _syntax.node)('Template').fields() {}
  class InElement extends (0, _syntax.node)('InElement').fields() {}
  class Not extends (0, _syntax.node)('Not').fields() {}
  class If extends (0, _syntax.node)('If').fields() {}
  class IfInline extends (0, _syntax.node)('IfInline').fields() {}
  class Each extends (0, _syntax.node)('Each').fields() {}
  class With extends (0, _syntax.node)('With').fields() {}
  class Let extends (0, _syntax.node)('Let').fields() {}
  class WithDynamicVars extends (0, _syntax.node)('WithDynamicVars').fields() {}
  class GetDynamicVar extends (0, _syntax.node)('GetDynamicVar').fields() {}
  class Log extends (0, _syntax.node)('Log').fields() {}
  class InvokeComponent extends (0, _syntax.node)('InvokeComponent').fields() {}
  class NamedBlocks extends (0, _syntax.node)('NamedBlocks').fields() {}
  class NamedBlock extends (0, _syntax.node)('NamedBlock').fields() {}
  class EndBlock extends (0, _syntax.node)('EndBlock').fields() {}
  class AppendTrustedHTML extends (0, _syntax.node)('AppendTrustedHTML').fields() {}
  class AppendTextNode extends (0, _syntax.node)('AppendTextNode').fields() {}
  class AppendComment extends (0, _syntax.node)('AppendComment').fields() {}
  class Component extends (0, _syntax.node)('Component').fields() {}
  class StaticAttr extends (0, _syntax.node)('StaticAttr').fields() {}
  class DynamicAttr extends (0, _syntax.node)('DynamicAttr').fields() {}
  class SimpleElement extends (0, _syntax.node)('SimpleElement').fields() {}
  class ElementParameters extends (0, _syntax.node)('ElementParameters').fields() {}
  class Yield extends (0, _syntax.node)('Yield').fields() {}
  class Debugger extends (0, _syntax.node)('Debugger').fields() {}
  class CallExpression extends (0, _syntax.node)('CallExpression').fields() {}
  class DeprecatedCallExpression extends (0, _syntax.node)('DeprecatedCallExpression').fields() {}
  class Modifier extends (0, _syntax.node)('Modifier').fields() {}
  class InvokeBlock extends (0, _syntax.node)('InvokeBlock').fields() {}
  class SplatAttr extends (0, _syntax.node)('SplatAttr').fields() {}
  class PathExpression extends (0, _syntax.node)('PathExpression').fields() {}
  class GetWithResolver extends (0, _syntax.node)('GetWithResolver').fields() {}
  class GetSymbol extends (0, _syntax.node)('GetSymbol').fields() {}
  class GetFreeWithContext extends (0, _syntax.node)('GetFreeWithContext').fields() {}
  /** strict mode */

  class GetFree extends (0, _syntax.node)('GetFree').fields() {}
  class Missing extends (0, _syntax.node)('Missing').fields() {}
  class InterpolateExpression extends (0, _syntax.node)('InterpolateExpression').fields() {}
  class HasBlock extends (0, _syntax.node)('HasBlock').fields() {}
  class HasBlockParams extends (0, _syntax.node)('HasBlockParams').fields() {}
  class Curry extends (0, _syntax.node)('Curry').fields() {}
  class Positional extends (0, _syntax.node)('Positional').fields() {}
  class NamedArguments extends (0, _syntax.node)('NamedArguments').fields() {}
  class NamedArgument extends (0, _syntax.node)('NamedArgument').fields() {}
  class Args extends (0, _syntax.node)('Args').fields() {}
  class Tail extends (0, _syntax.node)('Tail').fields() {}
  class PresentList {
    constructor(list) {
      this.list = list;
    }
    toArray() {
      return this.list;
    }
    map(callback) {
      var result = (0, _util.mapPresent)(this.list, callback);
      return new PresentList(result);
    }
    filter(predicate) {
      var out = [];
      for (var item of this.list) {
        if (predicate(item)) {
          out.push(item);
        }
      }
      return OptionalList(out);
    }
    toPresentArray() {
      return this.list;
    }
    into(_ref) {
      var {
        ifPresent
      } = _ref;
      return ifPresent(this);
    }
  }
  class EmptyList {
    constructor() {
      this.list = [];
    }
    map(_callback) {
      return new EmptyList();
    }
    filter(_predicate) {
      return new EmptyList();
    }
    toArray() {
      return this.list;
    }
    toPresentArray() {
      return null;
    }
    into(_ref2) {
      var {
        ifEmpty
      } = _ref2;
      return ifEmpty();
    }
  } // export type OptionalList<T> = PresentList<T> | EmptyList<T>;

  function OptionalList(value) {
    if ((0, _util.isPresent)(value)) {
      return new PresentList(value);
    } else {
      return new EmptyList();
    }
  }
  class ResultImpl {
    static all() {
      var out = [];
      for (var _len = arguments.length, results = new Array(_len), _key = 0; _key < _len; _key++) {
        results[_key] = arguments[_key];
      }
      for (var result of results) {
        if (result.isErr) {
          return result.cast();
        } else {
          out.push(result.value);
        }
      }
      return Ok(out);
    }
  }
  var Result = ResultImpl;
  class OkImpl extends ResultImpl {
    constructor(value) {
      super();
      this.value = value;
      this.isOk = true;
      this.isErr = false;
    }
    expect(_message) {
      return this.value;
    }
    ifOk(callback) {
      callback(this.value);
      return this;
    }
    andThen(callback) {
      return callback(this.value);
    }
    mapOk(callback) {
      return Ok(callback(this.value));
    }
    ifErr(_callback) {
      return this;
    }
    mapErr(_callback) {
      return this;
    }
  }
  class ErrImpl extends ResultImpl {
    constructor(reason) {
      super();
      this.reason = reason;
      this.isOk = false;
      this.isErr = true;
    }
    expect(message) {
      throw new Error(message || 'expected an Ok, got Err');
    }
    andThen(_callback) {
      return this.cast();
    }
    mapOk(_callback) {
      return this.cast();
    }
    ifOk(_callback) {
      return this;
    }
    mapErr(callback) {
      return Err(callback(this.reason));
    }
    ifErr(callback) {
      callback(this.reason);
      return this;
    }
    cast() {
      return this;
    }
  }
  function Ok(value) {
    return new OkImpl(value);
  }
  function Err(reason) {
    return new ErrImpl(reason);
  }
  class ResultArray {
    constructor(items) {
      if (items === void 0) {
        items = [];
      }
      this.items = items;
    }
    add(item) {
      this.items.push(item);
    }
    toArray() {
      var err = this.items.filter(item => item instanceof ErrImpl)[0];
      if (err !== undefined) {
        return err.cast();
      } else {
        return Ok(this.items.map(item => item.value));
      }
    }
    toOptionalList() {
      return this.toArray().mapOk(arr => OptionalList(arr));
    }
  }
  class KeywordImpl {
    constructor(keyword, type, delegate) {
      this.keyword = keyword;
      this.delegate = delegate;
      var nodes = new Set();
      for (var nodeType of KEYWORD_NODES[type]) {
        nodes.add(nodeType);
      }
      this.types = nodes;
    }
    match(node) {
      if (!this.types.has(node.type)) {
        return false;
      }
      var path = getCalleeExpression(node);
      if (path !== null && path.type === 'Path' && path.ref.type === 'Free') {
        if (path.tail.length > 0) {
          if (path.ref.resolution.serialize() === 'Loose') {
            // cannot be a keyword reference, keywords do not allow paths (must be
            // relying on implicit this fallback)
            return false;
          }
        }
        return path.ref.name === this.keyword;
      } else {
        return false;
      }
    }
    translate(node, state) {
      if (this.match(node)) {
        var path = getCalleeExpression(node);
        if (path !== null && path.type === 'Path' && path.tail.length > 0) {
          return Err((0, _syntax.generateSyntaxError)("The `" + this.keyword + "` keyword was used incorrectly. It was used as `" + path.loc.asString() + "`, but it cannot be used with additional path segments. \n\nError caused by", node.loc));
        }
        var param = this.delegate.assert(node, state);
        return param.andThen(param => this.delegate.translate({
          node,
          state
        }, param));
      } else {
        return null;
      }
    }
  }
  var KEYWORD_NODES = {
    Call: ['Call'],
    Block: ['InvokeBlock'],
    Append: ['AppendContent'],
    Modifier: ['ElementModifier']
  };
  function keyword(keyword, type, delegate) {
    return new KeywordImpl(keyword, type, delegate);
  }
  function getCalleeExpression(node) {
    switch (node.type) {
      // This covers the inside of attributes and expressions, as well as the callee
      // of call nodes
      case 'Path':
        return node;
      case 'AppendContent':
        return getCalleeExpression(node.value);
      case 'Call':
      case 'InvokeBlock':
      case 'ElementModifier':
        return node.callee;
      default:
        return null;
    }
  }
  class Keywords {
    constructor(type) {
      this._keywords = [];
      this._type = type;
    }
    kw(name, delegate) {
      this._keywords.push(keyword(name, this._type, delegate));
      return this;
    }
    translate(node, state) {
      for (var _keyword of this._keywords) {
        var result = _keyword.translate(node, state);
        if (result !== null) {
          return result;
        }
      }
      var path = getCalleeExpression(node);
      if (path && path.type === 'Path' && path.ref.type === 'Free' && (0, _syntax.isKeyword)(path.ref.name)) {
        var {
          name
        } = path.ref;
        var usedType = this._type;
        var validTypes = _syntax.KEYWORDS_TYPES[name];
        if (validTypes.indexOf(usedType) === -1) {
          return Err((0, _syntax.generateSyntaxError)("The `" + name + "` keyword was used incorrectly. It was used as " + typesToReadableName[usedType] + ", but its valid usages are:\n\n" + generateTypesMessage(name, validTypes) + "\n\nError caused by", node.loc));
        }
      }
      return null;
    }
  }
  var typesToReadableName = {
    Append: 'an append statement',
    Block: 'a block statement',
    Call: 'a call expression',
    Modifier: 'a modifier'
  };
  function generateTypesMessage(name, types) {
    return types.map(type => {
      switch (type) {
        case 'Append':
          return "- As an append statement, as in: {{" + name + "}}";
        case 'Block':
          return "- As a block statement, as in: {{#" + name + "}}{{/" + name + "}}";
        case 'Call':
          return "- As an expression, as in: (" + name + ")";
        case 'Modifier':
          return "- As a modifier, as in: <div {{" + name + "}}></div>";
        default:
          return (0, _util.exhausted)(type);
      }
    }).join('\n\n');
  }
  /**
   * This function builds keyword definitions for a particular type of AST node (`KeywordType`).
   *
   * You can build keyword definitions for:
   *
   * - `Expr`: A `SubExpression` or `PathExpression`
   * - `Block`: A `BlockStatement`
   *   - A `BlockStatement` is a keyword candidate if its head is a
   *     `PathExpression`
   * - `Append`: An `AppendStatement`
   *
   * A node is a keyword candidate if:
   *
   * - A `PathExpression` is a keyword candidate if it has no tail, and its
   *   head expression is a `LocalVarHead` or `FreeVarHead` whose name is
   *   the keyword's name.
   * - A `SubExpression`, `AppendStatement`, or `BlockStatement` is a keyword
   *   candidate if its head is a keyword candidate.
   *
   * The keyword infrastructure guarantees that:
   *
   * - If a node is not a keyword candidate, it is never passed to any keyword's
   *   `assert` method.
   * - If a node is not the `KeywordType` for a particular keyword, it will not
   *   be passed to the keyword's `assert` method.
   *
   * `Expr` keywords are used in expression positions and should return HIR
   * expressions. `Block` and `Append` keywords are used in statement
   * positions and should return HIR statements.
   *
   * A keyword definition has two parts:
   *
   * - `match`, which determines whether an AST node matches the keyword, and can
   *   optionally return some information extracted from the AST node.
   * - `translate`, which takes a matching AST node as well as the extracted
   *   information and returns an appropriate HIR instruction.
   *
   * # Example
   *
   * This keyword:
   *
   * - turns `(hello)` into `"hello"`
   *   - as long as `hello` is not in scope
   * - makes it an error to pass any arguments (such as `(hello world)`)
   *
   * ```ts
   * keywords('SubExpr').kw('hello', {
   *   assert(node: ExprKeywordNode): Result<void> | false {
   *     // we don't want to transform `hello` as a `PathExpression`
   *     if (node.type !== 'SubExpression') {
   *       return false;
   *     }
   *
   *     // node.head would be `LocalVarHead` if `hello` was in scope
   *     if (node.head.type !== 'FreeVarHead') {
   *       return false;
   *     }
   *
   *     if (node.params.length || node.hash) {
   *       return Err(generateSyntaxError(`(hello) does not take any arguments`), node.loc);
   *     } else {
   *       return Ok();
   *     }
   *   },
   *
   *   translate(node: ASTv2.SubExpression): hir.Expression {
   *     return ASTv2.builders.literal("hello", node.loc)
   *   }
   * })
   * ```
   *
   * The keyword infrastructure checks to make sure that the node is the right
   * type before calling `assert`, so you only need to consider `SubExpression`
   * and `PathExpression` here. It also checks to make sure that the node passed
   * to `assert` has the keyword name in the right place.
   *
   * Note the important difference between returning `false` from `assert`,
   * which just means that the node didn't match, and returning `Err`, which
   * means that the node matched, but there was a keyword-specific syntax
   * error.
   */

  function keywords(type) {
    return new Keywords(type);
  }
  function hasPath(node) {
    return node.callee.type === 'Path';
  }
  function isHelperInvocation(node) {
    if (!hasPath(node)) {
      return false;
    }
    return !node.args.isEmpty();
  }
  function isSimplePath(path) {
    if (path.type === 'Path') {
      var {
        ref: head,
        tail: parts
      } = path;
      return head.type === 'Free' && head.resolution !== _syntax.ASTv2.STRICT_RESOLUTION && parts.length === 0;
    } else {
      return false;
    }
  }
  function isStrictHelper(expr) {
    if (expr.callee.type !== 'Path') {
      return true;
    }
    if (expr.callee.ref.type !== 'Free') {
      return true;
    }
    return expr.callee.ref.resolution === _syntax.ASTv2.STRICT_RESOLUTION;
  }
  function assertIsValidModifier(helper) {
    if (isStrictHelper(helper) || isSimplePath(helper.callee)) {
      return;
    }
    throw (0, _syntax.generateSyntaxError)("`" + printPath(helper.callee) + "` is not a valid name for a modifier", helper.loc);
  }
  function printPath(path) {
    switch (path.type) {
      case 'Literal':
        return JSON.stringify(path.value);
      case 'Path':
        {
          var printedPath = [printPathHead(path.ref)];
          printedPath.push(...path.tail.map(t => t.chars));
          return printedPath.join('.');
        }
      case 'Call':
        return "(" + printPath(path.callee) + " ...)";
      case 'DeprecatedCall':
        return "" + path.callee.name;
      case 'Interpolate':
        throw (0, _util.unreachable)('a concat statement cannot appear as the head of an expression');
    }
  }
  function printPathHead(head) {
    switch (head.type) {
      case 'Arg':
        return head.name.chars;
      case 'Free':
      case 'Local':
        return head.name;
      case 'This':
        return 'this';
    }
  }
  class NormalizeExpressions {
    visit(node, state) {
      switch (node.type) {
        case 'Literal':
          return Ok(this.Literal(node));
        case 'Interpolate':
          return this.Interpolate(node, state);
        case 'Path':
          return this.PathExpression(node);
        case 'Call':
          var translated = CALL_KEYWORDS.translate(node, state);
          if (translated !== null) {
            return translated;
          }
          return this.CallExpression(node, state);
        case 'DeprecatedCall':
          return this.DeprecaedCallExpression(node, state);
      }
    }
    visitList(nodes, state) {
      return new ResultArray(nodes.map(e => VISIT_EXPRS.visit(e, state))).toOptionalList();
    }
    /**
     * Normalize paths into `hir.Path` or a `hir.Expr` that corresponds to the ref.
     *
     * TODO since keywords don't support tails anyway, distinguish PathExpression from
     * VariableReference in ASTv2.
     */

    PathExpression(path) {
      var ref = this.VariableReference(path.ref);
      var {
        tail
      } = path;
      if ((0, _util.isPresent)(tail)) {
        var tailLoc = tail[0].loc.extend(tail[tail.length - 1].loc);
        return Ok(new PathExpression({
          loc: path.loc,
          head: ref,
          tail: new Tail({
            loc: tailLoc,
            members: tail
          })
        }));
      } else {
        return Ok(ref);
      }
    }
    VariableReference(ref) {
      return ref;
    }
    Literal(literal) {
      return literal;
    }
    Interpolate(expr, state) {
      var parts = expr.parts.map(convertPathToCallIfKeyword);
      return VISIT_EXPRS.visitList(parts, state).mapOk(parts => new InterpolateExpression({
        loc: expr.loc,
        parts: parts
      }));
    }
    CallExpression(expr, state) {
      if (!hasPath(expr)) {
        throw new Error("unimplemented subexpression at the head of a subexpression");
      } else {
        return Result.all(VISIT_EXPRS.visit(expr.callee, state), VISIT_EXPRS.Args(expr.args, state)).mapOk(_ref3 => {
          var [callee, args] = _ref3;
          return new CallExpression({
            loc: expr.loc,
            callee,
            args
          });
        });
      }
    }
    DeprecaedCallExpression(_ref4, _state) {
      var {
        arg,
        callee,
        loc
      } = _ref4;
      return Ok(new DeprecatedCallExpression({
        loc,
        arg,
        callee
      }));
    }
    Args(_ref5, state) {
      var {
        positional,
        named,
        loc
      } = _ref5;
      return Result.all(this.Positional(positional, state), this.NamedArguments(named, state)).mapOk(_ref6 => {
        var [positional, named] = _ref6;
        return new Args({
          loc,
          positional,
          named
        });
      });
    }
    Positional(positional, state) {
      return VISIT_EXPRS.visitList(positional.exprs, state).mapOk(list => new Positional({
        loc: positional.loc,
        list
      }));
    }
    NamedArguments(named, state) {
      var pairs = named.entries.map(arg => {
        var value = convertPathToCallIfKeyword(arg.value);
        return VISIT_EXPRS.visit(value, state).mapOk(value => new NamedArgument({
          loc: arg.loc,
          key: arg.name,
          value
        }));
      });
      return new ResultArray(pairs).toOptionalList().mapOk(pairs => new NamedArguments({
        loc: named.loc,
        entries: pairs
      }));
    }
  }
  function convertPathToCallIfKeyword(path) {
    if (path.type === 'Path' && path.ref.type === 'Free' && path.ref.name in _syntax.KEYWORDS_TYPES) {
      return new _syntax.ASTv2.CallExpression({
        callee: path,
        args: _syntax.ASTv2.Args.empty(path.loc),
        loc: path.loc
      });
    }
    return path;
  }
  var VISIT_EXPRS = new NormalizeExpressions();
  var CurriedTypeToReadableType = {
    [0
    /* Component */]: 'component',
    [1
    /* Helper */]: 'helper',
    [2
    /* Modifier */]: 'modifier'
  };
  function assertCurryKeyword(curriedType) {
    return (node, state) => {
      var readableType = CurriedTypeToReadableType[curriedType];
      var stringsAllowed = curriedType === 0
      /* Component */;

      var {
        args
      } = node;
      var definition = args.nth(0);
      if (definition === null) {
        return Err((0, _syntax.generateSyntaxError)("(" + readableType + ") requires a " + readableType + " definition or identifier as its first positional parameter, did not receive any parameters.", args.loc));
      }
      if (definition.type === 'Literal') {
        if (stringsAllowed && state.isStrict) {
          return Err((0, _syntax.generateSyntaxError)("(" + readableType + ") cannot resolve string values in strict mode templates", node.loc));
        } else if (!stringsAllowed) {
          return Err((0, _syntax.generateSyntaxError)("(" + readableType + ") cannot resolve string values, you must pass a " + readableType + " definition directly", node.loc));
        }
      }
      args = new _syntax.ASTv2.Args({
        positional: new _syntax.ASTv2.PositionalArguments({
          exprs: args.positional.exprs.slice(1),
          loc: args.positional.loc
        }),
        named: args.named,
        loc: args.loc
      });
      return Ok({
        definition,
        args
      });
    };
  }
  function translateCurryKeyword(curriedType) {
    return (_ref7, _ref8) => {
      var {
        node,
        state
      } = _ref7;
      var {
        definition,
        args
      } = _ref8;
      var definitionResult = VISIT_EXPRS.visit(definition, state);
      var argsResult = VISIT_EXPRS.Args(args, state);
      return Result.all(definitionResult, argsResult).mapOk(_ref9 => {
        var [definition, args] = _ref9;
        return new Curry({
          loc: node.loc,
          curriedType,
          definition,
          args
        });
      });
    };
  }
  function curryKeyword(curriedType) {
    return {
      assert: assertCurryKeyword(curriedType),
      translate: translateCurryKeyword(curriedType)
    };
  }
  function assertGetDynamicVarKeyword(node) {
    var call = node.type === 'AppendContent' ? node.value : node;
    var named = call.type === 'Call' ? call.args.named : null;
    var positionals = call.type === 'Call' ? call.args.positional : null;
    if (named && !named.isEmpty()) {
      return Err((0, _syntax.generateSyntaxError)("(-get-dynamic-vars) does not take any named arguments", node.loc));
    }
    var varName = positionals === null || positionals === void 0 ? void 0 : positionals.nth(0);
    if (!varName) {
      return Err((0, _syntax.generateSyntaxError)("(-get-dynamic-vars) requires a var name to get", node.loc));
    }
    if (positionals && positionals.size > 1) {
      return Err((0, _syntax.generateSyntaxError)("(-get-dynamic-vars) only receives one positional arg", node.loc));
    }
    return Ok(varName);
  }
  function translateGetDynamicVarKeyword(_ref10, name) {
    var {
      node,
      state
    } = _ref10;
    return VISIT_EXPRS.visit(name, state).mapOk(name => new GetDynamicVar({
      name,
      loc: node.loc
    }));
  }
  var getDynamicVarKeyword = {
    assert: assertGetDynamicVarKeyword,
    translate: translateGetDynamicVarKeyword
  };
  function assertHasBlockKeyword(type) {
    return node => {
      var call = node.type === 'AppendContent' ? node.value : node;
      var named = call.type === 'Call' ? call.args.named : null;
      var positionals = call.type === 'Call' ? call.args.positional : null;
      if (named && !named.isEmpty()) {
        return Err((0, _syntax.generateSyntaxError)("(" + type + ") does not take any named arguments", call.loc));
      }
      if (!positionals || positionals.isEmpty()) {
        return Ok(_syntax.SourceSlice.synthetic('default'));
      } else if (positionals.exprs.length === 1) {
        var positional = positionals.exprs[0];
        if (_syntax.ASTv2.isLiteral(positional, 'string')) {
          return Ok(positional.toSlice());
        } else {
          return Err((0, _syntax.generateSyntaxError)("(" + type + ") can only receive a string literal as its first argument", call.loc));
        }
      } else {
        return Err((0, _syntax.generateSyntaxError)("(" + type + ") only takes a single positional argument", call.loc));
      }
    };
  }
  function translateHasBlockKeyword(type) {
    return (_ref11, target) => {
      var {
        node,
        state: {
          scope
        }
      } = _ref11;
      var block = type === 'has-block' ? new HasBlock({
        loc: node.loc,
        target,
        symbol: scope.allocateBlock(target.chars)
      }) : new HasBlockParams({
        loc: node.loc,
        target,
        symbol: scope.allocateBlock(target.chars)
      });
      return Ok(block);
    };
  }
  function hasBlockKeyword(type) {
    return {
      assert: assertHasBlockKeyword(type),
      translate: translateHasBlockKeyword(type)
    };
  }
  function assertIfUnlessInlineKeyword(type) {
    return originalNode => {
      var _a;
      var inverted = type === 'unless';
      var node = originalNode.type === 'AppendContent' ? originalNode.value : originalNode;
      var named = node.type === 'Call' ? node.args.named : null;
      var positional = node.type === 'Call' ? node.args.positional : null;
      if (named && !named.isEmpty()) {
        return Err((0, _syntax.generateSyntaxError)("(" + type + ") cannot receive named parameters, received " + named.entries.map(e => e.name.chars).join(', '), originalNode.loc));
      }
      var condition = positional === null || positional === void 0 ? void 0 : positional.nth(0);
      if (!positional || !condition) {
        return Err((0, _syntax.generateSyntaxError)("When used inline, (" + type + ") requires at least two parameters 1. the condition that determines the state of the (" + type + "), and 2. the value to return if the condition is " + (inverted ? 'false' : 'true') + ". Did not receive any parameters", originalNode.loc));
      }
      var truthy = positional.nth(1);
      var falsy = positional.nth(2);
      if (truthy === null) {
        return Err((0, _syntax.generateSyntaxError)("When used inline, (" + type + ") requires at least two parameters 1. the condition that determines the state of the (" + type + "), and 2. the value to return if the condition is " + (inverted ? 'false' : 'true') + ". Received only one parameter, the condition", originalNode.loc));
      }
      if (positional.size > 3) {
        return Err((0, _syntax.generateSyntaxError)("When used inline, (" + type + ") can receive a maximum of three positional parameters 1. the condition that determines the state of the (" + type + "), 2. the value to return if the condition is " + (inverted ? 'false' : 'true') + ", and 3. the value to return if the condition is " + (inverted ? 'true' : 'false') + ". Received " + ((_a = positional === null || positional === void 0 ? void 0 : positional.size) !== null && _a !== void 0 ? _a : 0) + " parameters", originalNode.loc));
      }
      return Ok({
        condition,
        truthy,
        falsy
      });
    };
  }
  function translateIfUnlessInlineKeyword(type) {
    var inverted = type === 'unless';
    return (_ref12, _ref13) => {
      var {
        node,
        state
      } = _ref12;
      var {
        condition,
        truthy,
        falsy
      } = _ref13;
      var conditionResult = VISIT_EXPRS.visit(condition, state);
      var truthyResult = VISIT_EXPRS.visit(truthy, state);
      var falsyResult = falsy ? VISIT_EXPRS.visit(falsy, state) : Ok(null);
      return Result.all(conditionResult, truthyResult, falsyResult).mapOk(_ref14 => {
        var [condition, truthy, falsy] = _ref14;
        if (inverted) {
          condition = new Not({
            value: condition,
            loc: node.loc
          });
        }
        return new IfInline({
          loc: node.loc,
          condition,
          truthy,
          falsy
        });
      });
    };
  }
  function ifUnlessInlineKeyword(type) {
    return {
      assert: assertIfUnlessInlineKeyword(type),
      translate: translateIfUnlessInlineKeyword(type)
    };
  }
  function assertLogKeyword(node) {
    var {
      args: {
        named,
        positional
      }
    } = node;
    if (named && !named.isEmpty()) {
      return Err((0, _syntax.generateSyntaxError)("(log) does not take any named arguments", node.loc));
    }
    return Ok(positional);
  }
  function translateLogKeyword(_ref15, positional) {
    var {
      node,
      state
    } = _ref15;
    return VISIT_EXPRS.Positional(positional, state).mapOk(positional => new Log({
      positional,
      loc: node.loc
    }));
  }
  var logKeyword = {
    assert: assertLogKeyword,
    translate: translateLogKeyword
  };
  var CALL_KEYWORDS = keywords('Call').kw('has-block', hasBlockKeyword('has-block')).kw('has-block-params', hasBlockKeyword('has-block-params')).kw('-get-dynamic-var', getDynamicVarKeyword).kw('log', logKeyword).kw('if', ifUnlessInlineKeyword('if')).kw('unless', ifUnlessInlineKeyword('unless')).kw('component', curryKeyword(0
  /* Component */)).kw('helper', curryKeyword(1
  /* Helper */)).kw('modifier', curryKeyword(2
  /* Modifier */));

  function toAppend(_ref16) {
    var {
      assert,
      translate
    } = _ref16;
    return {
      assert,
      translate(_ref17, value) {
        var {
          node,
          state
        } = _ref17;
        var result = translate({
          node,
          state
        }, value);
        return result.mapOk(text => new AppendTextNode({
          text,
          loc: node.loc
        }));
      }
    };
  }
  var APPEND_KEYWORDS = keywords('Append').kw('has-block', toAppend(hasBlockKeyword('has-block'))).kw('has-block-params', toAppend(hasBlockKeyword('has-block-params'))).kw('-get-dynamic-var', toAppend(getDynamicVarKeyword)).kw('log', toAppend(logKeyword)).kw('if', toAppend(ifUnlessInlineKeyword('if'))).kw('unless', toAppend(ifUnlessInlineKeyword('unless'))).kw('yield', {
    assert(node) {
      var {
        args
      } = node;
      if (args.named.isEmpty()) {
        return Ok({
          target: _syntax.SourceSpan.synthetic('default').toSlice(),
          positional: args.positional
        });
      } else {
        var target = args.named.get('to');
        if (args.named.size > 1 || target === null) {
          return Err((0, _syntax.generateSyntaxError)("yield only takes a single named argument: 'to'", args.named.loc));
        }
        if (_syntax.ASTv2.isLiteral(target, 'string')) {
          return Ok({
            target: target.toSlice(),
            positional: args.positional
          });
        } else {
          return Err((0, _syntax.generateSyntaxError)("you can only yield to a literal string value", target.loc));
        }
      }
    },
    translate(_ref18, _ref19) {
      var {
        node,
        state
      } = _ref18;
      var {
        target,
        positional
      } = _ref19;
      return VISIT_EXPRS.Positional(positional, state).mapOk(positional => new Yield({
        loc: node.loc,
        target,
        to: state.scope.allocateBlock(target.chars),
        positional
      }));
    }
  }).kw('debugger', {
    assert(node) {
      var {
        args
      } = node;
      var {
        positional
      } = args;
      if (args.isEmpty()) {
        return Ok(undefined);
      } else {
        if (positional.isEmpty()) {
          return Err((0, _syntax.generateSyntaxError)("debugger does not take any named arguments", node.loc));
        } else {
          return Err((0, _syntax.generateSyntaxError)("debugger does not take any positional arguments", node.loc));
        }
      }
    },
    translate(_ref20) {
      var {
        node,
        state: {
          scope
        }
      } = _ref20;
      scope.setHasEval();
      return Ok(new Debugger({
        loc: node.loc,
        scope
      }));
    }
  }).kw('component', {
    assert: assertCurryKeyword(0
    /* Component */),

    translate(_ref21, _ref22) {
      var {
        node,
        state
      } = _ref21;
      var {
        definition,
        args
      } = _ref22;
      var definitionResult = VISIT_EXPRS.visit(definition, state);
      var argsResult = VISIT_EXPRS.Args(args, state);
      return Result.all(definitionResult, argsResult).mapOk(_ref23 => {
        var [definition, args] = _ref23;
        return new InvokeComponent({
          loc: node.loc,
          definition,
          args,
          blocks: null
        });
      });
    }
  }).kw('helper', {
    assert: assertCurryKeyword(1
    /* Helper */),

    translate(_ref24, _ref25) {
      var {
        node,
        state
      } = _ref24;
      var {
        definition,
        args
      } = _ref25;
      var definitionResult = VISIT_EXPRS.visit(definition, state);
      var argsResult = VISIT_EXPRS.Args(args, state);
      return Result.all(definitionResult, argsResult).mapOk(_ref26 => {
        var [definition, args] = _ref26;
        var text = new CallExpression({
          callee: definition,
          args,
          loc: node.loc
        });
        return new AppendTextNode({
          loc: node.loc,
          text
        });
      });
    }
  });
  var BLOCK_KEYWORDS = keywords('Block').kw('in-element', {
    assert(node) {
      var {
        args
      } = node;
      var guid = args.get('guid');
      if (guid) {
        return Err((0, _syntax.generateSyntaxError)("Cannot pass `guid` to `{{#in-element}}`", guid.loc));
      }
      var insertBefore = args.get('insertBefore');
      var destination = args.nth(0);
      if (destination === null) {
        return Err((0, _syntax.generateSyntaxError)("{{#in-element}} requires a target element as its first positional parameter", args.loc));
      } // TODO Better syntax checks

      return Ok({
        insertBefore,
        destination
      });
    },
    translate(_ref27, _ref28) {
      var {
        node,
        state
      } = _ref27;
      var {
        insertBefore,
        destination
      } = _ref28;
      var named = node.blocks.get('default');
      var body = VISIT_STMTS.NamedBlock(named, state);
      var destinationResult = VISIT_EXPRS.visit(destination, state);
      return Result.all(body, destinationResult).andThen(_ref29 => {
        var [body, destination] = _ref29;
        if (insertBefore) {
          return VISIT_EXPRS.visit(insertBefore, state).mapOk(insertBefore => ({
            body,
            destination,
            insertBefore
          }));
        } else {
          return Ok({
            body,
            destination,
            insertBefore: new Missing({
              loc: node.callee.loc.collapse('end')
            })
          });
        }
      }).mapOk(_ref30 => {
        var {
          body,
          destination,
          insertBefore
        } = _ref30;
        return new InElement({
          loc: node.loc,
          block: body,
          insertBefore,
          guid: state.generateUniqueCursor(),
          destination
        });
      });
    }
  }).kw('if', {
    assert(node) {
      var {
        args
      } = node;
      if (!args.named.isEmpty()) {
        return Err((0, _syntax.generateSyntaxError)("{{#if}} cannot receive named parameters, received " + args.named.entries.map(e => e.name.chars).join(', '), node.loc));
      }
      if (args.positional.size > 1) {
        return Err((0, _syntax.generateSyntaxError)("{{#if}} can only receive one positional parameter in block form, the conditional value. Received " + args.positional.size + " parameters", node.loc));
      }
      var condition = args.nth(0);
      if (condition === null) {
        return Err((0, _syntax.generateSyntaxError)("{{#if}} requires a condition as its first positional parameter, did not receive any parameters", node.loc));
      }
      return Ok({
        condition
      });
    },
    translate(_ref31, _ref32) {
      var {
        node,
        state
      } = _ref31;
      var {
        condition
      } = _ref32;
      var block = node.blocks.get('default');
      var inverse = node.blocks.get('else');
      var conditionResult = VISIT_EXPRS.visit(condition, state);
      var blockResult = VISIT_STMTS.NamedBlock(block, state);
      var inverseResult = inverse ? VISIT_STMTS.NamedBlock(inverse, state) : Ok(null);
      return Result.all(conditionResult, blockResult, inverseResult).mapOk(_ref33 => {
        var [condition, block, inverse] = _ref33;
        return new If({
          loc: node.loc,
          condition,
          block,
          inverse
        });
      });
    }
  }).kw('unless', {
    assert(node) {
      var {
        args
      } = node;
      if (!args.named.isEmpty()) {
        return Err((0, _syntax.generateSyntaxError)("{{#unless}} cannot receive named parameters, received " + args.named.entries.map(e => e.name.chars).join(', '), node.loc));
      }
      if (args.positional.size > 1) {
        return Err((0, _syntax.generateSyntaxError)("{{#unless}} can only receive one positional parameter in block form, the conditional value. Received " + args.positional.size + " parameters", node.loc));
      }
      var condition = args.nth(0);
      if (condition === null) {
        return Err((0, _syntax.generateSyntaxError)("{{#unless}} requires a condition as its first positional parameter, did not receive any parameters", node.loc));
      }
      return Ok({
        condition
      });
    },
    translate(_ref34, _ref35) {
      var {
        node,
        state
      } = _ref34;
      var {
        condition
      } = _ref35;
      var block = node.blocks.get('default');
      var inverse = node.blocks.get('else');
      var conditionResult = VISIT_EXPRS.visit(condition, state);
      var blockResult = VISIT_STMTS.NamedBlock(block, state);
      var inverseResult = inverse ? VISIT_STMTS.NamedBlock(inverse, state) : Ok(null);
      return Result.all(conditionResult, blockResult, inverseResult).mapOk(_ref36 => {
        var [condition, block, inverse] = _ref36;
        return new If({
          loc: node.loc,
          condition: new Not({
            value: condition,
            loc: node.loc
          }),
          block,
          inverse
        });
      });
    }
  }).kw('each', {
    assert(node) {
      var {
        args
      } = node;
      if (!args.named.entries.every(e => e.name.chars === 'key')) {
        return Err((0, _syntax.generateSyntaxError)("{{#each}} can only receive the 'key' named parameter, received " + args.named.entries.filter(e => e.name.chars !== 'key').map(e => e.name.chars).join(', '), args.named.loc));
      }
      if (args.positional.size > 1) {
        return Err((0, _syntax.generateSyntaxError)("{{#each}} can only receive one positional parameter, the collection being iterated. Received " + args.positional.size + " parameters", args.positional.loc));
      }
      var value = args.nth(0);
      var key = args.get('key');
      if (value === null) {
        return Err((0, _syntax.generateSyntaxError)("{{#each}} requires an iterable value to be passed as its first positional parameter, did not receive any parameters", args.loc));
      }
      return Ok({
        value,
        key
      });
    },
    translate(_ref37, _ref38) {
      var {
        node,
        state
      } = _ref37;
      var {
        value,
        key
      } = _ref38;
      var block = node.blocks.get('default');
      var inverse = node.blocks.get('else');
      var valueResult = VISIT_EXPRS.visit(value, state);
      var keyResult = key ? VISIT_EXPRS.visit(key, state) : Ok(null);
      var blockResult = VISIT_STMTS.NamedBlock(block, state);
      var inverseResult = inverse ? VISIT_STMTS.NamedBlock(inverse, state) : Ok(null);
      return Result.all(valueResult, keyResult, blockResult, inverseResult).mapOk(_ref39 => {
        var [value, key, block, inverse] = _ref39;
        return new Each({
          loc: node.loc,
          value,
          key,
          block,
          inverse
        });
      });
    }
  }).kw('with', {
    assert(node) {
      var {
        args
      } = node;
      if (!args.named.isEmpty()) {
        return Err((0, _syntax.generateSyntaxError)("{{#with}} cannot receive named parameters, received " + args.named.entries.map(e => e.name.chars).join(', '), args.named.loc));
      }
      if (args.positional.size > 1) {
        return Err((0, _syntax.generateSyntaxError)("{{#with}} can only receive one positional parameter. Received " + args.positional.size + " parameters", args.positional.loc));
      }
      var value = args.nth(0);
      if (value === null) {
        return Err((0, _syntax.generateSyntaxError)("{{#with}} requires a value as its first positional parameter, did not receive any parameters", args.loc));
      }
      return Ok({
        value
      });
    },
    translate(_ref40, _ref41) {
      var {
        node,
        state
      } = _ref40;
      var {
        value
      } = _ref41;
      var block = node.blocks.get('default');
      var inverse = node.blocks.get('else');
      var valueResult = VISIT_EXPRS.visit(value, state);
      var blockResult = VISIT_STMTS.NamedBlock(block, state);
      var inverseResult = inverse ? VISIT_STMTS.NamedBlock(inverse, state) : Ok(null);
      return Result.all(valueResult, blockResult, inverseResult).mapOk(_ref42 => {
        var [value, block, inverse] = _ref42;
        return new With({
          loc: node.loc,
          value,
          block,
          inverse
        });
      });
    }
  }).kw('let', {
    assert(node) {
      var {
        args
      } = node;
      if (!args.named.isEmpty()) {
        return Err((0, _syntax.generateSyntaxError)("{{#let}} cannot receive named parameters, received " + args.named.entries.map(e => e.name.chars).join(', '), args.named.loc));
      }
      if (args.positional.size === 0) {
        return Err((0, _syntax.generateSyntaxError)("{{#let}} requires at least one value as its first positional parameter, did not receive any parameters", args.positional.loc));
      }
      if (node.blocks.get('else')) {
        return Err((0, _syntax.generateSyntaxError)("{{#let}} cannot receive an {{else}} block", args.positional.loc));
      }
      return Ok({
        positional: args.positional
      });
    },
    translate(_ref43, _ref44) {
      var {
        node,
        state
      } = _ref43;
      var {
        positional
      } = _ref44;
      var block = node.blocks.get('default');
      var positionalResult = VISIT_EXPRS.Positional(positional, state);
      var blockResult = VISIT_STMTS.NamedBlock(block, state);
      return Result.all(positionalResult, blockResult).mapOk(_ref45 => {
        var [positional, block] = _ref45;
        return new Let({
          loc: node.loc,
          positional,
          block
        });
      });
    }
  }).kw('-with-dynamic-vars', {
    assert(node) {
      return Ok({
        named: node.args.named
      });
    },
    translate(_ref46, _ref47) {
      var {
        node,
        state
      } = _ref46;
      var {
        named
      } = _ref47;
      var block = node.blocks.get('default');
      var namedResult = VISIT_EXPRS.NamedArguments(named, state);
      var blockResult = VISIT_STMTS.NamedBlock(block, state);
      return Result.all(namedResult, blockResult).mapOk(_ref48 => {
        var [named, block] = _ref48;
        return new WithDynamicVars({
          loc: node.loc,
          named,
          block
        });
      });
    }
  }).kw('component', {
    assert: assertCurryKeyword(0
    /* Component */),

    translate(_ref49, _ref50) {
      var {
        node,
        state
      } = _ref49;
      var {
        definition,
        args
      } = _ref50;
      var definitionResult = VISIT_EXPRS.visit(definition, state);
      var argsResult = VISIT_EXPRS.Args(args, state);
      var blocksResult = VISIT_STMTS.NamedBlocks(node.blocks, state);
      return Result.all(definitionResult, argsResult, blocksResult).mapOk(_ref51 => {
        var [definition, args, blocks] = _ref51;
        return new InvokeComponent({
          loc: node.loc,
          definition,
          args,
          blocks
        });
      });
    }
  });
  var MODIFIER_KEYWORDS = keywords('Modifier');

  // There is a small whitelist of namespaced attributes specially
  // enumerated in
  // https://www.w3.org/TR/html/syntax.html#attributes-0
  //
  // > When a foreign element has one of the namespaced attributes given by
  // > the local name and namespace of the first and second cells of a row
  // > from the following table, it must be written using the name given by
  // > the third cell from the same row.
  //
  // In all other cases, colons are interpreted as a regular character
  // with no special meaning:
  //
  // > No other namespaced attribute can be expressed in the HTML syntax.
  var XLINK = 'http://www.w3.org/1999/xlink';
  var XML = 'http://www.w3.org/XML/1998/namespace';
  var XMLNS = 'http://www.w3.org/2000/xmlns/';
  var WHITELIST = {
    'xlink:actuate': XLINK,
    'xlink:arcrole': XLINK,
    'xlink:href': XLINK,
    'xlink:role': XLINK,
    'xlink:show': XLINK,
    'xlink:title': XLINK,
    'xlink:type': XLINK,
    'xml:base': XML,
    'xml:lang': XML,
    'xml:space': XML,
    xmlns: XMLNS,
    'xmlns:xlink': XMLNS
  };
  function getAttrNamespace(attrName) {
    return WHITELIST[attrName];
  }
  var DEFLATE_TAG_TABLE = {
    div: 0
    /* div */,

    span: 1
    /* span */,

    p: 2
    /* p */,

    a: 3
    /* a */
  };

  var INFLATE_TAG_TABLE = ['div', 'span', 'p', 'a'];
  function deflateTagName(tagName) {
    var _a;
    return (_a = DEFLATE_TAG_TABLE[tagName]) !== null && _a !== void 0 ? _a : tagName;
  }
  function inflateTagName(tagName) {
    return typeof tagName === 'string' ? tagName : INFLATE_TAG_TABLE[tagName];
  }
  var DEFLATE_ATTR_TABLE = {
    class: 0
    /* class */,

    id: 1
    /* id */,

    value: 2
    /* value */,

    name: 3
    /* name */,

    type: 4
    /* type */,

    style: 5
    /* style */,

    href: 6
    /* href */
  };

  var INFLATE_ATTR_TABLE = ['class', 'id', 'value', 'name', 'type', 'style', 'href'];
  function deflateAttrName(attrName) {
    var _a;
    return (_a = DEFLATE_ATTR_TABLE[attrName]) !== null && _a !== void 0 ? _a : attrName;
  }
  function inflateAttrName(attrName) {
    return typeof attrName === 'string' ? attrName : INFLATE_ATTR_TABLE[attrName];
  }
  class ClassifiedElement {
    constructor(element, delegate, state) {
      this.element = element;
      this.state = state;
      this.delegate = delegate;
    }
    toStatement() {
      return this.prepare().andThen(prepared => this.delegate.toStatement(this, prepared));
    }
    attr(attr) {
      var name = attr.name;
      var rawValue = attr.value;
      var namespace = getAttrNamespace(name.chars) || undefined;
      if (_syntax.ASTv2.isLiteral(rawValue, 'string')) {
        return Ok(new StaticAttr({
          loc: attr.loc,
          name,
          value: rawValue.toSlice(),
          namespace,
          kind: {
            component: this.delegate.dynamicFeatures
          }
        }));
      }
      return VISIT_EXPRS.visit(convertPathToCallIfKeyword(rawValue), this.state).mapOk(value => {
        var isTrusting = attr.trusting;
        return new DynamicAttr({
          loc: attr.loc,
          name,
          value: value,
          namespace,
          kind: {
            trusting: isTrusting,
            component: this.delegate.dynamicFeatures
          }
        });
      });
    }
    modifier(modifier) {
      if (isHelperInvocation(modifier)) {
        assertIsValidModifier(modifier);
      }
      var translated = MODIFIER_KEYWORDS.translate(modifier, this.state);
      if (translated !== null) {
        return translated;
      }
      var head = VISIT_EXPRS.visit(modifier.callee, this.state);
      var args = VISIT_EXPRS.Args(modifier.args, this.state);
      return Result.all(head, args).mapOk(_ref52 => {
        var [head, args] = _ref52;
        return new Modifier({
          loc: modifier.loc,
          callee: head,
          args
        });
      });
    }
    attrs() {
      var attrs = new ResultArray();
      var args = new ResultArray(); // Unlike most attributes, the `type` attribute can change how
      // subsequent attributes are interpreted by the browser. To address
      // this, in simple cases, we special case the `type` attribute to be set
      // last. For elements with splattributes, where attribute order affects
      // precedence, this re-ordering happens at runtime instead.
      // See https://github.com/glimmerjs/glimmer-vm/pull/726

      var typeAttr = null;
      var simple = this.element.attrs.filter(attr => attr.type === 'SplatAttr').length === 0;
      for (var attr of this.element.attrs) {
        if (attr.type === 'SplatAttr') {
          attrs.add(Ok(new SplatAttr({
            loc: attr.loc,
            symbol: this.state.scope.allocateBlock('attrs')
          })));
        } else if (attr.name.chars === 'type' && simple) {
          typeAttr = attr;
        } else {
          attrs.add(this.attr(attr));
        }
      }
      for (var arg of this.element.componentArgs) {
        args.add(this.delegate.arg(arg, this));
      }
      if (typeAttr) {
        attrs.add(this.attr(typeAttr));
      }
      return Result.all(args.toArray(), attrs.toArray()).mapOk(_ref53 => {
        var [args, attrs] = _ref53;
        return {
          attrs,
          args: new NamedArguments({
            loc: (0, _syntax.maybeLoc)(args, _syntax.SourceSpan.NON_EXISTENT),
            entries: OptionalList(args)
          })
        };
      });
    }
    prepare() {
      var attrs = this.attrs();
      var modifiers = new ResultArray(this.element.modifiers.map(m => this.modifier(m))).toArray();
      return Result.all(attrs, modifiers).mapOk(_ref54 => {
        var [result, modifiers] = _ref54;
        var {
          attrs,
          args
        } = result;
        var elementParams = [...attrs, ...modifiers];
        var params = new ElementParameters({
          loc: (0, _syntax.maybeLoc)(elementParams, _syntax.SourceSpan.NON_EXISTENT),
          body: OptionalList(elementParams)
        });
        return {
          args,
          params
        };
      });
    }
  }
  function hasDynamicFeatures(_ref55) {
    var {
      attrs,
      modifiers
    } = _ref55;
    // ElementModifier needs the special ComponentOperations
    if (modifiers.length > 0) {
      return true;
    } // Splattributes need the special ComponentOperations to merge into

    return !!attrs.filter(attr => attr.type === 'SplatAttr')[0];
  }
  class ClassifiedComponent {
    constructor(tag, element) {
      this.tag = tag;
      this.element = element;
      this.dynamicFeatures = true;
    }
    arg(attr, _ref56) {
      var {
        state
      } = _ref56;
      var name = attr.name;
      return VISIT_EXPRS.visit(convertPathToCallIfKeyword(attr.value), state).mapOk(value => new NamedArgument({
        loc: attr.loc,
        key: name,
        value
      }));
    }
    toStatement(component, _ref57) {
      var {
        args,
        params
      } = _ref57;
      var {
        element,
        state
      } = component;
      return this.blocks(state).mapOk(blocks => new Component({
        loc: element.loc,
        tag: this.tag,
        params,
        args,
        blocks
      }));
    }
    blocks(state) {
      return VISIT_STMTS.NamedBlocks(this.element.blocks, state);
    }
  }
  class ClassifiedSimpleElement {
    constructor(tag, element, dynamicFeatures) {
      this.tag = tag;
      this.element = element;
      this.dynamicFeatures = dynamicFeatures;
      this.isComponent = false;
    }
    arg(attr) {
      return Err((0, _syntax.generateSyntaxError)(attr.name.chars + " is not a valid attribute name. @arguments are only allowed on components, but the tag for this element (`" + this.tag.chars + "`) is a regular, non-component HTML element.", attr.loc));
    }
    toStatement(classified, _ref58) {
      var {
        params
      } = _ref58;
      var {
        state,
        element
      } = classified;
      var body = VISIT_STMTS.visitList(this.element.body, state);
      return body.mapOk(body => new SimpleElement({
        loc: element.loc,
        tag: this.tag,
        params,
        body: body.toArray(),
        dynamicFeatures: this.dynamicFeatures
      }));
    }
  }
  class NormalizationStatements {
    visitList(nodes, state) {
      return new ResultArray(nodes.map(e => VISIT_STMTS.visit(e, state))).toOptionalList().mapOk(list => list.filter(s => s !== null));
    }
    visit(node, state) {
      switch (node.type) {
        case 'GlimmerComment':
          return Ok(null);
        case 'AppendContent':
          return this.AppendContent(node, state);
        case 'HtmlText':
          return Ok(this.TextNode(node));
        case 'HtmlComment':
          return Ok(this.HtmlComment(node));
        case 'InvokeBlock':
          return this.InvokeBlock(node, state);
        case 'InvokeComponent':
          return this.Component(node, state);
        case 'SimpleElement':
          return this.SimpleElement(node, state);
      }
    }
    InvokeBlock(node, state) {
      var translated = BLOCK_KEYWORDS.translate(node, state);
      if (translated !== null) {
        return translated;
      }
      var head = VISIT_EXPRS.visit(node.callee, state);
      var args = VISIT_EXPRS.Args(node.args, state);
      return Result.all(head, args).andThen(_ref59 => {
        var [head, args] = _ref59;
        return this.NamedBlocks(node.blocks, state).mapOk(blocks => new InvokeBlock({
          loc: node.loc,
          head,
          args,
          blocks
        }));
      });
    }
    NamedBlocks(blocks, state) {
      var list = new ResultArray(blocks.blocks.map(b => this.NamedBlock(b, state)));
      return list.toArray().mapOk(list => new NamedBlocks({
        loc: blocks.loc,
        blocks: OptionalList(list)
      }));
    }
    NamedBlock(named, state) {
      var body = state.visitBlock(named.block);
      return body.mapOk(body => {
        return new NamedBlock({
          loc: named.loc,
          name: named.name,
          body: body.toArray(),
          scope: named.block.scope
        });
      });
    }
    SimpleElement(element, state) {
      return new ClassifiedElement(element, new ClassifiedSimpleElement(element.tag, element, hasDynamicFeatures(element)), state).toStatement();
    }
    Component(component, state) {
      return VISIT_EXPRS.visit(component.callee, state).andThen(callee => new ClassifiedElement(component, new ClassifiedComponent(callee, component), state).toStatement());
    }
    AppendContent(append, state) {
      var translated = APPEND_KEYWORDS.translate(append, state);
      if (translated !== null) {
        return translated;
      }
      var value = VISIT_EXPRS.visit(append.value, state);
      return value.mapOk(value => {
        if (append.trusting) {
          return new AppendTrustedHTML({
            loc: append.loc,
            html: value
          });
        } else {
          return new AppendTextNode({
            loc: append.loc,
            text: value
          });
        }
      });
    }
    TextNode(text) {
      return new AppendTextNode({
        loc: text.loc,
        text: new _syntax.ASTv2.LiteralExpression({
          loc: text.loc,
          value: text.chars
        })
      });
    }
    HtmlComment(comment) {
      return new AppendComment({
        loc: comment.loc,
        value: comment.text
      });
    }
  }
  var VISIT_STMTS = new NormalizationStatements();

  /**
   * This is the mutable state for this compiler pass.
   */

  class NormalizationState {
    constructor(block, isStrict) {
      this.isStrict = isStrict;
      this._cursorCount = 0;
      this._currentScope = block;
    }
    generateUniqueCursor() {
      return "%cursor:" + this._cursorCount++ + "%";
    }
    get scope() {
      return this._currentScope;
    }
    visitBlock(block) {
      var oldBlock = this._currentScope;
      this._currentScope = block.scope;
      try {
        return VISIT_STMTS.visitList(block.body, this);
      } finally {
        this._currentScope = oldBlock;
      }
    }
  }

  /**
   * Normalize the AST from @glimmer/syntax into the HIR. The HIR has special
   * instructions for keywords like `{{yield}}`, `(has-block)` and
   * `{{#in-element}}`.
   *
   * Most importantly, it also classifies HTML element syntax into:
   *
   * 1. simple HTML element (with optional splattributes)
   * 2. component invocation
   *
   * Because the @glimmer/syntax AST gives us a string for an element's tag,
   * this pass also normalizes that string into an expression.
   *
   * ```
   * // normalized into a path expression whose head is `this` and tail is
   * // `["x"]`
   * <this.x />
   *
   * {{#let expr as |t|}}
   *   // `"t"` is normalized into a variable lookup.
   *   <t />
   *
   *   // normalized into a path expression whose head is the variable lookup
   *   // `t` and tail is `["input"]`.
   *   <t.input />
   * {{/let}}
   *
   * // normalized into a free variable lookup for `SomeComponent` (with the
   * // context `ComponentHead`).
   * <SomeComponent />
   *
   * // normalized into a path expression whose head is the free variable
   * // `notInScope` (with the context `Expression`), and whose tail is
   * // `["SomeComponent"]`. In resolver mode, this path will be rejected later,
   * // since it cannot serve as an input to the resolver.
   * <notInScope.SomeComponent />
   * ```
   */

  function normalize(source, root, isStrict) {
    // create a new context for the normalization pass
    var state = new NormalizationState(root.table, isStrict);
    var body = VISIT_STMTS.visitList(root.body, state);
    return body.mapOk(body => new Template({
      loc: root.loc,
      scope: root.table,
      body: body.toArray()
    }));
  }
  class WireFormatDebugger {
    constructor(_ref60) {
      var [_statements, symbols, _hasEval, upvars] = _ref60;
      this.upvars = upvars;
      this.symbols = symbols;
    }
    format(program) {
      var out = [];
      for (var statement of program[0]) {
        out.push(this.formatOpcode(statement));
      }
      return out;
    }
    formatOpcode(opcode) {
      if (Array.isArray(opcode)) {
        switch (opcode[0]) {
          case 1
          /* Append */:
            return ['append', this.formatOpcode(opcode[1])];
          case 2
          /* TrustingAppend */:
            return ['trusting-append', this.formatOpcode(opcode[1])];
          case 6
          /* Block */:
            return ['block', this.formatOpcode(opcode[1]), this.formatParams(opcode[2]), this.formatHash(opcode[3]), this.formatBlocks(opcode[4])];
          case 40
          /* InElement */:
            return ['in-element', opcode[1], this.formatOpcode(opcode[2]), opcode[3] ? this.formatOpcode(opcode[3]) : undefined];
          case 10
          /* OpenElement */:
            return ['open-element', inflateTagName(opcode[1])];
          case 11
          /* OpenElementWithSplat */:
            return ['open-element-with-splat', inflateTagName(opcode[1])];
          case 13
          /* CloseElement */:
            return ['close-element'];
          case 12
          /* FlushElement */:
            return ['flush-element'];
          case 14
          /* StaticAttr */:
            return ['static-attr', inflateAttrName(opcode[1]), opcode[2], opcode[3]];
          case 24
          /* StaticComponentAttr */:
            return ['static-component-attr', inflateAttrName(opcode[1]), opcode[2], opcode[3]];
          case 15
          /* DynamicAttr */:
            return ['dynamic-attr', inflateAttrName(opcode[1]), this.formatOpcode(opcode[2]), opcode[3]];
          case 16
          /* ComponentAttr */:
            return ['component-attr', inflateAttrName(opcode[1]), this.formatOpcode(opcode[2]), opcode[3]];
          case 17
          /* AttrSplat */:
            return ['attr-splat'];
          case 18
          /* Yield */:
            return ['yield', opcode[1], this.formatParams(opcode[2])];
          case 20
          /* DynamicArg */:
            return ['dynamic-arg', opcode[1], this.formatOpcode(opcode[2])];
          case 21
          /* StaticArg */:
            return ['static-arg', opcode[1], this.formatOpcode(opcode[2])];
          case 22
          /* TrustingDynamicAttr */:
            return ['trusting-dynamic-attr', inflateAttrName(opcode[1]), this.formatOpcode(opcode[2]), opcode[3]];
          case 23
          /* TrustingComponentAttr */:
            return ['trusting-component-attr', inflateAttrName(opcode[1]), this.formatOpcode(opcode[2]), opcode[3]];
          case 26
          /* Debugger */:
            return ['debugger', opcode[1]];
          case 3
          /* Comment */:
            return ['comment', opcode[1]];
          case 4
          /* Modifier */:
            return ['modifier', this.formatOpcode(opcode[1]), this.formatParams(opcode[2]), this.formatHash(opcode[3])];
          case 8
          /* Component */:
            return ['component', this.formatOpcode(opcode[1]), this.formatElementParams(opcode[2]), this.formatHash(opcode[3]), this.formatBlocks(opcode[4])];
          case 48
          /* HasBlock */:
            return ['has-block', this.formatOpcode(opcode[1])];
          case 49
          /* HasBlockParams */:
            return ['has-block-params', this.formatOpcode(opcode[1])];
          case 50
          /* Curry */:
            return ['curry', this.formatOpcode(opcode[1]), this.formatCurryType(opcode[2]), this.formatParams(opcode[3]), this.formatHash(opcode[4])];
          case 27
          /* Undefined */:
            return ['undefined'];
          case 28
          /* Call */:
            return ['call', this.formatOpcode(opcode[1]), this.formatParams(opcode[2]), this.formatHash(opcode[3])];
          case 29
          /* Concat */:
            return ['concat', this.formatParams(opcode[1])];
          case 31
          /* GetStrictFree */:
            return ['get-strict-free', this.upvars[opcode[1]], opcode[2]];
          case 34
          /* GetFreeAsComponentOrHelperHeadOrThisFallback */:
            return ['GetFreeAsComponentOrHelperHeadOrThisFallback', this.upvars[opcode[1]], opcode[2]];
          case 35
          /* GetFreeAsComponentOrHelperHead */:
            return ['GetFreeAsComponentOrHelperHead', this.upvars[opcode[1]], opcode[2]];
          case 36
          /* GetFreeAsHelperHeadOrThisFallback */:
            return ['GetFreeAsHelperHeadOrThisFallback', this.upvars[opcode[1]], opcode[2]];
          case 99
          /* GetFreeAsDeprecatedHelperHeadOrThisFallback */:
            return ['GetFreeAsDeprecatedHelperHeadOrThisFallback', this.upvars[opcode[1]]];
          case 37
          /* GetFreeAsHelperHead */:
            return ['GetFreeAsHelperHead', this.upvars[opcode[1]], opcode[2]];
          case 39
          /* GetFreeAsComponentHead */:
            return ['GetFreeAsComponentHead', this.upvars[opcode[1]], opcode[2]];
          case 38
          /* GetFreeAsModifierHead */:
            return ['GetFreeAsModifierHead', this.upvars[opcode[1]], opcode[2]];
          case 30
          /* GetSymbol */:
            {
              if (opcode[1] === 0) {
                return ['get-symbol', 'this', opcode[2]];
              } else {
                return ['get-symbol', this.symbols[opcode[1] - 1], opcode[2]];
              }
            }
          case 32
          /* GetTemplateSymbol */:
            {
              return ['get-template-symbol', opcode[1], opcode[2]];
            }
          case 41
          /* If */:
            return ['if', this.formatOpcode(opcode[1]), this.formatBlock(opcode[2]), opcode[3] ? this.formatBlock(opcode[3]) : null];
          case 52
          /* IfInline */:
            return ['if-inline'];
          case 51
          /* Not */:
            return ['not'];
          case 42
          /* Each */:
            return ['each', this.formatOpcode(opcode[1]), opcode[2] ? this.formatOpcode(opcode[2]) : null, this.formatBlock(opcode[3]), opcode[4] ? this.formatBlock(opcode[4]) : null];
          case 43
          /* With */:
            return ['with', this.formatOpcode(opcode[1]), this.formatBlock(opcode[2]), opcode[3] ? this.formatBlock(opcode[3]) : null];
          case 44
          /* Let */:
            return ['let', this.formatParams(opcode[1]), this.formatBlock(opcode[2])];
          case 54
          /* Log */:
            return ['log', this.formatParams(opcode[1])];
          case 45
          /* WithDynamicVars */:
            return ['-with-dynamic-vars', this.formatHash(opcode[1]), this.formatBlock(opcode[2])];
          case 53
          /* GetDynamicVar */:
            return ['-get-dynamic-vars', this.formatOpcode(opcode[1])];
          case 46
          /* InvokeComponent */:
            return ['component', this.formatOpcode(opcode[1]), this.formatParams(opcode[2]), this.formatHash(opcode[3]), this.formatBlocks(opcode[4])];
        }
      } else {
        return opcode;
      }
    }
    formatCurryType(value) {
      switch (value) {
        case 0
        /* Component */:
          return 'component';
        case 1
        /* Helper */:
          return 'helper';
        case 2
        /* Modifier */:
          return 'modifier';
        default:
          throw (0, _util.exhausted)(value);
      }
    }
    formatElementParams(opcodes) {
      if (opcodes === null) return null;
      return opcodes.map(o => this.formatOpcode(o));
    }
    formatParams(opcodes) {
      if (opcodes === null) return null;
      return opcodes.map(o => this.formatOpcode(o));
    }
    formatHash(hash) {
      if (hash === null) return null;
      return hash[0].reduce((accum, key, index) => {
        accum[key] = this.formatOpcode(hash[1][index]);
        return accum;
      }, (0, _util.dict)());
    }
    formatBlocks(blocks) {
      if (blocks === null) return null;
      return blocks[0].reduce((accum, key, index) => {
        accum[key] = this.formatBlock(blocks[1][index]);
        return accum;
      }, (0, _util.dict)());
    }
    formatBlock(block) {
      return {
        statements: block[0].map(s => this.formatOpcode(s)),
        parameters: block[1]
      };
    }
  }
  _exports.WireFormatDebugger = WireFormatDebugger;
  class ExpressionEncoder {
    expr(expr) {
      switch (expr.type) {
        case 'Missing':
          return undefined;
        case 'Literal':
          return this.Literal(expr);
        case 'CallExpression':
          return this.CallExpression(expr);
        case 'DeprecatedCallExpression':
          return this.DeprecatedCallExpression(expr);
        case 'PathExpression':
          return this.PathExpression(expr);
        case 'Arg':
          return [30
          /* GetSymbol */, expr.symbol];
        case 'Local':
          return this.Local(expr);
        case 'This':
          return [30
          /* GetSymbol */, 0];
        case 'Free':
          return [expr.resolution.resolution(), expr.symbol];
        case 'HasBlock':
          return this.HasBlock(expr);
        case 'HasBlockParams':
          return this.HasBlockParams(expr);
        case 'Curry':
          return this.Curry(expr);
        case 'Not':
          return this.Not(expr);
        case 'IfInline':
          return this.IfInline(expr);
        case 'InterpolateExpression':
          return this.InterpolateExpression(expr);
        case 'GetDynamicVar':
          return this.GetDynamicVar(expr);
        case 'Log':
          return this.Log(expr);
      }
    }
    Literal(_ref61) {
      var {
        value
      } = _ref61;
      if (value === undefined) {
        return [27
        /* Undefined */];
      } else {
        return value;
      }
    }
    Missing() {
      return undefined;
    }
    HasBlock(_ref62) {
      var {
        symbol
      } = _ref62;
      return [48
      /* HasBlock */, [30
      /* GetSymbol */, symbol]];
    }
    HasBlockParams(_ref63) {
      var {
        symbol
      } = _ref63;
      return [49
      /* HasBlockParams */, [30
      /* GetSymbol */, symbol]];
    }
    Curry(_ref64) {
      var {
        definition,
        curriedType,
        args
      } = _ref64;
      return [50
      /* Curry */, EXPR.expr(definition), curriedType, EXPR.Positional(args.positional), EXPR.NamedArguments(args.named)];
    }
    Local(_ref65) {
      var {
        isTemplateLocal,
        symbol
      } = _ref65;
      return [isTemplateLocal ? 32
      /* GetTemplateSymbol */ : 30
      /* GetSymbol */, symbol];
    }
    GetWithResolver(_ref66) {
      var {
        symbol
      } = _ref66;
      return [34
      /* GetFreeAsComponentOrHelperHeadOrThisFallback */, symbol];
    }
    PathExpression(_ref67) {
      var {
        head,
        tail
      } = _ref67;
      var getOp = EXPR.expr(head);
      return [...getOp, EXPR.Tail(tail)];
    }
    InterpolateExpression(_ref68) {
      var {
        parts
      } = _ref68;
      return [29
      /* Concat */, parts.map(e => EXPR.expr(e)).toArray()];
    }
    CallExpression(_ref69) {
      var {
        callee,
        args
      } = _ref69;
      return [28
      /* Call */, EXPR.expr(callee), ...EXPR.Args(args)];
    }
    DeprecatedCallExpression(_ref70) {
      var {
        arg,
        callee
      } = _ref70;
      return [99
      /* GetFreeAsDeprecatedHelperHeadOrThisFallback */, callee.symbol, [arg.chars]];
    }
    Tail(_ref71) {
      var {
        members
      } = _ref71;
      return (0, _util.mapPresent)(members, member => member.chars);
    }
    Args(_ref72) {
      var {
        positional,
        named
      } = _ref72;
      return [this.Positional(positional), this.NamedArguments(named)];
    }
    Positional(_ref73) {
      var {
        list
      } = _ref73;
      return list.map(l => EXPR.expr(l)).toPresentArray();
    }
    NamedArgument(_ref74) {
      var {
        key,
        value
      } = _ref74;
      return [key.chars, EXPR.expr(value)];
    }
    NamedArguments(_ref75) {
      var {
        entries: pairs
      } = _ref75;
      var list = pairs.toArray();
      if ((0, _util.isPresent)(list)) {
        var names = [];
        var _values = [];
        for (var pair of list) {
          var [name, value] = EXPR.NamedArgument(pair);
          names.push(name);
          _values.push(value);
        }
        (0, _util.assertPresent)(names);
        (0, _util.assertPresent)(_values);
        return [names, _values];
      } else {
        return null;
      }
    }
    Not(_ref76) {
      var {
        value
      } = _ref76;
      return [51
      /* Not */, EXPR.expr(value)];
    }
    IfInline(_ref77) {
      var {
        condition,
        truthy,
        falsy
      } = _ref77;
      var expr = [52
      /* IfInline */, EXPR.expr(condition), EXPR.expr(truthy)];
      if (falsy) {
        expr.push(EXPR.expr(falsy));
      }
      return expr;
    }
    GetDynamicVar(_ref78) {
      var {
        name
      } = _ref78;
      return [53
      /* GetDynamicVar */, EXPR.expr(name)];
    }
    Log(_ref79) {
      var {
        positional
      } = _ref79;
      return [54
      /* Log */, this.Positional(positional)];
    }
  }
  var EXPR = new ExpressionEncoder();
  class WireStatements {
    constructor(statements) {
      this.statements = statements;
    }
    toArray() {
      return this.statements;
    }
  }
  class ContentEncoder {
    list(statements) {
      var out = [];
      for (var statement of statements) {
        var result = CONTENT.content(statement);
        if (result && result instanceof WireStatements) {
          out.push(...result.toArray());
        } else {
          out.push(result);
        }
      }
      return out;
    }
    content(stmt) {
      return this.visitContent(stmt);
    }
    visitContent(stmt) {
      switch (stmt.type) {
        case 'Debugger':
          return [26
          /* Debugger */, stmt.scope.getEvalInfo()];
        case 'AppendComment':
          return this.AppendComment(stmt);
        case 'AppendTextNode':
          return this.AppendTextNode(stmt);
        case 'AppendTrustedHTML':
          return this.AppendTrustedHTML(stmt);
        case 'Yield':
          return this.Yield(stmt);
        case 'Component':
          return this.Component(stmt);
        case 'SimpleElement':
          return this.SimpleElement(stmt);
        case 'InElement':
          return this.InElement(stmt);
        case 'InvokeBlock':
          return this.InvokeBlock(stmt);
        case 'If':
          return this.If(stmt);
        case 'Each':
          return this.Each(stmt);
        case 'With':
          return this.With(stmt);
        case 'Let':
          return this.Let(stmt);
        case 'WithDynamicVars':
          return this.WithDynamicVars(stmt);
        case 'InvokeComponent':
          return this.InvokeComponent(stmt);
        default:
          return (0, _util.exhausted)(stmt);
      }
    }
    Yield(_ref80) {
      var {
        to,
        positional
      } = _ref80;
      return [18
      /* Yield */, to, EXPR.Positional(positional)];
    }
    InElement(_ref81) {
      var {
        guid,
        insertBefore,
        destination,
        block
      } = _ref81;
      var wireBlock = CONTENT.NamedBlock(block)[1]; // let guid = args.guid;

      var wireDestination = EXPR.expr(destination);
      var wireInsertBefore = EXPR.expr(insertBefore);
      if (wireInsertBefore === undefined) {
        return [40
        /* InElement */, wireBlock, guid, wireDestination];
      } else {
        return [40
        /* InElement */, wireBlock, guid, wireDestination, wireInsertBefore];
      }
    }
    InvokeBlock(_ref82) {
      var {
        head,
        args,
        blocks
      } = _ref82;
      return [6
      /* Block */, EXPR.expr(head), ...EXPR.Args(args), CONTENT.NamedBlocks(blocks)];
    }
    AppendTrustedHTML(_ref83) {
      var {
        html
      } = _ref83;
      return [2
      /* TrustingAppend */, EXPR.expr(html)];
    }
    AppendTextNode(_ref84) {
      var {
        text
      } = _ref84;
      return [1
      /* Append */, EXPR.expr(text)];
    }
    AppendComment(_ref85) {
      var {
        value
      } = _ref85;
      return [3
      /* Comment */, value.chars];
    }
    SimpleElement(_ref86) {
      var {
        tag,
        params,
        body,
        dynamicFeatures
      } = _ref86;
      var op = dynamicFeatures ? 11
      /* OpenElementWithSplat */ : 10
      /* OpenElement */;

      return new WireStatements([[op, deflateTagName(tag.chars)], ...CONTENT.ElementParameters(params).toArray(), [12
      /* FlushElement */], ...CONTENT.list(body), [13
      /* CloseElement */]]);
    }

    Component(_ref87) {
      var {
        tag,
        params,
        args,
        blocks
      } = _ref87;
      var wireTag = EXPR.expr(tag);
      var wirePositional = CONTENT.ElementParameters(params);
      var wireNamed = EXPR.NamedArguments(args);
      var wireNamedBlocks = CONTENT.NamedBlocks(blocks);
      return [8
      /* Component */, wireTag, wirePositional.toPresentArray(), wireNamed, wireNamedBlocks];
    }
    ElementParameters(_ref88) {
      var {
        body
      } = _ref88;
      return body.map(p => CONTENT.ElementParameter(p));
    }
    ElementParameter(param) {
      switch (param.type) {
        case 'SplatAttr':
          return [17
          /* AttrSplat */, param.symbol];
        case 'DynamicAttr':
          return [dynamicAttrOp(param.kind), ...dynamicAttr(param)];
        case 'StaticAttr':
          return [staticAttrOp(param.kind), ...staticAttr(param)];
        case 'Modifier':
          return [4
          /* Modifier */, EXPR.expr(param.callee), ...EXPR.Args(param.args)];
      }
    }
    NamedBlocks(_ref89) {
      var {
        blocks
      } = _ref89;
      var names = [];
      var serializedBlocks = [];
      for (var block of blocks.toArray()) {
        var [name, serializedBlock] = CONTENT.NamedBlock(block);
        names.push(name);
        serializedBlocks.push(serializedBlock);
      }
      return names.length > 0 ? [names, serializedBlocks] : null;
    }
    NamedBlock(_ref90) {
      var {
        name,
        body,
        scope
      } = _ref90;
      var nameChars = name.chars;
      if (nameChars === 'inverse') {
        nameChars = 'else';
      }
      return [nameChars, [CONTENT.list(body), scope.slots]];
    }
    If(_ref91) {
      var {
        condition,
        block,
        inverse
      } = _ref91;
      return [41
      /* If */, EXPR.expr(condition), CONTENT.NamedBlock(block)[1], inverse ? CONTENT.NamedBlock(inverse)[1] : null];
    }
    Each(_ref92) {
      var {
        value,
        key,
        block,
        inverse
      } = _ref92;
      return [42
      /* Each */, EXPR.expr(value), key ? EXPR.expr(key) : null, CONTENT.NamedBlock(block)[1], inverse ? CONTENT.NamedBlock(inverse)[1] : null];
    }
    With(_ref93) {
      var {
        value,
        block,
        inverse
      } = _ref93;
      return [43
      /* With */, EXPR.expr(value), CONTENT.NamedBlock(block)[1], inverse ? CONTENT.NamedBlock(inverse)[1] : null];
    }
    Let(_ref94) {
      var {
        positional,
        block
      } = _ref94;
      return [44
      /* Let */, EXPR.Positional(positional), CONTENT.NamedBlock(block)[1]];
    }
    WithDynamicVars(_ref95) {
      var {
        named,
        block
      } = _ref95;
      return [45
      /* WithDynamicVars */, EXPR.NamedArguments(named), CONTENT.NamedBlock(block)[1]];
    }
    InvokeComponent(_ref96) {
      var {
        definition,
        args,
        blocks
      } = _ref96;
      return [46
      /* InvokeComponent */, EXPR.expr(definition), EXPR.Positional(args.positional), EXPR.NamedArguments(args.named), blocks ? CONTENT.NamedBlocks(blocks) : null];
    }
  }
  var CONTENT = new ContentEncoder();
  function staticAttr(_ref97) {
    var {
      name,
      value,
      namespace
    } = _ref97;
    var out = [deflateAttrName(name.chars), value.chars];
    if (namespace) {
      out.push(namespace);
    }
    return out;
  }
  function dynamicAttr(_ref98) {
    var {
      name,
      value,
      namespace
    } = _ref98;
    var out = [deflateAttrName(name.chars), EXPR.expr(value)];
    if (namespace) {
      out.push(namespace);
    }
    return out;
  }
  function staticAttrOp(kind) {
    if (kind.component) {
      return 24
      /* StaticComponentAttr */;
    } else {
      return 14
      /* StaticAttr */;
    }
  }

  function dynamicAttrOp(kind) {
    if (kind.component) {
      return kind.trusting ? 23
      /* TrustingComponentAttr */ : 16
      /* ComponentAttr */;
    } else {
      return kind.trusting ? 22
      /* TrustingDynamicAttr */ : 15
      /* DynamicAttr */;
    }
  }

  function visit(template) {
    var statements = CONTENT.list(template.body);
    var scope = template.scope;
    var block = [statements, scope.symbols, scope.hasEval, scope.upvars];
    return block;
  }
  var defaultId = (() => {
    var req = typeof module === 'object' && typeof module.require === 'function' ? module.require : require;
    if (req) {
      try {
        var crypto = req('crypto');
        var idFn = src => {
          var hash = crypto.createHash('sha1');
          hash.update(src, 'utf8'); // trim to 6 bytes of data (2^48 - 1)

          return hash.digest('base64').substring(0, 8);
        };
        idFn('test');
        return idFn;
      } catch (e) {}
    }
    return function idFn() {
      return null;
    };
  })();
  _exports.defaultId = defaultId;
  var defaultOptions = {
    id: defaultId
  };
  /*
   * Compile a string into a template javascript string.
   *
   * Example usage:
   *     import { precompile } from '@glimmer/compiler';
   *     import { templateFactory } from 'glimmer-runtime';
   *     let templateJs = precompile("Howdy {{name}}");
   *     let factory = templateFactory(new Function("return " + templateJs)());
   *     let template = factory.create(env);
   *
   * @method precompile
   * @param {string} string a Glimmer template string
   * @return {string} a template javascript string
   */

  function precompileJSON(string, options) {
    if (options === void 0) {
      options = defaultOptions;
    }
    var _a, _b;
    var source = new _syntax.Source(string, (_a = options.meta) === null || _a === void 0 ? void 0 : _a.moduleName);
    var [ast, locals] = (0, _syntax.normalize)(source, options);
    var block = normalize(source, ast, (_b = options.strictMode) !== null && _b !== void 0 ? _b : false).mapOk(pass2In => {
      return visit(pass2In);
    });
    if (block.isOk) {
      return [block.value, locals];
    } else {
      throw block.reason;
    }
  } // UUID used as a unique placeholder for placing a snippet of JS code into
  // the otherwise JSON stringified value below.

  var SCOPE_PLACEHOLDER = '796d24e6-2450-4fb0-8cdf-b65638b5ef70';
  /*
   * Compile a string into a template javascript string.
   *
   * Example usage:
   *     import { precompile } from '@glimmer/compiler';
   *     import { templateFactory } from 'glimmer-runtime';
   *     let templateJs = precompile("Howdy {{name}}");
   *     let factory = templateFactory(new Function("return " + templateJs)());
   *     let template = factory.create(env);
   *
   * @method precompile
   * @param {string} string a Glimmer template string
   * @return {string} a template javascript string
   */

  function precompile(source, options) {
    if (options === void 0) {
      options = defaultOptions;
    }
    var _a, _b;
    var [block, usedLocals] = precompileJSON(source, options);
    var moduleName = (_a = options.meta) === null || _a === void 0 ? void 0 : _a.moduleName;
    var idFn = options.id || defaultId;
    var blockJSON = JSON.stringify(block);
    var templateJSONObject = {
      id: idFn(JSON.stringify(options.meta) + blockJSON),
      block: blockJSON,
      moduleName: moduleName !== null && moduleName !== void 0 ? moduleName : '(unknown template module)',
      // lying to the type checker here because we're going to
      // replace it just below, after stringification
      scope: SCOPE_PLACEHOLDER,
      isStrictMode: (_b = options.strictMode) !== null && _b !== void 0 ? _b : false
    };
    if (usedLocals.length === 0) {
      delete templateJSONObject.scope;
    } // JSON is javascript

    var stringified = JSON.stringify(templateJSONObject);
    if (usedLocals.length > 0) {
      var scopeFn = "()=>[" + usedLocals.join(',') + "]";
      stringified = stringified.replace("\"" + SCOPE_PLACEHOLDER + "\"", scopeFn);
    }
    return stringified;
  }
  var VariableKind;
  (function (VariableKind) {
    VariableKind["Local"] = "Local";
    VariableKind["Free"] = "Free";
    VariableKind["Arg"] = "Arg";
    VariableKind["Block"] = "Block";
    VariableKind["This"] = "This";
  })(VariableKind || (VariableKind = {}));
  function normalizeStatement(statement) {
    if (Array.isArray(statement)) {
      if (statementIsExpression(statement)) {
        return normalizeAppendExpression(statement);
      } else if (isSugaryArrayStatement(statement)) {
        return normalizeSugaryArrayStatement(statement);
      } else {
        return normalizeVerboseStatement(statement);
      }
    } else if (typeof statement === 'string') {
      return normalizeAppendHead(normalizeDottedPath(statement), false);
    } else {
      throw (0, _util.assertNever)(statement);
    }
  }
  function normalizeAppendHead(head, trusted) {
    if (head.type === "GetPath"
    /* GetPath */) {
      return {
        kind: "AppendPath"
        /* AppendPath */,

        path: head,
        trusted
      };
    } else {
      return {
        kind: "AppendExpr"
        /* AppendExpr */,

        expr: head,
        trusted
      };
    }
  }
  function isSugaryArrayStatement(statement) {
    if (Array.isArray(statement) && typeof statement[0] === 'string') {
      switch (statement[0][0]) {
        case '(':
        case '#':
        case '<':
        case '!':
          return true;
        default:
          return false;
      }
    }
    return false;
  }
  function normalizeSugaryArrayStatement(statement) {
    var name = statement[0];
    switch (name[0]) {
      case '(':
        {
          var params = null;
          var hash = null;
          if (statement.length === 3) {
            params = normalizeParams(statement[1]);
            hash = normalizeHash(statement[2]);
          } else if (statement.length === 2) {
            if (Array.isArray(statement[1])) {
              params = normalizeParams(statement[1]);
            } else {
              hash = normalizeHash(statement[1]);
            }
          }
          return {
            kind: "Call"
            /* Call */,

            head: normalizeCallHead(name),
            params,
            hash,
            trusted: false
          };
        }
      case '#':
        {
          var {
            head: path,
            params: _params,
            hash: _hash,
            blocks,
            blockParams
          } = normalizeBuilderBlockStatement(statement);
          return {
            kind: "Block"
            /* Block */,

            head: path,
            params: _params,
            hash: _hash,
            blocks,
            blockParams
          };
        }
      case '!':
        {
          var _name2 = statement[0].slice(1);
          var {
            params: _params2,
            hash: _hash2,
            blocks: _blocks,
            blockParams: _blockParams
          } = normalizeBuilderBlockStatement(statement);
          return {
            kind: "Keyword"
            /* Keyword */,

            name: _name2,
            params: _params2,
            hash: _hash2,
            blocks: _blocks,
            blockParams: _blockParams
          };
        }
      case '<':
        {
          var attrs = (0, _util.dict)();
          var block = [];
          if (statement.length === 3) {
            attrs = normalizeAttrs(statement[1]);
            block = normalizeBlock(statement[2]);
          } else if (statement.length === 2) {
            if (Array.isArray(statement[1])) {
              block = normalizeBlock(statement[1]);
            } else {
              attrs = normalizeAttrs(statement[1]);
            }
          }
          return {
            kind: "Element"
            /* Element */,

            name: extractElement(name),
            attrs,
            block
          };
        }
      default:
        throw new Error("Unreachable " + JSON.stringify(statement) + " in normalizeSugaryArrayStatement");
    }
  }
  function normalizeVerboseStatement(statement) {
    switch (statement[0]) {
      case 0
      /* Literal */:
        {
          return {
            kind: "Literal"
            /* Literal */,

            value: statement[1]
          };
        }
      case 2
      /* Append */:
        {
          return normalizeAppendExpression(statement[1], statement[2]);
        }
      case 3
      /* Modifier */:
        {
          return {
            kind: "Modifier"
            /* Modifier */,

            params: normalizeParams(statement[1]),
            hash: normalizeHash(statement[2])
          };
        }
      case 4
      /* DynamicComponent */:
        {
          return {
            kind: "DynamicComponent"
            /* DynamicComponent */,

            expr: normalizeExpression(statement[1]),
            hash: normalizeHash(statement[2]),
            block: normalizeBlock(statement[3])
          };
        }
      case 1
      /* Comment */:
        {
          return {
            kind: "Comment"
            /* Comment */,

            value: statement[1]
          };
        }
    }
  }
  function extractBlockHead(name) {
    var result = /^(#|!)(.*)$/.exec(name);
    if (result === null) {
      throw new Error("Unexpected missing # in block head");
    }
    return normalizeDottedPath(result[2]);
  }
  function normalizeCallHead(name) {
    var result = /^\((.*)\)$/.exec(name);
    if (result === null) {
      throw new Error("Unexpected missing () in call head");
    }
    return normalizeDottedPath(result[1]);
  }
  function normalizePath(head, tail) {
    if (tail === void 0) {
      tail = [];
    }
    var pathHead = normalizePathHead(head);
    if ((0, _util.isPresent)(tail)) {
      return {
        type: "GetPath"
        /* GetPath */,

        path: {
          head: pathHead,
          tail
        }
      };
    } else {
      return {
        type: "GetVar"
        /* GetVar */,

        variable: pathHead
      };
    }
  }
  function normalizeDottedPath(whole) {
    var {
      kind,
      name: rest
    } = normalizePathHead(whole);
    var [name, ...tail] = rest.split('.');
    var variable = {
      kind,
      name,
      mode: 'loose'
    };
    if ((0, _util.isPresent)(tail)) {
      return {
        type: "GetPath"
        /* GetPath */,

        path: {
          head: variable,
          tail
        }
      };
    } else {
      return {
        type: "GetVar"
        /* GetVar */,

        variable
      };
    }
  }
  function normalizePathHead(whole) {
    var kind;
    var name;
    if (/^this(\.|$)/.exec(whole)) {
      return {
        kind: VariableKind.This,
        name: whole,
        mode: 'loose'
      };
    }
    switch (whole[0]) {
      case '^':
        kind = VariableKind.Free;
        name = whole.slice(1);
        break;
      case '@':
        kind = VariableKind.Arg;
        name = whole.slice(1);
        break;
      case '&':
        kind = VariableKind.Block;
        name = whole.slice(1);
        break;
      default:
        kind = VariableKind.Local;
        name = whole;
    }
    return {
      kind,
      name,
      mode: 'loose'
    };
  }
  function normalizeBuilderBlockStatement(statement) {
    var head = statement[0];
    var blocks = (0, _util.dict)();
    var params = null;
    var hash = null;
    var blockParams = null;
    if (statement.length === 2) {
      blocks = normalizeBlocks(statement[1]);
    } else if (statement.length === 3) {
      if (Array.isArray(statement[1])) {
        params = normalizeParams(statement[1]);
      } else {
        ({
          hash,
          blockParams
        } = normalizeBlockHash(statement[1]));
      }
      blocks = normalizeBlocks(statement[2]);
    } else if (statement.length === 4) {
      params = normalizeParams(statement[1]);
      ({
        hash,
        blockParams
      } = normalizeBlockHash(statement[2]));
      blocks = normalizeBlocks(statement[3]);
    }
    return {
      head: extractBlockHead(head),
      params,
      hash,
      blockParams,
      blocks
    };
  }
  function normalizeBlockHash(hash) {
    if (hash === null) {
      return {
        hash: null,
        blockParams: null
      };
    }
    var out = null;
    var blockParams = null;
    entries(hash, (key, value) => {
      if (key === 'as') {
        blockParams = Array.isArray(value) ? value : [value];
      } else {
        out = out || (0, _util.dict)();
        out[key] = normalizeExpression(value);
      }
    });
    return {
      hash: out,
      blockParams
    };
  }
  function entries(dict, callback) {
    Object.keys(dict).forEach(key => {
      var value = dict[key];
      callback(key, value);
    });
  }
  function normalizeBlocks(value) {
    if (Array.isArray(value)) {
      return {
        default: normalizeBlock(value)
      };
    } else {
      return mapObject(value, normalizeBlock);
    }
  }
  function normalizeBlock(block) {
    return block.map(s => normalizeStatement(s));
  }
  function normalizeAttrs(attrs) {
    return mapObject(attrs, a => normalizeAttr(a).expr);
  }
  function normalizeAttr(attr) {
    if (attr === 'splat') {
      return {
        expr: "Splat"
        /* Splat */,

        trusted: false
      };
    } else {
      var expr = normalizeExpression(attr);
      return {
        expr,
        trusted: false
      };
    }
  }
  function mapObject(object, callback) {
    var out = (0, _util.dict)();
    Object.keys(object).forEach(k => {
      out[k] = callback(object[k], k);
    });
    return out;
  }
  function extractElement(input) {
    var match = /^<([a-z0-9\-][a-zA-Z0-9\-]*)>$/.exec(input);
    return match ? match[1] : null;
  }
  function normalizeAppendExpression(expression, forceTrusted) {
    if (forceTrusted === void 0) {
      forceTrusted = false;
    }
    if (expression === null || expression === undefined) {
      return {
        expr: {
          type: "Literal"
          /* Literal */,

          value: expression
        },
        kind: "AppendExpr"
        /* AppendExpr */,

        trusted: false
      };
    } else if (Array.isArray(expression)) {
      switch (expression[0]) {
        case 0
        /* Literal */:
          return {
            expr: {
              type: "Literal"
              /* Literal */,

              value: expression[1]
            },
            kind: "AppendExpr"
            /* AppendExpr */,

            trusted: false
          };
        case 5
        /* Get */:
          {
            return normalizeAppendHead(normalizePath(expression[1], expression[2]), forceTrusted);
          }
        case 6
        /* Concat */:
          {
            var expr = {
              type: "Concat"
              /* Concat */,

              params: normalizeParams(expression.slice(1))
            };
            return {
              expr,
              kind: "AppendExpr"
              /* AppendExpr */,

              trusted: forceTrusted
            };
          }
        case 7
        /* HasBlock */:
          return {
            expr: {
              type: "HasBlock"
              /* HasBlock */,

              name: expression[1]
            },
            kind: "AppendExpr"
            /* AppendExpr */,

            trusted: forceTrusted
          };
        case 8
        /* HasBlockParams */:
          return {
            expr: {
              type: "HasBlockParams"
              /* HasBlockParams */,

              name: expression[1]
            },
            kind: "AppendExpr"
            /* AppendExpr */,

            trusted: forceTrusted
          };
        default:
          {
            if (isBuilderCallExpression(expression)) {
              return {
                expr: normalizeCallExpression(expression),
                kind: "AppendExpr"
                /* AppendExpr */,

                trusted: forceTrusted
              };
            } else {
              throw new Error("Unexpected array in expression position (wasn't a tuple expression and " + expression[0] + " isn't wrapped in parens, so it isn't a call): " + JSON.stringify(expression));
            }
          }
        // BuilderCallExpression
      }
    } else if (typeof expression !== 'object') {
      switch (typeof expression) {
        case 'string':
          {
            return normalizeAppendHead(normalizeDottedPath(expression), forceTrusted);
          }
        case 'boolean':
        case 'number':
          return {
            expr: {
              type: "Literal"
              /* Literal */,

              value: expression
            },
            kind: "AppendExpr"
            /* AppendExpr */,

            trusted: true
          };
        default:
          throw (0, _util.assertNever)(expression);
      }
    } else {
      throw (0, _util.assertNever)(expression);
    }
  }
  function normalizeExpression(expression) {
    if (expression === null || expression === undefined) {
      return {
        type: "Literal"
        /* Literal */,

        value: expression
      };
    } else if (Array.isArray(expression)) {
      switch (expression[0]) {
        case 0
        /* Literal */:
          return {
            type: "Literal"
            /* Literal */,

            value: expression[1]
          };
        case 5
        /* Get */:
          {
            return normalizePath(expression[1], expression[2]);
          }
        case 6
        /* Concat */:
          {
            var expr = {
              type: "Concat"
              /* Concat */,

              params: normalizeParams(expression.slice(1))
            };
            return expr;
          }
        case 7
        /* HasBlock */:
          return {
            type: "HasBlock"
            /* HasBlock */,

            name: expression[1]
          };
        case 8
        /* HasBlockParams */:
          return {
            type: "HasBlockParams"
            /* HasBlockParams */,

            name: expression[1]
          };
        default:
          {
            if (isBuilderCallExpression(expression)) {
              return normalizeCallExpression(expression);
            } else {
              throw new Error("Unexpected array in expression position (wasn't a tuple expression and " + expression[0] + " isn't wrapped in parens, so it isn't a call): " + JSON.stringify(expression));
            }
          }
        // BuilderCallExpression
      }
    } else if (typeof expression !== 'object') {
      switch (typeof expression) {
        case 'string':
          {
            return normalizeDottedPath(expression);
          }
        case 'boolean':
        case 'number':
          return {
            type: "Literal"
            /* Literal */,

            value: expression
          };
        default:
          throw (0, _util.assertNever)(expression);
      }
    } else {
      throw (0, _util.assertNever)(expression);
    }
  }
  function statementIsExpression(statement) {
    if (!Array.isArray(statement)) {
      return false;
    }
    var name = statement[0];
    if (typeof name === 'number') {
      switch (name) {
        case 0
        /* Literal */:

        case 5
        /* Get */:

        case 6
        /* Concat */:

        case 7
        /* HasBlock */:

        case 8
        /* HasBlockParams */:
          return true;
        default:
          return false;
      }
    }
    if (name[0] === '(') {
      return true;
    }
    return false;
  }
  function isBuilderCallExpression(value) {
    return typeof value[0] === 'string' && value[0][0] === '(';
  }
  function normalizeParams(input) {
    return input.map(normalizeExpression);
  }
  function normalizeHash(input) {
    if (input === null) return null;
    return mapObject(input, normalizeExpression);
  }
  function normalizeCallExpression(expr) {
    switch (expr.length) {
      case 1:
        return {
          type: "Call"
          /* Call */,

          head: normalizeCallHead(expr[0]),
          params: null,
          hash: null
        };
      case 2:
        {
          if (Array.isArray(expr[1])) {
            return {
              type: "Call"
              /* Call */,

              head: normalizeCallHead(expr[0]),
              params: normalizeParams(expr[1]),
              hash: null
            };
          } else {
            return {
              type: "Call"
              /* Call */,

              head: normalizeCallHead(expr[0]),
              params: null,
              hash: normalizeHash(expr[1])
            };
          }
        }
      case 3:
        return {
          type: "Call"
          /* Call */,

          head: normalizeCallHead(expr[0]),
          params: normalizeParams(expr[1]),
          hash: normalizeHash(expr[2])
        };
    }
  }
  class ProgramSymbols {
    constructor() {
      this._freeVariables = [];
      this._symbols = ['this'];
      this.top = this;
    }
    toSymbols() {
      return this._symbols.slice(1);
    }
    toUpvars() {
      return this._freeVariables;
    }
    freeVar(name) {
      return addString(this._freeVariables, name);
    }
    block(name) {
      return this.symbol(name);
    }
    arg(name) {
      return addString(this._symbols, name);
    }
    local(name) {
      throw new Error("No local " + name + " was found. Maybe you meant ^" + name + " for upvar, or !" + name + " for keyword?");
    }
    this() {
      return 0;
    }
    hasLocal(_name) {
      return false;
    } // any symbol

    symbol(name) {
      return addString(this._symbols, name);
    }
    child(locals) {
      return new LocalSymbols(this, locals);
    }
  }
  _exports.ProgramSymbols = ProgramSymbols;
  class LocalSymbols {
    constructor(parent, locals) {
      this.parent = parent;
      this.locals = (0, _util.dict)();
      for (var local of locals) {
        this.locals[local] = parent.top.symbol(local);
      }
    }
    get paramSymbols() {
      return (0, _util.values)(this.locals);
    }
    get top() {
      return this.parent.top;
    }
    freeVar(name) {
      return this.parent.freeVar(name);
    }
    arg(name) {
      return this.parent.arg(name);
    }
    block(name) {
      return this.parent.block(name);
    }
    local(name) {
      if (name in this.locals) {
        return this.locals[name];
      } else {
        return this.parent.local(name);
      }
    }
    this() {
      return this.parent.this();
    }
    hasLocal(name) {
      if (name in this.locals) {
        return true;
      } else {
        return this.parent.hasLocal(name);
      }
    }
    child(locals) {
      return new LocalSymbols(this, locals);
    }
  }
  function addString(array, item) {
    var index = array.indexOf(item);
    if (index === -1) {
      index = array.length;
      array.push(item);
      return index;
    } else {
      return index;
    }
  }
  function unimpl(message) {
    return new Error("unimplemented " + message);
  }
  function buildStatements(statements, symbols) {
    var out = [];
    statements.forEach(s => out.push(...buildStatement(normalizeStatement(s), symbols)));
    return out;
  }
  function buildNormalizedStatements(statements, symbols) {
    var out = [];
    statements.forEach(s => out.push(...buildStatement(s, symbols)));
    return out;
  }
  function buildStatement(normalized, symbols) {
    if (symbols === void 0) {
      symbols = new ProgramSymbols();
    }
    switch (normalized.kind) {
      case "AppendPath"
      /* AppendPath */:
        {
          return [[normalized.trusted ? 2
          /* TrustingAppend */ : 1
          /* Append */, buildGetPath(normalized.path, symbols)]];
        }
      case "AppendExpr"
      /* AppendExpr */:
        {
          return [[normalized.trusted ? 2
          /* TrustingAppend */ : 1
          /* Append */, buildExpression(normalized.expr, normalized.trusted ? 'TrustedAppend' : 'Append', symbols)]];
        }
      case "Call"
      /* Call */:
        {
          var {
            head: path,
            params,
            hash,
            trusted
          } = normalized;
          var builtParams = params ? buildParams(params, symbols) : null;
          var builtHash = hash ? buildHash(hash, symbols) : null;
          var builtExpr = buildCallHead(path, trusted ? 3
          /* AmbiguousInvoke */ : 2
          /* AmbiguousAppendInvoke */, symbols);
          return [[trusted ? 2
          /* TrustingAppend */ : 1
          /* Append */, [28
          /* Call */, builtExpr, builtParams, builtHash]]];
        }
      case "Literal"
      /* Literal */:
        {
          return [[1
          /* Append */, normalized.value]];
        }
      case "Comment"
      /* Comment */:
        {
          return [[3
          /* Comment */, normalized.value]];
        }
      case "Block"
      /* Block */:
        {
          var blocks = buildBlocks(normalized.blocks, normalized.blockParams, symbols);
          var _hash3 = buildHash(normalized.hash, symbols);
          var _params3 = buildParams(normalized.params, symbols);
          var _path = buildCallHead(normalized.head, 7
          /* ResolveAsComponentHead */, symbols);
          return [[6
          /* Block */, _path, _params3, _hash3, blocks]];
        }
      case "Keyword"
      /* Keyword */:
        {
          return [buildKeyword(normalized, symbols)];
        }
      case "Element"
      /* Element */:
        return buildElement(normalized, symbols);
      case "Modifier"
      /* Modifier */:
        throw unimpl('modifier');
      case "DynamicComponent"
      /* DynamicComponent */:
        throw unimpl('dynamic component');
      default:
        throw (0, _util.assertNever)(normalized);
    }
  }
  function s(arr) {
    for (var _len2 = arguments.length, interpolated = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      interpolated[_key2 - 1] = arguments[_key2];
    }
    var result = arr.reduce((result, string, i) => result + ("" + string + (interpolated[i] ? String(interpolated[i]) : '')), '');
    return [0
    /* Literal */, result];
  }
  function c(arr) {
    for (var _len3 = arguments.length, interpolated = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
      interpolated[_key3 - 1] = arguments[_key3];
    }
    var result = arr.reduce((result, string, i) => result + ("" + string + (interpolated[i] ? String(interpolated[i]) : '')), '');
    return [1
    /* Comment */, result];
  }
  function unicode(charCode) {
    return String.fromCharCode(parseInt(charCode, 16));
  }
  var NEWLINE = '\n';
  _exports.NEWLINE = NEWLINE;
  function buildKeyword(normalized, symbols) {
    var {
      name
    } = normalized;
    var params = buildParams(normalized.params, symbols);
    var childSymbols = symbols.child(normalized.blockParams || []);
    var block = buildBlock(normalized.blocks.default, childSymbols, childSymbols.paramSymbols);
    var inverse = normalized.blocks.else ? buildBlock(normalized.blocks.else, symbols, []) : null;
    switch (name) {
      case 'with':
        return [43
        /* With */, params[0], block, inverse];
      case 'if':
        return [41
        /* If */, params[0], block, inverse];
      case 'each':
        var keyExpr = normalized.hash ? normalized.hash['key'] : null;
        var key = keyExpr ? buildExpression(keyExpr, 'Strict', symbols) : null;
        return [42
        /* Each */, params[0], key, block, inverse];
      default:
        throw new Error('unimplemented keyword');
    }
  }
  function buildElement(_ref99, symbols) {
    var {
      name,
      attrs,
      block
    } = _ref99;
    var out = [hasSplat(attrs) ? [11
    /* OpenElementWithSplat */, name] : [10
    /* OpenElement */, name]];
    if (attrs) {
      var {
        params,
        args
      } = buildElementParams(attrs, symbols);
      out.push(...params);
    }
    out.push([12
    /* FlushElement */]);

    if (Array.isArray(block)) {
      block.forEach(s => out.push(...buildStatement(s, symbols)));
    } else if (block === null) ;else {
      throw (0, _util.assertNever)(block);
    }
    out.push([13
    /* CloseElement */]);

    return out;
  }
  function hasSplat(attrs) {
    if (attrs === null) return false;
    return Object.keys(attrs).some(a => attrs[a] === "Splat"
    /* Splat */);
  }

  function buildElementParams(attrs, symbols) {
    var params = [];
    var keys = [];
    var values = [];
    Object.keys(attrs).forEach(key => {
      var value = attrs[key];
      if (value === "Splat"
      /* Splat */) {
        params.push([17
        /* AttrSplat */, symbols.block('&attrs')]);
      } else if (key[0] === '@') {
        keys.push(key);
        values.push(buildExpression(value, 'Strict', symbols));
      } else {
        params.push(...buildAttributeValue(key, value,
        // TODO: extract namespace from key
        extractNamespace(key), symbols));
      }
    });
    return {
      params,
      args: (0, _util.isPresent)(keys) && (0, _util.isPresent)(values) ? [keys, values] : null
    };
  }
  function extractNamespace(name) {
    if (name === 'xmlns') {
      return "http://www.w3.org/2000/xmlns/"
      /* XMLNS */;
    }

    var match = /^([^:]*):([^:]*)$/.exec(name);
    if (match === null) {
      return null;
    }
    var namespace = match[1];
    switch (namespace) {
      case 'xlink':
        return "http://www.w3.org/1999/xlink"
        /* XLink */;

      case 'xml':
        return "http://www.w3.org/XML/1998/namespace"
        /* XML */;

      case 'xmlns':
        return "http://www.w3.org/2000/xmlns/"
        /* XMLNS */;
    }

    return null;
  }
  function buildAttributeValue(name, value, namespace, symbols) {
    switch (value.type) {
      case "Literal"
      /* Literal */:
        {
          var val = value.value;
          if (val === false) {
            return [];
          } else if (val === true) {
            return [[14
            /* StaticAttr */, name, '', namespace !== null && namespace !== void 0 ? namespace : undefined]];
          } else if (typeof val === 'string') {
            return [[14
            /* StaticAttr */, name, val, namespace !== null && namespace !== void 0 ? namespace : undefined]];
          } else {
            throw new Error("Unexpected/unimplemented literal attribute " + JSON.stringify(val));
          }
        }
      default:
        return [[15
        /* DynamicAttr */, name, buildExpression(value, 'AttrValue', symbols), namespace !== null && namespace !== void 0 ? namespace : undefined]];
    }
  }
  function varContext(context, bare) {
    switch (context) {
      case 'Append':
        return bare ? 'AppendBare' : 'AppendInvoke';
      case 'TrustedAppend':
        return bare ? 'TrustedAppendBare' : 'TrustedAppendInvoke';
      case 'AttrValue':
        return bare ? 'AttrValueBare' : 'AttrValueInvoke';
      default:
        return context;
    }
  }
  function buildExpression(expr, context, symbols) {
    switch (expr.type) {
      case "GetPath"
      /* GetPath */:
        {
          return buildGetPath(expr, symbols);
        }
      case "GetVar"
      /* GetVar */:
        {
          return buildVar(expr.variable, varContext(context, true), symbols);
        }
      case "Concat"
      /* Concat */:
        {
          return [29
          /* Concat */, buildConcat(expr.params, symbols)];
        }
      case "Call"
      /* Call */:
        {
          var builtParams = buildParams(expr.params, symbols);
          var builtHash = buildHash(expr.hash, symbols);
          var builtExpr = buildCallHead(expr.head, context === 'Strict' ? 'SubExpression' : varContext(context, false), symbols);
          return [28
          /* Call */, builtExpr, builtParams, builtHash];
        }
      case "HasBlock"
      /* HasBlock */:
        {
          return [48
          /* HasBlock */, buildVar({
            kind: VariableKind.Block,
            name: expr.name,
            mode: 'loose'
          }, 0
          /* Strict */, symbols)];
        }
      case "HasBlockParams"
      /* HasBlockParams */:
        {
          return [49
          /* HasBlockParams */, buildVar({
            kind: VariableKind.Block,
            name: expr.name,
            mode: 'loose'
          }, 0
          /* Strict */, symbols)];
        }
      case "Literal"
      /* Literal */:
        {
          if (expr.value === undefined) {
            return [27
            /* Undefined */];
          } else {
            return expr.value;
          }
        }
      default:
        (0, _util.assertNever)(expr);
    }
  }
  function buildCallHead(callHead, context, symbols) {
    if (callHead.type === "GetVar"
    /* GetVar */) {
      return buildVar(callHead.variable, context, symbols);
    } else {
      return buildGetPath(callHead, symbols);
    }
  }
  function buildGetPath(head, symbols) {
    return buildVar(head.path.head, 0
    /* Strict */, symbols, head.path.tail);
  }
  function buildVar(head, context, symbols, path) {
    var op = 30
    /* GetSymbol */;

    var sym;
    switch (head.kind) {
      case VariableKind.Free:
        if (context === 'Strict') {
          op = 31
          /* GetStrictFree */;
        } else if (context === 'AppendBare') {
          op = 34
          /* GetFreeAsComponentOrHelperHeadOrThisFallback */;
        } else if (context === 'AppendInvoke') {
          op = 35
          /* GetFreeAsComponentOrHelperHead */;
        } else if (context === 'TrustedAppendBare') {
          op = 36
          /* GetFreeAsHelperHeadOrThisFallback */;
        } else if (context === 'TrustedAppendInvoke') {
          op = 37
          /* GetFreeAsHelperHead */;
        } else if (context === 'AttrValueBare') {
          op = 36
          /* GetFreeAsHelperHeadOrThisFallback */;
        } else if (context === 'AttrValueInvoke') {
          op = 37
          /* GetFreeAsHelperHead */;
        } else if (context === 'SubExpression') {
          op = 37
          /* GetFreeAsHelperHead */;
        } else {
          op = expressionContextOp(context);
        }
        sym = symbols.freeVar(head.name);
        break;
      default:
        op = 30
        /* GetSymbol */;

        sym = getSymbolForVar(head.kind, symbols, head.name);
    }
    if (path === undefined || path.length === 0) {
      return [op, sym];
    } else {
      return [op, sym, path];
    }
  }
  function getSymbolForVar(kind, symbols, name) {
    switch (kind) {
      case VariableKind.Arg:
        return symbols.arg(name);
      case VariableKind.Block:
        return symbols.block(name);
      case VariableKind.Local:
        return symbols.local(name);
      case VariableKind.This:
        return symbols.this();
      default:
        return (0, _util.exhausted)(kind);
    }
  }
  function expressionContextOp(context) {
    switch (context) {
      case 0
      /* Strict */:
        return 31
        /* GetStrictFree */;

      case 1
      /* AmbiguousAppend */:
        return 34
        /* GetFreeAsComponentOrHelperHeadOrThisFallback */;

      case 2
      /* AmbiguousAppendInvoke */:
        return 35
        /* GetFreeAsComponentOrHelperHead */;

      case 3
      /* AmbiguousInvoke */:
        return 36
        /* GetFreeAsHelperHeadOrThisFallback */;

      case 5
      /* ResolveAsCallHead */:
        return 37
        /* GetFreeAsHelperHead */;

      case 6
      /* ResolveAsModifierHead */:
        return 38
        /* GetFreeAsModifierHead */;

      case 7
      /* ResolveAsComponentHead */:
        return 39
        /* GetFreeAsComponentHead */;

      default:
        return (0, _util.exhausted)(context);
    }
  }
  function buildParams(exprs, symbols) {
    if (exprs === null || !(0, _util.isPresent)(exprs)) return null;
    return exprs.map(e => buildExpression(e, 'Strict', symbols));
  }
  function buildConcat(exprs, symbols) {
    return exprs.map(e => buildExpression(e, 'AttrValue', symbols));
  }
  function buildHash(exprs, symbols) {
    if (exprs === null) return null;
    var out = [[], []];
    Object.keys(exprs).forEach(key => {
      out[0].push(key);
      out[1].push(buildExpression(exprs[key], 'Strict', symbols));
    });
    return out;
  }
  function buildBlocks(blocks, blockParams, parent) {
    var keys = [];
    var values = [];
    Object.keys(blocks).forEach(name => {
      keys.push(name);
      if (name === 'default') {
        var symbols = parent.child(blockParams || []);
        values.push(buildBlock(blocks[name], symbols, symbols.paramSymbols));
      } else {
        values.push(buildBlock(blocks[name], parent, []));
      }
    });
    return [keys, values];
  }
  function buildBlock(block, symbols, locals) {
    if (locals === void 0) {
      locals = [];
    }
    return [buildNormalizedStatements(block, symbols), locals];
  }
});
define("@glimmer/env", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.DEBUG = _exports.CI = void 0;
  var DEBUG = false;
  _exports.DEBUG = DEBUG;
  var CI = false;
  _exports.CI = CI;
});
define("@glimmer/syntax", ["exports", "@glimmer/util", "@handlebars/parser", "simple-html-tokenizer"], function (_exports, _util, _parser, _simpleHtmlTokenizer) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.builders = _exports.WalkerPath = _exports.Walker = _exports.SymbolTable = _exports.SpanList = _exports.SourceSpan = _exports.SourceSlice = _exports.Source = _exports.ProgramSymbolTable = _exports.Path = _exports.KEYWORDS_TYPES = _exports.BlockSymbolTable = _exports.ASTv2 = _exports.ASTv1 = _exports.AST = void 0;
  _exports.cannotRemoveNode = cannotRemoveNode;
  _exports.cannotReplaceNode = cannotReplaceNode;
  _exports.generateSyntaxError = generateSyntaxError;
  _exports.getTemplateLocals = getTemplateLocals;
  _exports.hasSpan = hasSpan;
  _exports.isKeyword = isKeyword;
  _exports.loc = loc;
  _exports.maybeLoc = maybeLoc;
  _exports.node = node;
  _exports.normalize = normalize;
  _exports.preprocess = preprocess;
  _exports.print = build;
  _exports.sortByLoc = sortByLoc;
  _exports.traverse = traverse;
  var UNKNOWN_POSITION = Object.freeze({
    line: 1,
    column: 0
  });
  var SYNTHETIC_LOCATION = Object.freeze({
    source: '(synthetic)',
    start: UNKNOWN_POSITION,
    end: UNKNOWN_POSITION
  });
  var TEMPORARY_LOCATION = Object.freeze({
    source: '(temporary)',
    start: UNKNOWN_POSITION,
    end: UNKNOWN_POSITION
  });
  var NON_EXISTENT_LOCATION = Object.freeze({
    source: '(nonexistent)',
    start: UNKNOWN_POSITION,
    end: UNKNOWN_POSITION
  });
  var BROKEN_LOCATION = Object.freeze({
    source: '(broken)',
    start: UNKNOWN_POSITION,
    end: UNKNOWN_POSITION
  });
  class SourceSlice {
    constructor(options) {
      this.loc = options.loc;
      this.chars = options.chars;
    }
    static synthetic(chars) {
      var offsets = SourceSpan.synthetic(chars);
      return new SourceSlice({
        loc: offsets,
        chars: chars
      });
    }
    static load(source, slice) {
      return new SourceSlice({
        loc: SourceSpan.load(source, slice[1]),
        chars: slice[0]
      });
    }
    getString() {
      return this.chars;
    }
    serialize() {
      return [this.chars, this.loc.serialize()];
    }
  }

  /**
   * This file implements the DSL used by span and offset in places where they need to exhaustively
   * consider all combinations of states (Handlebars offsets, character offsets and invisible/broken
   * offsets).
   *
   * It's probably overkill, but it makes the code that uses it clear. It could be refactored or
   * removed.
   */
  _exports.SourceSlice = SourceSlice;
  var MatchAny = 'MATCH_ANY';
  var IsInvisible = 'IS_INVISIBLE';
  class WhenList {
    constructor(whens) {
      this._whens = whens;
    }
    first(kind) {
      for (var when of this._whens) {
        var value = when.match(kind);
        if ((0, _util.isPresent)(value)) {
          return value[0];
        }
      }
      return null;
    }
  }
  class When {
    constructor() {
      this._map = new Map();
    }
    get(pattern, or) {
      var value = this._map.get(pattern);
      if (value) {
        return value;
      }
      value = or();
      this._map.set(pattern, value);
      return value;
    }
    add(pattern, out) {
      this._map.set(pattern, out);
    }
    match(kind) {
      var pattern = patternFor(kind);
      var out = [];
      var exact = this._map.get(pattern);
      var fallback = this._map.get(MatchAny);
      if (exact) {
        out.push(exact);
      }
      if (fallback) {
        out.push(fallback);
      }
      return out;
    }
  }
  function match(callback) {
    return callback(new Matcher()).check();
  }
  class Matcher {
    constructor() {
      this._whens = new When();
    }
    /**
     * You didn't exhaustively match all possibilities.
     */

    check() {
      return (left, right) => this.matchFor(left.kind, right.kind)(left, right);
    }
    matchFor(left, right) {
      var nesteds = this._whens.match(left);
      var callback = new WhenList(nesteds).first(right);
      return callback;
    }
    when(left, right,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback) {
      this._whens.get(left, () => new When()).add(right, callback);
      return this;
    }
  }
  function patternFor(kind) {
    switch (kind) {
      case "Broken"
      /* Broken */:

      case "InternalsSynthetic"
      /* InternalsSynthetic */:

      case "NonExistent"
      /* NonExistent */:
        return IsInvisible;
      default:
        return kind;
    }
  }

  // eslint-disable-next-line import/no-extraneous-dependencies
  /**
   * Used to indicate that an attempt to convert a `SourcePosition` to a character offset failed. It
   * is separate from `null` so that `null` can be used to indicate that the computation wasn't yet
   * attempted (and therefore to cache the failure)
   */

  var BROKEN = 'BROKEN';
  /**
   * A `SourceOffset` represents a single position in the source.
   *
   * There are three kinds of backing data for `SourceOffset` objects:
   *
   * - `CharPosition`, which contains a character offset into the raw source string
   * - `HbsPosition`, which contains a `SourcePosition` from the Handlebars AST, which can be
   *   converted to a `CharPosition` on demand.
   * - `InvisiblePosition`, which represents a position not in source (@see {InvisiblePosition})
   */

  class SourceOffset {
    constructor(data) {
      this.data = data;
    }
    /**
     * Create a `SourceOffset` from a Handlebars `SourcePosition`. It's stored as-is, and converted
     * into a character offset on demand, which avoids unnecessarily computing the offset of every
     * `SourceLocation`, but also means that broken `SourcePosition`s are not always detected.
     */

    static forHbsPos(source, pos) {
      return new HbsPosition(source, pos, null).wrap();
    }
    /**
     * Create a `SourceOffset` that corresponds to a broken `SourcePosition`. This means that the
     * calling code determined (or knows) that the `SourceLocation` doesn't correspond correctly to
     * any part of the source.
     */

    static broken(pos) {
      if (pos === void 0) {
        pos = UNKNOWN_POSITION;
      }
      return new InvisiblePosition("Broken"
      /* Broken */, pos).wrap();
    }
    /**
     * Get the character offset for this `SourceOffset`, if possible.
     */

    get offset() {
      var charPos = this.data.toCharPos();
      return charPos === null ? null : charPos.offset;
    }
    /**
     * Compare this offset with another one.
     *
     * If both offsets are `HbsPosition`s, they're equivalent as long as their lines and columns are
     * the same. This avoids computing offsets unnecessarily.
     *
     * Otherwise, two `SourceOffset`s are equivalent if their successfully computed character offsets
     * are the same.
     */

    eql(right) {
      return eql(this.data, right.data);
    }
    /**
     * Create a span that starts from this source offset and ends with another source offset. Avoid
     * computing character offsets if both `SourceOffset`s are still lazy.
     */

    until(other) {
      return span(this.data, other.data);
    }
    /**
     * Create a `SourceOffset` by moving the character position represented by this source offset
     * forward or backward (if `by` is negative), if possible.
     *
     * If this `SourceOffset` can't compute a valid character offset, `move` returns a broken offset.
     *
     * If the resulting character offset is less than 0 or greater than the size of the source, `move`
     * returns a broken offset.
     */

    move(by) {
      var charPos = this.data.toCharPos();
      if (charPos === null) {
        return SourceOffset.broken();
      } else {
        var result = charPos.offset + by;
        if (charPos.source.check(result)) {
          return new CharPosition(charPos.source, result).wrap();
        } else {
          return SourceOffset.broken();
        }
      }
    }
    /**
     * Create a new `SourceSpan` that represents a collapsed range at this source offset. Avoid
     * computing the character offset if it has not already been computed.
     */

    collapsed() {
      return span(this.data, this.data);
    }
    /**
     * Convert this `SourceOffset` into a Handlebars {@see SourcePosition} for compatibility with
     * existing plugins.
     */

    toJSON() {
      return this.data.toJSON();
    }
  }
  class CharPosition {
    constructor(source, charPos) {
      this.source = source;
      this.charPos = charPos;
      this.kind = "CharPosition"
      /* CharPosition */;
      /** Computed from char offset */

      this._locPos = null;
    }
    /**
     * This is already a `CharPosition`.
     *
     * {@see HbsPosition} for the alternative.
     *
     * @implements {PositionData}
     */

    toCharPos() {
      return this;
    }
    /**
     * Produce a Handlebars {@see SourcePosition} for this `CharPosition`. If this `CharPosition` was
     * computed using {@see SourceOffset#move}, this will compute the `SourcePosition` for the offset.
     *
     * @implements {PositionData}
     */

    toJSON() {
      var hbs = this.toHbsPos();
      return hbs === null ? UNKNOWN_POSITION : hbs.toJSON();
    }
    wrap() {
      return new SourceOffset(this);
    }
    /**
     * A `CharPosition` always has an offset it can produce without any additional computation.
     */

    get offset() {
      return this.charPos;
    }
    /**
     * Convert the current character offset to an `HbsPosition`, if it was not already computed. Once
     * a `CharPosition` has computed its `HbsPosition`, it will not need to do compute it again, and
     * the same `CharPosition` is retained when used as one of the ends of a `SourceSpan`, so
     * computing the `HbsPosition` should be a one-time operation.
     */

    toHbsPos() {
      var locPos = this._locPos;
      if (locPos === null) {
        var hbsPos = this.source.hbsPosFor(this.charPos);
        if (hbsPos === null) {
          this._locPos = locPos = BROKEN;
        } else {
          this._locPos = locPos = new HbsPosition(this.source, hbsPos, this.charPos);
        }
      }
      return locPos === BROKEN ? null : locPos;
    }
  }
  class HbsPosition {
    constructor(source, hbsPos, charPos) {
      if (charPos === void 0) {
        charPos = null;
      }
      this.source = source;
      this.hbsPos = hbsPos;
      this.kind = "HbsPosition"
      /* HbsPosition */;

      this._charPos = charPos === null ? null : new CharPosition(source, charPos);
    }
    /**
     * Lazily compute the character offset from the {@see SourcePosition}. Once an `HbsPosition` has
     * computed its `CharPosition`, it will not need to do compute it again, and the same
     * `HbsPosition` is retained when used as one of the ends of a `SourceSpan`, so computing the
     * `CharPosition` should be a one-time operation.
     *
     * @implements {PositionData}
     */

    toCharPos() {
      var charPos = this._charPos;
      if (charPos === null) {
        var charPosNumber = this.source.charPosFor(this.hbsPos);
        if (charPosNumber === null) {
          this._charPos = charPos = BROKEN;
        } else {
          this._charPos = charPos = new CharPosition(this.source, charPosNumber);
        }
      }
      return charPos === BROKEN ? null : charPos;
    }
    /**
     * Return the {@see SourcePosition} that this `HbsPosition` was instantiated with. This operation
     * does not need to compute anything.
     *
     * @implements {PositionData}
     */

    toJSON() {
      return this.hbsPos;
    }
    wrap() {
      return new SourceOffset(this);
    }
    /**
     * This is already an `HbsPosition`.
     *
     * {@see CharPosition} for the alternative.
     */

    toHbsPos() {
      return this;
    }
  }
  class InvisiblePosition {
    constructor(kind,
    // whatever was provided, possibly broken
    pos) {
      this.kind = kind;
      this.pos = pos;
    }
    /**
     * A broken position cannot be turned into a {@see CharacterPosition}.
     */

    toCharPos() {
      return null;
    }
    /**
     * The serialization of an `InvisiblePosition is whatever Handlebars {@see SourcePosition} was
     * originally identified as broken, non-existent or synthetic.
     *
     * If an `InvisiblePosition` never had an source offset at all, this method returns
     * {@see UNKNOWN_POSITION} for compatibility.
     */

    toJSON() {
      return this.pos;
    }
    wrap() {
      return new SourceOffset(this);
    }
    get offset() {
      return null;
    }
  }
  /**
   * Compare two {@see AnyPosition} and determine whether they are equal.
   *
   * @see {SourceOffset#eql}
   */

  var eql = match(m => m.when("HbsPosition"
  /* HbsPosition */, "HbsPosition"
  /* HbsPosition */, (_ref, _ref2) => {
    var {
      hbsPos: left
    } = _ref;
    var {
      hbsPos: right
    } = _ref2;
    return left.column === right.column && left.line === right.line;
  }).when("CharPosition"
  /* CharPosition */, "CharPosition"
  /* CharPosition */, (_ref3, _ref4) => {
    var {
      charPos: left
    } = _ref3;
    var {
      charPos: right
    } = _ref4;
    return left === right;
  }).when("CharPosition"
  /* CharPosition */, "HbsPosition"
  /* HbsPosition */, (_ref5, right) => {
    var {
      offset: left
    } = _ref5;
    var _a;
    return left === ((_a = right.toCharPos()) === null || _a === void 0 ? void 0 : _a.offset);
  }).when("HbsPosition"
  /* HbsPosition */, "CharPosition"
  /* CharPosition */, (left, _ref6) => {
    var {
      offset: right
    } = _ref6;
    var _a;
    return ((_a = left.toCharPos()) === null || _a === void 0 ? void 0 : _a.offset) === right;
  }).when(MatchAny, MatchAny, () => false));

  // eslint-disable-next-line import/no-extraneous-dependencies
  /**
   * A `SourceSpan` object represents a span of characters inside of a template source.
   *
   * There are three kinds of `SourceSpan` objects:
   *
   * - `ConcreteSourceSpan`, which contains byte offsets
   * - `LazySourceSpan`, which contains `SourceLocation`s from the Handlebars AST, which can be
   *   converted to byte offsets on demand.
   * - `InvisibleSourceSpan`, which represent source strings that aren't present in the source,
   *   because:
   *     - they were created synthetically
   *     - their location is nonsensical (the span is broken)
   *     - they represent nothing in the source (this currently happens only when a bug in the
   *       upstream Handlebars parser fails to assign a location to empty blocks)
   *
   * At a high level, all `SourceSpan` objects provide:
   *
   * - byte offsets
   * - source in column and line format
   *
   * And you can do these operations on `SourceSpan`s:
   *
   * - collapse it to a `SourceSpan` representing its starting or ending position
   * - slice out some characters, optionally skipping some characters at the beginning or end
   * - create a new `SourceSpan` with a different starting or ending offset
   *
   * All SourceSpan objects implement `SourceLocation`, for compatibility. All SourceSpan
   * objects have a `toJSON` that emits `SourceLocation`, also for compatibility.
   *
   * For compatibility, subclasses of `AbstractSourceSpan` must implement `locDidUpdate`, which
   * happens when an AST plugin attempts to modify the `start` or `end` of a span directly.
   *
   * The goal is to avoid creating any problems for use-cases like AST Explorer.
   */

  class SourceSpan {
    constructor(data) {
      this.data = data;
      this.isInvisible = data.kind !== "CharPosition"
      /* CharPosition */ && data.kind !== "HbsPosition"
      /* HbsPosition */;
    }

    static get NON_EXISTENT() {
      return new InvisibleSpan("NonExistent"
      /* NonExistent */, NON_EXISTENT_LOCATION).wrap();
    }
    static load(source, serialized) {
      if (typeof serialized === 'number') {
        return SourceSpan.forCharPositions(source, serialized, serialized);
      } else if (typeof serialized === 'string') {
        return SourceSpan.synthetic(serialized);
      } else if (Array.isArray(serialized)) {
        return SourceSpan.forCharPositions(source, serialized[0], serialized[1]);
      } else if (serialized === "NonExistent"
      /* NonExistent */) {
        return SourceSpan.NON_EXISTENT;
      } else if (serialized === "Broken"
      /* Broken */) {
        return SourceSpan.broken(BROKEN_LOCATION);
      }
      (0, _util.assertNever)(serialized);
    }
    static forHbsLoc(source, loc) {
      var start = new HbsPosition(source, loc.start);
      var end = new HbsPosition(source, loc.end);
      return new HbsSpan(source, {
        start,
        end
      }, loc).wrap();
    }
    static forCharPositions(source, startPos, endPos) {
      var start = new CharPosition(source, startPos);
      var end = new CharPosition(source, endPos);
      return new CharPositionSpan(source, {
        start,
        end
      }).wrap();
    }
    static synthetic(chars) {
      return new InvisibleSpan("InternalsSynthetic"
      /* InternalsSynthetic */, NON_EXISTENT_LOCATION, chars).wrap();
    }
    static broken(pos) {
      if (pos === void 0) {
        pos = BROKEN_LOCATION;
      }
      return new InvisibleSpan("Broken"
      /* Broken */, pos).wrap();
    }
    getStart() {
      return this.data.getStart().wrap();
    }
    getEnd() {
      return this.data.getEnd().wrap();
    }
    get loc() {
      var span = this.data.toHbsSpan();
      return span === null ? BROKEN_LOCATION : span.toHbsLoc();
    }
    get module() {
      return this.data.getModule();
    }
    /**
     * Get the starting `SourcePosition` for this `SourceSpan`, lazily computing it if needed.
     */

    get startPosition() {
      return this.loc.start;
    }
    /**
     * Get the ending `SourcePosition` for this `SourceSpan`, lazily computing it if needed.
     */

    get endPosition() {
      return this.loc.end;
    }
    /**
     * Support converting ASTv1 nodes into a serialized format using JSON.stringify.
     */

    toJSON() {
      return this.loc;
    }
    /**
     * Create a new span with the current span's end and a new beginning.
     */

    withStart(other) {
      return span(other.data, this.data.getEnd());
    }
    /**
     * Create a new span with the current span's beginning and a new ending.
     */

    withEnd(other) {
      return span(this.data.getStart(), other.data);
    }
    asString() {
      return this.data.asString();
    }
    /**
     * Convert this `SourceSpan` into a `SourceSlice`. In debug mode, this method optionally checks
     * that the byte offsets represented by this `SourceSpan` actually correspond to the expected
     * string.
     */

    toSlice(expected) {
      var chars = this.data.asString();
      if (true /* DEBUG */) {
        if (expected !== undefined && chars !== expected) {
          // eslint-disable-next-line no-console
          console.warn("unexpectedly found " + JSON.stringify(chars) + " when slicing source, but expected " + JSON.stringify(expected));
        }
      }
      return new SourceSlice({
        loc: this,
        chars: expected || chars
      });
    }
    /**
     * For compatibility with SourceLocation in AST plugins
     *
     * @deprecated use startPosition instead
     */

    get start() {
      return this.loc.start;
    }
    /**
     * For compatibility with SourceLocation in AST plugins
     *
     * @deprecated use withStart instead
     */

    set start(position) {
      this.data.locDidUpdate({
        start: position
      });
    }
    /**
     * For compatibility with SourceLocation in AST plugins
     *
     * @deprecated use endPosition instead
     */

    get end() {
      return this.loc.end;
    }
    /**
     * For compatibility with SourceLocation in AST plugins
     *
     * @deprecated use withEnd instead
     */

    set end(position) {
      this.data.locDidUpdate({
        end: position
      });
    }
    /**
     * For compatibility with SourceLocation in AST plugins
     *
     * @deprecated use module instead
     */

    get source() {
      return this.module;
    }
    collapse(where) {
      switch (where) {
        case 'start':
          return this.getStart().collapsed();
        case 'end':
          return this.getEnd().collapsed();
      }
    }
    extend(other) {
      return span(this.data.getStart(), other.data.getEnd());
    }
    serialize() {
      return this.data.serialize();
    }
    slice(_ref7) {
      var {
        skipStart = 0,
        skipEnd = 0
      } = _ref7;
      return span(this.getStart().move(skipStart).data, this.getEnd().move(-skipEnd).data);
    }
    sliceStartChars(_ref8) {
      var {
        skipStart = 0,
        chars
      } = _ref8;
      return span(this.getStart().move(skipStart).data, this.getStart().move(skipStart + chars).data);
    }
    sliceEndChars(_ref9) {
      var {
        skipEnd = 0,
        chars
      } = _ref9;
      return span(this.getEnd().move(skipEnd - chars).data, this.getStart().move(-skipEnd).data);
    }
  }
  _exports.SourceSpan = SourceSpan;
  class CharPositionSpan {
    constructor(source, charPositions) {
      this.source = source;
      this.charPositions = charPositions;
      this.kind = "CharPosition"
      /* CharPosition */;

      this._locPosSpan = null;
    }
    wrap() {
      return new SourceSpan(this);
    }
    asString() {
      return this.source.slice(this.charPositions.start.charPos, this.charPositions.end.charPos);
    }
    getModule() {
      return this.source.module;
    }
    getStart() {
      return this.charPositions.start;
    }
    getEnd() {
      return this.charPositions.end;
    }
    locDidUpdate() {}
    toHbsSpan() {
      var locPosSpan = this._locPosSpan;
      if (locPosSpan === null) {
        var start = this.charPositions.start.toHbsPos();
        var end = this.charPositions.end.toHbsPos();
        if (start === null || end === null) {
          locPosSpan = this._locPosSpan = BROKEN;
        } else {
          locPosSpan = this._locPosSpan = new HbsSpan(this.source, {
            start,
            end
          });
        }
      }
      return locPosSpan === BROKEN ? null : locPosSpan;
    }
    serialize() {
      var {
        start: {
          charPos: start
        },
        end: {
          charPos: end
        }
      } = this.charPositions;
      if (start === end) {
        return start;
      } else {
        return [start, end];
      }
    }
    toCharPosSpan() {
      return this;
    }
  }
  class HbsSpan {
    constructor(source, hbsPositions, providedHbsLoc) {
      if (providedHbsLoc === void 0) {
        providedHbsLoc = null;
      }
      this.source = source;
      this.hbsPositions = hbsPositions;
      this.kind = "HbsPosition"
      /* HbsPosition */;

      this._charPosSpan = null;
      this._providedHbsLoc = providedHbsLoc;
    }
    serialize() {
      var charPos = this.toCharPosSpan();
      return charPos === null ? "Broken"
      /* Broken */ : charPos.wrap().serialize();
    }
    wrap() {
      return new SourceSpan(this);
    }
    updateProvided(pos, edge) {
      if (this._providedHbsLoc) {
        this._providedHbsLoc[edge] = pos;
      } // invalidate computed character offsets

      this._charPosSpan = null;
      this._providedHbsLoc = {
        start: pos,
        end: pos
      };
    }
    locDidUpdate(_ref10) {
      var {
        start,
        end
      } = _ref10;
      if (start !== undefined) {
        this.updateProvided(start, 'start');
        this.hbsPositions.start = new HbsPosition(this.source, start, null);
      }
      if (end !== undefined) {
        this.updateProvided(end, 'end');
        this.hbsPositions.end = new HbsPosition(this.source, end, null);
      }
    }
    asString() {
      var span = this.toCharPosSpan();
      return span === null ? '' : span.asString();
    }
    getModule() {
      return this.source.module;
    }
    getStart() {
      return this.hbsPositions.start;
    }
    getEnd() {
      return this.hbsPositions.end;
    }
    toHbsLoc() {
      return {
        start: this.hbsPositions.start.hbsPos,
        end: this.hbsPositions.end.hbsPos
      };
    }
    toHbsSpan() {
      return this;
    }
    toCharPosSpan() {
      var charPosSpan = this._charPosSpan;
      if (charPosSpan === null) {
        var start = this.hbsPositions.start.toCharPos();
        var end = this.hbsPositions.end.toCharPos();
        if (start && end) {
          charPosSpan = this._charPosSpan = new CharPositionSpan(this.source, {
            start,
            end
          });
        } else {
          charPosSpan = this._charPosSpan = BROKEN;
          return null;
        }
      }
      return charPosSpan === BROKEN ? null : charPosSpan;
    }
  }
  class InvisibleSpan {
    constructor(kind,
    // whatever was provided, possibly broken
    loc,
    // if the span represents a synthetic string
    string) {
      if (string === void 0) {
        string = null;
      }
      this.kind = kind;
      this.loc = loc;
      this.string = string;
    }
    serialize() {
      switch (this.kind) {
        case "Broken"
        /* Broken */:

        case "NonExistent"
        /* NonExistent */:
          return this.kind;
        case "InternalsSynthetic"
        /* InternalsSynthetic */:
          return this.string || '';
      }
    }
    wrap() {
      return new SourceSpan(this);
    }
    asString() {
      return this.string || '';
    }
    locDidUpdate(_ref11) {
      var {
        start,
        end
      } = _ref11;
      if (start !== undefined) {
        this.loc.start = start;
      }
      if (end !== undefined) {
        this.loc.end = end;
      }
    }
    getModule() {
      // TODO: Make this reflect the actual module this span originated from
      return 'an unknown module';
    }
    getStart() {
      return new InvisiblePosition(this.kind, this.loc.start);
    }
    getEnd() {
      return new InvisiblePosition(this.kind, this.loc.end);
    }
    toCharPosSpan() {
      return this;
    }
    toHbsSpan() {
      return null;
    }
    toHbsLoc() {
      return BROKEN_LOCATION;
    }
  }
  var span = match(m => m.when("HbsPosition"
  /* HbsPosition */, "HbsPosition"
  /* HbsPosition */, (left, right) => new HbsSpan(left.source, {
    start: left,
    end: right
  }).wrap()).when("CharPosition"
  /* CharPosition */, "CharPosition"
  /* CharPosition */, (left, right) => new CharPositionSpan(left.source, {
    start: left,
    end: right
  }).wrap()).when("CharPosition"
  /* CharPosition */, "HbsPosition"
  /* HbsPosition */, (left, right) => {
    var rightCharPos = right.toCharPos();
    if (rightCharPos === null) {
      return new InvisibleSpan("Broken"
      /* Broken */, BROKEN_LOCATION).wrap();
    } else {
      return span(left, rightCharPos);
    }
  }).when("HbsPosition"
  /* HbsPosition */, "CharPosition"
  /* CharPosition */, (left, right) => {
    var leftCharPos = left.toCharPos();
    if (leftCharPos === null) {
      return new InvisibleSpan("Broken"
      /* Broken */, BROKEN_LOCATION).wrap();
    } else {
      return span(leftCharPos, right);
    }
  }).when(IsInvisible, MatchAny, left => new InvisibleSpan(left.kind, BROKEN_LOCATION).wrap()).when(MatchAny, IsInvisible, (_, right) => new InvisibleSpan(right.kind, BROKEN_LOCATION).wrap()));

  // eslint-disable-next-line import/no-extraneous-dependencies
  class Source {
    constructor(source, module) {
      if (module === void 0) {
        module = 'an unknown module';
      }
      this.source = source;
      this.module = module;
    }
    /**
     * Validate that the character offset represents a position in the source string.
     */

    check(offset) {
      return offset >= 0 && offset <= this.source.length;
    }
    slice(start, end) {
      return this.source.slice(start, end);
    }
    offsetFor(line, column) {
      return SourceOffset.forHbsPos(this, {
        line,
        column
      });
    }
    spanFor(_ref12) {
      var {
        start,
        end
      } = _ref12;
      return SourceSpan.forHbsLoc(this, {
        start: {
          line: start.line,
          column: start.column
        },
        end: {
          line: end.line,
          column: end.column
        }
      });
    }
    hbsPosFor(offset) {
      var seenLines = 0;
      var seenChars = 0;
      if (offset > this.source.length) {
        return null;
      }
      while (true) {
        var nextLine = this.source.indexOf('\n', seenChars);
        if (offset <= nextLine || nextLine === -1) {
          return {
            line: seenLines + 1,
            column: offset - seenChars
          };
        } else {
          seenLines += 1;
          seenChars = nextLine + 1;
        }
      }
    }
    charPosFor(position) {
      var {
        line,
        column
      } = position;
      var sourceString = this.source;
      var sourceLength = sourceString.length;
      var seenLines = 0;
      var seenChars = 0;
      while (true) {
        if (seenChars >= sourceLength) return sourceLength;
        var nextLine = this.source.indexOf('\n', seenChars);
        if (nextLine === -1) nextLine = this.source.length;
        if (seenLines === line - 1) {
          if (seenChars + column > nextLine) return nextLine;
          if (true /* DEBUG */) {
            var roundTrip = this.hbsPosFor(seenChars + column);
          }
          return seenChars + column;
        } else if (nextLine === -1) {
          return 0;
        } else {
          seenLines += 1;
          seenChars = nextLine + 1;
        }
      }
    }
  }
  _exports.Source = Source;
  class PathExpressionImplV1 {
    constructor(original, head, tail, loc) {
      this.original = original;
      this.loc = loc;
      this.type = 'PathExpression';
      this.this = false;
      this.data = false; // Cache for the head value.

      this._head = undefined;
      var parts = tail.slice();
      if (head.type === 'ThisHead') {
        this.this = true;
      } else if (head.type === 'AtHead') {
        this.data = true;
        parts.unshift(head.name.slice(1));
      } else {
        parts.unshift(head.name);
      }
      this.parts = parts;
    }
    get head() {
      if (this._head) {
        return this._head;
      }
      var firstPart;
      if (this.this) {
        firstPart = 'this';
      } else if (this.data) {
        firstPart = "@" + this.parts[0];
      } else {
        firstPart = this.parts[0];
      }
      var firstPartLoc = this.loc.collapse('start').sliceStartChars({
        chars: firstPart.length
      }).loc;
      return this._head = publicBuilder.head(firstPart, firstPartLoc);
    }
    get tail() {
      return this.this ? this.parts : this.parts.slice(1);
    }
  }
  var _SOURCE;
  function SOURCE() {
    if (!_SOURCE) {
      _SOURCE = new Source('', '(synthetic)');
    }
    return _SOURCE;
  }
  function buildMustache(path, params, hash, raw, loc, strip) {
    if (typeof path === 'string') {
      path = buildPath(path);
    }
    return {
      type: 'MustacheStatement',
      path,
      params: params || [],
      hash: hash || buildHash([]),
      escaped: !raw,
      trusting: !!raw,
      loc: buildLoc(loc || null),
      strip: strip || {
        open: false,
        close: false
      }
    };
  }
  function buildBlock(path, params, hash, _defaultBlock, _elseBlock, loc, openStrip, inverseStrip, closeStrip) {
    var defaultBlock;
    var elseBlock;
    if (_defaultBlock.type === 'Template') {
      defaultBlock = (0, _util.assign)({}, _defaultBlock, {
        type: 'Block'
      });
    } else {
      defaultBlock = _defaultBlock;
    }
    if (_elseBlock !== undefined && _elseBlock !== null && _elseBlock.type === 'Template') {
      elseBlock = (0, _util.assign)({}, _elseBlock, {
        type: 'Block'
      });
    } else {
      elseBlock = _elseBlock;
    }
    return {
      type: 'BlockStatement',
      path: buildPath(path),
      params: params || [],
      hash: hash || buildHash([]),
      program: defaultBlock || null,
      inverse: elseBlock || null,
      loc: buildLoc(loc || null),
      openStrip: openStrip || {
        open: false,
        close: false
      },
      inverseStrip: inverseStrip || {
        open: false,
        close: false
      },
      closeStrip: closeStrip || {
        open: false,
        close: false
      }
    };
  }
  function buildElementModifier(path, params, hash, loc) {
    return {
      type: 'ElementModifierStatement',
      path: buildPath(path),
      params: params || [],
      hash: hash || buildHash([]),
      loc: buildLoc(loc || null)
    };
  }
  function buildPartial(name, params, hash, indent, loc) {
    return {
      type: 'PartialStatement',
      name: name,
      params: params || [],
      hash: hash || buildHash([]),
      indent: indent || '',
      strip: {
        open: false,
        close: false
      },
      loc: buildLoc(loc || null)
    };
  }
  function buildComment(value, loc) {
    return {
      type: 'CommentStatement',
      value: value,
      loc: buildLoc(loc || null)
    };
  }
  function buildMustacheComment(value, loc) {
    return {
      type: 'MustacheCommentStatement',
      value: value,
      loc: buildLoc(loc || null)
    };
  }
  function buildConcat(parts, loc) {
    if (!(0, _util.isPresent)(parts)) {
      throw new Error("b.concat requires at least one part");
    }
    return {
      type: 'ConcatStatement',
      parts: parts || [],
      loc: buildLoc(loc || null)
    };
  }
  function buildElement(tag, options) {
    if (options === void 0) {
      options = {};
    }
    var {
      attrs,
      blockParams,
      modifiers,
      comments,
      children,
      loc
    } = options;
    var tagName; // this is used for backwards compat, prior to `selfClosing` being part of the ElementNode AST

    var selfClosing = false;
    if (typeof tag === 'object') {
      selfClosing = tag.selfClosing;
      tagName = tag.name;
    } else if (tag.slice(-1) === '/') {
      tagName = tag.slice(0, -1);
      selfClosing = true;
    } else {
      tagName = tag;
    }
    return {
      type: 'ElementNode',
      tag: tagName,
      selfClosing: selfClosing,
      attributes: attrs || [],
      blockParams: blockParams || [],
      modifiers: modifiers || [],
      comments: comments || [],
      children: children || [],
      loc: buildLoc(loc || null)
    };
  }
  function buildAttr(name, value, loc) {
    return {
      type: 'AttrNode',
      name: name,
      value: value,
      loc: buildLoc(loc || null)
    };
  }
  function buildText(chars, loc) {
    return {
      type: 'TextNode',
      chars: chars || '',
      loc: buildLoc(loc || null)
    };
  } // Expressions

  function buildSexpr(path, params, hash, loc) {
    return {
      type: 'SubExpression',
      path: buildPath(path),
      params: params || [],
      hash: hash || buildHash([]),
      loc: buildLoc(loc || null)
    };
  }
  function headToString(head) {
    switch (head.type) {
      case 'AtHead':
        return {
          original: head.name,
          parts: [head.name]
        };
      case 'ThisHead':
        return {
          original: "this",
          parts: []
        };
      case 'VarHead':
        return {
          original: head.name,
          parts: [head.name]
        };
    }
  }
  function buildHead(original, loc) {
    var [head, ...tail] = original.split('.');
    var headNode;
    if (head === 'this') {
      headNode = {
        type: 'ThisHead',
        loc: buildLoc(loc || null)
      };
    } else if (head[0] === '@') {
      headNode = {
        type: 'AtHead',
        name: head,
        loc: buildLoc(loc || null)
      };
    } else {
      headNode = {
        type: 'VarHead',
        name: head,
        loc: buildLoc(loc || null)
      };
    }
    return {
      head: headNode,
      tail
    };
  }
  function buildThis(loc) {
    return {
      type: 'ThisHead',
      loc: buildLoc(loc || null)
    };
  }
  function buildAtName(name, loc) {
    return {
      type: 'AtHead',
      name,
      loc: buildLoc(loc || null)
    };
  }
  function buildVar(name, loc) {
    return {
      type: 'VarHead',
      name,
      loc: buildLoc(loc || null)
    };
  }
  function buildHeadFromString(head, loc) {
    if (head[0] === '@') {
      return buildAtName(head, loc);
    } else if (head === 'this') {
      return buildThis(loc);
    } else {
      return buildVar(head, loc);
    }
  }
  function buildNamedBlockName(name, loc) {
    return {
      type: 'NamedBlockName',
      name,
      loc: buildLoc(loc || null)
    };
  }
  function buildCleanPath(head, tail, loc) {
    var {
      original: originalHead,
      parts: headParts
    } = headToString(head);
    var parts = [...headParts, ...tail];
    var original = [...originalHead, ...parts].join('.');
    return new PathExpressionImplV1(original, head, tail, buildLoc(loc || null));
  }
  function buildPath(path, loc) {
    if (typeof path !== 'string') {
      if ('type' in path) {
        return path;
      } else {
        var {
          head: _head,
          tail: _tail
        } = buildHead(path.head, SourceSpan.broken());
        var {
          original: originalHead
        } = headToString(_head);
        return new PathExpressionImplV1([originalHead, ..._tail].join('.'), _head, _tail, buildLoc(loc || null));
      }
    }
    var {
      head,
      tail
    } = buildHead(path, SourceSpan.broken());
    return new PathExpressionImplV1(path, head, tail, buildLoc(loc || null));
  }
  function buildLiteral(type, value, loc) {
    return {
      type,
      value,
      original: value,
      loc: buildLoc(loc || null)
    };
  } // Miscellaneous

  function buildHash(pairs, loc) {
    return {
      type: 'Hash',
      pairs: pairs || [],
      loc: buildLoc(loc || null)
    };
  }
  function buildPair(key, value, loc) {
    return {
      type: 'HashPair',
      key: key,
      value,
      loc: buildLoc(loc || null)
    };
  }
  function buildProgram(body, blockParams, loc) {
    return {
      type: 'Template',
      body: body || [],
      blockParams: blockParams || [],
      loc: buildLoc(loc || null)
    };
  }
  function buildBlockItself(body, blockParams, chained, loc) {
    if (chained === void 0) {
      chained = false;
    }
    return {
      type: 'Block',
      body: body || [],
      blockParams: blockParams || [],
      chained,
      loc: buildLoc(loc || null)
    };
  }
  function buildTemplate(body, blockParams, loc) {
    return {
      type: 'Template',
      body: body || [],
      blockParams: blockParams || [],
      loc: buildLoc(loc || null)
    };
  }
  function buildPosition(line, column) {
    return {
      line,
      column
    };
  }
  function buildLoc() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    if (args.length === 1) {
      var _loc = args[0];
      if (_loc && typeof _loc === 'object') {
        return SourceSpan.forHbsLoc(SOURCE(), _loc);
      } else {
        return SourceSpan.forHbsLoc(SOURCE(), SYNTHETIC_LOCATION);
      }
    } else {
      var [startLine, startColumn, endLine, endColumn, _source] = args;
      var source = _source ? new Source('', _source) : SOURCE();
      return SourceSpan.forHbsLoc(source, {
        start: {
          line: startLine,
          column: startColumn
        },
        end: {
          line: endLine,
          column: endColumn
        }
      });
    }
  }
  var publicBuilder = {
    mustache: buildMustache,
    block: buildBlock,
    partial: buildPartial,
    comment: buildComment,
    mustacheComment: buildMustacheComment,
    element: buildElement,
    elementModifier: buildElementModifier,
    attr: buildAttr,
    text: buildText,
    sexpr: buildSexpr,
    concat: buildConcat,
    hash: buildHash,
    pair: buildPair,
    literal: buildLiteral,
    program: buildProgram,
    blockItself: buildBlockItself,
    template: buildTemplate,
    loc: buildLoc,
    pos: buildPosition,
    path: buildPath,
    fullPath: buildCleanPath,
    head: buildHeadFromString,
    at: buildAtName,
    var: buildVar,
    this: buildThis,
    blockName: buildNamedBlockName,
    string: literal('StringLiteral'),
    boolean: literal('BooleanLiteral'),
    number: literal('NumberLiteral'),
    undefined() {
      return buildLiteral('UndefinedLiteral', undefined);
    },
    null() {
      return buildLiteral('NullLiteral', null);
    }
  };
  _exports.builders = publicBuilder;
  function literal(type) {
    return function (value, loc) {
      return buildLiteral(type, value, loc);
    };
  }
  var api = /*#__PURE__*/Object.freeze({
    __proto__: null
  });

  /**
   * A free variable is resolved according to a resolution rule:
   *
   * 1. Strict resolution
   * 2. Namespaced resolution
   * 3. Fallback resolution
   */

  /**
   * Strict resolution is used:
   *
   * 1. in a strict mode template
   * 2. in an unambiguous invocation with dot paths
   */
  _exports.ASTv1 = _exports.AST = api;
  class StrictResolution {
    constructor() {
      this.isAngleBracket = false;
    }
    resolution() {
      return 31
      /* GetStrictFree */;
    }

    serialize() {
      return 'Strict';
    }
  }
  var STRICT_RESOLUTION = new StrictResolution();
  /**
   * A `LooseModeResolution` includes:
   *
   * - 0 or more namespaces to resolve the variable in
   * - optional fallback behavior
   *
   * In practice, there are a limited number of possible combinations of these degrees of freedom,
   * and they are captured by the `Ambiguity` union below.
   */

  class LooseModeResolution {
    constructor(ambiguity, isAngleBracket) {
      if (isAngleBracket === void 0) {
        isAngleBracket = false;
      }
      this.ambiguity = ambiguity;
      this.isAngleBracket = isAngleBracket;
    }
    /**
     * Namespaced resolution is used in an unambiguous syntax position:
     *
     * 1. `(sexp)` (namespace: `Helper`)
     * 2. `{{#block}}` (namespace: `Component`)
     * 3. `<a {{modifier}}>` (namespace: `Modifier`)
     * 4. `<Component />` (namespace: `Component`)
     *
     * @see {NamespacedAmbiguity}
     */

    static namespaced(namespace, isAngleBracket) {
      if (isAngleBracket === void 0) {
        isAngleBracket = false;
      }
      return new LooseModeResolution({
        namespaces: [namespace],
        fallback: false
      }, isAngleBracket);
    }
    /**
     * Fallback resolution is used when no namespaced resolutions are possible, but fallback
     * resolution is still allowed.
     *
     * ```hbs
     * {{x.y}}
     * ```
     *
     * @see {FallbackAmbiguity}
     */

    static fallback() {
      return new LooseModeResolution({
        namespaces: [],
        fallback: true
      });
    }
    /**
     * Append resolution is used when the variable should be resolved in both the `component` and
     * `helper` namespaces. Fallback resolution is optional.
     *
     * ```hbs
     * {{x}}
     * ```
     *
     * ^ `x` should be resolved in the `component` and `helper` namespaces with fallback resolution.
     *
     * ```hbs
     * {{x y}}
     * ```
     *
     * ^ `x` should be resolved in the `component` and `helper` namespaces without fallback
     * resolution.
     *
     * @see {ComponentOrHelperAmbiguity}
     */

    static append(_ref13) {
      var {
        invoke
      } = _ref13;
      return new LooseModeResolution({
        namespaces: ["Component"
        /* Component */, "Helper"
        /* Helper */],

        fallback: !invoke
      });
    }
    /**
     * Trusting append resolution is used when the variable should be resolved in both the `component` and
     * `helper` namespaces. Fallback resolution is optional.
     *
     * ```hbs
     * {{{x}}}
     * ```
     *
     * ^ `x` should be resolved in the `component` and `helper` namespaces with fallback resolution.
     *
     * ```hbs
     * {{{x y}}}
     * ```
     *
     * ^ `x` should be resolved in the `component` and `helper` namespaces without fallback
     * resolution.
     *
     * @see {HelperAmbiguity}
     */

    static trustingAppend(_ref14) {
      var {
        invoke
      } = _ref14;
      return new LooseModeResolution({
        namespaces: ["Helper"
        /* Helper */],

        fallback: !invoke
      });
    }
    /**
     * Attribute resolution is used when the variable should be resolved as a `helper` with fallback
     * resolution.
     *
     * ```hbs
     * <a href={{x}} />
     * <a href="{{x}}.html" />
     * ```
     *
     * ^ resolved in the `helper` namespace with fallback
     *
     * @see {HelperAmbiguity}
     */

    static attr() {
      return new LooseModeResolution({
        namespaces: ["Helper"
        /* Helper */],

        fallback: true
      });
    }
    resolution() {
      if (this.ambiguity.namespaces.length === 0) {
        return 31
        /* GetStrictFree */;
      } else if (this.ambiguity.namespaces.length === 1) {
        if (this.ambiguity.fallback) {
          // simple namespaced resolution with fallback must be attr={{x}}
          return 36
          /* GetFreeAsHelperHeadOrThisFallback */;
        } else {
          // simple namespaced resolution without fallback
          switch (this.ambiguity.namespaces[0]) {
            case "Helper"
            /* Helper */:
              return 37
              /* GetFreeAsHelperHead */;

            case "Modifier"
            /* Modifier */:
              return 38
              /* GetFreeAsModifierHead */;

            case "Component"
            /* Component */:
              return 39
              /* GetFreeAsComponentHead */;
          }
        }
      } else if (this.ambiguity.fallback) {
        // component or helper + fallback ({{something}})
        return 34
        /* GetFreeAsComponentOrHelperHeadOrThisFallback */;
      } else {
        // component or helper without fallback ({{something something}})
        return 35
        /* GetFreeAsComponentOrHelperHead */;
      }
    }

    serialize() {
      if (this.ambiguity.namespaces.length === 0) {
        return 'Loose';
      } else if (this.ambiguity.namespaces.length === 1) {
        if (this.ambiguity.fallback) {
          // simple namespaced resolution with fallback must be attr={{x}}
          return ['ambiguous', "Attr"
          /* Attr */];
        } else {
          return ['ns', this.ambiguity.namespaces[0]];
        }
      } else if (this.ambiguity.fallback) {
        // component or helper + fallback ({{something}})
        return ['ambiguous', "Append"
        /* Append */];
      } else {
        // component or helper without fallback ({{something something}})
        return ['ambiguous', "Invoke"
        /* Invoke */];
      }
    }
  }

  var ARGUMENT_RESOLUTION = LooseModeResolution.fallback();
  function loadResolution(resolution) {
    if (typeof resolution === 'string') {
      switch (resolution) {
        case 'Loose':
          return LooseModeResolution.fallback();
        case 'Strict':
          return STRICT_RESOLUTION;
      }
    }
    switch (resolution[0]) {
      case 'ambiguous':
        switch (resolution[1]) {
          case "Append"
          /* Append */:
            return LooseModeResolution.append({
              invoke: false
            });
          case "Attr"
          /* Attr */:
            return LooseModeResolution.attr();
          case "Invoke"
          /* Invoke */:
            return LooseModeResolution.append({
              invoke: true
            });
        }
      case 'ns':
        return LooseModeResolution.namespaced(resolution[1]);
    }
  }
  function node(name) {
    if (name !== undefined) {
      var type = name;
      return {
        fields() {
          return class {
            constructor(fields) {
              this.type = type;
              (0, _util.assign)(this, fields);
            }
          };
        }
      };
    } else {
      return {
        fields() {
          return class {
            constructor(fields) {
              (0, _util.assign)(this, fields);
            }
          };
        }
      };
    }
  }

  /**
   * Corresponds to syntaxes with positional and named arguments:
   *
   * - SubExpression
   * - Invoking Append
   * - Invoking attributes
   * - InvokeBlock
   *
   * If `Args` is empty, the `SourceOffsets` for this node should be the collapsed position
   * immediately after the parent call node's `callee`.
   */

  class Args extends node().fields() {
    static empty(loc) {
      return new Args({
        loc,
        positional: PositionalArguments.empty(loc),
        named: NamedArguments.empty(loc)
      });
    }
    static named(named) {
      return new Args({
        loc: named.loc,
        positional: PositionalArguments.empty(named.loc.collapse('end')),
        named
      });
    }
    nth(offset) {
      return this.positional.nth(offset);
    }
    get(name) {
      return this.named.get(name);
    }
    isEmpty() {
      return this.positional.isEmpty() && this.named.isEmpty();
    }
  }
  /**
   * Corresponds to positional arguments.
   *
   * If `PositionalArguments` is empty, the `SourceOffsets` for this node should be the collapsed
   * position immediately after the parent call node's `callee`.
   */

  class PositionalArguments extends node().fields() {
    static empty(loc) {
      return new PositionalArguments({
        loc,
        exprs: []
      });
    }
    get size() {
      return this.exprs.length;
    }
    nth(offset) {
      return this.exprs[offset] || null;
    }
    isEmpty() {
      return this.exprs.length === 0;
    }
  }
  /**
   * Corresponds to named arguments.
   *
   * If `PositionalArguments` and `NamedArguments` are empty, the `SourceOffsets` for this node should
   * be the same as the `Args` node that contains this node.
   *
   * If `PositionalArguments` is not empty but `NamedArguments` is empty, the `SourceOffsets` for this
   * node should be the collapsed position immediately after the last positional argument.
   */

  class NamedArguments extends node().fields() {
    static empty(loc) {
      return new NamedArguments({
        loc,
        entries: []
      });
    }
    get size() {
      return this.entries.length;
    }
    get(name) {
      var entry = this.entries.filter(e => e.name.chars === name)[0];
      return entry ? entry.value : null;
    }
    isEmpty() {
      return this.entries.length === 0;
    }
  }
  /**
   * Corresponds to a single named argument.
   *
   * ```hbs
   * x=<expr>
   * ```
   */

  class NamedArgument {
    constructor(options) {
      this.loc = options.name.loc.extend(options.value.loc);
      this.name = options.name;
      this.value = options.value;
    }
  }

  /**
   * `HtmlAttr` nodes are valid HTML attributes, with or without a value.
   *
   * Exceptions:
   *
   * - `...attributes` is `SplatAttr`
   * - `@x=<value>` is `ComponentArg`
   */

  class HtmlAttr extends node('HtmlAttr').fields() {}
  class SplatAttr extends node('SplatAttr').fields() {}
  /**
   * Corresponds to an argument passed by a component (`@x=<value>`)
   */

  class ComponentArg extends node().fields() {
    /**
     * Convert the component argument into a named argument node
     */
    toNamedArgument() {
      return new NamedArgument({
        name: this.name,
        value: this.value
      });
    }
  }
  /**
   * An `ElementModifier` is just a normal call node in modifier position.
   */

  class ElementModifier extends node('ElementModifier').fields() {}
  class SpanList {
    constructor(span) {
      if (span === void 0) {
        span = [];
      }
      this._span = span;
    }
    static range(span, fallback) {
      if (fallback === void 0) {
        fallback = SourceSpan.NON_EXISTENT;
      }
      return new SpanList(span.map(loc)).getRangeOffset(fallback);
    }
    add(offset) {
      this._span.push(offset);
    }
    getRangeOffset(fallback) {
      if (this._span.length === 0) {
        return fallback;
      } else {
        var first = this._span[0];
        var last = this._span[this._span.length - 1];
        return first.extend(last);
      }
    }
  }
  _exports.SpanList = SpanList;
  function loc(span) {
    if (Array.isArray(span)) {
      var first = span[0];
      var last = span[span.length - 1];
      return loc(first).extend(loc(last));
    } else if (span instanceof SourceSpan) {
      return span;
    } else {
      return span.loc;
    }
  }
  function hasSpan(span) {
    if (Array.isArray(span) && span.length === 0) {
      return false;
    }
    return true;
  }
  function maybeLoc(location, fallback) {
    if (hasSpan(location)) {
      return loc(location);
    } else {
      return fallback;
    }
  }
  class GlimmerComment extends node('GlimmerComment').fields() {}
  class HtmlText extends node('HtmlText').fields() {}
  class HtmlComment extends node('HtmlComment').fields() {}
  class AppendContent extends node('AppendContent').fields() {
    get callee() {
      if (this.value.type === 'Call') {
        return this.value.callee;
      } else {
        return this.value;
      }
    }
    get args() {
      if (this.value.type === 'Call') {
        return this.value.args;
      } else {
        return Args.empty(this.value.loc.collapse('end'));
      }
    }
  }
  class InvokeBlock extends node('InvokeBlock').fields() {}
  /**
   * Corresponds to a component invocation. When the content of a component invocation contains no
   * named blocks, `blocks` contains a single named block named `"default"`. When a component
   * invocation is self-closing, `blocks` is empty.
   */

  class InvokeComponent extends node('InvokeComponent').fields() {
    get args() {
      var entries = this.componentArgs.map(a => a.toNamedArgument());
      return Args.named(new NamedArguments({
        loc: SpanList.range(entries, this.callee.loc.collapse('end')),
        entries
      }));
    }
  }
  /**
   * Corresponds to a simple HTML element. The AST allows component arguments and modifiers to support
   * future extensions.
   */

  class SimpleElement extends node('SimpleElement').fields() {
    get args() {
      var entries = this.componentArgs.map(a => a.toNamedArgument());
      return Args.named(new NamedArguments({
        loc: SpanList.range(entries, this.tag.loc.collapse('end')),
        entries
      }));
    }
  }

  /**
   * Corresponds to a Handlebars literal.
   *
   * @see {LiteralValue}
   */

  class LiteralExpression extends node('Literal').fields() {
    toSlice() {
      return new SourceSlice({
        loc: this.loc,
        chars: this.value
      });
    }
  }
  /**
   * Returns true if an input {@see ExpressionNode} is a literal.
   */

  function isLiteral(node, kind) {
    if (node.type === 'Literal') {
      if (kind === undefined) {
        return true;
      } else if (kind === 'null') {
        return node.value === null;
      } else {
        return typeof node.value === kind;
      }
    } else {
      return false;
    }
  }
  /**
   * Corresponds to a path in expression position.
   *
   * ```hbs
   * this
   * this.x
   * @x
   * @x.y
   * x
   * x.y
   * ```
   */

  class PathExpression extends node('Path').fields() {}
  /**
   * Corresponds to a parenthesized call expression.
   *
   * ```hbs
   * (x)
   * (x.y)
   * (x y)
   * (x.y z)
   * ```
   */

  class CallExpression extends node('Call').fields() {}
  /**
   * Corresponds to a possible deprecated helper call. Must be:
   *
   * 1. A free variable (not this.foo, not @foo, not local).
   * 2. Argument-less.
   * 3. In a component invocation's named argument position.
   * 4. Not parenthesized (not @bar={{(helper)}}).
   * 5. Not interpolated (not @bar="{{helper}}").
   *
   * ```hbs
   * <Foo @bar={{helper}} />
   * ```
   */

  class DeprecatedCallExpression extends node('DeprecatedCall').fields() {}
  /**
   * Corresponds to an interpolation in attribute value position.
   *
   * ```hbs
   * <a href="{{url}}.html"
   * ```
   */

  class InterpolateExpression extends node('Interpolate').fields() {}

  /**
   * Corresponds to `this` at the head of an expression.
   */

  class ThisReference extends node('This').fields() {}
  /**
   * Corresponds to `@<ident>` at the beginning of an expression.
   */

  class ArgReference extends node('Arg').fields() {}
  /**
   * Corresponds to `<ident>` at the beginning of an expression, when `<ident>` is in the current
   * block's scope.
   */

  class LocalVarReference extends node('Local').fields() {}
  /**
   * Corresponds to `<ident>` at the beginning of an expression, when `<ident>` is *not* in the
   * current block's scope.
   *
   * The `resolution: FreeVarResolution` field describes how to resolve the free variable.
   *
   * Note: In strict mode, it must always be a variable that is in a concrete JavaScript scope that
   * the template will be installed into.
   */

  class FreeVarReference extends node('Free').fields() {}

  /**
   * Corresponds to an entire template.
   */

  class Template extends node().fields() {}
  /**
   * Represents a block. In principle this could be merged with `NamedBlock`, because all cases
   * involving blocks have at least a notional name.
   */

  class Block extends node().fields() {}
  /**
   * Corresponds to a collection of named blocks.
   */

  class NamedBlocks extends node().fields() {
    get(name) {
      return this.blocks.filter(block => block.name.chars === name)[0] || null;
    }
  }
  /**
   * Corresponds to a single named block. This is used for anonymous named blocks (`default` and
   * `else`).
   */

  class NamedBlock extends node().fields() {
    get args() {
      var entries = this.componentArgs.map(a => a.toNamedArgument());
      return Args.named(new NamedArguments({
        loc: SpanList.range(entries, this.name.loc.collapse('end')),
        entries
      }));
    }
  }
  var api$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    StrictResolution: StrictResolution,
    STRICT_RESOLUTION: STRICT_RESOLUTION,
    LooseModeResolution: LooseModeResolution,
    ARGUMENT_RESOLUTION: ARGUMENT_RESOLUTION,
    loadResolution: loadResolution,
    node: node,
    Args: Args,
    PositionalArguments: PositionalArguments,
    NamedArguments: NamedArguments,
    NamedArgument: NamedArgument,
    HtmlAttr: HtmlAttr,
    SplatAttr: SplatAttr,
    ComponentArg: ComponentArg,
    ElementModifier: ElementModifier,
    GlimmerComment: GlimmerComment,
    HtmlText: HtmlText,
    HtmlComment: HtmlComment,
    AppendContent: AppendContent,
    InvokeBlock: InvokeBlock,
    InvokeComponent: InvokeComponent,
    SimpleElement: SimpleElement,
    LiteralExpression: LiteralExpression,
    isLiteral: isLiteral,
    PathExpression: PathExpression,
    CallExpression: CallExpression,
    DeprecatedCallExpression: DeprecatedCallExpression,
    InterpolateExpression: InterpolateExpression,
    ThisReference: ThisReference,
    ArgReference: ArgReference,
    LocalVarReference: LocalVarReference,
    FreeVarReference: FreeVarReference,
    Template: Template,
    Block: Block,
    NamedBlocks: NamedBlocks,
    NamedBlock: NamedBlock
  });
  _exports.ASTv2 = api$1;
  var ATTR_VALUE_REGEX_TEST = /[\xA0"&]/;
  var ATTR_VALUE_REGEX_REPLACE = new RegExp(ATTR_VALUE_REGEX_TEST.source, 'g');
  var TEXT_REGEX_TEST = /[\xA0&<>]/;
  var TEXT_REGEX_REPLACE = new RegExp(TEXT_REGEX_TEST.source, 'g');
  function attrValueReplacer(char) {
    switch (char.charCodeAt(0)) {
      case 160
      /* NBSP */:
        return '&nbsp;';
      case 34
      /* QUOT */:
        return '&quot;';
      case 38
      /* AMP */:
        return '&amp;';
      default:
        return char;
    }
  }
  function textReplacer(char) {
    switch (char.charCodeAt(0)) {
      case 160
      /* NBSP */:
        return '&nbsp;';
      case 38
      /* AMP */:
        return '&amp;';
      case 60
      /* LT */:
        return '&lt;';
      case 62
      /* GT */:
        return '&gt;';
      default:
        return char;
    }
  }
  function escapeAttrValue(attrValue) {
    if (ATTR_VALUE_REGEX_TEST.test(attrValue)) {
      return attrValue.replace(ATTR_VALUE_REGEX_REPLACE, attrValueReplacer);
    }
    return attrValue;
  }
  function escapeText(text) {
    if (TEXT_REGEX_TEST.test(text)) {
      return text.replace(TEXT_REGEX_REPLACE, textReplacer);
    }
    return text;
  }
  function sortByLoc(a, b) {
    // If either is invisible, don't try to order them
    if (a.loc.isInvisible || b.loc.isInvisible) {
      return 0;
    }
    if (a.loc.startPosition.line < b.loc.startPosition.line) {
      return -1;
    }
    if (a.loc.startPosition.line === b.loc.startPosition.line && a.loc.startPosition.column < b.loc.startPosition.column) {
      return -1;
    }
    if (a.loc.startPosition.line === b.loc.startPosition.line && a.loc.startPosition.column === b.loc.startPosition.column) {
      return 0;
    }
    return 1;
  }
  var voidMap = Object.create(null);
  var voidTagNames = 'area base br col command embed hr img input keygen link meta param source track wbr';
  voidTagNames.split(' ').forEach(tagName => {
    voidMap[tagName] = true;
  });
  var NON_WHITESPACE = /\S/;
  class Printer {
    constructor(options) {
      this.buffer = '';
      this.options = options;
    }
    /*
      This is used by _all_ methods on this Printer class that add to `this.buffer`,
      it allows consumers of the printer to use alternate string representations for
      a given node.
         The primary use case for this are things like source -> source codemod utilities.
      For example, ember-template-recast attempts to always preserve the original string
      formatting in each AST node if no modifications are made to it.
    */

    handledByOverride(node, ensureLeadingWhitespace) {
      if (ensureLeadingWhitespace === void 0) {
        ensureLeadingWhitespace = false;
      }
      if (this.options.override !== undefined) {
        var result = this.options.override(node, this.options);
        if (typeof result === 'string') {
          if (ensureLeadingWhitespace && result !== '' && NON_WHITESPACE.test(result[0])) {
            result = " " + result;
          }
          this.buffer += result;
          return true;
        }
      }
      return false;
    }
    Node(node) {
      switch (node.type) {
        case 'MustacheStatement':
        case 'BlockStatement':
        case 'PartialStatement':
        case 'MustacheCommentStatement':
        case 'CommentStatement':
        case 'TextNode':
        case 'ElementNode':
        case 'AttrNode':
        case 'Block':
        case 'Template':
          return this.TopLevelStatement(node);
        case 'StringLiteral':
        case 'BooleanLiteral':
        case 'NumberLiteral':
        case 'UndefinedLiteral':
        case 'NullLiteral':
        case 'PathExpression':
        case 'SubExpression':
          return this.Expression(node);
        case 'Program':
          return this.Block(node);
        case 'ConcatStatement':
          // should have an AttrNode parent
          return this.ConcatStatement(node);
        case 'Hash':
          return this.Hash(node);
        case 'HashPair':
          return this.HashPair(node);
        case 'ElementModifierStatement':
          return this.ElementModifierStatement(node);
      }
    }
    Expression(expression) {
      switch (expression.type) {
        case 'StringLiteral':
        case 'BooleanLiteral':
        case 'NumberLiteral':
        case 'UndefinedLiteral':
        case 'NullLiteral':
          return this.Literal(expression);
        case 'PathExpression':
          return this.PathExpression(expression);
        case 'SubExpression':
          return this.SubExpression(expression);
      }
    }
    Literal(literal) {
      switch (literal.type) {
        case 'StringLiteral':
          return this.StringLiteral(literal);
        case 'BooleanLiteral':
          return this.BooleanLiteral(literal);
        case 'NumberLiteral':
          return this.NumberLiteral(literal);
        case 'UndefinedLiteral':
          return this.UndefinedLiteral(literal);
        case 'NullLiteral':
          return this.NullLiteral(literal);
      }
    }
    TopLevelStatement(statement) {
      switch (statement.type) {
        case 'MustacheStatement':
          return this.MustacheStatement(statement);
        case 'BlockStatement':
          return this.BlockStatement(statement);
        case 'PartialStatement':
          return this.PartialStatement(statement);
        case 'MustacheCommentStatement':
          return this.MustacheCommentStatement(statement);
        case 'CommentStatement':
          return this.CommentStatement(statement);
        case 'TextNode':
          return this.TextNode(statement);
        case 'ElementNode':
          return this.ElementNode(statement);
        case 'Block':
        case 'Template':
          return this.Block(statement);
        case 'AttrNode':
          // should have element
          return this.AttrNode(statement);
      }
    }
    Block(block) {
      /*
        When processing a template like:
             ```hbs
        {{#if whatever}}
          whatever
        {{else if somethingElse}}
          something else
        {{else}}
          fallback
        {{/if}}
        ```
             The AST still _effectively_ looks like:
             ```hbs
        {{#if whatever}}
          whatever
        {{else}}{{#if somethingElse}}
          something else
        {{else}}
          fallback
        {{/if}}{{/if}}
        ```
             The only way we can tell if that is the case is by checking for
        `block.chained`, but unfortunately when the actual statements are
        processed the `block.body[0]` node (which will always be a
        `BlockStatement`) has no clue that its ancestor `Block` node was
        chained.
             This "forwards" the `chained` setting so that we can check
        it later when processing the `BlockStatement`.
      */
      if (block.chained) {
        var firstChild = block.body[0];
        firstChild.chained = true;
      }
      if (this.handledByOverride(block)) {
        return;
      }
      this.TopLevelStatements(block.body);
    }
    TopLevelStatements(statements) {
      statements.forEach(statement => this.TopLevelStatement(statement));
    }
    ElementNode(el) {
      if (this.handledByOverride(el)) {
        return;
      }
      this.OpenElementNode(el);
      this.TopLevelStatements(el.children);
      this.CloseElementNode(el);
    }
    OpenElementNode(el) {
      this.buffer += "<" + el.tag;
      var parts = [...el.attributes, ...el.modifiers, ...el.comments].sort(sortByLoc);
      for (var part of parts) {
        this.buffer += ' ';
        switch (part.type) {
          case 'AttrNode':
            this.AttrNode(part);
            break;
          case 'ElementModifierStatement':
            this.ElementModifierStatement(part);
            break;
          case 'MustacheCommentStatement':
            this.MustacheCommentStatement(part);
            break;
        }
      }
      if (el.blockParams.length) {
        this.BlockParams(el.blockParams);
      }
      if (el.selfClosing) {
        this.buffer += ' /';
      }
      this.buffer += '>';
    }
    CloseElementNode(el) {
      if (el.selfClosing || voidMap[el.tag.toLowerCase()]) {
        return;
      }
      this.buffer += "</" + el.tag + ">";
    }
    AttrNode(attr) {
      if (this.handledByOverride(attr)) {
        return;
      }
      var {
        name,
        value
      } = attr;
      this.buffer += name;
      if (value.type !== 'TextNode' || value.chars.length > 0) {
        this.buffer += '=';
        this.AttrNodeValue(value);
      }
    }
    AttrNodeValue(value) {
      if (value.type === 'TextNode') {
        this.buffer += '"';
        this.TextNode(value, true);
        this.buffer += '"';
      } else {
        this.Node(value);
      }
    }
    TextNode(text, isAttr) {
      if (this.handledByOverride(text)) {
        return;
      }
      if (this.options.entityEncoding === 'raw') {
        this.buffer += text.chars;
      } else if (isAttr) {
        this.buffer += escapeAttrValue(text.chars);
      } else {
        this.buffer += escapeText(text.chars);
      }
    }
    MustacheStatement(mustache) {
      if (this.handledByOverride(mustache)) {
        return;
      }
      this.buffer += mustache.escaped ? '{{' : '{{{';
      if (mustache.strip.open) {
        this.buffer += '~';
      }
      this.Expression(mustache.path);
      this.Params(mustache.params);
      this.Hash(mustache.hash);
      if (mustache.strip.close) {
        this.buffer += '~';
      }
      this.buffer += mustache.escaped ? '}}' : '}}}';
    }
    BlockStatement(block) {
      if (this.handledByOverride(block)) {
        return;
      }
      if (block.chained) {
        this.buffer += block.inverseStrip.open ? '{{~' : '{{';
        this.buffer += 'else ';
      } else {
        this.buffer += block.openStrip.open ? '{{~#' : '{{#';
      }
      this.Expression(block.path);
      this.Params(block.params);
      this.Hash(block.hash);
      if (block.program.blockParams.length) {
        this.BlockParams(block.program.blockParams);
      }
      if (block.chained) {
        this.buffer += block.inverseStrip.close ? '~}}' : '}}';
      } else {
        this.buffer += block.openStrip.close ? '~}}' : '}}';
      }
      this.Block(block.program);
      if (block.inverse) {
        if (!block.inverse.chained) {
          this.buffer += block.inverseStrip.open ? '{{~' : '{{';
          this.buffer += 'else';
          this.buffer += block.inverseStrip.close ? '~}}' : '}}';
        }
        this.Block(block.inverse);
      }
      if (!block.chained) {
        this.buffer += block.closeStrip.open ? '{{~/' : '{{/';
        this.Expression(block.path);
        this.buffer += block.closeStrip.close ? '~}}' : '}}';
      }
    }
    BlockParams(blockParams) {
      this.buffer += " as |" + blockParams.join(' ') + "|";
    }
    PartialStatement(partial) {
      if (this.handledByOverride(partial)) {
        return;
      }
      this.buffer += '{{>';
      this.Expression(partial.name);
      this.Params(partial.params);
      this.Hash(partial.hash);
      this.buffer += '}}';
    }
    ConcatStatement(concat) {
      if (this.handledByOverride(concat)) {
        return;
      }
      this.buffer += '"';
      concat.parts.forEach(part => {
        if (part.type === 'TextNode') {
          this.TextNode(part, true);
        } else {
          this.Node(part);
        }
      });
      this.buffer += '"';
    }
    MustacheCommentStatement(comment) {
      if (this.handledByOverride(comment)) {
        return;
      }
      this.buffer += "{{!--" + comment.value + "--}}";
    }
    ElementModifierStatement(mod) {
      if (this.handledByOverride(mod)) {
        return;
      }
      this.buffer += '{{';
      this.Expression(mod.path);
      this.Params(mod.params);
      this.Hash(mod.hash);
      this.buffer += '}}';
    }
    CommentStatement(comment) {
      if (this.handledByOverride(comment)) {
        return;
      }
      this.buffer += "<!--" + comment.value + "-->";
    }
    PathExpression(path) {
      if (this.handledByOverride(path)) {
        return;
      }
      this.buffer += path.original;
    }
    SubExpression(sexp) {
      if (this.handledByOverride(sexp)) {
        return;
      }
      this.buffer += '(';
      this.Expression(sexp.path);
      this.Params(sexp.params);
      this.Hash(sexp.hash);
      this.buffer += ')';
    }
    Params(params) {
      // TODO: implement a top level Params AST node (just like the Hash object)
      // so that this can also be overridden
      if (params.length) {
        params.forEach(param => {
          this.buffer += ' ';
          this.Expression(param);
        });
      }
    }
    Hash(hash) {
      if (this.handledByOverride(hash, true)) {
        return;
      }
      hash.pairs.forEach(pair => {
        this.buffer += ' ';
        this.HashPair(pair);
      });
    }
    HashPair(pair) {
      if (this.handledByOverride(pair)) {
        return;
      }
      this.buffer += pair.key;
      this.buffer += '=';
      this.Node(pair.value);
    }
    StringLiteral(str) {
      if (this.handledByOverride(str)) {
        return;
      }
      this.buffer += JSON.stringify(str.value);
    }
    BooleanLiteral(bool) {
      if (this.handledByOverride(bool)) {
        return;
      }
      this.buffer += bool.value;
    }
    NumberLiteral(number) {
      if (this.handledByOverride(number)) {
        return;
      }
      this.buffer += number.value;
    }
    UndefinedLiteral(node) {
      if (this.handledByOverride(node)) {
        return;
      }
      this.buffer += 'undefined';
    }
    NullLiteral(node) {
      if (this.handledByOverride(node)) {
        return;
      }
      this.buffer += 'null';
    }
    print(node) {
      var {
        options
      } = this;
      if (options.override) {
        var result = options.override(node, options);
        if (result !== undefined) {
          return result;
        }
      }
      this.buffer = '';
      this.Node(node);
      return this.buffer;
    }
  }
  function build(ast, options) {
    if (options === void 0) {
      options = {
        entityEncoding: 'transformed'
      };
    }
    if (!ast) {
      return '';
    }
    var printer = new Printer(options);
    return printer.print(ast);
  }
  function generateSyntaxError(message, location) {
    var {
      module,
      loc
    } = location;
    var {
      line,
      column
    } = loc.start;
    var code = location.asString();
    var quotedCode = code ? "\n\n|\n|  " + code.split('\n').join('\n|  ') + "\n|\n\n" : '';
    var error = new Error(message + ": " + quotedCode + "(error occurred in '" + module + "' @ line " + line + " : column " + column + ")");
    error.name = 'SyntaxError';
    error.location = location;
    error.code = code;
    return error;
  }

  // ParentNode and ChildKey types are derived from VisitorKeysMap

  var visitorKeys = {
    Program: (0, _util.tuple)('body'),
    Template: (0, _util.tuple)('body'),
    Block: (0, _util.tuple)('body'),
    MustacheStatement: (0, _util.tuple)('path', 'params', 'hash'),
    BlockStatement: (0, _util.tuple)('path', 'params', 'hash', 'program', 'inverse'),
    ElementModifierStatement: (0, _util.tuple)('path', 'params', 'hash'),
    PartialStatement: (0, _util.tuple)('name', 'params', 'hash'),
    CommentStatement: (0, _util.tuple)(),
    MustacheCommentStatement: (0, _util.tuple)(),
    ElementNode: (0, _util.tuple)('attributes', 'modifiers', 'children', 'comments'),
    AttrNode: (0, _util.tuple)('value'),
    TextNode: (0, _util.tuple)(),
    ConcatStatement: (0, _util.tuple)('parts'),
    SubExpression: (0, _util.tuple)('path', 'params', 'hash'),
    PathExpression: (0, _util.tuple)(),
    PathHead: (0, _util.tuple)(),
    StringLiteral: (0, _util.tuple)(),
    BooleanLiteral: (0, _util.tuple)(),
    NumberLiteral: (0, _util.tuple)(),
    NullLiteral: (0, _util.tuple)(),
    UndefinedLiteral: (0, _util.tuple)(),
    Hash: (0, _util.tuple)('pairs'),
    HashPair: (0, _util.tuple)('value'),
    // v2 new nodes
    NamedBlock: (0, _util.tuple)('attributes', 'modifiers', 'children', 'comments'),
    SimpleElement: (0, _util.tuple)('attributes', 'modifiers', 'children', 'comments'),
    Component: (0, _util.tuple)('head', 'attributes', 'modifiers', 'children', 'comments')
  };
  var TraversalError = function () {
    TraversalError.prototype = Object.create(Error.prototype);
    TraversalError.prototype.constructor = TraversalError;
    function TraversalError(message, node, parent, key) {
      var error = Error.call(this, message);
      this.key = key;
      this.message = message;
      this.node = node;
      this.parent = parent;
      this.stack = error.stack;
    }
    return TraversalError;
  }();
  function cannotRemoveNode(node, parent, key) {
    return new TraversalError('Cannot remove a node unless it is part of an array', node, parent, key);
  }
  function cannotReplaceNode(node, parent, key) {
    return new TraversalError('Cannot replace a node with multiple nodes unless it is part of an array', node, parent, key);
  }
  function cannotReplaceOrRemoveInKeyHandlerYet(node, key) {
    return new TraversalError('Replacing and removing in key handlers is not yet supported.', node, null, key);
  }
  class WalkerPath {
    constructor(node, parent, parentKey) {
      if (parent === void 0) {
        parent = null;
      }
      if (parentKey === void 0) {
        parentKey = null;
      }
      this.node = node;
      this.parent = parent;
      this.parentKey = parentKey;
    }
    get parentNode() {
      return this.parent ? this.parent.node : null;
    }
    parents() {
      return {
        [Symbol.iterator]: () => {
          return new PathParentsIterator(this);
        }
      };
    }
  }
  _exports.WalkerPath = WalkerPath;
  class PathParentsIterator {
    constructor(path) {
      this.path = path;
    }
    next() {
      if (this.path.parent) {
        this.path = this.path.parent;
        return {
          done: false,
          value: this.path
        };
      } else {
        return {
          done: true,
          value: null
        };
      }
    }
  }
  function getEnterFunction(handler) {
    if (typeof handler === 'function') {
      return handler;
    } else {
      return handler.enter;
    }
  }
  function getExitFunction(handler) {
    if (typeof handler === 'function') {
      return undefined;
    } else {
      return handler.exit;
    }
  }
  function getKeyHandler(handler, key) {
    var keyVisitor = typeof handler !== 'function' ? handler.keys : undefined;
    if (keyVisitor === undefined) return;
    var keyHandler = keyVisitor[key];
    if (keyHandler !== undefined) {
      return keyHandler;
    }
    return keyVisitor.All;
  }
  function getNodeHandler(visitor, nodeType) {
    if (nodeType === 'Template' || nodeType === 'Block') {
      if (visitor.Program) {
        return visitor.Program;
      }
    }
    var handler = visitor[nodeType];
    if (handler !== undefined) {
      return handler;
    }
    return visitor.All;
  }
  function visitNode(visitor, path) {
    var {
      node,
      parent,
      parentKey
    } = path;
    var handler = getNodeHandler(visitor, node.type);
    var enter;
    var exit;
    if (handler !== undefined) {
      enter = getEnterFunction(handler);
      exit = getExitFunction(handler);
    }
    var result;
    if (enter !== undefined) {
      result = enter(node, path);
    }
    if (result !== undefined && result !== null) {
      if (JSON.stringify(node) === JSON.stringify(result)) {
        result = undefined;
      } else if (Array.isArray(result)) {
        visitArray(visitor, result, parent, parentKey);
        return result;
      } else {
        var _path = new WalkerPath(result, parent, parentKey);
        return visitNode(visitor, _path) || result;
      }
    }
    if (result === undefined) {
      var keys = visitorKeys[node.type];
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i]; // we know if it has child keys we can widen to a ParentNode

        visitKey(visitor, handler, path, key);
      }
      if (exit !== undefined) {
        result = exit(node, path);
      }
    }
    return result;
  }
  function get(node, key) {
    return node[key];
  }
  function set(node, key, value) {
    node[key] = value;
  }
  function visitKey(visitor, handler, path, key) {
    var {
      node
    } = path;
    var value = get(node, key);
    if (!value) {
      return;
    }
    var keyEnter;
    var keyExit;
    if (handler !== undefined) {
      var keyHandler = getKeyHandler(handler, key);
      if (keyHandler !== undefined) {
        keyEnter = getEnterFunction(keyHandler);
        keyExit = getExitFunction(keyHandler);
      }
    }
    if (keyEnter !== undefined) {
      if (keyEnter(node, key) !== undefined) {
        throw cannotReplaceOrRemoveInKeyHandlerYet(node, key);
      }
    }
    if (Array.isArray(value)) {
      visitArray(visitor, value, path, key);
    } else {
      var keyPath = new WalkerPath(value, path, key);
      var result = visitNode(visitor, keyPath);
      if (result !== undefined) {
        // TODO: dynamically check the results by having a table of
        // expected node types in value space, not just type space
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        assignKey(node, key, value, result);
      }
    }
    if (keyExit !== undefined) {
      if (keyExit(node, key) !== undefined) {
        throw cannotReplaceOrRemoveInKeyHandlerYet(node, key);
      }
    }
  }
  function visitArray(visitor, array, parent, parentKey) {
    for (var i = 0; i < array.length; i++) {
      var _node = array[i];
      var path = new WalkerPath(_node, parent, parentKey);
      var result = visitNode(visitor, path);
      if (result !== undefined) {
        i += spliceArray(array, i, result) - 1;
      }
    }
  }
  function assignKey(node, key, value, result) {
    if (result === null) {
      throw cannotRemoveNode(value, node, key);
    } else if (Array.isArray(result)) {
      if (result.length === 1) {
        set(node, key, result[0]);
      } else {
        if (result.length === 0) {
          throw cannotRemoveNode(value, node, key);
        } else {
          throw cannotReplaceNode(value, node, key);
        }
      }
    } else {
      set(node, key, result);
    }
  }
  function spliceArray(array, index, result) {
    if (result === null) {
      array.splice(index, 1);
      return 0;
    } else if (Array.isArray(result)) {
      array.splice(index, 1, ...result);
      return result.length;
    } else {
      array.splice(index, 1, result);
      return 1;
    }
  }
  function traverse(node, visitor) {
    var path = new WalkerPath(node);
    visitNode(visitor, path);
  }
  class Walker {
    constructor(order) {
      this.order = order;
      this.stack = [];
    }
    visit(node, callback) {
      if (!node) {
        return;
      }
      this.stack.push(node);
      if (this.order === 'post') {
        this.children(node, callback);
        callback(node, this);
      } else {
        callback(node, this);
        this.children(node, callback);
      }
      this.stack.pop();
    }
    children(node, callback) {
      switch (node.type) {
        case 'Block':
        case 'Template':
          return visitors.Program(this, node, callback);
        case 'ElementNode':
          return visitors.ElementNode(this, node, callback);
        case 'BlockStatement':
          return visitors.BlockStatement(this, node, callback);
        default:
          return;
      }
    }
  }
  _exports.Walker = _exports.Path = Walker;
  var visitors = {
    Program(walker, node, callback) {
      for (var i = 0; i < node.body.length; i++) {
        walker.visit(node.body[i], callback);
      }
    },
    Template(walker, node, callback) {
      for (var i = 0; i < node.body.length; i++) {
        walker.visit(node.body[i], callback);
      }
    },
    Block(walker, node, callback) {
      for (var i = 0; i < node.body.length; i++) {
        walker.visit(node.body[i], callback);
      }
    },
    ElementNode(walker, node, callback) {
      for (var i = 0; i < node.children.length; i++) {
        walker.visit(node.children[i], callback);
      }
    },
    BlockStatement(walker, node, callback) {
      walker.visit(node.program, callback);
      walker.visit(node.inverse || null, callback);
    }
  };

  // Based on the ID validation regex in Handlebars.

  var ID_INVERSE_PATTERN = /[!"#%-,\.\/;->@\[-\^`\{-~]/; // Checks the element's attributes to see if it uses block params.
  // If it does, registers the block params with the program and
  // removes the corresponding attributes from the element.

  function parseElementBlockParams(element) {
    var params = parseBlockParams(element);
    if (params) element.blockParams = params;
  }
  function parseBlockParams(element) {
    var l = element.attributes.length;
    var attrNames = [];
    for (var i = 0; i < l; i++) {
      attrNames.push(element.attributes[i].name);
    }
    var asIndex = attrNames.indexOf('as');
    if (asIndex === -1 && attrNames.length > 0 && attrNames[attrNames.length - 1].charAt(0) === '|') {
      throw generateSyntaxError('Block parameters must be preceded by the `as` keyword, detected block parameters without `as`', element.loc);
    }
    if (asIndex !== -1 && l > asIndex && attrNames[asIndex + 1].charAt(0) === '|') {
      // Some basic validation, since we're doing the parsing ourselves
      var paramsString = attrNames.slice(asIndex).join(' ');
      if (paramsString.charAt(paramsString.length - 1) !== '|' || paramsString.match(/\|/g).length !== 2) {
        throw generateSyntaxError("Invalid block parameters syntax, '" + paramsString + "'", element.loc);
      }
      var params = [];
      for (var _i = asIndex + 1; _i < l; _i++) {
        var param = attrNames[_i].replace(/\|/g, '');
        if (param !== '') {
          if (ID_INVERSE_PATTERN.test(param)) {
            throw generateSyntaxError("Invalid identifier for block parameters, '" + param + "'", element.loc);
          }
          params.push(param);
        }
      }
      if (params.length === 0) {
        throw generateSyntaxError('Cannot use zero block parameters', element.loc);
      }
      element.attributes = element.attributes.slice(0, asIndex);
      return params;
    }
    return null;
  }
  function childrenFor(node) {
    switch (node.type) {
      case 'Block':
      case 'Template':
        return node.body;
      case 'ElementNode':
        return node.children;
    }
  }
  function appendChild(parent, node) {
    childrenFor(parent).push(node);
  }
  function isHBSLiteral(path) {
    return path.type === 'StringLiteral' || path.type === 'BooleanLiteral' || path.type === 'NumberLiteral' || path.type === 'NullLiteral' || path.type === 'UndefinedLiteral';
  }
  function printLiteral(literal) {
    if (literal.type === 'UndefinedLiteral') {
      return 'undefined';
    } else {
      return JSON.stringify(literal.value);
    }
  }
  function isUpperCase(tag) {
    return tag[0] === tag[0].toUpperCase() && tag[0] !== tag[0].toLowerCase();
  }
  function isLowerCase(tag) {
    return tag[0] === tag[0].toLowerCase() && tag[0] !== tag[0].toUpperCase();
  }
  var DEFAULT_STRIP = {
    close: false,
    open: false
  };
  /**
   * The Parser Builder differentiates from the public builder API by:
   *
   * 1. Offering fewer different ways to instantiate nodes
   * 2. Mandating source locations
   */

  class Builders {
    pos(line, column) {
      return {
        line,
        column
      };
    }
    blockItself(_ref15) {
      var {
        body,
        blockParams,
        chained = false,
        loc
      } = _ref15;
      return {
        type: 'Block',
        body: body || [],
        blockParams: blockParams || [],
        chained,
        loc
      };
    }
    template(_ref16) {
      var {
        body,
        blockParams,
        loc
      } = _ref16;
      return {
        type: 'Template',
        body: body || [],
        blockParams: blockParams || [],
        loc
      };
    }
    mustache(_ref17) {
      var {
        path,
        params,
        hash,
        trusting,
        loc,
        strip = DEFAULT_STRIP
      } = _ref17;
      return {
        type: 'MustacheStatement',
        path,
        params,
        hash,
        escaped: !trusting,
        trusting,
        loc,
        strip: strip || {
          open: false,
          close: false
        }
      };
    }
    block(_ref18) {
      var {
        path,
        params,
        hash,
        defaultBlock,
        elseBlock = null,
        loc,
        openStrip = DEFAULT_STRIP,
        inverseStrip = DEFAULT_STRIP,
        closeStrip = DEFAULT_STRIP
      } = _ref18;
      return {
        type: 'BlockStatement',
        path: path,
        params,
        hash,
        program: defaultBlock,
        inverse: elseBlock,
        loc: loc,
        openStrip: openStrip,
        inverseStrip: inverseStrip,
        closeStrip: closeStrip
      };
    }
    comment(value, loc) {
      return {
        type: 'CommentStatement',
        value: value,
        loc
      };
    }
    mustacheComment(value, loc) {
      return {
        type: 'MustacheCommentStatement',
        value: value,
        loc
      };
    }
    concat(parts, loc) {
      return {
        type: 'ConcatStatement',
        parts,
        loc
      };
    }
    element(_ref19) {
      var {
        tag,
        selfClosing,
        attrs,
        blockParams,
        modifiers,
        comments,
        children,
        loc
      } = _ref19;
      return {
        type: 'ElementNode',
        tag,
        selfClosing: selfClosing,
        attributes: attrs || [],
        blockParams: blockParams || [],
        modifiers: modifiers || [],
        comments: comments || [],
        children: children || [],
        loc
      };
    }
    elementModifier(_ref20) {
      var {
        path,
        params,
        hash,
        loc
      } = _ref20;
      return {
        type: 'ElementModifierStatement',
        path,
        params,
        hash,
        loc
      };
    }
    attr(_ref21) {
      var {
        name,
        value,
        loc
      } = _ref21;
      return {
        type: 'AttrNode',
        name: name,
        value: value,
        loc
      };
    }
    text(_ref22) {
      var {
        chars,
        loc
      } = _ref22;
      return {
        type: 'TextNode',
        chars,
        loc
      };
    }
    sexpr(_ref23) {
      var {
        path,
        params,
        hash,
        loc
      } = _ref23;
      return {
        type: 'SubExpression',
        path,
        params,
        hash,
        loc
      };
    }
    path(_ref24) {
      var {
        head,
        tail,
        loc
      } = _ref24;
      var {
        original: originalHead
      } = headToString$1(head);
      var original = [...originalHead, ...tail].join('.');
      return new PathExpressionImplV1(original, head, tail, loc);
    }
    head(head, loc) {
      if (head[0] === '@') {
        return this.atName(head, loc);
      } else if (head === 'this') {
        return this.this(loc);
      } else {
        return this.var(head, loc);
      }
    }
    this(loc) {
      return {
        type: 'ThisHead',
        loc
      };
    }
    atName(name, loc) {
      return {
        type: 'AtHead',
        name,
        loc
      };
    }
    var(name, loc) {
      return {
        type: 'VarHead',
        name,
        loc
      };
    }
    hash(pairs, loc) {
      return {
        type: 'Hash',
        pairs: pairs || [],
        loc
      };
    }
    pair(_ref25) {
      var {
        key,
        value,
        loc
      } = _ref25;
      return {
        type: 'HashPair',
        key: key,
        value,
        loc
      };
    }
    literal(_ref26) {
      var {
        type,
        value,
        loc
      } = _ref26;
      return {
        type,
        value,
        original: value,
        loc
      };
    }
    undefined() {
      return this.literal({
        type: 'UndefinedLiteral',
        value: undefined
      });
    }
    null() {
      return this.literal({
        type: 'NullLiteral',
        value: null
      });
    }
    string(value, loc) {
      return this.literal({
        type: 'StringLiteral',
        value,
        loc
      });
    }
    boolean(value, loc) {
      return this.literal({
        type: 'BooleanLiteral',
        value,
        loc
      });
    }
    number(value, loc) {
      return this.literal({
        type: 'NumberLiteral',
        value,
        loc
      });
    }
  } // Expressions

  function headToString$1(head) {
    switch (head.type) {
      case 'AtHead':
        return {
          original: head.name,
          parts: [head.name]
        };
      case 'ThisHead':
        return {
          original: "this",
          parts: []
        };
      case 'VarHead':
        return {
          original: head.name,
          parts: [head.name]
        };
    }
  }
  var b = new Builders();
  class Parser {
    constructor(source, entityParser, mode) {
      if (entityParser === void 0) {
        entityParser = new _simpleHtmlTokenizer.EntityParser(_simpleHtmlTokenizer.HTML5NamedCharRefs);
      }
      if (mode === void 0) {
        mode = 'precompile';
      }
      this.elementStack = [];
      this.currentAttribute = null;
      this.currentNode = null;
      this.source = source;
      this.lines = source.source.split(/(?:\r\n?|\n)/g);
      this.tokenizer = new _simpleHtmlTokenizer.EventedTokenizer(this, entityParser, mode);
    }
    offset() {
      var {
        line,
        column
      } = this.tokenizer;
      return this.source.offsetFor(line, column);
    }
    pos(_ref27) {
      var {
        line,
        column
      } = _ref27;
      return this.source.offsetFor(line, column);
    }
    finish(node) {
      return (0, _util.assign)({}, node, {
        loc: node.loc.until(this.offset())
      }); // node.loc = node.loc.withEnd(end);
    }

    get currentAttr() {
      return this.currentAttribute;
    }
    get currentTag() {
      var node = this.currentNode;
      return node;
    }
    get currentStartTag() {
      var node = this.currentNode;
      return node;
    }
    get currentEndTag() {
      var node = this.currentNode;
      return node;
    }
    get currentComment() {
      var node = this.currentNode;
      return node;
    }
    get currentData() {
      var node = this.currentNode;
      return node;
    }
    acceptTemplate(node) {
      return this[node.type](node);
    }
    acceptNode(node) {
      return this[node.type](node);
    }
    currentElement() {
      return this.elementStack[this.elementStack.length - 1];
    }
    sourceForNode(node, endNode) {
      var firstLine = node.loc.start.line - 1;
      var currentLine = firstLine - 1;
      var firstColumn = node.loc.start.column;
      var string = [];
      var line;
      var lastLine;
      var lastColumn;
      if (endNode) {
        lastLine = endNode.loc.end.line - 1;
        lastColumn = endNode.loc.end.column;
      } else {
        lastLine = node.loc.end.line - 1;
        lastColumn = node.loc.end.column;
      }
      while (currentLine < lastLine) {
        currentLine++;
        line = this.lines[currentLine];
        if (currentLine === firstLine) {
          if (firstLine === lastLine) {
            string.push(line.slice(firstColumn, lastColumn));
          } else {
            string.push(line.slice(firstColumn));
          }
        } else if (currentLine === lastLine) {
          string.push(line.slice(0, lastColumn));
        } else {
          string.push(line);
        }
      }
      return string.join('\n');
    }
  }
  class HandlebarsNodeVisitors extends Parser {
    get isTopLevel() {
      return this.elementStack.length === 0;
    }
    Program(program) {
      var body = [];
      var node;
      if (this.isTopLevel) {
        node = b.template({
          body,
          blockParams: program.blockParams,
          loc: this.source.spanFor(program.loc)
        });
      } else {
        node = b.blockItself({
          body,
          blockParams: program.blockParams,
          chained: program.chained,
          loc: this.source.spanFor(program.loc)
        });
      }
      var i,
        l = program.body.length;
      this.elementStack.push(node);
      if (l === 0) {
        return this.elementStack.pop();
      }
      for (i = 0; i < l; i++) {
        this.acceptNode(program.body[i]);
      } // Ensure that that the element stack is balanced properly.

      var poppedNode = this.elementStack.pop();
      if (poppedNode !== node) {
        var elementNode = poppedNode;
        throw generateSyntaxError("Unclosed element `" + elementNode.tag + "`", elementNode.loc);
      }
      return node;
    }
    BlockStatement(block) {
      if (this.tokenizer.state === "comment"
      /* comment */) {
        this.appendToCommentData(this.sourceForNode(block));
        return;
      }
      if (this.tokenizer.state !== "data"
      /* data */ && this.tokenizer.state !== "beforeData"
      /* beforeData */) {
        throw generateSyntaxError('A block may only be used inside an HTML element or another block.', this.source.spanFor(block.loc));
      }
      var {
        path,
        params,
        hash
      } = acceptCallNodes(this, block); // These are bugs in Handlebars upstream

      if (!block.program.loc) {
        block.program.loc = NON_EXISTENT_LOCATION;
      }
      if (block.inverse && !block.inverse.loc) {
        block.inverse.loc = NON_EXISTENT_LOCATION;
      }
      var program = this.Program(block.program);
      var inverse = block.inverse ? this.Program(block.inverse) : null;
      var node = b.block({
        path,
        params,
        hash,
        defaultBlock: program,
        elseBlock: inverse,
        loc: this.source.spanFor(block.loc),
        openStrip: block.openStrip,
        inverseStrip: block.inverseStrip,
        closeStrip: block.closeStrip
      });
      var parentProgram = this.currentElement();
      appendChild(parentProgram, node);
    }
    MustacheStatement(rawMustache) {
      var {
        tokenizer
      } = this;
      if (tokenizer.state === 'comment') {
        this.appendToCommentData(this.sourceForNode(rawMustache));
        return;
      }
      var mustache;
      var {
        escaped,
        loc,
        strip
      } = rawMustache;
      if (isHBSLiteral(rawMustache.path)) {
        mustache = b.mustache({
          path: this.acceptNode(rawMustache.path),
          params: [],
          hash: b.hash([], this.source.spanFor(rawMustache.path.loc).collapse('end')),
          trusting: !escaped,
          loc: this.source.spanFor(loc),
          strip
        });
      } else {
        var {
          path,
          params,
          hash
        } = acceptCallNodes(this, rawMustache);
        mustache = b.mustache({
          path,
          params,
          hash,
          trusting: !escaped,
          loc: this.source.spanFor(loc),
          strip
        });
      }
      switch (tokenizer.state) {
        // Tag helpers
        case "tagOpen"
        /* tagOpen */:

        case "tagName"
        /* tagName */:
          throw generateSyntaxError("Cannot use mustaches in an elements tagname", mustache.loc);
        case "beforeAttributeName"
        /* beforeAttributeName */:
          addElementModifier(this.currentStartTag, mustache);
          break;
        case "attributeName"
        /* attributeName */:

        case "afterAttributeName"
        /* afterAttributeName */:
          this.beginAttributeValue(false);
          this.finishAttributeValue();
          addElementModifier(this.currentStartTag, mustache);
          tokenizer.transitionTo("beforeAttributeName"
          /* beforeAttributeName */);

          break;
        case "afterAttributeValueQuoted"
        /* afterAttributeValueQuoted */:
          addElementModifier(this.currentStartTag, mustache);
          tokenizer.transitionTo("beforeAttributeName"
          /* beforeAttributeName */);

          break;
        // Attribute values

        case "beforeAttributeValue"
        /* beforeAttributeValue */:
          this.beginAttributeValue(false);
          this.appendDynamicAttributeValuePart(mustache);
          tokenizer.transitionTo("attributeValueUnquoted"
          /* attributeValueUnquoted */);

          break;
        case "attributeValueDoubleQuoted"
        /* attributeValueDoubleQuoted */:

        case "attributeValueSingleQuoted"
        /* attributeValueSingleQuoted */:

        case "attributeValueUnquoted"
        /* attributeValueUnquoted */:
          this.appendDynamicAttributeValuePart(mustache);
          break;
        // TODO: Only append child when the tokenizer state makes
        // sense to do so, otherwise throw an error.

        default:
          appendChild(this.currentElement(), mustache);
      }
      return mustache;
    }
    appendDynamicAttributeValuePart(part) {
      this.finalizeTextPart();
      var attr = this.currentAttr;
      attr.isDynamic = true;
      attr.parts.push(part);
    }
    finalizeTextPart() {
      var attr = this.currentAttr;
      var text = attr.currentPart;
      if (text !== null) {
        this.currentAttr.parts.push(text);
        this.startTextPart();
      }
    }
    startTextPart() {
      this.currentAttr.currentPart = null;
    }
    ContentStatement(content) {
      updateTokenizerLocation(this.tokenizer, content);
      this.tokenizer.tokenizePart(content.value);
      this.tokenizer.flushData();
    }
    CommentStatement(rawComment) {
      var {
        tokenizer
      } = this;
      if (tokenizer.state === "comment"
      /* comment */) {
        this.appendToCommentData(this.sourceForNode(rawComment));
        return null;
      }
      var {
        value,
        loc
      } = rawComment;
      var comment = b.mustacheComment(value, this.source.spanFor(loc));
      switch (tokenizer.state) {
        case "beforeAttributeName"
        /* beforeAttributeName */:

        case "afterAttributeName"
        /* afterAttributeName */:
          this.currentStartTag.comments.push(comment);
          break;
        case "beforeData"
        /* beforeData */:

        case "data"
        /* data */:
          appendChild(this.currentElement(), comment);
          break;
        default:
          throw generateSyntaxError("Using a Handlebars comment when in the `" + tokenizer['state'] + "` state is not supported", this.source.spanFor(rawComment.loc));
      }
      return comment;
    }
    PartialStatement(partial) {
      throw generateSyntaxError("Handlebars partials are not supported", this.source.spanFor(partial.loc));
    }
    PartialBlockStatement(partialBlock) {
      throw generateSyntaxError("Handlebars partial blocks are not supported", this.source.spanFor(partialBlock.loc));
    }
    Decorator(decorator) {
      throw generateSyntaxError("Handlebars decorators are not supported", this.source.spanFor(decorator.loc));
    }
    DecoratorBlock(decoratorBlock) {
      throw generateSyntaxError("Handlebars decorator blocks are not supported", this.source.spanFor(decoratorBlock.loc));
    }
    SubExpression(sexpr) {
      var {
        path,
        params,
        hash
      } = acceptCallNodes(this, sexpr);
      return b.sexpr({
        path,
        params,
        hash,
        loc: this.source.spanFor(sexpr.loc)
      });
    }
    PathExpression(path) {
      var {
        original
      } = path;
      var parts;
      if (original.indexOf('/') !== -1) {
        if (original.slice(0, 2) === './') {
          throw generateSyntaxError("Using \"./\" is not supported in Glimmer and unnecessary", this.source.spanFor(path.loc));
        }
        if (original.slice(0, 3) === '../') {
          throw generateSyntaxError("Changing context using \"../\" is not supported in Glimmer", this.source.spanFor(path.loc));
        }
        if (original.indexOf('.') !== -1) {
          throw generateSyntaxError("Mixing '.' and '/' in paths is not supported in Glimmer; use only '.' to separate property paths", this.source.spanFor(path.loc));
        }
        parts = [path.parts.join('/')];
      } else if (original === '.') {
        throw generateSyntaxError("'.' is not a supported path in Glimmer; check for a path with a trailing '.'", this.source.spanFor(path.loc));
      } else {
        parts = path.parts;
      }
      var thisHead = false; // This is to fix a bug in the Handlebars AST where the path expressions in
      // `{{this.foo}}` (and similarly `{{foo-bar this.foo named=this.foo}}` etc)
      // are simply turned into `{{foo}}`. The fix is to push it back onto the
      // parts array and let the runtime see the difference. However, we cannot
      // simply use the string `this` as it means literally the property called
      // "this" in the current context (it can be expressed in the syntax as
      // `{{[this]}}`, where the square bracket are generally for this kind of
      // escaping – such as `{{foo.["bar.baz"]}}` would mean lookup a property
      // named literally "bar.baz" on `this.foo`). By convention, we use `null`
      // for this purpose.

      if (original.match(/^this(\..+)?$/)) {
        thisHead = true;
      }
      var pathHead;
      if (thisHead) {
        pathHead = {
          type: 'ThisHead',
          loc: {
            start: path.loc.start,
            end: {
              line: path.loc.start.line,
              column: path.loc.start.column + 4
            }
          }
        };
      } else if (path.data) {
        var head = parts.shift();
        if (head === undefined) {
          throw generateSyntaxError("Attempted to parse a path expression, but it was not valid. Paths beginning with @ must start with a-z.", this.source.spanFor(path.loc));
        }
        pathHead = {
          type: 'AtHead',
          name: "@" + head,
          loc: {
            start: path.loc.start,
            end: {
              line: path.loc.start.line,
              column: path.loc.start.column + head.length + 1
            }
          }
        };
      } else {
        var _head2 = parts.shift();
        if (_head2 === undefined) {
          throw generateSyntaxError("Attempted to parse a path expression, but it was not valid. Paths must start with a-z or A-Z.", this.source.spanFor(path.loc));
        }
        pathHead = {
          type: 'VarHead',
          name: _head2,
          loc: {
            start: path.loc.start,
            end: {
              line: path.loc.start.line,
              column: path.loc.start.column + _head2.length
            }
          }
        };
      }
      return new PathExpressionImplV1(path.original, pathHead, parts, this.source.spanFor(path.loc));
    }
    Hash(hash) {
      var pairs = [];
      for (var i = 0; i < hash.pairs.length; i++) {
        var pair = hash.pairs[i];
        pairs.push(b.pair({
          key: pair.key,
          value: this.acceptNode(pair.value),
          loc: this.source.spanFor(pair.loc)
        }));
      }
      return b.hash(pairs, this.source.spanFor(hash.loc));
    }
    StringLiteral(string) {
      return b.literal({
        type: 'StringLiteral',
        value: string.value,
        loc: string.loc
      });
    }
    BooleanLiteral(boolean) {
      return b.literal({
        type: 'BooleanLiteral',
        value: boolean.value,
        loc: boolean.loc
      });
    }
    NumberLiteral(number) {
      return b.literal({
        type: 'NumberLiteral',
        value: number.value,
        loc: number.loc
      });
    }
    UndefinedLiteral(undef) {
      return b.literal({
        type: 'UndefinedLiteral',
        value: undefined,
        loc: undef.loc
      });
    }
    NullLiteral(nul) {
      return b.literal({
        type: 'NullLiteral',
        value: null,
        loc: nul.loc
      });
    }
  }
  function calculateRightStrippedOffsets(original, value) {
    if (value === '') {
      // if it is empty, just return the count of newlines
      // in original
      return {
        lines: original.split('\n').length - 1,
        columns: 0
      };
    } // otherwise, return the number of newlines prior to
    // `value`

    var difference = original.split(value)[0];
    var lines = difference.split(/\n/);
    var lineCount = lines.length - 1;
    return {
      lines: lineCount,
      columns: lines[lineCount].length
    };
  }
  function updateTokenizerLocation(tokenizer, content) {
    var line = content.loc.start.line;
    var column = content.loc.start.column;
    var offsets = calculateRightStrippedOffsets(content.original, content.value);
    line = line + offsets.lines;
    if (offsets.lines) {
      column = offsets.columns;
    } else {
      column = column + offsets.columns;
    }
    tokenizer.line = line;
    tokenizer.column = column;
  }
  function acceptCallNodes(compiler, node) {
    if (node.path.type.endsWith('Literal')) {
      var _path2 = node.path;
      var value = '';
      if (_path2.type === 'BooleanLiteral') {
        value = _path2.original.toString();
      } else if (_path2.type === 'StringLiteral') {
        value = "\"" + _path2.original + "\"";
      } else if (_path2.type === 'NullLiteral') {
        value = 'null';
      } else if (_path2.type === 'NumberLiteral') {
        value = _path2.value.toString();
      } else {
        value = 'undefined';
      }
      throw generateSyntaxError(_path2.type + " \"" + (_path2.type === 'StringLiteral' ? _path2.original : value) + "\" cannot be called as a sub-expression, replace (" + value + ") with " + value, compiler.source.spanFor(_path2.loc));
    }
    var path = node.path.type === 'PathExpression' ? compiler.PathExpression(node.path) : compiler.SubExpression(node.path);
    var params = node.params ? node.params.map(e => compiler.acceptNode(e)) : []; // if there is no hash, position it as a collapsed node immediately after the last param (or the
    // path, if there are also no params)

    var end = params.length > 0 ? params[params.length - 1].loc : path.loc;
    var hash = node.hash ? compiler.Hash(node.hash) : {
      type: 'Hash',
      pairs: [],
      loc: compiler.source.spanFor(end).collapse('end')
    };
    return {
      path,
      params,
      hash
    };
  }
  function addElementModifier(element, mustache) {
    var {
      path,
      params,
      hash,
      loc
    } = mustache;
    if (isHBSLiteral(path)) {
      var _modifier = "{{" + printLiteral(path) + "}}";
      var tag = "<" + element.name + " ... " + _modifier + " ...";
      throw generateSyntaxError("In " + tag + ", " + _modifier + " is not a valid modifier", mustache.loc);
    }
    var modifier = b.elementModifier({
      path,
      params,
      hash,
      loc
    });
    element.modifiers.push(modifier);
  }
  class TokenizerEventHandlers extends HandlebarsNodeVisitors {
    constructor() {
      super(...arguments);
      this.tagOpenLine = 0;
      this.tagOpenColumn = 0;
    }
    reset() {
      this.currentNode = null;
    } // Comment

    beginComment() {
      this.currentNode = b.comment('', this.source.offsetFor(this.tagOpenLine, this.tagOpenColumn));
    }
    appendToCommentData(char) {
      this.currentComment.value += char;
    }
    finishComment() {
      appendChild(this.currentElement(), this.finish(this.currentComment));
    } // Data

    beginData() {
      this.currentNode = b.text({
        chars: '',
        loc: this.offset().collapsed()
      });
    }
    appendToData(char) {
      this.currentData.chars += char;
    }
    finishData() {
      this.currentData.loc = this.currentData.loc.withEnd(this.offset());
      appendChild(this.currentElement(), this.currentData);
    } // Tags - basic

    tagOpen() {
      this.tagOpenLine = this.tokenizer.line;
      this.tagOpenColumn = this.tokenizer.column;
    }
    beginStartTag() {
      this.currentNode = {
        type: 'StartTag',
        name: '',
        attributes: [],
        modifiers: [],
        comments: [],
        selfClosing: false,
        loc: this.source.offsetFor(this.tagOpenLine, this.tagOpenColumn)
      };
    }
    beginEndTag() {
      this.currentNode = {
        type: 'EndTag',
        name: '',
        attributes: [],
        modifiers: [],
        comments: [],
        selfClosing: false,
        loc: this.source.offsetFor(this.tagOpenLine, this.tagOpenColumn)
      };
    }
    finishTag() {
      var tag = this.finish(this.currentTag);
      if (tag.type === 'StartTag') {
        this.finishStartTag();
        if (tag.name === ':') {
          throw generateSyntaxError('Invalid named block named detected, you may have created a named block without a name, or you may have began your name with a number. Named blocks must have names that are at least one character long, and begin with a lower case letter', this.source.spanFor({
            start: this.currentTag.loc.toJSON(),
            end: this.offset().toJSON()
          }));
        }
        if (voidMap[tag.name] || tag.selfClosing) {
          this.finishEndTag(true);
        }
      } else if (tag.type === 'EndTag') {
        this.finishEndTag(false);
      }
    }
    finishStartTag() {
      var {
        name,
        attributes: attrs,
        modifiers,
        comments,
        selfClosing,
        loc
      } = this.finish(this.currentStartTag);
      var element = b.element({
        tag: name,
        selfClosing,
        attrs,
        modifiers,
        comments,
        children: [],
        blockParams: [],
        loc
      });
      this.elementStack.push(element);
    }
    finishEndTag(isVoid) {
      var tag = this.finish(this.currentTag);
      var element = this.elementStack.pop();
      var parent = this.currentElement();
      this.validateEndTag(tag, element, isVoid);
      element.loc = element.loc.withEnd(this.offset());
      parseElementBlockParams(element);
      appendChild(parent, element);
    }
    markTagAsSelfClosing() {
      this.currentTag.selfClosing = true;
    } // Tags - name

    appendToTagName(char) {
      this.currentTag.name += char;
    } // Tags - attributes

    beginAttribute() {
      var offset = this.offset();
      this.currentAttribute = {
        name: '',
        parts: [],
        currentPart: null,
        isQuoted: false,
        isDynamic: false,
        start: offset,
        valueSpan: offset.collapsed()
      };
    }
    appendToAttributeName(char) {
      this.currentAttr.name += char;
    }
    beginAttributeValue(isQuoted) {
      this.currentAttr.isQuoted = isQuoted;
      this.startTextPart();
      this.currentAttr.valueSpan = this.offset().collapsed();
    }
    appendToAttributeValue(char) {
      var parts = this.currentAttr.parts;
      var lastPart = parts[parts.length - 1];
      var current = this.currentAttr.currentPart;
      if (current) {
        current.chars += char; // update end location for each added char

        current.loc = current.loc.withEnd(this.offset());
      } else {
        // initially assume the text node is a single char
        var _loc2 = this.offset(); // the tokenizer line/column have already been advanced, correct location info

        if (char === '\n') {
          _loc2 = lastPart ? lastPart.loc.getEnd() : this.currentAttr.valueSpan.getStart();
        } else {
          _loc2 = _loc2.move(-1);
        }
        this.currentAttr.currentPart = b.text({
          chars: char,
          loc: _loc2.collapsed()
        });
      }
    }
    finishAttributeValue() {
      this.finalizeTextPart();
      var tag = this.currentTag;
      var tokenizerPos = this.offset();
      if (tag.type === 'EndTag') {
        throw generateSyntaxError("Invalid end tag: closing tag must not have attributes", this.source.spanFor({
          start: tag.loc.toJSON(),
          end: tokenizerPos.toJSON()
        }));
      }
      var {
        name,
        parts,
        start,
        isQuoted,
        isDynamic,
        valueSpan
      } = this.currentAttr;
      var value = this.assembleAttributeValue(parts, isQuoted, isDynamic, start.until(tokenizerPos));
      value.loc = valueSpan.withEnd(tokenizerPos);
      var attribute = b.attr({
        name,
        value,
        loc: start.until(tokenizerPos)
      });
      this.currentStartTag.attributes.push(attribute);
    }
    reportSyntaxError(message) {
      throw generateSyntaxError(message, this.offset().collapsed());
    }
    assembleConcatenatedValue(parts) {
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i];
        if (part.type !== 'MustacheStatement' && part.type !== 'TextNode') {
          throw generateSyntaxError('Unsupported node in quoted attribute value: ' + part['type'], part.loc);
        }
      }
      (0, _util.assertPresent)(parts, "the concatenation parts of an element should not be empty");
      var first = parts[0];
      var last = parts[parts.length - 1];
      return b.concat(parts, this.source.spanFor(first.loc).extend(this.source.spanFor(last.loc)));
    }
    validateEndTag(tag, element, selfClosing) {
      var error;
      if (voidMap[tag.name] && !selfClosing) {
        // EngTag is also called by StartTag for void and self-closing tags (i.e.
        // <input> or <br />, so we need to check for that here. Otherwise, we would
        // throw an error for those cases.
        error = "<" + tag.name + "> elements do not need end tags. You should remove it";
      } else if (element.tag === undefined) {
        error = "Closing tag </" + tag.name + "> without an open tag";
      } else if (element.tag !== tag.name) {
        error = "Closing tag </" + tag.name + "> did not match last open tag <" + element.tag + "> (on line " + element.loc.startPosition.line + ")";
      }
      if (error) {
        throw generateSyntaxError(error, tag.loc);
      }
    }
    assembleAttributeValue(parts, isQuoted, isDynamic, span) {
      if (isDynamic) {
        if (isQuoted) {
          return this.assembleConcatenatedValue(parts);
        } else {
          if (parts.length === 1 || parts.length === 2 && parts[1].type === 'TextNode' && parts[1].chars === '/') {
            return parts[0];
          } else {
            throw generateSyntaxError("An unquoted attribute value must be a string or a mustache, " + "preceded by whitespace or a '=' character, and " + "followed by whitespace, a '>' character, or '/>'", span);
          }
        }
      } else {
        return parts.length > 0 ? parts[0] : b.text({
          chars: '',
          loc: span
        });
      }
    }
  }
  var syntax = {
    parse: preprocess,
    builders: publicBuilder,
    print: build,
    traverse,
    Walker
  };
  class CodemodEntityParser extends _simpleHtmlTokenizer.EntityParser {
    // match upstream types, but never match an entity
    constructor() {
      super({});
    }
    parse() {
      return undefined;
    }
  }
  function preprocess(input, options) {
    if (options === void 0) {
      options = {};
    }
    var _a, _b, _c;
    var mode = options.mode || 'precompile';
    var source;
    var ast;
    if (typeof input === 'string') {
      source = new Source(input, (_a = options.meta) === null || _a === void 0 ? void 0 : _a.moduleName);
      if (mode === 'codemod') {
        ast = (0, _parser.parseWithoutProcessing)(input, options.parseOptions);
      } else {
        ast = (0, _parser.parse)(input, options.parseOptions);
      }
    } else if (input instanceof Source) {
      source = input;
      if (mode === 'codemod') {
        ast = (0, _parser.parseWithoutProcessing)(input.source, options.parseOptions);
      } else {
        ast = (0, _parser.parse)(input.source, options.parseOptions);
      }
    } else {
      source = new Source('', (_b = options.meta) === null || _b === void 0 ? void 0 : _b.moduleName);
      ast = input;
    }
    var entityParser = undefined;
    if (mode === 'codemod') {
      entityParser = new CodemodEntityParser();
    }
    var offsets = SourceSpan.forCharPositions(source, 0, source.source.length);
    ast.loc = {
      source: '(program)',
      start: offsets.startPosition,
      end: offsets.endPosition
    };
    var program = new TokenizerEventHandlers(source, entityParser, mode).acceptTemplate(ast);
    if (options.strictMode) {
      program.blockParams = (_c = options.locals) !== null && _c !== void 0 ? _c : [];
    }
    if (options && options.plugins && options.plugins.ast) {
      for (var i = 0, l = options.plugins.ast.length; i < l; i++) {
        var transform = options.plugins.ast[i];
        var env = (0, _util.assign)({}, options, {
          syntax
        }, {
          plugins: undefined
        });
        var pluginResult = transform(env);
        traverse(program, pluginResult.visitor);
      }
    }
    return program;
  }
  class SymbolTable {
    static top(locals, customizeComponentName) {
      return new ProgramSymbolTable(locals, customizeComponentName);
    }
    child(locals) {
      var symbols = locals.map(name => this.allocate(name));
      return new BlockSymbolTable(this, locals, symbols);
    }
  }
  _exports.SymbolTable = SymbolTable;
  class ProgramSymbolTable extends SymbolTable {
    constructor(templateLocals, customizeComponentName) {
      super();
      this.templateLocals = templateLocals;
      this.customizeComponentName = customizeComponentName;
      this.symbols = [];
      this.upvars = [];
      this.size = 1;
      this.named = (0, _util.dict)();
      this.blocks = (0, _util.dict)();
      this.usedTemplateLocals = [];
      this._hasEval = false;
    }
    getUsedTemplateLocals() {
      return this.usedTemplateLocals;
    }
    setHasEval() {
      this._hasEval = true;
    }
    get hasEval() {
      return this._hasEval;
    }
    has(name) {
      return this.templateLocals.indexOf(name) !== -1;
    }
    get(name) {
      var index = this.usedTemplateLocals.indexOf(name);
      if (index !== -1) {
        return [index, true];
      }
      index = this.usedTemplateLocals.length;
      this.usedTemplateLocals.push(name);
      return [index, true];
    }
    getLocalsMap() {
      return (0, _util.dict)();
    }
    getEvalInfo() {
      var locals = this.getLocalsMap();
      return Object.keys(locals).map(symbol => locals[symbol]);
    }
    allocateFree(name, resolution) {
      // If the name in question is an uppercase (i.e. angle-bracket) component invocation, run
      // the optional `customizeComponentName` function provided to the precompiler.
      if (resolution.resolution() === 39
      /* GetFreeAsComponentHead */ && resolution.isAngleBracket && isUpperCase(name)) {
        name = this.customizeComponentName(name);
      }
      var index = this.upvars.indexOf(name);
      if (index !== -1) {
        return index;
      }
      index = this.upvars.length;
      this.upvars.push(name);
      return index;
    }
    allocateNamed(name) {
      var named = this.named[name];
      if (!named) {
        named = this.named[name] = this.allocate(name);
      }
      return named;
    }
    allocateBlock(name) {
      if (name === 'inverse') {
        name = 'else';
      }
      var block = this.blocks[name];
      if (!block) {
        block = this.blocks[name] = this.allocate("&" + name);
      }
      return block;
    }
    allocate(identifier) {
      this.symbols.push(identifier);
      return this.size++;
    }
  }
  _exports.ProgramSymbolTable = ProgramSymbolTable;
  class BlockSymbolTable extends SymbolTable {
    constructor(parent, symbols, slots) {
      super();
      this.parent = parent;
      this.symbols = symbols;
      this.slots = slots;
    }
    get locals() {
      return this.symbols;
    }
    has(name) {
      return this.symbols.indexOf(name) !== -1 || this.parent.has(name);
    }
    get(name) {
      var slot = this.symbols.indexOf(name);
      return slot === -1 ? this.parent.get(name) : [this.slots[slot], false];
    }
    getLocalsMap() {
      var dict = this.parent.getLocalsMap();
      this.symbols.forEach(symbol => dict[symbol] = this.get(symbol)[0]);
      return dict;
    }
    getEvalInfo() {
      var locals = this.getLocalsMap();
      return Object.keys(locals).map(symbol => locals[symbol]);
    }
    setHasEval() {
      this.parent.setHasEval();
    }
    allocateFree(name, resolution) {
      return this.parent.allocateFree(name, resolution);
    }
    allocateNamed(name) {
      return this.parent.allocateNamed(name);
    }
    allocateBlock(name) {
      return this.parent.allocateBlock(name);
    }
    allocate(identifier) {
      return this.parent.allocate(identifier);
    }
  }
  _exports.BlockSymbolTable = BlockSymbolTable;
  var __rest = undefined && undefined.__rest || function (s, e) {
    var t = {};
    for (var p in s) {
      if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0) t[p] = s[p];
    }
    if (s != null && typeof Object.getOwnPropertySymbols === "function") for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
      if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i])) t[p[i]] = s[p[i]];
    }
    return t;
  };
  class Builder {
    // TEMPLATE //
    template(symbols, body, loc) {
      return new Template({
        table: symbols,
        body,
        loc
      });
    } // INTERNAL (these nodes cannot be reached when doing general-purpose visiting) //

    block(symbols, body, loc) {
      return new Block({
        scope: symbols,
        body,
        loc
      });
    }
    namedBlock(name, block, loc) {
      return new NamedBlock({
        name,
        block,
        attrs: [],
        componentArgs: [],
        modifiers: [],
        loc
      });
    }
    simpleNamedBlock(name, block, loc) {
      return new BuildElement({
        selfClosing: false,
        attrs: [],
        componentArgs: [],
        modifiers: [],
        comments: []
      }).named(name, block, loc);
    }
    slice(chars, loc) {
      return new SourceSlice({
        loc,
        chars
      });
    }
    args(positional, named, loc) {
      return new Args({
        loc,
        positional,
        named
      });
    }
    positional(exprs, loc) {
      return new PositionalArguments({
        loc,
        exprs
      });
    }
    namedArgument(key, value) {
      return new NamedArgument({
        name: key,
        value
      });
    }
    named(entries, loc) {
      return new NamedArguments({
        loc,
        entries
      });
    }
    attr(_ref28, loc) {
      var {
        name,
        value,
        trusting
      } = _ref28;
      return new HtmlAttr({
        loc,
        name,
        value,
        trusting
      });
    }
    splatAttr(symbol, loc) {
      return new SplatAttr({
        symbol,
        loc
      });
    }
    arg(_ref29, loc) {
      var {
        name,
        value,
        trusting
      } = _ref29;
      return new ComponentArg({
        name,
        value,
        trusting,
        loc
      });
    } // EXPRESSIONS //

    path(head, tail, loc) {
      return new PathExpression({
        loc,
        ref: head,
        tail
      });
    }
    self(loc) {
      return new ThisReference({
        loc
      });
    }
    at(name, symbol, loc) {
      return new ArgReference({
        loc,
        name: new SourceSlice({
          loc,
          chars: name
        }),
        symbol
      });
    }
    freeVar(_ref30) {
      var {
        name,
        context,
        symbol,
        loc
      } = _ref30;
      return new FreeVarReference({
        name,
        resolution: context,
        symbol,
        loc
      });
    }
    localVar(name, symbol, isTemplateLocal, loc) {
      return new LocalVarReference({
        loc,
        name,
        isTemplateLocal,
        symbol
      });
    }
    sexp(parts, loc) {
      return new CallExpression({
        loc,
        callee: parts.callee,
        args: parts.args
      });
    }
    deprecatedCall(arg, callee, loc) {
      return new DeprecatedCallExpression({
        loc,
        arg,
        callee
      });
    }
    interpolate(parts, loc) {
      (0, _util.assertPresent)(parts);
      return new InterpolateExpression({
        loc,
        parts
      });
    }
    literal(value, loc) {
      return new LiteralExpression({
        loc,
        value
      });
    } // STATEMENTS //

    append(_ref31, loc) {
      var {
        table,
        trusting,
        value
      } = _ref31;
      return new AppendContent({
        table,
        trusting,
        value,
        loc
      });
    }
    modifier(_ref32, loc) {
      var {
        callee,
        args
      } = _ref32;
      return new ElementModifier({
        loc,
        callee,
        args
      });
    }
    namedBlocks(blocks, loc) {
      return new NamedBlocks({
        loc,
        blocks
      });
    }
    blockStatement(_a, loc) {
      var {
          symbols,
          program,
          inverse = null
        } = _a,
        call = __rest(_a, ["symbols", "program", "inverse"]);
      var blocksLoc = program.loc;
      var blocks = [this.namedBlock(SourceSlice.synthetic('default'), program, program.loc)];
      if (inverse) {
        blocksLoc = blocksLoc.extend(inverse.loc);
        blocks.push(this.namedBlock(SourceSlice.synthetic('else'), inverse, inverse.loc));
      }
      return new InvokeBlock({
        loc,
        blocks: this.namedBlocks(blocks, blocksLoc),
        callee: call.callee,
        args: call.args
      });
    }
    element(options) {
      return new BuildElement(options);
    }
  }
  class BuildElement {
    constructor(base) {
      this.base = base;
      this.builder = new Builder();
    }
    simple(tag, body, loc) {
      return new SimpleElement((0, _util.assign)({
        tag,
        body,
        componentArgs: [],
        loc
      }, this.base));
    }
    named(name, block, loc) {
      return new NamedBlock((0, _util.assign)({
        name,
        block,
        componentArgs: [],
        loc
      }, this.base));
    }
    selfClosingComponent(callee, loc) {
      return new InvokeComponent((0, _util.assign)({
        loc,
        callee,
        // point the empty named blocks at the `/` self-closing tag
        blocks: new NamedBlocks({
          blocks: [],
          loc: loc.sliceEndChars({
            skipEnd: 1,
            chars: 1
          })
        })
      }, this.base));
    }
    componentWithDefaultBlock(callee, children, symbols, loc) {
      var block = this.builder.block(symbols, children, loc);
      var namedBlock = this.builder.namedBlock(SourceSlice.synthetic('default'), block, loc); // BUILDER.simpleNamedBlock('default', children, symbols, loc);

      return new InvokeComponent((0, _util.assign)({
        loc,
        callee,
        blocks: this.builder.namedBlocks([namedBlock], namedBlock.loc)
      }, this.base));
    }
    componentWithNamedBlocks(callee, blocks, loc) {
      return new InvokeComponent((0, _util.assign)({
        loc,
        callee,
        blocks: this.builder.namedBlocks(blocks, SpanList.range(blocks))
      }, this.base));
    }
  }
  function SexpSyntaxContext(node) {
    if (isSimpleCallee(node)) {
      return LooseModeResolution.namespaced("Helper"
      /* Helper */);
    } else {
      return null;
    }
  }
  function ModifierSyntaxContext(node) {
    if (isSimpleCallee(node)) {
      return LooseModeResolution.namespaced("Modifier"
      /* Modifier */);
    } else {
      return null;
    }
  }
  function BlockSyntaxContext(node) {
    if (isSimpleCallee(node)) {
      return LooseModeResolution.namespaced("Component"
      /* Component */);
    } else {
      return LooseModeResolution.fallback();
    }
  }
  function ComponentSyntaxContext(node) {
    if (isSimplePath(node)) {
      return LooseModeResolution.namespaced("Component"
      /* Component */, true);
    } else {
      return null;
    }
  }
  /**
   * This corresponds to append positions (text curlies or attribute
   * curlies). In strict mode, this also corresponds to arg curlies.
   */

  function AttrValueSyntaxContext(node) {
    var isSimple = isSimpleCallee(node);
    var isInvoke = isInvokeNode(node);
    if (isSimple) {
      return isInvoke ? LooseModeResolution.namespaced("Helper"
      /* Helper */) : LooseModeResolution.attr();
    } else {
      return isInvoke ? STRICT_RESOLUTION : LooseModeResolution.fallback();
    }
  }
  /**
   * This corresponds to append positions (text curlies or attribute
   * curlies). In strict mode, this also corresponds to arg curlies.
   */

  function AppendSyntaxContext(node) {
    var isSimple = isSimpleCallee(node);
    var isInvoke = isInvokeNode(node);
    var trusting = node.trusting;
    if (isSimple) {
      return trusting ? LooseModeResolution.trustingAppend({
        invoke: isInvoke
      }) : LooseModeResolution.append({
        invoke: isInvoke
      });
    } else {
      return LooseModeResolution.fallback();
    }
  } // UTILITIES

  /**
   * A call node has a simple callee if its head is:
   *
   * - a `PathExpression`
   * - the `PathExpression`'s head is a `VarHead`
   * - it has no tail
   *
   * Simple heads:
   *
   * ```
   * {{x}}
   * {{x y}}
   * ```
   *
   * Not simple heads:
   *
   * ```
   * {{x.y}}
   * {{x.y z}}
   * {{@x}}
   * {{@x a}}
   * {{this}}
   * {{this a}}
   * ```
   */

  function isSimpleCallee(node) {
    var path = node.path;
    return isSimplePath(path);
  }
  function isSimplePath(node) {
    if (node.type === 'PathExpression' && node.head.type === 'VarHead') {
      return node.tail.length === 0;
    } else {
      return false;
    }
  }
  /**
   * The call expression has at least one argument.
   */

  function isInvokeNode(node) {
    return node.params.length > 0 || node.hash.pairs.length > 0;
  }
  function normalize(source, options) {
    if (options === void 0) {
      options = {};
    }
    var _a;
    var ast = preprocess(source, options);
    var normalizeOptions = (0, _util.assign)({
      strictMode: false,
      locals: []
    }, options);
    var top = SymbolTable.top(normalizeOptions.locals, (_a =
    // eslint-disable-next-line @typescript-eslint/unbound-method
    options.customizeComponentName) !== null && _a !== void 0 ? _a : name => name);
    var block = new BlockContext(source, normalizeOptions, top);
    var normalizer = new StatementNormalizer(block);
    var astV2 = new TemplateChildren(block.loc(ast.loc), ast.body.map(b => normalizer.normalize(b)), block).assertTemplate(top);
    var locals = top.getUsedTemplateLocals();
    return [astV2, locals];
  }
  /**
   * A `BlockContext` represents the block that a particular AST node is contained inside of.
   *
   * `BlockContext` is aware of template-wide options (such as strict mode), as well as the bindings
   * that are in-scope within that block.
   *
   * Concretely, it has the `PrecompileOptions` and current `SymbolTable`, and provides
   * facilities for working with those options.
   *
   * `BlockContext` is stateless.
   */

  class BlockContext {
    constructor(source, options, table) {
      this.source = source;
      this.options = options;
      this.table = table;
      this.builder = new Builder();
    }
    get strict() {
      return this.options.strictMode || false;
    }
    loc(loc) {
      return this.source.spanFor(loc);
    }
    resolutionFor(node, resolution) {
      if (this.strict) {
        return {
          resolution: STRICT_RESOLUTION
        };
      }
      if (this.isFreeVar(node)) {
        var r = resolution(node);
        if (r === null) {
          return {
            resolution: 'error',
            path: printPath(node),
            head: printHead(node)
          };
        }
        return {
          resolution: r
        };
      } else {
        return {
          resolution: STRICT_RESOLUTION
        };
      }
    }
    isFreeVar(callee) {
      if (callee.type === 'PathExpression') {
        if (callee.head.type !== 'VarHead') {
          return false;
        }
        return !this.table.has(callee.head.name);
      } else if (callee.path.type === 'PathExpression') {
        return this.isFreeVar(callee.path);
      } else {
        return false;
      }
    }
    hasBinding(name) {
      return this.table.has(name);
    }
    child(blockParams) {
      return new BlockContext(this.source, this.options, this.table.child(blockParams));
    }
    customizeComponentName(input) {
      if (this.options.customizeComponentName) {
        return this.options.customizeComponentName(input);
      } else {
        return input;
      }
    }
  }
  /**
   * An `ExpressionNormalizer` normalizes expressions within a block.
   *
   * `ExpressionNormalizer` is stateless.
   */

  class ExpressionNormalizer {
    constructor(block) {
      this.block = block;
    }
    normalize(expr, resolution) {
      switch (expr.type) {
        case 'NullLiteral':
        case 'BooleanLiteral':
        case 'NumberLiteral':
        case 'StringLiteral':
        case 'UndefinedLiteral':
          return this.block.builder.literal(expr.value, this.block.loc(expr.loc));
        case 'PathExpression':
          return this.path(expr, resolution);
        case 'SubExpression':
          {
            var _resolution = this.block.resolutionFor(expr, SexpSyntaxContext);
            if (_resolution.resolution === 'error') {
              throw generateSyntaxError("You attempted to invoke a path (`" + _resolution.path + "`) but " + _resolution.head + " was not in scope", expr.loc);
            }
            return this.block.builder.sexp(this.callParts(expr, _resolution.resolution), this.block.loc(expr.loc));
          }
      }
    }
    path(expr, resolution) {
      var headOffsets = this.block.loc(expr.head.loc);
      var tail = []; // start with the head

      var offset = headOffsets;
      for (var part of expr.tail) {
        offset = offset.sliceStartChars({
          chars: part.length,
          skipStart: 1
        });
        tail.push(new SourceSlice({
          loc: offset,
          chars: part
        }));
      }
      return this.block.builder.path(this.ref(expr.head, resolution), tail, this.block.loc(expr.loc));
    }
    /**
     * The `callParts` method takes ASTv1.CallParts as well as a syntax context and normalizes
     * it to an ASTv2 CallParts.
     */

    callParts(parts, context) {
      var {
        path,
        params,
        hash
      } = parts;
      var callee = this.normalize(path, context);
      var paramList = params.map(p => this.normalize(p, ARGUMENT_RESOLUTION));
      var paramLoc = SpanList.range(paramList, callee.loc.collapse('end'));
      var namedLoc = this.block.loc(hash.loc);
      var argsLoc = SpanList.range([paramLoc, namedLoc]);
      var positional = this.block.builder.positional(params.map(p => this.normalize(p, ARGUMENT_RESOLUTION)), paramLoc);
      var named = this.block.builder.named(hash.pairs.map(p => this.namedArgument(p)), this.block.loc(hash.loc));
      return {
        callee,
        args: this.block.builder.args(positional, named, argsLoc)
      };
    }
    namedArgument(pair) {
      var offsets = this.block.loc(pair.loc);
      var keyOffsets = offsets.sliceStartChars({
        chars: pair.key.length
      });
      return this.block.builder.namedArgument(new SourceSlice({
        chars: pair.key,
        loc: keyOffsets
      }), this.normalize(pair.value, ARGUMENT_RESOLUTION));
    }
    /**
     * The `ref` method normalizes an `ASTv1.PathHead` into an `ASTv2.VariableReference`.
     * This method is extremely important, because it is responsible for normalizing free
     * variables into an an ASTv2.PathHead *with appropriate context*.
     *
     * The syntax context is originally determined by the syntactic position that this `PathHead`
     * came from, and is ultimately attached to the `ASTv2.VariableReference` here. In ASTv2,
     * the `VariableReference` node bears full responsibility for loose mode rules that control
     * the behavior of free variables.
     */

    ref(head, resolution) {
      var {
        block
      } = this;
      var {
        builder,
        table
      } = block;
      var offsets = block.loc(head.loc);
      switch (head.type) {
        case 'ThisHead':
          return builder.self(offsets);
        case 'AtHead':
          {
            var symbol = table.allocateNamed(head.name);
            return builder.at(head.name, symbol, offsets);
          }
        case 'VarHead':
          {
            if (block.hasBinding(head.name)) {
              var [_symbol, isRoot] = table.get(head.name);
              return block.builder.localVar(head.name, _symbol, isRoot, offsets);
            } else {
              var context = block.strict ? STRICT_RESOLUTION : resolution;
              var _symbol2 = block.table.allocateFree(head.name, context);
              return block.builder.freeVar({
                name: head.name,
                context,
                symbol: _symbol2,
                loc: offsets
              });
            }
          }
      }
    }
  }
  /**
   * `TemplateNormalizer` normalizes top-level ASTv1 statements to ASTv2.
   */

  class StatementNormalizer {
    constructor(block) {
      this.block = block;
    }
    normalize(node) {
      switch (node.type) {
        case 'PartialStatement':
          throw new Error("Handlebars partial syntax ({{> ...}}) is not allowed in Glimmer");
        case 'BlockStatement':
          return this.BlockStatement(node);
        case 'ElementNode':
          return new ElementNormalizer(this.block).ElementNode(node);
        case 'MustacheStatement':
          return this.MustacheStatement(node);
        // These are the same in ASTv2

        case 'MustacheCommentStatement':
          return this.MustacheCommentStatement(node);
        case 'CommentStatement':
          {
            var _loc3 = this.block.loc(node.loc);
            return new HtmlComment({
              loc: _loc3,
              text: _loc3.slice({
                skipStart: 4,
                skipEnd: 3
              }).toSlice(node.value)
            });
          }
        case 'TextNode':
          return new HtmlText({
            loc: this.block.loc(node.loc),
            chars: node.chars
          });
      }
    }
    MustacheCommentStatement(node) {
      var loc = this.block.loc(node.loc);
      var textLoc;
      if (loc.asString().slice(0, 5) === '{{!--') {
        textLoc = loc.slice({
          skipStart: 5,
          skipEnd: 4
        });
      } else {
        textLoc = loc.slice({
          skipStart: 3,
          skipEnd: 2
        });
      }
      return new GlimmerComment({
        loc,
        text: textLoc.toSlice(node.value)
      });
    }
    /**
     * Normalizes an ASTv1.MustacheStatement to an ASTv2.AppendStatement
     */

    MustacheStatement(mustache) {
      var {
        escaped
      } = mustache;
      var loc = this.block.loc(mustache.loc); // Normalize the call parts in AppendSyntaxContext

      var callParts = this.expr.callParts({
        path: mustache.path,
        params: mustache.params,
        hash: mustache.hash
      }, AppendSyntaxContext(mustache));
      var value = callParts.args.isEmpty() ? callParts.callee : this.block.builder.sexp(callParts, loc);
      return this.block.builder.append({
        table: this.block.table,
        trusting: !escaped,
        value
      }, loc);
    }
    /**
     * Normalizes a ASTv1.BlockStatement to an ASTv2.BlockStatement
     */

    BlockStatement(block) {
      var {
        program,
        inverse
      } = block;
      var loc = this.block.loc(block.loc);
      var resolution = this.block.resolutionFor(block, BlockSyntaxContext);
      if (resolution.resolution === 'error') {
        throw generateSyntaxError("You attempted to invoke a path (`{{#" + resolution.path + "}}`) but " + resolution.head + " was not in scope", loc);
      }
      var callParts = this.expr.callParts(block, resolution.resolution);
      return this.block.builder.blockStatement((0, _util.assign)({
        symbols: this.block.table,
        program: this.Block(program),
        inverse: inverse ? this.Block(inverse) : null
      }, callParts), loc);
    }
    Block(_ref33) {
      var {
        body,
        loc,
        blockParams
      } = _ref33;
      var child = this.block.child(blockParams);
      var normalizer = new StatementNormalizer(child);
      return new BlockChildren(this.block.loc(loc), body.map(b => normalizer.normalize(b)), this.block).assertBlock(child.table);
    }
    get expr() {
      return new ExpressionNormalizer(this.block);
    }
  }
  class ElementNormalizer {
    constructor(ctx) {
      this.ctx = ctx;
    }
    /**
     * Normalizes an ASTv1.ElementNode to:
     *
     * - ASTv2.NamedBlock if the tag name begins with `:`
     * - ASTv2.Component if the tag name matches the component heuristics
     * - ASTv2.SimpleElement if the tag name doesn't match the component heuristics
     *
     * A tag name represents a component if:
     *
     * - it begins with `@`
     * - it is exactly `this` or begins with `this.`
     * - the part before the first `.` is a reference to an in-scope variable binding
     * - it begins with an uppercase character
     */

    ElementNode(element) {
      var {
        tag,
        selfClosing,
        comments
      } = element;
      var loc = this.ctx.loc(element.loc);
      var [tagHead, ...rest] = tag.split('.'); // the head, attributes and modifiers are in the current scope

      var path = this.classifyTag(tagHead, rest, element.loc);
      var attrs = element.attributes.filter(a => a.name[0] !== '@').map(a => this.attr(a));
      var args = element.attributes.filter(a => a.name[0] === '@').map(a => this.arg(a));
      var modifiers = element.modifiers.map(m => this.modifier(m)); // the element's block params are in scope for the children

      var child = this.ctx.child(element.blockParams);
      var normalizer = new StatementNormalizer(child);
      var childNodes = element.children.map(s => normalizer.normalize(s));
      var el = this.ctx.builder.element({
        selfClosing,
        attrs,
        componentArgs: args,
        modifiers,
        comments: comments.map(c => new StatementNormalizer(this.ctx).MustacheCommentStatement(c))
      });
      var children = new ElementChildren(el, loc, childNodes, this.ctx);
      var offsets = this.ctx.loc(element.loc);
      var tagOffsets = offsets.sliceStartChars({
        chars: tag.length,
        skipStart: 1
      });
      if (path === 'ElementHead') {
        if (tag[0] === ':') {
          return children.assertNamedBlock(tagOffsets.slice({
            skipStart: 1
          }).toSlice(tag.slice(1)), child.table);
        } else {
          return children.assertElement(tagOffsets.toSlice(tag), element.blockParams.length > 0);
        }
      }
      if (element.selfClosing) {
        return el.selfClosingComponent(path, loc);
      } else {
        var blocks = children.assertComponent(tag, child.table, element.blockParams.length > 0);
        return el.componentWithNamedBlocks(path, blocks, loc);
      }
    }
    modifier(m) {
      var resolution = this.ctx.resolutionFor(m, ModifierSyntaxContext);
      if (resolution.resolution === 'error') {
        throw generateSyntaxError("You attempted to invoke a path (`{{#" + resolution.path + "}}`) as a modifier, but " + resolution.head + " was not in scope. Try adding `this` to the beginning of the path", m.loc);
      }
      var callParts = this.expr.callParts(m, resolution.resolution);
      return this.ctx.builder.modifier(callParts, this.ctx.loc(m.loc));
    }
    /**
     * This method handles attribute values that are curlies, as well as curlies nested inside of
     * interpolations:
     *
     * ```hbs
     * <a href={{url}} />
     * <a href="{{url}}.html" />
     * ```
     */

    mustacheAttr(mustache) {
      // Normalize the call parts in AttrValueSyntaxContext
      var sexp = this.ctx.builder.sexp(this.expr.callParts(mustache, AttrValueSyntaxContext(mustache)), this.ctx.loc(mustache.loc)); // If there are no params or hash, just return the function part as its own expression

      if (sexp.args.isEmpty()) {
        return sexp.callee;
      } else {
        return sexp;
      }
    }
    /**
     * attrPart is the narrowed down list of valid attribute values that are also
     * allowed as a concat part (you can't nest concats).
     */

    attrPart(part) {
      switch (part.type) {
        case 'MustacheStatement':
          return {
            expr: this.mustacheAttr(part),
            trusting: !part.escaped
          };
        case 'TextNode':
          return {
            expr: this.ctx.builder.literal(part.chars, this.ctx.loc(part.loc)),
            trusting: true
          };
      }
    }
    attrValue(part) {
      switch (part.type) {
        case 'ConcatStatement':
          {
            var parts = part.parts.map(p => this.attrPart(p).expr);
            return {
              expr: this.ctx.builder.interpolate(parts, this.ctx.loc(part.loc)),
              trusting: false
            };
          }
        default:
          return this.attrPart(part);
      }
    }
    attr(m) {
      if (m.name === '...attributes') {
        return this.ctx.builder.splatAttr(this.ctx.table.allocateBlock('attrs'), this.ctx.loc(m.loc));
      }
      var offsets = this.ctx.loc(m.loc);
      var nameSlice = offsets.sliceStartChars({
        chars: m.name.length
      }).toSlice(m.name);
      var value = this.attrValue(m.value);
      return this.ctx.builder.attr({
        name: nameSlice,
        value: value.expr,
        trusting: value.trusting
      }, offsets);
    }
    maybeDeprecatedCall(arg, part) {
      if (this.ctx.strict) {
        return null;
      }
      if (part.type !== 'MustacheStatement') {
        return null;
      }
      var {
        path
      } = part;
      if (path.type !== 'PathExpression') {
        return null;
      }
      if (path.head.type !== 'VarHead') {
        return null;
      }
      var {
        name
      } = path.head;
      if (name === 'has-block' || name === 'has-block-params') {
        return null;
      }
      if (this.ctx.hasBinding(name)) {
        return null;
      }
      if (path.tail.length !== 0) {
        return null;
      }
      if (part.params.length !== 0 || part.hash.pairs.length !== 0) {
        return null;
      }
      var context = LooseModeResolution.attr();
      var callee = this.ctx.builder.freeVar({
        name,
        context,
        symbol: this.ctx.table.allocateFree(name, context),
        loc: path.loc
      });
      return {
        expr: this.ctx.builder.deprecatedCall(arg, callee, part.loc),
        trusting: false
      };
    }
    arg(arg) {
      var offsets = this.ctx.loc(arg.loc);
      var nameSlice = offsets.sliceStartChars({
        chars: arg.name.length
      }).toSlice(arg.name);
      var value = this.maybeDeprecatedCall(nameSlice, arg.value) || this.attrValue(arg.value);
      return this.ctx.builder.arg({
        name: nameSlice,
        value: value.expr,
        trusting: value.trusting
      }, offsets);
    }
    /**
     * This function classifies the head of an ASTv1.Element into an ASTv2.PathHead (if the
     * element is a component) or `'ElementHead'` (if the element is a simple element).
     *
     * Rules:
     *
     * 1. If the variable is an `@arg`, return an `AtHead`
     * 2. If the variable is `this`, return a `ThisHead`
     * 3. If the variable is in the current scope:
     *   a. If the scope is the root scope, then return a Free `LocalVarHead`
     *   b. Else, return a standard `LocalVarHead`
     * 4. If the tag name is a path and the variable is not in the current scope, Syntax Error
     * 5. If the variable is uppercase return a FreeVar(ResolveAsComponentHead)
     * 6. Otherwise, return `'ElementHead'`
     */

    classifyTag(variable, tail, loc) {
      var uppercase = isUpperCase(variable);
      var inScope = variable[0] === '@' || variable === 'this' || this.ctx.hasBinding(variable);
      if (this.ctx.strict && !inScope) {
        if (uppercase) {
          throw generateSyntaxError("Attempted to invoke a component that was not in scope in a strict mode template, `<" + variable + ">`. If you wanted to create an element with that name, convert it to lowercase - `<" + variable.toLowerCase() + ">`", loc);
        } // In strict mode, values are always elements unless they are in scope

        return 'ElementHead';
      } // Since the parser handed us the HTML element name as a string, we need
      // to convert it into an ASTv1 path so it can be processed using the
      // expression normalizer.

      var isComponent = inScope || uppercase;
      var variableLoc = loc.sliceStartChars({
        skipStart: 1,
        chars: variable.length
      });
      var tailLength = tail.reduce((accum, part) => accum + 1 + part.length, 0);
      var pathEnd = variableLoc.getEnd().move(tailLength);
      var pathLoc = variableLoc.withEnd(pathEnd);
      if (isComponent) {
        var path = b.path({
          head: b.head(variable, variableLoc),
          tail,
          loc: pathLoc
        });
        var resolution = this.ctx.resolutionFor(path, ComponentSyntaxContext);
        if (resolution.resolution === 'error') {
          throw generateSyntaxError("You attempted to invoke a path (`<" + resolution.path + ">`) but " + resolution.head + " was not in scope", loc);
        }
        return new ExpressionNormalizer(this.ctx).normalize(path, resolution.resolution);
      } // If the tag name wasn't a valid component but contained a `.`, it's
      // a syntax error.

      if (tail.length > 0) {
        throw generateSyntaxError("You used " + variable + "." + tail.join('.') + " as a tag name, but " + variable + " is not in scope", loc);
      }
      return 'ElementHead';
    }
    get expr() {
      return new ExpressionNormalizer(this.ctx);
    }
  }
  class Children {
    constructor(loc, children, block) {
      this.loc = loc;
      this.children = children;
      this.block = block;
      this.namedBlocks = children.filter(c => c instanceof NamedBlock);
      this.hasSemanticContent = Boolean(children.filter(c => {
        if (c instanceof NamedBlock) {
          return false;
        }
        switch (c.type) {
          case 'GlimmerComment':
          case 'HtmlComment':
            return false;
          case 'HtmlText':
            return !/^\s*$/.exec(c.chars);
          default:
            return true;
        }
      }).length);
      this.nonBlockChildren = children.filter(c => !(c instanceof NamedBlock));
    }
  }
  class TemplateChildren extends Children {
    assertTemplate(table) {
      if ((0, _util.isPresent)(this.namedBlocks)) {
        throw generateSyntaxError("Unexpected named block at the top-level of a template", this.loc);
      }
      return this.block.builder.template(table, this.nonBlockChildren, this.block.loc(this.loc));
    }
  }
  class BlockChildren extends Children {
    assertBlock(table) {
      if ((0, _util.isPresent)(this.namedBlocks)) {
        throw generateSyntaxError("Unexpected named block nested in a normal block", this.loc);
      }
      return this.block.builder.block(table, this.nonBlockChildren, this.loc);
    }
  }
  class ElementChildren extends Children {
    constructor(el, loc, children, block) {
      super(loc, children, block);
      this.el = el;
    }
    assertNamedBlock(name, table) {
      if (this.el.base.selfClosing) {
        throw generateSyntaxError("<:" + name.chars + "/> is not a valid named block: named blocks cannot be self-closing", this.loc);
      }
      if ((0, _util.isPresent)(this.namedBlocks)) {
        throw generateSyntaxError("Unexpected named block inside <:" + name.chars + "> named block: named blocks cannot contain nested named blocks", this.loc);
      }
      if (!isLowerCase(name.chars)) {
        throw generateSyntaxError("<:" + name.chars + "> is not a valid named block, and named blocks must begin with a lowercase letter", this.loc);
      }
      if (this.el.base.attrs.length > 0 || this.el.base.componentArgs.length > 0 || this.el.base.modifiers.length > 0) {
        throw generateSyntaxError("named block <:" + name.chars + "> cannot have attributes, arguments, or modifiers", this.loc);
      }
      var offsets = SpanList.range(this.nonBlockChildren, this.loc);
      return this.block.builder.namedBlock(name, this.block.builder.block(table, this.nonBlockChildren, offsets), this.loc);
    }
    assertElement(name, hasBlockParams) {
      if (hasBlockParams) {
        throw generateSyntaxError("Unexpected block params in <" + name + ">: simple elements cannot have block params", this.loc);
      }
      if ((0, _util.isPresent)(this.namedBlocks)) {
        var names = this.namedBlocks.map(b => b.name);
        if (names.length === 1) {
          throw generateSyntaxError("Unexpected named block <:foo> inside <" + name.chars + "> HTML element", this.loc);
        } else {
          var printedNames = names.map(n => "<:" + n.chars + ">").join(', ');
          throw generateSyntaxError("Unexpected named blocks inside <" + name.chars + "> HTML element (" + printedNames + ")", this.loc);
        }
      }
      return this.el.simple(name, this.nonBlockChildren, this.loc);
    }
    assertComponent(name, table, hasBlockParams) {
      if ((0, _util.isPresent)(this.namedBlocks) && this.hasSemanticContent) {
        throw generateSyntaxError("Unexpected content inside <" + name + "> component invocation: when using named blocks, the tag cannot contain other content", this.loc);
      }
      if ((0, _util.isPresent)(this.namedBlocks)) {
        if (hasBlockParams) {
          throw generateSyntaxError("Unexpected block params list on <" + name + "> component invocation: when passing named blocks, the invocation tag cannot take block params", this.loc);
        }
        var seenNames = new Set();
        for (var block of this.namedBlocks) {
          var _name = block.name.chars;
          if (seenNames.has(_name)) {
            throw generateSyntaxError("Component had two named blocks with the same name, `<:" + _name + ">`. Only one block with a given name may be passed", this.loc);
          }
          if (_name === 'inverse' && seenNames.has('else') || _name === 'else' && seenNames.has('inverse')) {
            throw generateSyntaxError("Component has both <:else> and <:inverse> block. <:inverse> is an alias for <:else>", this.loc);
          }
          seenNames.add(_name);
        }
        return this.namedBlocks;
      } else {
        return [this.block.builder.namedBlock(SourceSlice.synthetic('default'), this.block.builder.block(table, this.nonBlockChildren, this.loc), this.loc)];
      }
    }
  }
  function printPath(node) {
    if (node.type !== 'PathExpression' && node.path.type === 'PathExpression') {
      return printPath(node.path);
    } else {
      return new Printer({
        entityEncoding: 'raw'
      }).print(node);
    }
  }
  function printHead(node) {
    if (node.type === 'PathExpression') {
      switch (node.head.type) {
        case 'AtHead':
        case 'VarHead':
          return node.head.name;
        case 'ThisHead':
          return 'this';
      }
    } else if (node.path.type === 'PathExpression') {
      return printHead(node.path);
    } else {
      return new Printer({
        entityEncoding: 'raw'
      }).print(node);
    }
  }
  function isKeyword(word) {
    return word in KEYWORDS_TYPES;
  }
  /**
   * This includes the full list of keywords currently in use in the template
   * language, and where their valid usages are.
   */

  var KEYWORDS_TYPES = {
    component: ['Call', 'Append', 'Block'],
    debugger: ['Append'],
    'each-in': ['Block'],
    each: ['Block'],
    'has-block-params': ['Call', 'Append'],
    'has-block': ['Call', 'Append'],
    helper: ['Call', 'Append'],
    if: ['Call', 'Append', 'Block'],
    'in-element': ['Block'],
    let: ['Block'],
    'link-to': ['Append', 'Block'],
    log: ['Call', 'Append'],
    modifier: ['Call'],
    mount: ['Append'],
    mut: ['Call', 'Append'],
    outlet: ['Append'],
    'query-params': ['Call'],
    readonly: ['Call', 'Append'],
    unbound: ['Call', 'Append'],
    unless: ['Call', 'Append', 'Block'],
    with: ['Block'],
    yield: ['Append']
  };

  /**
   * Gets the correct Token from the Node based on it's type
   */
  _exports.KEYWORDS_TYPES = KEYWORDS_TYPES;
  function tokensFromType(node, scopedTokens, options) {
    if (node.type === 'PathExpression') {
      if (node.head.type === 'AtHead' || node.head.type === 'ThisHead') {
        return;
      }
      var possbleToken = node.head.name;
      if (scopedTokens.indexOf(possbleToken) === -1) {
        return possbleToken;
      }
    } else if (node.type === 'ElementNode') {
      var {
        tag
      } = node;
      var char = tag.charAt(0);
      if (char === ':' || char === '@') {
        return;
      }
      if (!options.includeHtmlElements && tag.indexOf('.') === -1 && tag.toLowerCase() === tag) {
        return;
      }
      if (tag.substr(0, 5) === 'this.') {
        return;
      }
      if (scopedTokens.indexOf(tag) !== -1) {
        return;
      }
      return tag;
    }
  }
  /**
   * Adds tokens to the tokensSet based on their node.type
   */

  function addTokens(tokensSet, node, scopedTokens, options) {
    var maybeTokens = tokensFromType(node, scopedTokens, options);
    (Array.isArray(maybeTokens) ? maybeTokens : [maybeTokens]).forEach(maybeToken => {
      if (maybeToken !== undefined && maybeToken[0] !== '@') {
        tokensSet.add(maybeToken.split('.')[0]);
      }
    });
  }
  /**
   * Parses and traverses a given handlebars html template to extract all template locals
   * referenced that could possible come from the praent scope. Can exclude known keywords
   * optionally.
   */

  function getTemplateLocals(html, options) {
    if (options === void 0) {
      options = {
        includeHtmlElements: false,
        includeKeywords: false
      };
    }
    var ast = preprocess(html);
    var tokensSet = new Set();
    var scopedTokens = [];
    traverse(ast, {
      Block: {
        enter(_ref34) {
          var {
            blockParams
          } = _ref34;
          blockParams.forEach(param => {
            scopedTokens.push(param);
          });
        },
        exit(_ref35) {
          var {
            blockParams
          } = _ref35;
          blockParams.forEach(() => {
            scopedTokens.pop();
          });
        }
      },
      ElementNode: {
        enter(node) {
          node.blockParams.forEach(param => {
            scopedTokens.push(param);
          });
          addTokens(tokensSet, node, scopedTokens, options);
        },
        exit(_ref36) {
          var {
            blockParams
          } = _ref36;
          blockParams.forEach(() => {
            scopedTokens.pop();
          });
        }
      },
      PathExpression(node) {
        addTokens(tokensSet, node, scopedTokens, options);
      }
    });
    var tokens = [];
    tokensSet.forEach(s => tokens.push(s));
    if (!(options === null || options === void 0 ? void 0 : options.includeKeywords)) {
      tokens = tokens.filter(token => !isKeyword(token));
    }
    return tokens;
  }
});
define("@glimmer/util", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports._WeakSet = _exports.Stack = _exports.SERIALIZATION_FIRST_NODE_STRING = _exports.LOGGER = _exports.LOCAL_LOGGER = _exports.HAS_NATIVE_SYMBOL = _exports.HAS_NATIVE_PROXY = _exports.EMPTY_STRING_ARRAY = _exports.EMPTY_NUMBER_ARRAY = _exports.EMPTY_ARRAY = void 0;
  _exports.assert = debugAssert;
  _exports.assertNever = assertNever;
  _exports.assertPresent = assertPresent;
  _exports.beginTestSteps = _exports.assign = void 0;
  _exports.buildUntouchableThis = buildUntouchableThis;
  _exports.castToBrowser = castToBrowser;
  _exports.castToSimple = castToSimple;
  _exports.checkNode = checkNode;
  _exports.clearElement = clearElement;
  _exports.constants = constants;
  _exports.debugToString = void 0;
  _exports.decodeHandle = decodeHandle;
  _exports.decodeImmediate = decodeImmediate;
  _exports.decodeNegative = decodeNegative;
  _exports.decodePositive = decodePositive;
  _exports.deprecate = deprecate;
  _exports.dict = dict;
  _exports.emptyArray = emptyArray;
  _exports.encodeHandle = encodeHandle;
  _exports.encodeImmediate = encodeImmediate;
  _exports.encodeNegative = encodeNegative;
  _exports.encodePositive = encodePositive;
  _exports.endTestSteps = void 0;
  _exports.enumerableSymbol = enumerableSymbol;
  _exports.exhausted = exhausted;
  _exports.expect = expect;
  _exports.extractHandle = extractHandle;
  _exports.fillNulls = fillNulls;
  _exports.ifPresent = ifPresent;
  _exports.intern = intern;
  _exports.isDict = isDict;
  _exports.isEmptyArray = isEmptyArray;
  _exports.isErrHandle = isErrHandle;
  _exports.isHandle = isHandle;
  _exports.isNonPrimitiveHandle = isNonPrimitiveHandle;
  _exports.isObject = isObject;
  _exports.isOkHandle = isOkHandle;
  _exports.isPresent = isPresent;
  _exports.isSerializationFirstNode = isSerializationFirstNode;
  _exports.isSmallInt = isSmallInt;
  _exports.keys = keys;
  _exports.logStep = void 0;
  _exports.mapPresent = mapPresent;
  _exports.strip = strip;
  _exports.symbol = void 0;
  _exports.toPresentOption = toPresentOption;
  _exports.tuple = void 0;
  _exports.unreachable = unreachable;
  _exports.unwrap = unwrap;
  _exports.unwrapHandle = unwrapHandle;
  _exports.unwrapTemplate = unwrapTemplate;
  _exports.values = values;
  _exports.verifySteps = void 0;
  var EMPTY_ARRAY = Object.freeze([]);
  _exports.EMPTY_ARRAY = EMPTY_ARRAY;
  function emptyArray() {
    return EMPTY_ARRAY;
  }
  var EMPTY_STRING_ARRAY = emptyArray();
  _exports.EMPTY_STRING_ARRAY = EMPTY_STRING_ARRAY;
  var EMPTY_NUMBER_ARRAY = emptyArray();
  /**
   * This function returns `true` if the input array is the special empty array sentinel,
   * which is sometimes used for optimizations.
   */
  _exports.EMPTY_NUMBER_ARRAY = EMPTY_NUMBER_ARRAY;
  function isEmptyArray(input) {
    return input === EMPTY_ARRAY;
  }

  // import Logger from './logger';

  function debugAssert(test, msg) {
    // if (!alreadyWarned) {
    //   alreadyWarned = true;
    //   Logger.warn("Don't leave debug assertions on in public builds");
    // }
    if (!test) {
      throw new Error(msg || 'assertion failure');
    }
  }
  function deprecate(desc) {
    LOCAL_LOGGER.warn("DEPRECATION: " + desc);
  }
  function dict() {
    return Object.create(null);
  }
  function isDict(u) {
    return u !== null && u !== undefined;
  }
  function isObject(u) {
    return typeof u === 'function' || typeof u === 'object' && u !== null;
  }
  class StackImpl {
    constructor(values) {
      if (values === void 0) {
        values = [];
      }
      this.current = null;
      this.stack = values;
    }
    get size() {
      return this.stack.length;
    }
    push(item) {
      this.current = item;
      this.stack.push(item);
    }
    pop() {
      var item = this.stack.pop();
      var len = this.stack.length;
      this.current = len === 0 ? null : this.stack[len - 1];
      return item === undefined ? null : item;
    }
    nth(from) {
      var len = this.stack.length;
      return len < from ? null : this.stack[len - from];
    }
    isEmpty() {
      return this.stack.length === 0;
    }
    toArray() {
      return this.stack;
    }
  }
  _exports.Stack = StackImpl;
  function clearElement(parent) {
    var current = parent.firstChild;
    while (current) {
      var next = current.nextSibling;
      parent.removeChild(current);
      current = next;
    }
  }
  var SERIALIZATION_FIRST_NODE_STRING = '%+b:0%';
  _exports.SERIALIZATION_FIRST_NODE_STRING = SERIALIZATION_FIRST_NODE_STRING;
  function isSerializationFirstNode(node) {
    return node.nodeValue === SERIALIZATION_FIRST_NODE_STRING;
  }
  var assign = Object.assign;
  _exports.assign = assign;
  function fillNulls(count) {
    var arr = new Array(count);
    for (var i = 0; i < count; i++) {
      arr[i] = null;
    }
    return arr;
  }
  function values(obj) {
    var vals = [];
    for (var key in obj) {
      vals.push(obj[key]);
    }
    return vals;
  }

  /**
    Strongly hint runtimes to intern the provided string.

    When do I need to use this function?

    For the most part, never. Pre-mature optimization is bad, and often the
    runtime does exactly what you need it to, and more often the trade-off isn't
    worth it.

    Why?

    Runtimes store strings in at least 2 different representations:
    Ropes and Symbols (interned strings). The Rope provides a memory efficient
    data-structure for strings created from concatenation or some other string
    manipulation like splitting.

    Unfortunately checking equality of different ropes can be quite costly as
    runtimes must resort to clever string comparison algorithms. These
    algorithms typically cost in proportion to the length of the string.
    Luckily, this is where the Symbols (interned strings) shine. As Symbols are
    unique by their string content, equality checks can be done by pointer
    comparison.

    How do I know if my string is a rope or symbol?

    Typically (warning general sweeping statement, but truthy in runtimes at
    present) static strings created as part of the JS source are interned.
    Strings often used for comparisons can be interned at runtime if some
    criteria are met.  One of these criteria can be the size of the entire rope.
    For example, in chrome 38 a rope longer then 12 characters will not
    intern, nor will segments of that rope.

    Some numbers: http://jsperf.com/eval-vs-keys/8

    Known Trick™

    @private
    @return {String} interned version of the provided string
  */
  function intern(str) {
    var obj = {};
    obj[str] = 1;
    for (var key in obj) {
      if (key === str) {
        return key;
      }
    }
    return str;
  }
  var HAS_NATIVE_PROXY = typeof Proxy === 'function';
  _exports.HAS_NATIVE_PROXY = HAS_NATIVE_PROXY;
  var HAS_NATIVE_SYMBOL = function () {
    if (typeof Symbol !== 'function') {
      return false;
    } // eslint-disable-next-line symbol-description

    return typeof Symbol() === 'symbol';
  }();
  _exports.HAS_NATIVE_SYMBOL = HAS_NATIVE_SYMBOL;
  function keys(obj) {
    return Object.keys(obj);
  }
  function unwrap(val) {
    if (val === null || val === undefined) throw new Error("Expected value to be present");
    return val;
  }
  function expect(val, message) {
    if (val === null || val === undefined) throw new Error(message);
    return val;
  }
  function unreachable(message) {
    if (message === void 0) {
      message = 'unreachable';
    }
    return new Error(message);
  }
  function exhausted(value) {
    throw new Error("Exhausted " + value);
  }
  var tuple = function () {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    return args;
  };
  _exports.tuple = tuple;
  function enumerableSymbol(key) {
    return intern("__" + key + Math.floor(Math.random() * Date.now()) + "__");
  }
  var symbol = HAS_NATIVE_SYMBOL ? Symbol : enumerableSymbol;
  _exports.symbol = symbol;
  function strip(strings) {
    var out = '';
    for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }
    for (var i = 0; i < strings.length; i++) {
      var string = strings[i];
      var dynamic = args[i] !== undefined ? String(args[i]) : '';
      out += "" + string + dynamic;
    }
    var lines = out.split('\n');
    while (lines.length && lines[0].match(/^\s*$/)) {
      lines.shift();
    }
    while (lines.length && lines[lines.length - 1].match(/^\s*$/)) {
      lines.pop();
    }
    var min = Infinity;
    for (var line of lines) {
      var leading = line.match(/^\s*/)[0].length;
      min = Math.min(min, leading);
    }
    var stripped = [];
    for (var _line of lines) {
      stripped.push(_line.slice(min));
    }
    return stripped.join('\n');
  }
  function isHandle(value) {
    return value >= 0;
  }
  function isNonPrimitiveHandle(value) {
    return value > 3
    /* ENCODED_UNDEFINED_HANDLE */;
  }

  function constants() {
    for (var _len3 = arguments.length, values = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
      values[_key3] = arguments[_key3];
    }
    return [false, true, null, undefined, ...values];
  }
  function isSmallInt(value) {
    return value % 1 === 0 && value <= 536870911
    /* MAX_INT */ && value >= -536870912
    /* MIN_INT */;
  }

  function encodeNegative(num) {
    return num & -536870913
    /* SIGN_BIT */;
  }

  function decodeNegative(num) {
    return num | ~-536870913
    /* SIGN_BIT */;
  }

  function encodePositive(num) {
    return ~num;
  }
  function decodePositive(num) {
    return ~num;
  }
  function encodeHandle(num) {
    return num;
  }
  function decodeHandle(num) {
    return num;
  }
  function encodeImmediate(num) {
    num |= 0;
    return num < 0 ? encodeNegative(num) : encodePositive(num);
  }
  function decodeImmediate(num) {
    num |= 0;
    return num > -536870913
    /* SIGN_BIT */ ? decodePositive(num) : decodeNegative(num);
  } // Warm
  [1, -1].forEach(x => decodeImmediate(encodeImmediate(x)));
  function unwrapHandle(handle) {
    if (typeof handle === 'number') {
      return handle;
    } else {
      var error = handle.errors[0];
      throw new Error("Compile Error: " + error.problem + " @ " + error.span.start + ".." + error.span.end);
    }
  }
  function unwrapTemplate(template) {
    if (template.result === 'error') {
      throw new Error("Compile Error: " + template.problem + " @ " + template.span.start + ".." + template.span.end);
    }
    return template;
  }
  function extractHandle(handle) {
    if (typeof handle === 'number') {
      return handle;
    } else {
      return handle.handle;
    }
  }
  function isOkHandle(handle) {
    return typeof handle === 'number';
  }
  function isErrHandle(handle) {
    return typeof handle === 'number';
  }
  var weakSet = typeof WeakSet === 'function' ? WeakSet : class WeakSetPolyFill {
    constructor() {
      this._map = new WeakMap();
    }
    add(val) {
      this._map.set(val, true);
      return this;
    }
    delete(val) {
      return this._map.delete(val);
    }
    has(val) {
      return this._map.has(val);
    }
  };
  _exports._WeakSet = weakSet;
  function castToSimple(node) {
    if (isDocument(node)) {
      return node;
    } else if (isElement(node)) {
      return node;
    } else {
      return node;
    }
  }
  function castToBrowser(node, sugaryCheck) {
    if (node === null || node === undefined) {
      return null;
    }
    if (typeof document === undefined) {
      throw new Error('Attempted to cast to a browser node in a non-browser context');
    }
    if (isDocument(node)) {
      return node;
    }
    if (node.ownerDocument !== document) {
      throw new Error('Attempted to cast to a browser node with a node that was not created from this document');
    }
    return checkNode(node, sugaryCheck);
  }
  function checkError(from, check) {
    return new Error("cannot cast a " + from + " into " + check);
  }
  function isDocument(node) {
    return node.nodeType === 9
    /* DOCUMENT_NODE */;
  }

  function isElement(node) {
    return node.nodeType === 1
    /* ELEMENT_NODE */;
  }

  function checkNode(node, check) {
    var isMatch = false;
    if (node !== null) {
      if (typeof check === 'string') {
        isMatch = stringCheckNode(node, check);
      } else if (Array.isArray(check)) {
        isMatch = check.some(c => stringCheckNode(node, c));
      } else {
        throw unreachable();
      }
    }
    if (isMatch) {
      return node;
    } else {
      throw checkError("SimpleElement(" + node + ")", check);
    }
  }
  function stringCheckNode(node, check) {
    switch (check) {
      case 'NODE':
        return true;
      case 'HTML':
        return node instanceof HTMLElement;
      case 'SVG':
        return node instanceof SVGElement;
      case 'ELEMENT':
        return node instanceof Element;
      default:
        if (check.toUpperCase() === check) {
          throw new Error("BUG: this code is missing handling for a generic node type");
        }
        return node instanceof Element && node.tagName.toLowerCase() === check;
    }
  }
  function isPresent(list) {
    return list.length > 0;
  }
  function ifPresent(list, ifPresent, otherwise) {
    if (isPresent(list)) {
      return ifPresent(list);
    } else {
      return otherwise();
    }
  }
  function toPresentOption(list) {
    if (isPresent(list)) {
      return list;
    } else {
      return null;
    }
  }
  function assertPresent(list, message) {
    if (message === void 0) {
      message = "unexpected empty list";
    }
    if (!isPresent(list)) {
      throw new Error(message);
    }
  }
  function mapPresent(list, callback) {
    if (list === null) {
      return null;
    }
    var out = [];
    for (var item of list) {
      out.push(callback(item));
    }
    return out;
  }
  function buildUntouchableThis(source) {
    var context = null;
    if (true /* DEBUG */ && HAS_NATIVE_PROXY) {
      var assertOnProperty = property => {
        throw new Error("You accessed `this." + String(property) + "` from a function passed to the " + source + ", but the function itself was not bound to a valid `this` context. Consider updating to use a bound function (for instance, use an arrow function, `() => {}`).");
      };
      context = new Proxy({}, {
        get(_target, property) {
          assertOnProperty(property);
        },
        set(_target, property) {
          assertOnProperty(property);
          return false;
        },
        has(_target, property) {
          assertOnProperty(property);
          return false;
        }
      });
    }
    return context;
  }
  var debugToString;
  if (true /* DEBUG */) {
    var getFunctionName = fn => {
      var functionName = fn.name;
      if (functionName === undefined) {
        var match = Function.prototype.toString.call(fn).match(/function (\w+)\s*\(/);
        functionName = match && match[1] || '';
      }
      return functionName.replace(/^bound /, '');
    };
    var getObjectName = obj => {
      var name;
      var className;
      if (obj.constructor && typeof obj.constructor === 'function') {
        className = getFunctionName(obj.constructor);
      }
      if ('toString' in obj && obj.toString !== Object.prototype.toString && obj.toString !== Function.prototype.toString) {
        name = obj.toString();
      } // If the class has a decent looking name, and the `toString` is one of the
      // default Ember toStrings, replace the constructor portion of the toString
      // with the class name. We check the length of the class name to prevent doing
      // this when the value is minified.

      if (name && name.match(/<.*:ember\d+>/) && className && className[0] !== '_' && className.length > 2 && className !== 'Class') {
        return name.replace(/<.*:/, "<" + className + ":");
      }
      return name || className;
    };
    var getPrimitiveName = value => {
      return String(value);
    };
    debugToString = value => {
      if (typeof value === 'function') {
        return getFunctionName(value) || "(unknown function)";
      } else if (typeof value === 'object' && value !== null) {
        return getObjectName(value) || "(unknown object)";
      } else {
        return getPrimitiveName(value);
      }
    };
  }
  var debugToString$1 = debugToString;
  _exports.debugToString = debugToString$1;
  var beginTestSteps;
  _exports.beginTestSteps = beginTestSteps;
  var endTestSteps;
  _exports.endTestSteps = endTestSteps;
  var verifySteps;
  _exports.verifySteps = verifySteps;
  var logStep;

  /**
   * This constant exists to make it easier to differentiate normal logs from
   * errant console.logs. LOCAL_LOGGER should only be used inside a
   * LOCAL_SHOULD_LOG check.
   *
   * It does not alleviate the need to check LOCAL_SHOULD_LOG, which is used
   * for stripping.
   */
  _exports.logStep = logStep;
  var LOCAL_LOGGER = console;
  /**
   * This constant exists to make it easier to differentiate normal logs from
   * errant console.logs. LOGGER can be used outside of LOCAL_SHOULD_LOG checks,
   * and is meant to be used in the rare situation where a console.* call is
   * actually appropriate.
   */
  _exports.LOCAL_LOGGER = LOCAL_LOGGER;
  var LOGGER = console;
  _exports.LOGGER = LOGGER;
  function assertNever(value, desc) {
    if (desc === void 0) {
      desc = 'unexpected unreachable branch';
    }
    LOGGER.log('unreachable', value);
    LOGGER.log(desc + " :: " + JSON.stringify(value) + " (" + value + ")");
    throw new Error("code reached unreachable");
  }
});
define("@glimmer/wire-format", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.getStringFromValue = getStringFromValue;
  _exports.is = is;
  _exports.isArgument = isArgument;
  _exports.isAttribute = isAttribute;
  _exports.isGet = _exports.isFlushElement = void 0;
  _exports.isHelper = isHelper;
  _exports.isStringLiteral = isStringLiteral;
  function is(variant) {
    return function (value) {
      return Array.isArray(value) && value[0] === variant;
    };
  } // Statements

  var isFlushElement = is(12
  /* FlushElement */);
  _exports.isFlushElement = isFlushElement;
  function isAttribute(val) {
    return val[0] === 14
    /* StaticAttr */ || val[0] === 15
    /* DynamicAttr */ || val[0] === 22
    /* TrustingDynamicAttr */ || val[0] === 16
    /* ComponentAttr */ || val[0] === 24
    /* StaticComponentAttr */ || val[0] === 23
    /* TrustingComponentAttr */ || val[0] === 17
    /* AttrSplat */ || val[0] === 4
    /* Modifier */;
  }

  function isStringLiteral(expr) {
    return typeof expr === 'string';
  }
  function getStringFromValue(expr) {
    return expr;
  }
  function isArgument(val) {
    return val[0] === 21
    /* StaticArg */ || val[0] === 20
    /* DynamicArg */;
  }

  function isHelper(expr) {
    return Array.isArray(expr) && expr[0] === 28
    /* Call */;
  } // Expressions

  var isGet = is(30
  /* GetSymbol */);
  _exports.isGet = isGet;
});
define("@handlebars/parser/index", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.Exception = Exception;
  _exports.PrintVisitor = PrintVisitor;
  _exports.Visitor = Visitor;
  _exports.WhitespaceControl = WhitespaceControl;
  _exports.parse = parse;
  _exports.parseWithoutProcessing = parseWithoutProcessing;
  _exports.parser = void 0;
  _exports.print = print;
  var errorProps = ['description', 'fileName', 'lineNumber', 'endLineNumber', 'message', 'name', 'number', 'stack'];
  function Exception(message, node) {
    var loc = node && node.loc,
      line,
      endLineNumber,
      column,
      endColumn;
    if (loc) {
      line = loc.start.line;
      endLineNumber = loc.end.line;
      column = loc.start.column;
      endColumn = loc.end.column;
      message += ' - ' + line + ':' + column;
    }
    var tmp = Error.prototype.constructor.call(this, message);
    // Unfortunately errors are not enumerable in Chrome (at least), so `for prop in tmp` doesn't work.
    for (var idx = 0; idx < errorProps.length; idx++) {
      this[errorProps[idx]] = tmp[errorProps[idx]];
    }
    /* istanbul ignore else */
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, Exception);
    }
    try {
      if (loc) {
        this.lineNumber = line;
        this.endLineNumber = endLineNumber;
        // Work around issue under safari where we can't directly set the column value
        /* istanbul ignore next */
        if (Object.defineProperty) {
          Object.defineProperty(this, 'column', {
            value: column,
            enumerable: true
          });
          Object.defineProperty(this, 'endColumn', {
            value: endColumn,
            enumerable: true
          });
        } else {
          this.column = column;
          this.endColumn = endColumn;
        }
      }
    } catch (nop) {
      /* Ignore if the browser is very particular */
    }
  }
  Exception.prototype = new Error();
  function Visitor() {
    this.parents = [];
  }
  Visitor.prototype = {
    constructor: Visitor,
    mutating: false,
    // Visits a given value. If mutating, will replace the value if necessary.
    acceptKey: function (node, name) {
      var value = this.accept(node[name]);
      if (this.mutating) {
        // Hacky sanity check: This may have a few false positives for type for the helper
        // methods but will generally do the right thing without a lot of overhead.
        if (value && !Visitor.prototype[value.type]) {
          throw new Exception('Unexpected node type "' + value.type + '" found when accepting ' + name + ' on ' + node.type);
        }
        node[name] = value;
      }
    },
    // Performs an accept operation with added sanity check to ensure
    // required keys are not removed.
    acceptRequired: function (node, name) {
      this.acceptKey(node, name);
      if (!node[name]) {
        throw new Exception(node.type + ' requires ' + name);
      }
    },
    // Traverses a given array. If mutating, empty respnses will be removed
    // for child elements.
    acceptArray: function (array) {
      for (var i = 0, l = array.length; i < l; i++) {
        this.acceptKey(array, i);
        if (!array[i]) {
          array.splice(i, 1);
          i--;
          l--;
        }
      }
    },
    accept: function (object) {
      if (!object) {
        return;
      }
      /* istanbul ignore next: Sanity code */
      if (!this[object.type]) {
        throw new Exception('Unknown type: ' + object.type, object);
      }
      if (this.current) {
        this.parents.unshift(this.current);
      }
      this.current = object;
      var ret = this[object.type](object);
      this.current = this.parents.shift();
      if (!this.mutating || ret) {
        return ret;
      } else if (ret !== false) {
        return object;
      }
    },
    Program: function (program) {
      this.acceptArray(program.body);
    },
    MustacheStatement: visitSubExpression,
    Decorator: visitSubExpression,
    BlockStatement: visitBlock,
    DecoratorBlock: visitBlock,
    PartialStatement: visitPartial,
    PartialBlockStatement: function (partial) {
      visitPartial.call(this, partial);
      this.acceptKey(partial, 'program');
    },
    ContentStatement: function /* content */ () {},
    CommentStatement: function /* comment */ () {},
    SubExpression: visitSubExpression,
    PathExpression: function /* path */ () {},
    StringLiteral: function /* string */ () {},
    NumberLiteral: function /* number */ () {},
    BooleanLiteral: function /* bool */ () {},
    UndefinedLiteral: function /* literal */ () {},
    NullLiteral: function /* literal */ () {},
    Hash: function (hash) {
      this.acceptArray(hash.pairs);
    },
    HashPair: function (pair) {
      this.acceptRequired(pair, 'value');
    }
  };
  function visitSubExpression(mustache) {
    this.acceptRequired(mustache, 'path');
    this.acceptArray(mustache.params);
    this.acceptKey(mustache, 'hash');
  }
  function visitBlock(block) {
    visitSubExpression.call(this, block);
    this.acceptKey(block, 'program');
    this.acceptKey(block, 'inverse');
  }
  function visitPartial(partial) {
    this.acceptRequired(partial, 'name');
    this.acceptArray(partial.params);
    this.acceptKey(partial, 'hash');
  }
  function WhitespaceControl(options) {
    if (options === void 0) {
      options = {};
    }
    this.options = options;
  }
  WhitespaceControl.prototype = new Visitor();
  WhitespaceControl.prototype.Program = function (program) {
    var doStandalone = !this.options.ignoreStandalone;
    var isRoot = !this.isRootSeen;
    this.isRootSeen = true;
    var body = program.body;
    for (var i = 0, l = body.length; i < l; i++) {
      var current = body[i],
        strip = this.accept(current);
      if (!strip) {
        continue;
      }
      var _isPrevWhitespace = isPrevWhitespace(body, i, isRoot),
        _isNextWhitespace = isNextWhitespace(body, i, isRoot),
        openStandalone = strip.openStandalone && _isPrevWhitespace,
        closeStandalone = strip.closeStandalone && _isNextWhitespace,
        inlineStandalone = strip.inlineStandalone && _isPrevWhitespace && _isNextWhitespace;
      if (strip.close) {
        omitRight(body, i, true);
      }
      if (strip.open) {
        omitLeft(body, i, true);
      }
      if (doStandalone && inlineStandalone) {
        omitRight(body, i);
        if (omitLeft(body, i)) {
          // If we are on a standalone node, save the indent info for partials
          if (current.type === 'PartialStatement') {
            // Pull out the whitespace from the final line
            current.indent = /([ \t]+$)/.exec(body[i - 1].original)[1];
          }
        }
      }
      if (doStandalone && openStandalone) {
        omitRight((current.program || current.inverse).body);
        // Strip out the previous content node if it's whitespace only
        omitLeft(body, i);
      }
      if (doStandalone && closeStandalone) {
        // Always strip the next node
        omitRight(body, i);
        omitLeft((current.inverse || current.program).body);
      }
    }
    return program;
  };
  WhitespaceControl.prototype.BlockStatement = WhitespaceControl.prototype.DecoratorBlock = WhitespaceControl.prototype.PartialBlockStatement = function (block) {
    this.accept(block.program);
    this.accept(block.inverse);
    // Find the inverse program that is involed with whitespace stripping.
    var program = block.program || block.inverse,
      inverse = block.program && block.inverse,
      firstInverse = inverse,
      lastInverse = inverse;
    if (inverse && inverse.chained) {
      firstInverse = inverse.body[0].program;
      // Walk the inverse chain to find the last inverse that is actually in the chain.
      while (lastInverse.chained) {
        lastInverse = lastInverse.body[lastInverse.body.length - 1].program;
      }
    }
    var strip = {
      open: block.openStrip.open,
      close: block.closeStrip.close,
      // Determine the standalone candiacy. Basically flag our content as being possibly standalone
      // so our parent can determine if we actually are standalone
      openStandalone: isNextWhitespace(program.body),
      closeStandalone: isPrevWhitespace((firstInverse || program).body)
    };
    if (block.openStrip.close) {
      omitRight(program.body, null, true);
    }
    if (inverse) {
      var inverseStrip = block.inverseStrip;
      if (inverseStrip.open) {
        omitLeft(program.body, null, true);
      }
      if (inverseStrip.close) {
        omitRight(firstInverse.body, null, true);
      }
      if (block.closeStrip.open) {
        omitLeft(lastInverse.body, null, true);
      }
      // Find standalone else statments
      if (!this.options.ignoreStandalone && isPrevWhitespace(program.body) && isNextWhitespace(firstInverse.body)) {
        omitLeft(program.body);
        omitRight(firstInverse.body);
      }
    } else if (block.closeStrip.open) {
      omitLeft(program.body, null, true);
    }
    return strip;
  };
  WhitespaceControl.prototype.Decorator = WhitespaceControl.prototype.MustacheStatement = function (mustache) {
    return mustache.strip;
  };
  WhitespaceControl.prototype.PartialStatement = WhitespaceControl.prototype.CommentStatement = function (node) {
    /* istanbul ignore next */
    var strip = node.strip || {};
    return {
      inlineStandalone: true,
      open: strip.open,
      close: strip.close
    };
  };
  function isPrevWhitespace(body, i, isRoot) {
    if (i === undefined) {
      i = body.length;
    }
    // Nodes that end with newlines are considered whitespace (but are special
    // cased for strip operations)
    var prev = body[i - 1],
      sibling = body[i - 2];
    if (!prev) {
      return isRoot;
    }
    if (prev.type === 'ContentStatement') {
      return (sibling || !isRoot ? /\r?\n\s*?$/ : /(^|\r?\n)\s*?$/).test(prev.original);
    }
  }
  function isNextWhitespace(body, i, isRoot) {
    if (i === undefined) {
      i = -1;
    }
    var next = body[i + 1],
      sibling = body[i + 2];
    if (!next) {
      return isRoot;
    }
    if (next.type === 'ContentStatement') {
      return (sibling || !isRoot ? /^\s*?\r?\n/ : /^\s*?(\r?\n|$)/).test(next.original);
    }
  }
  // Marks the node to the right of the position as omitted.
  // I.e. {{foo}}' ' will mark the ' ' node as omitted.
  //
  // If i is undefined, then the first child will be marked as such.
  //
  // If multiple is truthy then all whitespace will be stripped out until non-whitespace
  // content is met.
  function omitRight(body, i, multiple) {
    var current = body[i == null ? 0 : i + 1];
    if (!current || current.type !== 'ContentStatement' || !multiple && current.rightStripped) {
      return;
    }
    var original = current.value;
    current.value = current.value.replace(multiple ? /^\s+/ : /^[ \t]*\r?\n?/, '');
    current.rightStripped = current.value !== original;
  }
  // Marks the node to the left of the position as omitted.
  // I.e. ' '{{foo}} will mark the ' ' node as omitted.
  //
  // If i is undefined then the last child will be marked as such.
  //
  // If multiple is truthy then all whitespace will be stripped out until non-whitespace
  // content is met.
  function omitLeft(body, i, multiple) {
    var current = body[i == null ? body.length - 1 : i - 1];
    if (!current || current.type !== 'ContentStatement' || !multiple && current.leftStripped) {
      return;
    }
    // We omit the last node if it's whitespace only and not preceded by a non-content node.
    var original = current.value;
    current.value = current.value.replace(multiple ? /\s+$/ : /[ \t]+$/, '');
    current.leftStripped = current.value !== original;
    return current.leftStripped;
  }

  /* parser generated by jison 0.4.18 */
  /*
    Returns a Parser object of the following structure:

    Parser: {
      yy: {}
    }

    Parser.prototype: {
      yy: {},
      trace: function(),
      symbols_: {associative list: name ==> number},
      terminals_: {associative list: number ==> name},
      productions_: [...],
      performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$),
      table: [...],
      defaultActions: {...},
      parseError: function(str, hash),
      parse: function(input),

      lexer: {
          EOF: 1,
          parseError: function(str, hash),
          setInput: function(input),
          input: function(),
          unput: function(str),
          more: function(),
          less: function(n),
          pastInput: function(),
          upcomingInput: function(),
          showPosition: function(),
          test_match: function(regex_match_array, rule_index),
          next: function(),
          lex: function(),
          begin: function(condition),
          popState: function(),
          _currentRules: function(),
          topState: function(),
          pushState: function(condition),

          options: {
              ranges: boolean           (optional: true ==> token location info will include a .range[] member)
              flex: boolean             (optional: true ==> flex-like lexing behaviour where the rules are tested exhaustively to find the longest match)
              backtrack_lexer: boolean  (optional: true ==> lexer regexes are tested in order and for each matching regex the action code is invoked; the lexer terminates the scan when a token is returned by the action code)
          },

          performAction: function(yy, yy_, $avoiding_name_collisions, YY_START),
          rules: [...],
          conditions: {associative list: name ==> set},
      }
    }


    token location info (@$, _$, etc.): {
      first_line: n,
      last_line: n,
      first_column: n,
      last_column: n,
      range: [start_number, end_number]       (where the numbers are indexes into the input string, regular zero-based)
    }


    the parseError function receives a 'hash' object with these members for lexer and parser errors: {
      text:        (matched text)
      token:       (the produced terminal token, if any)
      line:        (yylineno)
    }
    while parser (grammar) errors will also provide these members, i.e. parser errors deliver a superset of attributes: {
      loc:         (yylloc)
      expected:    (string describing the set of expected tokens)
      recoverable: (boolean: TRUE when the parser has a error recovery rule available for this particular error)
    }
  */
  var parser = function () {
    var o = function (k, v, o, l) {
        for (o = o || {}, l = k.length; l--; o[k[l]] = v) {
          ;
        }
        return o;
      },
      $V0 = [2, 44],
      $V1 = [1, 20],
      $V2 = [5, 14, 15, 19, 29, 34, 39, 44, 47, 48, 52, 56, 60],
      $V3 = [1, 35],
      $V4 = [1, 38],
      $V5 = [1, 30],
      $V6 = [1, 31],
      $V7 = [1, 32],
      $V8 = [1, 33],
      $V9 = [1, 34],
      $Va = [1, 37],
      $Vb = [14, 15, 19, 29, 34, 39, 44, 47, 48, 52, 56, 60],
      $Vc = [14, 15, 19, 29, 34, 44, 47, 48, 52, 56, 60],
      $Vd = [15, 18],
      $Ve = [14, 15, 19, 29, 34, 47, 48, 52, 56, 60],
      $Vf = [33, 64, 71, 79, 80, 81, 82, 83, 84],
      $Vg = [23, 33, 55, 64, 67, 71, 74, 79, 80, 81, 82, 83, 84],
      $Vh = [1, 51],
      $Vi = [23, 33, 55, 64, 67, 71, 74, 79, 80, 81, 82, 83, 84, 86],
      $Vj = [2, 43],
      $Vk = [55, 64, 71, 79, 80, 81, 82, 83, 84],
      $Vl = [1, 58],
      $Vm = [1, 59],
      $Vn = [1, 66],
      $Vo = [33, 64, 71, 74, 79, 80, 81, 82, 83, 84],
      $Vp = [23, 64, 71, 79, 80, 81, 82, 83, 84],
      $Vq = [1, 76],
      $Vr = [64, 67, 71, 79, 80, 81, 82, 83, 84],
      $Vs = [33, 74],
      $Vt = [23, 33, 55, 67, 71, 74],
      $Vu = [1, 106],
      $Vv = [1, 118],
      $Vw = [71, 76];
    var parser = {
      trace: function trace() {},
      yy: {},
      symbols_: {
        "error": 2,
        "root": 3,
        "program": 4,
        "EOF": 5,
        "program_repetition0": 6,
        "statement": 7,
        "mustache": 8,
        "block": 9,
        "rawBlock": 10,
        "partial": 11,
        "partialBlock": 12,
        "content": 13,
        "COMMENT": 14,
        "CONTENT": 15,
        "openRawBlock": 16,
        "rawBlock_repetition0": 17,
        "END_RAW_BLOCK": 18,
        "OPEN_RAW_BLOCK": 19,
        "helperName": 20,
        "openRawBlock_repetition0": 21,
        "openRawBlock_option0": 22,
        "CLOSE_RAW_BLOCK": 23,
        "openBlock": 24,
        "block_option0": 25,
        "closeBlock": 26,
        "openInverse": 27,
        "block_option1": 28,
        "OPEN_BLOCK": 29,
        "openBlock_repetition0": 30,
        "openBlock_option0": 31,
        "openBlock_option1": 32,
        "CLOSE": 33,
        "OPEN_INVERSE": 34,
        "openInverse_repetition0": 35,
        "openInverse_option0": 36,
        "openInverse_option1": 37,
        "openInverseChain": 38,
        "OPEN_INVERSE_CHAIN": 39,
        "openInverseChain_repetition0": 40,
        "openInverseChain_option0": 41,
        "openInverseChain_option1": 42,
        "inverseAndProgram": 43,
        "INVERSE": 44,
        "inverseChain": 45,
        "inverseChain_option0": 46,
        "OPEN_ENDBLOCK": 47,
        "OPEN": 48,
        "expr": 49,
        "mustache_repetition0": 50,
        "mustache_option0": 51,
        "OPEN_UNESCAPED": 52,
        "mustache_repetition1": 53,
        "mustache_option1": 54,
        "CLOSE_UNESCAPED": 55,
        "OPEN_PARTIAL": 56,
        "partial_repetition0": 57,
        "partial_option0": 58,
        "openPartialBlock": 59,
        "OPEN_PARTIAL_BLOCK": 60,
        "openPartialBlock_repetition0": 61,
        "openPartialBlock_option0": 62,
        "sexpr": 63,
        "OPEN_SEXPR": 64,
        "sexpr_repetition0": 65,
        "sexpr_option0": 66,
        "CLOSE_SEXPR": 67,
        "hash": 68,
        "hash_repetition_plus0": 69,
        "hashSegment": 70,
        "ID": 71,
        "EQUALS": 72,
        "blockParams": 73,
        "OPEN_BLOCK_PARAMS": 74,
        "blockParams_repetition_plus0": 75,
        "CLOSE_BLOCK_PARAMS": 76,
        "path": 77,
        "dataName": 78,
        "STRING": 79,
        "NUMBER": 80,
        "BOOLEAN": 81,
        "UNDEFINED": 82,
        "NULL": 83,
        "DATA": 84,
        "pathSegments": 85,
        "SEP": 86,
        "$accept": 0,
        "$end": 1
      },
      terminals_: {
        2: "error",
        5: "EOF",
        14: "COMMENT",
        15: "CONTENT",
        18: "END_RAW_BLOCK",
        19: "OPEN_RAW_BLOCK",
        23: "CLOSE_RAW_BLOCK",
        29: "OPEN_BLOCK",
        33: "CLOSE",
        34: "OPEN_INVERSE",
        39: "OPEN_INVERSE_CHAIN",
        44: "INVERSE",
        47: "OPEN_ENDBLOCK",
        48: "OPEN",
        52: "OPEN_UNESCAPED",
        55: "CLOSE_UNESCAPED",
        56: "OPEN_PARTIAL",
        60: "OPEN_PARTIAL_BLOCK",
        64: "OPEN_SEXPR",
        67: "CLOSE_SEXPR",
        71: "ID",
        72: "EQUALS",
        74: "OPEN_BLOCK_PARAMS",
        76: "CLOSE_BLOCK_PARAMS",
        79: "STRING",
        80: "NUMBER",
        81: "BOOLEAN",
        82: "UNDEFINED",
        83: "NULL",
        84: "DATA",
        86: "SEP"
      },
      productions_: [0, [3, 2], [4, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [13, 1], [10, 3], [16, 5], [9, 4], [9, 4], [24, 6], [27, 6], [38, 6], [43, 2], [45, 3], [45, 1], [26, 3], [8, 5], [8, 5], [11, 5], [12, 3], [59, 5], [49, 1], [49, 1], [63, 5], [68, 1], [70, 3], [73, 3], [20, 1], [20, 1], [20, 1], [20, 1], [20, 1], [20, 1], [20, 1], [78, 2], [77, 1], [85, 3], [85, 1], [6, 0], [6, 2], [17, 0], [17, 2], [21, 0], [21, 2], [22, 0], [22, 1], [25, 0], [25, 1], [28, 0], [28, 1], [30, 0], [30, 2], [31, 0], [31, 1], [32, 0], [32, 1], [35, 0], [35, 2], [36, 0], [36, 1], [37, 0], [37, 1], [40, 0], [40, 2], [41, 0], [41, 1], [42, 0], [42, 1], [46, 0], [46, 1], [50, 0], [50, 2], [51, 0], [51, 1], [53, 0], [53, 2], [54, 0], [54, 1], [57, 0], [57, 2], [58, 0], [58, 1], [61, 0], [61, 2], [62, 0], [62, 1], [65, 0], [65, 2], [66, 0], [66, 1], [69, 1], [69, 2], [75, 1], [75, 2]],
      performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */) {
        /* this == yyval */
        var $0 = $$.length - 1;
        switch (yystate) {
          case 1:
            return $$[$0 - 1];
          case 2:
            this.$ = yy.prepareProgram($$[$0]);
            break;
          case 3:
          case 4:
          case 5:
          case 6:
          case 7:
          case 8:
          case 20:
          case 27:
          case 28:
          case 33:
          case 34:
            this.$ = $$[$0];
            break;
          case 9:
            this.$ = {
              type: 'CommentStatement',
              value: yy.stripComment($$[$0]),
              strip: yy.stripFlags($$[$0], $$[$0]),
              loc: yy.locInfo(this._$)
            };
            break;
          case 10:
            this.$ = {
              type: 'ContentStatement',
              original: $$[$0],
              value: $$[$0],
              loc: yy.locInfo(this._$)
            };
            break;
          case 11:
            this.$ = yy.prepareRawBlock($$[$0 - 2], $$[$0 - 1], $$[$0], this._$);
            break;
          case 12:
            this.$ = {
              path: $$[$0 - 3],
              params: $$[$0 - 2],
              hash: $$[$0 - 1]
            };
            break;
          case 13:
            this.$ = yy.prepareBlock($$[$0 - 3], $$[$0 - 2], $$[$0 - 1], $$[$0], false, this._$);
            break;
          case 14:
            this.$ = yy.prepareBlock($$[$0 - 3], $$[$0 - 2], $$[$0 - 1], $$[$0], true, this._$);
            break;
          case 15:
            this.$ = {
              open: $$[$0 - 5],
              path: $$[$0 - 4],
              params: $$[$0 - 3],
              hash: $$[$0 - 2],
              blockParams: $$[$0 - 1],
              strip: yy.stripFlags($$[$0 - 5], $$[$0])
            };
            break;
          case 16:
          case 17:
            this.$ = {
              path: $$[$0 - 4],
              params: $$[$0 - 3],
              hash: $$[$0 - 2],
              blockParams: $$[$0 - 1],
              strip: yy.stripFlags($$[$0 - 5], $$[$0])
            };
            break;
          case 18:
            this.$ = {
              strip: yy.stripFlags($$[$0 - 1], $$[$0 - 1]),
              program: $$[$0]
            };
            break;
          case 19:
            var inverse = yy.prepareBlock($$[$0 - 2], $$[$0 - 1], $$[$0], $$[$0], false, this._$),
              program = yy.prepareProgram([inverse], $$[$0 - 1].loc);
            program.chained = true;
            this.$ = {
              strip: $$[$0 - 2].strip,
              program: program,
              chain: true
            };
            break;
          case 21:
            this.$ = {
              path: $$[$0 - 1],
              strip: yy.stripFlags($$[$0 - 2], $$[$0])
            };
            break;
          case 22:
          case 23:
            this.$ = yy.prepareMustache($$[$0 - 3], $$[$0 - 2], $$[$0 - 1], $$[$0 - 4], yy.stripFlags($$[$0 - 4], $$[$0]), this._$);
            break;
          case 24:
            this.$ = {
              type: 'PartialStatement',
              name: $$[$0 - 3],
              params: $$[$0 - 2],
              hash: $$[$0 - 1],
              indent: '',
              strip: yy.stripFlags($$[$0 - 4], $$[$0]),
              loc: yy.locInfo(this._$)
            };
            break;
          case 25:
            this.$ = yy.preparePartialBlock($$[$0 - 2], $$[$0 - 1], $$[$0], this._$);
            break;
          case 26:
            this.$ = {
              path: $$[$0 - 3],
              params: $$[$0 - 2],
              hash: $$[$0 - 1],
              strip: yy.stripFlags($$[$0 - 4], $$[$0])
            };
            break;
          case 29:
            this.$ = {
              type: 'SubExpression',
              path: $$[$0 - 3],
              params: $$[$0 - 2],
              hash: $$[$0 - 1],
              loc: yy.locInfo(this._$)
            };
            break;
          case 30:
            this.$ = {
              type: 'Hash',
              pairs: $$[$0],
              loc: yy.locInfo(this._$)
            };
            break;
          case 31:
            this.$ = {
              type: 'HashPair',
              key: yy.id($$[$0 - 2]),
              value: $$[$0],
              loc: yy.locInfo(this._$)
            };
            break;
          case 32:
            this.$ = yy.id($$[$0 - 1]);
            break;
          case 35:
            this.$ = {
              type: 'StringLiteral',
              value: $$[$0],
              original: $$[$0],
              loc: yy.locInfo(this._$)
            };
            break;
          case 36:
            this.$ = {
              type: 'NumberLiteral',
              value: Number($$[$0]),
              original: Number($$[$0]),
              loc: yy.locInfo(this._$)
            };
            break;
          case 37:
            this.$ = {
              type: 'BooleanLiteral',
              value: $$[$0] === 'true',
              original: $$[$0] === 'true',
              loc: yy.locInfo(this._$)
            };
            break;
          case 38:
            this.$ = {
              type: 'UndefinedLiteral',
              original: undefined,
              value: undefined,
              loc: yy.locInfo(this._$)
            };
            break;
          case 39:
            this.$ = {
              type: 'NullLiteral',
              original: null,
              value: null,
              loc: yy.locInfo(this._$)
            };
            break;
          case 40:
            this.$ = yy.preparePath(true, $$[$0], this._$);
            break;
          case 41:
            this.$ = yy.preparePath(false, $$[$0], this._$);
            break;
          case 42:
            $$[$0 - 2].push({
              part: yy.id($$[$0]),
              original: $$[$0],
              separator: $$[$0 - 1]
            });
            this.$ = $$[$0 - 2];
            break;
          case 43:
            this.$ = [{
              part: yy.id($$[$0]),
              original: $$[$0]
            }];
            break;
          case 44:
          case 46:
          case 48:
          case 56:
          case 62:
          case 68:
          case 76:
          case 80:
          case 84:
          case 88:
          case 92:
            this.$ = [];
            break;
          case 45:
          case 47:
          case 49:
          case 57:
          case 63:
          case 69:
          case 77:
          case 81:
          case 85:
          case 89:
          case 93:
          case 97:
          case 99:
            $$[$0 - 1].push($$[$0]);
            break;
          case 96:
          case 98:
            this.$ = [$$[$0]];
            break;
        }
      },
      table: [o([5, 14, 15, 19, 29, 34, 48, 52, 56, 60], $V0, {
        3: 1,
        4: 2,
        6: 3
      }), {
        1: [3]
      }, {
        5: [1, 4]
      }, o([5, 39, 44, 47], [2, 2], {
        7: 5,
        8: 6,
        9: 7,
        10: 8,
        11: 9,
        12: 10,
        13: 11,
        24: 15,
        27: 16,
        16: 17,
        59: 19,
        14: [1, 12],
        15: $V1,
        19: [1, 23],
        29: [1, 21],
        34: [1, 22],
        48: [1, 13],
        52: [1, 14],
        56: [1, 18],
        60: [1, 24]
      }), {
        1: [2, 1]
      }, o($V2, [2, 45]), o($V2, [2, 3]), o($V2, [2, 4]), o($V2, [2, 5]), o($V2, [2, 6]), o($V2, [2, 7]), o($V2, [2, 8]), o($V2, [2, 9]), {
        20: 26,
        49: 25,
        63: 27,
        64: $V3,
        71: $V4,
        77: 28,
        78: 29,
        79: $V5,
        80: $V6,
        81: $V7,
        82: $V8,
        83: $V9,
        84: $Va,
        85: 36
      }, {
        20: 26,
        49: 39,
        63: 27,
        64: $V3,
        71: $V4,
        77: 28,
        78: 29,
        79: $V5,
        80: $V6,
        81: $V7,
        82: $V8,
        83: $V9,
        84: $Va,
        85: 36
      }, o($Vb, $V0, {
        6: 3,
        4: 40
      }), o($Vc, $V0, {
        6: 3,
        4: 41
      }), o($Vd, [2, 46], {
        17: 42
      }), {
        20: 26,
        49: 43,
        63: 27,
        64: $V3,
        71: $V4,
        77: 28,
        78: 29,
        79: $V5,
        80: $V6,
        81: $V7,
        82: $V8,
        83: $V9,
        84: $Va,
        85: 36
      }, o($Ve, $V0, {
        6: 3,
        4: 44
      }), o([5, 14, 15, 18, 19, 29, 34, 39, 44, 47, 48, 52, 56, 60], [2, 10]), {
        20: 45,
        71: $V4,
        77: 28,
        78: 29,
        79: $V5,
        80: $V6,
        81: $V7,
        82: $V8,
        83: $V9,
        84: $Va,
        85: 36
      }, {
        20: 46,
        71: $V4,
        77: 28,
        78: 29,
        79: $V5,
        80: $V6,
        81: $V7,
        82: $V8,
        83: $V9,
        84: $Va,
        85: 36
      }, {
        20: 47,
        71: $V4,
        77: 28,
        78: 29,
        79: $V5,
        80: $V6,
        81: $V7,
        82: $V8,
        83: $V9,
        84: $Va,
        85: 36
      }, {
        20: 26,
        49: 48,
        63: 27,
        64: $V3,
        71: $V4,
        77: 28,
        78: 29,
        79: $V5,
        80: $V6,
        81: $V7,
        82: $V8,
        83: $V9,
        84: $Va,
        85: 36
      }, o($Vf, [2, 76], {
        50: 49
      }), o($Vg, [2, 27]), o($Vg, [2, 28]), o($Vg, [2, 33]), o($Vg, [2, 34]), o($Vg, [2, 35]), o($Vg, [2, 36]), o($Vg, [2, 37]), o($Vg, [2, 38]), o($Vg, [2, 39]), {
        20: 26,
        49: 50,
        63: 27,
        64: $V3,
        71: $V4,
        77: 28,
        78: 29,
        79: $V5,
        80: $V6,
        81: $V7,
        82: $V8,
        83: $V9,
        84: $Va,
        85: 36
      }, o($Vg, [2, 41], {
        86: $Vh
      }), {
        71: $V4,
        85: 52
      }, o($Vi, $Vj), o($Vk, [2, 80], {
        53: 53
      }), {
        25: 54,
        38: 56,
        39: $Vl,
        43: 57,
        44: $Vm,
        45: 55,
        47: [2, 52]
      }, {
        28: 60,
        43: 61,
        44: $Vm,
        47: [2, 54]
      }, {
        13: 63,
        15: $V1,
        18: [1, 62]
      }, o($Vf, [2, 84], {
        57: 64
      }), {
        26: 65,
        47: $Vn
      }, o($Vo, [2, 56], {
        30: 67
      }), o($Vo, [2, 62], {
        35: 68
      }), o($Vp, [2, 48], {
        21: 69
      }), o($Vf, [2, 88], {
        61: 70
      }), {
        20: 26,
        33: [2, 78],
        49: 72,
        51: 71,
        63: 27,
        64: $V3,
        68: 73,
        69: 74,
        70: 75,
        71: $Vq,
        77: 28,
        78: 29,
        79: $V5,
        80: $V6,
        81: $V7,
        82: $V8,
        83: $V9,
        84: $Va,
        85: 36
      }, o($Vr, [2, 92], {
        65: 77
      }), {
        71: [1, 78]
      }, o($Vg, [2, 40], {
        86: $Vh
      }), {
        20: 26,
        49: 80,
        54: 79,
        55: [2, 82],
        63: 27,
        64: $V3,
        68: 81,
        69: 74,
        70: 75,
        71: $Vq,
        77: 28,
        78: 29,
        79: $V5,
        80: $V6,
        81: $V7,
        82: $V8,
        83: $V9,
        84: $Va,
        85: 36
      }, {
        26: 82,
        47: $Vn
      }, {
        47: [2, 53]
      }, o($Vb, $V0, {
        6: 3,
        4: 83
      }), {
        47: [2, 20]
      }, {
        20: 84,
        71: $V4,
        77: 28,
        78: 29,
        79: $V5,
        80: $V6,
        81: $V7,
        82: $V8,
        83: $V9,
        84: $Va,
        85: 36
      }, o($Ve, $V0, {
        6: 3,
        4: 85
      }), {
        26: 86,
        47: $Vn
      }, {
        47: [2, 55]
      }, o($V2, [2, 11]), o($Vd, [2, 47]), {
        20: 26,
        33: [2, 86],
        49: 88,
        58: 87,
        63: 27,
        64: $V3,
        68: 89,
        69: 74,
        70: 75,
        71: $Vq,
        77: 28,
        78: 29,
        79: $V5,
        80: $V6,
        81: $V7,
        82: $V8,
        83: $V9,
        84: $Va,
        85: 36
      }, o($V2, [2, 25]), {
        20: 90,
        71: $V4,
        77: 28,
        78: 29,
        79: $V5,
        80: $V6,
        81: $V7,
        82: $V8,
        83: $V9,
        84: $Va,
        85: 36
      }, o($Vs, [2, 58], {
        20: 26,
        63: 27,
        77: 28,
        78: 29,
        85: 36,
        69: 74,
        70: 75,
        31: 91,
        49: 92,
        68: 93,
        64: $V3,
        71: $Vq,
        79: $V5,
        80: $V6,
        81: $V7,
        82: $V8,
        83: $V9,
        84: $Va
      }), o($Vs, [2, 64], {
        20: 26,
        63: 27,
        77: 28,
        78: 29,
        85: 36,
        69: 74,
        70: 75,
        36: 94,
        49: 95,
        68: 96,
        64: $V3,
        71: $Vq,
        79: $V5,
        80: $V6,
        81: $V7,
        82: $V8,
        83: $V9,
        84: $Va
      }), {
        20: 26,
        22: 97,
        23: [2, 50],
        49: 98,
        63: 27,
        64: $V3,
        68: 99,
        69: 74,
        70: 75,
        71: $Vq,
        77: 28,
        78: 29,
        79: $V5,
        80: $V6,
        81: $V7,
        82: $V8,
        83: $V9,
        84: $Va,
        85: 36
      }, {
        20: 26,
        33: [2, 90],
        49: 101,
        62: 100,
        63: 27,
        64: $V3,
        68: 102,
        69: 74,
        70: 75,
        71: $Vq,
        77: 28,
        78: 29,
        79: $V5,
        80: $V6,
        81: $V7,
        82: $V8,
        83: $V9,
        84: $Va,
        85: 36
      }, {
        33: [1, 103]
      }, o($Vf, [2, 77]), {
        33: [2, 79]
      }, o([23, 33, 55, 67, 74], [2, 30], {
        70: 104,
        71: [1, 105]
      }), o($Vt, [2, 96]), o($Vi, $Vj, {
        72: $Vu
      }), {
        20: 26,
        49: 108,
        63: 27,
        64: $V3,
        66: 107,
        67: [2, 94],
        68: 109,
        69: 74,
        70: 75,
        71: $Vq,
        77: 28,
        78: 29,
        79: $V5,
        80: $V6,
        81: $V7,
        82: $V8,
        83: $V9,
        84: $Va,
        85: 36
      }, o($Vi, [2, 42]), {
        55: [1, 110]
      }, o($Vk, [2, 81]), {
        55: [2, 83]
      }, o($V2, [2, 13]), {
        38: 56,
        39: $Vl,
        43: 57,
        44: $Vm,
        45: 112,
        46: 111,
        47: [2, 74]
      }, o($Vo, [2, 68], {
        40: 113
      }), {
        47: [2, 18]
      }, o($V2, [2, 14]), {
        33: [1, 114]
      }, o($Vf, [2, 85]), {
        33: [2, 87]
      }, {
        33: [1, 115]
      }, {
        32: 116,
        33: [2, 60],
        73: 117,
        74: $Vv
      }, o($Vo, [2, 57]), o($Vs, [2, 59]), {
        33: [2, 66],
        37: 119,
        73: 120,
        74: $Vv
      }, o($Vo, [2, 63]), o($Vs, [2, 65]), {
        23: [1, 121]
      }, o($Vp, [2, 49]), {
        23: [2, 51]
      }, {
        33: [1, 122]
      }, o($Vf, [2, 89]), {
        33: [2, 91]
      }, o($V2, [2, 22]), o($Vt, [2, 97]), {
        72: $Vu
      }, {
        20: 26,
        49: 123,
        63: 27,
        64: $V3,
        71: $V4,
        77: 28,
        78: 29,
        79: $V5,
        80: $V6,
        81: $V7,
        82: $V8,
        83: $V9,
        84: $Va,
        85: 36
      }, {
        67: [1, 124]
      }, o($Vr, [2, 93]), {
        67: [2, 95]
      }, o($V2, [2, 23]), {
        47: [2, 19]
      }, {
        47: [2, 75]
      }, o($Vs, [2, 70], {
        20: 26,
        63: 27,
        77: 28,
        78: 29,
        85: 36,
        69: 74,
        70: 75,
        41: 125,
        49: 126,
        68: 127,
        64: $V3,
        71: $Vq,
        79: $V5,
        80: $V6,
        81: $V7,
        82: $V8,
        83: $V9,
        84: $Va
      }), o($V2, [2, 24]), o($V2, [2, 21]), {
        33: [1, 128]
      }, {
        33: [2, 61]
      }, {
        71: [1, 130],
        75: 129
      }, {
        33: [1, 131]
      }, {
        33: [2, 67]
      }, o($Vd, [2, 12]), o($Ve, [2, 26]), o($Vt, [2, 31]), o($Vg, [2, 29]), {
        33: [2, 72],
        42: 132,
        73: 133,
        74: $Vv
      }, o($Vo, [2, 69]), o($Vs, [2, 71]), o($Vb, [2, 15]), {
        71: [1, 135],
        76: [1, 134]
      }, o($Vw, [2, 98]), o($Vc, [2, 16]), {
        33: [1, 136]
      }, {
        33: [2, 73]
      }, {
        33: [2, 32]
      }, o($Vw, [2, 99]), o($Vb, [2, 17])],
      defaultActions: {
        4: [2, 1],
        55: [2, 53],
        57: [2, 20],
        61: [2, 55],
        73: [2, 79],
        81: [2, 83],
        85: [2, 18],
        89: [2, 87],
        99: [2, 51],
        102: [2, 91],
        109: [2, 95],
        111: [2, 19],
        112: [2, 75],
        117: [2, 61],
        120: [2, 67],
        133: [2, 73],
        134: [2, 32]
      },
      parseError: function parseError(str, hash) {
        if (hash.recoverable) {
          this.trace(str);
        } else {
          var error = new Error(str);
          error.hash = hash;
          throw error;
        }
      },
      parse: function parse(input) {
        var self = this,
          stack = [0],
          vstack = [null],
          lstack = [],
          table = this.table,
          yytext = '',
          yylineno = 0,
          yyleng = 0,
          TERROR = 2,
          EOF = 1;
        var args = lstack.slice.call(arguments, 1);
        var lexer = Object.create(this.lexer);
        var sharedState = {
          yy: {}
        };
        for (var k in this.yy) {
          if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
            sharedState.yy[k] = this.yy[k];
          }
        }
        lexer.setInput(input, sharedState.yy);
        sharedState.yy.lexer = lexer;
        sharedState.yy.parser = this;
        if (typeof lexer.yylloc == 'undefined') {
          lexer.yylloc = {};
        }
        var yyloc = lexer.yylloc;
        lstack.push(yyloc);
        var ranges = lexer.options && lexer.options.ranges;
        if (typeof sharedState.yy.parseError === 'function') {
          this.parseError = sharedState.yy.parseError;
        } else {
          this.parseError = Object.getPrototypeOf(this).parseError;
        }
        var lex = function () {
          var token;
          token = lexer.lex() || EOF;
          if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
          }
          return token;
        };
        var symbol,
          state,
          action,
          r,
          yyval = {},
          p,
          len,
          newState,
          expected;
        while (true) {
          state = stack[stack.length - 1];
          if (this.defaultActions[state]) {
            action = this.defaultActions[state];
          } else {
            if (symbol === null || typeof symbol == 'undefined') {
              symbol = lex();
            }
            action = table[state] && table[state][symbol];
          }
          if (typeof action === 'undefined' || !action.length || !action[0]) {
            var errStr = '';
            expected = [];
            for (p in table[state]) {
              if (this.terminals_[p] && p > TERROR) {
                expected.push('\'' + this.terminals_[p] + '\'');
              }
            }
            if (lexer.showPosition) {
              errStr = 'Parse error on line ' + (yylineno + 1) + ':\n' + lexer.showPosition() + '\nExpecting ' + expected.join(', ') + ', got \'' + (this.terminals_[symbol] || symbol) + '\'';
            } else {
              errStr = 'Parse error on line ' + (yylineno + 1) + ': Unexpected ' + (symbol == EOF ? 'end of input' : '\'' + (this.terminals_[symbol] || symbol) + '\'');
            }
            this.parseError(errStr, {
              text: lexer.match,
              token: this.terminals_[symbol] || symbol,
              line: lexer.yylineno,
              loc: yyloc,
              expected: expected
            });
          }
          if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol);
          }
          switch (action[0]) {
            case 1:
              stack.push(symbol);
              vstack.push(lexer.yytext);
              lstack.push(lexer.yylloc);
              stack.push(action[1]);
              symbol = null;
              {
                yyleng = lexer.yyleng;
                yytext = lexer.yytext;
                yylineno = lexer.yylineno;
                yyloc = lexer.yylloc;
              }
              break;
            case 2:
              len = this.productions_[action[1]][1];
              yyval.$ = vstack[vstack.length - len];
              yyval._$ = {
                first_line: lstack[lstack.length - (len || 1)].first_line,
                last_line: lstack[lstack.length - 1].last_line,
                first_column: lstack[lstack.length - (len || 1)].first_column,
                last_column: lstack[lstack.length - 1].last_column
              };
              if (ranges) {
                yyval._$.range = [lstack[lstack.length - (len || 1)].range[0], lstack[lstack.length - 1].range[1]];
              }
              r = this.performAction.apply(yyval, [yytext, yyleng, yylineno, sharedState.yy, action[1], vstack, lstack].concat(args));
              if (typeof r !== 'undefined') {
                return r;
              }
              if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
                lstack = lstack.slice(0, -1 * len);
              }
              stack.push(this.productions_[action[1]][0]);
              vstack.push(yyval.$);
              lstack.push(yyval._$);
              newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
              stack.push(newState);
              break;
            case 3:
              return true;
          }
        }
        return true;
      }
    };
    /* generated by jison-lex 0.3.4 */
    var lexer = function () {
      var lexer = {
        EOF: 1,
        parseError: function parseError(str, hash) {
          if (this.yy.parser) {
            this.yy.parser.parseError(str, hash);
          } else {
            throw new Error(str);
          }
        },
        // resets the lexer, sets new input
        setInput: function (input, yy) {
          this.yy = yy || this.yy || {};
          this._input = input;
          this._more = this._backtrack = this.done = false;
          this.yylineno = this.yyleng = 0;
          this.yytext = this.matched = this.match = '';
          this.conditionStack = ['INITIAL'];
          this.yylloc = {
            first_line: 1,
            first_column: 0,
            last_line: 1,
            last_column: 0
          };
          if (this.options.ranges) {
            this.yylloc.range = [0, 0];
          }
          this.offset = 0;
          return this;
        },
        // consumes and returns one char from the input
        input: function () {
          var ch = this._input[0];
          this.yytext += ch;
          this.yyleng++;
          this.offset++;
          this.match += ch;
          this.matched += ch;
          var lines = ch.match(/(?:\r\n?|\n).*/g);
          if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
          } else {
            this.yylloc.last_column++;
          }
          if (this.options.ranges) {
            this.yylloc.range[1]++;
          }
          this._input = this._input.slice(1);
          return ch;
        },
        // unshifts one char (or a string) into the input
        unput: function (ch) {
          var len = ch.length;
          var lines = ch.split(/(?:\r\n?|\n)/g);
          this._input = ch + this._input;
          this.yytext = this.yytext.substr(0, this.yytext.length - len);
          //this.yyleng -= len;
          this.offset -= len;
          var oldLines = this.match.split(/(?:\r\n?|\n)/g);
          this.match = this.match.substr(0, this.match.length - 1);
          this.matched = this.matched.substr(0, this.matched.length - 1);
          if (lines.length - 1) {
            this.yylineno -= lines.length - 1;
          }
          var r = this.yylloc.range;
          this.yylloc = {
            first_line: this.yylloc.first_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.first_column,
            last_column: lines ? (lines.length === oldLines.length ? this.yylloc.first_column : 0) + oldLines[oldLines.length - lines.length].length - lines[0].length : this.yylloc.first_column - len
          };
          if (this.options.ranges) {
            this.yylloc.range = [r[0], r[0] + this.yyleng - len];
          }
          this.yyleng = this.yytext.length;
          return this;
        },
        // When called from action, caches matched text and appends it on next action
        more: function () {
          this._more = true;
          return this;
        },
        // When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
        reject: function () {
          if (this.options.backtrack_lexer) {
            this._backtrack = true;
          } else {
            return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n' + this.showPosition(), {
              text: "",
              token: null,
              line: this.yylineno
            });
          }
          return this;
        },
        // retain first n characters of the match
        less: function (n) {
          this.unput(this.match.slice(n));
        },
        // displays already matched input, i.e. for error messages
        pastInput: function () {
          var past = this.matched.substr(0, this.matched.length - this.match.length);
          return (past.length > 20 ? '...' : '') + past.substr(-20).replace(/\n/g, "");
        },
        // displays upcoming input, i.e. for error messages
        upcomingInput: function () {
          var next = this.match;
          if (next.length < 20) {
            next += this._input.substr(0, 20 - next.length);
          }
          return (next.substr(0, 20) + (next.length > 20 ? '...' : '')).replace(/\n/g, "");
        },
        // displays the character position where the lexing error occurred, i.e. for error messages
        showPosition: function () {
          var pre = this.pastInput();
          var c = new Array(pre.length + 1).join("-");
          return pre + this.upcomingInput() + "\n" + c + "^";
        },
        // test the lexed token: return FALSE when not a match, otherwise return token
        test_match: function (match, indexed_rule) {
          var token, lines, backup;
          if (this.options.backtrack_lexer) {
            // save context
            backup = {
              yylineno: this.yylineno,
              yylloc: {
                first_line: this.yylloc.first_line,
                last_line: this.last_line,
                first_column: this.yylloc.first_column,
                last_column: this.yylloc.last_column
              },
              yytext: this.yytext,
              match: this.match,
              matches: this.matches,
              matched: this.matched,
              yyleng: this.yyleng,
              offset: this.offset,
              _more: this._more,
              _input: this._input,
              yy: this.yy,
              conditionStack: this.conditionStack.slice(0),
              done: this.done
            };
            if (this.options.ranges) {
              backup.yylloc.range = this.yylloc.range.slice(0);
            }
          }
          lines = match[0].match(/(?:\r\n?|\n).*/g);
          if (lines) {
            this.yylineno += lines.length;
          }
          this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ? lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length : this.yylloc.last_column + match[0].length
          };
          this.yytext += match[0];
          this.match += match[0];
          this.matches = match;
          this.yyleng = this.yytext.length;
          if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset += this.yyleng];
          }
          this._more = false;
          this._backtrack = false;
          this._input = this._input.slice(match[0].length);
          this.matched += match[0];
          token = this.performAction.call(this, this.yy, this, indexed_rule, this.conditionStack[this.conditionStack.length - 1]);
          if (this.done && this._input) {
            this.done = false;
          }
          if (token) {
            return token;
          } else if (this._backtrack) {
            // recover context
            for (var k in backup) {
              this[k] = backup[k];
            }
            return false; // rule action called reject() implying the next rule should be tested instead.
          }

          return false;
        },
        // return next match in input
        next: function () {
          if (this.done) {
            return this.EOF;
          }
          if (!this._input) {
            this.done = true;
          }
          var token, match, tempMatch, index;
          if (!this._more) {
            this.yytext = '';
            this.match = '';
          }
          var rules = this._currentRules();
          for (var i = 0; i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
              match = tempMatch;
              index = i;
              if (this.options.backtrack_lexer) {
                token = this.test_match(tempMatch, rules[i]);
                if (token !== false) {
                  return token;
                } else if (this._backtrack) {
                  match = false;
                  continue; // rule action called reject() implying a rule MISmatch.
                } else {
                  // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
                  return false;
                }
              } else if (!this.options.flex) {
                break;
              }
            }
          }
          if (match) {
            token = this.test_match(match, rules[index]);
            if (token !== false) {
              return token;
            }
            // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
            return false;
          }
          if (this._input === "") {
            return this.EOF;
          } else {
            return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. Unrecognized text.\n' + this.showPosition(), {
              text: "",
              token: null,
              line: this.yylineno
            });
          }
        },
        // return next match that has a token
        lex: function lex() {
          var r = this.next();
          if (r) {
            return r;
          } else {
            return this.lex();
          }
        },
        // activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
        begin: function begin(condition) {
          this.conditionStack.push(condition);
        },
        // pop the previously active lexer condition state off the condition stack
        popState: function popState() {
          var n = this.conditionStack.length - 1;
          if (n > 0) {
            return this.conditionStack.pop();
          } else {
            return this.conditionStack[0];
          }
        },
        // produce the lexer rule set which is active for the currently active lexer condition state
        _currentRules: function _currentRules() {
          if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
          } else {
            return this.conditions["INITIAL"].rules;
          }
        },
        // return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
        topState: function topState(n) {
          n = this.conditionStack.length - 1 - Math.abs(n || 0);
          if (n >= 0) {
            return this.conditionStack[n];
          } else {
            return "INITIAL";
          }
        },
        // alias for begin(condition)
        pushState: function pushState(condition) {
          this.begin(condition);
        },
        // return the number of states currently on the stack
        stateStackSize: function stateStackSize() {
          return this.conditionStack.length;
        },
        options: {},
        performAction: function anonymous(yy, yy_, $avoiding_name_collisions, YY_START) {
          function strip(start, end) {
            return yy_.yytext = yy_.yytext.substring(start, yy_.yyleng - end + start);
          }
          switch ($avoiding_name_collisions) {
            case 0:
              if (yy_.yytext.slice(-2) === "\\\\") {
                strip(0, 1);
                this.begin("mu");
              } else if (yy_.yytext.slice(-1) === "\\") {
                strip(0, 1);
                this.begin("emu");
              } else {
                this.begin("mu");
              }
              if (yy_.yytext) return 15;
              break;
            case 1:
              return 15;
            case 2:
              this.popState();
              return 15;
            case 3:
              this.begin('raw');
              return 15;
            case 4:
              this.popState();
              // Should be using `this.topState()` below, but it currently
              // returns the second top instead of the first top. Opened an
              // issue about it at https://github.com/zaach/jison/issues/291
              if (this.conditionStack[this.conditionStack.length - 1] === 'raw') {
                return 15;
              } else {
                strip(5, 9);
                return 18;
              }
            case 5:
              return 15;
            case 6:
              this.popState();
              return 14;
            case 7:
              return 64;
            case 8:
              return 67;
            case 9:
              return 19;
            case 10:
              this.popState();
              this.begin('raw');
              return 23;
            case 11:
              return 56;
            case 12:
              return 60;
            case 13:
              return 29;
            case 14:
              return 47;
            case 15:
              this.popState();
              return 44;
            case 16:
              this.popState();
              return 44;
            case 17:
              return 34;
            case 18:
              return 39;
            case 19:
              return 52;
            case 20:
              return 48;
            case 21:
              this.unput(yy_.yytext);
              this.popState();
              this.begin('com');
              break;
            case 22:
              this.popState();
              return 14;
            case 23:
              return 48;
            case 24:
              return 72;
            case 25:
              return 71;
            case 26:
              return 71;
            case 27:
              return 86;
            case 28:
              // ignore whitespace
              break;
            case 29:
              this.popState();
              return 55;
            case 30:
              this.popState();
              return 33;
            case 31:
              yy_.yytext = strip(1, 2).replace(/\\"/g, '"');
              return 79;
            case 32:
              yy_.yytext = strip(1, 2).replace(/\\'/g, "'");
              return 79;
            case 33:
              return 84;
            case 34:
              return 81;
            case 35:
              return 81;
            case 36:
              return 82;
            case 37:
              return 83;
            case 38:
              return 80;
            case 39:
              return 74;
            case 40:
              return 76;
            case 41:
              return 71;
            case 42:
              yy_.yytext = yy_.yytext.replace(/\\([\\\]])/g, '$1');
              return 71;
            case 43:
              return 'INVALID';
            case 44:
              return 5;
          }
        },
        rules: [/^(?:[^\x00]*?(?=(\{\{)))/, /^(?:[^\x00]+)/, /^(?:[^\x00]{2,}?(?=(\{\{|\\\{\{|\\\\\{\{|$)))/, /^(?:\{\{\{\{(?=[^/]))/, /^(?:\{\{\{\{\/[^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=[=}\s\/.])\}\}\}\})/, /^(?:[^\x00]+?(?=(\{\{\{\{)))/, /^(?:[\s\S]*?--(~)?\}\})/, /^(?:\()/, /^(?:\))/, /^(?:\{\{\{\{)/, /^(?:\}\}\}\})/, /^(?:\{\{(~)?>)/, /^(?:\{\{(~)?#>)/, /^(?:\{\{(~)?#\*?)/, /^(?:\{\{(~)?\/)/, /^(?:\{\{(~)?\^\s*(~)?\}\})/, /^(?:\{\{(~)?\s*else\s*(~)?\}\})/, /^(?:\{\{(~)?\^)/, /^(?:\{\{(~)?\s*else\b)/, /^(?:\{\{(~)?\{)/, /^(?:\{\{(~)?&)/, /^(?:\{\{(~)?!--)/, /^(?:\{\{(~)?![\s\S]*?\}\})/, /^(?:\{\{(~)?\*?)/, /^(?:=)/, /^(?:\.\.)/, /^(?:\.(?=([=~}\s\/.)|])))/, /^(?:[\/.])/, /^(?:\s+)/, /^(?:\}(~)?\}\})/, /^(?:(~)?\}\})/, /^(?:"(\\["]|[^"])*")/, /^(?:'(\\[']|[^'])*')/, /^(?:@)/, /^(?:true(?=([~}\s)])))/, /^(?:false(?=([~}\s)])))/, /^(?:undefined(?=([~}\s)])))/, /^(?:null(?=([~}\s)])))/, /^(?:-?[0-9]+(?:\.[0-9]+)?(?=([~}\s)])))/, /^(?:as\s+\|)/, /^(?:\|)/, /^(?:([^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=([=~}\s\/.)|]))))/, /^(?:\[(\\\]|[^\]])*\])/, /^(?:.)/, /^(?:$)/],
        conditions: {
          "mu": {
            "rules": [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44],
            "inclusive": false
          },
          "emu": {
            "rules": [2],
            "inclusive": false
          },
          "com": {
            "rules": [6],
            "inclusive": false
          },
          "raw": {
            "rules": [3, 4, 5],
            "inclusive": false
          },
          "INITIAL": {
            "rules": [0, 1, 44],
            "inclusive": true
          }
        }
      };
      return lexer;
    }();
    parser.lexer = lexer;
    function Parser() {
      this.yy = {};
    }
    Parser.prototype = parser;
    parser.Parser = Parser;
    return new Parser();
  }();

  /* eslint-disable new-cap */
  _exports.parser = parser;
  function print(ast) {
    return new PrintVisitor().accept(ast);
  }
  function PrintVisitor() {
    this.padding = 0;
  }
  PrintVisitor.prototype = new Visitor();
  PrintVisitor.prototype.pad = function (string) {
    var out = '';
    for (var i = 0, l = this.padding; i < l; i++) {
      out += '  ';
    }
    out += string + '\n';
    return out;
  };
  PrintVisitor.prototype.Program = function (program) {
    var out = '',
      body = program.body,
      i,
      l;
    if (program.blockParams) {
      var blockParams = 'BLOCK PARAMS: [';
      for (i = 0, l = program.blockParams.length; i < l; i++) {
        blockParams += ' ' + program.blockParams[i];
      }
      blockParams += ' ]';
      out += this.pad(blockParams);
    }
    for (i = 0, l = body.length; i < l; i++) {
      out += this.accept(body[i]);
    }
    this.padding--;
    return out;
  };
  PrintVisitor.prototype.MustacheStatement = function (mustache) {
    return this.pad('{{ ' + this.SubExpression(mustache) + ' }}');
  };
  PrintVisitor.prototype.Decorator = function (mustache) {
    return this.pad('{{ DIRECTIVE ' + this.SubExpression(mustache) + ' }}');
  };
  PrintVisitor.prototype.BlockStatement = PrintVisitor.prototype.DecoratorBlock = function (block) {
    var out = '';
    out += this.pad((block.type === 'DecoratorBlock' ? 'DIRECTIVE ' : '') + 'BLOCK:');
    this.padding++;
    out += this.pad(this.SubExpression(block));
    if (block.program) {
      out += this.pad('PROGRAM:');
      this.padding++;
      out += this.accept(block.program);
      this.padding--;
    }
    if (block.inverse) {
      if (block.program) {
        this.padding++;
      }
      out += this.pad('{{^}}');
      this.padding++;
      out += this.accept(block.inverse);
      this.padding--;
      if (block.program) {
        this.padding--;
      }
    }
    this.padding--;
    return out;
  };
  PrintVisitor.prototype.PartialStatement = function (partial) {
    var content = 'PARTIAL:' + partial.name.original;
    if (partial.params[0]) {
      content += ' ' + this.accept(partial.params[0]);
    }
    if (partial.hash) {
      content += ' ' + this.accept(partial.hash);
    }
    return this.pad('{{> ' + content + ' }}');
  };
  PrintVisitor.prototype.PartialBlockStatement = function (partial) {
    var content = 'PARTIAL BLOCK:' + partial.name.original;
    if (partial.params[0]) {
      content += ' ' + this.accept(partial.params[0]);
    }
    if (partial.hash) {
      content += ' ' + this.accept(partial.hash);
    }
    content += ' ' + this.pad('PROGRAM:');
    this.padding++;
    content += this.accept(partial.program);
    this.padding--;
    return this.pad('{{> ' + content + ' }}');
  };
  PrintVisitor.prototype.ContentStatement = function (content) {
    return this.pad("CONTENT[ '" + content.value + "' ]");
  };
  PrintVisitor.prototype.CommentStatement = function (comment) {
    return this.pad("{{! '" + comment.value + "' }}");
  };
  PrintVisitor.prototype.SubExpression = function (sexpr) {
    var params = sexpr.params,
      paramStrings = [],
      hash;
    for (var i = 0, l = params.length; i < l; i++) {
      paramStrings.push(this.accept(params[i]));
    }
    params = '[' + paramStrings.join(', ') + ']';
    hash = sexpr.hash ? ' ' + this.accept(sexpr.hash) : '';
    return this.accept(sexpr.path) + ' ' + params + hash;
  };
  PrintVisitor.prototype.PathExpression = function (id) {
    var path = id.parts.join('/');
    return (id.data ? '@' : '') + 'PATH:' + path;
  };
  PrintVisitor.prototype.StringLiteral = function (string) {
    return '"' + string.value + '"';
  };
  PrintVisitor.prototype.NumberLiteral = function (number) {
    return 'NUMBER{' + number.value + '}';
  };
  PrintVisitor.prototype.BooleanLiteral = function (bool) {
    return 'BOOLEAN{' + bool.value + '}';
  };
  PrintVisitor.prototype.UndefinedLiteral = function () {
    return 'UNDEFINED';
  };
  PrintVisitor.prototype.NullLiteral = function () {
    return 'NULL';
  };
  PrintVisitor.prototype.Hash = function (hash) {
    var pairs = hash.pairs,
      joinedPairs = [];
    for (var i = 0, l = pairs.length; i < l; i++) {
      joinedPairs.push(this.accept(pairs[i]));
    }
    return 'HASH{' + joinedPairs.join(', ') + '}';
  };
  PrintVisitor.prototype.HashPair = function (pair) {
    return pair.key + '=' + this.accept(pair.value);
  };
  /* eslint-enable new-cap */

  function validateClose(open, close) {
    close = close.path ? close.path.original : close;
    if (open.path.original !== close) {
      var errorNode = {
        loc: open.path.loc
      };
      throw new Exception(open.path.original + " doesn't match " + close, errorNode);
    }
  }
  function SourceLocation(source, locInfo) {
    this.source = source;
    this.start = {
      line: locInfo.first_line,
      column: locInfo.first_column
    };
    this.end = {
      line: locInfo.last_line,
      column: locInfo.last_column
    };
  }
  function id(token) {
    if (/^\[.*\]$/.test(token)) {
      return token.substring(1, token.length - 1);
    } else {
      return token;
    }
  }
  function stripFlags(open, close) {
    return {
      open: open.charAt(2) === '~',
      close: close.charAt(close.length - 3) === '~'
    };
  }
  function stripComment(comment) {
    return comment.replace(/^\{\{~?!-?-?/, '').replace(/-?-?~?\}\}$/, '');
  }
  function preparePath(data, parts, loc) {
    loc = this.locInfo(loc);
    var original = data ? '@' : '',
      dig = [],
      depth = 0;
    for (var i = 0, l = parts.length; i < l; i++) {
      var part = parts[i].part,
        // If we have [] syntax then we do not treat path references as operators,
        // i.e. foo.[this] resolves to approximately context.foo['this']
        isLiteral = parts[i].original !== part;
      original += (parts[i].separator || '') + part;
      if (!isLiteral && (part === '..' || part === '.' || part === 'this')) {
        if (dig.length > 0) {
          throw new Exception('Invalid path: ' + original, {
            loc: loc
          });
        } else if (part === '..') {
          depth++;
        }
      } else {
        dig.push(part);
      }
    }
    return {
      type: 'PathExpression',
      data: data,
      depth: depth,
      parts: dig,
      original: original,
      loc: loc
    };
  }
  function prepareMustache(path, params, hash, open, strip, locInfo) {
    // Must use charAt to support IE pre-10
    var escapeFlag = open.charAt(3) || open.charAt(2),
      escaped = escapeFlag !== '{' && escapeFlag !== '&';
    var decorator = /\*/.test(open);
    return {
      type: decorator ? 'Decorator' : 'MustacheStatement',
      path: path,
      params: params,
      hash: hash,
      escaped: escaped,
      strip: strip,
      loc: this.locInfo(locInfo)
    };
  }
  function prepareRawBlock(openRawBlock, contents, close, locInfo) {
    validateClose(openRawBlock, close);
    locInfo = this.locInfo(locInfo);
    var program = {
      type: 'Program',
      body: contents,
      strip: {},
      loc: locInfo
    };
    return {
      type: 'BlockStatement',
      path: openRawBlock.path,
      params: openRawBlock.params,
      hash: openRawBlock.hash,
      program: program,
      openStrip: {},
      inverseStrip: {},
      closeStrip: {},
      loc: locInfo
    };
  }
  function prepareBlock(openBlock, program, inverseAndProgram, close, inverted, locInfo) {
    if (close && close.path) {
      validateClose(openBlock, close);
    }
    var decorator = /\*/.test(openBlock.open);
    program.blockParams = openBlock.blockParams;
    var inverse, inverseStrip;
    if (inverseAndProgram) {
      if (decorator) {
        throw new Exception('Unexpected inverse block on decorator', inverseAndProgram);
      }
      if (inverseAndProgram.chain) {
        inverseAndProgram.program.body[0].closeStrip = close.strip;
      }
      inverseStrip = inverseAndProgram.strip;
      inverse = inverseAndProgram.program;
    }
    if (inverted) {
      inverted = inverse;
      inverse = program;
      program = inverted;
    }
    return {
      type: decorator ? 'DecoratorBlock' : 'BlockStatement',
      path: openBlock.path,
      params: openBlock.params,
      hash: openBlock.hash,
      program: program,
      inverse: inverse,
      openStrip: openBlock.strip,
      inverseStrip: inverseStrip,
      closeStrip: close && close.strip,
      loc: this.locInfo(locInfo)
    };
  }
  function prepareProgram(statements, loc) {
    if (!loc && statements.length) {
      var firstLoc = statements[0].loc,
        lastLoc = statements[statements.length - 1].loc;
      /* istanbul ignore else */
      if (firstLoc && lastLoc) {
        loc = {
          source: firstLoc.source,
          start: {
            line: firstLoc.start.line,
            column: firstLoc.start.column
          },
          end: {
            line: lastLoc.end.line,
            column: lastLoc.end.column
          }
        };
      }
    }
    return {
      type: 'Program',
      body: statements,
      strip: {},
      loc: loc
    };
  }
  function preparePartialBlock(open, program, close, locInfo) {
    validateClose(open, close);
    return {
      type: 'PartialBlockStatement',
      name: open.path,
      params: open.params,
      hash: open.hash,
      program: program,
      openStrip: open.strip,
      closeStrip: close && close.strip,
      loc: this.locInfo(locInfo)
    };
  }
  var Helpers = /*#__PURE__*/Object.freeze({
    __proto__: null,
    SourceLocation: SourceLocation,
    id: id,
    stripFlags: stripFlags,
    stripComment: stripComment,
    preparePath: preparePath,
    prepareMustache: prepareMustache,
    prepareRawBlock: prepareRawBlock,
    prepareBlock: prepareBlock,
    prepareProgram: prepareProgram,
    preparePartialBlock: preparePartialBlock
  });
  var baseHelpers = {};
  for (var helper in Helpers) {
    if (Object.prototype.hasOwnProperty.call(Helpers, helper)) {
      baseHelpers[helper] = Helpers[helper];
    }
  }
  function parseWithoutProcessing(input, options) {
    // Just return if an already-compiled AST was passed in.
    if (input.type === 'Program') {
      return input;
    }
    parser.yy = baseHelpers;
    // Altering the shared object here, but this is ok as parser is a sync operation
    parser.yy.locInfo = function (locInfo) {
      return new SourceLocation(options && options.srcName, locInfo);
    };
    var ast = parser.parse(input);
    return ast;
  }
  function parse(input, options) {
    var ast = parseWithoutProcessing(input, options);
    var strip = new WhitespaceControl(options);
    return strip.accept(ast);
  }
});
define("ember-babel", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.assertThisInitialized = assertThisInitialized;
  _exports.classCallCheck = classCallCheck;
  _exports.createClass = createClass;
  _exports.createForOfIteratorHelperLoose = createForOfIteratorHelperLoose;
  _exports.createSuper = createSuper;
  _exports.inheritsLoose = inheritsLoose;
  _exports.objectDestructuringEmpty = objectDestructuringEmpty;
  _exports.possibleConstructorReturn = possibleConstructorReturn;
  _exports.taggedTemplateLiteralLoose = taggedTemplateLiteralLoose;
  _exports.wrapNativeSuper = wrapNativeSuper;
  /* globals Reflect */

  var setPrototypeOf = Object.setPrototypeOf;
  var getPrototypeOf = Object.getPrototypeOf;
  var hasReflectConstruct = typeof Reflect === 'object' && typeof Reflect.construct === 'function';
  var nativeWrapperCache = new Map();

  // Super minimal version of Babel's wrapNativeSuper. We only use this for
  // extending Function, for ComputedDecoratorImpl and AliasDecoratorImpl. We know
  // we will never directly create an instance of these classes so no need to
  // include `construct` code or other helpers.
  function wrapNativeSuper(Class) {
    if (nativeWrapperCache.has(Class)) {
      return nativeWrapperCache.get(Class);
    }
    function Wrapper() {}
    Wrapper.prototype = Object.create(Class.prototype, {
      constructor: {
        value: Wrapper,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    nativeWrapperCache.set(Class, Wrapper);
    return setPrototypeOf(Wrapper, Class);
  }
  function classCallCheck(instance, Constructor) {
    if (true /* DEBUG */) {
      if (!(instance instanceof Constructor)) {
        throw new TypeError('Cannot call a class as a function');
      }
    }
  }

  /*
    Overrides default `inheritsLoose` to _also_ call `Object.setPrototypeOf`.
    This is needed so that we can use `loose` option with the
    `@babel/plugin-transform-classes` (because we want simple assignment to the
    prototype wherever possible) but also keep our constructor based prototypal
    inheritance working properly
  */
  function inheritsLoose(subClass, superClass) {
    if (true /* DEBUG */) {
      if (typeof superClass !== 'function' && superClass !== null) {
        throw new TypeError('Super expression must either be null or a function');
      }
    }
    subClass.prototype = Object.create(superClass === null ? null : superClass.prototype, {
      constructor: {
        value: subClass,
        writable: true,
        configurable: true
      }
    });
    if (superClass !== null) {
      setPrototypeOf(subClass, superClass);
    }
  }
  function taggedTemplateLiteralLoose(strings, raw) {
    if (!raw) {
      raw = strings.slice(0);
    }
    strings.raw = raw;
    return strings;
  }
  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ('value' in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  /*
    Differs from default implementation by avoiding boolean coercion of
    `protoProps` and `staticProps`.
  */
  function createClass(Constructor, protoProps, staticProps) {
    if (protoProps !== null && protoProps !== undefined) {
      _defineProperties(Constructor.prototype, protoProps);
    }
    if (staticProps !== null && staticProps !== undefined) {
      _defineProperties(Constructor, staticProps);
    }
    return Constructor;
  }
  function assertThisInitialized(self) {
    if (true /* DEBUG */ && self === void 0) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }
    return self;
  }

  /*
    Adds `DEBUG` guard to error being thrown, and avoids boolean coercion of `call`.
  */
  function possibleConstructorReturn(self, call) {
    if (typeof call === 'object' && call !== null || typeof call === 'function') {
      return call;
    }
    return assertThisInitialized(self);
  }
  function objectDestructuringEmpty(obj) {
    if (true /* DEBUG */ && (obj === null || obj === undefined)) {
      throw new TypeError('Cannot destructure undefined');
    }
  }

  /*
    Differs from default implementation by checking for _any_ `Reflect.construct`
    (the default implementation tries to ensure that `Reflect.construct` is truly
    the native one).

    Original source: https://github.com/babel/babel/blob/v7.9.2/packages/babel-helpers/src/helpers.js#L738-L757
  */
  function createSuper(Derived) {
    return function () {
      var Super = getPrototypeOf(Derived);
      var result;
      if (hasReflectConstruct) {
        // NOTE: This doesn't work if this.__proto__.constructor has been modified.
        var NewTarget = getPrototypeOf(this).constructor;
        result = Reflect.construct(Super, arguments, NewTarget);
      } else {
        result = Super.apply(this, arguments);
      }
      return possibleConstructorReturn(this, result);
    };
  }

  /*
    Does not differ from default implementation.
  */
  function arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    var arr2 = new Array(len);
    for (var i = 0; i < len; i++) {
      arr2[i] = arr[i];
    }
    return arr2;
  }

  /*
    Does not differ from default implementation.
  */
  function unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === 'string') return arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === 'Object' && o.constructor) n = o.constructor.name;
    if (n === 'Map' || n === 'Set') return Array.from(n);
    if (n === 'Arguments' || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return arrayLikeToArray(o, minLen);
  }

  /*
    Does not differ from default implementation.
  */
  function createForOfIteratorHelperLoose(o) {
    var i = 0;
    if (typeof Symbol === 'undefined' || o[Symbol.iterator] == null) {
      // Fallback for engines without symbol support
      if (Array.isArray(o) || (o = unsupportedIterableToArray(o))) return function () {
        if (i >= o.length) return {
          done: true
        };
        return {
          done: false,
          value: o[i++]
        };
      };
      throw new TypeError('Invalid attempt to iterate non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.');
    }
    i = o[Symbol.iterator]();
    return i.next.bind(i);
  }
});
define("ember-template-compiler/index", ["exports", "@ember/-internals/environment", "@ember/canary-features", "@glimmer/syntax", "ember/version", "require", "ember-template-compiler/lib/system/precompile", "ember-template-compiler/lib/system/compile", "ember-template-compiler/lib/system/compile-options", "ember-template-compiler/lib/plugins/index", "@glimmer/compiler", "ember-template-compiler/lib/system/bootstrap", "ember-template-compiler/lib/system/initializer"], function (_exports, _environment, _canaryFeatures, _GlimmerSyntax, _version, _require, _precompile, _compile, _compileOptions, _index, _compiler, _bootstrap, _initializer) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  Object.defineProperty(_exports, "RESOLUTION_MODE_TRANSFORMS", {
    enumerable: true,
    get: function () {
      return _index.RESOLUTION_MODE_TRANSFORMS;
    }
  });
  Object.defineProperty(_exports, "STRICT_MODE_TRANSFORMS", {
    enumerable: true,
    get: function () {
      return _index.STRICT_MODE_TRANSFORMS;
    }
  });
  Object.defineProperty(_exports, "VERSION", {
    enumerable: true,
    get: function () {
      return _version.default;
    }
  });
  _exports._GlimmerSyntax = _exports._Ember = void 0;
  Object.defineProperty(_exports, "_buildCompileOptions", {
    enumerable: true,
    get: function () {
      return _compileOptions.buildCompileOptions;
    }
  });
  Object.defineProperty(_exports, "_precompile", {
    enumerable: true,
    get: function () {
      return _compiler.precompile;
    }
  });
  Object.defineProperty(_exports, "_preprocess", {
    enumerable: true,
    get: function () {
      return _GlimmerSyntax.preprocess;
    }
  });
  Object.defineProperty(_exports, "_print", {
    enumerable: true,
    get: function () {
      return _GlimmerSyntax.print;
    }
  });
  Object.defineProperty(_exports, "_transformsFor", {
    enumerable: true,
    get: function () {
      return _compileOptions.transformsFor;
    }
  });
  Object.defineProperty(_exports, "compile", {
    enumerable: true,
    get: function () {
      return _compile.default;
    }
  });
  Object.defineProperty(_exports, "compileOptions", {
    enumerable: true,
    get: function () {
      return _compileOptions.default;
    }
  });
  Object.defineProperty(_exports, "precompile", {
    enumerable: true,
    get: function () {
      return _precompile.default;
    }
  });
  _exports._GlimmerSyntax = _GlimmerSyntax;
  var _Ember;
  _exports._Ember = _Ember;
  try {
    _exports._Ember = _Ember = (0, _require.default)("ember");
  } catch (e) {
    _exports._Ember = _Ember = {
      ENV: _environment.ENV,
      FEATURES: _canaryFeatures.FEATURES,
      VERSION: _version.default
    };
  }
});
define("ember-template-compiler/lib/plugins/assert-against-attrs", ["exports", "@ember/debug", "ember-template-compiler/lib/system/calculate-location-display"], function (_exports, _debug, _calculateLocationDisplay) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = assertAgainstAttrs;
  /**
   @module ember
  */
  /**
    A Glimmer2 AST transformation that asserts against

    ```handlebars
    {{attrs.foo.bar}}
    ```

    ...as well as `{{#if attrs.foo}}`, `{{deeply (nested attrs.foobar.baz)}}`.

    @private
    @class AssertAgainstAttrs
  */
  function assertAgainstAttrs(env) {
    var _env$meta;
    var {
      builders: b
    } = env.syntax;
    var moduleName = (_env$meta = env.meta) == null ? void 0 : _env$meta.moduleName;
    var stack = [[]];
    function updateBlockParamsStack(blockParams) {
      var parent = stack[stack.length - 1];
      (true && !(parent) && (0, _debug.assert)('has parent', parent));
      stack.push(parent.concat(blockParams));
    }
    return {
      name: 'assert-against-attrs',
      visitor: {
        Program: {
          enter(node) {
            updateBlockParamsStack(node.blockParams);
          },
          exit() {
            stack.pop();
          }
        },
        ElementNode: {
          enter(node) {
            updateBlockParamsStack(node.blockParams);
          },
          exit() {
            stack.pop();
          }
        },
        PathExpression(node) {
          if (isAttrs(node, stack[stack.length - 1])) {
            var path = b.path(node.original.substring(6));
            (true && !(node.this !== false) && (0, _debug.assert)("Using {{attrs}} to reference named arguments is not supported. {{attrs." + path.original + "}} should be updated to {{@" + path.original + "}}. " + (0, _calculateLocationDisplay.default)(moduleName, node.loc), node.this !== false));
          }
        }
      }
    };
  }
  function isAttrs(node, symbols) {
    var name = node.parts[0];
    if (name && symbols.indexOf(name) !== -1) {
      return false;
    }
    if (name === 'attrs') {
      if (node.this === true) {
        node.parts.shift();
        node.original = node.original.slice(5);
      }
      return true;
    }
    return false;
  }
});
define("ember-template-compiler/lib/plugins/assert-against-named-outlets", ["exports", "@ember/debug", "ember-template-compiler/lib/system/calculate-location-display"], function (_exports, _debug, _calculateLocationDisplay) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = assertAgainstNamedOutlets;
  /**
   @module ember
  */
  /**
    Prevents usage of named outlets, a legacy concept in Ember removed in 4.0.

    @private
    @class AssertAgainstNamedOutlets
  */
  function assertAgainstNamedOutlets(env) {
    var _env$meta;
    var moduleName = (_env$meta = env.meta) == null ? void 0 : _env$meta.moduleName;
    return {
      name: 'assert-against-named-outlets',
      visitor: {
        MustacheStatement(node) {
          if (node.path.type === 'PathExpression' && node.path.original === 'outlet' && node.params[0]) {
            var sourceInformation = (0, _calculateLocationDisplay.default)(moduleName, node.loc);
            (true && !(false) && (0, _debug.assert)("Named outlets were removed in Ember 4.0. See https://deprecations.emberjs.com/v3.x#toc_route-render-template for guidance on alternative APIs for named outlet use cases. " + sourceInformation));
          }
        }
      }
    };
  }
});
define("ember-template-compiler/lib/plugins/assert-input-helper-without-block", ["exports", "@ember/debug", "ember-template-compiler/lib/system/calculate-location-display", "ember-template-compiler/lib/plugins/utils"], function (_exports, _debug, _calculateLocationDisplay, _utils) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = errorOnInputWithContent;
  function errorOnInputWithContent(env) {
    var _env$meta;
    var moduleName = (_env$meta = env.meta) == null ? void 0 : _env$meta.moduleName;
    return {
      name: 'assert-input-helper-without-block',
      visitor: {
        BlockStatement(node) {
          if ((0, _utils.isPath)(node.path) && node.path.original === 'input') {
            (true && !(false) && (0, _debug.assert)(assertMessage(moduleName, node)));
          }
        }
      }
    };
  }
  function assertMessage(moduleName, node) {
    var sourceInformation = (0, _calculateLocationDisplay.default)(moduleName, node.loc);
    return "The {{input}} helper cannot be used in block form. " + sourceInformation;
  }
});
define("ember-template-compiler/lib/plugins/assert-reserved-named-arguments", ["exports", "@ember/debug", "ember-template-compiler/lib/system/calculate-location-display"], function (_exports, _debug, _calculateLocationDisplay) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = assertReservedNamedArguments;
  function assertReservedNamedArguments(env) {
    var _env$meta;
    var moduleName = (_env$meta = env.meta) == null ? void 0 : _env$meta.moduleName;
    return {
      name: 'assert-reserved-named-arguments',
      visitor: {
        // In general, we don't assert on the invocation side to avoid creating migration
        // hazards (e.g. using angle bracket to invoke a classic component that uses
        // `this.someReservedName`. However, we want to avoid leaking special internal
        // things, such as `__ARGS__`, so those would need to be asserted on both sides.
        AttrNode(_ref) {
          var {
            name,
            loc
          } = _ref;
          if (name === '@__ARGS__') {
            (true && !(false) && (0, _debug.assert)(assertMessage(name) + " " + (0, _calculateLocationDisplay.default)(moduleName, loc)));
          }
        },
        HashPair(_ref2) {
          var {
            key,
            loc
          } = _ref2;
          if (key === '__ARGS__') {
            (true && !(false) && (0, _debug.assert)(assertMessage(key) + " " + (0, _calculateLocationDisplay.default)(moduleName, loc)));
          }
        },
        PathExpression(_ref3) {
          var {
            original,
            loc
          } = _ref3;
          if (isReserved(original)) {
            (true && !(false) && (0, _debug.assert)(assertMessage(original) + " " + (0, _calculateLocationDisplay.default)(moduleName, loc)));
          }
        }
      }
    };
  }
  var RESERVED = ['@arguments', '@args', '@block', '@else'];
  function isReserved(name) {
    return RESERVED.indexOf(name) !== -1 || Boolean(name.match(/^@[^a-z]/));
  }
  function assertMessage(name) {
    return "'" + name + "' is reserved.";
  }
});
define("ember-template-compiler/lib/plugins/assert-splattribute-expression", ["exports", "@ember/debug", "ember-template-compiler/lib/system/calculate-location-display"], function (_exports, _debug, _calculateLocationDisplay) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = assertSplattributeExpressions;
  function assertSplattributeExpressions(env) {
    var _env$meta;
    var moduleName = (_env$meta = env.meta) == null ? void 0 : _env$meta.moduleName;
    return {
      name: 'assert-splattribute-expressions',
      visitor: {
        PathExpression(_ref) {
          var {
            original,
            loc
          } = _ref;
          if (original === '...attributes') {
            (true && !(false) && (0, _debug.assert)(errorMessage() + " " + (0, _calculateLocationDisplay.default)(moduleName, loc)));
          }
        }
      }
    };
  }
  function errorMessage() {
    return '`...attributes` can only be used in the element position e.g. `<div ...attributes />`. It cannot be used as a path.';
  }
});
define("ember-template-compiler/lib/plugins/index", ["exports", "ember-template-compiler/lib/plugins/assert-against-attrs", "ember-template-compiler/lib/plugins/assert-against-named-outlets", "ember-template-compiler/lib/plugins/assert-input-helper-without-block", "ember-template-compiler/lib/plugins/assert-reserved-named-arguments", "ember-template-compiler/lib/plugins/assert-splattribute-expression", "ember-template-compiler/lib/plugins/transform-action-syntax", "ember-template-compiler/lib/plugins/transform-each-in-into-each", "ember-template-compiler/lib/plugins/transform-each-track-array", "ember-template-compiler/lib/plugins/transform-in-element", "ember-template-compiler/lib/plugins/transform-quoted-bindings-into-just-bindings", "ember-template-compiler/lib/plugins/transform-resolutions", "ember-template-compiler/lib/plugins/transform-wrap-mount-and-outlet"], function (_exports, _assertAgainstAttrs, _assertAgainstNamedOutlets, _assertInputHelperWithoutBlock, _assertReservedNamedArguments, _assertSplattributeExpression, _transformActionSyntax, _transformEachInIntoEach, _transformEachTrackArray, _transformInElement, _transformQuotedBindingsIntoJustBindings, _transformResolutions, _transformWrapMountAndOutlet) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.STRICT_MODE_TRANSFORMS = _exports.RESOLUTION_MODE_TRANSFORMS = void 0;
  // order of plugins is important
  var RESOLUTION_MODE_TRANSFORMS = Object.freeze([_transformQuotedBindingsIntoJustBindings.default, _assertReservedNamedArguments.default, _transformActionSyntax.default, _assertAgainstAttrs.default, _transformEachInIntoEach.default, _assertInputHelperWithoutBlock.default, _transformInElement.default, _assertSplattributeExpression.default, _transformEachTrackArray.default, _assertAgainstNamedOutlets.default, _transformWrapMountAndOutlet.default, _transformResolutions.default].filter(notNull));
  _exports.RESOLUTION_MODE_TRANSFORMS = RESOLUTION_MODE_TRANSFORMS;
  var STRICT_MODE_TRANSFORMS = Object.freeze([_transformQuotedBindingsIntoJustBindings.default, _assertReservedNamedArguments.default, _transformActionSyntax.default, _transformEachInIntoEach.default, _transformInElement.default, _assertSplattributeExpression.default, _transformEachTrackArray.default, _assertAgainstNamedOutlets.default, _transformWrapMountAndOutlet.default].filter(notNull));
  _exports.STRICT_MODE_TRANSFORMS = STRICT_MODE_TRANSFORMS;
  function notNull(value) {
    return value !== null;
  }
});
define("ember-template-compiler/lib/plugins/transform-action-syntax", ["exports", "ember-template-compiler/lib/plugins/utils"], function (_exports, _utils) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = transformActionSyntax;
  /**
   @module ember
  */
  /**
    A Glimmer2 AST transformation that replaces all instances of

    ```handlebars
   <button {{action 'foo'}}>
   <button onblur={{action 'foo'}}>
   <button onblur={{action (action 'foo') 'bar'}}>
    ```

    with

    ```handlebars
   <button {{action this 'foo'}}>
   <button onblur={{action this 'foo'}}>
   <button onblur={{action this (action this 'foo') 'bar'}}>
    ```

    @private
    @class TransformActionSyntax
  */
  function transformActionSyntax(_ref) {
    var {
      syntax
    } = _ref;
    var {
      builders: b
    } = syntax;
    return {
      name: 'transform-action-syntax',
      visitor: {
        ElementModifierStatement(node) {
          if (isAction(node)) {
            insertThisAsFirstParam(node, b);
          }
        },
        MustacheStatement(node) {
          if (isAction(node)) {
            insertThisAsFirstParam(node, b);
          }
        },
        SubExpression(node) {
          if (isAction(node)) {
            insertThisAsFirstParam(node, b);
          }
        }
      }
    };
  }
  function isAction(node) {
    return (0, _utils.isPath)(node.path) && node.path.original === 'action';
  }
  function insertThisAsFirstParam(node, builders) {
    node.params.unshift(builders.path('this'));
  }
});
define("ember-template-compiler/lib/plugins/transform-each-in-into-each", ["exports", "ember-template-compiler/lib/plugins/utils"], function (_exports, _utils) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = transformEachInIntoEach;
  /**
   @module ember
  */
  /**
    A Glimmer2 AST transformation that replaces all instances of

    ```handlebars
    {{#each-in iterableThing as |key value|}}
    ```

    with

    ```handlebars
    {{#each (-each-in iterableThing) as |value key|}}
    ```

    @private
    @class TransformHasBlockSyntax
  */
  function transformEachInIntoEach(env) {
    var {
      builders: b
    } = env.syntax;
    return {
      name: 'transform-each-in-into-each',
      visitor: {
        BlockStatement(node) {
          if ((0, _utils.isPath)(node.path) && node.path.original === 'each-in') {
            node.params[0] = b.sexpr(b.path('-each-in'), [node.params[0]]);
            var blockParams = node.program.blockParams;
            if (!blockParams || blockParams.length === 0) {
              // who uses {{#each-in}} without block params?!
            } else if (blockParams.length === 1) {
              // insert a dummy variable for the first slot
              // pick a name that won't parse so it won't shadow any real variables
              blockParams = ['( unused value )', blockParams[0]];
            } else {
              var key = blockParams.shift();
              var value = blockParams.shift();
              blockParams = [value, key, ...blockParams];
            }
            node.program.blockParams = blockParams;
            return b.block(b.path('each'), node.params, node.hash, node.program, node.inverse, node.loc);
          }
        }
      }
    };
  }
});
define("ember-template-compiler/lib/plugins/transform-each-track-array", ["exports", "@ember/debug", "ember-template-compiler/lib/plugins/utils"], function (_exports, _debug, _utils) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = transformEachTrackArray;
  /**
   @module ember
  */
  /**
    A Glimmer2 AST transformation that replaces all instances of

    ```handlebars
    {{#each iterableThing as |key value|}}
    ```

    with

    ```handlebars
    {{#each (-track-array iterableThing) as |key value|}}
    ```

    @private
    @class TransformHasBlockSyntax
  */
  function transformEachTrackArray(env) {
    var {
      builders: b
    } = env.syntax;
    return {
      name: 'transform-each-track-array',
      visitor: {
        BlockStatement(node) {
          if ((0, _utils.isPath)(node.path) && node.path.original === 'each') {
            var firstParam = node.params[0];
            (true && !(firstParam) && (0, _debug.assert)('has firstParam', firstParam));
            if (firstParam.type === 'SubExpression' && firstParam.path.type === 'PathExpression' && firstParam.path.original === '-each-in') {
              return;
            }
            node.params[0] = b.sexpr(b.path('-track-array'), [firstParam]);
            return b.block(b.path('each'), node.params, node.hash, node.program, node.inverse, node.loc);
          }
        }
      }
    };
  }
});
define("ember-template-compiler/lib/plugins/transform-in-element", ["exports", "@ember/debug", "ember-template-compiler/lib/plugins/utils"], function (_exports, _debug, _utils) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = transformInElement;
  /**
   @module ember
  */
  /**
    A Glimmer2 AST transformation that handles the public `{{in-element}}` as per RFC287.

    Issues a build time assertion for:

    ```handlebars
    {{#in-element someElement insertBefore="some-none-null-value"}}
      {{modal-display text=text}}
    {{/in-element}}
    ```

    @private
    @class TransformInElement
  */
  function transformInElement(env) {
    var {
      builders: b
    } = env.syntax;
    return {
      name: 'transform-in-element',
      visitor: {
        BlockStatement(node) {
          if (!(0, _utils.isPath)(node.path)) return;
          if (node.path.original === 'in-element') {
            var originalValue = node.params[0];
            if (originalValue && !env.isProduction) {
              var subExpr = b.sexpr('-in-el-null', [originalValue]);
              node.params.shift();
              node.params.unshift(subExpr);
            }
            node.hash.pairs.forEach(pair => {
              if (pair.key === 'insertBefore') {
                (true && !(pair.value.type === 'NullLiteral' || pair.value.type === 'UndefinedLiteral') && (0, _debug.assert)("Can only pass null to insertBefore in in-element, received: " + JSON.stringify(pair.value), pair.value.type === 'NullLiteral' || pair.value.type === 'UndefinedLiteral'));
              }
            });
          }
        }
      }
    };
  }
});
define("ember-template-compiler/lib/plugins/transform-quoted-bindings-into-just-bindings", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = transformQuotedBindingsIntoJustBindings;
  function transformQuotedBindingsIntoJustBindings( /* env */
  ) {
    return {
      name: 'transform-quoted-bindings-into-just-bindings',
      visitor: {
        ElementNode(node) {
          var styleAttr = getStyleAttr(node);
          if (!validStyleAttr(styleAttr)) {
            return;
          }
          styleAttr.value = styleAttr.value.parts[0];
        }
      }
    };
  }
  function validStyleAttr(attr) {
    if (!attr) {
      return false;
    }
    var value = attr.value;
    if (!value || value.type !== 'ConcatStatement' || value.parts.length !== 1) {
      return false;
    }
    var onlyPart = value.parts[0];
    return onlyPart.type === 'MustacheStatement';
  }
  function getStyleAttr(node) {
    var attributes = node.attributes;
    for (var attribute of attributes) {
      if (attribute.name === 'style') {
        return attribute;
      }
    }
    return undefined;
  }
});
define("ember-template-compiler/lib/plugins/transform-resolutions", ["exports", "@ember/debug", "@glimmer/syntax", "ember-template-compiler/lib/system/calculate-location-display", "ember-template-compiler/lib/plugins/utils"], function (_exports, _debug, _syntax, _calculateLocationDisplay, _utils) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = transformResolutions;
  /**
   @module ember
  */
  /**
    A Glimmer2 AST transformation that replaces all instances of

    ```handlebars
    {{helper "..." ...}}
    ```

    with

    ```handlebars
    {{helper (-resolve "helper:...") ...}}
    ```

    and

    ```handlebars
    {{helper ... ...}}
    ```

    with

    ```handlebars
    {{helper (-disallow-dynamic-resolution ...) ...}}
    ```

    and

    ```handlebars
    {{modifier "..." ...}}
    ```

    with

    ```handlebars
    {{modifier (-resolve "modifier:...") ...}}
    ```
    and

    ```handlebars
    {{modifier ... ...}}
    ```

    with

    ```handlebars
    {{modifier (-disallow-dynamic-resolution ...) ...}}
    ```

    @private
    @class TransformResolutions
  */
  var TARGETS = Object.freeze(['helper', 'modifier']);
  function transformResolutions(env) {
    var _env$meta;
    var {
      builders: b
    } = env.syntax;
    var moduleName = (_env$meta = env.meta) == null ? void 0 : _env$meta.moduleName;
    var {
      hasLocal,
      node: tracker
    } = (0, _utils.trackLocals)();
    var seen;
    return {
      name: 'transform-resolutions',
      visitor: {
        Template: {
          enter() {
            seen = new Set();
          },
          exit() {
            seen = undefined;
          }
        },
        Block: tracker,
        ElementNode: {
          keys: {
            children: tracker
          }
        },
        MustacheStatement(node) {
          (true && !(seen) && (0, _debug.assert)('[BUG] seen set should be available', seen));
          if (seen.has(node)) {
            return;
          }
          if ((0, _utils.isPath)(node.path) && !isLocalVariable(node.path, hasLocal) && TARGETS.indexOf(node.path.original) !== -1) {
            var result = b.mustache(node.path, transformParams(b, node.params, node.path.original, moduleName, node.loc), node.hash, node.trusting, node.loc, node.strip);
            // Avoid double/infinite-processing
            seen.add(result);
            return result;
          }
        },
        SubExpression(node) {
          (true && !(seen) && (0, _debug.assert)('[BUG] seen set should be available', seen));
          if (seen.has(node)) {
            return;
          }
          if ((0, _utils.isPath)(node.path) && !isLocalVariable(node.path, hasLocal) && TARGETS.indexOf(node.path.original) !== -1) {
            var result = b.sexpr(node.path, transformParams(b, node.params, node.path.original, moduleName, node.loc), node.hash, node.loc);
            // Avoid double/infinite-processing
            seen.add(result);
            return result;
          }
        }
      }
    };
  }
  function isLocalVariable(node, hasLocal) {
    return !node.this && node.parts.length === 1 && hasLocal(node.parts[0]);
  }
  function transformParams(b, params, type, moduleName, loc) {
    var [first, ...rest] = params;
    (true && !(first) && (0, _debug.assert)("The " + type + " keyword requires at least one positional arguments " + (0, _calculateLocationDisplay.default)(moduleName, loc), first));
    if ((0, _utils.isStringLiteral)(first)) {
      return [b.sexpr(b.path('-resolve', first.loc), [b.string(type + ":" + first.value)], undefined, first.loc), ...rest];
    } else if (true /* DEBUG */) {
      return [b.sexpr(b.path('-disallow-dynamic-resolution', first.loc), [first], b.hash([b.pair('type', b.string(type), first.loc), b.pair('loc', b.string((0, _calculateLocationDisplay.default)(moduleName, loc)), first.loc), b.pair('original', b.string((0, _syntax.print)(first)))]), first.loc), ...rest];
    } else {
      return params;
    }
  }
});
define("ember-template-compiler/lib/plugins/transform-wrap-mount-and-outlet", ["exports", "ember-template-compiler/lib/plugins/utils"], function (_exports, _utils) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = transformWrapMountAndOutlet;
  /**
   @module ember
  */
  /**
    A Glimmer2 AST transformation that replaces all instances of

    ```handlebars
    {{mount "engine" model=this.model}}
    ```

    with

    ```handlebars
    {{component (-mount "engine" model=this.model)}}
    ```

    and

    ```handlebars
    {{outlet}}
    ```

    with

    ```handlebars
    {{component (-outlet)}}
    ```

    @private
    @class TransformHasBlockSyntax
  */
  function transformWrapMountAndOutlet(env) {
    var {
      builders: b
    } = env.syntax;
    var {
      hasLocal,
      node
    } = (0, _utils.trackLocals)();
    return {
      name: 'transform-wrap-mount-and-outlet',
      visitor: {
        Program: node,
        ElementNode: node,
        MustacheStatement(node) {
          if ((0, _utils.isPath)(node.path) && (node.path.original === 'mount' || node.path.original === 'outlet') && !hasLocal(node.path.original)) {
            var subexpression = b.sexpr(b.path("-" + node.path.original), node.params, node.hash, node.loc);
            return b.mustache(b.path('component'), [subexpression], b.hash(), undefined, node.loc);
          }
        }
      }
    };
  }
});
define("ember-template-compiler/lib/plugins/utils", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.isPath = isPath;
  _exports.isStringLiteral = isStringLiteral;
  _exports.isSubExpression = isSubExpression;
  _exports.trackLocals = trackLocals;
  function isPath(node) {
    return node.type === 'PathExpression';
  }
  function isSubExpression(node) {
    return node.type === 'SubExpression';
  }
  function isStringLiteral(node) {
    return node.type === 'StringLiteral';
  }
  function trackLocals() {
    var locals = new Map();
    var node = {
      enter(node) {
        for (var param of node.blockParams) {
          var value = locals.get(param) || 0;
          locals.set(param, value + 1);
        }
      },
      exit(node) {
        for (var param of node.blockParams) {
          var value = locals.get(param) - 1;
          if (value === 0) {
            locals.delete(param);
          } else {
            locals.set(param, value);
          }
        }
      }
    };
    return {
      hasLocal: key => locals.has(key),
      node
    };
  }
});
define("ember-template-compiler/lib/system/bootstrap", ["exports", "ember-template-compiler/lib/system/compile"], function (_exports, _compile) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  /**
  @module ember
  */

  /**
    Find templates stored in the head tag as script tags and make them available
    to `Ember.CoreView` in the global `Ember.TEMPLATES` object.

    Script tags with `text/x-handlebars` will be compiled
    with Ember's template compiler and are suitable for use as a view's template.

    @private
    @method bootstrap
    @for Ember.HTMLBars
    @static
    @param ctx
  */
  function bootstrap(_ref) {
    var {
      context,
      hasTemplate,
      setTemplate
    } = _ref;
    if (!context) {
      context = document;
    }
    var selector = 'script[type="text/x-handlebars"]';
    var elements = context.querySelectorAll(selector);
    for (var script of elements) {
      // Get the name of the script
      // First look for data-template-name attribute, then fall back to its
      // id if no name is found.
      var templateName = script.getAttribute('data-template-name') || script.getAttribute('id') || 'application';
      var template = void 0;
      template = (0, _compile.default)(script.innerHTML, {
        moduleName: templateName
      });
      // Check if template of same name already exists.
      if (hasTemplate(templateName)) {
        throw new Error("Template named \"" + templateName + "\" already exists.");
      }
      // For templates which have a name, we save them and then remove them from the DOM.
      setTemplate(templateName, template);
      // Remove script tag from DOM.
      script.parentNode.removeChild(script);
    }
  }
  var _default = bootstrap;
  _exports.default = _default;
});
define("ember-template-compiler/lib/system/calculate-location-display", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = calculateLocationDisplay;
  function calculateLocationDisplay(moduleName, loc) {
    var moduleInfo = '';
    if (moduleName) {
      moduleInfo += "'" + moduleName + "' ";
    }
    if (loc) {
      var {
        column,
        line
      } = loc.start || {
        line: undefined,
        column: undefined
      };
      if (line !== undefined && column !== undefined) {
        if (moduleName) {
          // only prepend @ if the moduleName was present
          moduleInfo += '@ ';
        }
        moduleInfo += "L" + line + ":C" + column;
      }
    }
    if (moduleInfo) {
      moduleInfo = "(" + moduleInfo + ") ";
    }
    return moduleInfo;
  }
});
define("ember-template-compiler/lib/system/compile-options", ["exports", "@ember/debug", "ember-template-compiler/lib/plugins/index", "ember-template-compiler/lib/system/dasherize-component-name"], function (_exports, _debug, _index, _dasherizeComponentName) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.buildCompileOptions = buildCompileOptions;
  _exports.default = compileOptions;
  _exports.transformsFor = transformsFor;
  var USER_PLUGINS = [];
  function malformedComponentLookup(string) {
    return string.indexOf('::') === -1 && string.indexOf(':') > -1;
  }
  function buildCompileOptions(_options) {
    var moduleName = _options.moduleName;
    var options = Object.assign({
      meta: {},
      isProduction: false,
      plugins: {
        ast: []
      }
    }, _options, {
      moduleName,
      customizeComponentName(tagname) {
        (true && !(!malformedComponentLookup(tagname)) && (0, _debug.assert)("You tried to invoke a component named <" + tagname + " /> in \"" + (moduleName != null ? moduleName : '[NO MODULE]') + "\", but that is not a valid name for a component. Did you mean to use the \"::\" syntax for nested components?", !malformedComponentLookup(tagname)));
        return _dasherizeComponentName.default.get(tagname);
      }
    });
    if ('locals' in options && !options.locals) {
      // Glimmer's precompile options declare `locals` like:
      //    locals?: string[]
      // but many in-use versions of babel-plugin-htmlbars-inline-precompile will
      // set locals to `null`. This used to work but only because glimmer was
      // ignoring locals for non-strict templates, and now it supports that case.
      delete options.locals;
    }
    // move `moduleName` into `meta` property
    if (options.moduleName) {
      var meta = options.meta;
      (true && !(meta) && (0, _debug.assert)('has meta', meta)); // We just set it
      meta.moduleName = options.moduleName;
    }
    return options;
  }
  function transformsFor(options) {
    return options.strictMode ? _index.STRICT_MODE_TRANSFORMS : _index.RESOLUTION_MODE_TRANSFORMS;
  }
  function compileOptions(_options) {
    if (_options === void 0) {
      _options = {};
    }
    var options = buildCompileOptions(_options);
    var builtInPlugins = transformsFor(options);
    if (!_options.plugins) {
      options.plugins = {
        ast: [...USER_PLUGINS, ...builtInPlugins]
      };
    } else {
      var potententialPugins = [...USER_PLUGINS, ...builtInPlugins];
      (true && !(options.plugins) && (0, _debug.assert)('expected plugins', options.plugins));
      var pluginsToAdd = potententialPugins.filter(plugin => {
        (true && !(options.plugins) && (0, _debug.assert)('expected plugins', options.plugins));
        return options.plugins.ast.indexOf(plugin) === -1;
      });
      options.plugins.ast = options.plugins.ast.concat(pluginsToAdd);
    }
    return options;
  }
});
define("ember-template-compiler/lib/system/compile", ["exports", "require", "ember-template-compiler/lib/system/precompile"], function (_exports, _require, _precompile) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = compile;
  /**
  @module ember
  */

  var template;
  /**
    Uses HTMLBars `compile` function to process a string into a compiled template.
    This is not present in production builds.
    @private
    @method compile
    @param {String} templateString This is the string to be compiled by HTMLBars.
    @param {Object} options This is an options hash to augment the compiler options.
  */
  function compile(templateString, options) {
    if (options === void 0) {
      options = {};
    }
    if (!template && (0, _require.has)('@ember/-internals/glimmer')) {
      template = (0, _require.default)("@ember/-internals/glimmer").template;
    }
    if (!template) {
      throw new Error('Cannot call `compile` with only the template compiler loaded. Please load `ember.debug.js` or `ember.prod.js` prior to calling `compile`.');
    }
    return template(evaluate((0, _precompile.default)(templateString, options)));
  }
  function evaluate(precompiled) {
    return new Function("return " + precompiled)();
  }
});
define("ember-template-compiler/lib/system/dasherize-component-name", ["exports", "@ember/-internals/utils"], function (_exports, _utils) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  /*
    This diverges from `Ember.String.dasherize` so that`<XFoo />` can resolve to `x-foo`.
    `Ember.String.dasherize` would resolve it to `xfoo`..
  */
  var SIMPLE_DASHERIZE_REGEXP = /[A-Z]|::/g;
  var ALPHA = /[A-Za-z0-9]/;
  var _default = new _utils.Cache(1000, key => key.replace(SIMPLE_DASHERIZE_REGEXP, (char, index) => {
    if (char === '::') {
      return '/';
    }
    if (index === 0 || !ALPHA.test(key[index - 1])) {
      return char.toLowerCase();
    }
    return "-" + char.toLowerCase();
  }));
  _exports.default = _default;
});
define("ember-template-compiler/lib/system/initializer", ["require", "ember-template-compiler/lib/system/bootstrap"], function (_require, _bootstrap) {
  "use strict";

  // Globals mode template compiler
  if ((0, _require.has)('@ember/application') && (0, _require.has)('@ember/-internals/browser-environment') && (0, _require.has)('@ember/-internals/glimmer')) {
    var emberEnv = (0, _require.default)("@ember/-internals/browser-environment");
    var emberGlimmer = (0, _require.default)("@ember/-internals/glimmer");
    var emberApp = (0, _require.default)("@ember/application");
    var Application = emberApp.default;
    var {
      hasTemplate,
      setTemplate
    } = emberGlimmer;
    var {
      hasDOM
    } = emberEnv;
    Application.initializer({
      name: 'domTemplates',
      initialize() {
        if (hasDOM) {
          (0, _bootstrap.default)({
            context: document,
            hasTemplate,
            setTemplate
          });
        }
      }
    });
  }
});
define("ember-template-compiler/lib/system/precompile", ["exports", "@glimmer/compiler", "ember-template-compiler/lib/system/compile-options"], function (_exports, _compiler, _compileOptions) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = precompile;
  /**
  @module ember
  */

  /**
    Uses HTMLBars `compile` function to process a string into a compiled template string.
    The returned string must be passed through `Ember.HTMLBars.template`.

    This is not present in production builds.

    @private
    @method precompile
    @param {String} templateString This is the string to be compiled by HTMLBars.
  */
  function precompile(templateString, options) {
    if (options === void 0) {
      options = {};
    }
    return (0, _compiler.precompile)(templateString, (0, _compileOptions.default)(options));
  }
});
define("ember/version", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  var _default = "5.0.0-beta.3";
  _exports.default = _default;
});
define("simple-html-tokenizer", ["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.Tokenizer = _exports.HTML5NamedCharRefs = _exports.EventedTokenizer = _exports.EntityParser = void 0;
  _exports.tokenize = tokenize;
  /**
   * generated from https://raw.githubusercontent.com/w3c/html/26b5126f96f736f796b9e29718138919dd513744/entities.json
   * do not edit
   */
  var namedCharRefs = {
    Aacute: "Á",
    aacute: "á",
    Abreve: "Ă",
    abreve: "ă",
    ac: "∾",
    acd: "∿",
    acE: "∾̳",
    Acirc: "Â",
    acirc: "â",
    acute: "´",
    Acy: "А",
    acy: "а",
    AElig: "Æ",
    aelig: "æ",
    af: "\u2061",
    Afr: "𝔄",
    afr: "𝔞",
    Agrave: "À",
    agrave: "à",
    alefsym: "ℵ",
    aleph: "ℵ",
    Alpha: "Α",
    alpha: "α",
    Amacr: "Ā",
    amacr: "ā",
    amalg: "⨿",
    amp: "&",
    AMP: "&",
    andand: "⩕",
    And: "⩓",
    and: "∧",
    andd: "⩜",
    andslope: "⩘",
    andv: "⩚",
    ang: "∠",
    ange: "⦤",
    angle: "∠",
    angmsdaa: "⦨",
    angmsdab: "⦩",
    angmsdac: "⦪",
    angmsdad: "⦫",
    angmsdae: "⦬",
    angmsdaf: "⦭",
    angmsdag: "⦮",
    angmsdah: "⦯",
    angmsd: "∡",
    angrt: "∟",
    angrtvb: "⊾",
    angrtvbd: "⦝",
    angsph: "∢",
    angst: "Å",
    angzarr: "⍼",
    Aogon: "Ą",
    aogon: "ą",
    Aopf: "𝔸",
    aopf: "𝕒",
    apacir: "⩯",
    ap: "≈",
    apE: "⩰",
    ape: "≊",
    apid: "≋",
    apos: "'",
    ApplyFunction: "\u2061",
    approx: "≈",
    approxeq: "≊",
    Aring: "Å",
    aring: "å",
    Ascr: "𝒜",
    ascr: "𝒶",
    Assign: "≔",
    ast: "*",
    asymp: "≈",
    asympeq: "≍",
    Atilde: "Ã",
    atilde: "ã",
    Auml: "Ä",
    auml: "ä",
    awconint: "∳",
    awint: "⨑",
    backcong: "≌",
    backepsilon: "϶",
    backprime: "‵",
    backsim: "∽",
    backsimeq: "⋍",
    Backslash: "∖",
    Barv: "⫧",
    barvee: "⊽",
    barwed: "⌅",
    Barwed: "⌆",
    barwedge: "⌅",
    bbrk: "⎵",
    bbrktbrk: "⎶",
    bcong: "≌",
    Bcy: "Б",
    bcy: "б",
    bdquo: "„",
    becaus: "∵",
    because: "∵",
    Because: "∵",
    bemptyv: "⦰",
    bepsi: "϶",
    bernou: "ℬ",
    Bernoullis: "ℬ",
    Beta: "Β",
    beta: "β",
    beth: "ℶ",
    between: "≬",
    Bfr: "𝔅",
    bfr: "𝔟",
    bigcap: "⋂",
    bigcirc: "◯",
    bigcup: "⋃",
    bigodot: "⨀",
    bigoplus: "⨁",
    bigotimes: "⨂",
    bigsqcup: "⨆",
    bigstar: "★",
    bigtriangledown: "▽",
    bigtriangleup: "△",
    biguplus: "⨄",
    bigvee: "⋁",
    bigwedge: "⋀",
    bkarow: "⤍",
    blacklozenge: "⧫",
    blacksquare: "▪",
    blacktriangle: "▴",
    blacktriangledown: "▾",
    blacktriangleleft: "◂",
    blacktriangleright: "▸",
    blank: "␣",
    blk12: "▒",
    blk14: "░",
    blk34: "▓",
    block: "█",
    bne: "=⃥",
    bnequiv: "≡⃥",
    bNot: "⫭",
    bnot: "⌐",
    Bopf: "𝔹",
    bopf: "𝕓",
    bot: "⊥",
    bottom: "⊥",
    bowtie: "⋈",
    boxbox: "⧉",
    boxdl: "┐",
    boxdL: "╕",
    boxDl: "╖",
    boxDL: "╗",
    boxdr: "┌",
    boxdR: "╒",
    boxDr: "╓",
    boxDR: "╔",
    boxh: "─",
    boxH: "═",
    boxhd: "┬",
    boxHd: "╤",
    boxhD: "╥",
    boxHD: "╦",
    boxhu: "┴",
    boxHu: "╧",
    boxhU: "╨",
    boxHU: "╩",
    boxminus: "⊟",
    boxplus: "⊞",
    boxtimes: "⊠",
    boxul: "┘",
    boxuL: "╛",
    boxUl: "╜",
    boxUL: "╝",
    boxur: "└",
    boxuR: "╘",
    boxUr: "╙",
    boxUR: "╚",
    boxv: "│",
    boxV: "║",
    boxvh: "┼",
    boxvH: "╪",
    boxVh: "╫",
    boxVH: "╬",
    boxvl: "┤",
    boxvL: "╡",
    boxVl: "╢",
    boxVL: "╣",
    boxvr: "├",
    boxvR: "╞",
    boxVr: "╟",
    boxVR: "╠",
    bprime: "‵",
    breve: "˘",
    Breve: "˘",
    brvbar: "¦",
    bscr: "𝒷",
    Bscr: "ℬ",
    bsemi: "⁏",
    bsim: "∽",
    bsime: "⋍",
    bsolb: "⧅",
    bsol: "\\",
    bsolhsub: "⟈",
    bull: "•",
    bullet: "•",
    bump: "≎",
    bumpE: "⪮",
    bumpe: "≏",
    Bumpeq: "≎",
    bumpeq: "≏",
    Cacute: "Ć",
    cacute: "ć",
    capand: "⩄",
    capbrcup: "⩉",
    capcap: "⩋",
    cap: "∩",
    Cap: "⋒",
    capcup: "⩇",
    capdot: "⩀",
    CapitalDifferentialD: "ⅅ",
    caps: "∩︀",
    caret: "⁁",
    caron: "ˇ",
    Cayleys: "ℭ",
    ccaps: "⩍",
    Ccaron: "Č",
    ccaron: "č",
    Ccedil: "Ç",
    ccedil: "ç",
    Ccirc: "Ĉ",
    ccirc: "ĉ",
    Cconint: "∰",
    ccups: "⩌",
    ccupssm: "⩐",
    Cdot: "Ċ",
    cdot: "ċ",
    cedil: "¸",
    Cedilla: "¸",
    cemptyv: "⦲",
    cent: "¢",
    centerdot: "·",
    CenterDot: "·",
    cfr: "𝔠",
    Cfr: "ℭ",
    CHcy: "Ч",
    chcy: "ч",
    check: "✓",
    checkmark: "✓",
    Chi: "Χ",
    chi: "χ",
    circ: "ˆ",
    circeq: "≗",
    circlearrowleft: "↺",
    circlearrowright: "↻",
    circledast: "⊛",
    circledcirc: "⊚",
    circleddash: "⊝",
    CircleDot: "⊙",
    circledR: "®",
    circledS: "Ⓢ",
    CircleMinus: "⊖",
    CirclePlus: "⊕",
    CircleTimes: "⊗",
    cir: "○",
    cirE: "⧃",
    cire: "≗",
    cirfnint: "⨐",
    cirmid: "⫯",
    cirscir: "⧂",
    ClockwiseContourIntegral: "∲",
    CloseCurlyDoubleQuote: "”",
    CloseCurlyQuote: "’",
    clubs: "♣",
    clubsuit: "♣",
    colon: ":",
    Colon: "∷",
    Colone: "⩴",
    colone: "≔",
    coloneq: "≔",
    comma: ",",
    commat: "@",
    comp: "∁",
    compfn: "∘",
    complement: "∁",
    complexes: "ℂ",
    cong: "≅",
    congdot: "⩭",
    Congruent: "≡",
    conint: "∮",
    Conint: "∯",
    ContourIntegral: "∮",
    copf: "𝕔",
    Copf: "ℂ",
    coprod: "∐",
    Coproduct: "∐",
    copy: "©",
    COPY: "©",
    copysr: "℗",
    CounterClockwiseContourIntegral: "∳",
    crarr: "↵",
    cross: "✗",
    Cross: "⨯",
    Cscr: "𝒞",
    cscr: "𝒸",
    csub: "⫏",
    csube: "⫑",
    csup: "⫐",
    csupe: "⫒",
    ctdot: "⋯",
    cudarrl: "⤸",
    cudarrr: "⤵",
    cuepr: "⋞",
    cuesc: "⋟",
    cularr: "↶",
    cularrp: "⤽",
    cupbrcap: "⩈",
    cupcap: "⩆",
    CupCap: "≍",
    cup: "∪",
    Cup: "⋓",
    cupcup: "⩊",
    cupdot: "⊍",
    cupor: "⩅",
    cups: "∪︀",
    curarr: "↷",
    curarrm: "⤼",
    curlyeqprec: "⋞",
    curlyeqsucc: "⋟",
    curlyvee: "⋎",
    curlywedge: "⋏",
    curren: "¤",
    curvearrowleft: "↶",
    curvearrowright: "↷",
    cuvee: "⋎",
    cuwed: "⋏",
    cwconint: "∲",
    cwint: "∱",
    cylcty: "⌭",
    dagger: "†",
    Dagger: "‡",
    daleth: "ℸ",
    darr: "↓",
    Darr: "↡",
    dArr: "⇓",
    dash: "‐",
    Dashv: "⫤",
    dashv: "⊣",
    dbkarow: "⤏",
    dblac: "˝",
    Dcaron: "Ď",
    dcaron: "ď",
    Dcy: "Д",
    dcy: "д",
    ddagger: "‡",
    ddarr: "⇊",
    DD: "ⅅ",
    dd: "ⅆ",
    DDotrahd: "⤑",
    ddotseq: "⩷",
    deg: "°",
    Del: "∇",
    Delta: "Δ",
    delta: "δ",
    demptyv: "⦱",
    dfisht: "⥿",
    Dfr: "𝔇",
    dfr: "𝔡",
    dHar: "⥥",
    dharl: "⇃",
    dharr: "⇂",
    DiacriticalAcute: "´",
    DiacriticalDot: "˙",
    DiacriticalDoubleAcute: "˝",
    DiacriticalGrave: "`",
    DiacriticalTilde: "˜",
    diam: "⋄",
    diamond: "⋄",
    Diamond: "⋄",
    diamondsuit: "♦",
    diams: "♦",
    die: "¨",
    DifferentialD: "ⅆ",
    digamma: "ϝ",
    disin: "⋲",
    div: "÷",
    divide: "÷",
    divideontimes: "⋇",
    divonx: "⋇",
    DJcy: "Ђ",
    djcy: "ђ",
    dlcorn: "⌞",
    dlcrop: "⌍",
    dollar: "$",
    Dopf: "𝔻",
    dopf: "𝕕",
    Dot: "¨",
    dot: "˙",
    DotDot: "⃜",
    doteq: "≐",
    doteqdot: "≑",
    DotEqual: "≐",
    dotminus: "∸",
    dotplus: "∔",
    dotsquare: "⊡",
    doublebarwedge: "⌆",
    DoubleContourIntegral: "∯",
    DoubleDot: "¨",
    DoubleDownArrow: "⇓",
    DoubleLeftArrow: "⇐",
    DoubleLeftRightArrow: "⇔",
    DoubleLeftTee: "⫤",
    DoubleLongLeftArrow: "⟸",
    DoubleLongLeftRightArrow: "⟺",
    DoubleLongRightArrow: "⟹",
    DoubleRightArrow: "⇒",
    DoubleRightTee: "⊨",
    DoubleUpArrow: "⇑",
    DoubleUpDownArrow: "⇕",
    DoubleVerticalBar: "∥",
    DownArrowBar: "⤓",
    downarrow: "↓",
    DownArrow: "↓",
    Downarrow: "⇓",
    DownArrowUpArrow: "⇵",
    DownBreve: "̑",
    downdownarrows: "⇊",
    downharpoonleft: "⇃",
    downharpoonright: "⇂",
    DownLeftRightVector: "⥐",
    DownLeftTeeVector: "⥞",
    DownLeftVectorBar: "⥖",
    DownLeftVector: "↽",
    DownRightTeeVector: "⥟",
    DownRightVectorBar: "⥗",
    DownRightVector: "⇁",
    DownTeeArrow: "↧",
    DownTee: "⊤",
    drbkarow: "⤐",
    drcorn: "⌟",
    drcrop: "⌌",
    Dscr: "𝒟",
    dscr: "𝒹",
    DScy: "Ѕ",
    dscy: "ѕ",
    dsol: "⧶",
    Dstrok: "Đ",
    dstrok: "đ",
    dtdot: "⋱",
    dtri: "▿",
    dtrif: "▾",
    duarr: "⇵",
    duhar: "⥯",
    dwangle: "⦦",
    DZcy: "Џ",
    dzcy: "џ",
    dzigrarr: "⟿",
    Eacute: "É",
    eacute: "é",
    easter: "⩮",
    Ecaron: "Ě",
    ecaron: "ě",
    Ecirc: "Ê",
    ecirc: "ê",
    ecir: "≖",
    ecolon: "≕",
    Ecy: "Э",
    ecy: "э",
    eDDot: "⩷",
    Edot: "Ė",
    edot: "ė",
    eDot: "≑",
    ee: "ⅇ",
    efDot: "≒",
    Efr: "𝔈",
    efr: "𝔢",
    eg: "⪚",
    Egrave: "È",
    egrave: "è",
    egs: "⪖",
    egsdot: "⪘",
    el: "⪙",
    Element: "∈",
    elinters: "⏧",
    ell: "ℓ",
    els: "⪕",
    elsdot: "⪗",
    Emacr: "Ē",
    emacr: "ē",
    empty: "∅",
    emptyset: "∅",
    EmptySmallSquare: "◻",
    emptyv: "∅",
    EmptyVerySmallSquare: "▫",
    emsp13: " ",
    emsp14: " ",
    emsp: " ",
    ENG: "Ŋ",
    eng: "ŋ",
    ensp: " ",
    Eogon: "Ę",
    eogon: "ę",
    Eopf: "𝔼",
    eopf: "𝕖",
    epar: "⋕",
    eparsl: "⧣",
    eplus: "⩱",
    epsi: "ε",
    Epsilon: "Ε",
    epsilon: "ε",
    epsiv: "ϵ",
    eqcirc: "≖",
    eqcolon: "≕",
    eqsim: "≂",
    eqslantgtr: "⪖",
    eqslantless: "⪕",
    Equal: "⩵",
    equals: "=",
    EqualTilde: "≂",
    equest: "≟",
    Equilibrium: "⇌",
    equiv: "≡",
    equivDD: "⩸",
    eqvparsl: "⧥",
    erarr: "⥱",
    erDot: "≓",
    escr: "ℯ",
    Escr: "ℰ",
    esdot: "≐",
    Esim: "⩳",
    esim: "≂",
    Eta: "Η",
    eta: "η",
    ETH: "Ð",
    eth: "ð",
    Euml: "Ë",
    euml: "ë",
    euro: "€",
    excl: "!",
    exist: "∃",
    Exists: "∃",
    expectation: "ℰ",
    exponentiale: "ⅇ",
    ExponentialE: "ⅇ",
    fallingdotseq: "≒",
    Fcy: "Ф",
    fcy: "ф",
    female: "♀",
    ffilig: "ﬃ",
    fflig: "ﬀ",
    ffllig: "ﬄ",
    Ffr: "𝔉",
    ffr: "𝔣",
    filig: "ﬁ",
    FilledSmallSquare: "◼",
    FilledVerySmallSquare: "▪",
    fjlig: "fj",
    flat: "♭",
    fllig: "ﬂ",
    fltns: "▱",
    fnof: "ƒ",
    Fopf: "𝔽",
    fopf: "𝕗",
    forall: "∀",
    ForAll: "∀",
    fork: "⋔",
    forkv: "⫙",
    Fouriertrf: "ℱ",
    fpartint: "⨍",
    frac12: "½",
    frac13: "⅓",
    frac14: "¼",
    frac15: "⅕",
    frac16: "⅙",
    frac18: "⅛",
    frac23: "⅔",
    frac25: "⅖",
    frac34: "¾",
    frac35: "⅗",
    frac38: "⅜",
    frac45: "⅘",
    frac56: "⅚",
    frac58: "⅝",
    frac78: "⅞",
    frasl: "⁄",
    frown: "⌢",
    fscr: "𝒻",
    Fscr: "ℱ",
    gacute: "ǵ",
    Gamma: "Γ",
    gamma: "γ",
    Gammad: "Ϝ",
    gammad: "ϝ",
    gap: "⪆",
    Gbreve: "Ğ",
    gbreve: "ğ",
    Gcedil: "Ģ",
    Gcirc: "Ĝ",
    gcirc: "ĝ",
    Gcy: "Г",
    gcy: "г",
    Gdot: "Ġ",
    gdot: "ġ",
    ge: "≥",
    gE: "≧",
    gEl: "⪌",
    gel: "⋛",
    geq: "≥",
    geqq: "≧",
    geqslant: "⩾",
    gescc: "⪩",
    ges: "⩾",
    gesdot: "⪀",
    gesdoto: "⪂",
    gesdotol: "⪄",
    gesl: "⋛︀",
    gesles: "⪔",
    Gfr: "𝔊",
    gfr: "𝔤",
    gg: "≫",
    Gg: "⋙",
    ggg: "⋙",
    gimel: "ℷ",
    GJcy: "Ѓ",
    gjcy: "ѓ",
    gla: "⪥",
    gl: "≷",
    glE: "⪒",
    glj: "⪤",
    gnap: "⪊",
    gnapprox: "⪊",
    gne: "⪈",
    gnE: "≩",
    gneq: "⪈",
    gneqq: "≩",
    gnsim: "⋧",
    Gopf: "𝔾",
    gopf: "𝕘",
    grave: "`",
    GreaterEqual: "≥",
    GreaterEqualLess: "⋛",
    GreaterFullEqual: "≧",
    GreaterGreater: "⪢",
    GreaterLess: "≷",
    GreaterSlantEqual: "⩾",
    GreaterTilde: "≳",
    Gscr: "𝒢",
    gscr: "ℊ",
    gsim: "≳",
    gsime: "⪎",
    gsiml: "⪐",
    gtcc: "⪧",
    gtcir: "⩺",
    gt: ">",
    GT: ">",
    Gt: "≫",
    gtdot: "⋗",
    gtlPar: "⦕",
    gtquest: "⩼",
    gtrapprox: "⪆",
    gtrarr: "⥸",
    gtrdot: "⋗",
    gtreqless: "⋛",
    gtreqqless: "⪌",
    gtrless: "≷",
    gtrsim: "≳",
    gvertneqq: "≩︀",
    gvnE: "≩︀",
    Hacek: "ˇ",
    hairsp: " ",
    half: "½",
    hamilt: "ℋ",
    HARDcy: "Ъ",
    hardcy: "ъ",
    harrcir: "⥈",
    harr: "↔",
    hArr: "⇔",
    harrw: "↭",
    Hat: "^",
    hbar: "ℏ",
    Hcirc: "Ĥ",
    hcirc: "ĥ",
    hearts: "♥",
    heartsuit: "♥",
    hellip: "…",
    hercon: "⊹",
    hfr: "𝔥",
    Hfr: "ℌ",
    HilbertSpace: "ℋ",
    hksearow: "⤥",
    hkswarow: "⤦",
    hoarr: "⇿",
    homtht: "∻",
    hookleftarrow: "↩",
    hookrightarrow: "↪",
    hopf: "𝕙",
    Hopf: "ℍ",
    horbar: "―",
    HorizontalLine: "─",
    hscr: "𝒽",
    Hscr: "ℋ",
    hslash: "ℏ",
    Hstrok: "Ħ",
    hstrok: "ħ",
    HumpDownHump: "≎",
    HumpEqual: "≏",
    hybull: "⁃",
    hyphen: "‐",
    Iacute: "Í",
    iacute: "í",
    ic: "\u2063",
    Icirc: "Î",
    icirc: "î",
    Icy: "И",
    icy: "и",
    Idot: "İ",
    IEcy: "Е",
    iecy: "е",
    iexcl: "¡",
    iff: "⇔",
    ifr: "𝔦",
    Ifr: "ℑ",
    Igrave: "Ì",
    igrave: "ì",
    ii: "ⅈ",
    iiiint: "⨌",
    iiint: "∭",
    iinfin: "⧜",
    iiota: "℩",
    IJlig: "Ĳ",
    ijlig: "ĳ",
    Imacr: "Ī",
    imacr: "ī",
    image: "ℑ",
    ImaginaryI: "ⅈ",
    imagline: "ℐ",
    imagpart: "ℑ",
    imath: "ı",
    Im: "ℑ",
    imof: "⊷",
    imped: "Ƶ",
    Implies: "⇒",
    incare: "℅",
    in: "∈",
    infin: "∞",
    infintie: "⧝",
    inodot: "ı",
    intcal: "⊺",
    int: "∫",
    Int: "∬",
    integers: "ℤ",
    Integral: "∫",
    intercal: "⊺",
    Intersection: "⋂",
    intlarhk: "⨗",
    intprod: "⨼",
    InvisibleComma: "\u2063",
    InvisibleTimes: "\u2062",
    IOcy: "Ё",
    iocy: "ё",
    Iogon: "Į",
    iogon: "į",
    Iopf: "𝕀",
    iopf: "𝕚",
    Iota: "Ι",
    iota: "ι",
    iprod: "⨼",
    iquest: "¿",
    iscr: "𝒾",
    Iscr: "ℐ",
    isin: "∈",
    isindot: "⋵",
    isinE: "⋹",
    isins: "⋴",
    isinsv: "⋳",
    isinv: "∈",
    it: "\u2062",
    Itilde: "Ĩ",
    itilde: "ĩ",
    Iukcy: "І",
    iukcy: "і",
    Iuml: "Ï",
    iuml: "ï",
    Jcirc: "Ĵ",
    jcirc: "ĵ",
    Jcy: "Й",
    jcy: "й",
    Jfr: "𝔍",
    jfr: "𝔧",
    jmath: "ȷ",
    Jopf: "𝕁",
    jopf: "𝕛",
    Jscr: "𝒥",
    jscr: "𝒿",
    Jsercy: "Ј",
    jsercy: "ј",
    Jukcy: "Є",
    jukcy: "є",
    Kappa: "Κ",
    kappa: "κ",
    kappav: "ϰ",
    Kcedil: "Ķ",
    kcedil: "ķ",
    Kcy: "К",
    kcy: "к",
    Kfr: "𝔎",
    kfr: "𝔨",
    kgreen: "ĸ",
    KHcy: "Х",
    khcy: "х",
    KJcy: "Ќ",
    kjcy: "ќ",
    Kopf: "𝕂",
    kopf: "𝕜",
    Kscr: "𝒦",
    kscr: "𝓀",
    lAarr: "⇚",
    Lacute: "Ĺ",
    lacute: "ĺ",
    laemptyv: "⦴",
    lagran: "ℒ",
    Lambda: "Λ",
    lambda: "λ",
    lang: "⟨",
    Lang: "⟪",
    langd: "⦑",
    langle: "⟨",
    lap: "⪅",
    Laplacetrf: "ℒ",
    laquo: "«",
    larrb: "⇤",
    larrbfs: "⤟",
    larr: "←",
    Larr: "↞",
    lArr: "⇐",
    larrfs: "⤝",
    larrhk: "↩",
    larrlp: "↫",
    larrpl: "⤹",
    larrsim: "⥳",
    larrtl: "↢",
    latail: "⤙",
    lAtail: "⤛",
    lat: "⪫",
    late: "⪭",
    lates: "⪭︀",
    lbarr: "⤌",
    lBarr: "⤎",
    lbbrk: "❲",
    lbrace: "{",
    lbrack: "[",
    lbrke: "⦋",
    lbrksld: "⦏",
    lbrkslu: "⦍",
    Lcaron: "Ľ",
    lcaron: "ľ",
    Lcedil: "Ļ",
    lcedil: "ļ",
    lceil: "⌈",
    lcub: "{",
    Lcy: "Л",
    lcy: "л",
    ldca: "⤶",
    ldquo: "“",
    ldquor: "„",
    ldrdhar: "⥧",
    ldrushar: "⥋",
    ldsh: "↲",
    le: "≤",
    lE: "≦",
    LeftAngleBracket: "⟨",
    LeftArrowBar: "⇤",
    leftarrow: "←",
    LeftArrow: "←",
    Leftarrow: "⇐",
    LeftArrowRightArrow: "⇆",
    leftarrowtail: "↢",
    LeftCeiling: "⌈",
    LeftDoubleBracket: "⟦",
    LeftDownTeeVector: "⥡",
    LeftDownVectorBar: "⥙",
    LeftDownVector: "⇃",
    LeftFloor: "⌊",
    leftharpoondown: "↽",
    leftharpoonup: "↼",
    leftleftarrows: "⇇",
    leftrightarrow: "↔",
    LeftRightArrow: "↔",
    Leftrightarrow: "⇔",
    leftrightarrows: "⇆",
    leftrightharpoons: "⇋",
    leftrightsquigarrow: "↭",
    LeftRightVector: "⥎",
    LeftTeeArrow: "↤",
    LeftTee: "⊣",
    LeftTeeVector: "⥚",
    leftthreetimes: "⋋",
    LeftTriangleBar: "⧏",
    LeftTriangle: "⊲",
    LeftTriangleEqual: "⊴",
    LeftUpDownVector: "⥑",
    LeftUpTeeVector: "⥠",
    LeftUpVectorBar: "⥘",
    LeftUpVector: "↿",
    LeftVectorBar: "⥒",
    LeftVector: "↼",
    lEg: "⪋",
    leg: "⋚",
    leq: "≤",
    leqq: "≦",
    leqslant: "⩽",
    lescc: "⪨",
    les: "⩽",
    lesdot: "⩿",
    lesdoto: "⪁",
    lesdotor: "⪃",
    lesg: "⋚︀",
    lesges: "⪓",
    lessapprox: "⪅",
    lessdot: "⋖",
    lesseqgtr: "⋚",
    lesseqqgtr: "⪋",
    LessEqualGreater: "⋚",
    LessFullEqual: "≦",
    LessGreater: "≶",
    lessgtr: "≶",
    LessLess: "⪡",
    lesssim: "≲",
    LessSlantEqual: "⩽",
    LessTilde: "≲",
    lfisht: "⥼",
    lfloor: "⌊",
    Lfr: "𝔏",
    lfr: "𝔩",
    lg: "≶",
    lgE: "⪑",
    lHar: "⥢",
    lhard: "↽",
    lharu: "↼",
    lharul: "⥪",
    lhblk: "▄",
    LJcy: "Љ",
    ljcy: "љ",
    llarr: "⇇",
    ll: "≪",
    Ll: "⋘",
    llcorner: "⌞",
    Lleftarrow: "⇚",
    llhard: "⥫",
    lltri: "◺",
    Lmidot: "Ŀ",
    lmidot: "ŀ",
    lmoustache: "⎰",
    lmoust: "⎰",
    lnap: "⪉",
    lnapprox: "⪉",
    lne: "⪇",
    lnE: "≨",
    lneq: "⪇",
    lneqq: "≨",
    lnsim: "⋦",
    loang: "⟬",
    loarr: "⇽",
    lobrk: "⟦",
    longleftarrow: "⟵",
    LongLeftArrow: "⟵",
    Longleftarrow: "⟸",
    longleftrightarrow: "⟷",
    LongLeftRightArrow: "⟷",
    Longleftrightarrow: "⟺",
    longmapsto: "⟼",
    longrightarrow: "⟶",
    LongRightArrow: "⟶",
    Longrightarrow: "⟹",
    looparrowleft: "↫",
    looparrowright: "↬",
    lopar: "⦅",
    Lopf: "𝕃",
    lopf: "𝕝",
    loplus: "⨭",
    lotimes: "⨴",
    lowast: "∗",
    lowbar: "_",
    LowerLeftArrow: "↙",
    LowerRightArrow: "↘",
    loz: "◊",
    lozenge: "◊",
    lozf: "⧫",
    lpar: "(",
    lparlt: "⦓",
    lrarr: "⇆",
    lrcorner: "⌟",
    lrhar: "⇋",
    lrhard: "⥭",
    lrm: "\u200e",
    lrtri: "⊿",
    lsaquo: "‹",
    lscr: "𝓁",
    Lscr: "ℒ",
    lsh: "↰",
    Lsh: "↰",
    lsim: "≲",
    lsime: "⪍",
    lsimg: "⪏",
    lsqb: "[",
    lsquo: "‘",
    lsquor: "‚",
    Lstrok: "Ł",
    lstrok: "ł",
    ltcc: "⪦",
    ltcir: "⩹",
    lt: "<",
    LT: "<",
    Lt: "≪",
    ltdot: "⋖",
    lthree: "⋋",
    ltimes: "⋉",
    ltlarr: "⥶",
    ltquest: "⩻",
    ltri: "◃",
    ltrie: "⊴",
    ltrif: "◂",
    ltrPar: "⦖",
    lurdshar: "⥊",
    luruhar: "⥦",
    lvertneqq: "≨︀",
    lvnE: "≨︀",
    macr: "¯",
    male: "♂",
    malt: "✠",
    maltese: "✠",
    Map: "⤅",
    map: "↦",
    mapsto: "↦",
    mapstodown: "↧",
    mapstoleft: "↤",
    mapstoup: "↥",
    marker: "▮",
    mcomma: "⨩",
    Mcy: "М",
    mcy: "м",
    mdash: "—",
    mDDot: "∺",
    measuredangle: "∡",
    MediumSpace: " ",
    Mellintrf: "ℳ",
    Mfr: "𝔐",
    mfr: "𝔪",
    mho: "℧",
    micro: "µ",
    midast: "*",
    midcir: "⫰",
    mid: "∣",
    middot: "·",
    minusb: "⊟",
    minus: "−",
    minusd: "∸",
    minusdu: "⨪",
    MinusPlus: "∓",
    mlcp: "⫛",
    mldr: "…",
    mnplus: "∓",
    models: "⊧",
    Mopf: "𝕄",
    mopf: "𝕞",
    mp: "∓",
    mscr: "𝓂",
    Mscr: "ℳ",
    mstpos: "∾",
    Mu: "Μ",
    mu: "μ",
    multimap: "⊸",
    mumap: "⊸",
    nabla: "∇",
    Nacute: "Ń",
    nacute: "ń",
    nang: "∠⃒",
    nap: "≉",
    napE: "⩰̸",
    napid: "≋̸",
    napos: "ŉ",
    napprox: "≉",
    natural: "♮",
    naturals: "ℕ",
    natur: "♮",
    nbsp: " ",
    nbump: "≎̸",
    nbumpe: "≏̸",
    ncap: "⩃",
    Ncaron: "Ň",
    ncaron: "ň",
    Ncedil: "Ņ",
    ncedil: "ņ",
    ncong: "≇",
    ncongdot: "⩭̸",
    ncup: "⩂",
    Ncy: "Н",
    ncy: "н",
    ndash: "–",
    nearhk: "⤤",
    nearr: "↗",
    neArr: "⇗",
    nearrow: "↗",
    ne: "≠",
    nedot: "≐̸",
    NegativeMediumSpace: "​",
    NegativeThickSpace: "​",
    NegativeThinSpace: "​",
    NegativeVeryThinSpace: "​",
    nequiv: "≢",
    nesear: "⤨",
    nesim: "≂̸",
    NestedGreaterGreater: "≫",
    NestedLessLess: "≪",
    NewLine: "\u000a",
    nexist: "∄",
    nexists: "∄",
    Nfr: "𝔑",
    nfr: "𝔫",
    ngE: "≧̸",
    nge: "≱",
    ngeq: "≱",
    ngeqq: "≧̸",
    ngeqslant: "⩾̸",
    nges: "⩾̸",
    nGg: "⋙̸",
    ngsim: "≵",
    nGt: "≫⃒",
    ngt: "≯",
    ngtr: "≯",
    nGtv: "≫̸",
    nharr: "↮",
    nhArr: "⇎",
    nhpar: "⫲",
    ni: "∋",
    nis: "⋼",
    nisd: "⋺",
    niv: "∋",
    NJcy: "Њ",
    njcy: "њ",
    nlarr: "↚",
    nlArr: "⇍",
    nldr: "‥",
    nlE: "≦̸",
    nle: "≰",
    nleftarrow: "↚",
    nLeftarrow: "⇍",
    nleftrightarrow: "↮",
    nLeftrightarrow: "⇎",
    nleq: "≰",
    nleqq: "≦̸",
    nleqslant: "⩽̸",
    nles: "⩽̸",
    nless: "≮",
    nLl: "⋘̸",
    nlsim: "≴",
    nLt: "≪⃒",
    nlt: "≮",
    nltri: "⋪",
    nltrie: "⋬",
    nLtv: "≪̸",
    nmid: "∤",
    NoBreak: "\u2060",
    NonBreakingSpace: " ",
    nopf: "𝕟",
    Nopf: "ℕ",
    Not: "⫬",
    not: "¬",
    NotCongruent: "≢",
    NotCupCap: "≭",
    NotDoubleVerticalBar: "∦",
    NotElement: "∉",
    NotEqual: "≠",
    NotEqualTilde: "≂̸",
    NotExists: "∄",
    NotGreater: "≯",
    NotGreaterEqual: "≱",
    NotGreaterFullEqual: "≧̸",
    NotGreaterGreater: "≫̸",
    NotGreaterLess: "≹",
    NotGreaterSlantEqual: "⩾̸",
    NotGreaterTilde: "≵",
    NotHumpDownHump: "≎̸",
    NotHumpEqual: "≏̸",
    notin: "∉",
    notindot: "⋵̸",
    notinE: "⋹̸",
    notinva: "∉",
    notinvb: "⋷",
    notinvc: "⋶",
    NotLeftTriangleBar: "⧏̸",
    NotLeftTriangle: "⋪",
    NotLeftTriangleEqual: "⋬",
    NotLess: "≮",
    NotLessEqual: "≰",
    NotLessGreater: "≸",
    NotLessLess: "≪̸",
    NotLessSlantEqual: "⩽̸",
    NotLessTilde: "≴",
    NotNestedGreaterGreater: "⪢̸",
    NotNestedLessLess: "⪡̸",
    notni: "∌",
    notniva: "∌",
    notnivb: "⋾",
    notnivc: "⋽",
    NotPrecedes: "⊀",
    NotPrecedesEqual: "⪯̸",
    NotPrecedesSlantEqual: "⋠",
    NotReverseElement: "∌",
    NotRightTriangleBar: "⧐̸",
    NotRightTriangle: "⋫",
    NotRightTriangleEqual: "⋭",
    NotSquareSubset: "⊏̸",
    NotSquareSubsetEqual: "⋢",
    NotSquareSuperset: "⊐̸",
    NotSquareSupersetEqual: "⋣",
    NotSubset: "⊂⃒",
    NotSubsetEqual: "⊈",
    NotSucceeds: "⊁",
    NotSucceedsEqual: "⪰̸",
    NotSucceedsSlantEqual: "⋡",
    NotSucceedsTilde: "≿̸",
    NotSuperset: "⊃⃒",
    NotSupersetEqual: "⊉",
    NotTilde: "≁",
    NotTildeEqual: "≄",
    NotTildeFullEqual: "≇",
    NotTildeTilde: "≉",
    NotVerticalBar: "∤",
    nparallel: "∦",
    npar: "∦",
    nparsl: "⫽⃥",
    npart: "∂̸",
    npolint: "⨔",
    npr: "⊀",
    nprcue: "⋠",
    nprec: "⊀",
    npreceq: "⪯̸",
    npre: "⪯̸",
    nrarrc: "⤳̸",
    nrarr: "↛",
    nrArr: "⇏",
    nrarrw: "↝̸",
    nrightarrow: "↛",
    nRightarrow: "⇏",
    nrtri: "⋫",
    nrtrie: "⋭",
    nsc: "⊁",
    nsccue: "⋡",
    nsce: "⪰̸",
    Nscr: "𝒩",
    nscr: "𝓃",
    nshortmid: "∤",
    nshortparallel: "∦",
    nsim: "≁",
    nsime: "≄",
    nsimeq: "≄",
    nsmid: "∤",
    nspar: "∦",
    nsqsube: "⋢",
    nsqsupe: "⋣",
    nsub: "⊄",
    nsubE: "⫅̸",
    nsube: "⊈",
    nsubset: "⊂⃒",
    nsubseteq: "⊈",
    nsubseteqq: "⫅̸",
    nsucc: "⊁",
    nsucceq: "⪰̸",
    nsup: "⊅",
    nsupE: "⫆̸",
    nsupe: "⊉",
    nsupset: "⊃⃒",
    nsupseteq: "⊉",
    nsupseteqq: "⫆̸",
    ntgl: "≹",
    Ntilde: "Ñ",
    ntilde: "ñ",
    ntlg: "≸",
    ntriangleleft: "⋪",
    ntrianglelefteq: "⋬",
    ntriangleright: "⋫",
    ntrianglerighteq: "⋭",
    Nu: "Ν",
    nu: "ν",
    num: "#",
    numero: "№",
    numsp: " ",
    nvap: "≍⃒",
    nvdash: "⊬",
    nvDash: "⊭",
    nVdash: "⊮",
    nVDash: "⊯",
    nvge: "≥⃒",
    nvgt: ">⃒",
    nvHarr: "⤄",
    nvinfin: "⧞",
    nvlArr: "⤂",
    nvle: "≤⃒",
    nvlt: "<⃒",
    nvltrie: "⊴⃒",
    nvrArr: "⤃",
    nvrtrie: "⊵⃒",
    nvsim: "∼⃒",
    nwarhk: "⤣",
    nwarr: "↖",
    nwArr: "⇖",
    nwarrow: "↖",
    nwnear: "⤧",
    Oacute: "Ó",
    oacute: "ó",
    oast: "⊛",
    Ocirc: "Ô",
    ocirc: "ô",
    ocir: "⊚",
    Ocy: "О",
    ocy: "о",
    odash: "⊝",
    Odblac: "Ő",
    odblac: "ő",
    odiv: "⨸",
    odot: "⊙",
    odsold: "⦼",
    OElig: "Œ",
    oelig: "œ",
    ofcir: "⦿",
    Ofr: "𝔒",
    ofr: "𝔬",
    ogon: "˛",
    Ograve: "Ò",
    ograve: "ò",
    ogt: "⧁",
    ohbar: "⦵",
    ohm: "Ω",
    oint: "∮",
    olarr: "↺",
    olcir: "⦾",
    olcross: "⦻",
    oline: "‾",
    olt: "⧀",
    Omacr: "Ō",
    omacr: "ō",
    Omega: "Ω",
    omega: "ω",
    Omicron: "Ο",
    omicron: "ο",
    omid: "⦶",
    ominus: "⊖",
    Oopf: "𝕆",
    oopf: "𝕠",
    opar: "⦷",
    OpenCurlyDoubleQuote: "“",
    OpenCurlyQuote: "‘",
    operp: "⦹",
    oplus: "⊕",
    orarr: "↻",
    Or: "⩔",
    or: "∨",
    ord: "⩝",
    order: "ℴ",
    orderof: "ℴ",
    ordf: "ª",
    ordm: "º",
    origof: "⊶",
    oror: "⩖",
    orslope: "⩗",
    orv: "⩛",
    oS: "Ⓢ",
    Oscr: "𝒪",
    oscr: "ℴ",
    Oslash: "Ø",
    oslash: "ø",
    osol: "⊘",
    Otilde: "Õ",
    otilde: "õ",
    otimesas: "⨶",
    Otimes: "⨷",
    otimes: "⊗",
    Ouml: "Ö",
    ouml: "ö",
    ovbar: "⌽",
    OverBar: "‾",
    OverBrace: "⏞",
    OverBracket: "⎴",
    OverParenthesis: "⏜",
    para: "¶",
    parallel: "∥",
    par: "∥",
    parsim: "⫳",
    parsl: "⫽",
    part: "∂",
    PartialD: "∂",
    Pcy: "П",
    pcy: "п",
    percnt: "%",
    period: ".",
    permil: "‰",
    perp: "⊥",
    pertenk: "‱",
    Pfr: "𝔓",
    pfr: "𝔭",
    Phi: "Φ",
    phi: "φ",
    phiv: "ϕ",
    phmmat: "ℳ",
    phone: "☎",
    Pi: "Π",
    pi: "π",
    pitchfork: "⋔",
    piv: "ϖ",
    planck: "ℏ",
    planckh: "ℎ",
    plankv: "ℏ",
    plusacir: "⨣",
    plusb: "⊞",
    pluscir: "⨢",
    plus: "+",
    plusdo: "∔",
    plusdu: "⨥",
    pluse: "⩲",
    PlusMinus: "±",
    plusmn: "±",
    plussim: "⨦",
    plustwo: "⨧",
    pm: "±",
    Poincareplane: "ℌ",
    pointint: "⨕",
    popf: "𝕡",
    Popf: "ℙ",
    pound: "£",
    prap: "⪷",
    Pr: "⪻",
    pr: "≺",
    prcue: "≼",
    precapprox: "⪷",
    prec: "≺",
    preccurlyeq: "≼",
    Precedes: "≺",
    PrecedesEqual: "⪯",
    PrecedesSlantEqual: "≼",
    PrecedesTilde: "≾",
    preceq: "⪯",
    precnapprox: "⪹",
    precneqq: "⪵",
    precnsim: "⋨",
    pre: "⪯",
    prE: "⪳",
    precsim: "≾",
    prime: "′",
    Prime: "″",
    primes: "ℙ",
    prnap: "⪹",
    prnE: "⪵",
    prnsim: "⋨",
    prod: "∏",
    Product: "∏",
    profalar: "⌮",
    profline: "⌒",
    profsurf: "⌓",
    prop: "∝",
    Proportional: "∝",
    Proportion: "∷",
    propto: "∝",
    prsim: "≾",
    prurel: "⊰",
    Pscr: "𝒫",
    pscr: "𝓅",
    Psi: "Ψ",
    psi: "ψ",
    puncsp: " ",
    Qfr: "𝔔",
    qfr: "𝔮",
    qint: "⨌",
    qopf: "𝕢",
    Qopf: "ℚ",
    qprime: "⁗",
    Qscr: "𝒬",
    qscr: "𝓆",
    quaternions: "ℍ",
    quatint: "⨖",
    quest: "?",
    questeq: "≟",
    quot: "\"",
    QUOT: "\"",
    rAarr: "⇛",
    race: "∽̱",
    Racute: "Ŕ",
    racute: "ŕ",
    radic: "√",
    raemptyv: "⦳",
    rang: "⟩",
    Rang: "⟫",
    rangd: "⦒",
    range: "⦥",
    rangle: "⟩",
    raquo: "»",
    rarrap: "⥵",
    rarrb: "⇥",
    rarrbfs: "⤠",
    rarrc: "⤳",
    rarr: "→",
    Rarr: "↠",
    rArr: "⇒",
    rarrfs: "⤞",
    rarrhk: "↪",
    rarrlp: "↬",
    rarrpl: "⥅",
    rarrsim: "⥴",
    Rarrtl: "⤖",
    rarrtl: "↣",
    rarrw: "↝",
    ratail: "⤚",
    rAtail: "⤜",
    ratio: "∶",
    rationals: "ℚ",
    rbarr: "⤍",
    rBarr: "⤏",
    RBarr: "⤐",
    rbbrk: "❳",
    rbrace: "}",
    rbrack: "]",
    rbrke: "⦌",
    rbrksld: "⦎",
    rbrkslu: "⦐",
    Rcaron: "Ř",
    rcaron: "ř",
    Rcedil: "Ŗ",
    rcedil: "ŗ",
    rceil: "⌉",
    rcub: "}",
    Rcy: "Р",
    rcy: "р",
    rdca: "⤷",
    rdldhar: "⥩",
    rdquo: "”",
    rdquor: "”",
    rdsh: "↳",
    real: "ℜ",
    realine: "ℛ",
    realpart: "ℜ",
    reals: "ℝ",
    Re: "ℜ",
    rect: "▭",
    reg: "®",
    REG: "®",
    ReverseElement: "∋",
    ReverseEquilibrium: "⇋",
    ReverseUpEquilibrium: "⥯",
    rfisht: "⥽",
    rfloor: "⌋",
    rfr: "𝔯",
    Rfr: "ℜ",
    rHar: "⥤",
    rhard: "⇁",
    rharu: "⇀",
    rharul: "⥬",
    Rho: "Ρ",
    rho: "ρ",
    rhov: "ϱ",
    RightAngleBracket: "⟩",
    RightArrowBar: "⇥",
    rightarrow: "→",
    RightArrow: "→",
    Rightarrow: "⇒",
    RightArrowLeftArrow: "⇄",
    rightarrowtail: "↣",
    RightCeiling: "⌉",
    RightDoubleBracket: "⟧",
    RightDownTeeVector: "⥝",
    RightDownVectorBar: "⥕",
    RightDownVector: "⇂",
    RightFloor: "⌋",
    rightharpoondown: "⇁",
    rightharpoonup: "⇀",
    rightleftarrows: "⇄",
    rightleftharpoons: "⇌",
    rightrightarrows: "⇉",
    rightsquigarrow: "↝",
    RightTeeArrow: "↦",
    RightTee: "⊢",
    RightTeeVector: "⥛",
    rightthreetimes: "⋌",
    RightTriangleBar: "⧐",
    RightTriangle: "⊳",
    RightTriangleEqual: "⊵",
    RightUpDownVector: "⥏",
    RightUpTeeVector: "⥜",
    RightUpVectorBar: "⥔",
    RightUpVector: "↾",
    RightVectorBar: "⥓",
    RightVector: "⇀",
    ring: "˚",
    risingdotseq: "≓",
    rlarr: "⇄",
    rlhar: "⇌",
    rlm: "\u200f",
    rmoustache: "⎱",
    rmoust: "⎱",
    rnmid: "⫮",
    roang: "⟭",
    roarr: "⇾",
    robrk: "⟧",
    ropar: "⦆",
    ropf: "𝕣",
    Ropf: "ℝ",
    roplus: "⨮",
    rotimes: "⨵",
    RoundImplies: "⥰",
    rpar: ")",
    rpargt: "⦔",
    rppolint: "⨒",
    rrarr: "⇉",
    Rrightarrow: "⇛",
    rsaquo: "›",
    rscr: "𝓇",
    Rscr: "ℛ",
    rsh: "↱",
    Rsh: "↱",
    rsqb: "]",
    rsquo: "’",
    rsquor: "’",
    rthree: "⋌",
    rtimes: "⋊",
    rtri: "▹",
    rtrie: "⊵",
    rtrif: "▸",
    rtriltri: "⧎",
    RuleDelayed: "⧴",
    ruluhar: "⥨",
    rx: "℞",
    Sacute: "Ś",
    sacute: "ś",
    sbquo: "‚",
    scap: "⪸",
    Scaron: "Š",
    scaron: "š",
    Sc: "⪼",
    sc: "≻",
    sccue: "≽",
    sce: "⪰",
    scE: "⪴",
    Scedil: "Ş",
    scedil: "ş",
    Scirc: "Ŝ",
    scirc: "ŝ",
    scnap: "⪺",
    scnE: "⪶",
    scnsim: "⋩",
    scpolint: "⨓",
    scsim: "≿",
    Scy: "С",
    scy: "с",
    sdotb: "⊡",
    sdot: "⋅",
    sdote: "⩦",
    searhk: "⤥",
    searr: "↘",
    seArr: "⇘",
    searrow: "↘",
    sect: "§",
    semi: ";",
    seswar: "⤩",
    setminus: "∖",
    setmn: "∖",
    sext: "✶",
    Sfr: "𝔖",
    sfr: "𝔰",
    sfrown: "⌢",
    sharp: "♯",
    SHCHcy: "Щ",
    shchcy: "щ",
    SHcy: "Ш",
    shcy: "ш",
    ShortDownArrow: "↓",
    ShortLeftArrow: "←",
    shortmid: "∣",
    shortparallel: "∥",
    ShortRightArrow: "→",
    ShortUpArrow: "↑",
    shy: "\u00ad",
    Sigma: "Σ",
    sigma: "σ",
    sigmaf: "ς",
    sigmav: "ς",
    sim: "∼",
    simdot: "⩪",
    sime: "≃",
    simeq: "≃",
    simg: "⪞",
    simgE: "⪠",
    siml: "⪝",
    simlE: "⪟",
    simne: "≆",
    simplus: "⨤",
    simrarr: "⥲",
    slarr: "←",
    SmallCircle: "∘",
    smallsetminus: "∖",
    smashp: "⨳",
    smeparsl: "⧤",
    smid: "∣",
    smile: "⌣",
    smt: "⪪",
    smte: "⪬",
    smtes: "⪬︀",
    SOFTcy: "Ь",
    softcy: "ь",
    solbar: "⌿",
    solb: "⧄",
    sol: "/",
    Sopf: "𝕊",
    sopf: "𝕤",
    spades: "♠",
    spadesuit: "♠",
    spar: "∥",
    sqcap: "⊓",
    sqcaps: "⊓︀",
    sqcup: "⊔",
    sqcups: "⊔︀",
    Sqrt: "√",
    sqsub: "⊏",
    sqsube: "⊑",
    sqsubset: "⊏",
    sqsubseteq: "⊑",
    sqsup: "⊐",
    sqsupe: "⊒",
    sqsupset: "⊐",
    sqsupseteq: "⊒",
    square: "□",
    Square: "□",
    SquareIntersection: "⊓",
    SquareSubset: "⊏",
    SquareSubsetEqual: "⊑",
    SquareSuperset: "⊐",
    SquareSupersetEqual: "⊒",
    SquareUnion: "⊔",
    squarf: "▪",
    squ: "□",
    squf: "▪",
    srarr: "→",
    Sscr: "𝒮",
    sscr: "𝓈",
    ssetmn: "∖",
    ssmile: "⌣",
    sstarf: "⋆",
    Star: "⋆",
    star: "☆",
    starf: "★",
    straightepsilon: "ϵ",
    straightphi: "ϕ",
    strns: "¯",
    sub: "⊂",
    Sub: "⋐",
    subdot: "⪽",
    subE: "⫅",
    sube: "⊆",
    subedot: "⫃",
    submult: "⫁",
    subnE: "⫋",
    subne: "⊊",
    subplus: "⪿",
    subrarr: "⥹",
    subset: "⊂",
    Subset: "⋐",
    subseteq: "⊆",
    subseteqq: "⫅",
    SubsetEqual: "⊆",
    subsetneq: "⊊",
    subsetneqq: "⫋",
    subsim: "⫇",
    subsub: "⫕",
    subsup: "⫓",
    succapprox: "⪸",
    succ: "≻",
    succcurlyeq: "≽",
    Succeeds: "≻",
    SucceedsEqual: "⪰",
    SucceedsSlantEqual: "≽",
    SucceedsTilde: "≿",
    succeq: "⪰",
    succnapprox: "⪺",
    succneqq: "⪶",
    succnsim: "⋩",
    succsim: "≿",
    SuchThat: "∋",
    sum: "∑",
    Sum: "∑",
    sung: "♪",
    sup1: "¹",
    sup2: "²",
    sup3: "³",
    sup: "⊃",
    Sup: "⋑",
    supdot: "⪾",
    supdsub: "⫘",
    supE: "⫆",
    supe: "⊇",
    supedot: "⫄",
    Superset: "⊃",
    SupersetEqual: "⊇",
    suphsol: "⟉",
    suphsub: "⫗",
    suplarr: "⥻",
    supmult: "⫂",
    supnE: "⫌",
    supne: "⊋",
    supplus: "⫀",
    supset: "⊃",
    Supset: "⋑",
    supseteq: "⊇",
    supseteqq: "⫆",
    supsetneq: "⊋",
    supsetneqq: "⫌",
    supsim: "⫈",
    supsub: "⫔",
    supsup: "⫖",
    swarhk: "⤦",
    swarr: "↙",
    swArr: "⇙",
    swarrow: "↙",
    swnwar: "⤪",
    szlig: "ß",
    Tab: "\u0009",
    target: "⌖",
    Tau: "Τ",
    tau: "τ",
    tbrk: "⎴",
    Tcaron: "Ť",
    tcaron: "ť",
    Tcedil: "Ţ",
    tcedil: "ţ",
    Tcy: "Т",
    tcy: "т",
    tdot: "⃛",
    telrec: "⌕",
    Tfr: "𝔗",
    tfr: "𝔱",
    there4: "∴",
    therefore: "∴",
    Therefore: "∴",
    Theta: "Θ",
    theta: "θ",
    thetasym: "ϑ",
    thetav: "ϑ",
    thickapprox: "≈",
    thicksim: "∼",
    ThickSpace: "  ",
    ThinSpace: " ",
    thinsp: " ",
    thkap: "≈",
    thksim: "∼",
    THORN: "Þ",
    thorn: "þ",
    tilde: "˜",
    Tilde: "∼",
    TildeEqual: "≃",
    TildeFullEqual: "≅",
    TildeTilde: "≈",
    timesbar: "⨱",
    timesb: "⊠",
    times: "×",
    timesd: "⨰",
    tint: "∭",
    toea: "⤨",
    topbot: "⌶",
    topcir: "⫱",
    top: "⊤",
    Topf: "𝕋",
    topf: "𝕥",
    topfork: "⫚",
    tosa: "⤩",
    tprime: "‴",
    trade: "™",
    TRADE: "™",
    triangle: "▵",
    triangledown: "▿",
    triangleleft: "◃",
    trianglelefteq: "⊴",
    triangleq: "≜",
    triangleright: "▹",
    trianglerighteq: "⊵",
    tridot: "◬",
    trie: "≜",
    triminus: "⨺",
    TripleDot: "⃛",
    triplus: "⨹",
    trisb: "⧍",
    tritime: "⨻",
    trpezium: "⏢",
    Tscr: "𝒯",
    tscr: "𝓉",
    TScy: "Ц",
    tscy: "ц",
    TSHcy: "Ћ",
    tshcy: "ћ",
    Tstrok: "Ŧ",
    tstrok: "ŧ",
    twixt: "≬",
    twoheadleftarrow: "↞",
    twoheadrightarrow: "↠",
    Uacute: "Ú",
    uacute: "ú",
    uarr: "↑",
    Uarr: "↟",
    uArr: "⇑",
    Uarrocir: "⥉",
    Ubrcy: "Ў",
    ubrcy: "ў",
    Ubreve: "Ŭ",
    ubreve: "ŭ",
    Ucirc: "Û",
    ucirc: "û",
    Ucy: "У",
    ucy: "у",
    udarr: "⇅",
    Udblac: "Ű",
    udblac: "ű",
    udhar: "⥮",
    ufisht: "⥾",
    Ufr: "𝔘",
    ufr: "𝔲",
    Ugrave: "Ù",
    ugrave: "ù",
    uHar: "⥣",
    uharl: "↿",
    uharr: "↾",
    uhblk: "▀",
    ulcorn: "⌜",
    ulcorner: "⌜",
    ulcrop: "⌏",
    ultri: "◸",
    Umacr: "Ū",
    umacr: "ū",
    uml: "¨",
    UnderBar: "_",
    UnderBrace: "⏟",
    UnderBracket: "⎵",
    UnderParenthesis: "⏝",
    Union: "⋃",
    UnionPlus: "⊎",
    Uogon: "Ų",
    uogon: "ų",
    Uopf: "𝕌",
    uopf: "𝕦",
    UpArrowBar: "⤒",
    uparrow: "↑",
    UpArrow: "↑",
    Uparrow: "⇑",
    UpArrowDownArrow: "⇅",
    updownarrow: "↕",
    UpDownArrow: "↕",
    Updownarrow: "⇕",
    UpEquilibrium: "⥮",
    upharpoonleft: "↿",
    upharpoonright: "↾",
    uplus: "⊎",
    UpperLeftArrow: "↖",
    UpperRightArrow: "↗",
    upsi: "υ",
    Upsi: "ϒ",
    upsih: "ϒ",
    Upsilon: "Υ",
    upsilon: "υ",
    UpTeeArrow: "↥",
    UpTee: "⊥",
    upuparrows: "⇈",
    urcorn: "⌝",
    urcorner: "⌝",
    urcrop: "⌎",
    Uring: "Ů",
    uring: "ů",
    urtri: "◹",
    Uscr: "𝒰",
    uscr: "𝓊",
    utdot: "⋰",
    Utilde: "Ũ",
    utilde: "ũ",
    utri: "▵",
    utrif: "▴",
    uuarr: "⇈",
    Uuml: "Ü",
    uuml: "ü",
    uwangle: "⦧",
    vangrt: "⦜",
    varepsilon: "ϵ",
    varkappa: "ϰ",
    varnothing: "∅",
    varphi: "ϕ",
    varpi: "ϖ",
    varpropto: "∝",
    varr: "↕",
    vArr: "⇕",
    varrho: "ϱ",
    varsigma: "ς",
    varsubsetneq: "⊊︀",
    varsubsetneqq: "⫋︀",
    varsupsetneq: "⊋︀",
    varsupsetneqq: "⫌︀",
    vartheta: "ϑ",
    vartriangleleft: "⊲",
    vartriangleright: "⊳",
    vBar: "⫨",
    Vbar: "⫫",
    vBarv: "⫩",
    Vcy: "В",
    vcy: "в",
    vdash: "⊢",
    vDash: "⊨",
    Vdash: "⊩",
    VDash: "⊫",
    Vdashl: "⫦",
    veebar: "⊻",
    vee: "∨",
    Vee: "⋁",
    veeeq: "≚",
    vellip: "⋮",
    verbar: "|",
    Verbar: "‖",
    vert: "|",
    Vert: "‖",
    VerticalBar: "∣",
    VerticalLine: "|",
    VerticalSeparator: "❘",
    VerticalTilde: "≀",
    VeryThinSpace: " ",
    Vfr: "𝔙",
    vfr: "𝔳",
    vltri: "⊲",
    vnsub: "⊂⃒",
    vnsup: "⊃⃒",
    Vopf: "𝕍",
    vopf: "𝕧",
    vprop: "∝",
    vrtri: "⊳",
    Vscr: "𝒱",
    vscr: "𝓋",
    vsubnE: "⫋︀",
    vsubne: "⊊︀",
    vsupnE: "⫌︀",
    vsupne: "⊋︀",
    Vvdash: "⊪",
    vzigzag: "⦚",
    Wcirc: "Ŵ",
    wcirc: "ŵ",
    wedbar: "⩟",
    wedge: "∧",
    Wedge: "⋀",
    wedgeq: "≙",
    weierp: "℘",
    Wfr: "𝔚",
    wfr: "𝔴",
    Wopf: "𝕎",
    wopf: "𝕨",
    wp: "℘",
    wr: "≀",
    wreath: "≀",
    Wscr: "𝒲",
    wscr: "𝓌",
    xcap: "⋂",
    xcirc: "◯",
    xcup: "⋃",
    xdtri: "▽",
    Xfr: "𝔛",
    xfr: "𝔵",
    xharr: "⟷",
    xhArr: "⟺",
    Xi: "Ξ",
    xi: "ξ",
    xlarr: "⟵",
    xlArr: "⟸",
    xmap: "⟼",
    xnis: "⋻",
    xodot: "⨀",
    Xopf: "𝕏",
    xopf: "𝕩",
    xoplus: "⨁",
    xotime: "⨂",
    xrarr: "⟶",
    xrArr: "⟹",
    Xscr: "𝒳",
    xscr: "𝓍",
    xsqcup: "⨆",
    xuplus: "⨄",
    xutri: "△",
    xvee: "⋁",
    xwedge: "⋀",
    Yacute: "Ý",
    yacute: "ý",
    YAcy: "Я",
    yacy: "я",
    Ycirc: "Ŷ",
    ycirc: "ŷ",
    Ycy: "Ы",
    ycy: "ы",
    yen: "¥",
    Yfr: "𝔜",
    yfr: "𝔶",
    YIcy: "Ї",
    yicy: "ї",
    Yopf: "𝕐",
    yopf: "𝕪",
    Yscr: "𝒴",
    yscr: "𝓎",
    YUcy: "Ю",
    yucy: "ю",
    yuml: "ÿ",
    Yuml: "Ÿ",
    Zacute: "Ź",
    zacute: "ź",
    Zcaron: "Ž",
    zcaron: "ž",
    Zcy: "З",
    zcy: "з",
    Zdot: "Ż",
    zdot: "ż",
    zeetrf: "ℨ",
    ZeroWidthSpace: "​",
    Zeta: "Ζ",
    zeta: "ζ",
    zfr: "𝔷",
    Zfr: "ℨ",
    ZHcy: "Ж",
    zhcy: "ж",
    zigrarr: "⇝",
    zopf: "𝕫",
    Zopf: "ℤ",
    Zscr: "𝒵",
    zscr: "𝓏",
    zwj: "\u200d",
    zwnj: "\u200c"
  };
  _exports.HTML5NamedCharRefs = namedCharRefs;
  var HEXCHARCODE = /^#[xX]([A-Fa-f0-9]+)$/;
  var CHARCODE = /^#([0-9]+)$/;
  var NAMED = /^([A-Za-z0-9]+)$/;
  var EntityParser = /** @class */function () {
    function EntityParser(named) {
      this.named = named;
    }
    EntityParser.prototype.parse = function (entity) {
      if (!entity) {
        return;
      }
      var matches = entity.match(HEXCHARCODE);
      if (matches) {
        return String.fromCharCode(parseInt(matches[1], 16));
      }
      matches = entity.match(CHARCODE);
      if (matches) {
        return String.fromCharCode(parseInt(matches[1], 10));
      }
      matches = entity.match(NAMED);
      if (matches) {
        return this.named[matches[1]];
      }
    };
    return EntityParser;
  }();
  _exports.EntityParser = EntityParser;
  var WSP = /[\t\n\f ]/;
  var ALPHA = /[A-Za-z]/;
  var CRLF = /\r\n?/g;
  function isSpace(char) {
    return WSP.test(char);
  }
  function isAlpha(char) {
    return ALPHA.test(char);
  }
  function preprocessInput(input) {
    return input.replace(CRLF, '\n');
  }
  var EventedTokenizer = /** @class */function () {
    function EventedTokenizer(delegate, entityParser, mode) {
      if (mode === void 0) {
        mode = 'precompile';
      }
      this.delegate = delegate;
      this.entityParser = entityParser;
      this.mode = mode;
      this.state = "beforeData" /* beforeData */;
      this.line = -1;
      this.column = -1;
      this.input = '';
      this.index = -1;
      this.tagNameBuffer = '';
      this.states = {
        beforeData: function () {
          var char = this.peek();
          if (char === '<' && !this.isIgnoredEndTag()) {
            this.transitionTo("tagOpen" /* tagOpen */);
            this.markTagStart();
            this.consume();
          } else {
            if (this.mode === 'precompile' && char === '\n') {
              var tag = this.tagNameBuffer.toLowerCase();
              if (tag === 'pre' || tag === 'textarea') {
                this.consume();
              }
            }
            this.transitionTo("data" /* data */);
            this.delegate.beginData();
          }
        },
        data: function () {
          var char = this.peek();
          var tag = this.tagNameBuffer;
          if (char === '<' && !this.isIgnoredEndTag()) {
            this.delegate.finishData();
            this.transitionTo("tagOpen" /* tagOpen */);
            this.markTagStart();
            this.consume();
          } else if (char === '&' && tag !== 'script' && tag !== 'style') {
            this.consume();
            this.delegate.appendToData(this.consumeCharRef() || '&');
          } else {
            this.consume();
            this.delegate.appendToData(char);
          }
        },
        tagOpen: function () {
          var char = this.consume();
          if (char === '!') {
            this.transitionTo("markupDeclarationOpen" /* markupDeclarationOpen */);
          } else if (char === '/') {
            this.transitionTo("endTagOpen" /* endTagOpen */);
          } else if (char === '@' || char === ':' || isAlpha(char)) {
            this.transitionTo("tagName" /* tagName */);
            this.tagNameBuffer = '';
            this.delegate.beginStartTag();
            this.appendToTagName(char);
          }
        },
        markupDeclarationOpen: function () {
          var char = this.consume();
          if (char === '-' && this.peek() === '-') {
            this.consume();
            this.transitionTo("commentStart" /* commentStart */);
            this.delegate.beginComment();
          } else {
            var maybeDoctype = char.toUpperCase() + this.input.substring(this.index, this.index + 6).toUpperCase();
            if (maybeDoctype === 'DOCTYPE') {
              this.consume();
              this.consume();
              this.consume();
              this.consume();
              this.consume();
              this.consume();
              this.transitionTo("doctype" /* doctype */);
              if (this.delegate.beginDoctype) this.delegate.beginDoctype();
            }
          }
        },
        doctype: function () {
          var char = this.consume();
          if (isSpace(char)) {
            this.transitionTo("beforeDoctypeName" /* beforeDoctypeName */);
          }
        },

        beforeDoctypeName: function () {
          var char = this.consume();
          if (isSpace(char)) {
            return;
          } else {
            this.transitionTo("doctypeName" /* doctypeName */);
            if (this.delegate.appendToDoctypeName) this.delegate.appendToDoctypeName(char.toLowerCase());
          }
        },
        doctypeName: function () {
          var char = this.consume();
          if (isSpace(char)) {
            this.transitionTo("afterDoctypeName" /* afterDoctypeName */);
          } else if (char === '>') {
            if (this.delegate.endDoctype) this.delegate.endDoctype();
            this.transitionTo("beforeData" /* beforeData */);
          } else {
            if (this.delegate.appendToDoctypeName) this.delegate.appendToDoctypeName(char.toLowerCase());
          }
        },
        afterDoctypeName: function () {
          var char = this.consume();
          if (isSpace(char)) {
            return;
          } else if (char === '>') {
            if (this.delegate.endDoctype) this.delegate.endDoctype();
            this.transitionTo("beforeData" /* beforeData */);
          } else {
            var nextSixChars = char.toUpperCase() + this.input.substring(this.index, this.index + 5).toUpperCase();
            var isPublic = nextSixChars.toUpperCase() === 'PUBLIC';
            var isSystem = nextSixChars.toUpperCase() === 'SYSTEM';
            if (isPublic || isSystem) {
              this.consume();
              this.consume();
              this.consume();
              this.consume();
              this.consume();
              this.consume();
            }
            if (isPublic) {
              this.transitionTo("afterDoctypePublicKeyword" /* afterDoctypePublicKeyword */);
            } else if (isSystem) {
              this.transitionTo("afterDoctypeSystemKeyword" /* afterDoctypeSystemKeyword */);
            }
          }
        },

        afterDoctypePublicKeyword: function () {
          var char = this.peek();
          if (isSpace(char)) {
            this.transitionTo("beforeDoctypePublicIdentifier" /* beforeDoctypePublicIdentifier */);
            this.consume();
          } else if (char === '"') {
            this.transitionTo("doctypePublicIdentifierDoubleQuoted" /* doctypePublicIdentifierDoubleQuoted */);
            this.consume();
          } else if (char === "'") {
            this.transitionTo("doctypePublicIdentifierSingleQuoted" /* doctypePublicIdentifierSingleQuoted */);
            this.consume();
          } else if (char === '>') {
            this.consume();
            if (this.delegate.endDoctype) this.delegate.endDoctype();
            this.transitionTo("beforeData" /* beforeData */);
          }
        },

        doctypePublicIdentifierDoubleQuoted: function () {
          var char = this.consume();
          if (char === '"') {
            this.transitionTo("afterDoctypePublicIdentifier" /* afterDoctypePublicIdentifier */);
          } else if (char === '>') {
            if (this.delegate.endDoctype) this.delegate.endDoctype();
            this.transitionTo("beforeData" /* beforeData */);
          } else {
            if (this.delegate.appendToDoctypePublicIdentifier) this.delegate.appendToDoctypePublicIdentifier(char);
          }
        },
        doctypePublicIdentifierSingleQuoted: function () {
          var char = this.consume();
          if (char === "'") {
            this.transitionTo("afterDoctypePublicIdentifier" /* afterDoctypePublicIdentifier */);
          } else if (char === '>') {
            if (this.delegate.endDoctype) this.delegate.endDoctype();
            this.transitionTo("beforeData" /* beforeData */);
          } else {
            if (this.delegate.appendToDoctypePublicIdentifier) this.delegate.appendToDoctypePublicIdentifier(char);
          }
        },
        afterDoctypePublicIdentifier: function () {
          var char = this.consume();
          if (isSpace(char)) {
            this.transitionTo("betweenDoctypePublicAndSystemIdentifiers" /* betweenDoctypePublicAndSystemIdentifiers */);
          } else if (char === '>') {
            if (this.delegate.endDoctype) this.delegate.endDoctype();
            this.transitionTo("beforeData" /* beforeData */);
          } else if (char === '"') {
            this.transitionTo("doctypeSystemIdentifierDoubleQuoted" /* doctypeSystemIdentifierDoubleQuoted */);
          } else if (char === "'") {
            this.transitionTo("doctypeSystemIdentifierSingleQuoted" /* doctypeSystemIdentifierSingleQuoted */);
          }
        },

        betweenDoctypePublicAndSystemIdentifiers: function () {
          var char = this.consume();
          if (isSpace(char)) {
            return;
          } else if (char === '>') {
            if (this.delegate.endDoctype) this.delegate.endDoctype();
            this.transitionTo("beforeData" /* beforeData */);
          } else if (char === '"') {
            this.transitionTo("doctypeSystemIdentifierDoubleQuoted" /* doctypeSystemIdentifierDoubleQuoted */);
          } else if (char === "'") {
            this.transitionTo("doctypeSystemIdentifierSingleQuoted" /* doctypeSystemIdentifierSingleQuoted */);
          }
        },

        doctypeSystemIdentifierDoubleQuoted: function () {
          var char = this.consume();
          if (char === '"') {
            this.transitionTo("afterDoctypeSystemIdentifier" /* afterDoctypeSystemIdentifier */);
          } else if (char === '>') {
            if (this.delegate.endDoctype) this.delegate.endDoctype();
            this.transitionTo("beforeData" /* beforeData */);
          } else {
            if (this.delegate.appendToDoctypeSystemIdentifier) this.delegate.appendToDoctypeSystemIdentifier(char);
          }
        },
        doctypeSystemIdentifierSingleQuoted: function () {
          var char = this.consume();
          if (char === "'") {
            this.transitionTo("afterDoctypeSystemIdentifier" /* afterDoctypeSystemIdentifier */);
          } else if (char === '>') {
            if (this.delegate.endDoctype) this.delegate.endDoctype();
            this.transitionTo("beforeData" /* beforeData */);
          } else {
            if (this.delegate.appendToDoctypeSystemIdentifier) this.delegate.appendToDoctypeSystemIdentifier(char);
          }
        },
        afterDoctypeSystemIdentifier: function () {
          var char = this.consume();
          if (isSpace(char)) {
            return;
          } else if (char === '>') {
            if (this.delegate.endDoctype) this.delegate.endDoctype();
            this.transitionTo("beforeData" /* beforeData */);
          }
        },

        commentStart: function () {
          var char = this.consume();
          if (char === '-') {
            this.transitionTo("commentStartDash" /* commentStartDash */);
          } else if (char === '>') {
            this.delegate.finishComment();
            this.transitionTo("beforeData" /* beforeData */);
          } else {
            this.delegate.appendToCommentData(char);
            this.transitionTo("comment" /* comment */);
          }
        },

        commentStartDash: function () {
          var char = this.consume();
          if (char === '-') {
            this.transitionTo("commentEnd" /* commentEnd */);
          } else if (char === '>') {
            this.delegate.finishComment();
            this.transitionTo("beforeData" /* beforeData */);
          } else {
            this.delegate.appendToCommentData('-');
            this.transitionTo("comment" /* comment */);
          }
        },

        comment: function () {
          var char = this.consume();
          if (char === '-') {
            this.transitionTo("commentEndDash" /* commentEndDash */);
          } else {
            this.delegate.appendToCommentData(char);
          }
        },
        commentEndDash: function () {
          var char = this.consume();
          if (char === '-') {
            this.transitionTo("commentEnd" /* commentEnd */);
          } else {
            this.delegate.appendToCommentData('-' + char);
            this.transitionTo("comment" /* comment */);
          }
        },

        commentEnd: function () {
          var char = this.consume();
          if (char === '>') {
            this.delegate.finishComment();
            this.transitionTo("beforeData" /* beforeData */);
          } else {
            this.delegate.appendToCommentData('--' + char);
            this.transitionTo("comment" /* comment */);
          }
        },

        tagName: function () {
          var char = this.consume();
          if (isSpace(char)) {
            this.transitionTo("beforeAttributeName" /* beforeAttributeName */);
          } else if (char === '/') {
            this.transitionTo("selfClosingStartTag" /* selfClosingStartTag */);
          } else if (char === '>') {
            this.delegate.finishTag();
            this.transitionTo("beforeData" /* beforeData */);
          } else {
            this.appendToTagName(char);
          }
        },
        endTagName: function () {
          var char = this.consume();
          if (isSpace(char)) {
            this.transitionTo("beforeAttributeName" /* beforeAttributeName */);
            this.tagNameBuffer = '';
          } else if (char === '/') {
            this.transitionTo("selfClosingStartTag" /* selfClosingStartTag */);
            this.tagNameBuffer = '';
          } else if (char === '>') {
            this.delegate.finishTag();
            this.transitionTo("beforeData" /* beforeData */);
            this.tagNameBuffer = '';
          } else {
            this.appendToTagName(char);
          }
        },
        beforeAttributeName: function () {
          var char = this.peek();
          if (isSpace(char)) {
            this.consume();
            return;
          } else if (char === '/') {
            this.transitionTo("selfClosingStartTag" /* selfClosingStartTag */);
            this.consume();
          } else if (char === '>') {
            this.consume();
            this.delegate.finishTag();
            this.transitionTo("beforeData" /* beforeData */);
          } else if (char === '=') {
            this.delegate.reportSyntaxError('attribute name cannot start with equals sign');
            this.transitionTo("attributeName" /* attributeName */);
            this.delegate.beginAttribute();
            this.consume();
            this.delegate.appendToAttributeName(char);
          } else {
            this.transitionTo("attributeName" /* attributeName */);
            this.delegate.beginAttribute();
          }
        },
        attributeName: function () {
          var char = this.peek();
          if (isSpace(char)) {
            this.transitionTo("afterAttributeName" /* afterAttributeName */);
            this.consume();
          } else if (char === '/') {
            this.delegate.beginAttributeValue(false);
            this.delegate.finishAttributeValue();
            this.consume();
            this.transitionTo("selfClosingStartTag" /* selfClosingStartTag */);
          } else if (char === '=') {
            this.transitionTo("beforeAttributeValue" /* beforeAttributeValue */);
            this.consume();
          } else if (char === '>') {
            this.delegate.beginAttributeValue(false);
            this.delegate.finishAttributeValue();
            this.consume();
            this.delegate.finishTag();
            this.transitionTo("beforeData" /* beforeData */);
          } else if (char === '"' || char === "'" || char === '<') {
            this.delegate.reportSyntaxError(char + ' is not a valid character within attribute names');
            this.consume();
            this.delegate.appendToAttributeName(char);
          } else {
            this.consume();
            this.delegate.appendToAttributeName(char);
          }
        },
        afterAttributeName: function () {
          var char = this.peek();
          if (isSpace(char)) {
            this.consume();
            return;
          } else if (char === '/') {
            this.delegate.beginAttributeValue(false);
            this.delegate.finishAttributeValue();
            this.consume();
            this.transitionTo("selfClosingStartTag" /* selfClosingStartTag */);
          } else if (char === '=') {
            this.consume();
            this.transitionTo("beforeAttributeValue" /* beforeAttributeValue */);
          } else if (char === '>') {
            this.delegate.beginAttributeValue(false);
            this.delegate.finishAttributeValue();
            this.consume();
            this.delegate.finishTag();
            this.transitionTo("beforeData" /* beforeData */);
          } else {
            this.delegate.beginAttributeValue(false);
            this.delegate.finishAttributeValue();
            this.transitionTo("attributeName" /* attributeName */);
            this.delegate.beginAttribute();
            this.consume();
            this.delegate.appendToAttributeName(char);
          }
        },
        beforeAttributeValue: function () {
          var char = this.peek();
          if (isSpace(char)) {
            this.consume();
          } else if (char === '"') {
            this.transitionTo("attributeValueDoubleQuoted" /* attributeValueDoubleQuoted */);
            this.delegate.beginAttributeValue(true);
            this.consume();
          } else if (char === "'") {
            this.transitionTo("attributeValueSingleQuoted" /* attributeValueSingleQuoted */);
            this.delegate.beginAttributeValue(true);
            this.consume();
          } else if (char === '>') {
            this.delegate.beginAttributeValue(false);
            this.delegate.finishAttributeValue();
            this.consume();
            this.delegate.finishTag();
            this.transitionTo("beforeData" /* beforeData */);
          } else {
            this.transitionTo("attributeValueUnquoted" /* attributeValueUnquoted */);
            this.delegate.beginAttributeValue(false);
            this.consume();
            this.delegate.appendToAttributeValue(char);
          }
        },
        attributeValueDoubleQuoted: function () {
          var char = this.consume();
          if (char === '"') {
            this.delegate.finishAttributeValue();
            this.transitionTo("afterAttributeValueQuoted" /* afterAttributeValueQuoted */);
          } else if (char === '&') {
            this.delegate.appendToAttributeValue(this.consumeCharRef() || '&');
          } else {
            this.delegate.appendToAttributeValue(char);
          }
        },
        attributeValueSingleQuoted: function () {
          var char = this.consume();
          if (char === "'") {
            this.delegate.finishAttributeValue();
            this.transitionTo("afterAttributeValueQuoted" /* afterAttributeValueQuoted */);
          } else if (char === '&') {
            this.delegate.appendToAttributeValue(this.consumeCharRef() || '&');
          } else {
            this.delegate.appendToAttributeValue(char);
          }
        },
        attributeValueUnquoted: function () {
          var char = this.peek();
          if (isSpace(char)) {
            this.delegate.finishAttributeValue();
            this.consume();
            this.transitionTo("beforeAttributeName" /* beforeAttributeName */);
          } else if (char === '/') {
            this.delegate.finishAttributeValue();
            this.consume();
            this.transitionTo("selfClosingStartTag" /* selfClosingStartTag */);
          } else if (char === '&') {
            this.consume();
            this.delegate.appendToAttributeValue(this.consumeCharRef() || '&');
          } else if (char === '>') {
            this.delegate.finishAttributeValue();
            this.consume();
            this.delegate.finishTag();
            this.transitionTo("beforeData" /* beforeData */);
          } else {
            this.consume();
            this.delegate.appendToAttributeValue(char);
          }
        },
        afterAttributeValueQuoted: function () {
          var char = this.peek();
          if (isSpace(char)) {
            this.consume();
            this.transitionTo("beforeAttributeName" /* beforeAttributeName */);
          } else if (char === '/') {
            this.consume();
            this.transitionTo("selfClosingStartTag" /* selfClosingStartTag */);
          } else if (char === '>') {
            this.consume();
            this.delegate.finishTag();
            this.transitionTo("beforeData" /* beforeData */);
          } else {
            this.transitionTo("beforeAttributeName" /* beforeAttributeName */);
          }
        },

        selfClosingStartTag: function () {
          var char = this.peek();
          if (char === '>') {
            this.consume();
            this.delegate.markTagAsSelfClosing();
            this.delegate.finishTag();
            this.transitionTo("beforeData" /* beforeData */);
          } else {
            this.transitionTo("beforeAttributeName" /* beforeAttributeName */);
          }
        },

        endTagOpen: function () {
          var char = this.consume();
          if (char === '@' || char === ':' || isAlpha(char)) {
            this.transitionTo("endTagName" /* endTagName */);
            this.tagNameBuffer = '';
            this.delegate.beginEndTag();
            this.appendToTagName(char);
          }
        }
      };
      this.reset();
    }
    EventedTokenizer.prototype.reset = function () {
      this.transitionTo("beforeData" /* beforeData */);
      this.input = '';
      this.tagNameBuffer = '';
      this.index = 0;
      this.line = 1;
      this.column = 0;
      this.delegate.reset();
    };
    EventedTokenizer.prototype.transitionTo = function (state) {
      this.state = state;
    };
    EventedTokenizer.prototype.tokenize = function (input) {
      this.reset();
      this.tokenizePart(input);
      this.tokenizeEOF();
    };
    EventedTokenizer.prototype.tokenizePart = function (input) {
      this.input += preprocessInput(input);
      while (this.index < this.input.length) {
        var handler = this.states[this.state];
        if (handler !== undefined) {
          handler.call(this);
        } else {
          throw new Error("unhandled state " + this.state);
        }
      }
    };
    EventedTokenizer.prototype.tokenizeEOF = function () {
      this.flushData();
    };
    EventedTokenizer.prototype.flushData = function () {
      if (this.state === 'data') {
        this.delegate.finishData();
        this.transitionTo("beforeData" /* beforeData */);
      }
    };

    EventedTokenizer.prototype.peek = function () {
      return this.input.charAt(this.index);
    };
    EventedTokenizer.prototype.consume = function () {
      var char = this.peek();
      this.index++;
      if (char === '\n') {
        this.line++;
        this.column = 0;
      } else {
        this.column++;
      }
      return char;
    };
    EventedTokenizer.prototype.consumeCharRef = function () {
      var endIndex = this.input.indexOf(';', this.index);
      if (endIndex === -1) {
        return;
      }
      var entity = this.input.slice(this.index, endIndex);
      var chars = this.entityParser.parse(entity);
      if (chars) {
        var count = entity.length;
        // consume the entity chars
        while (count) {
          this.consume();
          count--;
        }
        // consume the `;`
        this.consume();
        return chars;
      }
    };
    EventedTokenizer.prototype.markTagStart = function () {
      this.delegate.tagOpen();
    };
    EventedTokenizer.prototype.appendToTagName = function (char) {
      this.tagNameBuffer += char;
      this.delegate.appendToTagName(char);
    };
    EventedTokenizer.prototype.isIgnoredEndTag = function () {
      var tag = this.tagNameBuffer;
      return tag === 'title' && this.input.substring(this.index, this.index + 8) !== '</title>' || tag === 'style' && this.input.substring(this.index, this.index + 8) !== '</style>' || tag === 'script' && this.input.substring(this.index, this.index + 9) !== '</script>';
    };
    return EventedTokenizer;
  }();
  _exports.EventedTokenizer = EventedTokenizer;
  var Tokenizer = /** @class */function () {
    function Tokenizer(entityParser, options) {
      if (options === void 0) {
        options = {};
      }
      this.options = options;
      this.token = null;
      this.startLine = 1;
      this.startColumn = 0;
      this.tokens = [];
      this.tokenizer = new EventedTokenizer(this, entityParser, options.mode);
      this._currentAttribute = undefined;
    }
    Tokenizer.prototype.tokenize = function (input) {
      this.tokens = [];
      this.tokenizer.tokenize(input);
      return this.tokens;
    };
    Tokenizer.prototype.tokenizePart = function (input) {
      this.tokens = [];
      this.tokenizer.tokenizePart(input);
      return this.tokens;
    };
    Tokenizer.prototype.tokenizeEOF = function () {
      this.tokens = [];
      this.tokenizer.tokenizeEOF();
      return this.tokens[0];
    };
    Tokenizer.prototype.reset = function () {
      this.token = null;
      this.startLine = 1;
      this.startColumn = 0;
    };
    Tokenizer.prototype.current = function () {
      var token = this.token;
      if (token === null) {
        throw new Error('token was unexpectedly null');
      }
      if (arguments.length === 0) {
        return token;
      }
      for (var i = 0; i < arguments.length; i++) {
        if (token.type === arguments[i]) {
          return token;
        }
      }
      throw new Error("token type was unexpectedly " + token.type);
    };
    Tokenizer.prototype.push = function (token) {
      this.token = token;
      this.tokens.push(token);
    };
    Tokenizer.prototype.currentAttribute = function () {
      return this._currentAttribute;
    };
    Tokenizer.prototype.addLocInfo = function () {
      if (this.options.loc) {
        this.current().loc = {
          start: {
            line: this.startLine,
            column: this.startColumn
          },
          end: {
            line: this.tokenizer.line,
            column: this.tokenizer.column
          }
        };
      }
      this.startLine = this.tokenizer.line;
      this.startColumn = this.tokenizer.column;
    };
    // Data
    Tokenizer.prototype.beginDoctype = function () {
      this.push({
        type: "Doctype" /* Doctype */,
        name: ''
      });
    };
    Tokenizer.prototype.appendToDoctypeName = function (char) {
      this.current("Doctype" /* Doctype */).name += char;
    };
    Tokenizer.prototype.appendToDoctypePublicIdentifier = function (char) {
      var doctype = this.current("Doctype" /* Doctype */);
      if (doctype.publicIdentifier === undefined) {
        doctype.publicIdentifier = char;
      } else {
        doctype.publicIdentifier += char;
      }
    };
    Tokenizer.prototype.appendToDoctypeSystemIdentifier = function (char) {
      var doctype = this.current("Doctype" /* Doctype */);
      if (doctype.systemIdentifier === undefined) {
        doctype.systemIdentifier = char;
      } else {
        doctype.systemIdentifier += char;
      }
    };
    Tokenizer.prototype.endDoctype = function () {
      this.addLocInfo();
    };
    Tokenizer.prototype.beginData = function () {
      this.push({
        type: "Chars" /* Chars */,
        chars: ''
      });
    };
    Tokenizer.prototype.appendToData = function (char) {
      this.current("Chars" /* Chars */).chars += char;
    };
    Tokenizer.prototype.finishData = function () {
      this.addLocInfo();
    };
    // Comment
    Tokenizer.prototype.beginComment = function () {
      this.push({
        type: "Comment" /* Comment */,
        chars: ''
      });
    };
    Tokenizer.prototype.appendToCommentData = function (char) {
      this.current("Comment" /* Comment */).chars += char;
    };
    Tokenizer.prototype.finishComment = function () {
      this.addLocInfo();
    };
    // Tags - basic
    Tokenizer.prototype.tagOpen = function () {};
    Tokenizer.prototype.beginStartTag = function () {
      this.push({
        type: "StartTag" /* StartTag */,
        tagName: '',
        attributes: [],
        selfClosing: false
      });
    };
    Tokenizer.prototype.beginEndTag = function () {
      this.push({
        type: "EndTag" /* EndTag */,
        tagName: ''
      });
    };
    Tokenizer.prototype.finishTag = function () {
      this.addLocInfo();
    };
    Tokenizer.prototype.markTagAsSelfClosing = function () {
      this.current("StartTag" /* StartTag */).selfClosing = true;
    };
    // Tags - name
    Tokenizer.prototype.appendToTagName = function (char) {
      this.current("StartTag" /* StartTag */, "EndTag" /* EndTag */).tagName += char;
    };
    // Tags - attributes
    Tokenizer.prototype.beginAttribute = function () {
      this._currentAttribute = ['', '', false];
    };
    Tokenizer.prototype.appendToAttributeName = function (char) {
      this.currentAttribute()[0] += char;
    };
    Tokenizer.prototype.beginAttributeValue = function (isQuoted) {
      this.currentAttribute()[2] = isQuoted;
    };
    Tokenizer.prototype.appendToAttributeValue = function (char) {
      this.currentAttribute()[1] += char;
    };
    Tokenizer.prototype.finishAttributeValue = function () {
      this.current("StartTag" /* StartTag */).attributes.push(this._currentAttribute);
    };
    Tokenizer.prototype.reportSyntaxError = function (message) {
      this.current().syntaxError = message;
    };
    return Tokenizer;
  }();
  _exports.Tokenizer = Tokenizer;
  function tokenize(input, options) {
    var tokenizer = new Tokenizer(new EntityParser(namedCharRefs), options);
    return tokenizer.tokenize(input);
  }
});
(function (m) { if (typeof module === "object" && module.exports) { module.exports = m } }(require("ember-template-compiler")));
}());
//# sourceMappingURL=ember-template-compiler.map
