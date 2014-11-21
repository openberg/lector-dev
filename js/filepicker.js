define(["js/notifications"],
  function(Notifications) {

/**
 * A control used to pick a file.
 *
 * @param {Element} element The DOM element
 * @constructor
 */
function FilePicker(element) {
  this.notifications = new Notifications(["file:open"]);
  this._element = element;

  var input = document.createElement("input");
  input.setAttribute("type", "file");
  input.classList.add("hidden_input_file");
  element.appendChild(input);
  this._input = input;

  element.addEventListener("click", e => {
    e.stopPropagation();

    if ("MozActivity" in window) {
      // Firefox OS or Android – use an activity,
      // this will provide better results.
      var activity = new MozActivity({
        name: "pick",
        data: {
          type: "application/epub+zip"
        }
      });
      activity.onsuccess = function() {
        console.log("MozActivity", "picked", this.result);
        
      };
    } else {
      input.click();
    }
  });

  input.addEventListener("change", e => {
    var files = input.files;
    if (!files || files.length == 0) {
      // No files opened, nothing to do
      return;
    }

    this.notifications.notify("file:open", { file: files[0] });
  });
}

return FilePicker;

});
