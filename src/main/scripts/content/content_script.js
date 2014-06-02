
/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

/* Variables are kept in the global scopes so addons have access to them in an
 * easy-to-access manner. This should be ok since content scripts have a
 * scope isolated from the page's scope, so just need to be careful that an
 * add-on doesn't pollute the scope. */

var recording = RecordState.STOPPED;
var id = 'setme';
var port; /* port variable to send msgs to content script */

/* Record variables */
var pageEventId = 0; /* counter to give each event on page a unique id */
var lastRecordEvent; /* last event recorded */
var lastRecordSnapshot; /* snapshot (before and after) for last event */
var curRecordSnapshot; /* snapshot (before and after) the current event */

/* Replay variables */
var lastReplayEvent; /* last event replayed */
var lastReplayTarget;
var lastReplaySnapshot; /* snapshop taken before the event is replayed */
var curReplaySnapshot; /* snapshot taken before the next event is replayed */
var dispatchingEvent = false; /* if we currently dispatching an event */
var retryTimeout = null; /* handle to retry callback */
var simulatedEvents = null; /* current events we need are trying to dispatch */
var simulatedEventsIdx = 0;
var timeoutInfo = {startTime: 0, startIndex: 0, events: null};

/* Loggers */
var log = getLog('content');
var recordLog = getLog('record');
var replayLog = getLog('replay');

// ***************************************************************************
// Recording code
// ***************************************************************************

/* Reset all of the record time variables */
function resetRecord() {
  lastRecordEvent = null;
  lastRecordSnapshot = null;
  curRecordSnapshot = null;
}

/* Get the class of an event, which is used to init and dispatch it
 *
 * @param {string} type The DOM event type
 * @returns {string} The class type, such as MouseEvent, etc.
 */
function getEventType(type) {
  for (var eventType in params.events) {
    var eventTypes = params.events[eventType];
    for (var e in eventTypes) {
      if (e === type) {
        return eventType;
      }
    }
  }
  return null;
};

/* Return the default event properties for an event */
function getEventProps(type) {
  var eventType = getEventType(type);
  return params.defaultProps[eventType];
}

/* Find matching event in simulatedEvents. Needed to ensure that an event is
 * not replayed twice, i.e. once by the browser and once by the tool. */
function getMatchingEvent(eventData) {
  if (!dispatchingEvent)
    return null;

  if (simulatedEvents == null ||
      simulatedEventsIdx >= simulatedEvents.length)
    return null;

  var eventObject = simulatedEvents[simulatedEventsIdx];
  var eventRecord = eventObject.value;
  if (eventRecord.data.type == eventData.type) {
    simulatedEventsIdx++;
    return eventObject;
  }

  return null;
}

