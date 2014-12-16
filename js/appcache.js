/**
 * Interactions with the application cache
 */
define(function() {
"use strict";

console.log("AppCache", "Setting up");

var promiseReady = new Promise((resolve, reject) => {
  if (!("applicationCache" in window)) {
    console.log("AppCache", "No application cache available");
    resolve();
    return;
  }

  var cache = window.applicationCache;

  if (cache.status != cache.CHECKING
   && cache.status != cache.DOWNLOADING) {
    console.log("AppCache", "Cache is already ready", cache.status);
    resolve();
    return;
  }

  console.log("AppCache", "Setting up event listeners");
  for (var name of ["noupdate", "cached", "obsolete"]) {
    cache.addEventListener(name, event => {
      console.log("AppCache", "event", name, event);
      resolve();
    })
  }
  cache.addEventListener("error", reject)
});

var isReady = false;

var AppCache = {
  /**
   * A promise resolved once the application cache is ready.
   *
   * @type {Promise}
   */
  promiseReady: promiseReady
};

return AppCache;
});
