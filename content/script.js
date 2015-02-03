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
var gCurrentPage = 0;

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
  resizing = null;
  scrollToPage(gCurrentPage);
}

var BUFFERING_DURATION_MS = 60;
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
  window.parent.postMessage({method: "load", args:[{title: document.title}]}, "*");
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
      scrollBy(-1, "keypress");
      break;
    case "ArrowDown":
    case "ArrowRight":
    case "Right":
    case "Backspace":
      e.preventDefault();
      e.stopPropagation();
      scrollBy(1, "keypress");
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
      var defaultPosition = gCurrentPage * gInnerWidth;
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
      scrollBy(0, "touchend");
    } else if (deltaX < 0) {
      scrollBy(1, "touchend");
    } else {
      scrollBy(-1, "touchend");
    }
  },
  __ontouchend: null,

  _initialized: false,
  /**
   * Initialize touch screen handling.
   */
  init: function() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;
    // Make sure that all event handlers are bound to `this`.
    for (var k of ["_ontouchstart", "_ontouchmove", "_ontouchend"]) {
      this["_" + k] = this[k].bind(this);
    }
    window.addEventListener("touchstart", this.__ontouchstart);
    window.addEventListener("touchmove", this.__ontouchmove);
    window.addEventListener("touchend", this.__ontouchend);
  },

  uninit: function() {
    if (!this._initialized) {
      return;
    }
    this._initialized = false;
    window.removeEventListener("touchstart", this.__ontouchstart);
    window.removeEventListener("touchmove", this.__ontouchmove);
    window.removeEventListener("touchend", this.__ontouchend);
  }
};
Touch.init();

/**
 * Using the mouse wheel/touchpad to scroll.
 */
var Wheel = {
  // `true` if we have scheduled an animation for the next tick and
  // not started displaying it yet.
  _isAnimationScheduled: false,

  // The number of pixels by which the wheel has started moving since
  // the start of the current wheel move.
  _accumulatedDelta: 0,

  // A timer used to reset accumulatedDelta to 0 after a few hundred
  // milliseconds of inactivity.
  _reset: null,

  // A placeholder, to make sure that the browser never receives the
  // wheel events, which may cause history browsing on some platforms.
  onwheelPlaceHolder: function(event) {
    event.preventDefault();
    event.stopPropagation();
  },
  _onwheel: function(event) {
    event.preventDefault();
    event.stopPropagation();
    if (this._isAnimationScheduled) {
      // Ignore events while we're scrolling
      return;
    }
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      this._accumulatedDelta += event.deltaX;
    } else {
      this._accumulatedDelta += event.deltaY;
    }
    if (Math.abs(this._accumulatedDelta) < gInnerWidth / 2) {
      // Don't scroll yet

      // If we stop scrolling for 1/3 second, reset delta.
      if (this._reset) {
        window.clearTimeout(this._reset);
      }
      this._reset = window.setTimeout(300, () => {
        this._reset = null;
        this._accumulatedDelta = 0;
      });
      return;
    }

    // Now scroll
    var direction = Math.sign(this._accumulatedDelta);
    this._isAnimationScheduled = true;
    this._accumulatedDelta = 0;
    requestAnimationFrame(() => {
      console.log("Content", "wheel", "scrolling now", direction);
      this._isAnimationScheduled = false;
      scrollBy(direction);
    });
  },
  __onwheel: null,

  _initialized: false,
  /**
   * Initialize mouse wheel handling.
   */
  init: function() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;
    // Make sure that all event handlers are bound to `this`.
    for (var k of ["_onwheel"]) {
      this["_" + k] = this[k].bind(this);
    }
    window.removeEventListener("wheel", this.onwheelPlaceHolder);
    window.addEventListener("wheel", this.__onwheel);
  },

  uninit: function() {
    if (!this._initialized) {
      return;
    }
    this._initialized = false;
    window.removeEventListener("wheel", this.__onwheel);
    window.addEventListener("wheel", this.onwheelPlaceHolder);
  }
};
Wheel.init();

/////////////
// Navigation
//

