'use strict';

const logger = require('../logger/service');

const redirectOnErrorEnabled = config => () => config.redirectOnError && config.redirectOnError.enabled;
const redirectOnError = config => (err, req, res, next) => {

	let url = config.redirectOnError.default_url || '/error';

	if (!err.code || !config.redirectOnError[err.err]) {
		url = config.redirectOnError.internal_error || url;
	}

	url = config.redirectOnError[err.err] || url;

	logger.info(`Redirecting to ${url} after error`, err, err.err);
	// set no-cache headers
	res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
	res.header('Expires', '-1');
	res.header('Pragma', 'no-cache');
	res.redirect(302, url, next);
};

module.exports = config => ({
	enabled: redirectOnErrorEnabled(config),
	redirect: redirectOnError(config)
});

