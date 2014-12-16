var request = require('request');
var async = require('async');

var fs = require('fs');
var path = require('path');
var config = JSON.parse(require('fs').readFileSync('config.json','utf8'));

var redisMng = require('./redis');

function createPIN(username, phone, cbk){
    var redisKey = config.redisKeys.user_phone_verify.key;
    redisKey =  redisKey.replace('{username}',username).replace('{phone}',phone);
    var expires = config.redisKeys.user_phone_verify.expireInSec;
    var pinAttempts = config.userPIN.attempts;

    var pin = '';
    for(var i=0; i<config.userPIN.size; i++){
        var randomNum = Math.floor(Math.random() * 9);
        pin += randomNum.toString();
    }

    redisMng.insertKeyValue(redisKey + '.pin', pin, expires, function(err, pin){
        if(err){
            return cbk(err);
        }
        redisMng.insertKeyValue(redisKey + '.attempts', pinAttempts , expires, function(err, attemps){
            if(err) {
                return cbk(err);
            }
            sendPIN(phone, pin, function(err){
                cbk(err, pin);
            });
        });
    });
}

function sendPIN(phone, pin, cbk){
    var notifServiceURL = config.services.notifications;
    var sms = {
        phone: phone,
        text: pin
    };

    var options = {
        url: notifServiceURL + '/notification/sms',
        headers: {
            'Content-Type': 'application/json; charset=utf-8'
        },
        method: 'POST',
        body: JSON.stringify(sms)
    };

    request(options, function(err,res,body) {
        if(err || res.statusCode != 204){
            return cbk({err:'Send_sms_problem'});
        }
        cbk();
    });
}

function verifyPhone(username, phoneToVerify, pin,cbk) {
    var redisKey = config.redisKeys.user_phone_verify.key;
    redisKey = redisKey.replace('{username}',username).replace('{phone}',phoneToVerify);

    redisMng.getKeyValue(redisKey + '.pin', function(err, redisPhonePin){
        if(err) return cbk(err);

        if(!redisPhonePin) {
            createPIN(username, phoneToVerify, function(err, createdPin){
                if(err) return cbk(err);
                return cbk({err:'validate_pin_error', des:'Expired PIN or incorrect phone number.'}, false);
            });
        } else {
            redisMng.getKeyValue(redisKey + '.attempts', function(err, redisPinAttempts) {
                if(err) return cbk(err);
                if(!redisPinAttempts || redisPinAttempts === '0') {
                    createPIN(username, phoneToVerify, function(err, createdPin){
                        if(err) return cbk(err);
                        return cbk({err:'pin_expired', des:'PIN used has expired.'}, false);
                    });
                } else {
                    if(pin === redisPhonePin){
                        cbk(null, true);
                    } else {
                        //Last attempt
                        if(redisPinAttempts === '1'){
                            createPIN(username, phoneToVerify, function(err, createdPin){
                                if(err) return cbk(err);
                                return cbk({err:'pin_expired', des:'PIN used has expired.'}, false);
                            });
                        } else {
                            redisMng.updateKeyValue(redisKey + '.attempts', redisPinAttempts-1, function (err, attempts) {
                                if (err) return cbk(err);
                                return cbk({err: 'invalid_pin', des:'PIN used is not valid.'}, false);
                            });
                        }
                    }
                }
            });
        }
    });
}

module.exports = {
    createPIN : createPIN,
    verifyPhone : verifyPhone
}