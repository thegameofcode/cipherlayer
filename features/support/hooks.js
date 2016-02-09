var clone = require('clone');

var world = require('./world');
var config = require('../../config.json');

module.exports = function () {
	this.Before(function (done) {
		world.resetUser();
		world.config = clone(config);
		done();
	});

	this.After(function (done) {
		config = world.config;
		done();
	});
};
