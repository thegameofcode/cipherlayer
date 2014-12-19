var debug = require('debug')('cipherlayer:service');
var restify = require('restify');
var request = require('request');
var clone = require('clone');
var async = require('async');
var fs = require('fs');
var path = require('path');
var config = JSON.parse(require('fs').readFileSync('config.json','utf8'));
var passport = require('passport');
var crypto = require('crypto');

var userDao = require('./dao');
var tokenMng = require('./managers/token');
var phoneMng = require('./managers/phone');
var redisMng = require('./managers/redis');
var countrycodes = require('./countrycodes');

var server;

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

function startRedis(cbk){
    redisMng.connect(function(){
        cbk();
    });
}

function stopRedis(cbk){
    redisMng.disconnect(function(){
        cbk();
    });
}

function startListener(publicPort, privatePort, cbk){
    server = restify.createServer({
        name: 'cipherlayer-server'
    });

    server.use(restify.queryParser());
    server.use(restify.bodyParser());
    server.use(function(req,res,next){
        debug('> ' + req.method + ' ' + req.url);
        next();
    });

    server.on('after', function(req, res, route, error){
        var timing = Date.now() - new Date(req._time);
        debug('< ' + res.statusCode + ' ' + res._data + ' ' + timing + 'ms');
    });

    server.on('uncaughtException', function(req, res, route, error) {
        var timing = Date.now() - new Date(req._time);
        debug('< ' + res.statusCode + ' ' + error + ' ' + timing + 'ms');
    });

    //routes
    var routesPath = path.join(__dirname, './routes/');
    fs.readdirSync(routesPath).forEach(function(filename) {
        require(routesPath + filename)(server);
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

        debug('=> '+ req.method + ' ' + options.url);
        request(options, function (err, private_res, body) {
            if (err) {
                debug('<= error: '+ err);
                res.send(500, {
                    err: 'auth_proxy_error',
                    des: 'there was an internal error when redirecting the call to protected service'
                });
                return next(false);
            } else {
                debug('<= '+ private_res.statusCode);
                body = JSON.parse(body);
                user.id = body.id;
                if(!user.password){
                    user.password = crypto.pseudoRandomBytes(12).toString('hex');
                }

                userDao.addUser(user, function (err, createdUser) {
                    if (err) {
                        debug('error adding user: ',err);
                        res.send(409, {err: err.message});
                        return next(false);
                    } else {
                        userDao.getFromUsernamePassword(createdUser.username, createdUser.password, function (err, foundUser) {
                            if (err) {
                                debug('error obtaining user: ',err);
                                res.send(409, {err: err.message});
                                return next(false);
                            } else {
                                tokenMng.createBothTokens(foundUser._id, function(err, tokens){
                                    if(err) {
                                        debug('error creating tokens: ',err);
                                        debug(err);
                                        res.send(409,{err: err.message});
                                    } else {
                                        tokens.expiresIn = config.accessToken.expiration * 60;
                                        res.send(201,tokens);
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

        var phone = body.phone;
        var country = body.country;
        if(!phone){
            res.send(400, {
                err: 'auth_proxy_error',
                des: 'empty phone'
            });
            return next(false);
        } else if(!country){
            res.send(400, {
                err: 'auth_proxy_error',
                des: 'empty country code'
            });
            return next(false);
        } else {
            countrycodes.countryFromIso(country, function(err, returnedCountry){
                if(err) {
                    res.send(400, err);
                    return next(false);
                }   

                phone = '+' + returnedCountry.Dial + phone;
            });
        }

        userDao.getFromUsername(user.username, function(err, foundUser) {
            if(foundUser){
                res.send(403, {
                    err: 'auth_proxy_error',
                    des: 'user already exists'
                });
                return next(false);
            } else {
                var pin = req.headers['x-otp-pin'];

                if(!pin){
                    debug('no pin number');
                    phoneMng.createPIN(user.username, phone, function(err, createdPin){
                        if(err){
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
                        if(err){
                            if(err.err != 'verify_phone_error'){
                                res.send(500, err)
                            } else {
                                res.send(401, err)
                            }
                            return next(false);
                        } else {
                            if(body.sf){
                                tokenMng.getAccessTokenInfo(body.sf, function(err, tokenInfo){
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

                        }
                    });
                }
            }
        });


    });

    var platformsPath = path.join(__dirname, '/platforms/');
    fs.readdirSync(platformsPath).forEach(function(filename) {
        require(platformsPath + filename).addRoutes(server, passport);
    });

    function handleAll(req,res,next){
        var type = 'bearer ';	// !! keep the space at the end for length
        var auth = req.header('Authorization');

        if ( !auth || auth.length <= type.length ){
            res.send(401, {err:'unauthorized'});
            return next();
        }

        var accessToken = auth.substring( type.length );
        tokenMng.getAccessTokenInfo(accessToken, function(err, tokenInfo){
            if ( err ) {
                if ( err.err === 'accesstoken_expired' ) {
                    debug('expired_access_token', accessToken);
                    res.send(401,{err:'expired_access_token', des:'access token expired'});
                    return next();
                }
                debug('invalid_access_token', accessToken, 'unable to read token info');
                res.send(401,{err:'invalid_access_token', des:'unable to read token info'});
                return next();
            }

            userDao.getFromId(tokenInfo.userId, function(err, foundUser){
                if(err){
                    debug('invalid_access_token', accessToken, 'contains unknown user', tokenInfo.userId);
                    res.send(401,{err:'invalid_access_token', des:'unknown user inside token'});
                    return next();
                }

                var options = {
                    url: 'http://localhost:' + privatePort + req.url,
                    headers: {
                        'Content-Type': req.header('Content-Type'),
                        'x-user-id': tokenInfo.userId
                    },
                    method: req.method
                };

                // TODO pass all file data correctly
                if(req.header('Content-Type').indexOf('multipart/form-data') > -1){
                    var formData = {};
                    var files = req.files;
                    for(var fileKey in files){
                        var file = files[fileKey];
                        formData[fileKey] = fs.createReadStream(file.path);
                    }
                    options.formData = formData;
                } else {
                    options.headers['Content-Type'] = req.header('Content-Type');
                    options.body = JSON.stringify(req.body);
                }


                if(foundUser.platforms && foundUser.platforms.length>0){
                    foundUser.platforms.forEach(function(platform){
                        switch(platform.platform){
                            case 'sf':
                                options.headers['x-sf-data'] = JSON.stringify({
                                    userId: platform.accessToken.params.id,
                                    accessToken: platform.accessToken.params.access_token,
                                    instanceUrl: platform.accessToken.params.instance_url
                                });
                                break;

                            case 'in':
                                options.headers['x-in-data'] = JSON.stringify({
                                    accessToken: platform.accessToken
                                });
                                break;
                            default:
                                break;
                        }

                    });
                }

                debug('=> '+ req.method + ' ' + options.url);
                var start = Date.now();
                request(options, function(err,private_res,body) {
                    var timing = Date.now() - start;
                    if(err) {
                        debug('<= ' + private_res.statusCode + ' ' + err + ' ' + timing + 'ms');
                        res.send(500, {err:'auth_proxy_error', des:'there was an internal error when redirecting the call to protected service'});
                    } else {
                        try{
                            body=JSON.parse(body);
                            debug('<= ' + private_res.statusCode + ' json body' + ' ' + timing + 'ms');
                        } catch(err) {
                            debug('<= ' + private_res.statusCode + ' no json body' + ' ' + timing + 'ms');
                        }
                        res.send(Number(private_res.statusCode), body);
                    }
                    next();
                });
            });
        });
    }

    server.get(/(.*)/,handleAll);
    server.post(/(.*)/,handleAll);
    server.use(function(req,res,next){
        debug('< ' + res.statusCode);
        next();
    });

    server.listen(publicPort, function(){
        cbk();
    });
}

function stopListener(cbk){
    server.close(function(){
        cbk();
    });
}

function start(publicPort, privatePort, cbk){
    async.series([
        startDaos,
        startRedis,
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
        stopRedis,
        stopListener
    ],function(err){
        cbk(err);
    });
}

module.exports = {
    start : start,
    stop : stop
};
