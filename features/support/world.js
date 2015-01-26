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

function createPin(username, phone, cbk){

    var notifServiceURL = config.services.notifications;

    nock(notifServiceURL)
        .post('/notification/sms')
        .reply(204);

    phoneMng.createPIN(username, phone, function(err, pin){
        cbk(err,pin);
    });
}

function getPinNumber(username, phone, cbk){

    var redisKey = config.redisKeys.user_phone_verify.key;
    redisKey = redisKey.replace('{username}',username).replace('{phone}',phone);

    console.log('REDIS KEYSSSSS ',redisKey);

    redisMng.getKeyValue(redisKey + '.pin', function(err, redisPhonePin) {
        cbk(err, redisPhonePin);
    });
}

function deleteAllUsers(done){
    var options = {
        url: 'http://localhost:'+config.public_port+'/auth/user',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization basic': new Buffer(config.management.clientId + ':' + config.management.clientSecret).toString('base64')
        },
        method:'DELETE'
    };
    options.headers[config.version.header] = "test/1";
    request(options, function(err,res,body) {
        done(err, res);
    });
}

// RESPONSE
var response = {};

function getResponse(){
    return response;
}

// TOKENS
var tokens = {}

function getTokens(){
    return tokens;
}

module.exports = {
    getUser: getUser,
    resetUser: resetUser,
    getResponse: getResponse,
    getTokens: getTokens,
    deleteAllUsers:deleteAllUsers,
    createPin:createPin,
    getPinNumber:getPinNumber
};