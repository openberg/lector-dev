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


/**
 * Download some data.
 *
 * @param {string|URL} The origin of the data.
 * @param {object} options Download options, as an object
 * that may contain the following fields:
 *   {string} field The name of the XHR field contaiing the result.
 *     If unspecified, use the `response`.
 *   {string} responseType A responseType for the XHR.
 *     If unspecified, use the XHR default.
 *   {string} mimeType A mime type for the XHR.
 *     If unspecified, let the server or OS pick the mime type.
 *
 * @return {Promise}
 */
function download(source, options = {}) {
  if (typeof source == "string") {
    source = toURL(source);
  }
  if (!(source instanceof URL)) {
    throw new TypeError("Expected a URL, got " + source);
  }
  var promise = new Promise((resolve, reject) => {
    var downloader = new XMLHttpRequest();
    downloader.addEventListener("load", (e) => {
      resolve(downloader[options.field || "response"]);
    });
    downloader.addEventListener("abort", reject);
    downloader.addEventListener("cancel", reject);
    downloader.open("GET", source.href);
    if ("responseType" in options) {
      if (options.responseType == "objectURL") {
        downloader.responseType = "blob";
      } else {
        downloader.responseType = options.responseType;
      }
    }
    if ("mimeType" in options) {
      downloader.overrideMimeType(options.mimeType);
    }
    downloader.send();
  });
  if ("responseType" in options && options.responseType == "objectURL") {
    return promise.then(blob =>
      URL.createObjectURL(blob)
    );
  } else {
    return promise;
  }
}
exports.download = download;

return exports;
});
