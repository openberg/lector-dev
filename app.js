window.require(['js/polyfills',
                'js/book',
                'js/bookviewer',
                'js/book-epub.js',
                'js/config',
                'js/filepicker',
                'js/library',
                'js/menu',
                'js/urlutils'],
  function(_, Book, BookViewer, BookEPub, Config, FilePicker, Library, Menu, UrlUtils) {
"use strict";

var $ = id => document.getElementById(id);
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

//
// When clicking on the arrows, change page
//
$("arrow_left").addEventListener("click", function(event) {
  bookViewer.changePageBy(-1);
  event.stopPropagation();
  event.preventDefault();
});

$("arrow_right").addEventListener("click", function(event) {
  bookViewer.changePageBy(1);
  event.stopPropagation();
  event.preventDefault();
});

//
// When changing book, page, chapter, etc, update
// the top/bottom bars accordingly.
//
bookViewer.notifications.addObserver("page:changing", function(event) {
  console.log("App", "Moved to page", event);
  $("menu_bottom").textContent = "Page " + (event.page + 1) + "/" + (event.lastPage + 1) + " in document";
});
bookViewer.notifications.addObserver("chapter:exit", function(event) {
  Menus.bottom.showText("(Loading)");
});
bookViewer.notifications.addObserver("chapter:enter", function(event) {
  console.log("App", "Entering chapter", event);
  Menus.top.showText(event.chapter.title);
  document.title = "Lector: " + event.chapter.book.title + " (" + event.chapter.title + ")";
});

//
// When opening a book, hide the library, cancel this if we fail
// to open the book.
//
bookViewer.notifications.addObserver("book:open", function(event) {
  console.log("App", "Opened book", event);
  $("welcome").classList.add("scrolledleft");
  $("contents").classList.remove("invisible");
  Menus.top.showText(event.book.title);
  document.title = "Lector: " + event.book.title;
});
bookViewer.notifications.addObserver("book:opening", function(event) {
  $("welcome").classList.add("scrolledleft");
  $("contents").classList.remove("invisible");
});
bookViewer.notifications.addObserver("book:opening:failed", function(event) {
  $("welcome").classList.remove("scrolledleft");
  $("contents").classList.add("invisible");
  Menus.bottom.showText("Could not open book");
  document.title = "Lector";
});


var Menus = {
  top: new Menu($("menu_top"), $("menu_top_contents")),
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
  console.log("App", "Click");
  Menus.show();
});
Menus.autoHide();

//
// If the user clicks on "Open a book", attempt to pick
// and open a book.
//
var filePicker = new FilePicker($("pick"), "application/*");
filePicker.notifications.addObserver("file:open", event => {
  console.log("App", "Opening file from the file picker", event.file);
  library.open(event.file).then(book => bookViewer.view(book));
});

// Open user Doc when no file picker installed
filePicker.notifications.addObserver("file:nopicker", () => {
  console.log("App", "nopicker", "No File Picker installed - ( "+(("mozSetMessageHandler" in navigator) ? "firefoxOS" : "android")+" ) - opening user documentation to install File Picker");
    library.open("samples/lector.epub").then(book => bookViewer.view(book, 
                ("mozSetMessageHandler" in navigator) ? "firefox os.html" : "android.html")) ;
});

//
// If the user clicks on an epub from another application,
// attempt to open the book.
//
if ("mozSetMessageHandler" in navigator) {
  navigator.mozSetMessageHandler('activity', function(request) {
    console.log("App", "Opening file from the activity message handler", request.source.data);
    library.open(request.source.data.blob).then(book => bookViewer.view(book));
  });
}


//
// Populate the library menu, then display it.
//
var library = new Library([BookEPub]);
library.init().then(() => {
  console.log("App", "Library is initialized");
  var libraryElement = $("library_entries");
  library.entries.forEach(entry => {
    var li = document.createElement("li");
    li.classList.add("library_entry");
    li.addEventListener("click", function() {
      //
      // If the user clicks on a book, attempt to
      // open it.
      //
      console.log("App", "Library", "Opening", entry.title);
      entry.open().then(book => bookViewer.view(book));;

      //
      //If the user clicks on a book, it loads in mode fullscreen if the function Config is true
      //
	  if(Config.allowfullscreen){
        document.body.mozRequestFullScreen();
      }
    });
    libraryElement.insertBefore(li, $("pick"));

    var title = document.createElement("span");
    title.classList.add("book_title");
    title.textContent = entry.title;
    li.appendChild(title);

    if (entry.author) {
      var author = document.createElement("span");
      author.textContent = ", by " + entry.author;
      li.appendChild(author);
    }
  });
  libraryElement.classList.remove("hidden");
});

library.notifications.addObserver("library:open:failure", event => {
  Menus.bottom.showText("Error while opening book: " + event.error);
});

//
// If a book was passed as url, attempt to open it.
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
    console.error("App", ex);
  }
}

$("menu_top_right").addEventListener("click", event => {
  event.stopPropagation();
  var elt = $("menu_top_right_contents");
  if (elt.classList.contains("folded_up")) {
    elt.classList.add("unfolded_up");
    elt.classList.remove("folded_up");
  } else {
    elt.classList.remove("unfolded_up");
    elt.classList.add("folded_up");
  }
});

$("menu_top_right_contents").addEventListener("click", event => {
  event.stopPropagation();
});

//
// App Installation:
//   Remove "Install App" button if the app is already installed
//   Install App when the user clicks on the "Install App" button
//
(function setupInstall() {

  var openbergManifestUrl =  UrlUtils.toURL("manifest.webapp").href;
  console.log("App", "Manifest URL : " + openbergManifestUrl);

  if (!("mozApps" in window.navigator)) {
    // We can't install on this platform.
    $("install").remove();
    return;
  }

  var Apps = window.navigator.mozApps;

  var request = Apps.checkInstalled(openbergManifestUrl);

  request.onsuccess = function(e) {
    if (request.result) {
      console.log("App", "App is installed!");
      $("install").remove();
    } else {
      console.log("App", "App is not installed!");
    }
  };

  $("install").addEventListener("click", function() {
    var Apps = window.navigator.mozApps;

    var request = Apps.install(openbergManifestUrl);

    request.onsuccess = function () {
      $("install").remove();
      Menus.bottom.showText("Installation successful!");
      console.log("App", "Installation successful!");
    };
    request.onerror = function () {
      // Display the error information from the DOMError object
      Menus.bottom.showText("Install failed, maybe the app is already installed.");
      console.log("App", "Install failed, error: " + this.error.name);
    };
  });
})();

});
