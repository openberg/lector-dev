/**
 * JavaScript code injected in the content <iframe>.
 *
 * Code from this file has access to the document representing the current chapter, but not to the
 * application. To communicate with the application, the code needs to send messages using
 * `window.parent.postMessage`.
 */
(function() {
"use strict";

window.Lector = {};

/**
 * The number of the current page inside the chapter,
 * (0-indexed).
 */
var currentPage = 0;

/**
 * The width of the contents of the window.
 * Use this variable instead of `window.innerWidth`
 * for speed.
 */
var gInnerWidth = window.innerWidth;

/**
 * The height of the contents of the window.
 * Use this variable instead of `window.innerHeight`
 * for speed.
 */
var gInnerHeight = window.innerHeight;

///////////////
// Adapting column size
//

/**
 * A <style> node setting the maximal size of images.
 */
var styleImgElement = null;
function setupColumns() {
  console.log("Content", "Setting up columns", document.body, window);
  gInnerWidth = window.innerWidth;
  gInnerHeight = window.innerHeight;

  //
  // On small screens, many images will not fit.
  // Let's make sure that we do not have any image that attempts to
  // take more than the width/height of the screen.
  //
  var bodyWidth = document.body.clientWidth;
  var bodyHeight = document.body.clientHeight;

  console.log("Content", "Setting up image maximal size", bodyWidth, bodyHeight);
  if (!styleImgElement) {
    styleImgElement = document.createElement("style");
    styleImgElement.setAttribute("id", "lector:style:img");
    var head = document.querySelector("html > head");
    head.appendChild(styleImgElement);
  }

  styleImgElement.textContent = `img {
    max-width: calc(${ bodyWidth }px - 4em);
    max-height: calc(${ bodyHeight }px - 4em);
  }`;
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
  window.removeEventListener("DOMContentLoaded", observer);
  setupColumns();
});


/**
 * Configure the font size.
 *
 * @param {number} A factor by which to multiply the default font
 * size, where 1.0 is normal size. Must be > 0.
 */
window.Lector.setZoomFactor = function(factor) {
  if (typeof factor != "number" || factor <= 0) {
    throw new TypeError("Expected a positive number, got " + factor);
  }
  document.documentElement.style.fontSize = (100 * factor) + "%";
  setupColumns();
};

///////////////
// Communicating with the parent window
//

window.Lector.goto = function(href) {
  var message = {method:"goto", args:[href]};
  window.parent.postMessage(message, "*");
};

///////////////
// Load/unload
//

window.addEventListener("load", function() {
  window.parent.postMessage({method: "load", args:[]}, "*");
  onstart();
});

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
// Touch events
//

var Touch = {
  // The event emitted when the user put her finger on the screen.
  _latestTouchStart: null,
  // The event emitted last time the user moved her finger.
  _latestTouchMove: null,
  // `true` if we have scheduled an animation for the next tick and
  // not started displaying it yet.
  _isAnimationScheduled: false,

  /**
   * The user has just put a finger on the screen.
   *
   * Record the position for later.
   */
  _ontouchstart: function(event) {
    if (event.touches.length > 1) {
      // This is a multi-touch event, so probably the user
      // is zooming. Let's not interfere with it.
      return;
    }
    this._latestTouchStart = event;
  },
  __ontouchstart: null,

  /**
   * The user has moved at least one finger on the screen.
   *
   * Animate the page to follow the finger.
   */
  _ontouchmove: function(event) {
    if (event.touches.length > 1) {
      // This is a multi-touch event, so probably the user
      // is zooming. Let's not interfere with it.
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this._latestTouchMove = event;

    if (this._isAnimationScheduled) {
      // We have already scheduled an animation,
      // scheduling another one would be useless.
      return;
    }
    this._isAnimationScheduled = true;

    if (!this._latestTouchStart) {
      return;
    }

    requestAnimationFrame(() => {
      this._isAnimationScheduled = false;

      // Let's follow the swipe immediately.
      var originalX = this._latestTouchStart.touches[0].clientX;
      var currentX = this._latestTouchMove.touches[0].clientX;
      var deltaX = currentX - originalX;
      var defaultPosition = currentPage * gInnerWidth;
      scrollToPosition(defaultPosition - deltaX);
    });
  },
  __ontouchmove: null,

  /**
   * The user has released at least one finger on the screen.
   *
   * Finish animation, possibly move to the previous/next chapter.
   */
  _ontouchend: function (event) {
    if (event.touches.length >= 1) {
      // This is a multi-touch event, so probably the user
      // is zooming. Let's not interfere with it.
      return;
    }
    var originalX = this._latestTouchStart.touches[0].clientX;
    var currentX = this._latestTouchMove.touches[0].clientX;
    this._latestTouchStart = null;
    this._latestTouchEnd = null;
    var deltaX = currentX - originalX;
    if (Math.abs(deltaX) < gInnerWidth * .1) {
      // The finger moved by less than 10% of the width of the screen, it's
      // probably not intended as a swipe, so let's ignore it.
      scrollBy(0);
    } else if (deltaX < 0) {
      scrollBy(1);
    } else {
      scrollBy(-1);
    }
  },
  __ontouchend: null,

  /**
   * Initialize touch screen handling.
   */
  init: function() {
    // Make sure that all event handlers are bound to `this`.
    for (var k of ["_ontouchstart", "_ontouchmove", "_ontouchend"]) {
      this["_" + k] = this[k].bind(this);
    }
    window.addEventListener("touchstart", this.__ontouchstart);
    window.addEventListener("touchmove", this.__ontouchmove);
    window.addEventListener("touchend", this.__ontouchend);
  },

  uninit: function() {
    window.removeEventListener("touchstart", this.__ontouchstart);
    window.removeEventListener("touchmove", this.__ontouchmove);
    window.removeEventListener("touchend", this.__ontouchend);
  }
};
Touch.init();

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
    case "eval":
      // Cheat mode, useful for debugging
      console.log("eval", eval(e.data.args[0]));
      break;
    default:
      break;
  }
});

