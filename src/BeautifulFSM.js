/**
 * @module BeautifulFSM
 * @version 0.0.1
 * @author jbking
 * @copyright (c) 2013 jbking
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 */
;(function(module,moduleName,global){
  // in AMD
  if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
    define(['BeautifulProperties'], function(BeautifulProperties) {
      return module(BeautifulProperties);
    });
  } else {
    // in a browser or Rhino
    global[moduleName] = module(BeautifulProperties);
  }
})((function(global, undefined) {
    var Array_from = (function () {
      return function(arrayLike) {
        var slice = Array.prototype.slice;
        return slice.call(arrayLike);
      };
    })();
    /**
     * @function
     * @param obj
     * @param key
     * @return {Boolean}
     */
    var hasOwn = Object.prototype.hasOwnProperty.call.bind(Object.prototype.hasOwnProperty);
    /**
     * @function
     * @return {Boolean}
     */
    var hasConsoleLog = global.console && global.console.log;
    /**
     * @function
     * @return {Boolean}
     */
    var hasConsoleWarn = global.console && global.console.warn;
    /**
     * @function
     * @return {Boolean}
     */
    var hasConfirm = global.confirm;

    return function (BeautifulProperties) {
      /**
       * @name BeautifulFSM
       * @namespace
       * @alias module:BeautifulFSM
       */
      var BeautifulFSM = Object.create(null);

      /**
       * @name StateMachine
       * @namespace
       * @memberOf BeautifulFSM
       */
      BeautifulFSM.StateMachine = Object.create(null);
      (function (StateMachine) {
        var errorHandlerKey = 'BeautifulFSM::StateMachine::error';
        var queueKey = 'BeautifulFSM::StateMachine::queue';
        var traceKey = 'BeautifulFSM::StateMachine::trace';
        StateMachine.create = function create(object, definition, options) {
          definition.events = definition.events || [];
          if (object.state) {
            if (hasConsoleWarn) {
              console.warn("hide existing context's state");
            }
          }
          BeautifulProperties.Hookable.define(object, 'state', {}, {value: {name: definition.initial}});
          BeautifulProperties.Versionizable.define(object, 'state', (options || {}).versionizable);

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
          for (key in specs_by_name) if (hasOwn(specs_by_name, key)) {
            var specs = specs_by_name[key];
            var id = key.substring(0, key.indexOf(':')) - 0;
            var name = key.substring(key.indexOf(':') + 1);
            entries.push({id: id, name: name, specs: specs});
          }
          // entry handlers
          entries.forEach(function (entry) {
            var handler = StateMachine.receive.bind(object, entry.specs);
            targets[entry.id].on(entry.name, handler);
            entry.handler = handler;
          });
          // instantiate destroy method.
          if (object.destroy) {
            if (hasConsoleWarn) {
              console.warn("hide existing context's destroy");
            }
          }
          object.destroy = function destroy() {
            entries.forEach(function (entry) {
              targets[entry.id].off(entry.name, entry.handler);
            });
          };
          // instantiate transit method.
          if (object.transit) {
            if (hasConsoleWarn) {
              console.warn("hide existing context's transit");
            }
          }
          object.transit = function transitionFromOutside(next) {
            StateMachine.manualTransition.call(object, next);
            StateMachine.checkAvailableTransition.call(object);
          };

          object[errorHandlerKey] = definition.error || function () {};
          object[queueKey] = [];
          object[traceKey] = definition.trace || false;
        };
        StateMachine.manualTransition = function manualTransition(next) {
          var args = Array_from(arguments);
          // drop next
          args.shift();
          this[queueKey].unshift([{to: next}, args]);
        };
        StateMachine.receive = function receive(specs, event) {
          var args = Array_from(arguments);
          // drop specs
          args.shift();

          if (this[traceKey] && hasConsoleLog) {
            console.log('Receive an event:', event, 'with arguments:', args.slice(1));
          }

          var i;
          for (i in specs) if (hasOwn(specs, i) && specs[i] !== undefined) {
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
              StateMachine.checkAvailableTransition.call(this);
              return;
            }
          }
          // no matched.
          this[errorHandlerKey].call(this, event, args);
        };
        StateMachine.checkAvailableTransition = function checkAvailableTransition() {
          var queue = this[queueKey];
          while (queue.length > 0) {
            var e = queue.shift();
            StateMachine.transit.apply(this, e);
          }
        };
        StateMachine.transit = function transit(spec, args) {
          var context = Object.create(this);
          var state = this.state;
          // override for context inside transition request.
          context.transit = StateMachine.manualTransition.bind(this);
          context.state = state;

          if (context[traceKey] && hasConsoleLog) {
            console.log('State change "' + state.name + '" to "' + spec.to + '"');
          }

          if (state.name === spec.to) {
            args.unshift('fsm:' + state.name + ':cyclic');
            this.triggerWithBubbling.apply(context, args);
            args.shift();
            state.from = state.name;
          } else {
            var predecessor = state;
            var successor = {name: spec.to, from: predecessor.name};
            for (var prop in state) if (!hasOwn(successor, prop)) {
              successor[prop] = state[prop];
            }

            context.successor = successor;
            args.unshift('fsm:' + predecessor.name + ':leave');
            this.triggerWithBubbling.apply(context, args);
            delete context.successor;
            args.shift();

            context.state = state = successor;
            context.predecessor = predecessor;
            args.unshift('fsm:' + successor.name + ':enter');
            this.triggerWithBubbling.apply(context, args);
            delete context.predecessor;
            args.shift();

            // write back to original context.
            this.state = context.state;
          }
          args.unshift('fsm:' + state.name + ':at');
          this.triggerWithBubbling.apply(context, args);
          args.shift();
        };
        StateMachine.dev = Object.create(null);
        (function (dev) {
          dev.create = function create(object, definition, options) {
            var error = definition.error || function () {};
            definition.error = function () {
              var startDebug;
              var args = Array_from(arguments);
              var ev = args.shift();
              var versions = BeautifulProperties.Versionizable.getVersions(this, 'state');
              if (hasConfirm) {
                var i, s = '';
                for (i=0; i < 3; i++) if (versions[i]) {
                  var state = versions[i].value;
                  s += '' + i + ':' + state.name + '\n';
                }
                startDebug = confirm("Start debugging?\n" + ev.type + "\n" + s);
              } else {
                startDebug = true;
              }
              if (startDebug) {
                debugger;
              }
              error.apply(this, args);
            };
            var trackLength = 777;
            options = options || Object.create(null);
            options.versionizable = options.versionizable || Object.create(null);
            if (!(typeof options.versionizable.length === 'number' && options.versionizable.length > trackLength)) {
              options.versionizable.length = trackLength;
            }
            definition.trace = true;
            return StateMachine.create(object, definition, options);
          };
        })(StateMachine.dev);
      })(BeautifulFSM.StateMachine);

      return BeautifulFSM;
    };
  })(this),'BeautifulFSM',this);
