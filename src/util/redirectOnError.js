'use strict';

const config = require('../../config');
const redirectOnErrorEnabled = () => config.redirectOnError && config.redirectOnError.enabled;
const redirectOnError = (err, req, res, next) => {

	let url = config.redirectOnError.default_url;

	if (!err.code || !config.redirectOnError[err.err]) {
		url = config.redirectOnError.internal_error || url;
	}

	url = config.redirectOnError[err.err];

	res.redirect(url, next);
};

module.exports = {
	enabled: redirectOnErrorEnabled,
	redirect: redirectOnError
};

