var request = require('request');
var assert = require('assert');

var phoneMng= require("../../managers/phone");
var redisMng= require("../../managers/redis");

var nock = require("nock");

var cipherlayer = require('../../cipherlayer');
var world = require('./world');

var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));


var user = {};

function getUser(){
    return user;
}

function resetUser(){
    user = {};
}

function createPin(userId, phone, cbk){

    var notifServiceURL = config.services.notifications;

    nock(notifServiceURL)
        .post('/notification/sms')
        .reply(204);

    phoneMng.createPIN(userId, phone, function(err, pin){
        cbk(err,pin);
    });
}

function getPinNumber(userId, phone, cbk){

    var redisKey = config.redisKeys.user_phone_verify.key;
    redisKey = redisKey.replace('{userId}',userId).replace('{phone}',phone);

    console.log('REDIS KEYSSSSS ',redisKey);

    redisMng.getKeyValue(redisKey + '.pin', function(err, redisPhonePin) {
        cbk(err, redisPhonePin);
    });
}

// RESPONSE
var response = {};

function getResponse(){
    return response;
}

// TOKENS
var tokens = {};

function getTokens(){
    return tokens;
}

module.exports = {
    getUser: getUser,
    resetUser: resetUser,
    getResponse: getResponse,
    getTokens: getTokens,
    createPin:createPin,
    getPinNumber:getPinNumber
};