var debug = require('debug')('cipherlayer:userAppVersion');
var userDao = require('../managers/dao');
var _ = require('lodash');

var config = require('../../config.json');

var updatingUserError = {
    err:'proxy_error',
    des:'error updating user appVersion'
};

var defaultSettings = config;
var _settings = {};

function storeUserAppVersion(req, res, next){
    if(!req.headers[_settings.version.header] || req.user.appVersion === req.headers[_settings.version.header]) {
        debug('appVersion header not found or or is the same as stored [' + req.user.appVersion + '] / [' + req.headers[_settings.version.header] + ']');
        return next();
    } else {
        userDao.updateField(req.user.id, 'appVersion', req.headers[_settings.version.header], function(err, updatedUsers){
            if(err){
                debug('error updating user appVersion ', err);
                res.send(500, updatingUserError);
                return next(false);
            } else {
                debug('user [' + req.user.id + '] appVersion [' + req.headers[_settings.version.header] + '] updated correctly ', err);
                next();
            }
        });
    }
}

module.exports = function(settings){
    _.extend(_settings, defaultSettings, settings);

    return storeUserAppVersion;
};