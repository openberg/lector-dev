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
  console.log("BookEpub", "constructing");
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
  var promise = Promise.resolve();
  promise = promise.then(() => this._archive.init());

  promise = promise.then(() => {
    console.log("BookEpub", "constructing", "archive initialized");

    // File `container.xml` tells us where we can find the package document.
    // (generally OEBPS/content.opf).
    var containerEntry = new Book.Resource("container.xml", this._archive.entries.get("META-INF/container.xml"));
    console.log("Container entry", containerEntry);
    return containerEntry.asXML(this, true);
  });

  promise = promise.then(container => {
    console.log("BookEpub", "constructing", "reading container.xml");

    // Extract the information and parse the package document.
    var eltRoot = container.querySelector("container > rootfiles > rootfile");
    var path = eltRoot.getAttribute("full-path");
    this._resolveTo = path.substring(0, path.lastIndexOf("/"));;
    return new Book.Resource(path, this._archive.entries.get(path)).asXML(this, true);
  });

  promise = promise.then((pkg) => {
    console.log("BookEpub", "constructing", "reading package file");

    this._package = pkg;

    // Extract the list of chapters
    console.log("BookEpub", "I have the following files", [...this._archive.entries.keys()]);
    for (var itemref of pkg.querySelectorAll("package > spine > itemref")) {
      var item = this._getElementById(pkg, itemref.getAttribute("idref"));
      console.log("Item", pkg, itemref, itemref.getAttribute("idref"), item);
      if (!item) {
        console.log(new XMLSerializer().serializeToString(pkg));
      }
      var href = item.getAttribute("href");
      var url = this._getHref(href);
      console.log("Looking for url", url, href);
      this._chapters.push(this.getResource(url));
    }
  });

  promise = promise.then(() => {
    console.log("BookEPub", "Attempting to locate a table of contents");

    var promise = this._initializeXHTMLToc();
    promise = unchain(promise, () => this._initializeNCXToc());
    return promise;
  });

  promise = promise.then(toc => {
    this._toc = toc;
    console.log("BookEPub", "toc", toc);
    resolveInitialized();
  });

  promise = promise.then(null, ex => {
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

  /**
   * Initialize the table of contents in an epub 2 book.
   *
   * In epub 3, the table of contents is provided as a
   * xhtml document, which may be found by a property `nav`.
   */
  _initializeXHTMLToc: function() {
    console.log("BookEPub", "_initializeXHTMLToc", "starting");
    var promise = Promise.resolve();
    promise = promise.then(() => {
      var pkg = this._package;
      var navItem = pkg.querySelector("[properties='nav']");
      if (!navItem) {
        console.log("BookEPub", "_initializeXHTMLToc", "no `nav` item");
        return;
      }
      return this.getResource(navItem.getAttribute("href"));
    });
    promise = chain(promise, tocRes => {
      return tocRes.asXML(this, true);
    });
    promise = chain(promise, xml => {
      var items = xml.querySelectorAll("html > body > nav > ol > li > a");
      console.log("BookEpub", "_initializeXHTMLToc", items);
      var toc = [];
      for (var item of items) {
        var title = item.getAttribute("title");
        var href = this._getHref(item.getAttribute("href"));
        console.log("BookEPub", "_initializeXHTMLToc", title, href);
        toc.push({
          title: title,
          chapter: href
        });
      }
      return toc;
    });
    return promise;
  },

  /**
   * Initialize the table of contents in an epub 2 book.
   *
   * In epub 2, the table of contents is provided as a
   * `.ncx` document, which may be found from the `spine`.
   */
  _initializeNCXToc: function() {
    console.log("BookEPub", "_initializeNCXToc", "starting");
    var promise = Promise.resolve();
    promise = promise.then(() => {
      var pkg = this._package;
      var spine = pkg.querySelector("package > spine");
      var tocId = spine.getAttribute("toc");
      if (!tocId) {
        console.log("BookEPub", "_initializeNCXToc", "no spine.toc");
        return;
      }
      var tocElem = pkg.getElementById(tocId);
      if (!tocElem) {
        console.log("BookEpub", "_initializeNCXToc", "no toc element");
        return;
      }
      var tocHref = tocElem.getAttribute("href");
      return this.getResource(tocHref);
    });
    promise = chain(promise, tocRes => {
      return tocRes.asXML(this, true);
    });
    promise = chain(promise, xml => {
      var points = xml.querySelectorAll("ncx > navMap > navPoint");
      var toc = [];
      for (var point of points) {
        var index = Number(point.getAttribute("playOrder"));
        toc.push({
          title: point.querySelector("navLabel > text").textContent,
          chapter: index,
        });
      }
      toc.sort((a, b) => {a.chapter <= b.chapter});
      return toc;
    });
    return promise;
  },

  /**
   * Normalize a url in the package document.
   */
  _getHref: function(href) {
    try {
      // The url may be absolute
      return (new URL(href)).href;
    } catch (ex if ex instanceof TypeError) {
      // ... or relative.
      while (href.startsWith("../")) {
        href = href.substring(3);
      }
      return this._resolveTo ? this._resolveTo + "/" + href : href;
    }
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
      this._packageDocument.querySelector("package > metadata title")
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
        this._packageDocument.querySelector("package > metadata creator");
    if (node) {
      return node.textContent;
    }
    return undefined;
  },

  /**
   * Get the list of chapters
   */
  get chapters() {
    this._ensureInitialized();
    return this._chapters;
  },

  /**
   * Get the table of contents.
   *
   * @return {Array<{resource: Book.Resource, title: string}>|null}
   */
  get toc() {
    this._ensureInitialized();
    return this._toc;
  },

  getResource: function(key) {
    console.log("getResource", key, typeof key);
    if (typeof key == "number") {
      return this._chapters[key];
    } else if (typeof key == "string") {
      if (this._resources.has(key)) {
        return this._resources.get(key);
      }
      var entry =
        this._archive.entries.get(key)
        || this._archive.entries.get(this._resolveTo + "/" + key);
      if (!entry) {
        return null;
      }
      var resource = new Book.Resource(key, entry);
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

/**
 * Behave as `p.then(onResult)`, unless `p`
 * resolves to `undefined`, in which case
 * resolve to `undefined`.
 *
 * @param {Promise} p
 * @param {function} onResult
 */
function chain(p, onResult) {
  return p.then(x => {
    if (x == undefined) {
      return undefined;
    }
    return onResult(x);
  });
}

/**
 * Resolve as `p`, unless `p` resolves to `undefined`,
 * in which case, resolve as `f`.
 *
 * @param {Promise} p
 * @param {function} f
 */
function unchain(p, f) {
  return p.then(x => {
    if (x != undefined) {
      return x;
    }
    return f();
  })
}

// Module definition
return BookEpub;
});
