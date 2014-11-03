define(["js/notifications"],
  function(Notifications) {

"use strict";

var BUFFER_DURATION_MS = 15;

function SizeWatcher(element) {

  /**
   * Instances of SizeWatcher notify of the following events:
   * - resize Shortly after the item has been resized.
   */
  this.notifications = new Notifications(["resize"]);
  this._element = element;
  var update = () => {
    this.innerWidth = this._element.innerWidth;
    this.innerHeight = this._element.innerHeight;
    this.notifications.notify("resize");
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

return SizeWatcher;

});
