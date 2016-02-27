'use strict';

var daoMng = require('../../managers/dao');

module.exports = function (req, res, next) {
	daoMng.deleteAllUsers(function (err) {
		if (err) {
			res.send(500, {err: err.message});
			return next(false);
		}

		res.send(204);
		return next();
	});
};
