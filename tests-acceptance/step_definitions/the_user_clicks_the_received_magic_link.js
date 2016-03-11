'use strict';
const world = require('../support/world');
const should = require('chai').should();
const config = require('../../config');
const request = require('request');

module.exports = function () {
	this.When(/^the user clicks the received magic link$/, function (callback) {
		world.should.have.property('magicLinkEmail');
		world.magicLinkEmail.should.have.property('html');

		const html = world.magicLinkEmail.html;
		const match = html.match(/https?:\/\/.+\/auth\/login\/refreshToken\?rt=[^']+/);
		should.exist(match);
		const magicLink = match[0];
		should.exist(magicLink);

		const options = {
			url: magicLink.replace(config.public_url, `http://localhost:${config.public_port}`),
			method: 'GET',
			headers: {
				'Content-Type': 'application/json; charset=utf-8'
			},
			followRedirect: false,
			followAllRedirects: false,
			json: true
		};

		request(options, function (err, res, body) {
			should.not.exist(err);
			world.getResponse().statusCode = res.statusCode;
			world.getResponse().body = body;
			world.getResponse().headers = res.headers;
			return callback();
		});
	});
};
