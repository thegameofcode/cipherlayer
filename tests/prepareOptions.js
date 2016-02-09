var assert = require('assert');
var sinon = require('sinon');
var prepareOptions = require('./../src/middlewares/prepareOptions');
var _ = require('lodash');
var fs = require('fs');
var request;
var response;

var fsStub;

describe('prepareOptions middleware: ', function () {

	before(function (done) {
		fsStub = sinon.stub(fs, 'createReadStream');
		return done();
	});

	after(function (done) {
		fsStub.restore();
		return done();
	});

	beforeEach(function (done) {

		request = {
			headers: {}
		};
		response = {};
		response.body = {};
		response.send = function (status, message) {
			response.body.status = status;
			response.body.message = message;
			return;
		};
		request.header = function (item) {
			return request.headers[item.toLowerCase()];
		};

		return done();
	});

	it('POST request content type is application/json', function (done) {

		_.extend(request, {
			method: 'POST',
			headers: {
				'content-type': 'application/json; charset=utf-8',
				'host': 'localhost:3000'
			},
			tokenInfo: {
				userId: '1234567890'
			},
			connection: {
				remoteAddress: '::ffff:127.0.0.1'
			},
			body: {
				item1: 'value1',
				item2: 'value2'
			},
			files: {
				file1: 'stuff',
				file2: 'moreStuff'
			}
		});

		prepareOptions(request, response, function (error) {
			assert.equal(error, undefined);
			assert.notEqual(request.options, undefined);
			assert.equal(request.options.headers['Content-Type'], request.headers['content-type']);
			assert.ok(request.options.body);
			assert.equal(request.options.body, JSON.stringify(request.body));
			return done();
		});
	});

	it('GET request with content type application/json does not have a body in options', function (done) {

		_.extend(request, {
			method: 'GET',
			headers: {
				'content-type': 'application/json; charset=utf-8',
				'host': 'localhost:3000'
			},
			tokenInfo: {
				userId: '1234567890'
			},
			connection: {
				remoteAddress: '::ffff:127.0.0.1'
			}
		});

		prepareOptions(request, response, function (error) {
			assert.equal(error, undefined);
			assert.notEqual(request.options, undefined);
			assert.equal(request.options.headers['Content-Type'], request.headers['content-type']);
			assert.equal(request.options.body, undefined);
			return done();
		});
	});

	it('DELETE request with content type application/json does not have a body in options', function (done) {

		_.extend(request, {
			method: 'DELETE',
			headers: {
				'content-type': 'application/json; charset=utf-8',
				'host': 'localhost:3000'
			},
			tokenInfo: {
				userId: '1234567890'
			},
			connection: {
				remoteAddress: '::ffff:127.0.0.1'
			}
		});

		prepareOptions(request, response, function (error) {
			assert.equal(error, undefined);
			assert.notEqual(request.options, undefined);
			assert.equal(request.options.headers['Content-Type'], request.headers['content-type']);
			assert.equal(request.options.body, undefined);
			return done();
		});
	});

	it('request content type is multipart/form-data', function (done) {

		_.extend(request, {
			headers: {
				'content-type': 'multipart/form-data',
				'host': 'localhost:3000'
			},
			tokenInfo: {
				userId: '1234567890'
			},
			connection: {
				remoteAddress: '::ffff:127.0.0.1'
			},
			body: {
				item1: 'value1',
				item2: 'value2'
			},
			files: {
				file1: 'stuff',
				file2: 'moreStuff'
			}
		});

		prepareOptions(request, response, function (error) {
			assert.equal(error, undefined);
			assert.notEqual(request.options, undefined);
			assert.notEqual(request.options.formData, undefined);
			assert.equal(fsStub.calledTwice, true);
			return done();
		});
	});
});
