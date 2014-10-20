define(['js/book',
        'js/urlutils'],
  function(Book, UrlUtils) {
"use strict";

function BookViewer(element) {
  if (!(element instanceof Element)) {
    throw new TypeError("Expected an instance of Element");
  }
  this._element = element;
  this._book = null;
}
BookViewer.prototype = {
  open: function(book) {
    console.log("BookViewer", "opening book", book);
    if (!(book instanceof Book)) {
      throw new TypeError("Expected a book");
    }
    this._book = book;
    return book.init();
  },
  navigateTo: function(chapter) {
    console.log("BookViewer", "navigating to", chapter);
    if (typeof chapter != "number") {
      throw new TypeError("Expected a number");
    }
    var promise = this._book.init();
    promise = promise.then(() => this._book.chapters[chapter].asXML());
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

      // 2. Inject global book script
      var injectScript = xml.createElement("script");
      injectScript.setAttribute("type", "text/javascript");
      injectScript.setAttribute("src", UrlUtils.toURL("content/script.js"));
      injectScript.textContent = "// Nothing to see"; // Workaround serializer bug
      head.appendChild(injectScript);

      // 3. Rewrite internal links
      // (scripts, stylesheets, etc.)
      var blockers = [];
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
        var resource = this._book.getResourceFor(href);
        if (!resource) {
          console.log("Could not find resource for", resource);
          return;
        }
        var promise = resource.asObjectURL();
        promise = promise.then(url => {
          node.setAttribute(attribute, url);
        });
        blockers.push(promise);
      };
      for (var link of xml.querySelectorAll("html > head > link")) {
        if (link.getAttribute("rel") != "stylesheet") {
          continue;
        }
        generateLink(link, "href");
      }
      for (var img of xml.querySelectorAll("html > body img")) {
        generateLink(img, "src");
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

      return Promise.all(blockers).then(() => xml);
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
      this._element.setAttribute("src", url);
      URL.revokeObjectURL(url);
    });
  }
};

return BookViewer;

});
