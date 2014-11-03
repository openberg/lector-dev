window.define(function() {
  "use strict";

  function Observable(events) {
    if (!Array.isArray(events)) {
      throw new TypeError("Expected an Array");
    }
    /**
     * Observers for the events of `this._events`.
     */
    this._observers = new Map();
    for (var k of events) {
      this._observers.set(k, new Set());
    }
  }
  Observable.prototype = {
    addObserver: function(event, observer) {
      var observers = this._observers.get(event);
      if (!observers) {
        throw new TypeError("Incorrect event: " + event);
      }
      observers.add(observer);
    },
    removeObserver: function(event, observer) {
      this._observers.get(event).delete(observer);
    },
    notify: function(event, value) {
      var observers = this._observers.get(event);
      if (!observers) {
        throw new TypeError("Incorrect event: " + event);
      }
      for (var observer of observers) {
        window.setTimeout(function() {
          try {
            observer(value);
          } catch(ex if console.error(ex)) {
            // This should never happen.
          }
        });
      }
    },
  };

  // Module definition
  return Observable;
});
