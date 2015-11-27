var assert = require('assert');
var checkAuthHeader = require('./../../src/middlewares/authHeader');
var config = require('./../../config.json');
var _ = require('lodash');
var request;
var response;

describe('authHeader middleware: ', function() {

  beforeEach(function(done) {
    request = {};
    request.params = {};
    request.headers = {};
    request.header = function(item) {
      return request.headers[item.toLowerCase()];
    };

    response = {};
    response.body = {};
    response.send = function(status, message) {
      response.body.status = status;
      response.body.message = message;
      return;
    };
    return done();
  });

  it('has authentication header', function(done) {
    request.headers.authorization = config.authHeaderKey + 'abcdef123456789';

    checkAuthHeader(request, response, function(error) {
      assert.deepEqual(response.body, {});
      assert.equal(error, undefined);
      return done();

    });
  });

  it('has NOT authentication header', function(done) {

    checkAuthHeader(request, response, function(error) {
      assert.equal(response.body.status, 401);
      assert.equal(response.body.message.err, 'unauthorized');
      assert.equal(error, false);
      return done();
    });
  });

  it('has too short authentication header', function(done) {

    request.headers.authorization = _.clone(config.authHeaderKey).slice(0,2);

    checkAuthHeader(request, response, function(error) {
      assert.equal(response.body.status, 401);
      assert.equal(response.body.message.err, 'unauthorized');
      assert.equal(error, false);
      return done();
    });
  });

});
