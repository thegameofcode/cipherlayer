'use strict';

require('chai').should();
const world = require('../support/world');
const config = require('../../config.json');

module.exports = function () {
	this.Then(/^the user receives a magic link email$/, function (callback) {
		world.should.have.property('magicLinkEmail');
		world.magicLinkEmail.should.have.property('subject').to.equal(config.magicLink.subject);
		return callback();
	});
};
