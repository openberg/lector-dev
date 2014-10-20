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
 *
 * @param {zip.zipEntry} The underlying zipEntry.
 */
var Entry = function(zipEntry) {
  this._zipEntry = zipEntry;
  this._cachedEntry = null;
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

  /**
   * Return a shared object that may be used to 
   */
  asCachedEntry: function(key) {
    if (this._cachedEntry) {
      this._cachedEntry.acquire(key);
      return this._cachedEntry;
    }
    var object = this._cachedEntry = new CachedEntry(this);
    object.acquire(key);
    return object;
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

/**
 * Cached data
 *
 * Values of this type may be acquired and released. The underlying
 * value is kept in memory until all its users have released it, plus
 * a grace period during which other users may still acquire it. This
 * is useful for e.g. styles, background images, bulletpoints, etc.
 *
 * In most cases, you should use this instead of a raw `Entry`.
 */
function CachedEntry(entry) {
  this._promiseURL = entry.asObjectURL();
  this._clients = new Map();
  this._entry = entry;
  Object.freeze(this);
}
CachedEntry.prototype = {
  /**
   * Return the entry as an object URL.
   *
   * Callers should NOT revoke the object URL themselves. Rather, they should call `release`.
   *
   * @return {Promise<string>}
   */
  asObjectURL: function() {
    return this._promiseURL;
  },

  /**
   * Become one of the owners of the value.
   *
   * This method is called automatically by Entry.asCachedEntry.
   *
   * @param {*} key
   */
  acquire: function(key) {
    var clients = this._clients.get(key);
    if (!clients) {
      this._clients.set(key, 1);
    } else {
      this._clients.set(key, clients + 1);
    }
  },

  /**
   * Release ownership on the entry.
   *
   * Once the entry has no more owners, it will be deallocated, unless someones reallocates it within
   * a grace period.
   *
   * @param {*} key A key previously passed with `acquire()`.
   */
  release: function(key) {
    var clients = this._clients.get(key);
    if (clients == null) {
      throw new Error("Invalid key: " + key + ", expected one of " + [...this._clients.keys()].join());
    }
    this._clients.set(key, clients - 1);
    if (clients != 1) {
      console.log("I am not the last client for this entry with", key, this._entry.filename);
      return;
    }
    this._clients.delete(key);
    if (this._clients.size != 0) {
      console.log("I am not the last client for this entry", this._entry.filename);
      return;
    }
    // Oh, this was the last client.
    // We may want to remove the object from the cache.
    // Let's wait a bit, just in case someone immediately needs to read the same resource.
    window.setTimeout(() => {
      if (this._clients.size != 0) {
        // Someone else has acquired this object url, they are now in charge of deallocating it.
        console.log("Someone has reacquired the url", this._entry.filename);
        return;
      }
      console.log("Time to release this url once and for all", this._entry.filename);
      this._promiseURL.then(url => URL.revokeObjectURL(url));
      this._entry._cachedEntry = null;
    }, DELAY_BEFORE_UNLOAD);
  },
};
var DELAY_BEFORE_UNLOAD = 1000;


return Archive;
});