/* Create an event record given the data from the event handler */
function recordEvent(eventData) {
  /* check if we are stopped, then just return */
  if (recording == RecordState.STOPPED)
    return true;

  var type = eventData.type;
  var dispatchType = getEventType(type);
  var shouldRecord = params.events[dispatchType][type];

  /* cancel the affects of events which are not extension generated or are not
   * picked up by the recorder */
  if (params.replay.cancelUnknownEvents && 
      recording == RecordState.REPLAYING && !dispatchingEvent) {
    recordLog.debug('[' + id + '] cancel unknown event during replay:',
         type, dispatchType, eventData);
    eventData.stopImmediatePropagation();
    eventData.preventDefault();
    return false;
  }

  if (params.record.cancelUnrecordedEvents &&
      recording == RecordState.RECORDING && !shouldRecord) {
    recordLog.debug('[' + id + '] cancel unrecorded event:', type, 
        dispatchType, eventData);
    eventData.stopImmediatePropagation();
    eventData.preventDefault();
    return false;
  }

  /* if we are not recording this type of event, we should exit */
  if (!shouldRecord)
    return true;

  /* continue recording the event */
  recordLog.debug('[' + id + '] process event:', type, dispatchType,
      eventData);
  sendAlert('Recorded event: ' + type);

  var properties = getEventProps(type);
  var target = eventData.target;
  var nodeName = target.nodeName.toLowerCase();

  var eventMessage = {
    frame: {},
    data: {},
    timing: {},
    meta: {}
  };

  /* deal with all the replay mess that we can't do in simulate */
  if (recording == RecordState.REPLAYING)
    replayUpdateDeltas(eventData, eventMessage);

  /* deal with snapshotting the DOM, calculating the deltas, and sending
   * updates */
  updateDeltas(target);

  eventMessage.data.target = saveTargetInfo(target, recording);
  eventMessage.frame.URL = document.URL;
  eventMessage.meta.dispatchType = dispatchType;
  eventMessage.meta.nodeName = nodeName;
  eventMessage.meta.pageEventId = pageEventId++;
  eventMessage.meta.recordState = recording;

  var data = eventMessage.data;
  /* record all properties of the event object */
  if (params.recording.allEventProps) {
    for (var prop in eventData) {
      try {
        var value = eventData[prop];
        var t = typeof(value);
        if (t == 'number' || t == 'boolean' || t == 'string' || 
            t == 'undefined') {
          data[prop] = value;
        } else if (prop == 'relatedTarget' && isElement(value)) {
          data[prop] = saveTargetInfo(value, recording);
        }
      } catch (err) {
        recordLog.error('[' + id + '] error recording property:', prop, err);
      }
    }
  /* only record the default event properties */
  } else {
    for (var prop in properties) {
      if (prop in eventData)
        data[prop] = eventData[prop];
    }
  }

  /* save the event record */
  recordLog.debug('[' + id + '] saving event message:', eventMessage);
  port.postMessage({type: 'dom', value: eventMessage, state: recording});
  lastRecordEvent = eventMessage;

  /* check to see if this event is part of a cascade of events. we do this 
   * by setting a timeout, which will execute after the cascade of events */
  setTimeout(function() {
    var update = {
      type: 'updateEvent',
      value: {
        meta: {
          endEventId: lastRecordEvent.meta.pageEventId,
          pageEventId: eventMessage.meta.pageEventId
        }
      },
      state: recording
    };
    port.postMessage(update);
  }, 0);

  // TODO: special case with mouseover, need to return false
  return true;
};

/* Fix deltas that did not occur during replay */
function replayUpdateDeltas(eventData, eventMessage) {
  var replayEvent = getMatchingEvent(eventData);
  if (replayEvent) {

    replayEvent.replayed = true;
    replayEvent = replayEvent.value;

    eventMessage.meta.recordId = replayEvent.meta.id;
    var target = eventData.target;
    snapshotReplay(target);

    /* make sure the deltas from the last event actually happened */
    if (params.synthesis.enabled && lastReplayEvent) {
      var recordDeltas = lastReplayEvent.meta.deltas;
      if (typeof recordDeltas == 'undefined') {
        recordLog.error('no deltas found for last event:', lastReplayEvent);
        recordDeltas = [];
      }

      /* make sure replay matches recording */
      if (lastReplaySnapshot) {
        var replayDeltas = getDeltas(lastReplaySnapshot.before,
                                     lastReplaySnapshot.after);
        /* check if these deltas match the last simulated event
         * and correct for unmatched deltas */
        fixDeltas(recordDeltas, replayDeltas, lastReplayTarget);
      }

      /* Resnapshot to record the changes caused by fixing the deltas */
      resnapshotBefore(target);
    }
    lastReplayEvent = replayEvent;
    lastReplayTarget = target;
  }
}

/* Create a snapshot of the target element */
function snapshotRecord(target) {
  if (params.localSnapshot) {
    lastRecordSnapshot = curRecordSnapshot;
    if (lastRecordSnapshot)
      lastRecordSnapshot.after = snapshotNode(lastRecordSnapshot.target);

    curRecordSnapshot = {before: snapshotNode(target), target: target};
  } else {
    var curSnapshot = snapshot();

    lastRecordSnapshot = curRecordSnapshot;
    if (lastRecordSnapshot)
      lastRecordSnapshot.after = curSnapshot;

    curRecordSnapshot = {before: curSnapshot};
  }
}

