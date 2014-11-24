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
  return url;
}
exports.append = append;

function cleanupBlobURL(string) {
  var hashPosition = string.indexOf("#");
  if (hashPosition == -1) {
    return string;
  } else {
    return string.substring(0, hashPosition);
  }
}
exports.cleanupBlobURL = cleanupBlobURL;

return exports;
});
