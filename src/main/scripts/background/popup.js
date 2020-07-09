// chrome.browserAction.onClicked.addListener(function() {
// 	chrome.tabs.executeScript(null, {file: 'inner_web.js'});
// });
	
	//post message 
	//add event listener 
	var btn = document.getElementById("Start");

	btn.onclick = function() {
		chrome.tabs.executeScript(null, {file: 'main/scripts/content/inner_web.js'});
	}
	
	


	  
	  
  	var btn = document.getElementById("Stop");

  	btn.onclick = function() {
  		//chrome.tabs.executeScript(null, {file: 'main/scripts/content/stop_btn.js'});
		window.postMessage({type:"hello"});
  	}


  	// var btn = document.getElementById("Reply");
	//
	//   	btn.onclick = function() {
	//   		chrome.tabs.executeScript(null, {file: 'main/scripts/content/reply_btn.js'});
	//   	  }


// Get DOM Elements
//const modal = document.querySelector('#my-modal');
//const modalBtn = document.querySelector('#modal-btn');
//const closeBtn = document.querySelector('.close');

// Events
//modalBtn.addEventListener('click', openModal);
//closeBtn.addEventListener('click', closeModal);
//window.addEventListener('click', outsideClick);

//var btn = document.getElementById("Start");

//btn.onclick = function() {
  //var x = document.getElementById('myDIV');
  //if (x.style.display === 'none') {
    //x.style.display = 'block';
  //} else {
    //x.style.display = 'none';
  //}
  //}
//*
// Close
//function closeModal() {
  //modal.style.display = 'none';
  //}

// Close If Outside Click
//function outsideClick(e) {
  //if (e.target == modal) {
   // modal.style.display = 'none';
  //}
  //}

//function listenForClicks() {
    //document.addEventListener("click", (e) => {

      /**
       * 
       */
      //function clickButtons(buttonName) {
        
		  //}

      /**
       * Insert the page-hiding CSS into the active tab,
       * then get the beast URL and
       * send a "beastify" message to the content script in the active tab.
       */
      
    //});
  //}


/**
 * When the popup loads, inject a content script into the active tab,
 * and add a click handler.
 * If we couldn't inject the script, handle the error.
 */
//browser.tabs.executeScript({file: "/content/inner_web.js"})
//.then(listenForClicks)
//.catch(reportExecuteScriptError);


