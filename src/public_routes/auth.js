'use strict';

var async = require('async');

var log = require('../logger/service.js');
var daoMng = require('../managers/dao');
var tokenMng = require('../managers/token');
var config = require(process.cwd() + '/config.json');
var ObjectID = require('mongodb').ObjectID;
var cryptoMng = require('../managers/crypto')({password: 'password'});

var sessionRequest = require('./auth/session');

function postAuthLogin(req, res, next) {
    var userAgent = String(req.headers['user-agent']);

    cryptoMng.encrypt(req.body.password, function (encryptedPwd) {
        daoMng.getFromUsernamePassword(req.body.username, encryptedPwd, function (err, foundUser) {
            if (err) {
                res.send(409, {err: err.message});
                return next(false);
            } else {
                daoMng.getAllUserFields(foundUser.username, function (err, result) {
                    if (Array.isArray(result.password)) {
                        daoMng.updateField(foundUser._id, "password", encryptedPwd, function (err, result) {
                            log.info({err: err, result: result}, 'UpdatePasswordField');
                        });
                    }
                });

                var data = {};
                if (foundUser.signUpDate) {
                    data.signUpDate = foundUser.signUpDate;
                }

                if (foundUser.roles) {
                    data.roles = foundUser.roles;
                }

                if (req.body.deviceId) {
                    data.deviceId = req.body.deviceId;
                }

                if (config.version) {
                    data.deviceVersion = req.headers[config.version.header];
                }

                async.series([
                    function(done){
                        //Add "realms" & "capabilities"
                        daoMng.getRealms(function(err, realms){
                            if(err){
                                log.error({err:err,des:'error obtaining user realms'});
                                return done();
                            }

                            if(!realms || !realms.length) {
                                log.info({des:'there are no REALMS in DB'});
                                return done();
                            }
                            async.eachSeries(realms, function(realm, next){
                                if(!realm.allowedDomains || !realm.allowedDomains.length){
                                    return next();
                                }
                                async.eachSeries(realm.allowedDomains, function(domain, more){
                                    //wildcard
                                    var check = domain.replace(/\*/g,'.*');
                                    var match = foundUser.username.match(check);
                                    if(!match || foundUser.username !== match[0]){
                                        return more();
                                    }

                                    if(!data.realms){
                                        data.realms = [];
                                    }
                                    data.realms.push(realm.name);

                                    async.each(Object.keys(realm.capabilities), function(capName, added){
                                        if(!data.capabilities){
                                            data.capabilities = {};
                                        }

                                        data.capabilities[capName] = realm.capabilities[capName];
                                        added();
                                    }, more);
                                }, next);
                            }, done);
                        });
                    }
                ], function(){
                    sessionRequest(data.deviceId, foundUser._id, 'POST', userAgent, function (err) {
                        if (err) {
                            log.error({err: err});
                        }
                        tokenMng.createBothTokens(foundUser._id, data, function (err, tokens) {
                            if (err) {
                                res.send(409, {err: err.message});
                            } else {
                                tokens.expiresIn = config.accessToken.expiration;
                                res.send(200, tokens);
                            }
                            next(false);
                        });
                    });
                });

            }
        });
    });
}

function postAuthUser(req, res, next) {
    var user = {
        id: req.body.id,
        username: req.body.username,
        password: req.body.password
    };

    if (req.body.id) {
        user.id = req.body.id;
    } else {
        user.id = new ObjectID();
    }

    if (req.body.platforms) {
        user.platforms = req.body.platforms;
    }

    cryptoMng.encrypt(user.password, function (encryptedPwd) {
        user.password = encryptedPwd;

        daoMng.addUser()(user, function (err, createdUser) {
            if (err) {
                res.send(409, err);
            } else {
                var responseUser = {
                    username: createdUser.username
                };
                res.send(201, responseUser);
            }
            return next(false);
        });
    });
}