/* Update the deltas for the previous event */
function updateDeltas(target) {
  snapshotRecord(target);

  if (lastRecordEvent && lastRecordSnapshot) {
    var deltas = getDeltas(lastRecordSnapshot.before,
                           lastRecordSnapshot.after);
    lastRecordEvent.deltas = deltas;
    var update = {
      type: 'updateEvent',
      value: {
        meta: {
          deltas: deltas,
          nodeSnapshot: snapshotNode(lastRecordSnapshot.target),
          pageEventId: lastRecordEvent.meta.pageEventId
        }
      },
      state: recording
    };
    port.postMessage(update);
  }
}

// ***************************************************************************
// Replaying code
// ***************************************************************************

/* Needed since some event properties are marked as read only */
function setEventProp(e, prop, value) {
  Object.defineProperty(e, prop, {value: value});
  if (e.prop != value) {
    Object.defineProperty(e, prop, {get: function() {value}});
    Object.defineProperty(e, prop, {value: value});
  }
}

/* Check if the current event has timed out.
 *
 * @params events The current list of events to replay.
 * @params startIndex The index into @link{events} which is needs to be
 *     replayed.
 * @returns {boolean} True if timeout has occured
 */
function checkTimeout(events, startIndex) {
  var timeout = params.replay.targetTimeout;
  if (timeout != null && timeout > 0) {
    var curTime = new Date().getTime();

    /* we havent changed event */
    if (timeoutInfo.events == events &&
        timeoutInfo.startIndex == startIndex) {
      if (curTime - timeoutInfo.startTime > timeout * 1000)
        return true;
    } else {
      timeoutInfo = {startTime: curTime, startIndex: startIndex,
                     events: events};
    }
  }
  return false;
}

/* Replays a set of events atomically
 *
 * @params events The current list of events to replay.
 * @params startIndex The index into @link{events} which is needs to be
 *     replayed.
 */
