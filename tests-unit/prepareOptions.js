'use strict';

const assert = require('assert');
const sinon = require('sinon');
const mockery = require('mockery');

require('chai').should();

describe('prepareOptions middleware: ', function () {

	beforeEach(function (done) {
		mockery.enable({
			useCleanCache: true,
			warnOnReplace: false,
			warnOnUnregistered: false
		});
		return done();
	});

	afterEach(function (done) {
		mockery.disable();
		return done();
	});

	it('POST request content type is application/json', function (done) {
		const request = {
			method: 'POST',
			headers: {
				'content-type': 'application/json; charset=utf-8',
				host: 'localhost:3000'
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
			header: item => {
				return request.headers[item.toLowerCase()];
			}
		};

		const response = {
			body: {},
			send: (status, message) => {
				response.body.status = status;
				response.body.message = message;
			}
		};

		const prepareOptions = require('./../src/middlewares/prepareOptions');
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
		const request = {
			method: 'GET',
			headers: {
				'content-type': 'application/json; charset=utf-8',
				host: 'localhost:3000'
			},
			tokenInfo: {
				userId: '1234567890'
			},
			connection: {
				remoteAddress: '::ffff:127.0.0.1'
			},
			header: item => {
				return request.headers[item.toLowerCase()];
			}
		};

		const response = {
			body: {},
			send: (status, message) => {
				response.body.status = status;
				response.body.message = message;
			}
		};

		const prepareOptions = require('./../src/middlewares/prepareOptions');
		prepareOptions(request, response, function (error) {
			assert.equal(error, undefined);
			assert.notEqual(request.options, undefined);
			assert.equal(request.options.headers['Content-Type'], request.headers['content-type']);
			assert.equal(request.options.body, undefined);
			return done();
		});
	});

	it('DELETE request with content type application/json does not have a body in options', function (done) {
		const request = {
			method: 'DELETE',
			headers: {
				'content-type': 'application/json; charset=utf-8',
				host: 'localhost:3000'
			},
			tokenInfo: {
				userId: '1234567890'
			},
			connection: {
				remoteAddress: '::ffff:127.0.0.1'
			},
			header: item => {
				return request.headers[item.toLowerCase()];
			}
		};

		const response = {
			body: {},
			send: (status, message) => {
				response.body.status = status;
				response.body.message = message;
			}
		};

		const prepareOptions = require('./../src/middlewares/prepareOptions');
		prepareOptions(request, response, function (error) {
			assert.equal(error, undefined);
			assert.notEqual(request.options, undefined);
			assert.equal(request.options.headers['Content-Type'], request.headers['content-type']);
			assert.equal(request.options.body, undefined);
			return done();
		});
	});

	it('request content type is multipart/form-data', function (done) {
		const request = {
			headers: {
				'content-type': 'multipart/form-data',
				host: 'localhost:3000'
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
				file1: {
					path: '/path/to/file/1'
				},
				file2: {
					path: '/path/to/file/2'
				}
			},
			header: item => {
				return request.headers[item.toLowerCase()];
			}
		};

		const response = {
			body: {},
			send: (status, message) => {
				response.body.status = status;
				response.body.message = message;
			}
		};

		const fsStub = {
			createReadStream: path => {
				return `STREAM FOR PATH ${path}`;
			}
		};

		const createReadStreamSpy = sinon.spy(fsStub, 'createReadStream');
		mockery.registerMock('fs', fsStub);

		const prepareOptions = require('./../src/middlewares/prepareOptions');
		prepareOptions(request, response, function (error) {
			assert.equal(error, undefined);
			assert.notEqual(request.options, undefined);

			request.options.formData.should.have.property('item1').to.equal('value1');
			request.options.formData.should.have.property('item2').to.equal('value2');
			request.options.formData.should.have.property('file1').to.equal('STREAM FOR PATH /path/to/file/1');
			request.options.formData.should.have.property('file2').to.equal('STREAM FOR PATH /path/to/file/2');
			createReadStreamSpy.callCount.should.equal(2);
			return done();
		});
	});

});