window.addEventListener("message", function(e) {
  switch (e.data.method) {
    case "scrollBy":
      scrollBy(e.data.args[0], "ux");
      break;
    case "scrollToPage":
      scrollToPage(e.data.args[0]);
      break;
    case "setFontSize":
      setFontSize(e.data.args[0]);
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
  console.log("Content", "Translation", translation);
  console.log("Content", "scrolling to position", document.body.style.transform, translation);
  document.body.style.transform = translation;
}

/**
 * Get a named anchor in the document.
 *
 * @param {string} name The name of an anchor, which may
 * correspond to the `id` of an element or to a <a name = ...>`.
 * @return {Element|null}
 */
function getAnchor(name) {
  // In HTML5, anchors map to <a id="...">,
  // so we may find them with `document.getElementById`.
  var element = document.getElementById(name);
  if (element) {
    return element;
  }

  // In older HTML, anchors map to <a name="...">`,
  // so we need to walk all the anchors of the document
  // until we find the right one.
  element = [...document.anchors].find(x => x.name == name);
  if (element && !element.getAttribute("id")) {
    // Cache the result, to find it faster next time.
    element.setAttribute("id", name);
  }
  return element;
}

/**
 * Get the page for an element.
 *
 * @param {Element} element
 * @return {number} 0-indexed page number for the element.
 */
function getPageOf(element) {
  return Math.floor(element.offsetLeft / gInnerWidth);
}

/**
 * Scroll to a page in the document.
 *
 * @param {number|Element} where The page to which to scroll.
 * If an `Element`, scroll to the page containing the left of
 * the element.
 */
function scrollToPage(where) {
  Touch.init();
  Wheel.init();
  console.log("Contents", "scrollToPage", where);
  var width = gInnerWidth;
  var scrollMaxX = document.body.scrollWidth;
  var lastPage = getPageOf(getAnchor("lector_end"));
  if (where instanceof Element) {
    console.log("Contents", "scrollToPage", "element", where);
    if (!where) {
      // Could not find an anchor
      return;
    }
    // Pick the coordinates to scroll the element into view.
    where = getPageOf(where);
  }
  console.log("Content", "scrollToPage", "destination", where);
  if (typeof where != "number") {
    throw new TypeError("Expected a number");
  }
  gCurrentPage = where;
  window.parent.postMessage({method: "pagechange", args:[{page: where, lastPage: lastPage}]}, "*");
  scrollToPosition(gCurrentPage * width);
}

window.Lector.scrollToPage = scrollToPage;

/**
 * Trigger a chapter change.
 *
 * @param {number} deltaChapter The number of chapters to advance.
 * May be negative to scroll backwards.
 */
function changeChapterBy(deltaChapter, event, page) {
  console.log("Content", "Need to change chapter", event, page);
  if (deltaChapter == 0) {
    throw new TypeError("Expected a non-0 chapter");
  }

  // Ignore any further scrolling.
  Touch.uninit();
  Wheel.uninit();

  if (event == "keypress" || event == "ux") {
    // Overscroll effect
    scrollToPosition((gCurrentPage + (deltaChapter / 2)) * gInnerWidth);
  }

  // Trigger chapter change
  window.parent.postMessage({method: "changeChapterBy", args: [deltaChapter]}, "*");
}

/**
 * Scroll forwards/backwards by a number of pages.
 *
 * @param {number} deltaPages The number of pages to scroll.
 * May be negative to scroll backwards. Ignored if 0.
 */
function scrollBy(deltaPages, event) {
  console.log("Content", "scrollBy", deltaPages, event)
  var lastPage = getPageOf(getAnchor("lector_end"));
  var nextPage = gCurrentPage + deltaPages;
  if (nextPage < 0) {
    return changeChapterBy(-1, event, nextPage);
  } else if (nextPage > lastPage) {
    return changeChapterBy(1, event, nextPage);
  } else {
    return scrollToPage(nextPage);
  }
}

/**
 * Set the font size.
 *
 * @param {string} size The size as a CSS property.
 */
function setFontSize(size) {
  document.body.style.fontSize = size;
}

function setTheme(path) {
  var link = document.getElementById("lector:injectLink:theme");
  link.setAttribute("href", path);
}

//
// Startup
//
function onstart() {
  console.log("Content", "onstart", window.location.hash);
  //
  // If the hash contains #lector:startpage=xxx, move
  // to page xxx, where xxx is a number.
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
  } else if (window.location.hash) {
    var hash = window.location.hash.substring(1);
    window.location.hash = "";
    scrollToPage(getAnchor(hash));
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
