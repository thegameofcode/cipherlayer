var assert = require('assert');
var config = require('./../../config.json');
var checkPermissions = require('./../../src/middlewares/permissions');

var request;
var response;

describe('Permissions middleware: ', function() {

  beforeEach(function(done) {
    request = {
      tokenInfo: {
        data: {
          roles: []
        }
      }
    };
    request._url = {};

    response = {};
    response.body = {};
    response.send = function(status, message) {
      response.body.status = status;
      response.body.message = message;
      return;
    };

    return done();
  });

  it('passes through due to valid permissions', function(done) {

    request.tokenInfo.data.roles = ['admin'];
    request._url.pathname = '/api/profile';
    request.method = 'PUT';

    checkPermissions(request, response, function(error) {
      assert.equal(error, undefined);
      assert.deepEqual(response.body, {});
      return done();
    });
  });

  it('does not pass through due to invalid permissions', function(done) {
    request.tokenInfo.data.roles = ['none'];
    request._url.pathname = '/api/profile';
    request.method = 'GET';

    checkPermissions(request, response, function(error) {
      assert.equal(error, false);
      assert.equal(response.body.status, 401);
      assert.equal(response.body.message.err, 'unauthorized');
      return done();
    });
  });

  it('skips permissions validations', function(done) {
    config.endpoints = null;

    request.tokenInfo.data.roles = ['admin'];
    request._url.pathname = '/api/profile';
    request.method = 'PUT';

    checkPermissions(request, response, function(error) {
      assert.equal(error, undefined);
      assert.deepEqual(response.body, {});
      return done();
    });
  });
});