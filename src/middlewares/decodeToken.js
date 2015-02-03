var debug = require('debug')('cipherlayer:service');
var config = require('../../config.json');
var tokenMng = require('../managers/token');

function decodeToken (req, res, next){
    var accessToken = req.auth.substring(config.authHeaderKey.length);
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

module.exports = decodeToken;
