'use strict';

const userMng = require('../../managers/user');

module.exports = function (req, res, next) {

	userMng().removeRealmFromUser(req.user._id, req.body.name, function (err) {
		if (err) {
			if (!err.code) {
				res.send(500, err);
				return next(err);
			}

			const errCode = err.code;
			delete(err.code);
			res.send(errCode, err);
			return next(err);
		}

		res.send(200);
		return next();
	});
};
