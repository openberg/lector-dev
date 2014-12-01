define(['js/book',
        'js/notifications',
        'js/urlutils'],
  function(Book,
          Notifications, UrlUtils) {
"use strict";

/**
 * A component designed to display the contents of a book.
 *
 * @param {Element} element The element in which to display the book.
 * It should generally by a `div`.
 */
function BookViewer(element) {
  if (!(element instanceof Element)) {
    throw new TypeError("Expected an instance of Element");
  }

  /**
   * Instances of BookViewer notify of the following events:
   * - pagechange ({page: number, lastPage:number}) The page being displayed.
   *    Numbering is relative to the current layout of the current chapter,
   *    and may change by the simple fact of rotating the device or resizing
   *    the screen.
   * - chapterwillchange ({chapter: number, lastChapter: number}) The chapter
   *    that will be displayed once the load is complete.
   * - chapterhaschanged ({title: string}) The chapter
   *    that has just been displayed.
   */
  this.notifications = new Notifications([
    "page:changing",
    "chapter:exit",
    "chapter:titleavailable",
    "chapter:enter",
    "book:open",
    "book:opening",
    "book:opening:failed",
  ]);

  /**
   * The element in which to display the book.
   *
   * @type {Element}
   */
  this._iframe = document.createElement("iframe");
  this._iframe.classList.add("bookviewer");
  this._iframe.setAttribute("scrolling", "no");
  element.appendChild(this._iframe);

  /**
   * All data about the book currently displayed.
   *
   * @type {BookView}
   */
  this._view = null;

  // Handle messages sent from the book itself.
  window.addEventListener("message", e => this._handleMessage(e));

  window.addEventListener("keypress", e => this._handleKeyPress(e));
}

BookViewer.prototype = {};

/**
 * Open a book.
 *
 * @param {Book} book The book.
 * @param {string|number=} chapter The chapter at which to start reading. If
 * unspecified, start reading at the first chapter.
 * @param {boolean=} endOfChapter If `true`, start reading from the end of the
 * chapter, i.e. as if we had just navigated from the next chapter.
 */
BookViewer.prototype.view = function(book, chapter = 0, endOfChapter = false) {
  console.log("BookViewer", "view", book);
  if (this._view) {
    this._view.dispose();
  }
  this._view = new BookView(book);
  var promise = this._view.book.init();
  promise = promise.then(() => {
    console.log("BookViewer", "view", "book initialized");
    this.notifications.notify("book:open", { book: this._view.book });
  });
  promise = promise.then(() => {
    console.log("BookViewer", "view", "Need to go to chapter", chapter, endOfChapter);
    this.navigateTo(chapter, endOfChapter)
  });
  promise = promise.then(null, e => {
    this.notifications.notify("book:opening:failed", { error: e });
    return e;
  });
  return promise;
};

/**
 * Move fowards/backwards by a number of pages.
 *
 * @param {number} delta A number of pages by which to move. May be
 * negative.  If this number is larger than the number of pages in the
 * chapter, move to the next chapter. If this number is negative, move
 * to a previous chapter.
 */
BookViewer.prototype.changePageBy = function(delta) {
  this._iframe.contentWindow.postMessage({method: "scrollBy", args:[delta]}, "*");
},

/**
 * Navigate to a chapter.
 *
 * @param {string|number} chapter If a number, navigate to the
 * chapter with this number in the table of contents of the book.
 * If a string, navigate to the chapter contained at that path
 * in the book.
 * @return {Promise} A Promise fulfilled once navigation is complete.
 */
BookViewer.prototype.navigateTo = function(chapter, endOfChapter = false) {
  console.log("BookViewer", "navigateTo", chapter, endOfChapter);
  if (typeof chapter != "number" && typeof chapter != "string") {
    throw new TypeError("Expected a number");
  }

  // Before proceeding, make sure that the book is fully initialized.
  var promise = this._view.book.init(endOfChapter);
  var anchor = null;

  promise = promise.then(() => {
    console.log("BookViewer", "navigateTo", "Book is initialized");
    var entry = null;
    var num = -1;
    if (typeof chapter == "number") {
      console.log("BookViewer", "navigateTo", "chapter is a number");
      num = chapter;
    } else {
      console.log("BookViewer", "navigateTo", "chapter is a url, looking for number");
      [chapter, anchor] = chapter.split("#");
      num = this._view.book.chapters.findIndex(x => {
        return x._name == chapter;
      });
    }
    entry = this._view.book.chapters[num];
    if (entry == null) {
      throw new Error("Could not find chapter");
    }
    this._view.chapterInfo = {
      title: null,
      num: num,
    };
    this.notifications.notify("chapter:exit", { chapter: this._view.chapterInfo });
    console.log("BookViewer", "navigateTo", "Opening document");
    this._view.currentChapterContents = this._getChapterContentsForEntry(entry);
    return this._view.currentChapterContents.load();
  });
  promise = promise.then(() => {
    console.log("BookViewer", "navigateTo", "Chapter initialized");
    return this._view.currentChapterContents.asURL();
  });
  promise = promise.then(url => {
    console.log("BookViewer", "navigateTo", "Got URL for chapter", url);
    this._view.chapterContentsByObjectURL.set(url, this._view.currentChapterContents);
    if (endOfChapter) {
      url += "#lector_end";
    } else if (anchor) {
      url += "#" + anchor;
    }
    this._iframe.setAttribute("src", url);
  });
  return promise.then(null, function(err) {
    console.error("BookViewer", "navigateTo", err);
    throw err;
  });
};

/**
 * Get the chapter contents for an entry.
 *
 * If a ChapterContents object has already been created for this entry, reuse it.
 * Otherwise, construct a new one.
 *
 * @param {Book.Resource} entry The entry for which we try to locate a ChapterContents.
 * @return {ChapterContents}
 */
BookViewer.prototype._getChapterContentsForEntry = function(entry) {
  if (!(entry instanceof Book.Resource)) {
    throw new TypeError("Expected an instance of Book.Resource");
  }
  var contents = this._view.chapterContentsByEntry.get(entry);
  if (contents) {
    console.log("BookViewer", "_getChapterContentsForEntry", "Reusing existing ChapterContents");
  } else {
    console.log("BookViewer", "_getChapterContentsForEntry", "Constructing new ChapterContents");
    contents = new ChapterContents(entry, this._view.book);
    this._view.chapterContentsByEntry.set(entry, contents);
  }
  return contents;
}

/**
 * Move forwards/backwards by a number of chapters.
 *
 * @param {number} delta The number of chapters by which to move.
 *
 * @return {Promise} A promise resolved once loading of the chapter
 * by the iframe has *started*.
 */
BookViewer.prototype.changeChapterBy = function(delta) {
  console.log("BookViewer", "changeChapterBy", delta);
  var promise = new Promise(resolve => resolve(this._view.book.chapters));
  var currentChapterEntry = this._view.currentChapterContents.entry;
  promise = promise.then(chapters =>
    chapters.indexOf(currentChapterEntry)
  );
  promise = promise.then(index => {
    if (index == -1) {
      throw new Error("Could not find current chapter");
    }
    return this.navigateTo(index + delta, delta == -1);
  });
  promise = promise.then(null, error => {
    console.log("BookViewer", "changeChapterBy",
      "could not change chapter, reinitializing content", error);
    this.changePageBy(0);
    throw error;
  });
  return promise;
};

/**
 * Revoke any object URL that may have been left in memory by the previous load.
 */
BookViewer.prototype._cleanup = function(chapterURL) {
  chapterURL = UrlUtils.cleanupBlobURL(chapterURL);
  console.log("BookViewer", "_cleanup", chapterURL);
  var chapterContents = this._view.chapterContentsByObjectURL.get(chapterURL);
  chapterContents.unload();
  this._view.chapterContentsByObjectURL.delete(chapterURL);
};

/**
 * Handle a message from the iframe.
 */
BookViewer.prototype._handleMessage = function(e) {
  console.log("BookViewer", "receiving message", e);
  // FIXME: Filter on the source of e.
  var data = e.data;
  switch(data.method) {
  case "goto":
    this.navigateTo(data.args[0]);
    break;
  case "unload":
    console.log("Unloading document, need to revoke urls");
    this._cleanup(data.args[0]);
    break;
  case "keyboardNavigation":
    this._keyboardNavigation(data.args[0]);
    break;
  case "changeChapterBy":
    this.changeChapterBy(data.args[0]);
    break;
  case "pagechange":
    this.notifications.notify("page:changing", data.args[0]);
    break;
  case "load":
    this.notifications.notify("chapter:enter", { chapter: this._view.chapterInfo });
    break;
  default:
    console.error("Unknwon message", data.method);
    return;
  }
};

/**
 * Handle a keyboard event.
 */
BookViewer.prototype._handleKeyPress = function(e) {
  switch (e.code) {
    case "ArrowLeft":
    case "ArrowUp":
    case "Left":
    case "Space":
    case "ArrowDown":
    case "ArrowRight":
    case "Right":
    case "Backspace":
      e.preventDefault();
      e.stopPropagation();
      this._keyboardNavigation(e.code);
    default:
      break;
  }
};

Object.defineProperty(BookViewer.prototype, "book", {
  get: function() {
    return this._view.book;
  }
});

Object.defineProperty(BookViewer.prototype, "chapter", {
  get: function() {
    return this._view.chapterInfo;
  }
});

/**
 * Handle keyboard navigation.
 *
 * Note that keyboard navigation may be triggered either from the
 * book viewer or from the iframe.
 */
BookViewer.prototype._keyboardNavigation = function(code) {
  console.log("Keyboard navigation", code);
  switch (code) {
    case "Left":
    case "ArrowLeft":
    case "ArrowUp":
    case "Space":
      this.changePageBy(-1);
      break;
    case "Right":
    case "ArrowRight":
    case "ArrowDown":
    case "Backspace":
      this.changePageBy(1);
      break;
    default:
      break;
  }
};

/**
 * A chapter, including both the html document
 * and the companion resources.
 *
 * Once you are done using a ChapterContents, do not forget to
 * call method `dispose`.
 *
 * @param {Book.Resource} entry The entry holding the raw
 * data for the chapter.
 * @param {Book} book The book containing the chapter.
 */
function ChapterContents(entry, book) {
  /**
   * The entry holding the raw data for the chapter.
   *
   * @type {Book.Entry}
   */
  this._entry = entry;

  /**
   * The book containing the chapter.
   *
   * @type {Book}
   */
  this._book = book;

  /**
   * The title of the chapter.
   *
   * @type {string}
   */
  this._title = null;

  /**
   * The resources used by this chapter.
   *
   * @type {Array<Book.Resource|object URL>}
   */
  this._resources = [entry];

  /**
   * `true` if the chapter is currently available in memory.
   */
  this._loaded = false;

  /**
   * A promise resolved once loading is complete.
   *
   * @type {Promise}
   */
  this._promiseLoaded = null;

  /**
   * A queue of ongoing operations.
   * Use `this._enqueue` to enqueue load/unload operations.
   *
   * @type {Promise}
   */
  this._queue = Promise.resolve();
}
ChapterContents.prototype = {
  /**
   * The entry holding the raw data for the chapter.
   *
   * @type {Book.Entry}
   */
  get entry() {
    return this._entry;
  },

  /**
   * Load the chapter.
   *
   * Parse the html document, inject the style as well as
   * the code necessary for reading through, rewrite any
   * image, link, etc.
   *
   * @return {Promise}
   */
  load: function() {
    if (this._promiseLoaded) {
      return this._promiseLoaded;
    }
    return this._enqueue(() => {
      return this._promiseLoaded = this._load();
    });
  },
  // Implementation of `load`
  _load: function() {
    var promise = this._entry.asDocument(this, false);
    promise = promise.then(xml => {
      console.log("ChapterContents", "Opened document", xml);

      //
      // Adapt XML document for proper display.
      //
      var head = xml.querySelector("html > head");

      this._title = head.querySelector("title").textContent;

      // 1. Inject global book stylesheet
      // 1.1 The part that is shared by all browsers
      var injectLink = xml.createElement("link");
      injectLink.setAttribute("id", "lector:injectLink");
      injectLink.setAttribute("rel", "stylesheet");
      injectLink.setAttribute("type", "text/css");
      injectLink.setAttribute("href", UrlUtils.toURL("content/books.css").href);
      head.appendChild(injectLink);

      // 2. Inject global book scripts
      // 2.1 The part that ensures that we can navigate
      var injectScript = xml.createElement("script");
      injectScript.setAttribute("id", "lector:injectScript");
      injectScript.setAttribute("type", "text/javascript");
      injectScript.setAttribute("src", UrlUtils.toURL("content/script.js").href);
      injectScript.textContent = "// Nothing to see"; // Workaround serializer bug
      head.appendChild(injectScript);

      // 3. Rewrite internal links
      // (scripts, stylesheets, etc.)
      var generateLink = (node, attribute, ns = null) => {
        var href = ns ? node.getAttributeNS(ns, attribute) : node.getAttribute(attribute);
        console.log("ChapterContents", "Generating link for", node, attribute, href, ns);
        if (!href) {
          console.log("ChapterContents", "No link for", href);
          // No link at all, e.g. anchors, inline scripts.
          return;
        }
        try {
          new URL(href);
          console.log("ChapterContents", "Link for", href, "is absolute, nothing to do");
          // If we reach this point, the link is absolute, we have
          // nothing to do.
          return;
        } catch (ex) {
          // Link is relative, we need to rewrite it and generate
          // a URL for its contents.
        }
        var resource = this._book.getResource(href);
        if (!resource) {
          console.log("ChapterContents", "Could not find resource for", href);
          return;
        } else {
          console.log("ChapterContents", "Found a resource for", href);
        }
        var promise = resource.asObjectURL(this);
        promise = promise.then(url => {
          console.log("ChapterContents", "Got a url for", href, url);
          if (ns) {
            node.setAttributeNS(ns, attribute, url);
          } else {
            node.setAttribute(attribute, url);
          }
          return resource;
        });
        this._resources.push(promise);
      };
      [...xml.querySelectorAll("html > head > link")].forEach(link => {
        if (link.getAttribute("rel") != "stylesheet") {
          return;
        }
        generateLink(link, "href");
      });
      [...xml.querySelectorAll("html > body img")].forEach(img => {
        generateLink(img, "src");
        // Nicety hack: images with width="100%" or height="100%" are bound
        // to break. Let's get rid of these attributes.
        if (img.getAttribute("width") == "100%") {
          img.removeAttribute("width");
        }
        if (img.getAttribute("height") == "100%") {
          img.removeAttribute("height");
        }
      });
      [...xml.querySelectorAll("html > body svg image")].forEach(img => {
        generateLink(img, "href", "http://www.w3.org/1999/xlink");
      });
      [...xml.querySelectorAll("html > body iframe")].forEach(iframe => {
        generateLink(iframe, "src");
      });
      [...xml.querySelectorAll("html > head script")].forEach(script => {
        generateLink(script, "src");
      });
      [...xml.querySelectorAll("html > body a")].forEach(a => {
        console.log("ChapterContents", "Rewriting link", a);
        var href = a.getAttribute("href");
        if (!href || href.startsWith("#") || href.startsWith("javascript") || href.contains("://")) {
          // Not a link internal to the book.
          console.log("ChapterContents", "External link, nothing to rewrite", a);
          return;
        }
        // At this stage, we assume that this is a link internal to the book.
        // We need to turn it into a script.
        a.setAttribute("href", "javascript:window.Lector.goto('" + href + "');");
      });

      // Move the contents of the document inside a <div id="lector_root">
      // to let us add margins without breaking existing layout.
      console.log("ChapterContents", "Creating new root");
      var root = xml.createElement("div");
      root.setAttribute("id", "lector_root");
      for (var child of [...xml.body.childNodes]) {
        xml.body.removeChild(child);
        root.appendChild(child);
      }
      xml.body.appendChild(root);

      // Add a specific node at the end of the document to be able to
      // scroll quickly to the end.
      var end = xml.createElement("div");
      end.setAttribute("id", "lector_end");
      xml.body.appendChild(end);

      console.log("ChapterContents", "Waiting until all rewrites are complete");
      return Promise.all(this._resources).then(() => {
        console.log("ChapterContents", "All resources are now available");
        return Promise.resolve(xml);
      });
    });

    // Serialize the document back to an object URL.
    // We introduce artificial calls to `Promise.resolve` to ensure that
    // we do not paralyze the main thread for too long.
    promise = promise.then(xml => {
      console.log("ChapterContents", "load", "Serializing to string");
      return Promise.resolve(new XMLSerializer().serializeToString(xml));
    });
    promise = promise.then(source => {
      console.log("ChapterContents", "load", "Encoding string");
      return Promise.resolve(new TextEncoder().encode(source));
    });
    promise = promise.then(encoded => {
      console.log("ChapterContents", "load", "Converting to object URL");
      var blob = new Blob([encoded], { type: "text/html" });
      this._url = URL.createObjectURL(blob);
      this._loaded = true;
    });
    return promise;
  },

  /**
   * Return the object URL for this chapter.
   */
  asURL: function() {
    console.log("ChapterContents", "asURL");
    if (!this._loaded) {
      throw new Error("Not loaded");
    }
    return this._url;
  },

  /**
   * Cleanup all resources.
   *
   * Before the chapter may be reused, `load()` must be called.
   * @return {Promise}
   */
  unload: function() {
    console.log("ChapterContents", "unload", this);
    this._enqueue(() => {
      this._loaded = false;
      return this._unload();
    });
  },
  // Implementation of `unload`
  _unload: function() {
    this._promiseLoaded = null;
    var promise = Promise.all(this._resources);
    promise = promise.then(resources => {
      for (var object of resources) {
        console.log("ChapterContents", "Revoking", object);
        object.release(this);
      }
      this._resources.length = 0;
    });
    promise = promise.then(() => {
      URL.revokeObjectURL(this._url);
      this._url = null;
    });
    return promise;
  },

  _enqueue: function(cb) {
    var resolve;
    var promise = this._queue;
    this._queue = new Promise(_resolve => {
      resolve = _resolve;
    });
    promise = promise.then(cb);
    promise = promise.then(() => {
      resolve();
    }, error => {
      console.error("ChapterContents", "_enqueue", error);
      resolve();
      throw error;
    });
    return promise;
  }
};

/**
 * Data about a book currently being displayed.
 *
 * @param {Book} book The book.
 */
function BookView(book) {
  /**
   * The book currently displayed.
   *
   * @type {Book}
   */
  this.book = book;

  /**
   * Public information on the chapter currently displayed.
   */
  this.chapterInfo = null;

  /**
   * A cache for ChapterContents.
   *
   * Keys: Book.Resource
   * Values: ChapterContents
   */
  this.chapterContentsByEntry = new Map();

  /**
   * The chapters that are currently loaded in memory.
   *
   * Keys: Object URL
   * Value: ChapterContents
   */
  this.chapterContentsByObjectURL = new Map();

  /**
   * The chapter currently loaded.
   *
   * @type {ChapterContents}
   */
  this.currentChapterContents = null;
}
BookView.prototype = {
  /**
   * Unload the book from memory.
   */
  dispose: function() {
    for (var chapter of this.chapterContentsByObjectURL.values()) {
      chapter.unload();
    }
  }
};
return BookViewer;

});
