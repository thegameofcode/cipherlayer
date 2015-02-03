var debug = require('debug')('cipherlayer:service');
var config = require('../../config.json');

function checkAccessTokenParam (req, res, next){
    var paramAT = req.params.at;

    if(paramAT){
        req.headers.authorization = config.authHeaderKey + paramAT;
    }

    next();
}

module.exports = checkAccessTokenParam;
