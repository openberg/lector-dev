window.define(function() {
"use strict";

function Menu(elt, textarea = null) {
  this.element = elt;
  this.textarea = textarea || elt;
  this._hiding = null;
  this._showing = null;
  this._textIsInvisible = false;
  this._autoHideTimeout = null;
}
Menu.prototype = {
  _afterTransition: function() {
    var elt = this.element;
    return new Promise(resolve => {
      elt.addEventListener("transitionend", function observer() {
        elt.removeEventListener("transitionend", observer);
        resolve();
      });
    });
  },
  showText: function(text) {
    var elt = this.element;
    if (elt.classList.contains("hidden")) {
      // The menu is invisible, just change the text
      // and display the menu.
      this.textarea.textContent = text;
      this.show();
      return;
    }

    // The menu is visible or will shortly be.
    // Let's make sure that it's not going to hide immediately.
    this.autoHide();
    var promise;
    if (elt.classList.contains("hidden_text")) {
      // Text is already invisible, or will shortly be.
      if (this._textIsInvisible) {
        promise = Promise.resolve();
      } else {
        promise = this._afterTransition();
      }
    } else {
      // Text is visible, let's make it invisible first.
      elt.classList.add("hidden_text");
      promise = this._afterTransition();
      promise = promise.then(() => {
        this._textIsInvisible = true;
      });
    }
    promise = promise.then(() => {
      elt.textContent = text;
      elt.classList.remove("hidden_text");
      this.autoHide();
      return this._afterTransition(() => {
        this._textIsInvisible = false;
      });
    });
    return promise;
  },
  show: function() {
    console.log("Menu", "show", this.element.id);
    if (this._showing) {
      return this._showing;
    }
    var elt = this.element;
    elt.classList.remove("hidden");
    this._hiding = null;
    return this._showing = new Promise(resolve => {
      elt.addEventListener("transitionend", function observer() {
        elt.removeEventListener("transitionend", observer);
        this.autoHide();
        resolve();
      }.bind(this));
    });
  },
  hide: function() {
    this._autoHideTimeout = null;
    if (this._hiding) {
      return this._hiding;
    }
    var elt = this.element;
    elt.classList.add("hidden");
    this._showing = null;
    return this._hiding = new Promise(resolve => {
      elt.addEventListener("transitionend", function observer() {
        elt.removeEventListener("transitionend", observer);
        resolve();
      });
    });
  },
  autoHide: function() {
    if (this._autoHideTimeout) {
      console.log("Postponing auto-hide");
      window.clearTimeout(this._autoHideTimeout);
    }
    this._autoHideTimeout = window.setTimeout(() => {
      console.log("Auto-hiding");
      this.hide();
    }, 3000);
  },
};

return Menu;

});
