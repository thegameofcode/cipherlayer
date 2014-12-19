var debug = require('debug')('cipherlayer:routes:auth');
var userDao = require('../dao');
var tokenManager = require('../managers/token');
var config = JSON.parse(require('fs').readFileSync('config.json','utf8'));
var ObjectID = require('mongodb').ObjectID;

function postAuthLogin(req,res,next){
    userDao.getFromUsernamePassword(req.body.username, req.body.password,function(err,foundUser){
        if(err) {
            res.send(409,{err: err.message});
            return next(false);
        } else {
            tokenManager.createBothTokens(foundUser._id, function(err, tokens){
                if(err) {
                    res.send(409,{err: err.message});
                } else {
                    tokens.expiresIn = config.accessToken.expiration;
                    res.send(200,tokens);
                }
                next(false);
            });
        }
    });
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

    userDao.addUser(user,function(err,createdUser){
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
    tokenManager.getRefreshTokenInfo(refreshToken, function(err, tokenSet){
        if (err){
            var body = {
                "err" : "invalid_token",
                "des" : "Invalid token"
            };
            res.send(401, body);
            return next();
        }
        if (new Date().getTime() > tokenSet.expiresAtTimestamp){
            var body = {
                "err" : "expired_token",
                "des" : "Expired token"
            };
            res.send(401, body);
            return next();
        }
        tokenManager.createAccessToken(tokenSet.userId, '', function(err, newToken){
            var body = {
                accessToken: newToken,
                expiresIn: config.accessToken.expiration
            };
            res.send(200, body);
            return next();
        });
    });
}

function addRoutes(service) {
    service.post('/auth/login', postAuthLogin);
    service.post('/auth/user', checkAuthBasic, postAuthUser);
    service.del('/auth/user', checkAuthBasic, delAuthUser);
    service.post('/auth/renew', renewToken);

    debug('Auth routes added');
}

module.exports = addRoutes;
