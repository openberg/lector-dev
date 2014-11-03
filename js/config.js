define(function() {
"use strict";

var DEBUG = true;

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

  /**
   * Various testing flags.
   */
  TESTING: {

    /**
     * Should we remove the standard URLSearchParams and replace it
     * with ours? Used to test URLSearchParams.
     */
    POLYFILL_URL_SEARCH_PARAMS: false,
  },
};

});
