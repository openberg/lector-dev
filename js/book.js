window.define(['js/observable',
               'js/zip'],
              function(Observable, Zip) {
"use strict";

var console = window.console;
var URL = window.URL;

/**
 * @constructor
 */
var Archive = function(file) {
  if (!(file instanceof window.File)) {
    throw new TypeError("Expected a File");
  }
  this._promiseReader =
    new Promise(resolve => Zip.createReader(new Zip.BlobReader(file), resolve));
};
Archive.prototype = {
  promiseEntries: function() {
    return new Promise(resolve =>
      this._promiseReader.then(reader => {
        return reader.getEntries(resolve);
    }));
  },
};

var findWithFallback = function(array, ideal) {
  if (array.length == 0) {
    throw new Error("Could not find document " + ideal + " or any fallback");
  }
  if (array.length == 1) {
    return array[0];
  }
  var result = array.find(x => x.filename == ideal);
  if (result) {
    return result;
  }
  return array[0];
};

/**
 * Parse binary data to XML, asynchronously.
 */
var promiseParseXML = function(blob) {
  var url = URL.createObjectURL(blob);
  var parser = new XMLHttpRequest();
  parser.responseType = "xml";
  var result = new Promise(resolve => {
    parser.addEventListener("loadend", (e) => {
      URL.revokeObjectURL(url);
      resolve(parser.responseXML);
    });
    // FIXME: Handle errors
  });
  parser.open("GET", url);
  parser.send();
  return result;
};

/**
 * Representation of a book.
 *
 * @notifies "open" Once the book has been initialized and may be read.
 * @extends Observable 
 * @constructor
 */
var Book = function(file) {
  Observable.call(this, ["open"]);
  this._archive = new Archive(file);
  this._initialized = false;
  this._package = null;
  this._toc = null;

  var resolveInitialized = null;
  this._promiseInitialized = new Promise(resolve => resolveInitialized = resolve);;


  // Read package document and toc document.
  var promise = this._archive.promiseEntries();

  promise = promise.then(entries => {
    // The package document has extension ".opf". Generally, it is
    // called "content.opf", but there is no obligation. Similarly,
    // the toc document has extension ".ncx" but and could be
    // "toc.ncx".
    var opfEntries = [];
    var ncxEntries = [];
    for (var e of entries) {
      if (e.filename.endsWith(".opf")) {
        opfEntries.push(e);
      } else if (e.filename.endsWith(".ncx")) {
        ncxEntries.push(e);
      }
    }
    var packageEntry = findWithFallback(opfEntries, "content.opf");
    var tocEntry = findWithFallback(ncxEntries, "toc.ncx");

    var promisePackageBlob = new Promise(resolve => {
      return packageEntry.getData(new Zip.BlobWriter(), resolve);
    });
    var promiseTocBlob = new Promise(resolve => {
      return tocEntry.getData(new Zip.BlobWriter(), resolve);
    });
    return Promise.all([promisePackageBlob, promiseTocBlob]);
  });
  promise = promise.then(([packageBlob, tocBlob]) => {
    var promisePackage = promiseParseXML(packageBlob);
    var promiseToc = promiseParseXML(tocBlob);

    return Promise.all([promisePackage, promiseToc]);
  });
  promise = promise.then(([pkg, toc]) => {
    this._package = pkg;
    this._toc = toc;
    this._initialized = true;
    resolveInitialized();
  });
  promise = promise.then(null, ex => {
    console.error("Error reading book metadata", ex);
    throw ex;
  });

  // Now extract useful information from metadata
  
};
Book.prototype = {
  __proto__: Object.create(Observable.prototype),

  /**
   * Initialize the book, asynchronously.
   *
   * Do not use the other methods of this constructor until the promise
   * returned by this method has resolved.
   *
   * @return
   */
  init: function() {
    return this._promiseInitialized;
  },

  _ensureInitialized: function() {
    if (!this._initialized) {
        throw new Error("Book is not initialized yet. Please wait until `promiseInit` has resolved before calling other methods");
    }
  },

  get _tocDocument() {
    this._ensureInitialized();
    return this._toc;
  },

  get _packageDocument() {
    this._ensureInitialized();
    return this._package;
  },

  get title() {
    var node =
        this._tocDocument.querySelector("ncx > docTitle > text")
     || this._packageDocument.querySelector("package > metadata > title");
    if (node) {
      return node.textContent;
    }
    return undefined;
  },

  get author() {
    var node =
        this._tocDocument.querySelector("ncx > docAuthor > text")
     || this._packageDocument.querySelector("package > metadata > creator");
    if (node) {
      return node.textContent;
    }
    return undefined;
  },
};


// Module definition
return Book;
});