function scrollToPosition(position) {
  var translation = "translateX(" + (-1 * position) + "px)";
  console.log("Translation", translation);
  console.log("scrolling to position", document.body.style.transform, translation);
  document.body.style.transform = translation;
}

function scrollToPage(where) {
  console.log("scrollToPage", where);
  var width = gInnerWidth;
  var scrollMaxX = document.body.scrollWidth;
  var lastPage = Math.floor(scrollMaxX / width);
  if (where == Infinity) {
    where = lastPage;
  }
  currentPage = where;
  window.parent.postMessage({method: "pagechange", args:[{page: where, lastPage: lastPage}]}, "*");
  scrollToPosition(currentPage * width);
}

window.Lector.scrollToPage = scrollToPage;

/**
 * Scroll forwards/backwards by a number of pages.
 *
 * @param {number} deltaPages The number of pages to scroll.
 * May be negative to scroll backwards. Ignored if 0.
 */
function scrollBy(deltaPages, mayChangeChapter = true) {
  var scrollMaxX = document.body.scrollWidth;
  var nextPage = currentPage + deltaPages;
  var width = gInnerWidth;
  if (mayChangeChapter) {
    if (nextPage < 0) {
      console.log("Next page is < 0");
      window.parent.postMessage({method: "changeChapterBy", args: [-1]}, "*");
      // Ignore any further scrolling.
      Touch.uninit();
      return;
    } else if (nextPage * width >= scrollMaxX) {
      window.parent.postMessage({method: "changeChapterBy", args: [1]}, "*");
      // Ignore any further scrolling.
      Touch.uninit();
      return;
    }
  }
  scrollToPage(nextPage);
}

//
// Startup
//
function onstart() {
  console.log("Content", "onstart", window.location.hash);
  //
  // If the hash contains #lector:startpage=xxx, move
  // to page xxx. xxx may be a number, including
  // Infinity for the last page of the chapter.
  //
  const STARTPAGE_PREFIX = "#lector:startpage=";
  if (window.location.hash.startsWith(STARTPAGE_PREFIX)) {
    console.log("Content", "onstart", "start page was specified");
    try {
      var position = Number(window.location.hash.substring(STARTPAGE_PREFIX.length));
      console.log("Content", "onstart", "start page", position);
      scrollToPage(position);
    } catch (ex) {
      console.error("Content", "onstart", "start page failure", ex);
    }
  }

  //
  // Now that we have picked the start page, any further
  // transition between pages should be animated.
  //
  // We wait two animation frames before doing this, to
  // ensure that the initial scrolling is complete.
  //
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document.body.style.transition = "transform .3s";
    });
  });
};

})();
