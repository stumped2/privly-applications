/**
 * @fileOverview Manages the form interaction with remote servers.
 **/

 /**
  * The callbacks assign the state of the application.
  *
  * This application can be placed into the following states:
  * 1. Pending Login Check: The app is currently requesting the CSRF
  *    token from the remote server. Callback=pendingLogin
  * 2. Failure to login: The user is not currently authenticated with the
  *    remote server. In this state the user is prompted to login.
  *    Callback=loginFailure
  * 3. Pending post: The user can make the post at this point.
  *    Callback=pendingPost
  * 4. submit: the user has submitted the posting form.
  *    Callback=submit
  * 5. Completed post: The remote server has returned a URL. This app should
  *    display it and fire the URL event.
  *    Callback=postCompleted
  */
 var callbacks = {

   /**
    * Assign the CSRF token if it is a Privly server.
    */
   pendingLogin: function() {
     
     // Set the nav bar to the proper domain
     privlyNetworkService.initializeNavigation();
     
     // Generate the previewed content
     var contentElement = document.getElementById("content");
     contentElement.addEventListener('keyup', previewMarkdown);
     
   },

   /**
    * Prompt the user to sign into their server. This assumes the remote
    * server's sign in endpoint is at "/users/sign_in".
    */
   loginFailure: function() {
     $("#messages").hide();
     $("#login_message").show();
     $("#refresh_link").click(function(){location.reload(true);});
   },

   /**
    * Tell the user they can create their post
    */
   pendingPost: function() {
     
     privlyNetworkService.showLoggedInNav();
     
     // Monitor the submit button
     document.querySelector('#save').addEventListener('click', callbacks.submit);
     $("#save").prop('disabled', false);
     $("#messages").toggle("slow");
     $("#form").toggle("slow");
   },

   /**
    * The user hit the submit button.
    */
   submit: function() {
      var randomkey = sjcl.codec.base64.fromBits(sjcl.random.randomWords(8, 0), 0);
      var cipherdata = zeroCipher(randomkey, $("#content")[0].value);

      var data_to_send = {
        post:{
          structured_content: cipherdata,
          "privly_application":"ZeroBin",
          "public":true,
          "seconds_until_burn": $( "#seconds_until_burn" ).val()
        }};

     function successCallback(response) {
       callbacks.postCompleted(response, randomkey);
     }
     
     privlyNetworkService.sameOriginPostRequest(
       privlyNetworkService.contentServerDomain() + "/posts", 
       successCallback, 
       data_to_send,
       {"format":"json"});
   },

   /**
    * Send the URL to the extension or mobile device if it exists and display
    * it to the end user.
    *
    * @param {response} response The response object returned from the remote server
    * @param {string} randomkey The key used to encrypt the data.
    *
    */
   postCompleted: function(response, randomkey) {
     var url = response.jqXHR.getResponseHeader("X-Privly-Url");
     if( url.indexOf("#") > 0 ) {
       url = url.replace("#", "#privlyLinkKey="+randomkey);
     } else {
       url = url + "#privlyLinkKey=" + randomkey;
     }
     privlyExtension.firePrivlyURLEvent(url);

     $("#messages").text("Copy the address found below to any website you want to share this information through");
     $(".privlyUrl").text(url);
     var localCodeURL = "show.html?privlyOriginalURL=" + encodeURIComponent(url);
     $(".privlyUrl").attr("href", localCodeURL);
     $("#messages").show();
   }
 }


/**
 * Get the CSRF token and starting content for the form element. 
 */
function initPosting() {
  
  // Assign the CSRF token if it is a Privly server. We use the success
  // callback for all callbacks because we don't assume the content
  // server uses the account details endpoint that the Privly content
  // server hosts.
  privlyNetworkService.initPrivlyService(
    privlyNetworkService.contentServerDomain(), 
    callbacks.pendingPost, 
    callbacks.loginFailure, 
    callbacks.loginFailure);
                                         
  // Listener for the extension sending initial content
  privlyExtension.initialContent = function(data) {
    $("#content")[0].value = data.initialContent;
  }
  
  // Once the message pathway is established, it will immediatly ask for any
  // starting content.
  privlyExtension.messageSecret = function(data) {
    privlyExtension.messageExtension("initialContent", "");
  }
  
  // Initialize message pathway to the extension.
  privlyExtension.firePrivlyMessageSecretEvent();
  
  callbacks.pendingLogin();
  
}

/**
 * Display rendered markdown as a preview of the post.
 */
function previewMarkdown() {
  preview.innerHTML = markdown.toHTML(document.getElementById("content").value);
}

document.addEventListener('DOMContentLoaded', initPosting);

//Add listeners to show loading animation while making ajax requests
$(document).ajaxStart(function() {
  $('#loadingDiv').show(); 
});
$(document).ajaxStop(function() { 
  $('#loadingDiv').hide(); 
});
