var debug = require('debug')('cipherlayer:routes:auth');
var clone = require('clone');
var request = require('request');
var RandExp = require('randexp');

var userDao = require('../managers/dao');
var config = JSON.parse(require('fs').readFileSync('config.json','utf8'));
var cryptoMng = require('../managers/crypto')({ password : 'password' });
var emailMng = require('../managers/email');
var tokenManager = require('../managers/token');

var userMng = require('../managers/user');

var checkAccessTokenParam = require('../middlewares/accessTokenParam.js');
var checkAuthHeader = require('../middlewares/authHeader.js');
var decodeToken = require('../middlewares/decodeToken.js');
var findUser = require('../middlewares/findUser.js');

function sendNewPassword(req, res, next){

    if(!req.params.email){
        res.send(400, {
            err: 'auth_proxy_error',
            des: 'empty email'
        });
        return next(false);
    }

    userDao.getAllUserFields(req.params.email, function(err, foundUser){
        if (!foundUser) {
            res.send(404, {
                err: 'user_not_found',
                des: 'email does not exists'
            });
            return next(false);
        }else{
            var passwd = new RandExp(new RegExp(config.password.generatedRegex)).gen();

            cryptoMng.encrypt(passwd, function(encryptedPassword){
                var fieldValue = [];

                if(Array.isArray(foundUser.password)){
                    fieldValue = [foundUser.password[0], encryptedPassword];
                }else{
                    fieldValue = [foundUser.password, encryptedPassword];
                }

                userDao.updateField(foundUser._id, 'password', fieldValue, function(err, result){
                    if(err){
                        res.send(500, {
                            err: 'auth_proxy_error',
                            des: 'internal error setting a new password'
                        });

                        return next(false);

                    }else{
						var data = {};
						if(foundUser.role){
							data.role = foundUser.role;
						}
						tokenManager.createBothTokens(foundUser._id, data , function(err, tokens) {

							var link = config.emailVerification.redirectProtocol + '://user/refreshToken/' + tokens.refreshToken;
							emailMng().sendEmailForgotPassword(req.params.email, passwd, link, function (err) {
								if (err) {
									res.send(500, {err: 'internalError', des: 'Internal server error'});
								} else {
									res.send(204);
								}
								return next(false);
							});
						});
                    }
                });
            });
        }
    });
}

function createUserEndpoint(req, res, next) {
    userMng().createUser(req.body, req.headers['x-otp-pin'], function(err, tokens){
        if (err) {
            if (!err.code ) {
                res.send(500, err);
            } else {
                var errCode = err.code;
                delete(err.code);
                res.send(errCode, err);
            }
            return next(false);
        } else {
            res.send(201, tokens);
            return next();
        }
    });
}

function createUserByToken(req, res, next) {
    if(!req.params){
        res.send(400, {
            err: 'invalid_url_params',
            des: 'The call to this url must have params.'
        } );
        return next();
    }

    userMng().createUserByToken(req.params.verifyToken, function(err, tokens){
        if (err) {
            if (!err.code ) {
                res.send(500, err);
            } else {
                var errCode = err.code;
                delete(err.code);
                res.send(errCode, err);
            }
            return next(false);
        } else {
            var compatibleDevices = config.emailVerification.compatibleEmailDevices;
            var device = String(req.headers['user-agent']);

            for(var i = 0; i < compatibleDevices.length; i++){
                var exp = compatibleDevices[i];
                var check = exp.replace(/\*/g,'.*');
                var match = device.match(check);
                var isCompatible = (match !== null && device === match[0]);
                debug('match \''+ device +'\' with \'' + exp + '\' : ' + isCompatible);
                if(isCompatible) {
                    debug('device \''+device+'\'');
                    res.header('Location', config.emailVerification.redirectProtocol + '://user/refreshToken/' + tokens.refreshToken );
                    res.send(302);
                    return next(false);
                }
            }
            res.send(200, { msg: config.emailVerification.nonCompatibleEmailMsg } );
            return next();
        }
    });
}

function checkBody(req, res, next) {
    var err;
    if (!req.body){
        err = {
            err: 'invalid_body',
            des: 'The call to this url must have body.'
        };
        res.send(400, err);
        return next(false);
    }

    return next();
}

function validateOldPassword(req, res, next) {
    var err;
    if (!config.password.validateOldPassword) {
        return next();
    }

    if (!req.body.oldPassword) {
        err = {
            err: 'missing_password',
            des: 'Missing old password validation'
        };
        res.send(400, err);
        return next(false);
    }

    debug('validating old password', req.user.password, req.body);

    userMng().validateOldPassword(req.user.username, req.body.oldPassword, function(err){
        if (err) {
            res.send(401, err);
            return next(false);
        }
        return next();
    });

}

function setPassword(req, res, next){

    userMng().setPassword(req.user._id, req.body, function(err, modified){
        if (err) {
            if (!err.code ) {
                res.send(500, err);
            } else {
                var errCode = err.code;
                delete(err.code);
                res.send(errCode, err);
            }
            return next(false);
        } else {
            res.send(204);
            return next();
        }
    });
}

function addRoutes(service){
    service.get('/user/:email/password', sendNewPassword);

    service.post(config.passThroughEndpoint.path, createUserEndpoint);
    service.get('/user/activate', createUserByToken);

    service.put('/user/me/password', checkAccessTokenParam, checkAuthHeader, decodeToken, checkBody, findUser, validateOldPassword, setPassword);

    debug('User routes added');
}

module.exports = addRoutes;
