'use strict';

const userMng = require('../../managers/user');
const responseError = require('../../util/response_errors');

module.exports = function (req, res, next) {
	userMng().removeRealmFromUser(req.user._id, req.body.name, function (err) {
		if( err ) return responseError(err, res, next);

		res.send(200);
		return next();
	});
};
