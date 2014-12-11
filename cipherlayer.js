var debug = require('debug')('cipherlayer:service');
var restify = require('restify');
var request = require('request');
var clone = require('clone');
var async = require('async');
var fs = require('fs');
var path = require('path');
var config = JSON.parse(require('fs').readFileSync('config.json','utf8'));
var passport = require('passport');

var userDao = require('./dao');
var tokenManager = require('./managers/token');

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

function startListener(publicPort, privatePort, cbk){
    server = restify.createServer({
        name: 'cipherlayer-server'
    });

    server.use(restify.queryParser());
    server.use(restify.bodyParser());

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
                                tokenManager.createBothTokens(foundUser._id, function(err, tokens){
                                    if(err) {
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

        if(body.sf){
            tokenManager.getAccessTokenInfo(body.sf, function(err, tokenInfo){
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

    var platformsPath = path.join(__dirname, '/platforms/');
    fs.readdirSync(platformsPath).forEach(function(filename) {
        require(platformsPath + filename)(server, passport);
    });

    function handleAll(req,res,next){
        var type = 'bearer ';	// !! keep the space at the end for length
        var auth = req.header('Authorization');

        if ( !auth || auth.length <= type.length ){
            res.send(401, {err:'unauthorized'});
            return next();
        }

        var accessToken = auth.substring( type.length );
        tokenManager.getAccessTokenInfo(accessToken, function(err, tokenInfo){
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

                request(options, function(err,private_res,body) {
                    if(err) {
                        res.send(500, {err:'auth_proxy_error', des:'there was an internal error when redirecting the call to protected service'});
                    } else {
                        try{
                            body=JSON.parse(body);
                        } catch(err) {
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

module.exports = {
    start : start,
    stop : stop
};
