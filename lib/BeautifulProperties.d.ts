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

