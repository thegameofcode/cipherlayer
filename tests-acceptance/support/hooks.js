var _= require('lodash');

const world = require('./world');
const config = require('../../config.json');

module.exports = function () {
	this.Before(function () {
		world.resetUser();
		world.config = _.clone(config);
	});

	this.After(function () {
		config = world.config;
	});
};
