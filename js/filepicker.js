define(["js/notifications"],
  function(Notifications) {

/**
 * A control used to pick a file.
 *
 * @param {Element} element The DOM element to use for the control.
 * @param {string} mimetype The accepted mimetype.
 * @constructor
 */
function FilePicker(element, mimetype) {
  /**
   * Instances of FilePicker notify of the following events:
   * - file:open ({file: File}) A file has been picked.
   * - file:nopicker (null) Could not pick a file, generally
   *    because no file picker has been installed.
   */
  this.notifications = new Notifications(["file:open", "file:nopicker"]);

  if (typeof mimetype != "string") {
    throw new TypeError("Expected a string");
  }

  // The container element
  this._element = element;

  // The accepted mime type
  this._mimetype = mimetype;

  // The DOM Input element. Used only where Web Activities are not supported.
  this._input = null;

  element.addEventListener("click", e => {
    e.stopPropagation();
    this.pick();
  });
}

FilePicker.prototype = {

  /**
   * Open a dialog to let the user pick a file.
   *
   * Note that this method is called automatically when the user clicks/touches
   * the screen on the element.
   */
  pick: function() {
    if ("MozActivity" in window) {
      this.pickWithActivity();
    } else {
      this.pickWithInput();
    }
  },

  /**
   * Use a Web Activity to request a file from the system.
   *
   * On supported platforms (Firefox OS and Android), this generally
   * works better than using the default behavior of <input type="file">.
   */
  pickWithActivity: function() {
    console.log("FilePicker", "pickWithActivity", "starting");
    var options = {
      name: "pick",
      data: {
        type: this._mimetype
      }
    };
    var activity = new MozActivity(options);
    activity.onsuccess = () => {
      console.log("Filepicker", "picked", activity.result, Object.keys(activity.result).join(", "));
      this.notifications.notify("file:open", { file: activity.result.blob });
    };
    activity.onerror = () => {
      console.log("Filepicker", "we could not pick a file");
      this.notifications.notify("file:nopicker", null);
    };
  },

  /**
   * Use a hidden <input type="file"> to request a file from the system.
   */
  pickWithInput: function() {
    console.log("FilePicker", "pickWithInput", "starting", this._mimetype, new Error().stack);

    if (this._input) {
      console.log("FilePicker", "pickWithInput", "<input> already created");
    } else {
      console.log("FilePicker", "pickWithInput", "creating <input>");

      var div = document.createElement("div");
      div.classList.add("hidden_input_file");
      this._element.appendChild(div);

      // Create a hidden <input type="file">
      this._input = document.createElement("input");
      this._input.setAttribute("type", "file");

      // Set the types of files that it accepts
      this._input.setAttribute("accept", this._mimetype);
      this._input.classList.add("hidden_input_file");
      div.appendChild(this._input);
      console.log("FilePicker", "pickWithInput", "setting event listeners");

      this._input.addEventListener("change", e => {
        console.log("FilePicker", "pickWithInput", "change", e);
        var files = this._input.files;
        if (!files || files.length == 0) {
          // No files opened, nothing to do
          return;
        }

        this.notifications.notify("file:open", { file: files[0] });
      });
      this._input.addEventListener("click", e => {
        // Since we are going to simulate a click, let's make sure
        // that we do not loop.
        e.stopPropagation();
      });
      console.log("FilePicker", "pickWithInput", "ready");
    }
    this._input.click();
  }
};

return FilePicker;

});
