var assert = require('assert');
var request = require('request');
var config = require('../../config.json');
var dao = require('../../src/managers/dao.js');
var _ = require('lodash');

module.exports = {
	describe: function () {
		describe('/in', function () {
			beforeEach(function (done) {
				if(config.version){
					var platform = Object.keys(config.version.platforms)[0];
					var version = Object.keys(platform)[1];
					OPTIONS.headers[config.version.header] = platform + '/' + version;
				}

				dao.deleteAllUsers(function (err) {
					assert.equal(err, null);
					done();
				});
			});

			it('GET 302', function (done) {
				var options = _.clone(OPTIONS);
				options.url = 'http://localhost:' + config.public_port + '/auth/in';

				request(options, function (err, res, body) {
					assert.equal(err, null);
					assert.equal(res.statusCode, 302, body);
					done();
				});
			});

			describe('/callback', function () {
				it('302 invalid data', function (done) {
					var options = _.clone(OPTIONS);
					options.url = 'http://localhost:' + config.public_port + '/auth/in/callback';

					request(options, function (err, res, body) {
						assert.equal(err, null);
						assert.equal(res.statusCode, 302, body);
						done();
					});
				});
			});
		});
	}
};

var OPTIONS = {
	headers: {
		'Content-Type': 'application/json; charset=utf-8'
	},
	method: 'GET',
	followRedirect: false
};
