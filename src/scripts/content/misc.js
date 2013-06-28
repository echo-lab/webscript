/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

// ***************************************************************************
// DOM functions
// ***************************************************************************

function nodeToXPath(element) {
//  we want the full path, not one that uses the id since ids can change
//  if (element.id !== '')
//    return 'id("' + element.id + '")';
  if (element.tagName.toLowerCase() === 'html')
    return element.tagName;

  // if there is no parent node then this element has been disconnected
  // from the root of the DOM tree
  if (!element.parentNode)
    return "";

  var ix = 0;
  var siblings = element.parentNode.childNodes;
  for (var i = 0, ii = siblings.length; i < ii; i++) {
    var sibling = siblings[i];
    if (sibling === element)
      return nodeToXPath(element.parentNode) + '/' + element.tagName +
             '[' + (ix + 1) + ']';
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName)
      ix++;
  }
}

// convert an xpath expression to an array of DOM nodes
function xPathToNodes(xpath) {
  try {
    var q = document.evaluate(xpath, document, null, XPathResult.ANY_TYPE,
                              null);
    var results = [];

    var next = q.iterateNext();
    while (next) {
      results.push(next);
      next = q.iterateNext();
    }
    return results;
  } catch (e) {
    getLog('misc').error('xPath throws error when evaluated', xpath); 
  }

  // error was thrown, attempt to just walk down the dom tree
  var currentNode = document.documentElement;
  var paths = xpath.split('/');
  // assume first path is "HTML"
  paths: for (var i = 1, ii = paths.length; i < ii; ++i) {
    var children = currentNode.children;
    var path = paths[i];
    var splits = path.split(/\[|\]/)

    var tag = splits[0];
    if (splits.length > 1) {
      var index = parseInt(splits[1]);
    } else {
      var index = 1;
    }

    var seen = 0;
    children: for (var j = 0, jj = children.length; j < jj; ++j) {
      var c = children[j];
      if (c.tagName == tag) {
        seen++;
        if (seen == index) {
          currentNode = c;
          continue paths;
        }
      }
    }
    throw "Cannot find child";
  }
  return [currentNode];
}

function xPathToNode(xpath) {
  var nodes = xPathToNodes(xpath);
  //if we don't successfully find nodes, let's alert
  if (nodes.length != 1)
    throw 'xpath has more than 1 node';

  return nodes[0];
}


// ***************************************************************************
// Server functions
// ***************************************************************************

function addComment(name, value) {
  port.postMessage({type: 'comment', value: {name: name, value: value}});
}

//function for sending an alert that the user will see
function sendAlert(msg) {
  port.postMessage({type: 'message', value: msg});
}
