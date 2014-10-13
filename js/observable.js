window.define(function() {
  "use strict";

  function Observable(events) {
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
      this._observers.get(event).add(observer);
    },
    removeObserver: function(event, observer) {
      this._observers.get(event).delete(observer);    
    },
    notify: function(event, value) {
      for (var observer of this._observers.get(event)) {
        try {
          observer(value);
        } catch(ex if console.error(ex)) {
          // This should never happen.
        }
      }
    },
  };

  // Module definition
  return Observable;
});
