(function() {
"use strict";


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

})();
