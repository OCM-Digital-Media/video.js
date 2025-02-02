/**
 * @file mixins/evented.js
 * @module evented
 */
import window from 'global/window';
import * as Dom from '../utils/dom';
import * as Events from '../utils/events';
import * as Fn from '../utils/fn';
import * as Obj from '../utils/obj';
import EventTarget from '../event-target';
import DomData from '../utils/dom-data';
import log from '../utils/log';

const objName = (obj) => {
  if (typeof obj.name === 'function') {
    return obj.name();
  }

  if (typeof obj.name === 'string') {
    return obj.name;
  }

  if (obj.name_) {
    return obj.name_;
  }

  if (obj.constructor && obj.constructor.name) {
    return obj.constructor.name;
  }

  return typeof obj;
};

/**
 * Returns whether or not an object has had the evented mixin applied.
 *
 * @param  {Object} object
 *         An object to test.
 *
 * @return {boolean}
 *         Whether or not the object appears to be evented.
 */
const isEvented = (object) =>
  object instanceof EventTarget ||
  !!object.eventBusEl_ &&
  ['on', 'one', 'off', 'trigger'].every(k => typeof object[k] === 'function');

/**
 * Adds a callback to run after the evented mixin applied.
 *
 * @param  {Object} object
 *         An object to Add
 * @param  {Function} callback
 *         The callback to run.
 */
const addEventedCallback = (target, callback) => {
  if (isEvented(target)) {
    callback();
  } else {
    if (!target.eventedCallbacks) {
      target.eventedCallbacks = [];
    }
    target.eventedCallbacks.push(callback);
  }
};

/**
 * Whether a value is a valid event type - non-empty string or array.
 *
 * @private
 * @param  {string|Array} type
 *         The type value to test.
 *
 * @return {boolean}
 *         Whether or not the type is a valid event type.
 */
const isValidEventType = (type) =>
  // The regex here verifies that the `type` contains at least one non-
  // whitespace character.
  (typeof type === 'string' && (/\S/).test(type)) ||
  (Array.isArray(type) && !!type.length);

/**
 * Validates a value to determine if it is a valid event target. Throws if not.
 *
 * @private
 * @throws {Error}
 *         If the target does not appear to be a valid event target.
 *
 * @param  {Object} target
 *         The object to test.
 *
 * @param  {Object} obj
 *         The evented object we are validating for
 *
 * @param  {string} fnName
 *         The name of the evented mixin function that called this.
 */
const validateTarget = (target, obj, fnName) => {
  if (!target || (!target.nodeName && !isEvented(target))) {
    throw new Error(`Invalid target for ${objName(obj)}#${fnName}; must be a DOM node or evented object.`);
  }
};

/**
 * Validates a value to determine if it is a valid event target. Throws if not.
 *
 * @private
 * @throws {Error}
 *         If the type does not appear to be a valid event type.
 *
 * @param  {string|Array} type
 *         The type to test.
 *
 * @param  {Object} obj
*         The evented object we are validating for
 *
 * @param  {string} fnName
 *         The name of the evented mixin function that called this.
 */
const validateEventType = (type, obj, fnName) => {
  if (!isValidEventType(type)) {
    throw new Error(`Invalid event type for ${objName(obj)}#${fnName}; must be a non-empty string or array.`);
  }
};

/**
 * Validates a value to determine if it is a valid listener. Throws if not.
 *
 * @private
 * @throws {Error}
 *         If the listener is not a function.
 *
 * @param  {Function} listener
 *         The listener to test.
 *
 * @param  {Object} obj
 *         The evented object we are validating for
 *
 * @param  {string} fnName
 *         The name of the evented mixin function that called this.
 */
const validateListener = (listener, obj, fnName) => {
  if (typeof listener !== 'function') {
    throw new Error(`Invalid listener for ${objName(obj)}#${fnName}; must be a function.`);
  }
};

/**
 * Takes an array of arguments given to `on()` or `one()`, validates them, and
 * normalizes them into an object.
 *
 * @private
 * @param  {Object} self
 *         The evented object on which `on()` or `one()` was called. This
 *         object will be bound as the `this` value for the listener.
 *
 * @param  {Array} args
 *         An array of arguments passed to `on()` or `one()`.
 *
 * @param  {string} fnName
 *         The name of the evented mixin function that called this.
 *
 * @return {Object}
 *         An object containing useful values for `on()` or `one()` calls.
 */
const normalizeListenArgs = (self, args, fnName) => {

  // If the number of arguments is less than 3, the target is always the
  // evented object itself.
  const isTargetingSelf = args.length < 3 || args[0] === self || args[0] === self.eventBusEl_;
  let target;
  let type;
  let listener;

  if (isTargetingSelf) {
    target = self.eventBusEl_;

    // Deal with cases where we got 3 arguments, but we are still listening to
    // the evented object itself.
    if (args.length >= 3) {
      args.shift();
    }

    [type, listener] = args;
  } else {
    [target, type, listener] = args;
  }

  validateTarget(target, self, fnName);
  validateEventType(type, self, fnName);
  validateListener(listener, self, fnName);

  listener = Fn.bind(self, listener);

  return {isTargetingSelf, target, type, listener};
};

