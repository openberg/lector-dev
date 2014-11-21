define(["js/notifications"],
  function(Notifications) {

/**
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
    input.click();
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
