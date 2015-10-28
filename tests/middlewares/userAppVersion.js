var assert = require('assert');
var sinon = require('sinon');
var userAppVersion = require('./../../src/middlewares/userAppVersion');

var request;
var response;

var userDao = require('./../../src/managers/dao');
var userDaoStub;

describe('userAppVersion middleware: ', function() {

  before(function(done) {

    userDaoStub = sinon.stub(userDao, 'updateField', function(userId, fieldName, fieldKey, callback) {

      if (!userId) {
        return callback(true);
      }

      return callback(null);
    });

    return done();
  });

  after(function(done) {
    userDaoStub.restore();
    return done();
  });

  beforeEach(function(done) {

    request = {
      headers: {}
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

  it('skips middleware due to missing version header', function(done) {

    var settings = {
      version: {
        header: null
      }
    };

    request.user = {
      appVersion: 'stuff/1'
    };

    userAppVersion(settings)(request, response, function(error) {
      assert.equal(error, undefined);
      assert.deepEqual(response.body, {});
      return done();
    });
  });

  it('passes through the app version storage process', function(done) {

    var settings = {
      version: {
        header: 'x-app-version'
      }
    };
    request = {
      headers: {
        'x-app-version': 'test/1'
      },
      user: {
      _id: null,
      appVersion: 'stuff/1'
      }
    };

    userAppVersion(settings)(request, response, function(err) {
      assert.notEqual(err, undefined);
      assert.equal(response.body.status, 500);
      assert.equal(response.body.message.err, 'proxy_error');
      assert.equal(response.body.message.des, 'error updating user appVersion');
      return done();
    });
  });
});