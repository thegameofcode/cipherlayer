'use strict';

const _ = require('lodash');

const log = require('../logger/service');
const userDao = require('../managers/dao');
const config = require('../../config');

const updatingUserError = {
	err: 'proxy_error',
	des: 'error updating user appVersion'
};

let _settings = {};

function storeUserAppVersion(req, res, next) {
	if (!req.headers[_settings.version.header] || req.user.appVersion === req.headers[_settings.version.header]) {
		return next();
	}
	userDao.updateField(req.user._id, 'appVersion', req.headers[_settings.version.header], function (err) {
		if (err) {
			log.error({ err });
			res.send(500, updatingUserError);
			return next(err);
		}
		return next();
	});
}

module.exports = function (settings) {
	_settings = _.extend({}, config, settings);

	return storeUserAppVersion;
};
