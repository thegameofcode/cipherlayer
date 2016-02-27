'use strict';

const daoMng = require('../../managers/dao');

module.exports = function getRealms(req, res, next) {
	daoMng.getRealms(function (err, realms) {
		if (err) {
			res.send(500, {err: 'internalError', des: 'Internal server error'});
			return next(false);
		}

		res.send(200, { realms });
		return next();
	});
};