function delAuthUser(req, res, next) {
    daoMng.deleteAllUsers(function (err) {
        if (err) {
            res.send(500, {err: err.message});
        } else {
            res.send(204);
        }
        return next(false);
    });
}

function checkAuthBasic(req, res, next) {
    var expectedAuthorizationBasic = 'basic ' + new Buffer(config.management.clientId + ':' + config.management.clientSecret).toString('base64');
    if (req.headers.authorization != expectedAuthorizationBasic) {
        res.send(401, "Missing basic authorization");
        return next(false);
    } else {
        return next();
    }
}

function renewToken(req, res, next) {
    var refreshToken = req.body.refreshToken;
    var data = {};

    if (req.body.deviceId) {
        data.deviceId = req.body.deviceId;
    }

    if (config.version) {
        data.deviceVersion = req.headers[config.version.header];
    }

    tokenMng.getRefreshTokenInfo(refreshToken, function (err, tokenSet) {
        var userAgent = String(req.headers['user-agent']);

        if (err) {
            var errInvalidToken = {
                "err": "invalid_token",
                "des": "Invalid token"
            };
            res.send(401, errInvalidToken);
            return next();
        }
        if (new Date().getTime() > tokenSet.expiresAtTimestamp) {
            var errExpiredToken = {
                "err": "expired_token",
                "des": "Expired token"
            };
            res.send(401, errExpiredToken);
            return next();
        }

        daoMng.getFromId(tokenSet.userId, function (err, foundUser) {
            if (err){
                var errInvalidToken = {
                    "err": "invalid_token",
                    "des": "Invalid token"
                };
                res.send(401, errInvalidToken);
                return next();
            }

            if(!foundUser){
                log.error({err:'invalid_refresh_token', des: "invalid_refresh_token '"+refreshToken+"' contains unknown user '"+ tokenSet.userId +"'"});
                res.send(401, {err:'invalid_refresh_token', des:'unknown user inside token'});
                return next(false);
            }

            async.series([
                function(done){
                    //Add "realms" & "capabilities"
                    daoMng.getRealms(function(err, realms){
                        if(err){
                            log.error({err:err,des:'error obtaining user realms'});
                            return done();
                        }

                        if(!realms || !realms.length) {
                            log.info({des:'there are no REALMS in DB'});
                            return done();
                        }
                        async.eachSeries(realms, function(realm, next){
                            if(!realm.allowedDomains || !realm.allowedDomains.length){
                                return next();
                            }
                            async.eachSeries(realm.allowedDomains, function(domain, more){
                                //wildcard
                                var check = domain.replace(/\*/g,'.*');
                                var match = foundUser.username.match(check);
                                if(!match || foundUser.username !== match[0]){
                                    return more();
                                }

                                if(!data.realms){
                                    data.realms = [];
                                }
                                data.realms.push(realm.name);

                                async.each(Object.keys(realm.capabilities), function(capName, added){
                                    if(!data.capabilities){
                                        data.capabilities = {};
                                    }

                                    data.capabilities[capName] = realm.capabilities[capName];
                                    added();
                                }, more);
                            }, next);
                        }, done);
                    });
                }
            ], function(){
                sessionRequest(data.deviceId, tokenSet.userId, 'POST', userAgent, function (err) {
                    if (err) {
                        log.error({err: err});
                    }
                    tokenMng.createAccessToken(tokenSet.userId, data, function (err, newToken) {
                        if (err) {
                            log.error({err: err});
                        }
                        var body = {
                            accessToken: newToken,
                            expiresIn: config.accessToken.expiration
                        };
                        res.send(200, body);
                        return next();
                    });
                });
            });

        });

    });
}

function addRoutes(service) {
    service.post('/auth/login', postAuthLogin);
    service.post('/auth/user', checkAuthBasic, postAuthUser);
    service.del('/auth/user', checkAuthBasic, delAuthUser);
    service.post('/auth/renew', renewToken);
	require('./auth/logout')(service);
}

module.exports = addRoutes;
