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
  window.parent.postMessage({method: "unload"}, "*");
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

////////////
//
//
window.addEventListener("message", function(e) {
  switch (e.data.method) {
    case "scrollBy":
      scrollBy(e.data.args[0]);
      break;
    default:
      break;
  }
});

function scrollBy(delta) {
  var width = window.innerWidth + columnGap;
  var scrollMaxX = document.body.scrollWidth;
  var nextPage = currentPage + delta;
  console.log("scrollBy", document.body, scrollMaxX);
  if (nextPage < 0) {
    // FIXME: TODO
    return;
  } else if (nextPage * width >= scrollMaxX) {
    console.log("That's past the end of the chapter", nextPage * width);
    return;
  }
  // FIXME: Animate
  var translation = "translateX(" + (-1 * nextPage * width) + "px)";
  currentPage = nextPage;
  console.log("Translation", translation);
  document.body.style.transform = translation;
}

})();
