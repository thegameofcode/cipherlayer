'use strict';

const userMng = require('../../managers/user');

module.exports = function (req, res, next) {
	userMng().setPassword(req.user._id, req.body, function (err) {
		if (err) {
			if (!err.code) {
				res.send(500, err);
				return next(false);
			}

			var errCode = err.code;
			delete(err.code);
			res.send(errCode, err);
			return next(false);
		}

		res.send(204);
		return next();
	});
};
