window.require(['js/observable',
                'js/book',
                'js/urlutils',
                'js/sizewatcher'],
  function(Observable, Book, UrlUtils, SizeWatcher) {
"use strict";

// FIXME: Populate list of previously read books/bookmarks

var $ = id => document.getElementById(id);
var windowWatcher = new SizeWatcher(window);

var Contents = {
  elt: $("contents"),
  updateDimensions: function() {
    Contents.elt.style.innerWidth = windowWatcher.innerWidth + "px";
    Contents.elt.style.innerHeight = windowWatcher.innerHeight + "px";
  },
  init: function() {
    windowWatcher.addObserver("resize", () => Contents.updateDimensions());
    Contents.updateDimensions();
  },
};
Contents.init();

var params = new URL(window.location).searchParams;
console.log(params);
try {
  var bookURL = null;
  if (params.has("book")) {
    bookURL = UrlUtils.toURL(params.get("book"));
  }

  if (bookURL) {
    var book = new Book(bookURL);
    var chapterNum = 0;
    if (params.has("chapter")) {
      chapterNum = Number.parseInt(params.get("chapter"));
    }
    book.init().then(() => {
      console.log("Book is initialized", book.title, book.author);
      console.log("Chapters", book.chapters);
      var promise = book.chapters[chapterNum].asXML();
      promise = promise.then(xml => {
        //
        // Adapt XML document for proper display.
        //
        var head = xml.querySelector("html > head");

        // 1. Inject global book stylesheet
        var link = xml.createElement("link");
        link.setAttribute("rel", "stylesheet");
        link.setAttribute("type", "text/css");
        link.setAttribute("href", UrlUtils.toURL("css/books.css"));
        head.appendChild(link);

        // 2. Inject style data customized for the screen size
        var paddingY = 20;
        var updateSize = function() {
          var body = xml.querySelector("html > body");
          console.log("Size updated", windowWatcher);
          body.style.MozColumnWidth = windowWatcher.innerWidth + "px";
          body.style.MozColumnGap = "40px";
          body.style.height = (windowWatcher.innerHeight - 2 * paddingY) + "px";
          console.log("Body", body.style.height);
        };
        updateSize();
        windowWatcher.addObserver("resize", updateSize);
        // FIXME: Add WebKit (and other) equivalents

        // FIXME: Do we need to inject <script>?
        // FIXME: We probably want to rewrite all links
        // (for images, stylesheets, etc.)
        return xml;
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
        $("contents").setAttribute("src", url);
        URL.revokeObjectURL(url);
      });
      promise = promise.then(null, e => console.error(e));
    });
  }
} catch (ex) {
  console.error(ex);
}


/**
 * The file picker.
 */

/*
var filePicker = new Observable(["open"]);
filePicker.eltControl = document.getElementById("pick_file_control");
filePicker.eltTab = document.getElementById("pick_file");
filePicker.init = function() {
  this.eltTab.addEventListener("click", e => {
    this.eltControl.click();
  });
  this.eltControl.addEventListener("click", e => {
    e.stopPropagation();
  });
  this.eltControl.addEventListener("change", e => {
    var files = this.eltControl.files;
    if (!files || files.length == 0) {
      // No files opened, nothing to do.
      return;
    }
    this.notify("open", {files: files});
  });
};
filePicker.init();
filePicker.addObserver("open", e => {
  var files = e.files;

  var book = new Book(files[0]);
  window.DEBUG_book = book;

  book.init().then(() => {
    console.log("Book is initialized", book.title, book.author);
    console.log("Chapters", book.chapters);
  });
});
*/

});
