var request = require('request');
var assert = require('assert');

var phoneMng= require("../../src/managers/phone");
var redisMng= require("../../src/managers/redis");

var nock = require("nock");

var cipherlayer = require('../../src/cipherlayer');
var world = require('./world');

var fs = require('fs');
var config = require('../../config.json');


var user = {};

function getUser(){
    return user;
}

function resetUser(){
    user = {};
}

function createPin(userId, phone, cbk){

    var notifServiceURL = config.externalServices.notifications;

    nock(notifServiceURL)
        .post('/notification/sms')
        .reply(204);

    phoneMng.createPIN(userId, phone, function(err, pin){
        cbk(err,pin);
    });
}

function getPinNumber(userId, phone, cbk){
    var redisKey = config.phoneVerification.redis.key;
    redisKey = redisKey.replace('{userId}',userId).replace('{phone}',phone);

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