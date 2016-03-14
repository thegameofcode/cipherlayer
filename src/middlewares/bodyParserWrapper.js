'use strict';

const config = require('../../config');
const _ = require('lodash');

module.exports = function (middleware) {
	return function (req, res, next) {

		const useDirectProxy = _.some(config.directProxyUrls, function (pattern) {
			return req.url.match(new RegExp(pattern, 'g'));
		});

		// if url is a proxy request, don't do anything and move to next middleware
		if (useDirectProxy) {
			return next();
		}

		// some middleware is an array (ex. bodyParser)
		if (middleware instanceof Array) {
			middleware[0](req, res, function () {
				middleware[1](req, res, next);
			});
		} else {
			middleware(req, res, next);
		}
	};
};
