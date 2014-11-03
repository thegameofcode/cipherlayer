var restify = require('restify');
var ciphertoken = require('ciphertoken');
var userDao = require('./dao');

var server = null;
var cToken = null;
var accessTokenExpiration = 0;

var ERROR_STARTED_WITHOUT_KEYS = 'started_without_crypto_keys';

function start(port, cbk){
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
                res.send(409,{err:err.message});
            } else {
                var tokens = {
                    accessToken : cToken.createAccessToken(req.body.username),
                    refreshToken : cToken.createAccessToken(req.body.username),
                    expiresIn : accessTokenExpiration * 60
                };
                res.send(200,tokens);
            }
            return next();
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
            return next();
        });
    });

    server.del('/auth/user', function(req,res,next){
        userDao.deleteAllUsers(function(err){
            if(err){
                res.send(500,{err:err.message});
            } else {
                res.send(204);
            }
            return next();
        });
    });

    server.listen(port, function () {
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