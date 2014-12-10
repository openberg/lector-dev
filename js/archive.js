define([
  'js/urlutils'
], function(
  UrlUtils
) {
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
  /**
   * Mapping from url(string) -> Entry
   */
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
    console.error("Archive", "constructor", "Expected a File or a URL", file);
    throw new TypeError("Expected a File or a URL");
  }
};

Archive.prototype = {
  _initFromFile: function(file) {
    this._promiseReader = new Promise((resolve, reject) => {
      console.log("Archive", "_initFromFile");
      zip.createReader(new zip.BlobReader(file), resolve)
    });
    this._name = file.name;
  },
  _initFromURL: function(url) {
    if (!url instanceof window.URL) {
      throw new TypeError("Expected a URL");
    }
    console.log("Archive", "_initFromURL", url, typeof url);
    var promise = UrlUtils.download(url, {
      responseType: "blob"
    });
    promise = promise.then(blob =>
      new Promise((resolve, reject) => {
        zip.createReader(new zip.BlobReader(blob), resolve, reject);
      })
    );
    this._promiseReader = promise;
    this._promiseReader.catch(error => {
      console.error("Archive", "_initFromURL", error);
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
 *
 * @param {zip.zipEntry} The underlying zipEntry.
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
   * @return Promise<string>
   */
  asObjectURL: function() {
    var promise = new Promise(resolve =>
      this._zipEntry.getData(new zip.BlobWriter(), resolve));
    promise = promise.then(blob =>
      URL.createObjectURL(blob));
    return promise;
  },

  toString: function() {
    return this.filename;
  },
};



return Archive;
});
