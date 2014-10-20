window.require(['js/book',
                'js/bookviewer',
                'js/observable',
                'js/sizewatcher',
                'js/urlutils'],
  function(Book, BookViewer, Observable, SizeWatcher, UrlUtils) {
"use strict";

var $ = id => document.getElementById(id);
var windowWatcher = new SizeWatcher(window);
var bookViewer = new BookViewer($("contents"));

$("arrow_left").addEventListener("click", function() {
  bookViewer.changePageBy(-1);
});

$("arrow_right").addEventListener("click", function() {
  bookViewer.changePageBy(1);
});

bookViewer.addObserver("pagechange", function(event) {
  console.log("Moved to page", event);
});

//
// Load a book passed as URL.
//
var params = new URL(window.location).searchParams;
console.log(params);
try {
  var bookURL = null;
  if (params.has("book")) {
    bookURL = UrlUtils.toURL(params.get("book"));
  }

  if (bookURL) {
    var chapterNum = 0;
    if (params.has("chapter")) {
      chapterNum = Number.parseInt(params.get("chapter"));
    }
    var promise = bookViewer.open(bookURL);
    promise = promise.then(() =>
      bookViewer.navigateTo(chapterNum)
    );
    promise = promise.then(null, e => console.error(e));
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
