'use strict';
var world = require('../support/world');
var should = require('chai').should();
var config = require('../../config.json');
var request = require('request');

module.exports = function () {
	this.When(/^the user clicks the received magic link$/, function (callback) {
		world.should.have.property('magicLinkEmail');
		world.magicLinkEmail.should.have.property('html');

		var html = world.magicLinkEmail.html;
		var match = html.match(/https?:\/\/.+\/auth\/login\/refreshToken\?rt=[^']+/);
		should.exist(match);
		var magicLink = match[0];
		should.exist(magicLink);
		magicLink = magicLink.replace(config.public_url, 'http://localhost:' + config.public_port);

		var options = {
			url: magicLink,
			method: 'GET',
			headers: {
				'Content-Type': 'application/json; charset=utf-8'
			},
			followRedirect: false,
			followAllRedirects: false,
			json: true
		};
		options.headers[config.version.header] = world.versionHeader;

		request(options, function (err, res, body) {
			should.not.exist(err);
			world.getResponse().statusCode = res.statusCode;
			world.getResponse().body = body;
			world.getResponse().headers = res.headers;
			callback();
		});
	});
};
