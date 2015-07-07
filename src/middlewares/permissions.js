var debug = require('debug')('cipherlayer:service');
var config = require('../../config.json');
var _ = require('lodash');
var async = require('async');

function checkPermissions (req, res, next){
    if(!config.endpoints){
        return next();
    }

    var role = req.tokenInfo.data.role || 'user';
    var path = req._url.pathname;
    var method = req.method;

    var hasPermissions = false;

    for(var i= 0; i< config.endpoints.length; i++){
        var matchPath = path.match(new RegExp(config.endpoints[i].path, 'g'));
        var matchMethod = _.includes(config.endpoints[i].methods, method);
        var matchRole = _.includes(config.endpoints[i].roles, role);

        if( matchPath && matchMethod ){
            if(matchRole){
                hasPermissions = true;
            }
            break;
        }
    }

    if(!hasPermissions) {
        res.send(401, {err: 'unauthorized'});
        return next(false);
    }
    return next();
}

module.exports = checkPermissions;
