var ciphertoken = require('ciphertoken');
var config = JSON.parse(require('fs').readFileSync('./config.json','utf8'));

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
    if(typeof data === 'function'){
        cbk = data;
        data = {}
    }
    ciphertoken.createToken(accessTokenSettings, userId, null, data, cbk);
}

function getAccessTokenInfo(accessToken, cbk){
    ciphertoken.getTokenSet(accessTokenSettings, accessToken, cbk);
}

function createRefreshToken(userId, data, cbk){
    if(typeof data === 'function'){
        cbk = data;
        data = {}
    }
    ciphertoken.createToken(refreshTokenSettings, userId, null, data, cbk);
}

module.exports={
    createAccessToken: createAccessToken,
    getAccessTokenInfo: getAccessTokenInfo,

    createRefreshToken: createRefreshToken
};