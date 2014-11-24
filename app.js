window.require(['js/polyfills',
                'js/book',
                'js/bookviewer',
                'js/book-epub.js',
                'js/filepicker',
                'js/library',
                'js/menu',
                'js/sizewatcher',
                'js/urlutils'],
  function(_, Book, BookViewer, BookEPub, FilePicker, Library, Menu, SizeWatcher, UrlUtils) {
"use strict";

var $ = id => document.getElementById(id);
var windowWatcher = new SizeWatcher(window);
var bookViewer = new BookViewer($("contents"));

//
// Make sure that we do not rotate if executed on a phone/tablet,
// as this kills our layout.
//
["lockOrientation", "mozLockOrientation"].forEach(key => {
  if (key in window.screen) {
    window.screen[key]("portrait-primary");
  }
});

$("arrow_left").addEventListener("click", function() {
  bookViewer.changePageBy(-1);
});

$("arrow_right").addEventListener("click", function() {
  bookViewer.changePageBy(1);
});

bookViewer.notifications.addObserver("page:changing", function(event) {
  console.log("Moved to page", event);
  $("menu_bottom").textContent = "Page " + (event.page + 1) + "/" + (event.lastPage + 1) + " in document";
});
bookViewer.notifications.addObserver("chapter:exit", function(event) {
  Menus.bottom.showText("(Loading)");
});
bookViewer.notifications.addObserver("chapter:titleavailable", function(event) {
  Menus.top.showText(event.chapter.title);
});
bookViewer.notifications.addObserver("chapter:enter", function(event) {
  Menus.top.showText(event.chapter.title);
});
bookViewer.notifications.addObserver("book:open", function(event) {
  console.log("Opened book", event);
  $("welcome").classList.add("scrolledleft");
  $("contents").classList.remove("invisible");
  Menus.top.showText(event.book.title);
});
bookViewer.notifications.addObserver("book:opening", function(event) {
  $("contents").classList.remove("invisible");
});
bookViewer.notifications.addObserver("book:opening:failed", function(event) {
  $("contents").classList.add("invisible");
  Menus.bottom.showText("Could not open book");
});
if ("mozSetMessageHandler" in navigator) {
  navigator.mozSetMessageHandler('activity', function(request) {
    console.log("App", "Opening file from the activity message handler", request.source.data);
    library.open(request.source.data.blob).then(book => bookViewer.view(book));
  });
}


var Menus = {
  top: new Menu($("menu_top")),
  bottom: new Menu($("menu_bottom")),
  show: function() {
    this.top.show();
    this.bottom.show();
  },
  hide: function() {
    this.top.hide();
    this.bottom.hide();
  },
  autoHide: function() {
    this.top.autoHide();
    this.bottom.autoHide();
  }
}

window.addEventListener("click", function(event) {
  console.log("Click");
  Menus.show();
});
Menus.autoHide();

//
// Welcome page
//
var filePicker = new FilePicker($("pick"), "application/*");
filePicker.notifications.addObserver("file:open", event => {
  console.log("App", "Opening file from the file picker", event.file);
  library.open(event.file).then(book => bookViewer.view(book));
});

var library = new Library([BookEPub]);
(function init_library() {
  var libraryElement = $("library_entries");
  library.entries.forEach(entry => {
    var li = document.createElement("li");
    li.classList.add("library_entry");
    li.addEventListener("click", function() {
      console.log("App", "Library", "Opening", entry.title);
      entry.open().then(book => bookViewer.view(book));;
    });
    libraryElement.appendChild(li);

    var title = document.createElement("span");
    title.classList.add("book_title");
    title.textContent = entry.title;
    li.appendChild(title);

    var author = document.createElement("span");
    author.textContent = ", by " + entry.author;
    li.appendChild(author);
  });
  libraryElement.classList.remove("hidden");
})();
library.notifications.addObserver("library:open:failure", event => {
  Menus.bottom.showText("Error while opening book: " + event.error);
});

//
// Load a book passed as URL.
//
var params = new URL(window.location).searchParams;
if (params) {
  try {
    if (params.get("action") == "view") {

    } else {
      var bookURL;
      var chapterNum = 0;
      var endOfChapter = false;
      if (params.has("book")) {
        bookURL = UrlUtils.toURL(params.get("book"));
      }

      if (params.has("chapter")) {
        chapterNum = Number.parseInt(params.get("chapter"));
      }
      if (params.has("end")) {
        endOfChapter = true;
      }

      if (bookURL) {
        library.open(bookURL).then(book => bookViewer.view(book, chapterNum, endOfChapter));
      }
    }
  } catch (ex) {
    console.error(ex);
  }
}

});
