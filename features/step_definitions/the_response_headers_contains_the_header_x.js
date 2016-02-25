'use strict';

var world = require('../support/world');
var should = require('chai').should();

module.exports = function (){
	this.Then(/^the response headers contains the header "([^"]*)"$/, function (headerName, callback) {
		var response = world.getResponse();
		should.exist(response);
		response.should.have.property('headers');
		response.headers.should.have.property(headerName.toLowerCase());
		callback();
	});
};
