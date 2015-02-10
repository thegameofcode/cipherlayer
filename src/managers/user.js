var debug = require('debug')('cipherlayer:routes:auth');
var clone = require('clone');
var request = require('request');
var crypto = require('crypto');
var _ = require('lodash');
var countries = require('countries-info');
var ciphertoken = require('ciphertoken');

var userDao = require('../dao');
var tokenMng = require('./token');
var phoneMng = require('./phone');
var redisMng = require('./redis');
var cryptoMng = require('./crypto')({ password : 'password' });
var config = require('../../config.json');

var jsonValidator = require('./json_validator');

var defaultSettings = config;
var _settings = {};

function setPlatformData(userId, platform, data, cbk){
    userDao.updateArrayItem(userId, 'platforms', 'platform', data, function(err, updates){
        if(err) {
            return cbk(err);
        }

        if(updates<1) {
            return cbk({err:'platform_not_updated', des:'updated command worked but no platform were updated'});
        }

        cbk(null);
    });
}

function createUser(req, cbk) {
    var body = clone(req.body);
    if (body[config.passThroughEndpoint.username] === undefined) {
        return cbk({
            err: 'auth_proxy_error',
            des: 'invalid userinfo',
            code: 400
        });
    }

    if (body[config.passThroughEndpoint.password] === undefined) {
        if (body.sf === undefined) {
            return cbk({
                err: 'invalid_security_token',
                des: 'you must provide a password or a salesforce token to create the user',
                code: 400
            });
        }
    }

    var user = {
        username: body[config.passThroughEndpoint.username],
        password: [body[config.passThroughEndpoint.password]]
    };
    delete(body[config.passThroughEndpoint.password]);

    var phone = body.phone;
    var country = body.country;
    if (!phone) {
        return cbk({
            err: 'auth_proxy_error',
            des: 'empty phone',
            code: 400
        });
    } else if (!country) {
        return cbk({
            err: 'auth_proxy_error',
            des: 'empty country code',
            code: 400
        });
    } else {
        countries.countryFromIso(country, function (err, returnedCountry) {
            if (err) {
                return cbk(err);
            }
            phone = '+' + returnedCountry.Dial + phone;
        });
    }

    userDao.getFromUsername(user.username, function (err, foundUser) {
        if (foundUser) {
            return cbk({
                err: 'auth_proxy_error',
                des: 'user already exists',
                code: 403
            });
        }

        var pin = req.headers['x-otp-pin'];
        phoneMng.verifyPhone(user.username, phone, pin, function (err, verified) {
            if (err) {
                return cbk(err);
            }

            var emailMng = require('./email')( { useEmailVerification : _settings.useEmailVerification });
            emailMng.verifyEmail(body.email, body, function (err, destinationEmail) {
                if(err){
                    return cbk(err);
                }
                if(destinationEmail){
                    return cbk({
                        des: destinationEmail,
                        code: 200
                    });
                } else {
                    if (body.sf) {
                        tokenMng.getAccessTokenInfo(body.sf, function (err, tokenInfo) {
                            if (err) {
                                res.send(400, {
                                    err: 'invalid_platform_token',
                                    des: 'you must provide a valid salesforce token'
                                });
                                return next(false);
                            }

                            user.platforms = [{
                                platform: 'sf',
                                accessToken: tokenInfo.data.accessToken,
                                refreshToken: tokenInfo.data.refreshToken,
                                expiry: new Date().getTime() + config.salesforce.expiration * 60 * 1000
                            }];
                        });
                    }

                    delete(body[config.passThroughEndpoint.password]);
                    createUserPrivateCall(req, body, user, cbk);
                }
            });
        });
    });
}

