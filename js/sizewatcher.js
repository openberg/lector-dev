define(["js/observable"],
  function(Observable) {

"use strict";

var BUFFER_DURATION_MS = 15;

function SizeWatcher(element) {
  Observable.call(this, ["resize"]);
  this._element = element;
  var update = () => {
    this.innerWidth = this._element.innerWidth;
    this.innerHeight = this._element.innerHeight;
    this.notify("resize");
  };
  var delayed = null;
  this._element.addEventListener("resize", () => {
    if (delayed) {
      // We are already about to update the size information
      return;
    }
    // Let's wait a few milliseconds before we update,
    // otherwise we are going to kill performance.
    delayed = setTimeout(() => {
      delayed = null;
      update();
    }, BUFFER_DURATION_MS);
  });
  update();
}
SizeWatcher.prototype = Object.create(Observable.prototype);

return SizeWatcher;

});
