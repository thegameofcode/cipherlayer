'use strict';

const async = require('async');

const userDao = require('../../managers/dao');
const redisMng = require('../../managers/redis');

function getStatus(cbk) {
	async.series([
		userDao.getStatus,
		redisMng.getStatus
	], cbk);
}

module.exports = function (req, res, next) {
	getStatus(function (err) {
		if (err) {
			res.send(500, err);
			return next();
		}
		res.send(204);
		return next();
	});
};
