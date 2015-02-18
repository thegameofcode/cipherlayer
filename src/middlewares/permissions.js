var debug = require('debug')('cipherlayer:service');
var config = require('../../config.json');
var tokenMng = require('../managers/token');
var _ = require('lodash');

function checkPermissions (req, res, next){

    var role = req.tokenInfo.data.role;
    var path = req._url.pathname;
    var method = req.method;

    checkRestrictedPathRole(path, method, role, function(err){
        if(err){
            res.send(401, err);
            return next(false);
        }else{
            return next();
        }

    });
}

function checkRestrictedPathRole(path, method, role, cbk){
    cbk(_.find(config.restrictEndpoints, function(restricted){

        if(path.indexOf(restricted.path) > -1 && restricted.methods.indexOf(method) > -1){

            if(role && role == "admin"){
                cbk();
            }else{
                cbk({err:'unauthorized'});
            }
        }
    }));

}

module.exports = checkPermissions;
