(function() {
"use strict";

window.Lector = {};

var columnGap = 40;
var currentPage = 0;

///////////////
// Adapting column size
//

function setupColumns() {
  var innerWidth = window.innerWidth;
  var innerHeight = window.innerHeight;
  var body = document.body;
  body.style.MozColumnWidth = innerWidth + "px";
  body.style.MozColumnGap = columnGap + "px";
//  body.style.height = innerHeight + "px";

}
var BUFFERING_DURATION_MS = 15;
var resizing = null;
window.addEventListener("resize", function() {
  if (resizing) {
    return;
  }
  resizing = setTimeout(setupColumns, BUFFERING_DURATION_MS);
});
window.addEventListener("DOMContentLoaded", function observer() {
  setupColumns();
  window.removeEventListener("DOMContentLoaded", observer);
});


///////////////
// Communicating with the parent window
//

window.Lector.goto = function(href) {
  var message = {method:"goto", args:[href]};
  window.parent.postMessage(message, "*");
};

///////////////
// Garbage-collecting urls
//

window.addEventListener("unload", function() {
  window.parent.postMessage({method: "unload", args:[window.location.href]}, "*");
});

//////////////
// Keyboard navigation
//

window.addEventListener("keypress", function(e) {
  switch (e.code) {
    case "ArrowLeft":
    case "ArrowUp":
    case "Left":
    case "Space":
      e.preventDefault();
      e.stopPropagation();
      scrollBy(-1);
      break;
    case "ArrowDown":
    case "ArrowRight":
    case "Right":
    case "Backspace":
      e.preventDefault();
      e.stopPropagation();
      scrollBy(1);
    default:
      break;
  }
});

/////////////
// Navigation
//

window.addEventListener("message", function(e) {
  switch (e.data.method) {
    case "scrollBy":
      scrollBy(e.data.args[0]);
      break;
    case "scrollToPage":
      scrollToPage(e.data.args[0]);
      break;
    default:
      break;
  }
});

function scrollToPosition(position, animate) {
  var translation = "translateX(" + (-1 * position) + "px)";
  console.log("Translation", translation);
  document.body.style.transform = translation;  
}

function scrollToPage(where) {
  console.log("scrollToPage", where);
  var width = window.innerWidth + columnGap;
  if (where == Infinity) {
    var scrollMaxX = document.body.scrollWidth;
    where = Math.floor(scrollMaxX / width) - 1;
    console.log("Need to scroll to the last page", scrollMaxX, where);
  }
  currentPage = where;
  scrollToPosition(currentPage * width);
}

window.Lector.scrollToPage = scrollToPage;

function scrollBy(delta) {
  var scrollMaxX = document.body.scrollWidth;
  var nextPage = currentPage + delta;
  var width = window.innerWidth + columnGap;
  if (nextPage < 0) {
    console.log("Next page is < 0");
    window.parent.postMessage({method: "changeChapterBy", args: [-1]}, "*");
    return;
  } else if (nextPage * width >= scrollMaxX) {
    window.parent.postMessage({method: "chapterBy", args: [1]}, "*");
    return;
  }
  scrollToPage(nextPage);
}

})();