function simulate(events, startIndex) {
  /* since we are simulating new events, lets clear out any retries from
   * the last request */
  clearRetry();

  simulatedEvents = events;
  simulatedEventsIdx = 0;

  for (var i = startIndex, ii = events.length; i < ii; ++i) {
    var eventRecord = events[i].value;
    var eventData = eventRecord.data;
    var eventName = eventData.type;

    var id = eventRecord.meta.id;

    /* this event was detected by the recorder, so lets skip it */
    if (params.replay.cascadeCheck && events[i].replayed)
      continue;

    replayLog.debug('simulating:', eventName, eventData);

    var targetInfo = eventData.target;
    var xpath = targetInfo.xpath;

    /* find the target */
    var target = getTarget(targetInfo);
    if (params.benchmarking.targetInfo) {
      var actualTargets = getTargetFunction(targetInfo);

      for (var strategy in targetFunctions) {
        var strategyTargets = targetFunctions[strategy](targetInfo);
        var common = actualTargets.filter(function(t) {
          return strategyTargets.indexOf(t) != -1;
        });
      }
    }

    /* if no target exists, lets try to dispatch this event a little bit in
     *the future, and hope the page changes */
    if (!target) {
      if (checkTimeout(events, i)) {
        replayLog.warn('timeout finding target, skip event: ', events, i);
        // we timed out with this target, so lets skip the event
        i++;
      }

      setRetry(events, i, params.replay.defaultWait);
      return;
    }

    if (params.replay.highlightTarget) {
      highlightNode(target, 100);
    }

    /* If capture event, then scrape data */
    if (eventName == 'capture') {
      replayLog.log('found capture node:', target);

      var msg = {innerHtml: target.innerHTML,
                 innerText: target.innerText,
                 nodeName: target.nodeName.toLowerCase(),
                 id: id};

      port.postMessage({type: 'saveCapture', value: msg, state: recording});
      continue;
    }

    /* Create an event object to mimick the recorded event */
    var eventType = getEventType(eventName);
    var defaultProperties = getEventProps(eventName);

    if (!eventType) {
      replayLog.error("can't find event type ", eventName);
      return;
    }

    var options = jQuery.extend({}, defaultProperties, eventData);

    var oEvent = document.createEvent(eventType);
    if (eventType == 'Event') {
      oEvent.initEvent(eventName, options.bubbles, options.cancelable);
    } else if (eventType == 'FocusEvent') {
      var relatedTarget = null;

      if (eventData.relatedTarget)
        relatedTarget = getTarget(eventData.relatedTarget);

      oEvent.initUIEvent(eventName, options.bubbles, options.cancelable,
          document.defaultView, options.detail);
      setEventProp(oEvent, 'relatedTarget', relatedTarget);
    } else if (eventType == 'MouseEvent') {
      var relatedTarget = null;

      if (eventData.relatedTarget)
        relatedTarget = getTarget(eventData.relatedTarget);

      oEvent.initMouseEvent(eventName, options.bubbles, options.cancelable,
          document.defaultView, options.detail, options.screenX,
          options.screenY, options.clientX, options.clientY,
          options.ctrlKey, options.altKey, options.shiftKey, options.metaKey,
          options.button, relatedTarget);
    } else if (eventType == 'KeyboardEvent') {
      // TODO: nonstandard initKeyboardEvent
      oEvent.initKeyboardEvent(eventName, options.bubbles, options.cancelable,
          document.defaultView, options.keyIdentifier, options.keyLocation,
          options.ctrlKey, options.altKey, options.shiftKey, options.metaKey);

      var propsToSet = ['charCode', 'keyCode'];

      for (var j = 0, jj = propsToSet.length; j < jj; ++j) {
        var prop = propsToSet[j];
        setEventProp(oEvent, prop, options[prop]);
      }

    } else if (eventType == 'TextEvent') {
      oEvent.initTextEvent(eventName, options.bubbles, options.cancelable,
          document.defaultView, options.data, options.inputMethod,
          options.locale);
    } else {
      replayLog.error('unknown type of event');
    }

    /* used to detect extension generated events */
    oEvent.extensionGenerated = true;
    if (eventData.cascading) {
      oEvent.cascading = eventData.cascading;
      oEvent.cascadingOrigin = eventData.cascadingOrigin;
    }

    replayLog.debug('[' + id + '] dispatchEvent', eventName, options, target,
                    oEvent);

    /* send the update to the injected script so that the event can be 
     * updated on the pages's context */
    var detail = {};
    for (var prop in oEvent) {
      var data = oEvent[prop];
      var type = typeof(data);

      if (type == 'number' || type == 'boolean' || type == 'string' ||
          type == 'undefined') {
        detail[prop] = data;
      } else if (prop == 'relatedTarget' && isElement(data)) {
        detail[prop] = nodeToXPath(data);
      }
    }
    document.dispatchEvent(new CustomEvent('webscript', {detail: detail}));

    /* update panel showing event was sent */
    sendAlert('Dispatched event: ' + eventData.type);

    /* actually dispatch the event */ 
    dispatchingEvent = true;
    target.dispatchEvent(oEvent);
    dispatchingEvent = false;
  }
  /* let the background page know that all the events were replayed (its
   * possible some/all events were skipped) */
  port.postMessage({type: 'ack', value: {type: Ack.SUCCESS}, state: recording});
  replayLog.debug('[' + id + '] sent ack');
}

/* Stop the next execution of simulate */
function clearRetry() {
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }
}

/* Try simulating again in a little bit */
function setRetry(events, startIndex, timeout) {
  retryTimeout = setTimeout(function() {
    simulate(events, startIndex);
  }, timeout);
  return;
}

