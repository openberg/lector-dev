define(["js/notifications"],
  function(Notifications) {

/**
 * A control used to pick a file.
 *
 * @param {Element} element The DOM element to use for the control.
 * @param {Array} mimetypes The accepted mime types.
 * @constructor
 */
function FilePicker(element, mimetypes) {
  /**
   * Instances of FilePicker notify of the following events:
   * - file:open ({file: File}) A file has been picked.
   * - file:nopicker (null) Could not pick a file, generally
   *    because no file picker has been installed.
   */
  this.notifications = new Notifications(["file:open", "file:nopicker"]);

  if (!Array.isArray(mimetypes)) {
    throw new TypeError("Expected an array of strings");
  }

  // The container element
  this._element = element;

  // The list of accepted mime types
  this._mimetypes = mimetypes;

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
    var activity = new MozActivity({
      name: "pick",
      data: {
        type: this._mimetypes
      }
    });
    activity.onsuccess = () => {
      console.log("filepicker", "picked", activity.result);
      this.notifications.notify("file:open", { file: activity.result.blob });
    };
    activity.onerror = () => {
      console.log("filepicker", "we could not pick a file");
      this.notifications.notify("file:nopicker", null);
    };
  },

  /**
   * Use a hidden <input type="file"> to request a file from the system.
   */
  pickWithInput: function() {
    if (!this._input) {
      // Create a hidden <inpyt type="file">
      this._input = document.createElement("input");
      this._input.setAttribute("type", "file");

      // Set the types of files that it accepts
      this._input.setAttribute("accept", this._mimetypes.join(", "));
      this._input.classList.add("hidden_input_file");
      this._element.appendChild(this._input);

      this._input.addEventListener("change", e => {
        var files = this._input.files;
        if (!files || files.length == 0) {
          // No files opened, nothing to do
          return;
        }

        this.notifications.notify("file:open", { file: files[0] });
      });
    }
    this._input.click();
  }
};

return FilePicker;

});
