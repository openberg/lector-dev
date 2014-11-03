define(['js/book',
        'js/notifications',
        'js/urlutils'],
  function(Book, Notifications, UrlUtils) {
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
   * - chapterchange ({chapter: number, lastChapter: number}) The chapter
   *    that will be displayed once the load is complete.
   */
  this.notifications = new Notifications(["pagechange", "chapterchange"]);

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
   * The book currently displayed.
   */
  this._book = null;
  this._currentChapter = null;

  this._resourcesByChapter = new Map();

  // Handle messages sent from the book itself.
  window.addEventListener("message", e => this._handleMessage(e));

  window.addEventListener("keypress", e => this._handleKeyPress(e));
}
BookViewer.prototype = {};

/**
 * Open a book.
 */
BookViewer.prototype.open = function(book) {
  console.log("BookViewer", "opening book", book);
  if (book instanceof Book) {
    this._book = book;
  } else if (book instanceof window.URL) {
    this._book = new Book(book);
  } else if (book instanceof window.File) {
    this._book = new Book(book);
  } else {
    throw new TypeError("Expected a Book, URL or File, got " + book);
  }
  return this._book.init();
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
BookViewer.prototype.navigateTo = function(chapter, endOfChapter) {
  if (typeof chapter != "number" && typeof chapter != "string") {
    throw new TypeError("Expected a number");
  }
  var promise = this._book.init();
  var chapterResources = null;
  promise = promise.then(() => {
    var entry;
    var num = -1;
    if (typeof chapter == "number") {
      entry = this._book.chapters[chapter];
      num = chapter;
    } else {
      entry = this._book.getResource(chapter);
      var chapters = this._book.chapters;
      for (var i = 0; num < chapters.length; ++num) {
        var resource = this._book.chapters[i];
        if (entry === resource) {
          num = i;
          break;
        }
      }
    }
    if (!entry) {
      throw new Error("Could not find chapter " + chapter);
    }
    this._currentChapter = entry;
    this.notifications.notify("chapterchange", { chapter: num,
      lastChapter: this._book.chapters.length });
    return entry.asXML();
  });
  promise = promise.then(xml => {
    //
    // Adapt XML document for proper display.
    //
    var head = xml.querySelector("html > head");
    console.log("Chapter init", 1);
    // 1. Inject global book stylesheet
    var injectLink = xml.createElement("link");
    injectLink.setAttribute("rel", "stylesheet");
    injectLink.setAttribute("type", "text/css");
    injectLink.setAttribute("href", UrlUtils.toURL("content/books.css"));
    head.appendChild(injectLink);

    // 2. Inject global book scripts
    var injectScript = xml.createElement("script");
    injectScript.setAttribute("type", "text/javascript");
    injectScript.setAttribute("src", UrlUtils.toURL("content/script.js"));
    injectScript.textContent = "// Nothing to see"; // Workaround serializer bug
    head.appendChild(injectScript);

    var injectScript2;
    if (endOfChapter) {
      // Go to the end of the chapter without triggering an animation
      // that goes through all pages of the chapter.
      var injectStyle = xml.createElement("style");
      injectStyle.textContent = "body { transform: translateX(1000000px); transition-property: '';}";
      head.appendChild(injectStyle);

      injectScript2 = xml.createElement("script");
      injectScript2.setAttribute("type", "text/javascript");
      injectScript2.textContent = "window.addEventListener('load', function() {document.body.transitionProperty = 'transform'; window.Lector.scrollToPage(Infinity)});";
    } else {
      injectScript2 = xml.createElement("script");
      injectScript2.setAttribute("type", "text/javascript");
      injectScript2.textContent = "window.addEventListener('load', function() {window.Lector.scrollToPage(0);});";
    }
    head.appendChild(injectScript2);

    // 3. Rewrite internal links
    // (scripts, stylesheets, etc.)
    var resources = [];
    var generateLink = (node, attribute) => {
      var href = node.getAttribute(attribute);
      console.log("Generating link for", node, attribute, href);
      if (!href) {
        // No link at all, e.g. anchors.
        return;
      }
      try {
        new URL(href);
        // If we reach this point, the link is absolute, we have
        // nothing to do.
        return;
      } catch (ex) {
        // Link is relative, we need to rewrite it and generate
        // a URL for its contents.
      }
      var resource = this._book.getResource(href);
      if (!resource) {
        console.log("Could not find resource for", resource);
        return;
      }
      var entry = resource.asCachedEntry(chapter);
      var promise = entry.asObjectURL();
      promise = promise.then(url => {
        node.setAttribute(attribute, url);
        return entry;
      });
      resources.push(promise);
    };
    for (var link of xml.querySelectorAll("html > head > link")) {
      if (link.getAttribute("rel") != "stylesheet") {
        continue;
      }
      generateLink(link, "href");
    }
    for (var img of xml.querySelectorAll("html > body img")) {
      generateLink(img, "src");
      // Nicety hack: images with width="100%" or height="100%" are bound
      // to break. Let's get rid of thes attributes.
      if (img.getAttribute("width") == "100%") {
        img.removeAttribute("width");
      }
      if (img.getAttribute("height") == "100%") {
        img.removeAttribute("height");
      }
    }
    for (var iframe of xml.querySelectorAll("html > body iframe")) {
      generateLink(iframe, "src");
    }
    for (var script of xml.querySelectorAll("html > head script")) {
      generateLink(link, "src");
    }

    for (var a of xml.querySelectorAll("html > body a")) {
      console.log("Rewriting link", a);
      var href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript") || href.contains("://")) {
        // Not a link internal to the book.
        continue;
      }
      // At this stage, we assume that this is a link internal to the book.
      // We need to turn it into a script.
      a.setAttribute("href", "javascript:window.Lector.goto('" + href + "');");
    }

    return Promise.all(resources).then(resources => {
      console.log("All resources are now available", resources);
      chapterResources = resources;
      return Promise.resolve(xml);
    });
  });
  promise = promise.then(xml => {
    return Promise.resolve(new XMLSerializer().serializeToString(xml));
  });
  promise = promise.then(source => {
    return Promise.resolve(new TextEncoder().encode(source));
  });
  promise = promise.then(encoded => {
    var blob = new Blob([encoded], { type: "text/html" }); 
    var url = URL.createObjectURL(blob);
    console.log("Associating resources", chapterResources, "to url", url);
    this._resourcesByChapter.set(url, { key: chapter, resources: chapterResources});
    this._iframe.setAttribute("src", url);
    URL.revokeObjectURL(url);
  });
};

BookViewer.prototype.changeChapterBy = function(delta) {
  var promise = new Promise(resolve => resolve(this._book.chapters));
  promise = promise.then(chapters => {
    for (var i = 0; i < chapters.length; ++i) {
      console.log("Comparing", chapters[i], this._currentChapter);
      if (chapters[i] == this._currentChapter) {
        return this.navigateTo(i + delta, delta == -1);
      }
    }
    throw new Error("Could not find chapter");
  });
};

/**
 * Revoke any object URL that may have been left in memory by the previous load.
 */
BookViewer.prototype._cleanup = function(chapterURL) {
  console.log("Cleaning up resources for chapter", chapterURL);
  var {key, resources} = this._resourcesByChapter.get(chapterURL);
  for (var object of resources) {
    console.log("Revoking", object);
    object.release(key);
  }
  this._resourcesByChapter.delete(chapterURL);
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
    this.notifications.notify("pagechange", data.args[0]);
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

return BookViewer;

});