/* Take a snapshot of the target */
function snapshotReplay(target) {
  replayLog.log('snapshot target:', target);
  if (params.localSnapshot) {
    lastReplaySnapshot = curReplaySnapshot;
    if (lastReplaySnapshot)
      lastReplaySnapshot.after = snapshotNode(lastReplaySnapshot.target);

    curReplaySnapshot = {before: snapshotNode(target), target: target};
  } else {
    var curSnapshot = snapshot();

    lastReplaySnapshot = curReplaySnapshot;
    if (lastReplaySnapshot)
      lastReplaySnapshot.after = curSnapshot;

    curReplaySnapshot = {before: curSnapshot};
  }
}

/* Update the snapshot */
function resnapshotBefore(target) {
  if (params.localSnapshot)
    curReplaySnapshot.before = snapshotNode(target);
  else
    curReplaySnapshot.before = snapshot();
}

/* Update the lastTarget, so that the record and replay deltas match */
function fixDeltas(recordDeltas, replayDeltas, lastTarget) {
  replayLog.info('record deltas:', recordDeltas);
  replayLog.info('replay deltas:', replayDeltas);

  /* effects of events that were found in record but not replay */
  var recordDeltasNotMatched = filterDeltas(recordDeltas, replayDeltas);
  /* effects of events that were found in replay but not record */
  var replayDeltasNotMatched = filterDeltas(replayDeltas, recordDeltas);

  replayLog.info('record deltas not matched: ', recordDeltasNotMatched);
  replayLog.info('replay deltas not matched: ', replayDeltasNotMatched);

  var element = lastTarget;

  for (var i = 0, ii = replayDeltasNotMatched.length; i < ii; ++i) {
    var delta = replayDeltasNotMatched[i];
    replayLog.debug('unmatched replay delta', delta);

    if (delta.type == 'Property is different.') {
      var divProp = delta.divergingProp;
      if (params.replay.compensation == Compensation.FORCED) {
        element[divProp] = delta.orig.prop[divProp];
      }
    }
  }

  /* the thing below is the stuff that's doing divergence synthesis */
  for (var i = 0, ii = recordDeltasNotMatched.length; i < ii; ++i) {
    var delta = recordDeltasNotMatched[i];
    replayLog.debug('unmatched record delta', delta);

    if (delta.type == 'Property is different.') {
      var divProp = delta.divergingProp;
      if (params.replay.compensation == Compensation.FORCED) {
        element[divProp] = delta.changed.prop[divProp];
      }
    }
  }
}

// ***************************************************************************
// Capture code
// ***************************************************************************

var domOutline = DomOutline({
    borderWidth: 2,
    onClick: onClickCapture
  }
);

var domOutlineCallback = null;

function startCapture(callback) {
  domOutlineCallback = callback;
  domOutline.start();
}

function cancelCapture() {
  domOutlineCallback = null;
  domOutline.stop();
}

function onClickCapture(node, event) {
  var callback = domOutlineCallback;
  if (callback) {
    domOutlineCallback = null;
    callback(node, event);
  }
}

function captureNode() {
  if (recording == RecordState.RECORDING) {
    log.log('starting node capture');
    startCapture(captureNodeReply);
  }
}

function cancelCaptureNode() {
  cancelCapture();
}

function captureNodeReply(target, event) {
  var eventMessage = {
    data: {},
    frame: {},
    meta: {},
    timing: {}
  };

  eventMessage.data.target = saveTargetInfo(target, recording);
  eventMessage.data.timeStamp = new Date().getTime();
  eventMessage.frame.URL = document.URL;
  eventMessage.meta.nodeName = target.nodeName.toLowerCase();
  eventMessage.meta.recordState = recording;

  log.log('capturing:', target, eventMessage);
  port.postMessage({type: 'capture', value: eventMessage, state: recording});

  event.preventDefault();
  event.stopImmediatePropagation();
}

// ***************************************************************************
// Misc code
// ***************************************************************************

var highlightCount = 0;

