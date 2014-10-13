// AMD wrapper around lib/zip.js/zip.js

window.define(function() {
  "use strict";
  var url = new window.URL(window.location);
  url.pathname += "/../lib/zip.js/WebContent/";
  window.zip.workerScriptsPath = url.href;
  return window.zip;
});
