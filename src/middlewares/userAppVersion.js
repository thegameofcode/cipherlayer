const _ = require('lodash');

const log = require('../logger/service');
const userDao = require('../managers/dao');
const config = require('../../config.json');

var updatingUserError = {
	err: 'proxy_error',
	des: 'error updating user appVersion'
};

var defaultSettings = config;
var _settings = {};

function storeUserAppVersion(req, res, next) {
	if (!req.headers[_settings.version.header] || req.user.appVersion === req.headers[_settings.version.header]) {
		return next();
	}
	userDao.updateField(req.user._id, 'appVersion', req.headers[_settings.version.header], function (err) {
		if (err) {
			log.error({ err });
			res.send(500, updatingUserError);
			return next(false);
		}
		return next();
	});
}

module.exports = function (settings) {
	_.extend(_settings, defaultSettings, settings);

	return storeUserAppVersion;
};
