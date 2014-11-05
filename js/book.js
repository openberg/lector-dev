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
   * @type {Array<Book.Entry>} Entries for this book.
   */
  get chapters() {
    throw new Error("Not implemented: get chapters()")
  },

  /**
   * Get a resource by name.
   *
   * @type {Book.Entry}
   */
  getResource: function(name) {
    throw new Error("Not implemented: getResource()");
  },
};

/**
 * @constructor
 */
Book.Entry = function() {
};
Book.Entry.prototype = {
  asObjectURL: function() {
    throw new Error("Not implemented: asObjectURL");
  },
  asCachedEntry: function() {
    throw new Error("Not implemented: asCachedEntry");
  },
  asXML: function() {
    throw new Error("Not implemented: asXML");
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
