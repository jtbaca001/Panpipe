/*
Copyright (C) 2013 Micah Losli <micah.losli@gmail.com>

This file is part of Panpipe.

Panpipe is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Panpipe is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with Panpipe.  If not, see <http://www.gnu.org/licenses/>.
*/

.import "Blowfish.js" as Blowfish

/* Private values */
/* Constants */
var HTTPS_ENTRY_POINT = "https://tuner.pandora.com/services/json/";
var HTTP_ENTRY_POINT = "http://tuner.pandora.com/services/json/";
var DECODE_KEY = "R=U!LH$O2B#";
var ENCODE_KEY = "6#26FRL$ZWD";

var CRYPTO_MODE = {};
CRYPTO_MODE.outputType = Blowfish.crypto.outputTypes.Hex;
CRYPTO_MODE.cipherMode = Blowfish.crypto.cipherModes.ECB;


/* Global variables */
var partnerResponse = {};
var userResponse = {};
var userStations = {};

var userStationsString = "";

var currentStation = {};
var currentPlaylist = {};
var currentPlaylistIndex = 0;

var currentSyncTime = 0;
var timeOffset = 0;
var thisDate = new Date();

var musicSearchResult = {};

/* Send / Receive Function */
function transceive(httpMethod, url, method, data, encrypt, callback) {
    var xhr = new XMLHttpRequest;

    /* Add url parameters */
    method = "&method=" + method;
    var urlParameters = "";

    /* partner id */
    if (partnerResponse.partnerId)
    {
        urlParameters = urlParameters + "&partner_id=" + partnerResponse.partnerId;
    }
    /* user id */
    if (userResponse.userId)
    {
        urlParameters = urlParameters + "&user_id=" + userResponse.userId;
    }
    /* authorization token */
    if (userResponse.userAuthToken)
    {
        urlParameters = urlParameters + "&auth_token=" + encodeURIComponent(userResponse.userAuthToken);

    }
    else if (partnerResponse.partnerAuthToken)
    {
        urlParameters = urlParameters + "&auth_token=" + encodeURIComponent(partnerResponse.partnerAuthToken);
    }

    /* Trim off beginning '&' */
    if (urlParameters == "")
    {
        method = method.substring(1);
    }
    else
    {
        urlParameters = urlParameters.substring(1);
    }

    /* Put together the full path */
    var fullUrl = url + "?" + urlParameters + method;

    /* Add sync time and an auth token whenever possible */
    var currentTime = thisDate.getTime();
    currentTime = parseInt(currentTime / 1000);
    data["syncTime"] = currentTime;

    if (userResponse.userAuthToken) {
        data["userAuthToken"] = userResponse.userAuthToken;
    } else if (partnerResponse.partnerAuthToken) {
        data["partnerAuthToken"] = partnerResponse.partnerAuthToken;
    }

    /* Stringify the data */
    data = JSON.stringify(data);

    /* Encrypt the data if appropriate */
    if (encrypt) {
        data = Blowfish.crypto.Blowfish.encrypt(data, ENCODE_KEY, CRYPTO_MODE);
    }

    /* Open the object */
    xhr.open(httpMethod, fullUrl);

    /* Handle state changes */
    xhr.onreadystatechange = function() {
        if (xhr.readyState == XMLHttpRequest.DONE)
        {
            /* Run the callback if there is one */
            if (callback)
            {
                var responseObject = JSON.parse(xhr.responseText);
                callback(responseObject);
            }
        }
    }

    if (data && (httpMethod == "POST"))
    {
        /* log if the data is not a string */
        if (typeof data != "string")
        {
            console.log("data is not in string format!");
        }

        xhr.send(data);
    }
    else
    {
        xhr.send();
    }
}

