(function() {
"use strict";

window.Lector = {};


///////////////
// Adapting column size
//

function setupColumns() {
  var innerWidth = window.innerWidth;
  var innerHeight = window.innerHeight;
  var body = document.body;
  body.style.MozColumnWidth = innerWidth + "px";
  body.style.MozColumnGap = "40px";
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
  console.log("Unloading frame");
  window.parent.postMessage({method: "unload"}, "*");
});



})();
