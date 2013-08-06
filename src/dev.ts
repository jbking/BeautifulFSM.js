/// <reference path="BeautifulFSM.ts" />
module BeautifulFSM {
  export module StateMachine {
    export module dev {
      var hasConfirm: boolean = typeof window.confirm !== 'undefined';

      export function create(object: any, definition: Definition, option?: Option): void {
        var error = definition.error || function () {};
        definition.error = function () {
          var startDebug;
          var args = BeautifulFSM.util.Array_from(arguments);
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
        option = option || Object.create(null);
        option.versionizable = option.versionizable || Object.create(null);
        if (!(typeof option.versionizable.length === 'number' && option.versionizable.length > trackLength)) {
          option.versionizable.length = trackLength;
        }
        definition.trace = true;

        StateMachine.create(object, definition, option);
      }
    }
  }
}
