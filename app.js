window.require(['js/observable', 'js/book'],
  function(Observable, Book) {
"use strict";

// FIXME: Populate list of previously read books/bookmarks

var $ = id => document.getElementById(id);

//////////////////////////
// Self-test mechanism  //
//////////////////////////

var bookURL = new URL(window.location + "/../lib/readium-js-viewer/epub_content/internal_link.epub");
var book = new Book(bookURL);
book.init().then(() => {
  console.log("Book is initialized", book.title, book.author);
  console.log("Chapters", book.chapters);
});


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
