'use strict';

const config = require('../../config');

module.exports = (err, req, res, next) => {
	//const msg = err.des || err.message || 'Internal error';

	const defaultUrl = config.redirectOnError.defaultUrl;

	if (!err.code || !config.redirectOnError[err.err]) {
		const url = config.redirectOnError.internal_error || defaultUrl;
		res.redirect(url, next);
		return;
	}

	const url = config.redirectOnError[err.err];

	res.redirect(url, next);
};

