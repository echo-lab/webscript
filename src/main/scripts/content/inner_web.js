//document.body.style.backgroundColor = 'red';



//var script = document.createElement('script');
//script.src = '//code.jquery.com/jquery-1.11.0.min.js';
//document.getElementsByTagName('head')[0].appendChild(script);

var button_style = "padding: 4px 7px;text-align: center;text-decoration: none;display: inline-block;border: 2px solid;border-radius: 5px;font-size: 16px;margin: 4px 2px;cursor: pointer;"
document.body.innerHTML +='<div class="Remo-notification" style="border-radius: 5px;width: 300px;top: 5px;right: 5px;opacity: 100;background-color: #ccc;z-index: 100000;position: absolute;padding: 10px;text-decoration: none;font-family: sans-serif;font-size: medium;text-align: center;"> <div class="lw-title">Remo Available</div><div id = "lw-button-wrapper" class ="lw_buttons"><button class="lw_button_enable" style="'+button_style+'background-color:#33ff77">Enable</button><button class="lw_button_nope" style="'+button_style+'">Stop</button><div style="text-align:left; font-size:10px;"></div></div>';



function handleMessage(request) {
  var type = request.type;
  console.log("Request");
  console.log(request);
  alert("I heard something.");
}

window.addEventListener("message", handleMessage, false);

//$("body").append(notification);

//var url = chrome.extension.getURL('main/pages/toolbar.html');

//var height ='40px';



//document.body.innerHTML +='<div class="Remo-notification" style="border-radius: 5px;width: 300px;top: 5px;right: 5px;opacity: 0;background-color: #ccc;z-index: 100000;position: absolute;padding: 10px;text-decoration: none;font-family: sans-serif;font-size: medium;text-align: center;"> <div class="lw-title">Remo Available</div><div id = "lw-button-wrapper" class ="lw_buttons"><button class="lw_button_enable" style="'+button_style+'background-color:#33ff77">Enable</button><button class="lw_button_nope" style="'+button_style+'">Stop</button><div style="text-align:left; font-size:10px;"></div></div>';



//document.body.innerHTML +='<div class="Remo-notification" style="border-radius: 5px;width: 300px;top: 5px;right: 5px;opacity: 0;background-color: #ccc;z-index: 100000;position: absolute;padding: 10px;text-decoration: none;font-family: sans-serif;font-size: medium;text-align: center;"> <div class="lw-title">Remo Available</div><div id = "lw-button-wrapper" class ="lw_buttons"><button class="lw_button_enable" style="'+button_style+'background-color:#33ff77">Enable</button><button class="lw_button_nope" style="'+button_style+'">Stop</button><div style="text-align:left; font-size:10px;"></div></div>';




//var iframe = "<iframe src ='"+ url +"' id ='myOwnCustomFirstToolBar' style ='height:"+ height +"'></iframe>";
//var divTemp = "<div>Hello Inner Web </div>"


//document.body.innerHTML += "<div style='width:100px;height:100px;background-color:blue;position:fixed;right:10px;top:10px;z-index:100'> hello redbox</div>";

//add the header
//$('html').append(divTemp);

//move the body 30px down
//$('body').css({
	//'-webkit-transform': 'translateY('+height+')'
	//});






 // document.body.style.background = 'red';


// document.body.onload = addElement;

// function addElement () {
//   // create a new div element
//   var newDiv = document.createElement("div");
//   // and give it some content
//   var newContent = document.createTextNode("THE RECORDING IS ON ...");
//   // add the text node to the new div
//   newDiv.appendChild(newContent);
//   // add the newelement
//   var currentDiv = document.getElementById("head");
//   document.body.insertBefore(newDiv, currentDiv);
// }
// alert("hi")
// console.log("shh")

//document.body.style.background = 'green';

//(function() {
  /**
   * 
   * If meesage box is there already, do nothing next time
   */
  //if (window.hasRun) {
    //return;
  //}
  //window.hasRun = true;

  /**
   * insert the message box into the document.
   */
  //function insertNotification(beastURL) {
    
	  //}

  /**
   * Remove the message box from the page.
   */
  //function removeExistingNotification() {
  
	  //}

  /**
   * Listen for messages from the background script.
   * "start; pause; reply ...."
  */
  //browser.runtime.onMessage.addListener((message) => {
    //if (message.command === "start") {
		
		//} else if (message.command === "pause") {
      
    //} else if (message.command === "reply") {
      
		//}
	
  //});

  //})();
