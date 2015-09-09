var log = require('../logger/service.js');
var userDao = require('../managers/dao');
var _ = require('lodash');

var config = require(process.cwd() + '/config.json');

var updatingUserError = {
    err:'proxy_error',
    des:'error updating user appVersion'
};

var defaultSettings = config;
var _settings = {};

function storeUserAppVersion(req, res, next){
    if(!req.headers[_settings.version.header] || req.user.appVersion === req.headers[_settings.version.header]) {
        return next();
    } else {
        userDao.updateField(req.user._id, 'appVersion', req.headers[_settings.version.header], function(err){
            if(err){
                log.error({err:err});
                res.send(500, updatingUserError);
                return next(false);
            } else {
                next();
            }
        });
    }
}

module.exports = function(settings){
    _.extend(_settings, defaultSettings, settings);

    return storeUserAppVersion;
};
