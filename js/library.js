window.define(['js/book',
               'js/notifications',
               'js/urlutils'
               ],
function(Book, Notifications, UrlUtils) {

"use strict";

/**
 * A manager for a collection of books.
 *
 * @param {Array} openers A list of filters for opening books.
 */
function Library(openers) {
  if (!Array.isArray(openers)) {
    throw new TypeError("Expected an array of book openers");
  }
  /**
   * Instances of Library notify of the following events:
   * - library:open:success ({entry: Entry}) A file has been picked.
   * - file:nopicker (null) Could not pick a file, generally
   *    because no file picker has been installed.
   */
  this.notifications = new Notifications([
    "library:open:success",
    "library:open:failure",
  ]);

  this._openers = openers;

  //
  // For the moment, we ship with a few books and we
  // cannot add anything to the list.
  //
  this._entries = [
    new Entry(this, "Alice in Wonderland", "Lewis Caroll", UrlUtils.toURL("samples/alice.epub")),
    new Entry(this, "1984", "George Orwell", UrlUtils.toURL("samples/1984.epub")),
  ];
}
Library.prototype = {
  /**
   * Entries for all books currently in the library.
   */
  get entries() {
    return this._entries;
  },

  /**
   * Open a book from a source.
   *
   * @return {Book} A book, already initialized.
   */
  open: function(source) {
    var entry = new Entry(this, null, null, source);
    return entry.open();
  },
};

/**
 * An entry in the library.
 *
 * This entry can provide the title and author of a book,
 * without having to open the book first. Future versions
 * will also provide access to the database.
 *
 * @param {Library} library The owning library.
 * @param {string|null} title The title of the book, or `null`
 * if we do not know the title yet.
 * @param {string|null} author The author of the book, or `null`
 * if we do not know the author yet.
 * @param {URL|File} source Information on where to load the book.
 * This argument a URL for books that are provided with the software,
 * File for books picked using the file picker.
 */
function Entry(library, title, author, source) {
  console.log("Library.Entry", "constructor", source);
  this._title = title;
  this._author = author;
  this._source = source;
  this._library = library;
};
Entry.prototype = {
  /**
   * Open the book.
   *
   * @return {Promise<Book>}
   */
  open: function() {
    console.log("Library.Entry", "open", this._title, this._author, this._source);
    var promise = Promise.resolve();
    promise = promise.then(() => {
      console.log("Library.Entry", "open", "in progress");
      return Book.open(this._source, this._library._openers);
    })
    promise = promise.then(book => {
      console.log("Library.Entry", "open", "book opened");
      return book.init().then(() => book);
    });
    promise = promise.then(book => {
      console.log("Library.Entry", "open", "book initialized");
      this._title = book.title;
      this._author = book.author;
      this._library.notifications.notify("library:open:success", {
        entry: this,
      });
      return book;
    });
    promise = promise.then(null, error => {
      console.error("Library.Entry", "open", error);
      this._library.notifications.notify("library:open:failure", {
        entry: this,
        error: error,
      });
      throw error;
    });
    return promise;
  },
  /**
   * The title of the book.
   *
   * @type{string|null}
   */
  get title() {
    return this._title;
  },
  /**
   * The author of the book.
   *
   * @type{string|null}
   */
  get author() {
    return this._author;
  }
};

return Library;

});
