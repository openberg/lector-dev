define(function() {
"use strict";

let DEBUG = true;

/**
 * Miscellaneous information on the application.
 */
return {
  /**
   * The name of the application.
   */
  application: "OpenBerg Lector",

  /**
   * The version of the application.
   */
  version: "7.0a1",

  /**
   * If `true`, show DEBUG messages. If `false`, don't.
   *
   * @type boolean
   */
  get debug() {
    return DEBUG;
  },
  set debug(x) {
    DEBUG = x;
  },
};
  
});
