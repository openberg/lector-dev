/**
 * Various utilities for working with paths.
 */
define(['js/config'],
function(Config) {
"use strict";

var URL = window.URL;

var exports = {};

function toURL(string) {
  try {
    // Handle absolute URLs
    return new URL(string);
  } catch (ex if ex instanceof TypeError) {
    var url = new URL(window.location);
    return append(url, string);
  }
};
exports.toURL = toURL;

function append(url, string) {
  if (!(url instanceof URL)) {
    throw new TypeError();
  }
  url = new URL(url.href);
  url.href = url.href.substring(0, url.href.length - url.search.length);
  if (!url.href.endsWith("/")) {
    url.href += "/../";
  }
  url.href += string;
  console.log(url);
  return url;
}
exports.append = append;


// Additional utilities, for compatibility with older browsers
// (including older versions of Firefox OS).

// Define window.URLSearchParams.
// See https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
if (!("URLSearchParams" in window) || Config.TESTING.POLYFILL_URL_SEARCH_PARAMS) {
  console.log("Polyfill for UrlSearchParams");
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
}

return exports;
});