/* Function to log user in to Pandora */
function connect(username, password, callback) {

    var success = true;

    var connectRequest = {
        "username": "android",
        "password": "AC7IBG09A3DTSYM4R41UJWL07VLN8JI7",
        "deviceModel": "android-generic",
        "version": "5"
    };

    var userRequest = {
        "username": username,
        "password": password,
        "loginType": "user",
        "includeAdAttributes": true,
    };

    /* re-initialize */
    partnerResponse = {};
    userResponse = {};

    console.log("Pandora.connect ran");

    function partnerLogin() {
        transceive("POST",
                   HTTPS_ENTRY_POINT,
                   "auth.partnerLogin",
                   connectRequest,
                   false,
                   userLogin);

    }

    function userLogin(data) {
        /* Store away everything that needs to be kept for later */
        partnerResponse = data.result;

        /* Ensure success */
        if(data.stat != "ok") {
            success = false;
            callback(success);
            return;
        }

        /* Do user login */
        transceive("POST",
                   HTTPS_ENTRY_POINT,
                   "auth.userLogin",
                   userRequest,
                   true,
                   receiveUserResponse);
    }

    function receiveUserResponse(data) {
        /* Store away everything that needs to be kept for later */
        userResponse = data.result;

        /* Ensure success */
        if(data.stat != "ok") {
            success = false;
            callback(success);
            return;
        }
        callback(success);
    }
    /* Start login process */
    partnerLogin();
}

/* Function to get list of user's stations */
function getUserStations(callback) {

    function requestStations() {
        /* Station request */
        var stationsRequest = {
            "includeStationArtUrl": true,
        }

        /* Request stations */
        transceive("POST",
                   HTTP_ENTRY_POINT,
                   "user.getStationList",
                   stationsRequest,
                   true,
                   receiveStationsResponse);
    }

    function receiveStationsResponse(data) {
        /* Store away everything that needs to be kept for later */
        userStationsString = JSON.stringify(data);
        userStations = data.result.stations;

        /* Ensure success */
        if(data.stat != "ok") {
            callback(false);
            return;
        }
        /* Return the list of stations */
        callback(userStations);
    }
    requestStations();
}

/* Function to get data on selected station */
function getStation(stationToken, callback) {

    function requestStation() {
        /* Station request */
        var stationRequest = {
            "stationToken": stationToken,
            "includeExtendedAttributes": true,
        }

        /* Request stations */
        transceive("POST",
                   HTTP_ENTRY_POINT,
                   "station.getStation",
                   stationRequest,
                   true,
                   receiveStationResponse);
    }

    function receiveStationResponse(data) {
        /* Store away everything that needs to be kept for later */
        currentStation = data.result;

        /* Ensure success */
        if(data.stat != "ok") {
            console.log(data);
            callback(false);
            return;
        }
        callback(currentStation);
    }
    requestStation();
}

/* Function to get the playlist of the selected station */
function getStationPlaylist(stationToken, callback) {

    function requestStationPlaylist() {

        /* Station request */
        var stationPlaylistRequest = {
            "stationToken": stationToken,
        }

        /* Request stations */
        transceive("POST",
                   HTTP_ENTRY_POINT,
                   "station.getPlaylist",
                   stationPlaylistRequest,
                   true,
                   receiveStationPlaylistResponse);
    }

    function receiveStationPlaylistResponse(data) {
        /* Store away everything that needs to be kept for later */
        currentPlaylist = data.result.items;

        /* Ensure success */
        if(data.stat != "ok") {
            console.log("Playlist retrieval failed. Status: " + data.stat);
            console.log(JSON.stringify(data));
            callback(false);
            return;
        }
        else {
            console.log("Playlist successfully retrieved.");
        }

        callback(currentPlaylist);
    }
    requestStationPlaylist();
}

/* Function to give feedback */
function sendFeedback(favorable, trackToken, callback) {
    var feedback = {
        "trackToken": trackToken,
        "isPositive": favorable,
    }

    transceive("POST",
               HTTP_ENTRY_POINT,
               "station.addFeedback",
               feedback,
               true,
               null);
}

function retrieveSendFeedbackResponse(data) {
    console.log("feedback response:");
    console.log(JSON.stringify(data));
}

/* Function to search available music */
function searchMusic(queryString, callback) {

    function searchMusicRequest() {
        var search = {
            "searchText": queryString
        }

        transceive("POST",
                   HTTP_ENTRY_POINT,
                   "music.search",
                   search,
                   true,
                   searchMusicResponse);
    }

    function searchMusicResponse(data) {
        musicSearchResult = data.result;

        /* Ensure success */
        if(data.stat != "ok") {
            console.log("Music search failed. Status: " + data.stat);
            console.log(JSON.stringify(data));
            callback(false);
            return;
        }

        callback(musicSearchResult);
    }

    searchMusicRequest();
}

