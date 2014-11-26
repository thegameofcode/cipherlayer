var restify = require('restify');
var ciphertoken = require('ciphertoken');
var userDao = require('./dao');
var request = require('request');
var clone = require('clone');
var async = require('async');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));
var countrycodes = require('./countrycodes');

var server;
var accessTokenSettings;
var refreshTokenSettings;

var ERROR_STARTED_WITHOUT_KEYS = 'started_without_crypto_keys';

// PASSPORT
var passport = require('passport');
var forcedotcomStrategy = require('passport-forcedotcom').Strategy;
var salesforceStrategy = new forcedotcomStrategy({
        clientID : config.salesforce.clientId,
        clientSecret : config.salesforce.clientSecret,
        scope : config.salesforce.scope,
        callbackURL : config.salesforce.callbackURL,
        authorizationURL : config.salesforce.authUrl,
        tokenURL: config.salesforce.tokenUrl
    },
    function verify(accessToken, refreshToken, profile, done){
        var data = {
            accessToken:accessToken,
            refreshToken:refreshToken,
            profile:profile
        };
        done(null, data);
    }
);
passport.use(salesforceStrategy);

function startDaos(cbk){
    userDao.connect(function(){
        cbk();
    });
}

function stopDaos(cbk){
    userDao.disconnect(function(){
        cbk();
    });
}

