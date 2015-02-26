var debug = require('debug')('cipherlayer:routes:auth');
var userDao = require('../managers/dao');
var tokenManager = require('../managers/token');
var config = require('../../config.json');
var ObjectID = require('mongodb').ObjectID;
var config = JSON.parse(require('fs').readFileSync('config.json','utf8'));
var cryptoMng = require('../managers/crypto')({ password : 'password' });
var request = require("request");

function postAuthLogin(req, res, next){
    cryptoMng.encrypt(req.body.password, function(encryptedPwd){
        userDao.getFromUsernamePassword(req.body.username, encryptedPwd,function(err,foundUser){
            if(err) {
                res.send(409,{err: err.message});
                return next(false);
            } else {
                userDao.getAllUserFields(foundUser.username, function (err, result){
                    if(Array.isArray(result.password)){
                        userDao.updateField(foundUser._id, "password", encryptedPwd, function(err, result){
                            debug('UpdatePasswordField', err, result);
                        });
                    }
                });

                var data = {};
                if(foundUser.role){
                    data.role = foundUser.role;
                }

                if(req.body.deviceId){
                    data.deviceId = req.body.deviceId;
                }

                sessionRequest(data.deviceId, foundUser._id, 'POST', function(err, result){
                    debug('AddDeviceRespose', err, result);
                    tokenManager.createBothTokens(foundUser._id, data , function(err, tokens){
                        if(err) {
                            res.send(409,{err: err.message});
                        } else {
                            tokens.expiresIn = config.accessToken.expiration;
                            res.send(200,tokens);
                        }
                        next(false);
                    });
                });
            }
        });
    });
}

function sessionRequest (deviceId, userId, method, cbk){

    if(deviceId){
        var options = {
            url: 'http://'+ config.private_host + ':' + config.private_port + "/api/me/session",
            headers: {
                'Content-Type' : 'application/json; charset=utf-8',
                'x-user-id': userId
            },
            method: method,
            body: JSON.stringify({"deviceId": deviceId})
        };

        request(options, function(err, res, body ){
            cbk(err, body);
        });

    }else{
        cbk();
    }
}

function postAuthUser(req, res, next){
    var user = {
        id:req.body.id,
        username:req.body.username,
        password:req.body.password
    };

    if(req.body.id){
        user.id = req.body.id;
    } else {
        user.id = new ObjectID();
    }

    if(req.body.platforms){
        user.platforms = req.body.platforms;
    }

    cryptoMng.encrypt(user.password, function(encryptedPwd){
        user.password = encryptedPwd;

        userDao.addUser()(user,function(err,createdUser){
            if(err){
                res.send(409, err);
            } else {
                var responseUser = {
                    username: createdUser.username
                };
                res.send(201,responseUser);
            }
            return next(false);
        });
    });
}

function delAuthUser(req, res, next){
    userDao.deleteAllUsers(function(err){
        if(err){
            res.send(500,{err: err.message});
        } else {
            res.send(204);
        }
        return next(false);
    });
}

function checkAuthBasic(req, res, next){
    var expectedAuthorizationBasic = new Buffer(config.management.clientId + ':' + config.management.clientSecret).toString('base64');
    if (req.headers["authorization basic"] != expectedAuthorizationBasic) {
        res.send(401, "Missing basic authorization");
        return next(false);
    } else {
        return next();
    }
}

function renewToken(req, res, next){
    var refreshToken = req.body.refreshToken;
    var data = {};

    if(req.body.deviceId){
        data.deviceId = req.body.deviceId;
    }

    tokenManager.getRefreshTokenInfo(refreshToken, function(err, tokenSet){
        if (err){
            var errInvalidToken = {
                "err" : "invalid_token",
                "des" : "Invalid token"
            };
            res.send(401, errInvalidToken);
            return next();
        }
        if (new Date().getTime() > tokenSet.expiresAtTimestamp){
            var errExpiredToken = {
                "err" : "expired_token",
                "des" : "Expired token"
            };
            res.send(401, errExpiredToken);
            return next();
        }
        sessionRequest(data.deviceId, tokenSet.userId, 'POST',function(err, result){
            debug('AddDeviceRespose', err, result);
            tokenManager.createAccessToken(tokenSet.userId, data, function(err, newToken){
                var body = {
                    accessToken: newToken,
                    expiresIn: config.accessToken.expiration
                };
                res.send(200, body);
                return next();
            });
        });
    });
}

function authLogout(req, res, next){
    var userId = req.body.userId;
    var deviceId = req.body.deviceId;
    sessionRequest(deviceId , userId, 'DELETE', function(err, result){
        debug('RemoveDeviceRespose', err, result);
        res.send(204);
        return next();
    });
}

function addRoutes(service) {
    service.post('/auth/login', postAuthLogin);
    service.post('/auth/user', checkAuthBasic, postAuthUser);
    service.del('/auth/user', checkAuthBasic, delAuthUser);
    service.post('/auth/renew', renewToken);
    service.post('/auth/logout', authLogout);

    debug('Auth routes added');
}

module.exports = addRoutes;
