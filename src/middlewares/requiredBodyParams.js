'use strict';

const async = require('async');
const _ = require('lodash');

module.exports = function requireBodyParams(params) {
	return function (req, res, done) {
		async.eachSeries(params, function (param, next) {
			if (_.isEmpty(req.body[param])) {
				const err = {err: 'bad_request', des: `missing ${param} in request body`};
				res.send(400, err);
				return next(err);
			}
			return next();
		});
		return done();
	};
};
