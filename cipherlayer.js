var restify = require('restify');
var ciphertoken = require('ciphertoken');

var server = null;
var cToken = null;
var accessTokenExpiration = 0;

function start(port, cbk){
    server = restify.createServer({
        name: 'test-server'
    });

    server.post('/auth/login',function(req,res,next){
        var tokens = {
            accessToken : cToken.createAccessToken('0'),
            refreshToken : cToken.createAccessToken('0'),
            expiresIn : accessTokenExpiration * 60
        };
        res.send(200,tokens);
        return next();
    });

    server.listen(port, function () {
        cbk();
    });
}

function stop(cbk){
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

module.exports = {
    start : start,
    stop : stop,
    setCryptoKeys : setCryptoKeys
};