'use strict';

var async = require('async');

var userDao = require('./managers/dao');
var redisMng = require('./managers/redis');

var publicService = require('./public_service');
var privateService = require('./internal_service');

module.exports = function () {
	var cipherlayer = {};

	cipherlayer.start = function (publicPort, internalPort, cbk) {
		//Validate the current config.json with the schema
		//if( !jsonValidator.isValidJSON(config, configSchema)) {
		//    return cbk({err:'invalid_config_json', des:'The config.json is not updated, check for the last version.'});
		//}

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

	cipherlayer.getStatus = function (cbk) {
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
	};

	return cipherlayer;
}();
