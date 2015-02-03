var assert = require('assert');
var pinValidation = require('../src/middlewares/pinValidation.js');
var nock = require('nock');
var config = JSON.parse(require('fs').readFileSync('config.json','utf8'));
var redisMng = require('../src/managers/redis');
var countries = require('countries-info');

var notifServiceURL = config.services.notifications;

describe('middleware pinValidation', function(){

    var settings = {
        "pinValidationEndpoints" : [
            {
                "path": "/api/me/phones",
                "method": "post",
                "fields": {
                    "phoneNumber": "phone"
                }
            },
            {
                "path": "/api/me/phones",
                "method": "post",
                "fields": {
                    "countryISO": "country",
                    "phoneNumber": "phone"
                }
            },
            {
                "path": "/api/me/phones",
                "method": "post",
                "fields": {
                    "countryISO": "country"
                }
            }
        ],
        "redisKeys": {
            "user_phone_verify": {
                "key":"user.{userId}.phone.{phone}",
                "expireInSec": 300
            }
        }
    };

    function getPinNumber(userId, country, phone, cbk){
        countries.countryFromIso(country, function (err, returnedCountry) {
            assert.equal(err, null);
            phone = '+' + returnedCountry.Dial + phone;
            var redisKey = settings.redisKeys.user_phone_verify.key;
            redisKey =  redisKey.replace('{userId}',userId).replace('{phone}',phone);

            redisMng.getKeyValue(redisKey + '.pin', function(err, redisPhonePin) {
                cbk(err, redisPhonePin);
            });
        });
    }

    beforeEach(function(done){
        redisMng.connect(function(){
            redisMng.deleteAllKeys(done);
        });
    });

    afterEach(function(done){
        redisMng.disconnect(done);
    });

    it('continue if the url does not need pin validation', function(done){
        var req = {
            url: "http://www.google.es"
        };
        var res = {};
        var next = function(canContinue){
            if(canContinue === undefined || canContinue === true) done();
        };

        pinValidation(settings)(req, res, next);
    });

    it('error if body does not match the schema', function(done){
        var expectedCode = 400;
        var expectedError = {
            err: 'auth_proxy_error',
            des: 'Invalid JSON fields'
        };
        var validResponse = false;

        var req = {
            url: "/api/me/phones",
            body: {
                "country": "ES"
            },
            method: "POST"
        };

        var res = {
            send : function(code, body){
                assert.equal(code, expectedCode, 'invalid response code');
                assert.deepEqual(body, expectedError, 'invalid response body');
                validResponse = true;
            }
        };

        var next = function(canContinue){
            if(canContinue === false && validResponse) done();
        };

        pinValidation(settings)(req, res, next);
    });

    it('error if country does not found', function(done){
        var expectedCode = 400;
        var expectedError = {
            err: 'country_not_found',
            des: 'given phone does not match any country dial code'
        };
        var validResponse = false;

        var req = {
            url: "/api/me/phones",
            body: {
                "country": "--",
                "phone": "666666666"
            },
            method: "POST"
        };

        var res = {
            send : function(code, body){
                assert.equal(code, expectedCode, 'invalid response code');
                assert.deepEqual(body, expectedError, 'invalid response body');
                validResponse = true;
            }
        };

        var next = function(canContinue){
            if(canContinue === false && validResponse) done();
        };

        pinValidation(settings)(req, res, next);
    });

    it('error if phone does not send the pin', function(done){
        var expectedCode = 403;
        var expectedError = {
            err: 'auth_proxy_error',
            des: 'User phone not verified'
        };
        var validResponse = false;

        var req = {
            url: "/api/me/phones",
            body: {
                "country": "ES",
                "phone": "666666666"
            },
            method: "POST",
            user: {
                id: "mc_1a2b3c4d5e6f"
            }
        };

        nock(notifServiceURL)
            .post('/notification/sms')
            .reply(204);

        var res = {
            send : function(code, body){
                assert.equal(code, expectedCode, 'invalid response code');
                assert.deepEqual(body, expectedError, 'invalid response body');
                validResponse = true;
            }
        };

        var next = function(canContinue){
            if(canContinue === false && validResponse) {
                getPinNumber(req.user.id, req.body.country, req.body.phone, function(err, returnedPin){
                    assert.equal(err, null);
                    assert.notEqual(returnedPin, null, 'invalid or not created pin');
                    done();
                });
            }
        };

        pinValidation(settings)(req, res, next);
    });

    it('error if pin does not match with the stored one', function(done){
        var expectedCode = 403;
        var expectedError = {
            err: 'auth_proxy_error',
            des: 'User phone not verified'
        };
        var validResponse = false;

        var req = {
            headers: {},
            url: "/api/me/phones",
            body: {
                "country": "ES",
                "phone": "666666666"
            },
            method: "POST",
            user: {
                id: "default@user.com"
            }
        };

        nock(notifServiceURL)
            .post('/notification/sms')
            .reply(204);

        var res = {
            send : function(code, body){
                assert.equal(code, expectedCode, 'invalid response code');
                assert.deepEqual(body, expectedError, 'invalid response body');
            }
        };

        var next = function(canContinue){
            if(canContinue === false && validResponse) {
                done();
            } else {
                req.headers['x-otp-pin'] = 'zzzz';

                expectedCode = 401;
                expectedError = {
                    err: 'verify_phone_error',
                    des: 'PIN used is not valid.'
                };

                validResponse = true;

                pinValidation(settings)(req, res, next);
            }
        };

        pinValidation(settings)(req, res, next);
    });

    it('continue if pin match with the stored one', function(done){
        var expectedCode = 403;
        var expectedError = {
            err: 'auth_proxy_error',
            des: 'User phone not verified'
        };
        var validResponse = false;

        var req = {
            headers: {},
            url: "/api/me/phones",
            body: {
                "country": "ES",
                "phone": "666666666"
            },
            method: "POST",
            user: {
                id: "default@user.com"
            }
        };

        nock(notifServiceURL)
            .post('/notification/sms')
            .reply(204);

        var res = {
            send : function(code, body){
                assert.equal(code, expectedCode, 'invalid response code');
                assert.deepEqual(body, expectedError, 'invalid response body');
            }
        };

        var next = function(canContinue){
            if(!canContinue && validResponse) {
                done();
            } else {
                getPinNumber(req.user.id, req.body.country, req.body.phone, function(err, returnedPin){
                    assert.equal(err, null);
                    assert.notEqual(returnedPin, null, 'invalid or not created pin');
                    req.headers['x-otp-pin'] = returnedPin;

                    validResponse = true;

                    pinValidation(settings)(req, res, next);
                });
            }
        };

        pinValidation(settings)(req, res, next);
    });

    it( config.userPIN.attempts +' incorrect pin attemps (creates a new pin)', function(done){
        var expectedCode = 403;
        var expectedError = {
            err: 'auth_proxy_error',
            des: 'User phone not verified'
        };
        var invalidResponseAttemps = 0;
        var validResponse = false;
        var firstValidPin;

        var req = {
            headers: {},
            url: "/api/me/phones",
            body: {
                "country": "ES",
                "phone": "666666666"
            },
            method: "POST",
            user: {
                id: "default@user.com"
            }
        };

        nock(notifServiceURL)
            .post('/notification/sms')
            .times(2)
            .reply(204);

        var res = {
            send : function(code, body){
                assert.equal(code, expectedCode, 'invalid response code');
                assert.deepEqual(body, expectedError, 'invalid response body');
            }
        };

        var next = function(canContinue){
            invalidResponseAttemps++;
            if(!canContinue && validResponse) {
                done();
            } else {
                expectedCode = 401;
                expectedError = {
                    err: 'verify_phone_error',
                    des: 'PIN used is not valid.'
                };

                req.headers['x-otp-pin'] = 'zzzz';

                //1st attempt store the pin to check expiration at 3 attempts
                if(invalidResponseAttemps === 1) {
                    getPinNumber(req.user.id, req.body.country, req.body.phone, function(err, returnedPin){
                        assert.equal(err, null);
                        assert.notEqual(returnedPin, null, 'invalid or not created pin');
                        firstValidPin = returnedPin;

                        pinValidation(settings)(req, res, next);
                    });
                }
                //At this attempt pin must EXPIRE
                else if(invalidResponseAttemps === config.userPIN.attempts) {
                    expectedError.des= 'PIN used has expired.';

                    pinValidation(settings)(req, res, next);
                }
                //This attempt is to check the expiration of the 1st pin
                else if(invalidResponseAttemps === config.userPIN.attempts+1 ) {
                    req.headers['x-otp-pin'] = firstValidPin;

                    pinValidation(settings)(req, res, next);
                }
                //This attempt is to check that the new generated pin is correct
                else if(invalidResponseAttemps > config.userPIN.attempts+1){
                    getPinNumber(req.user.id, req.body.country, req.body.phone, function(err, returnedPin){
                        assert.notEqual(returnedPin, null, 'invalid or not created pin');

                        req.headers['x-otp-pin'] = returnedPin;
                        validResponse = true;

                        pinValidation(settings)(req, res, next);
                    });
                }
                else {
                    pinValidation(settings)(req, res, next);
                }
            }
        };

        pinValidation(settings)(req, res, next);
    });

});