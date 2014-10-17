window.define(['js/urlutils'], function(UrlUtils) {
"use strict";

var zip = window.zip; // The zip library, defined by lib/zip.js/WebContent/zip.js
var URL = window.URL;

//
// Configure lib/zip.js/WebContent/zip.js so that the Web Worker
// can find its own source.
//
var scriptPath = UrlUtils.toURL("lib/zip.js/WebContent/");
window.zip.workerScriptsPath = scriptPath.href;

/**
 * Representation of a zip file.
 *
 * @param {Blob|URL} file A binary file, compressed as zip.
 * @constructor
 */
var Archive = function(file) {
  this._entries = new Map();
  this._initialized = false;
  this._promiseReader = null;
  this._name = null;
  if (file instanceof window.File) {
    this._initFromFile(file);
  } else if (file instanceof window.URL) {
    this._initFromURL(file);
  } else if (typeof file == "string") {
    this._initFromURL(UrlUtils.toURL(file));
  } else {
    throw new TypeError("Expected a File or a URL");
  }
};

Archive.prototype = {
  _initFromFile: function(file) {
    this._promiseReader = new Promise(resolve =>
      zip.createReader(new zip.BlobReader(file), resolve));
    this._name = file.name;
  },
  _initFromURL: function(url) {
    console.log("Archive: Attempting to open url", url);
    this._promiseReader = new Promise(resolve => {
      var downloader = new XMLHttpRequest();
      downloader.addEventListener("loadend", (e) => {
        zip.createReader(new zip.BlobReader(downloader.response), resolve);
      });
      downloader.open("GET", url.href);
      downloader.responseType = "blob";
      downloader.send();
    });
    this._name = url.href;
  },
  /**
   * Finish initialization of the archive.
   *
   * @return {Promise} A promise resolved once the archive is fully
   * initialized and may be used.
   */
  init: function() {
    return new Promise(resolve =>
      this._promiseReader.then(reader => {
        return reader.getEntries(entries => {
          for (var entry of entries) {
            this._entries.set(entry.filename, new Entry(entry));
          }
          this._initialized = true;
          resolve();
        });
      }));
  },

  /**
   * The set of entries in this archive, as a map from
   * filename to Entry.
   *
   * @type {Map<string, Entry>}
   */
  get entries() {
    if (!this._initialized) {
      throw new Error("Archive not initialized");
    }
    return this._entries;
  },

  toString: function() {
    return this._name;
  },
};


/**
 * Representation of an entry in a zip-compressed file.
 */
var Entry = function(zipEntry) {
  this._zipEntry = zipEntry;
};
Entry.prototype = {
  get filename() {
    return this._zipEntry.filename;
  },
  get directory() {
    return this._zipEntry.directory;
  },
  get compressedSize() {
    return this._zipEntry.compressedSize;
  },
  get uncompressedSize() {
    return this._zipEntry.uncompressedSize;
  },

  /**
   * Decompress the entry, return an object URL pointing to it.
   *
   * Do not forget to call `URL.revokeObjectURL` to revoke this URL
   * once it is not needed anymore.
   *
   * @return Promise<URL>
   */
  asObjectURL: function() {
    var promise = new Promise(resolve =>
      this._zipEntry.getData(new zip.BlobWriter(), resolve));
    promise = promise.then(blob =>
      URL.createObjectURL(blob));
    return promise;
  },

  /**
   * Parse the entry as a XML document.
   *
   * @return Promise<XMLDocument>
   */
  asXML: function() {
    var promiseURL = this.asObjectURL();
    var promise = new Promise(resolve =>
      promiseURL.then(url => {
        var parser = new XMLHttpRequest();
        parser.responseType = "xml";
        parser.addEventListener("loadend", (e) => {
          URL.revokeObjectURL(url);
          resolve(parser.responseXML);
        });
        parser.open("GET", url);
        parser.send();
    }));
    return promise;
  },

  toString: function() {
    return this.filename;
  },
};



return Archive;
});
