var debug = require('debug')('cipherlayer:manager:user');
var clone = require('clone');
var request = require('request');
var crypto = require('crypto');
var _ = require('lodash');
var countries = require('countries-info');
var ciphertoken = require('ciphertoken');

var userDao = require('../dao');
var tokenMng = require('./token');
var redisMng = require('./redis');
var cryptoMng = require('./crypto')({ password : 'password' });
var phoneMng = require('./phone');
var emailMng = require('./email');

var jsonValidator = require('./json_validator');

var ERR_INVALID_PWD = {
    err: 'invalid_password_format',
    code: 400
};

var _settings = {};

//This is Chris's contribution to the coding of this project!!!
var ERR_INVALID_USER_DOMAIN = 'Sorry your email domain is not authorised for this service';

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

function createUser(body, pin, cbk) {
    if (!body[_settings.passThroughEndpoint.username]) {
        return cbk({
            err: 'auth_proxy_error',
            des: 'invalid userinfo',
            code: 400
        });
    }
    body[_settings.passThroughEndpoint.username] = body[_settings.passThroughEndpoint.username].toLowerCase();

    if(!isValidDomain(body[_settings.passThroughEndpoint.username])) {
        debug('Invalid email domain \''+body[_settings.passThroughEndpoint.username]+'\'');
        return cbk({
            err: 'user_domain_not_allowed',
            des: ERR_INVALID_USER_DOMAIN,
            code: 400
        }, null);
    }

    if (!body[_settings.passThroughEndpoint.password]) {
        if (!body.sf) {
            return cbk({
                err: 'invalid_security_token',
                des: 'you must provide a password or a salesforce token to create the user',
                code: 400
            });
        }
    } else {
        if(!validatePwd(body.password, _settings.password.regexValidation)) {
            ERR_INVALID_PWD.des = _settings.password.message;
            var err = ERR_INVALID_PWD;
            return cbk(err);
        }
    }

    var user = {
        username: body[_settings.passThroughEndpoint.username],
        password: body[_settings.passThroughEndpoint.password]
    };

    userDao.getFromUsername(user.username, function (err, foundUser) {
        if (foundUser) {
            return cbk({
                err: 'auth_proxy_user_error',
                des: 'user already exists',
                code: 403
            });
        }

        var phone = body.phone;
        var countryISO = body.country;
        phoneMng(_settings).verifyPhone(user.username, phone, countryISO, pin, function (err, verified) {
            if (err) {
                return cbk(err);
            }

            if (body.sf) {
                delete(body[_settings.passThroughEndpoint.password]);
                tokenMng.getAccessTokenInfo(body.sf, function (err, tokenInfo) {
                    if (err) {
                        return cbk({
                            err: 'invalid_platform_token',
                            des: 'you must provide a valid salesforce token',
                            code: 400
                        });
                    }

                    user.platforms = [{
                        platform: 'sf',
                        accessToken: tokenInfo.data.accessToken,
                        refreshToken: tokenInfo.data.refreshToken,
                        expiry: new Date().getTime() + _settings.salesforce.expiration * 60 * 1000
                    }];
                    createUserPrivateCall(body, user, cbk);
                });
            } else {
                emailMng(_settings).emailVerification(body.email, body, function (err, destinationEmail) {
                    if(err){
                        return cbk(err);
                    }
                    if(destinationEmail){
                        return cbk({
                            des: destinationEmail,
                            code: 200
                        });
                    }
                    createUserPrivateCall(body, user, cbk);
                });
            }
        });
    });
}

