var request = require('request');
var _ = require('lodash');
var countries = require('countries-info');
var redisMng = require('./redis');
var todo = require('../logger/todo.js');

var _settings = {};

function createPIN(redisKeyId, phone, cbk){
    var redisKey = _settings.phoneVerification.redis.key;
    redisKey =  redisKey.replace('{userId}',redisKeyId).replace('{phone}',phone);
    var expires = _settings.phoneVerification.redis.expireInSec;
    var pinAttempts = _settings.phoneVerification.attempts;

    var pin = '';
    for(var i=0; i<_settings.phoneVerification.pinSize; i++){
        var randomNum = Math.floor(Math.random() * 9);
        pin += randomNum.toString();
    }

    redisMng.insertKeyValue(redisKey + '.pin', pin, expires, function(err, pin){
        if(err){
            return cbk(err);
        }
        redisMng.insertKeyValue(redisKey + '.attempts', pinAttempts , expires, function(err){
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
    var notifServiceURL = _settings.externalServices.notifications.base;
    var sms = {
        phone: phone,
        text: 'MyComms pin code: ' + pin
    };

    var options = {
        url: notifServiceURL + '/notification/sms',
        headers: {
            'Content-Type': 'application/json; charset=utf-8'
        },
        method: 'POST',
        body: JSON.stringify(sms)
    };

    request(options, function(err) {
		todo.warn('pin sms notification request must verify response code');
        if(err){
            return cbk(err);
        }
        cbk();
    });
}

function verifyPhone(redisKeyId, phone, country, pin, cbk) {
    if( !_settings.phoneVerification ) {
        return cbk(null, true);
    }

    if (!phone || !country) {
        return cbk({
            err: 'auth_proxy_error',
            des: 'empty phone or country',
            code: 400
        });
    }
    countries.countryFromIso(country, function (err, returnedCountry) {
        if (err) {
            return cbk(err);
        }
        phone = '+' + returnedCountry.Dial + phone;

        if (!phone) {
            return cbk({
                err: 'auth_proxy_error',
                des: 'empty phone',
                code: 400
            });
        }

        if (!pin) {
            createPIN(redisKeyId, phone, function (err) {
                if (err) {
                    err.code = 500;
                    return cbk(err);
                } else {
                    return cbk({
                        err: 'auth_proxy_verified_error',
                        des: 'User phone not verified',
                        code: 403
                    });
                }
            });
        } else {
            var redisKey = _settings.phoneVerification.redis.key;
            redisKey = redisKey.replace('{userId}',redisKeyId).replace('{phone}',phone);

            redisMng.getKeyValue(redisKey + '.pin', function(err, redisPhonePin){
                if(err) return cbk(err);

                if(!redisPhonePin) {
                    createPIN(redisKeyId, phone, function(err){
                        if(err) {
                            return cbk(err);
                        }
                        return cbk({
                            err:'verify_phone_error',
                            des:'Expired PIN or incorrect phone number.',
                            code: 401
                        }, false);
                    });
                } else {
                    redisMng.getKeyValue(redisKey + '.attempts', function(err, redisPinAttempts) {
                        if(err) return cbk(err);
                        if(!redisPinAttempts || redisPinAttempts === '0') {
                            createPIN(redisKeyId, phone, function(err){
                                if(err){
                                    return cbk(err);
                                }
                                return cbk({
                                    err:'verify_phone_error',
                                    des:'PIN used has expired.',
                                    code: 401
                                }, false);
                            });
                        } else {
                            if(pin === redisPhonePin){
                                return cbk(null, true);
                            } else {
                                //Last attempt
                                if(redisPinAttempts === '1'){
                                    createPIN(redisKeyId, phone, function(err){
                                        if(err) {
                                            return cbk(err);
                                        }
                                        return cbk({
                                            err:'verify_phone_error',
                                            des:'PIN used has expired.',
                                            code: 401
                                        }, false);
                                    });
                                } else {
                                    redisMng.updateKeyValue(redisKey + '.attempts', redisPinAttempts-1, function (err) {
                                        if (err) return cbk(err);
                                        return cbk({
                                            err: 'verify_phone_error',
                                            des:'PIN used is not valid.',
                                            code: 401
                                        }, false);
                                    });
                                }
                            }
                        }
                    });
                }
            });
        }
    });
}

module.exports = function(settings) {
    var config = require(process.cwd() + '/config.json');
    _settings = _.assign({}, config, settings);

    return {
        createPIN : createPIN,
        verifyPhone : verifyPhone
    };
};