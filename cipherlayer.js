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
var redisMng = require('./managers/redis');
var countrycodes = require('./countrycodes');

var server;

var AUTH_HEADER_KEY = 'bearer ';	// !! keep the space at the end for length

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
        res.send(500, {err:'internal_error'});
    });

    //routes
    var routesPath = path.join(__dirname, './routes/');
    fs.readdirSync(routesPath).forEach(function(filename) {
        require(routesPath + filename)(server);
    });


    var platformsPath = path.join(__dirname, '/platforms/');
    fs.readdirSync(platformsPath).forEach(function(filename) {
        require(platformsPath + filename).addRoutes(server, passport);
    });

    server.get(/(.*)/, printTraces, checkAuthHeader, decodeToken, findUser, prepareOptions, platformsMiddlewares, propagateRequest);
    server.post(/(.*)/, printTraces, checkAuthHeader, decodeToken, findUser, prepareOptions, platformsMiddlewares, propagateRequest);
    server.use(function(req, res, next){
        debug('< ' + res.statusCode);
        next();
    });

    server.listen(publicPort, function(){
        cbk();
    });
}

function printTraces (req, res, next){
    var url = 'http://localhost:' + config.private_port + req.url;
    debug('=> ' + req.method + ' ' + url);
    next();
}

function checkAuthHeader (req, res, next){
    req.auth = req.header('Authorization');
    if ( !req.auth || req.auth.length <= AUTH_HEADER_KEY.length ){
        res.send(401, {err:'unauthorized'});
        return next(false);
    } else {
        next();
    }
}

function decodeToken (req, res, next){
    var accessToken = req.auth.substring(AUTH_HEADER_KEY.length);
    req.accessToken = accessToken;
    tokenMng.getAccessTokenInfo (accessToken, function(err, tokenInfo) {
        if (err) {
            if (err.err === 'accesstoken_expired') {
                debug('expired_access_token', accessToken);
                res.send(401, {err: 'expired_access_token', des: 'access token expired'});
                return next(false);
            }
            debug('invalid_access_token', accessToken, 'unable to read token info');
            res.send(401, {err: 'invalid_access_token', des: 'unable to read token info'});
            return next(false);
        } else {
            req.tokenInfo = tokenInfo;
            return next();
        }
    });
}

function findUser (req, res, next){
    userDao.getFromId(req.tokenInfo.userId, function(err, foundUser){
       if (err){
           debug('invalid_access_token', req.accessToken, 'contains unknown user', req.tokenInfo.userId);
           res.send(401, {err:'invalid_access_token', des:'unknown user inside token'});
           return next(false);
       } else {
           req.user = foundUser;
           next();
       }
    });
}

function prepareOptions (req, res, next){
    var options = {
        url: 'http://localhost:' + config.private_port + req.url,
        headers: {
            'Content-Type': req.header('Content-Type'),
            'x-user-id': req.tokenInfo.userId
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
    req.options = options;
    return next();
}

function platformsMiddlewares (req, res, next){
    if (!req.user.platforms){
        return next();
    } else {
        req.user.platforms.forEach(function(platform){
            if (platform.platform == 'sf'){
                renewSFAccessTokenIfNecessary(req.user, platform, function(err, accessToken){
                    if (err){
                        res.send(401, {err: 'Could not renew SF token', des: 'Unable to renew sales force access token, got error: ' + err});
                        return next(false);
                    }
                    req.options.headers['x-sf-data'] = JSON.stringify({
                        userId: platform.accessToken.params.id,
                        accessToken: accessToken,
                        instanceUrl: platform.accessToken.params.instance_url
                    });
                    return next();
                });
            }
            if (platform.platform == 'in'){
                req.options.headers['x-in-data'] = JSON.stringify({
                    accessToken: platform.accessToken
                });
                return next();
            }
        });
    }
}

function propagateRequest(req, res, next){
    var start = Date.now();

    request(req.options, function(err, private_res, body) {
        var timing = Date.now() - start;
        if(err) {
            debug('<= ' + private_res.statusCode + ' ' + err + ' ' + timing + 'ms');
            res.send(500, {err:' auth_proxy_error', des: 'there was an internal error when redirecting the call to protected service'});
        } else {
            try{
                body = JSON.parse(body);
                debug('<= ' + private_res.statusCode + ' json body' + ' ' + timing + 'ms');
            } catch(err) {
                debug('<= ' + private_res.statusCode + ' no json body' + ' ' + timing + 'ms');
            }
            res.send(Number(private_res.statusCode), body);
        }

        return next();
    });
}

function renewSFAccessTokenIfNecessary(user, platform, cbk){
    var maxTimeTillRenewal = (new Date().getTime() + config.salesforce.renewWhenLessThan * 60 * 1000);
    if(platform.expiry > maxTimeTillRenewal){
        return cbk(null, platform.accessToken.params.access_token);
    }
    var optionsForSFRenew = {
        url: config.salesforce.tokenUrl + '?grant_type=refresh_token' + '&' +
        'client_id=' + config.salesforce.clientId + '&' +
        'client_secret=' + config.salesforce.clientSecret + '&' +
        'refresh_token=' + platform.refreshToken,
        method: 'POST'
    };

    request(optionsForSFRenew, function(err, res, body){
        if (err){
            return cbk(err);
        }
        body = JSON.parse(body);
        var newAccessToken = body.access_token;

        var newSFplatformItem = {
            "platform": "sf",
            "accessToken": {
                "params": {
                    "id": user.userId,
                    "instance_url": platform.accessToken.params.instance_url,
                    "access_token": body.access_token
                }
            },
            "refreshToken": platform.refreshToken,
            "expiry": new Date().getTime() + config.salesforce.expiration * 60 * 1000
        };
        userDao.updateArrayItem(user._id, 'platforms', 'sf', newSFplatformItem, function(err, updatedUsers){
            if (err){
                return cbk(err);
            } else {
                return cbk(null, newAccessToken);
            }
        });
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
