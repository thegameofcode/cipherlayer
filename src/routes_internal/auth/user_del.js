'use strict';

const daoMng = require('../../managers/dao');

module.exports = function (req, res, next) {
	daoMng.deleteAllUsers(function (err) {
		if (err) {
			res.send(500, {err: err.message});
			return next(err);
		}

		res.send(204);
		return next();
	});
};
