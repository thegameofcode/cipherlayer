'use strict';

const log = require('../logger/service');
const userDao = require('../managers/dao');

module.exports = function findUser(req, res, next) {

	userDao.getFromId(req.params.userId, function (err, foundUser) {
		if (err) {
			const error = {
				err: 'invalid_user',
				des: `invalid_user '${req.params.userId}' is a unknown user`
			};
			log.error(error);
			res.send(400, error);
			return next(err);
		}
		req.user = foundUser;
		return next();
	});
};