/* Highlight a node with a green rectangle. Uesd to indicate the target. */
function highlightNode(target, time) {
  var offset = $(target).offset();
  var boundingBox = target.getBoundingClientRect();
  var newDiv = $('<div/>');
  var idName = 'sbarman-hightlight-' + highlightCount;
  newDiv.attr('id', idName);
  newDiv.css('width', boundingBox.width);
  newDiv.css('height', boundingBox.height);
  newDiv.css('top', offset.top);
  newDiv.css('left', offset.left);
  newDiv.css('position', 'absolute');
  newDiv.css('z-index', 1000);
  newDiv.css('background-color', '#00FF00');
  newDiv.css('opacity', .4);
  $(document.body).append(newDiv);

  if (time) {
    setTimeout(function() {
      dehighlightNode(idName);
    }, 100);
  }

  return idName;
}

function dehighlightNode(id) {
  $('#' + id).remove();
}


/* Send an alert that will be displayed in the main panel */
function sendAlert(msg) {
  port.postMessage({type: 'alert', value: msg, state: recording});
}

/* Update the parameters for this scripts scope */
function updateParams(newParams) {
  var oldParams = params;
  params = newParams;

  var oldEvents = oldParams.events;
  var events = params.events;

  /* if we are listening to all events, then we don't need to do anything since
   * we should have already added listeners to all events at the very
   * beginning */
  if (params.recording.listenToAllEvents)
    return;

  for (var eventType in events) {
    var listOfEvents = events[eventType];
    var oldListOfEvents = oldEvents[eventType];
    for (var e in listOfEvents) {
      if (listOfEvents[e] && !oldListOfEvents[e]) {
        log.log('[' + id + '] extension listening for ' + e);
        document.addEventListener(e, recordEvent, true);
      } else if (!listOfEvents[e] && oldListOfEvents[e]) {
        log.log('[' + id + '] extension stopped listening for ' + e);
        document.removeEventListener(e, recordEvent, true);
      }
    }
  }
}

var handlers = {
  'recording': function(v) {
    recording = v;
  },
  'params': updateParams,
  'event': function(v) {
    simulate(v, 0);
  },
  'updateDeltas': updateDeltas,
  'reset': resetRecord,
  'url': function() {
    port.postMessage({type: 'url', value: document.URL, state: recording});
  },
  'capture': captureNode,
  'cancelCapture': cancelCaptureNode,
  'pauseReplay': clearRetry,
};

/* Handle messages coming from the background page */
function handleMessage(request) {
  var type = request.type;

  log.log('[' + id + '] handle message:', request, type);

  var callback = handlers[type];
  if (callback) {
    callback(request.value);
  } else {
    log.error('cannot handle message:', request);
  }
}

/* Attach the event handlers to their respective events */
function addListenersForRecording() {
  var events = params.events;
  for (var eventType in events) {
    var listOfEvents = events[eventType];
    for (var e in listOfEvents) {
      listOfEvents[e] = true;
      document.addEventListener(e, recordEvent, true);
    }
  }
};


/* We need to add all the events now before and other event listners are
 * added to the page. We will remove the unwanted handlers once params is
 * updated */
addListenersForRecording();

/* need to check if we are in an iframe */
var value = {};
value.top = (self == top);
value.URL = document.URL;

/* Add all the other handlers */
chrome.runtime.sendMessage({type: 'getId', value: value}, function(resp) {
  id = resp.value;
  port = new Port(id);
  port.addListener(handleMessage);

  // see if recording is going on
  port.postMessage({type: 'getParams', value: null, state: recording});
  port.postMessage({type: 'getRecording', value: null, state: recording});
});

var pollUrlId = window.setInterval(function() {
  if (value.URL != document.URL) {
    var url = document.URL;
    value.URL = url;
    port.postMessage({type: 'url', value: url, state: recording});
    log.log('url change: ', url);
  }
}, 1000);

function injectScript(path) {
  // inject code into the pages domain
  var s = document.createElement('script');
  s.src = chrome.extension.getURL(path);
  s.onload = function() {
    this.parentNode.removeChild(this);
  };
  (document.head || document.documentElement).appendChild(s);
}

// TODO(sbarman): need to wrap these so variables don't escape into the
// enclosing scope
injectScript('scripts/common/params.js');
injectScript('scripts/content/misc.js');
injectScript('scripts/content/injected.js');