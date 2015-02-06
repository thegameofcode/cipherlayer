var debug = require('debug')('cipherlayer:routes:auth');
var clone = require('clone');
var crypto = require('crypto');
var request = require('request');

var countries = require('countries-info');
var userDao = require('../dao');
var tokenMng = require('../managers/token');
var phoneMng = require('../managers/phone');
var config = JSON.parse(require('fs').readFileSync('config.json','utf8'));

function createUser(req, body, res, next, user) {
    var options = {
        url: 'http://' + config.private_host + ':' + config.private_port + req.url,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Host': req.headers.host,
            'X-Real-IP': req.connection.remoteAddress,
            'X-Forwarded-For': req.header('X-Forwarded-For') || req.connection.remoteAddress
        },
        method: req.method,
        body: JSON.stringify(body)
    };

    debug('=> ' + req.method + ' ' + options.url);
    request(options, function (err, private_res, body) {
        if (err) {
            debug('<= error: ' + err);
            res.send(500, {
                err: 'auth_proxy_error',
                des: 'there was an internal error when redirecting the call to protected service'
            });
            return next(false);
        } else {
            debug('<= ' + private_res.statusCode);
            body = JSON.parse(body);
            user.id = body.id;
            if (!user.password) {
                user.password = crypto.pseudoRandomBytes(12).toString('hex');
            }

            userDao.addUser(user, function (err, createdUser) {
                if (err) {
                    debug('error adding user: ', err);
                    res.send(409, {err: err.message});
                    return next(false);
                } else {
                    userDao.getFromUsernamePassword(createdUser.username, createdUser.password, function (err, foundUser) {
                        if (err) {
                            debug('error obtaining user: ', err);
                            res.send(409, {err: err.message});
                            return next(false);
                        } else {
                            tokenMng.createBothTokens(foundUser._id, function (err, tokens) {
                                if (err) {
                                    debug('error creating tokens: ', err);
                                    debug(err);
                                    res.send(409, {err: err.message});
                                } else {
                                    tokens.expiresIn = config.accessToken.expiration * 60;
                                    res.send(201, tokens);
                                }
                                next(false);
                            });
                        }
                    });
                }
            });
        }
    });
}


function createUserEndpoint(req, res, next) {
    var body = clone(req.body);

    if (body[config.passThroughEndpoint.username] === undefined) {
        res.send(400, {
            err: 'auth_proxy_error',
            des: 'invalid userinfo'
        });
        return next(false);
    }

    if (body[config.passThroughEndpoint.password] === undefined) {
        if (body.sf === undefined) {
            res.send(400, {
                err: 'invalid_security_token',
                des: 'you must provide a password or a salesforce token to create the user'
            });
            return next(false);
        } else {
            body[config.passThroughEndpoint.password] = '12345678';
        }
    }

    var user = {
        username: body[config.passThroughEndpoint.username],
        password: body[config.passThroughEndpoint.password]
    };
    delete(body[config.passThroughEndpoint.password]);

    var phone = body.phone;
    var country = body.country;
    if (!phone) {
        res.send(400, {
            err: 'auth_proxy_error',
            des: 'empty phone'
        });
        return next(false);
    } else if (!country) {
        res.send(400, {
            err: 'auth_proxy_error',
            des: 'empty country code'
        });
        return next(false);
    } else {
        countries.countryFromIso(country, function (err, returnedCountry) {
            if (err) {
                res.send(400, err);
                return next(false);
            }

            phone = '+' + returnedCountry.Dial + phone;
        });
    }

    userDao.getFromUsername(user.username, function (err, foundUser) {
        if (foundUser) {
            res.send(403, {
                err: 'auth_proxy_error',
                des: 'user already exists'
            });
            return next(false);
        } else {
            var pin = req.headers['x-otp-pin'];

            if( config.usePinVerification === false ) {
                return createUser(req, body, res, next, user);
            }

            if (!pin) {
                debug('no pin number');
                phoneMng.createPIN(user.username, phone, function (err, createdPin) {
                    if (err) {
                        res.send(500, err);
                        return next(false);
                    } else {
                        res.send(403, {
                            err: 'auth_proxy_error',
                            des: 'user phone not verified'
                        });
                        return next(false);
                    }
                });
            } else {
                debug('user try pin number', pin);
                phoneMng.verifyPhone(user.username, phone, pin, function (err, verified) {
                    if (err) {
                        if (err.err != 'verify_phone_error') {
                            res.send(500, err);
                        } else {
                            res.send(401, err);
                        }
                        return next(false);
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

                                createUser(req, body, res, next, user);
                            });
                        } else {
                            createUser(req, body, res, next, user);
                        }
                    }
                });
            }
        }
    });
}

function addRoutes(service){
    service.post(config.passThroughEndpoint.path, createUserEndpoint);

    debug('User creation routes added');
}

module.exports = addRoutes;
