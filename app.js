window.require(['js/observable',
                'js/book',
                'js/urlutils'],
  function(Observable, Book, UrlUtils) {
"use strict";

// FIXME: Populate list of previously read books/bookmarks

// FIXME: window.location + .. is not always good

var $ = id => document.getElementById(id);

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

        // 1. Inject book stylesheet
        var link = xml.createElement("link");
        link.setAttribute("rel", "stylesheet");
        link.setAttribute("type", "text/css");
        link.setAttribute("href", UrlUtils.toURL("css/books.css"));
        head.appendChild(link);

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

});
