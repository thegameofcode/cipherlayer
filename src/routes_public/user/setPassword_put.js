'use strict';

const userMng = require('../../managers/user');
const responseError = require('../../util/response_errors');

module.exports = function (req, res, next) {
	userMng().setPassword(req.user._id, req.body, function (err) {
		if( err ) return responseError(err, res, next);

		res.send(204);
		return next();
	});
};