function startListener(publicPort, privatePort, cbk){
    server = restify.createServer({
        name: 'cipherlayer-server'
    });

    server.use(restify.queryParser());
    server.use(restify.bodyParser());

    server.post('/auth/login',function(req,res,next){
        userDao.getFromUsernamePassword(req.body.username, req.body.password,function(err,foundUser){
            if(err) {
                res.send(409,{err: err.message});
                return next(false);
            } else {
                var tokens ={
                    expiresIn: accessTokenSettings.tokenExpirationMinutes * 60
                };
                async.parallel([
                    function(done){
                        ciphertoken.createToken(accessTokenSettings, foundUser._id, null, {}, function(err, token){
                            tokens.accessToken = token;
                            done(err);
                        });
                    },
                    function(done){
                        ciphertoken.createToken(refreshTokenSettings, foundUser._id, null, {}, function(err, token){
                            tokens.refreshToken = token;
                            done(err);
                        });
                    }
                ], function(err){
                    if(err) {
                        res.send(409,{err: err.message});
                    } else {
                        res.send(200,tokens);
                    }
                    next(false);
                });
            }
        });
    });

    server.post('/auth/user', function(req,res,next){
        var user = {
            id:req.body.id,
            username:req.body.username,
            password:req.body.password
        };
        userDao.addUser(user,function(err,createdUser){
            if(err){
                res.send(409,{err:err.message});
            } else {
                var responseUser = {
                    username: createdUser.username
                };
                res.send(201,responseUser);
            }
            return next(false);
        });
    });

    server.del('/auth/user', function(req,res,next){
        userDao.deleteAllUsers(function(err){
            if(err){
                res.send(500,{err:err.message});
            } else {
                res.send(204);
            }
            return next(false);
        });
    });

    server.get('/auth/sf', passport.authenticate('forcedotcom'));
    server.get('/auth/sf/callback', passport.authenticate('forcedotcom', { failureRedirect: '/auth/error', session: false} ), function(req,res,next){
        var data = req.user;
        var profile = data.profile;
        userDao.getFromUsername(profile._raw.email, function(err, foundUser){
            if(err){
                if(err.message == userDao.ERROR_USER_NOT_FOUND){
                    var sfData = {
                        accessToken:data.accessToken,
                        refreshToken:data.refreshToken
                    };
                    ciphertoken.createToken(accessTokenSettings, profile.id, null, sfData, function(err, token){
                        countrycodes.countryFromPhone(profile._raw.mobile_phone, function(err, country){
                            var returnProfile = {
                                name: profile._raw.display_name,
                                email: profile._raw.email,
                                sf: token
                            };

                            if(err == null){
                                returnProfile.country = country['ISO3166-1-Alpha-2'];
                                returnProfile.phone = profile._raw.mobile_phone.replace('+'+country.Dial,'');
                            }

                            res.send(203, returnProfile);
                            next(false);
                        });
                    });
                } else {
                    res.send(500, {err:'internal_error', des:'There was an internal error matching salesforce profile'});
                    next(false);
                }
            } else {
                var tokens ={
                    expiresIn: accessTokenSettings.tokenExpirationMinutes * 60
                };
                async.parallel([
                    function(done){
                        ciphertoken.createToken(accessTokenSettings, foundUser.username, null, {}, function(err, token){
                            tokens.accessToken = token;
                            done(err);
                        });
                    },
                    function(done){
                        ciphertoken.createToken(refreshTokenSettings, foundUser.username, null, {}, function(err, token){
                            tokens.refreshToken = token;
                            done(err);
                        });
                    }
                ], function(err){
                    if(err) {
                        res.send(409,{err: err.message});
                    } else {
                        res.send(200,tokens);
                    }
                    next(false);
                });
            }
            next(false);
        });
    });

    function createUser(req, body, res, next, user) {
        var options = {
            url: 'http://localhost:' + privatePort + req.url,
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            method: req.method,
            body: JSON.stringify(body)
        };

        request(options, function (err, private_res, body) {
            if (err) {
                res.send(500, {
                    err: 'auth_proxy_error',
                    des: 'there was an internal error when redirecting the call to protected service'
                });
                return next(false);
            } else {
                body = JSON.parse(body);
                user.id = body.id;

                userDao.addUser(user, function (err, createdUser) {
                    if (err) {
                        res.send(409, {err: err.message});
                        return next(false);
                    } else {
                        userDao.getFromUsernamePassword(createdUser.username, createdUser.password, function (err, foundUser) {
                            if (err) {
                                res.send(409, {err: err.message});
                                return next(false);
                            } else {
                                var tokens = {
                                    expiresIn: accessTokenSettings.tokenExpirationMinutes * 60
                                };
                                async.parallel([
                                    function (done) {
                                        ciphertoken.createToken(accessTokenSettings, foundUser._id, null, {}, function (err, token) {
                                            tokens.accessToken = token;
                                            done(err);
                                        });
                                    },
                                    function (done) {
                                        ciphertoken.createToken(refreshTokenSettings, foundUser._id, null, {}, function (err, token) {
                                            tokens.refreshToken = token;
                                            done(err);
                                        });
                                    }
                                ], function (err) {
                                    if (err) {
                                        res.send(409, {err: err.message});
                                    } else {
                                        res.send(201, tokens);
                                    }
                                    return next(false);
                                });
                            }
                        });
                    }
                });
            }
        });
    }

    server.post(config.passThroughEndpoint.path, function(req,res,next){
        var body = clone(req.body);

        if (body[config.passThroughEndpoint.username] == undefined) {
            res.send(400, {
                err: 'auth_proxy_error',
                des: 'invalid userinfo'
            });
            return next(false);
        }

        if (body[config.passThroughEndpoint.password] == undefined) {
            if(body.sf == undefined){
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

        if(body.sf){
            ciphertoken.getTokenSet(accessTokenSettings, body.sf, function(err, tokenInfo){
                if(err){
                    res.send(400, {
                        err: 'invalid_platform_token',
                        des: 'you must provide a valid salesforce token'
                    });
                    return next(false);
                }

                user.platforms=[{
                    platform:'sf',
                    accessToken: tokenInfo.data.accessToken,
                    refreshToken: tokenInfo.data.refreshToken,
                    expiry: new Date().getTime() + tokenInfo.data.expiresIn * 1000
                }];

                createUser(req, body, res, next, user);
            });
        } else {
            createUser(req, body, res, next, user);
        }
    });

    function handleAll(req,res,next){
        var type = 'bearer ';	// !! keep the space at the end for length
        var auth = req.header('Authorization');

        if ( !auth || auth.length <= type.length ){
            res.send(401, {err:'unauthorized'});
            return next();
        }

        var accessToken = auth.substring( type.length );
        ciphertoken.getTokenSet(accessTokenSettings, accessToken, function(err, tokenInfo){
            if ( err ) {
                if ( err.err === 'accesstoken_expired' ) {
                    res.send(401,{err:'expired_access_token', des:'access token expired'});
                }
                res.send(401,{err:'invalid_access_token', des:'unable to read token info'});
                return next();
            }

            userDao.getFromId(tokenInfo.userId, function(err, foundUser){
                if(err){
                    res.send(401,{err:'invalid_access_token', des:'unknown user inside token'});
                    return next();
                }

                var options = {
                    url: 'http://localhost:' + privatePort + req.url,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'x-user-id': tokenInfo.userId
                    },
                    method: req.method,
                    body : JSON.stringify(req.body)
                };

                if(foundUser.platforms && foundUser.platforms.length>0){
                    foundUser.platforms.forEach(function(platform){
                        if(platform.platform == 'sf'){
                            options.headers['x-sf-data'] = JSON.stringify({
                                userId: platform.accessToken.params.id,
                                accessToken: platform.accessToken.params.access_token,
                                instanceUrl: platform.accessToken.params.instance_url
                            })
                        }
                    });
                }

                request(options, function(err,private_res,body) {
                    if(err) {
                        console.log(options);
                        console.log(err);
                        res.send(500, {err:'auth_proxy_error', des:'there was an internal error when redirecting the call to protected service'});
                    } else {
                        res.send(Number(private_res.statusCode), JSON.parse(body));
                    }
                    next();
                });
            });
        });
    }

    server.get(/(.*)/,handleAll);
    server.post(/(.*)/,handleAll);

    server.listen(publicPort, function(){
        cbk();
    });
}

function stopListener(cbk){
    accessTokenSettings = null;
    refreshTokenSettings = null;

    server.close(function(){
        cbk();
    });
}

function start(publicPort, privatePort, cbk){

    if (accessTokenSettings == null) {
        return cbk(new Error(ERROR_STARTED_WITHOUT_KEYS));
    }

    async.series([
        startDaos,
        function(done){
            startListener(publicPort, privatePort, done);
        }
    ],function(err){
        cbk(err);
    });
}

function stop(cbk){
    async.series([
        stopDaos,
        stopListener
    ],function(err){
        cbk(err);
    });
}

function setCryptoKeys(cipherKey, signKey, expiration){
    accessTokenExpiration = expiration;

    accessTokenSettings = {
        cipherKey: cipherKey,
        firmKey: signKey,
        tokenExpirationMinutes: expiration
    };

    refreshTokenSettings = {
        cipherKey: cipherKey,
        firmKey: signKey,
        tokenExpirationMinutes: expiration * 1000
    };
}

function cleanCryptoKeys(){
    accessTokenSettings = null;
    refreshTokenSettings = null;
}

module.exports = {
    start : start,
    stop : stop,
    setCryptoKeys : setCryptoKeys,
    cleanCryptoKeys : cleanCryptoKeys
};
