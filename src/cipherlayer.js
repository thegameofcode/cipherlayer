'use strict';

var async = require('async');

var userDao = require('./managers/dao');
var redisMng = require('./managers/redis');

var publicService = require('./public_service');
var privateService = require('./internal_service');

module.exports = function () {
	var cipherlayer = {};

	cipherlayer.start = function (publicPort, internalPort, cbk) {

		async.series([
			userDao.connect,
			redisMng.connect,
			function (done) {
				publicService.start(publicPort, done);
			},
			function (done) {
				privateService.start(internalPort, done);
			}
		], function (err) {
			cbk(err);
		});
	};

	cipherlayer.stop = function stop(cbk) {
		async.series([
			userDao.disconnect,
			redisMng.disconnect,
			publicService.stop,
			privateService.stop
		], function (err) {
			cbk(err);
		});
	};

	return cipherlayer;
}();
