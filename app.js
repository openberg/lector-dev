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
/*
    Contents.elt.style.innerWidth = windowWatcher.innerWidth + "px";
    Contents.elt.style.innerHeight = windowWatcher.innerHeight + "px";
*/
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
        console.log("Chapter init", 1);
        // 1. Inject global book stylesheet
        var link = xml.createElement("link");
        link.setAttribute("rel", "stylesheet");
        link.setAttribute("type", "text/css");
        link.setAttribute("href", UrlUtils.toURL("content/books.css"));
        head.appendChild(link);

        // 2. Inject global book script
        var script = xml.createElement("script");
        script.setAttribute("type", "text/javascript");
        script.setAttribute("src", UrlUtils.toURL("content/script.js"));
        script.textContent = "// Nothing to see";
        head.appendChild(script);

        // 3. Rewrite internal links
        // (scripts, stylesheets, etc.)
        // FIXME: TODO

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
