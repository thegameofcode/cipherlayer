const _= require('lodash');

const world = require('./world');
const config = require('../../config');

module.exports = function () {
	this.Before(function () {
		world.resetUser();
		world.config = _.clone(config);
	});

};
