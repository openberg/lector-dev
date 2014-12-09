window.define(function(BookEpub) {
"use strict";

var console = window.console;

/**
 * Base constructor for books.
 *
 * Methods should be implemented by descendant constructors.
 *
 * @constructor
 */
function Book() {
  // Do nothing.
}
Book.prototype = {
  /**
   * Initialize the book.
   *
   * @return {Promise} A promise resolved once initialization
   * is complete.
   */
  init: function() {
    throw new Error("Not implemented: init(). This method should be implemented by subclasses.");
  },

  /**
   * Get the title of the book.
   *
   * @type {string} The title of the book, or `null` if the title of the
   * book cannot be determined.
   */
  get title() {
    throw new Error("Not implemented: get title()");
  },

  /**
   * Get the author of the book.
   *
   * @type {string} The author of the book, or `null` if the author of the
   * book cannot be determined.
   */
  get author() {
    throw new Error("Not implemented: get author()");
  },

  /**
   * Get all the chapters of this book.
   *
   * @type {Array<Book.Resource>} Entries for this book.
   */
  get chapters() {
    throw new Error("Not implemented: get chapters()")
  },

  /**
   * Get a resource by name or number.
   *
   * @type {Book.Resource}
   */
  getResource: function(name) {
    throw new Error("Not implemented: getResource()");
  },

  /**
   * Get the table of contents of the book, if available.
   *
   * @type {Array<{title: string, chapter: {number|string}}> | null}
   */
  get toc() {
    throw new Error("Not implemented: get toc()")
  }
};

/**
 * A resource of the book, such as a page, image, sound,
 * script, etc.
 *
 * @param {string} name A unique name, used for comparing.
 * @param {{asObjectURL: function()}} An object that may provide the data
 * as an object URL.
 * @constructor
 */
Book.Resource = function(name, provider) {
  this._name = name;
  this._clients = new Map();
  this._provider = provider;
  this._cachedPromiseObjectURL = null;
};
Book.Resource.DELAY_BEFORE_UNLOAD_MS = 1000;
Book.Resource.prototype = {
  _acquire: function(key) {
    if (key == null) {
      throw new TypeError("_acquire expected a key, got " + key);
    }
    var clients = this._clients.get(key);
    if (!clients) {
      this._clients.set(key, 1);
    } else {
      this._clients.set(key, clients + 1);
    }
  },
  release: function(key) {
    if (key == null) {
      throw new TypeError("release expected a key");
    }
    var clients = this._clients.get(key);
    if (clients == null) {
      throw new Error("Invalid key: " + key + ", expected one of " + [...this._clients.keys()].join());
    }
    this._clients.set(key, clients - 1);
    if (clients != 1) {
      console.log("I am not the last client for this entry with", key, this._name);
      return;
    }
    this._clients.delete(key);
    if (this._clients.size != 0) {
      console.log("I am not the last client for this entry", this._name);
      return;
    }
    // Oh, this was the last client.
    // We may want to remove the object from the cache.
    // Let's wait a bit, just in case someone immediately needs to read the same resource.
    window.setTimeout(() => {
      if (this._clients.size != 0) {
        // Someone else has acquired this object url, they are now in charge of deallocating it.
        console.log("Someone has reacquired the url", this._name);
        return;
      }
      console.log("Time to release this url once and for all", this._name);
      this._cachedPromiseObjectURL.then(url => URL.revokeObjectURL(url));
      this._cachedPromiseObjectURL = null;
    }, Book.Resource.DELAY_BEFORE_UNLOAD_MS);
  },

  asObjectURL: function(key) {
    this._acquire(key);
    if (!this._cachedPromiseObjectURL) {
      this._cachedPromiseObjectURL = this._provider.asObjectURL();
    }
    return this._cachedPromiseObjectURL;
  },

  /**
   * Parse the entry as a XML document.
   *
   * @return Promise<XMLDocument>
   */
  asXML: function(key, autorelease = true) {
    return this._asXHR(key, "xml", "text/xml", "responseXML", autorelease);
  },

  /**
   * Parse the entry as a HTML document.
   *
   * @return Promise<Document>
   */
  asDocument:function(key, autorelease = true) {
    var mimeType = "application/xhtml+xml";
    var fileName = key._entry._name;
    if (fileName.match("(.*)\.htm")) {
      mimeType = "text/html";
    }
    return this._asXHR(key, "document", mimeType, "responseXML", autorelease);
  },

  _asXHR: function(key, responseType, mimeType, field, autorelease = true) {
    var promiseURL = this.asObjectURL(key);
    var promise = new Promise(resolve =>
      promiseURL.then(url => {
        var parser = new XMLHttpRequest();
        parser.addEventListener("loadend", (e) => {
          if (autorelease) {
            this.release(key);
          }
          resolve(parser[field]);
        });
        parser.open("GET", url);
        parser.responseType = responseType;
        parser.overrideMimeType(mimeType);
        parser.send();
    }));
    return promise;
  },
};


/**
 * Open a book.
 *
 * @param {Book|URL|File} A source
 * @return {Book} A Book.
 */
Book.open = function(source, openers) {
  if (source instanceof Book) {
    // This is already a Book, let's just return it.
    return source;
  }
  var book;
  for (var opener of openers) {
    book = opener.open(source);
    if (book) {
      return book;
    }
  }
  throw new Error("Could not open book " + source);
};



// Module definition
return Book;
});