function createDirectLoginUser(req, cbk) {
    if(!req.params.verifyToken){
        return cbk({
            err: 'auth_proxy_error',
            des: 'empty param verifyToken',
            code: 400
        });
    }

    var token = clone(req.params.verifyToken);
    //Decipher the body
    var tokenSettings = {
        cipherKey: _settings.accessToken.cipherKey,
        firmKey: _settings.accessToken.signKey,
        tokenExpirationMinutes: _settings.accessToken.expiration * 60
    };

    ciphertoken.getTokenSet(tokenSettings, token, function(err, bodyData){
        if(err){
            return cbk(err);
        }
        var body = bodyData.data;

        var profileSchema = require('./json_formats/profile_create.json');
        //Validate the current bodyData with the schema profile_create.json
        if( !jsonValidator.isValidJSON(body, profileSchema) || !body.transactionId) {
            return cbk({
                err:'invalid_profile_data',
                des:'The data format provided is nor valid.',
                code: 400
            });
        }

        //Verify the transactionId
        var redisKey = config.redisKeys.direct_login_transaction.key;
        redisKey = redisKey.replace('{username}', body.email);

        redisMng.getKeyValue(redisKey, function(err, transactionId) {
            if(err){
                return cbk(err);
            }

            if(body.transactionId === transactionId){
                var user = {
                    username: body[config.passThroughEndpoint.username],
                    password: [body[config.passThroughEndpoint.password]]
                };
                delete(body[config.passThroughEndpoint.password]);

                userDao.getFromUsername(user.username, function (err, foundUser) {
                    if (foundUser) {
                        return cbk({
                            err: 'auth_proxy_error',
                            des: 'user already exists',
                            code: 403
                        });
                    }

                    req.url = config.passThroughEndpoint.path;
                    req.method = 'POST';

                    delete(body[config.passThroughEndpoint.password]);
                    createUserPrivateCall(req, body, user, cbk);
                });
            } else {
                return cbk({
                    err:'invalid_profile_data',
                    des:'Transaction has expired.',
                    code: 400
                });
            }
        });
    });
}

function createUserPrivateCall(req, body, user, cbk){
    var options = {
        url: 'http://localhost:' + config.private_port + req.url,
        headers: {
            'Content-Type': 'application/json; charset=utf-8'
        },
        method: req.method,
        body: JSON.stringify(body)
    };

    debug('=> ' + req.method + ' ' + options.url);
    request(options, function (err, private_res, body) {
        if (err) {
            debug('<= error: ' + err);
            return cbk({
                err: 'auth_proxy_error',
                des: 'there was an internal error when redirecting the call to protected service',
                code: 500
            });
        } else {
            debug('<= ' + private_res.statusCode);
            body = JSON.parse(body);
            user.id = body.id;
            if (!user.password) {
                user.password = crypto.pseudoRandomBytes(12).toString('hex');
            } else {
                cryptoMng.encrypt(JSON.stringify(body), function(encrypted){
                    user.password = encrypted;
                });
            }

            userDao.addUser()(user, function (err, createdUser) {
                if (err) {
                    debug('error adding user: ', err);
                    return cbk({
                        err: err.message,
                        code: 409
                    });
                } else {
                    userDao.getFromUsernamePassword(createdUser.username, createdUser.password, function (err, foundUser) {
                        if (err) {
                            debug('error obtaining user: ', err);
                            return cbk({
                                err: err.message,
                                code: 409
                            });
                        } else {
                            tokenMng.createBothTokens(foundUser._id, function (err, tokens) {
                                if (err) {
                                    debug('error creating tokens: ', err);
                                    return cbk({
                                        err: err.message,
                                        code: 409
                                    });
                                } else {
                                    tokens.expiresIn = config.accessToken.expiration * 60;
                                    cbk(null, tokens);
                                }
                            });
                        }
                    });
                }
            });
        }
    });
}


module.exports = function(settings) {
    _.extend(_settings, defaultSettings, settings);

    return {
        setPlatformData : setPlatformData,
        createUser : createUser,
        createDirectLoginUser : createDirectLoginUser
    };
};