/* Function to set the stations included in the QuickMix */
function setQuickMix(stationIds, callback) {

    function setQuickMixRequest() {
        var stationIdList = {
            "quickMixStationIds": stationIds
        }

        transceive("POST",
                   HTTP_ENTRY_POINT,
                   "user.setQuickMix",
                   stationIdList,
                   true,
                   setQuickMixResponse);
    }

    function setQuickMixResponse(data) {
        /* Ensure success */
        if(data.stat != "ok") {
            console.log("QuickMix update failed. Status: " + data.stat);
            console.log(JSON.stringify(data));
            callback(false);
            return;
        }

        callback(data.stat);
    }

    setQuickMixRequest();
}

/* Function to create a new user station */
function newStation(musicToken, callback) {

    function newStationRequest() {
        var request = {
            "musicToken": musicToken
        }

        transceive("POST",
                   HTTP_ENTRY_POINT,
                   "station.createStation",
                   request,
                   true,
                   newStationResponse);
    }

    function newStationResponse(data) {
        console.log(data);
        if(data.stat != "ok") {
            console.log("Create station operation failed. Status: " + data.stat);
            console.log(JSON.stringify(data));
            callback(false);
            return;
        }

        callback(data.result);
    }

    newStationRequest();
}

/* Function to delete a user station */
function deleteStation(stationToken, callback) {

    function deleteStationRequest() {
        var request = {
            "stationToken": stationToken
        }

        transceive("POST",
                   HTTP_ENTRY_POINT,
                   "station.deleteStation",
                   request,
                   true,
                   deleteStationResponse);
    }

    function deleteStationResponse(data) {
        console.log(data);
        /* Ensure success */
        if(data.stat != "ok") {
            console.log("Delete station operation failed. Status: " + data.stat);
            console.log(JSON.stringify(data));
            callback(false);
            return;
        }

        callback(data.stat);
    }

    deleteStationRequest();
}

/* Function to delete user feedback */
function deleteFeedback(feedbackId, callback) {

    function deleteFeedbackRequest() {
        var request = {
            "feedbackId": feedbackId
        }

        transceive("POST",
                   HTTP_ENTRY_POINT,
                   "station.deleteFeedback",
                   request,
                   true,
                   deleteFeedbackResponse);
    }

    function deleteFeedbackResponse(data) {
        /* Ensure success */
        if(data.stat != "ok") {
            console.log("Delete feedback operation failed. Status: " + data.stat);
            console.log(JSON.stringify(data));
            callback(false);
            return;
        }

        callback(data.stat);
    }

    deleteFeedbackRequest();
}

/* Function to delete a music seed */
function deleteSeed(seedId, callback) {

    function deleteSeedRequest() {
        var request = {
            "seedId": seedId
        }

        transceive("POST",
                   HTTP_ENTRY_POINT,
                   "station.deleteMusic",
                   request,
                   true,
                   deleteSeedResponse);
    }

    function deleteSeedResponse(data) {
        /* Ensure success */
        if(data.stat != "ok") {
            console.log("Delete seed operation failed. Status: " + data.stat);
            console.log(JSON.stringify(data));
            callback(false);
            return;
        }

        callback(data.stat);
    }

    deleteSeedRequest();
}

/* Function to add a seed to a station */
function addSeed(musicToken, stationToken, callback) {

    function addSeedRequest() {
        var request = {
            "musicToken": musicToken,
            "stationToken": stationToken,
        }

        transceive("POST",
                   HTTP_ENTRY_POINT,
                   "station.addMusic",
                   request,
                   true,
                   addSeedResponse);
    }

    function addSeedResponse(data) {
        /* Ensure success */
        if(data.stat != "ok") {
            console.log("Add seed to station operation failed. Status: " + data.stat);
            console.log(JSON.stringify(data));
            callback(false);
            return;
        }

        if(callback !== null) {
            callback(data.stat);
        }
    }

    addSeedRequest();
}
