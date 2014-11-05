define(['js/config',
        'lib/lie/dist/lie.js'],
        function(Config, Promise) {
"use strict";

// Define `window.Promise` using a library.
if (!("Promise" in window)) {
  window.Promise = Promise;
  console.log("Polyfill", "Promise", window.Promise);
}

// Define window.URLSearchParams.
// See https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
if (!("URLSearchParams" in window) || Config.TESTING.POLYFILL_URL_SEARCH_PARAMS) {
  delete window.URLSearchParams;
  delete URL.prototype.searchParams;

  window.URLSearchParams = function URLSearchParams(url) {
    this._map = new Map();
    this._url = url;
    for (var entry of url.search.substring(1).split("&")) {
      var [k, v] = entry.split("=");
      this._map.set(k, v);
    }
  };
  window.URLSearchParams.prototype = {
    get: function(key) {
      return this._map.get(key);
    },
    delete: function(key) {
      var result = this._map.delete(key);
      this.url.search = "?" + this.toString();
    },
    has: function(key) {
      return this._map.has(key);
    },
    set: function(key, value) {
      this._map.set(key, value);
      this.url.search = "?" + this.toString();
    },
    toString: function() {
      var args = [k + "=" + v for ([k, v] of this._map)];
      return args.join("&");
    }
  };

  Object.defineProperty(URL.prototype, "searchParams", {
    get: function() {
      return new window.URLSearchParams(this);
    }
  });

  console.log("Polyfill", "UrlSearchParams", URLSearchParams);
}

});
