/**
 * @module BeautifulFSM
 * @version 0.0.1
 * @author jbking
 * @copyright (c) 2013 jbking
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 */
declare module BeautifulProperties {
  interface Event {
  }

  module Hookable {
    interface Option {
      value: any;
    }
    function define(object: any, key: string, options: Option): void;
  }

  module Versionizable {
    interface Option {
      length: number;
    }
    function define(object: any, key: string, options: Option): void;
    function getVersions(object: any, key: string): any[];
  }
}

module BeautifulFSM {
  export module util {
    export var Array_from: (IArguments) => any[] = (function () {
      return function(arrayLike) {
        var slice = Array.prototype.slice;
        return slice.call(arrayLike);
      };
    })();
    export var hasOwn: (object: any, key: string) => boolean = Object.prototype.hasOwnProperty.call.bind(Object.prototype.hasOwnProperty);
  }

  export module StateMachine {
    export interface Definition {
      initial: string;
      events: any[];
      delegatee?: any;
      error?: (event: BeautifulProperties.Event, ...args: any[]) => void;
      trace?: boolean;
    }

    export interface Option {
      versionizable?: BeautifulProperties.Versionizable.Option;
    }

    export interface FSM {
      trigger: (event: string, ...args: any[]) => void;
    }

    var errorHandlerKey = 'BeautifulFSM::StateMachine::error';
    var queueKey = 'BeautifulFSM::StateMachine::queue';
    var traceKey = 'BeautifulFSM::StateMachine::trace';
    var destroyKey = 'BeautifulFSM::StateMachine::destroy';

    export function create(object: any, definition: Definition, option: Option = {}): void {
      if (object.state) {
        console.warn("hide existing context's state");
      }
      BeautifulProperties.Hookable.define(object, 'state', {value: {name: definition.initial}});
      BeautifulProperties.Versionizable.define(object, 'state', option.versionizable);

      var target = definition.delegatee || object;
      var targets = [target];
      function targetId (o) {
        var id = targets.indexOf(o);
        if (id === -1) {
          targets.push(o);
          id = targets.length - 1;
        }
        return id;
      }

      // construct entries group by delegatee and event name
      var specs_by_name = {}, entries = [];
      definition.events.forEach(function (spec) {
        var key = '' + targetId(spec.delegatee || target) + ':' + spec.name;
        if(specs_by_name[key] === undefined) {
          specs_by_name[key] = [];
        }
        specs_by_name[key].push(spec);
      });
      var key;
      for (key in specs_by_name) if (BeautifulFSM.util.hasOwn(specs_by_name, key)) {
        var specs = specs_by_name[key];
        var id = key.substring(0, key.indexOf(':')) - 0;
        var name = key.substring(key.indexOf(':') + 1);
        entries.push({id: id, name: name, specs: specs});
      }
      // entry handlers
      entries.forEach(function (entry) {
        var handler = receive.bind(object, entry.specs);
        targets[entry.id].on(entry.name, handler);
        entry.handler = handler;
      });
      object.on(destroyKey, function f() {
        object.off(destroyKey, f);
        entries.forEach(function (entry) {
          targets[entry.id].off(entry.name, entry.handler);
        });
      });
      // instantiate transit method.
      if (object.transit) {
        console.warn("hide existing context's transit");
      }
      object.transit = function transitionFromOutside(next) {
        manualTransition.call(object, next);
        checkAvailableTransition.call(object);
      };

      object[errorHandlerKey] = definition.error || function () {};
      object[queueKey] = [];
      object[traceKey] = definition.trace || false;
    };

    export function destroy(fsm: FSM) {
      fsm.trigger(destroyKey);
    };

    function manualTransition(next: string) {
      var args = BeautifulFSM.util.Array_from(arguments);
      // drop next
      args.shift();
      this[queueKey].unshift([{to: next}, args]);
    };

    function receive(specs, event) {
      var args = BeautifulFSM.util.Array_from(arguments);
      // drop specs
      args.shift();

      if (this[traceKey]) {
        console.log('Receive an event:', event, 'with arguments:', args.slice(1));
      }

      var i;
      for (i in specs) if (BeautifulFSM.util.hasOwn(specs, i) && specs[i] !== undefined) {
        var spec = specs[i];
        var conditions = [];
        if (spec.from) {
          var froms;
          if (typeof spec.from === 'string') {
            froms = [spec.from];
          } else {
            froms = spec.from;
          }
          conditions.push(function () {
            return froms.some(function (from) { return from === this.state.name; }, this);
          });
        }
        if (spec.when) {
          conditions.push(spec.when);
        }
        if (conditions.every(function (condition) { return condition.apply(this, args); }, this)) {
          if (spec.skip) {
            return;
          }
          // drop event
          args.shift();
          this[queueKey].push([spec, args]);
          checkAvailableTransition.call(this);
          return;
        }
      }
      // no matched.
      this[errorHandlerKey].call(this, event, args);
    };

    function checkAvailableTransition() {
      var queue = this[queueKey];
      while (queue.length > 0) {
        var e = queue.shift();
        transit.apply(this, e);
      }
    };

    function transit(spec, args) {
      var context = Object.create(this);
      var state = this.state;
      // override for context inside transition request.
      context.transit = manualTransition.bind(this);
      context.state = state;

      if (context[traceKey]) {
        console.log('State change "' + state.name + '" to "' + spec.to + '"');
      }

      if (state.name === spec.to) {
        args.unshift('fsm:' + state.name + ':cyclic');
        this.trigger.apply(context, args);
        args.shift();
        state.from = state.name;
      } else {
        var predecessor = state;
        var successor = {name: spec.to, from: predecessor.name};
        for (var prop in state) if (! BeautifulFSM.util.hasOwn(successor, prop)) {
          successor[prop] = state[prop];
        }

        context.successor = successor;
        args.unshift('fsm:' + predecessor.name + ':leave');
        this.trigger.apply(context, args);
        delete context.successor;
        args.shift();

        context.state = state = successor;
        context.predecessor = predecessor;
        args.unshift('fsm:' + successor.name + ':enter');
        this.trigger.apply(context, args);
        delete context.predecessor;
        args.shift();

        // write back to original context.
        this.state = context.state;
      }
      args.unshift('fsm:' + state.name + ':at');
      this.trigger.apply(context, args);
      args.shift();
    };
  }
}
