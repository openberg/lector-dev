window.require(['js/book',
                'js/bookviewer',
                'js/sizewatcher',
                'js/urlutils'],
  function(Book, BookViewer, SizeWatcher, UrlUtils) {
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

bookViewer.notifications.addObserver("pagechange", function(event) {
  console.log("Moved to page", event);
  $("menu_bottom").textContent = "Chapter Page " + (event.page + 1) + "/" + (event.lastPage + 1);
});
bookViewer.notifications.addObserver("chapterchange", function(event) {
  console.log("Moved to chapter", event);
  $("menu_top").textContent = "Chapter " + (event.chapter + 1) + "/" + (event.lastChapter + 1);
});

document.addEventListener("touchmove", function(event) {
});

if ("mozSetMessageHandler" in navigator) {
  var onActivity = function(request) {
    console.log("Activity request", request);
  };
  navigator.mozSetMessageHandler('open', onActivity);
  navigator.mozSetMessageHandler('view', onActivity);
}

function hideMenus() {
  if (!hideMenusTimeout) {
    window.clearTimeout(hideMenusTimeout);
  }
  hideMenusTimeout = window.setTimeout(function() {
    $("menu_top").classList.add("hidden");
    $("menu_bottom").classList.add("hidden");
    hideMenusTimeout = null;
  }, 3000);
}
var hideMenusTimeout = null;

window.addEventListener("click", function(event) {
  console.log("Click");
  $("menu_top").classList.remove("hidden");
  $("menu_bottom").classList.remove("hidden");
  hideMenus();
});
hideMenus();

//
// Load a book passed as URL.
//
var bookURL = UrlUtils.toURL("samples/lector.epub");
var chapterNum = 0;
var params = new URL(window.location).searchParams;
console.log(params);
try {
  if (params.has("book")) {
    bookURL = UrlUtils.toURL(params.get("book"));
  }

  if (params.has("chapter")) {
    chapterNum = Number.parseInt(params.get("chapter"));
  }
} catch (ex) {
  console.error(ex);
}

bookViewer.open(bookURL).then(
  bookViewer.navigateTo(chapterNum)
).then(null, e => console.error(e));


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
