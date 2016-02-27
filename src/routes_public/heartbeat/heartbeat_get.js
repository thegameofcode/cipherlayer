'use strict';

var async = require('async');

var userDao = require('../../managers/dao');
var redisMng = require('../../managers/redis');

function getStatus(cbk) {
	async.series([
		function (done) {
			userDao.getStatus(done);
		},
		function (done) {
			redisMng.getStatus(done);
		}
	], function (err) {
		if (err) {
			return cbk(err);
		}
		cbk();
	});
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
