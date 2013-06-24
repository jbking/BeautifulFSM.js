"use strict";

function checkTransition(fsm, from, to, event) {
  var leaved, entered, at;
  fsm.on('fsm:' + from + ':leave', function () { leaved = true; });
  fsm.on('fsm:' + to + ':enter', function () { entered = true; });
  fsm.on('fsm:' + to + ':at', function () { at = true; });
  if (typeof event === 'string') {
    fsm.trigger(event);
  } else {
    fsm.trigger.apply(fsm, event);
  }
  expect(leaved).toBe(true);
  expect(entered).toBe(true);
  expect(at).toBe(true);
}

function checkCyclicTransition(fsm, at, event) {
  var leaved, entered, cyclic, at;
  fsm.on('fsm:' + at + ':leave', function () { leaved = true; });
  fsm.on('fsm:' + at + ':enter', function () { entered = true; });
  fsm.on('fsm:' + at + ':cyclic', function () { cyclic = true; });
  fsm.on('fsm:' + at + ':at', function () { at = true; });
  if (typeof event === 'string') {
    fsm.trigger(event);
  } else {
    fsm.trigger.apply(fsm, event);
  }
  expect(leaved).toBeUndefined();
  expect(entered).toBeUndefined();
  expect(cyclic).toBe(true);
  expect(at).toBe(true);
}

describe("A StateMachine", function () {
  var obj;

  beforeEach(function () {
    function O() {}
    BeautifulProperties.Events.provideMethods(O.prototype);

    obj = new O();
    BeautifulFSM.StateMachine.create(obj, {
      initial: 'foo',
      events: [
        // Don't enter to baz because of their predicate.
        {name: 'ev', to: 'bar'},
        {name: 'ev', to: 'baz'}
      ]
    });
  });

  it("be initialized.", function () {
    expect(obj).not.toBeNull();
    expect(obj.state.name).toEqual('foo');
  });

  it("do transit.", function () {
    obj.trigger('ev');
    expect(obj.state.name).toEqual('bar');
  });

  it("do emit transit events.", function () {
    checkTransition(obj, 'foo', 'bar', 'ev');
    checkCyclicTransition(obj, 'bar', 'ev');
  });

  it("do emit transit events to their prototype.", function () {
    var foo_leave;
    obj.constructor.prototype.on('fsm:foo:leave', function () { foo_leave = true; });
    obj.trigger('ev');
    expect(foo_leave).toBe(true);
  });

  it("each state knows context, predecessor and successor.", function () {
    var context, foo_successor, bar_predecessor;
    obj.foo = 'foo';
    obj.on('fsm:foo:leave', function () { context = this; foo_successor = this.successor.name; });
    obj.on('fsm:bar:enter', function () { bar_predecessor = this.predecessor.name; });
    obj.trigger('ev');
    expect(context.foo).toEqual('foo');
    expect(foo_successor).toEqual('bar');
    expect(bar_predecessor).toEqual('foo');
  });

  it("can destroy which disable their event dispatch.", function () {
    var foo_leave;
    obj.on('fsm:foo:leave', function () { foo_leave = true; });
    BeautifulFSM.StateMachine.destroy(obj);
    obj.trigger('ev');
    expect(foo_leave).toBeUndefined();
  });
});

describe("The from predicate", function () {
  var obj;

  beforeEach(function () {
    function O() {}
    BeautifulProperties.Events.provideMethods(O.prototype);

    obj = new O();
    BeautifulFSM.StateMachine.create(obj, {
      initial: 'foo',
      events: [
        {name: 'ev', from: ['foo', 'baz'], to: 'bar'},
        {name: 'ev', from: 'bar', to: 'baz'}
      ]
    });
  });

  it("do transit cyclicly with the graph.", function () {
    checkTransition(obj, 'foo', 'bar', 'ev');
    checkTransition(obj, 'bar', 'baz', 'ev');
    checkTransition(obj, 'baz', 'bar', 'ev');
  });
});

describe("The when predicate", function () {
  var obj, context;

  beforeEach(function () {
    function O() {}
    BeautifulProperties.Events.provideMethods(O.prototype);

    obj = new O();
    BeautifulFSM.StateMachine.create(obj, {
      initial: 'foo',
      events: [
        {name: 'ev', to: 'bar', when: function () { context = this; return this.state.name == 'foo'; }},
        {name: 'ev', to: 'baz', when: function () { return this.state.name == 'bar'; }},
        {name: 'ev', to: 'bar', when: function () { return this.state.name == 'baz'; }}
      ]
    });
  });

  it("do transit cyclicly with the graph.", function () {
    checkTransition(obj, 'foo', 'bar', 'ev');
    expect(context).toEqual(obj);
    checkTransition(obj, 'bar', 'baz', 'ev');
    checkTransition(obj, 'baz', 'bar', 'ev');
  });
});

describe("Delegation", function () {
  var obj1, obj2;

  beforeEach(function () {
    function O() {}
    BeautifulProperties.Events.provideMethods(O.prototype);

    obj1 = new O();
    obj2 = new O();
    BeautifulFSM.StateMachine.create(obj2, {
      initial: 'foo',
      events: [
        {name: 'ev', to: 'bar', delegatee:obj1}
      ]
    });
  });

  it("do it.", function () {
    var bar_enter;
    obj2.on('fsm:bar:enter', function () { bar_enter = true; });
    obj1.trigger('ev');
    expect(bar_enter).toBe(true);
  });
});