/**
 * Adds the listener to the event type(s) on the target, normalizing for
 * the type of target.
 *
 * @private
 * @param  {Element|Object} target
 *         A DOM node or evented object.
 *
 * @param  {string} method
 *         The event binding method to use ("on" or "one").
 *
 * @param  {string|Array} type
 *         One or more event type(s).
 *
 * @param  {Function} listener
 *         A listener function.
 */
const listen = (target, method, type, listener) => {
  validateTarget(target, target, method);

  if (target.nodeName) {
    Events[method](target, type, listener);
  } else {
    target[method](type, listener);
  }
};

/**
 * Contains methods that provide event capabilities to an object which is passed
 * to {@link module:evented|evented}.
 *
 * @mixin EventedMixin
 */
const EventedMixin = {

  /**
   * Add a listener to an event (or events) on this object or another evented
   * object.
   *
   * @param  {string|Array|Element|Object} targetOrType
   *         If this is a string or array, it represents the event type(s)
   *         that will trigger the listener.
   *
   *         Another evented object can be passed here instead, which will
   *         cause the listener to listen for events on _that_ object.
   *
   *         In either case, the listener's `this` value will be bound to
   *         this object.
   *
   * @param  {string|Array|Function} typeOrListener
   *         If the first argument was a string or array, this should be the
   *         listener function. Otherwise, this is a string or array of event
   *         type(s).
   *
   * @param  {Function} [listener]
   *         If the first argument was another evented object, this will be
   *         the listener function.
   */
  on(...args) {
    const {isTargetingSelf, target, type, listener} = normalizeListenArgs(this, args, 'on');

    listen(target, 'on', type, listener);

    // If this object is listening to another evented object.
    if (!isTargetingSelf) {

      // If this object is disposed, remove the listener.
      const removeListenerOnDispose = () => this.off(target, type, listener);

      // Use the same function ID as the listener so we can remove it later it
      // using the ID of the original listener.
      removeListenerOnDispose.guid = listener.guid;

      // Add a listener to the target's dispose event as well. This ensures
      // that if the target is disposed BEFORE this object, we remove the
      // removal listener that was just added. Otherwise, we create a memory leak.
      const removeRemoverOnTargetDispose = () => this.off('dispose', removeListenerOnDispose);

      // Use the same function ID as the listener so we can remove it later
      // it using the ID of the original listener.
      removeRemoverOnTargetDispose.guid = listener.guid;

      listen(this, 'on', 'dispose', removeListenerOnDispose);
      listen(target, 'on', 'dispose', removeRemoverOnTargetDispose);
    }
  },

  /**
   * Add a listener to an event (or events) on this object or another evented
   * object. The listener will be called once per event and then removed.
   *
   * @param  {string|Array|Element|Object} targetOrType
   *         If this is a string or array, it represents the event type(s)
   *         that will trigger the listener.
   *
   *         Another evented object can be passed here instead, which will
   *         cause the listener to listen for events on _that_ object.
   *
   *         In either case, the listener's `this` value will be bound to
   *         this object.
   *
   * @param  {string|Array|Function} typeOrListener
   *         If the first argument was a string or array, this should be the
   *         listener function. Otherwise, this is a string or array of event
   *         type(s).
   *
   * @param  {Function} [listener]
   *         If the first argument was another evented object, this will be
   *         the listener function.
   */
  one(...args) {
    const {isTargetingSelf, target, type, listener} = normalizeListenArgs(this, args, 'one');

    // Targeting this evented object.
    if (isTargetingSelf) {
      listen(target, 'one', type, listener);

    // Targeting another evented object.
    } else {
      // TODO: This wrapper is incorrect! It should only
      //       remove the wrapper for the event type that called it.
      //       Instead all listners are removed on the first trigger!
      //       see https://github.com/videojs/video.js/issues/5962
      const wrapper = (...largs) => {
        this.off(target, type, wrapper);
        listener.apply(null, largs);
      };

      // Use the same function ID as the listener so we can remove it later
      // it using the ID of the original listener.
      wrapper.guid = listener.guid;
      listen(target, 'one', type, wrapper);
    }
  },

  /**
   * Add a listener to an event (or events) on this object or another evented
   * object. The listener will only be called once for the first event that is triggered
   * then removed.
   *
   * @param  {string|Array|Element|Object} targetOrType
   *         If this is a string or array, it represents the event type(s)
   *         that will trigger the listener.
   *
   *         Another evented object can be passed here instead, which will
   *         cause the listener to listen for events on _that_ object.
   *
   *         In either case, the listener's `this` value will be bound to
   *         this object.
   *
   * @param  {string|Array|Function} typeOrListener
   *         If the first argument was a string or array, this should be the
   *         listener function. Otherwise, this is a string or array of event
   *         type(s).
   *
   * @param  {Function} [listener]
   *         If the first argument was another evented object, this will be
   *         the listener function.
   */
  any(...args) {
    const {isTargetingSelf, target, type, listener} = normalizeListenArgs(this, args, 'any');

    // Targeting this evented object.
    if (isTargetingSelf) {
      listen(target, 'any', type, listener);

    // Targeting another evented object.
    } else {
      const wrapper = (...largs) => {
        this.off(target, type, wrapper);
        listener.apply(null, largs);
      };

      // Use the same function ID as the listener so we can remove it later
      // it using the ID of the original listener.
      wrapper.guid = listener.guid;
      listen(target, 'any', type, wrapper);
    }
  },

  /**
   * Removes listener(s) from event(s) on an evented object.
   *
   * @param  {string|Array|Element|Object} [targetOrType]
   *         If this is a string or array, it represents the event type(s).
   *
   *         Another evented object can be passed here instead, in which case
   *         ALL 3 arguments are _required_.
   *
   * @param  {string|Array|Function} [typeOrListener]
   *         If the first argument was a string or array, this may be the
   *         listener function. Otherwise, this is a string or array of event
   *         type(s).
   *
   * @param  {Function} [listener]
   *         If the first argument was another evented object, this will be
   *         the listener function; otherwise, _all_ listeners bound to the
   *         event type(s) will be removed.
   */
  off(targetOrType, typeOrListener, listener) {

    // Targeting this evented object.
    if (!targetOrType || isValidEventType(targetOrType)) {
      Events.off(this.eventBusEl_, targetOrType, typeOrListener);

    // Targeting another evented object.
    } else {
      const target = targetOrType;
      const type = typeOrListener;

      // Fail fast and in a meaningful way!
      validateTarget(target, this, 'off');
      validateEventType(type, this, 'off');
      validateListener(listener, this, 'off');

      // Ensure there's at least a guid, even if the function hasn't been used
      listener = Fn.bind(this, listener);

      // Remove the dispose listener on this evented object, which was given
      // the same guid as the event listener in on().
      this.off('dispose', listener);

      if (target.nodeName) {
        Events.off(target, type, listener);
        Events.off(target, 'dispose', listener);
      } else if (isEvented(target)) {
        target.off(type, listener);
        target.off('dispose', listener);
      }
    }
  },

  /**
   * Fire an event on this evented object, causing its listeners to be called.
   *
   * @param   {string|Object} event
   *          An event type or an object with a type property.
   *
   * @param   {Object} [hash]
   *          An additional object to pass along to listeners.
   *
   * @return {boolean}
   *          Whether or not the default behavior was prevented.
   */
  trigger(event, hash) {
    validateTarget(this.eventBusEl_, this, 'trigger');

    const type = event && typeof event !== 'string' ? event.type : event;

    if (!isValidEventType(type)) {
      const error = `Invalid event type for ${objName(this)}#trigger; ` +
        'must be a non-empty string or object with a type key that has a non-empty value.';

      if (event) {
        (this.log || log).error(error);
      } else {
        throw new Error(error);
      }
    }
    return Events.trigger(this.eventBusEl_, event, hash);
  }
};

