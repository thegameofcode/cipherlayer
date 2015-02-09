var debug = require('debug')('cipherlayer:routes:auth');

var userMng = require('../managers/user')();
var config = require('../../config.json');

function createUserEndpoint(req, res, next) {
    userMng.createUser(req, function(err, tokens){
        if (err) {
            if (!err.code ) {
                res.send(500, err);
            } else {
                var errCode = err.code;
                delete(err.code);
                res.send(errCode, err);
            }
            return next(false);
        } else {
            res.send(201, tokens);
            return next();
        }
    });
}


function addRoutes(service){
    service.post(config.passThroughEndpoint.path, createUserEndpoint);

    debug('User creation routes added');
}

module.exports = addRoutes;