describe("Transit behaviour", function () {
  var obj;

  beforeEach(function () {
    function O() {}
    BeautifulProperties.Events.provideMethods(O.prototype);

    obj = new O();
    BeautifulFSM.StateMachine.create(obj, {
      initial: '1st',
      events: [
        {name: '2nd', to: '2nd'},
        {name: '3rd', to: '3rd'},
        {name: '4th', to: '4th'}
      ]
    },
    {
      versionizable: {length: 3}
    }
    );
  });

  it("trigger method pushs the transition.", function () {
    obj.trigger('2nd');
    var versions = BeautifulProperties.Versionizable.getVersions(obj, 'state');
    expect(versions.length).toBe(2);
    expect(versions[0].value.name).toEqual('2nd');
    expect(versions[1].value.name).toEqual('1st');
  });

  it("transit method also works as the trigger method.", function () {
    obj.transit('3rd');
    var versions = BeautifulProperties.Versionizable.getVersions(obj, 'state');
    expect(versions.length).toBe(2);
    expect(versions[0].value.name).toEqual('3rd');
    expect(versions[1].value.name).toEqual('1st');
  });

  it("transit method in callback do sequentially.", function () {
    obj.on('fsm:2nd:enter', function () {
      this.transit('3rd');
    })
    obj.transit('2nd');
    obj.transit('4th');
    var versions = BeautifulProperties.Versionizable.getVersions(obj, 'state');
    expect(versions.length).toBe(3);
    expect(versions[0].value.name).toEqual('4th');
    expect(versions[1].value.name).toEqual('3rd');
    expect(versions[2].value.name).toEqual('2nd');
  });
});

describe("Delegation for all", function () {
  var obj1, obj2;

  beforeEach(function () {
    function O() {}
    BeautifulProperties.Events.provideMethods(O.prototype);

    obj1 = new O();
    obj2 = new O();
    BeautifulFSM.StateMachine.create(obj2, {
      initial: 'foo',
      delegatee: obj1,
      events: [
        {name: 'ev', to: 'bar'}
      ]
    });
  });

  it("do it.", function () {
    var bar_enter;
    obj2.on('fsm:bar:enter', function () { bar_enter = true; });
    obj1.trigger('ev');
    expect(bar_enter).toBe(true);
  });

  it("also support manual transition without delegatee.", function () {
    var bar_enter;
    obj2.on('fsm:bar:enter', function () { bar_enter = true; });
    obj2.transit('bar');
    expect(bar_enter).toBe(true);
  });
});

describe("Passing event", function () {
  var obj, when_args, state_args;

  beforeEach(function () {
    function O() {}
    BeautifulProperties.Events.provideMethods(O.prototype);

    obj = new O();
    BeautifulFSM.StateMachine.create(obj, {
      initial: 'foo',
      events: [
        {name: 'ev', to: 'bar', when: function () { when_args = arguments; return true; }}
      ]
    });
    obj.on('fsm:foo:leave', function () { state_args = arguments; });
  });

  it("do it.", function () {
    obj.trigger('ev', 'foo');
    expect(when_args[0].type).toEqual('ev');
    expect(when_args[1]).toEqual('foo');
    expect(state_args[0].type).toEqual('fsm:foo:leave');
    expect(state_args[1]).toEqual('foo');
  });
});

describe("Taking predecessor state", function () {
  var obj;

  beforeEach(function () {
    function O() {}
    BeautifulProperties.Events.provideMethods(O.prototype);

    obj = new O();
    BeautifulFSM.StateMachine.create(obj, {
      initial: 'foo',
      events: [
        {name: 'ev', to: 'bar'}
      ]
    });
  });

  it("do it.", function () {
    obj.trigger('ev');
    var predecessor = BeautifulProperties.Versionizable.getPreviousValue(obj, 'state');
    expect(predecessor.name).toEqual('foo');
  });
});

describe("Passing runtime state", function () {
  var obj;

  beforeEach(function () {
    function O() {}
    BeautifulProperties.Events.provideMethods(O.prototype);

    obj = new O();
    BeautifulFSM.StateMachine.create(obj, {
      initial: 'foo',
      events: [
        {name: 'ev', to: 'bar'}
      ]
    });
  });

  it("do it.", function () {
    obj.on('fsm:bar:enter', function () { this.state.acc = 0; });
    obj.on('fsm:bar:at', function () { this.state.acc++; });
    obj.trigger('ev');
    obj.trigger('ev');
    obj.trigger('ev');
    expect(obj.state.acc).toEqual(3);
  });
});

describe("Handle transition error", function () {
  var obj, hook_error;

  beforeEach(function () {
    function O() {}
    BeautifulProperties.Events.provideMethods(O.prototype);

    obj = new O();
    BeautifulFSM.StateMachine.create(obj, {
      initial: 'foo',
      events: [
        {name: 'ev', from: 'another_foo', to: 'bar'}
      ],
      error: function () {
        hook_error = true;
      }
    });
  });

  it("do it.", function () {
    obj.trigger('ev');
    expect(hook_error).toEqual(true);
  });
});

describe("Event rule for skipping", function () {
  var obj, foo_leave, foo_at, bar_enter;

  beforeEach(function () {
    function O() {}
    BeautifulProperties.Events.provideMethods(O.prototype);

    obj = new O();
    BeautifulFSM.StateMachine.create(obj, {
      initial: 'foo',
      events: [
        {name: 'ev', skip: true},
        {name: 'ev', to: 'bar'}  // this won't match anyway.
      ]
    });
  });

  it("do not any effect.", function () {
    obj.on('fsm:foo:at', function () {
      foo_at = true;
    });
    obj.on('fsm:foo:leave', function () {
      foo_leave = true;
    });
    obj.on('fsm:bar:enter', function () {
      bar_enter = true;
    });
    obj.trigger('ev');
    expect(foo_at).toBe(undefined);
    expect(foo_leave).toBe(undefined);
    expect(bar_enter).toBe(undefined);
  });
});
