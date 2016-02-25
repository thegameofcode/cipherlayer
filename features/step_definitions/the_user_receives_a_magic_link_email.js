'use strict';

require('chai').should();
var world = require('../support/world');
var config = require('../../config.json');

module.exports = function () {
	this.Then(/^the user receives a magic link email$/, function (callback) {
		world.should.have.property('magicLinkEmail');
		world.magicLinkEmail.should.have.property('subject').to.equal(config.magicLink.subject);
		callback();
	});
};
