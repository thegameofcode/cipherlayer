var restify = require('restify');
var ciphertoken = require('ciphertoken');
var userDao = require('./dao');
var request = require('request');
var clone = require('clone');
var async = require('async');
var fs = require('fs');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));

var server = null;
var cToken = null;
var accessTokenExpiration = 10;

var ERROR_STARTED_WITHOUT_KEYS = 'started_without_crypto_keys';

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
        name: 'test-server'
    });

    server.use(restify.bodyParser());

    server.post('/auth/login',function(req,res,next){
        userDao.getFromUsernamePassword(req.body.username, req.body.password,function(err,foundUser){
            if(err) {
                res.send(409,{err: err.message});
            } else {
                var tokens = {
                    accessToken : cToken.createAccessToken(foundUser.username),
                    refreshToken : cToken.createAccessToken(foundUser.username),
                    expiresIn : accessTokenExpiration * 60
                };
                res.send(200,tokens);
            }
            return next(false);
        });
    });

    server.post('/auth/user', function(req,res,next){
        userDao.addUser(null, req.body.username,req.body.password,function(err,createdUser){
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
            res.send(400, {
                err: 'auth_proxy_error',
                des: 'invalid userinfo'
            });
            return next(false);
        }

        var user = {
            username : body[config.passThroughEndpoint.username],
            password : body[config.passThroughEndpoint.password]
        };
        delete(body[config.passThroughEndpoint.password]);

        var options = {
            url: 'http://localhost:' + privatePort + req.url,
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            method: req.method,
            body : JSON.stringify(body)
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

                userDao.addUser(user.id, user.username, user.password, function (err, createdUser) {
                    if (err) {
                        res.send(409, {err: err.message});
                        return next(false);
                    } else {
                        userDao.getFromUsernamePassword(createdUser.username, createdUser.password,function(err,foundUser){
                            if(err) {
                                res.send(409,{err: err.message});
                            } else {
                                var tokens = {
                                    accessToken : cToken.createAccessToken(foundUser._id),
                                    refreshToken : cToken.createAccessToken(foundUser._id),
                                    expiresIn : accessTokenExpiration * 60
                                };
                                res.send(201,tokens);
                            }
                            return next(false);
                        });
                    }
                });
            }
        });
    });

    function handleAll(req,res,next){
        var type = 'bearer ';	// !! keep the space at the end for length
        var auth = req.header('Authorization');

        if ( !auth || auth.length <= type.length ){
            res.send(401, {err:'unauthorized'});
            return next();
        }

        var accessToken = auth.substring( type.length );
        var token = cToken.getAccessTokenSet(accessToken);

        if ( token.err ) {
            if ( token.err.err === 'accesstoken_expired' ) {
                res.send(401,{err:'access_token_expired'});
            }
            res.send(401,{err:'access_token_invalid'});
            return next();
        }

        var options = {
            url: 'http://localhost:' + privatePort + req.url,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'x-user-id': token.consummerId
            },
            method: req.method,
            body : JSON.stringify(req.body)
        };

        request(options, function(err,private_res,body) {
            if(err) {
                res.send(500, {err:'auth_proxy_error', des:'there was an internal error when redirecting the call to protected service'});
            } else {
                res.send(Number(private_res.statusCode), JSON.parse(body));
            }
            next();
        });
    }

    server.get(/(.*)/,handleAll);
    server.post(/(.*)/,handleAll);

    server.listen(publicPort, function(){
        cbk();
    });
}

function stopListener(cbk){
    cToken = null;
    server.close(function(){
        cbk();
    });
}

function start(publicPort, privatePort, cbk){

    if (cToken == null) {
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
    cToken = ciphertoken.create(cipherKey,signKey, {
        accessTokenExpirationMinutes: accessTokenExpiration
    });
}

function cleanCryptoKeys(){
    cToken = null;
}

module.exports = {
    start : start,
    stop : stop,
    setCryptoKeys : setCryptoKeys,
    cleanCryptoKeys : cleanCryptoKeys
};
