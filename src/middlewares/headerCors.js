var debug = require('debug')('cipherlayer:service');
var config = require('../../config.json');

function headerCors(req, res, next){

    var accessControlAllowConfig;

    if(!config.accessControlAllow) {
        return  next();
    }else{
        accessControlAllowConfig = config.accessControlAllow[0];
    }

    if(accessControlAllowConfig.enabled){
        res.header("Access-Control-Allow-Methods" , accessControlAllowConfig.methods);
        res.header("Access-Control-Allow-Headers" , accessControlAllowConfig.headers);
        res.header("Access-Control-Allow-Credentials" , accessControlAllowConfig.credentials);
        res.header("Access-Control-Allow-Origin" , accessControlAllowConfig.origin);

        if ('OPTIONS' === req.method) {
            res.send(200);
            return next(false);
        }else {
            next();
        }
    }else{
        next();
    }

}

module.exports = headerCors;