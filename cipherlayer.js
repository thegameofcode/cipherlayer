var restify = require('restify');
var ciphertoken = require('ciphertoken');
var userDao = require('./dao');
var request = require('request');

var server = null;
var cToken = null;
var accessTokenExpiration = 10;

var ERROR_STARTED_WITHOUT_KEYS = 'started_without_crypto_keys';

function start(public_port, private_port, cbk){
    if (cToken == null) {
        return cbk(new Error(ERROR_STARTED_WITHOUT_KEYS));
    }

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
                    accessToken : cToken.createAccessToken(req.body.username),
                    refreshToken : cToken.createAccessToken(req.body.username),
                    expiresIn : accessTokenExpiration * 60
                };
                res.send(200,tokens);
            }
            return next(false);
        });
    });

    server.post('/auth/user', function(req,res,next){
        userDao.addUser(req.body.username,req.body.password,function(err,createdUser){
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
            url: 'http://localhost:' + private_port + req.url,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'x-user-id': token.consummerId
            },
            method: req.method,
            body : req.body
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

    server.listen(public_port, function () {
        cbk();
    });
}

function stop(cbk){
    cToken = null;
    server.close(function(){
        cbk();
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