/**
 * Applies {@link module:evented~EventedMixin|EventedMixin} to a target object.
 *
 * @param  {Object} target
 *         The object to which to add event methods.
 *
 * @param  {Object} [options={}]
 *         Options for customizing the mixin behavior.
 *
 * @param  {string} [options.eventBusKey]
 *         By default, adds a `eventBusEl_` DOM element to the target object,
 *         which is used as an event bus. If the target object already has a
 *         DOM element that should be used, pass its key here.
 *
 * @return {Object}
 *         The target object.
 */
function evented(target, options = {}) {
  const {eventBusKey} = options;

  // Set or create the eventBusEl_.
  if (eventBusKey) {
    if (!target[eventBusKey].nodeName) {
      throw new Error(`The eventBusKey "${eventBusKey}" does not refer to an element.`);
    }
    target.eventBusEl_ = target[eventBusKey];
  } else {
    target.eventBusEl_ = Dom.createEl('span', {className: 'ovp-event-bus'});
  }

  Obj.assign(target, EventedMixin);

  if (target.eventedCallbacks) {
    target.eventedCallbacks.forEach((callback) => {
      callback();
    });
  }

  // When any evented object is disposed, it removes all its listeners.
  target.on('dispose', () => {
    target.off();
    [target, target.el_, target.eventBusEl_].forEach(function(val) {
      if (val && DomData.has(val)) {
        DomData.delete(val);
      }
    });
    window.setTimeout(() => {
      target.eventBusEl_ = null;
    }, 0);
  });

  return target;
}

export default evented;
export {isEvented};
export {addEventedCallback};
