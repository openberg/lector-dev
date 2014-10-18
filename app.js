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
        var head = xml.querySelector("html > head");
        var link = xml.createElement("link");
        link.setAttribute("rel", "stylesheet");
        link.setAttribute("type", "text/css");
        link.setAttribute("href", UrlUtils.toURL("css/books.css"));
        head.appendChild(link);

/*
        var style = xml.createElement("style");
        style.textContent = "body { background-color:red; }";
        head.appendChild(style);
*/
        // FIXME: Inject proper <style>
        // (link rel = stylesheet?)

        // FIXME: Inject <script>

        // FIXME: Split this across several ticks.
        var source = new XMLSerializer().serializeToString(xml);
        var encoded = new TextEncoder().encode(source);
        var blob = new Blob([encoded], { type: "text/html" }); 
        var url = URL.createObjectURL(blob);
        $("contents").setAttribute("src", url);
        // FIXME: revokeObjectURL (can we do this immediately?)
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
