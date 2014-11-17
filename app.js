window.require(['js/polyfills',
                'js/book',
                'js/bookviewer',
                'js/sizewatcher',
                'js/urlutils'],
  function(_, Book, BookViewer, SizeWatcher, UrlUtils) {
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
  Menus.top.showText(event.book.title);
});
bookViewer.notifications.addObserver("book:opening", function(event) {
  $("contents").classList.remove("invisible");
});
if ("mozSetMessageHandler" in navigator) {
  navigator.mozSetMessageHandler('activity', function(request) {
    console.log("Activity request", request);
  });
}

function Menu(elt) {
  this.element = elt;
  this._hiding = null;
  this._showing = null;
  this._textIsInvisible = false;
  this._autoHideTimeout = null;
}
Menu.prototype = {
  _afterTransition: function() {
    var elt = this.element;
    return new Promise(resolve => {
      elt.addEventListener("transitionend", function observer() {
        elt.removeEventListener("transitionend", observer);
        resolve();
      });
    });
  },
  showText: function(text) {
    var elt = this.element;
    if (elt.classList.contains("hidden")) {
      // The menu is invisible, just change the text
      // and display the menu.
      elt.textContent = text;
      this.show();
      return;
    }

    // The menu is visible or will shortly be.
    // Let's make sure that it's not going to hide immediately.
    this.autoHide();
    var promise;
    if (elt.classList.contains("hidden_text")) {
      // Text is already invisible, or will shortly be.
      if (this._textIsInvisible) {
        promise = Promise.resolve();
      } else {
        promise = this._afterTransition();
      }
    } else {
      // Text is visible, let's make it invisible first.
      elt.classList.add("hidden_text");
      promise = this._afterTransition();
      promise = promise.then(() => {
        this._textIsInvisible = true;
      });
    }
    promise = promise.then(() => {
      elt.textContent = text;
      elt.classList.remove("hidden_text");
      this.autoHide();
      return this._afterTransition(() => {
        this._textIsInvisible = false;
      });
    });
    return promise;
  },
  show: function() {
    if (this._showing) {
      return this._showing;
    }
    var elt = this.element;
    elt.classList.remove("hidden");
    this._hiding = null;
    return this._showing = new Promise(resolve => {
      elt.addEventListener("transitionend", function observer() {
        elt.removeEventListener("transitionend", observer);
        this.autoHide();
        resolve();
      }.bind(this));
    });
  },
  hide: function() {
    this._autoHideTimeout = null;
    if (this._hiding) {
      return this._hiding;
    }
    var elt = this.element;
    elt.classList.add("hidden");
    this._showing = null;
    return this._hiding = new Promise(resolve => {
      elt.addEventListener("transitionend", function observer() {
        elt.removeEventListener("transitionend", observer);
        resolve();
      });
    });
  },
  autoHide: function() {
    if (this._autoHideTimeout) {
      console.log("Postponing auto-hide");
      window.clearTimeout(this._autoHideTimeout);
    }
    this._autoHideTimeout = window.setTimeout(() => {
      console.log("Auto-hiding");
      this.hide();
    }, 3000);
  },
};

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
// Load a book passed as URL.
//
var params = new URL(window.location).searchParams;
console.log("Params", params, new URL(window.location));
if (params) {
  try {
    if (params.get("action") == "view") {

    } else {
      var bookURL;
      var chapterNum = 0;
      if (params.has("book")) {
        bookURL = UrlUtils.toURL(params.get("book"));
      }

      if (params.has("chapter")) {
        chapterNum = Number.parseInt(params.get("chapter"));
      }

      if (bookURL) {
        bookViewer.open(bookURL, chapterNum).then(null, e => console.error(e));
      }
    }
  } catch (ex) {
    console.error(ex);
  }
}

$("file_picker").addEventListener("click", function(e) {
  console.log("file_picker", e);
  e.stopPropagation();
  $("hidden_file_input").click();
});
$("hidden_file_input").addEventListener("change", function(e) {
  e.stopPropagation();
  e.preventDefault();
  var files = $("hidden_file_input").files;
  if (!files || files.length == 0) {
    // No files opened, nothing to do.
    return;
  }
  bookViewer.open(files[0], 0);
});

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
