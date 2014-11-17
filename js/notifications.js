window.define(function() {
  "use strict";


  /**
   * A simple mechanism to send/receive notifications.
   *
   * Components which need to send custom events should offer a field
   * `notifications`, which is an instance of `Notifications`. Clients may
   * then registered to be notified whenever an event takes place,
   * e.g.
   * ````js
   * viewer.notifications.addObserver("pagechange", function(event) {
   *   console.log("I have just been informed of a pagechange", event);
   * });
   * ````
   *
   * @param {Array<string>} events The kind of events that this component
   * may send.
   */
  function Notifications(events) {
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
  Notifications.prototype = {
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
          } catch(ex if console.error("Error during notification", event, ex)) {
            // This should never happen.
          }
        });
      }
    },
  };

  // Module definition
  return Notifications;
});
