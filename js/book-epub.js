window.define(['js/archive',
               'js/book'],
              function(Archive, Book) {
"use strict";

var console = window.console;

/**
 * Representation of a book in ePub format
 *
 * @constructor
 */
var BookEpub = function(file) {
  Book.call(this);

  // Function to call once initialization is complete.
  var resolveInitialized = null;

  this._archive = new Archive(file);
  this._initialized = false;
  this._package = null;
  this._toc = null;
  this._promiseInitialized = new Promise(resolve => resolveInitialized = resolve);
  this._promiseInitialized.then(() => this._initialized = true);
  this._chapters = [];
  this._resources = new Map();
  this._resolveTo = null;

  // Read package document and toc document.
  var promise = this._archive.init();

  promise = promise.then(() => {
    // File `container.xml` tells us where we can find the package document.
    // (generally OEBPS/content.opf).
    var containerEntry = new Book.Resource("container.xml", this._archive.entries.get("META-INF/container.xml"));
    console.log("Container entry", containerEntry);
    return containerEntry.asXML(this, true);
  });

  promise = promise.then(container => {
    // Extract the information and parse the package document.
    var eltRoot = container.querySelector("container > rootfiles > rootfile");
    var path = eltRoot.getAttribute("full-path");
    this._resolveTo = path.substring(0, path.lastIndexOf("/"));;
    return new Book.Resource(path, this._archive.entries.get(path)).asXML(this, true);
  });

  promise = promise.then((pkg) => {
    this._package = pkg;

    // Extract the table of contents
    console.log("I have the following files", [...this._archive.entries.keys()]);
    for (var itemref of pkg.querySelectorAll("package > spine > itemref")) {
      var item = this._getElementById(pkg, itemref.getAttribute("idref"));
      console.log("Item", pkg, itemref, itemref.getAttribute("idref"), item);
      if (!item) {
        console.log(new XMLSerializer().serializeToString(pkg));
      }
      var href = item.getAttribute("href");
      var url;
      try {
        // The url may be absolute
        url = (new URL(href)).href;
      } catch (ex if ex instanceof TypeError) {
        // ... or relative.
        url = this._resolveTo ? this._resolveTo + "/" + href : href;
      }
      console.log("Looking for url", url, href);
      this._chapters.push(new Book.Resource(url, this._archive.entries.get(url)));
    }
  });

  promise = promise.then(resolveInitialized, ex => {
    // Make sure that errors are reported early.
    console.error("Error reading book metadata", ex, ex.stack);
    throw ex;
  });
};
BookEpub.prototype = {
  __proto__: Book.prototype,

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

  /**
   * The title of the book.
   *
   * @type {string}
   */
  get title() {
    var node =
        this._packageDocument.querySelector("package > metadata > title");
    if (node) {
      return node.textContent;
    }
    return undefined;
  },

  /**
   * The author of the book.
   *
   * @type {string}
   */
  get author() {
    var node =
        this._packageDocument.querySelector("package > metadata > creator");
    if (node) {
      return node.textContent;
    }
    return undefined;
  },

  /**
   * Get the list of chapters
   */
  get chapters() {
    return this._chapters;
  },

  getResource: function(key) {
    if (typeof key == "number") {
      return this._chapters[key];
    } else if (typeof key == "string") {
      if (this._resources.has(key)) {
        return this._resources.get(key);
      }
      var entry = this._archive.entries.get(key);
      if (!entry) {
        return null;
      }
      var resource = new Book.Resource(entry.filename, entry);
      this._resources.set(key, resource);
      return resource;
    } else {
      throw new TypeError("Expected a number or a string");
    }
  },

  /**
   * Workaround for older browsers that can't use `pkg.getElementById`
   *
   * @param {XMLDocument} pkg The document in which to get by id.
   * @param {string} id The identifier to search for.
   */
  _getElementById: function(pkg, id) {
    if (!pkg.Lector || !pkg.Lector.identifiersCache) {
      // We do not have a cache of identifiers yet, either because
      // we know that pkg.getElementById works, or because we haven't
      // tested yet.

      // If we are lucky, `pkg.getElementById` works.
      var result = pkg.getElementById(id);
      if (result) {
        return result;
      }

      // Otherwise, we need to build a cache to emulate pkg.getElementById.
      var elements = pkg.querySelectorAll("[id]");
      pkg.Lector = {};
      pkg.Lector.identifiersCache = new Map([
        [e.getAttribute("id"), e] for (e of elements)
      ]);
    }
    return pkg.Lector.identifiersCache.get(id);
  },

  toString: function() {
    return "[BookEpub]";
  }
};

BookEpub.open = function(source) {
  if (source instanceof window.File) {
    if (!source.name.endsWith(".epub")) {
      return null;
    }
  } else if (source instanceof window.URL) {
    if (!source.href.contains(".epub")) {
      return null;
    }
  }
  return new BookEpub(source);
};

// Module definition
return BookEpub;
});
