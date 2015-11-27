var async = require('async');
var ciphertoken = require('ciphertoken');
var config = require(process.cwd() + '/config.json');

var accessTokenSettings = {
    cipherKey: config.accessToken.cipherKey,
    firmKey: config.accessToken.signKey,
    tokenExpirationMinutes: config.accessToken.expiration * 60
};

var refreshTokenSettings = {
    cipherKey: config.refreshToken.cipherKey,
    firmKey: config.refreshToken.signKey,
    tokenExpirationMinutes: 1440 * 1000
};

function createAccessToken(userId, data ,cbk){

    if (!userId) {
      return cbk({err: 'user_id_required'});
    }

    if(typeof data === 'function'){
        cbk = data;
        data = {};
    }
    ciphertoken.createToken(accessTokenSettings, userId, null, data, cbk);
}

function getAccessTokenInfo(accessToken, cbk){
    ciphertoken.getTokenSet(accessTokenSettings, accessToken, cbk);
}

function getRefreshTokenInfo(refreshToken, cbk){
    ciphertoken.getTokenSet(refreshTokenSettings, refreshToken, cbk);
}

function createRefreshToken(userId, data, cbk){

    if (!userId) {
        return cbk({err: 'user_id_required'});
    }

    if(typeof data === 'function'){
        cbk = data;
        data = {};
    }
    ciphertoken.createToken(refreshTokenSettings, userId, null, data, cbk);
}

function createBothTokens(userId, data, cbk){
    var tokens = {};

    async.parallel([
        function(done){
            createAccessToken(userId, data, function(err, token){
                tokens.accessToken = token;
                done(err);
            });
        },
        function(done){
            createRefreshToken(userId, data, function(err, token){
                tokens.refreshToken = token;
                done(err);
            });
        }
    ], function(err){
        if(err) {
            cbk(err,null);
        } else {
            cbk(null, tokens);
        }
    });
}

module.exports={
    createAccessToken: createAccessToken,
    getAccessTokenInfo: getAccessTokenInfo,
    createRefreshToken: createRefreshToken,
    createBothTokens: createBothTokens,
    getRefreshTokenInfo: getRefreshTokenInfo
};