function createUserByToken(token, cbk) {
    if(!token){
        return cbk({
            err: 'auth_proxy_error',
            des: 'empty param verifyToken',
            code: 400
        });
    }

    //Decipher the body
    var tokenSettings = {
        cipherKey: _settings.accessToken.cipherKey,
        firmKey: _settings.accessToken.signKey,
        //Same expiration as the redisKey
        tokenExpirationMinutes: _settings.emailVerification.redis.expireInSec
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
        var redisKey = _settings.emailVerification.redis.key;
        redisKey = redisKey.replace('{username}', body.email);

        redisMng.getKeyValue(redisKey, function(err, transactionId) {
            if(err){
                return cbk(err);
            }

            if(body.transactionId === transactionId){
                var user = {
                    username: body[_settings.passThroughEndpoint.username],
                    password: body[_settings.passThroughEndpoint.password]
                };
                delete(body[_settings.passThroughEndpoint.password]);

                if(!isValidDomain(user.username)) {
                    debug('Invalid email domain \''+user.username+'\'');
                    return cbk({
                        err:'user_domain_not_allowed',
                        des: ERR_INVALID_USER_DOMAIN,
                        code: 400
                    }, null);
                }

                userDao.getFromUsername(user.username, function (err, foundUser) {
                    if (foundUser) {
                        return cbk({
                            err: 'auth_proxy_error',
                            des: 'user already exists',
                            code: 403
                        });
                    }

                    delete(body[_settings.passThroughEndpoint.password]);
                    createUserPrivateCall(body, user, cbk);
                });
            } else {
                return cbk({
                    err:'invalid_profile_data',
                    des:'Incorrect or expired transaction.',
                    code: 400
                });
            }
        });
    });
}

function createUserPrivateCall(body, user, cbk){
    var options = {
        url: 'http://localhost:' + _settings.private_port + _settings.passThroughEndpoint.path,
        headers: {
            'Content-Type': 'application/json; charset=utf-8'
        },
        method: 'POST',
        body: JSON.stringify(body)
    };

    debug('=> POST ' + options.url);
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
                debug('user has no password ', user.username);
                user.password = random(12);
                debug('created user password ', user.password);
            }

            cryptoMng.encrypt(user.password, function(encrypted){
                user.password = encrypted;

                userDao.addUser()(user, function (err, createdUser) {
                    if (err) {
                        debug('error adding user: ', err);
                        return cbk({
                            err: err.err,
                            des: 'error adding user to DB',
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

                                var data = {};
                                if(foundUser.role){
                                    data = {"role": foundUser.role};
                                }

                                tokenMng.createBothTokens(foundUser._id, data, function (err, tokens) {
                                    if (err) {
                                        debug('error creating tokens: ', err);
                                        return cbk({
                                            err: err.message,
                                            code: 409
                                        });
                                    } else {
                                        tokens.expiresIn = _settings.accessToken.expiration * 60;
                                        cbk(null, tokens);
                                    }
                                });
                            }
                        });
                    }
                });
            });
        }
    });
}

function setPassword(id, body, cbk){
    if(!body.password){
        return cbk({
            err: 'auth_proxy_error',
            des: 'invalid body request',
            code: 400
        });
    }

    if(!validatePwd(body.password, _settings.password.regexValidation)) {
        ERR_INVALID_PWD.des = _settings.password.message;
        var err = ERR_INVALID_PWD;
        return cbk(err);
    } else {
        cryptoMng.encrypt(body.password, function(encryptedPwd){
            userDao.updateField(id, 'password', encryptedPwd, function(err, result){
                debug('UpdatePasswordField', err, result);
                return cbk(err, result);
            });
        });
    }
}

//Aux functions
function random (howMany, chars) {
    chars = chars || "abcdefghijklmnopqrstuwxyzABCDEFGHIJKLMNOPQRSTUWXYZ0123456789";
    var rnd = crypto.randomBytes(howMany),
        value = new Array(howMany),
        len = chars.length;

    for (var i = 0; i < howMany; i++) {
        value[i] = chars[rnd[i] % len];
    }
    return value.join('');
}

function isValidDomain(email){
    debug('Domain control for email \''+email+'\'');
    var validDomain = true;
    if(_settings.allowedDomains){
        for(var i = 0; i < _settings.allowedDomains.length; i++){
            var domain = _settings.allowedDomains[i];

            //wildcard
            var check = domain.replace(/\*/g,'.*');
            var match = email.match(check);
            validDomain = (match !== null && email === match[0]);
            debug('match \''+ email +'\' with \'' + domain + '\' : ' + validDomain);
            if(validDomain) break;
        }
    }
    return validDomain;
}

function validatePwd(pwd, regexp){
    var regex = new RegExp(regexp);
    return regex.test(pwd);
}


module.exports = function(settings) {
    var config = require('../../config.json');
    _settings = _.assign({}, config, settings);

    return {
        setPlatformData : setPlatformData,
        createUser : createUser,
        createUserByToken : createUserByToken,
        setPassword: setPassword
    };
};