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
   * The size of book fonts, as a CSS property.
   */
  fontSize: "15pt",

  /**
   * The theme to use.
   *
   * @type {string|null} Relative path of a CSS file.
   */
  theme: null,

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
