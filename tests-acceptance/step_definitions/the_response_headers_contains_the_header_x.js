'use strict';

const world = require('../support/world');
const should = require('chai').should();

module.exports = function (){
	this.Then(/^the response headers contains the header "([^"]*)"$/, function (headerName, callback) {
		const response = world.getResponse();
		should.exist(response);
		response.should.have.property('headers');
		response.headers.should.have.property(headerName.toLowerCase());
		return callback();
	});
};
