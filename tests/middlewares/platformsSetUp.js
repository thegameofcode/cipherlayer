var assert = require('assert');
var sinon = require('sinon');
var platformsSetUp = require('./../../src/middlewares/platformsSetUp');
var sfPlatform = require('./../../src/platforms/salesforce.js');

var request;
var response;
var sfStub;

describe('platformsSetUp middleware: ', function() {

  before(function(done) {
    sfStub = sinon.stub(sfPlatform, 'renewSFAccessTokenIfNecessary', function(user, platform, callback) {
      if (user._id === '666') {
        return callback(true);
      }
      return callback(null, 'some_access_token');
    });
    return done();
  });

  after(function(done) {
    sfStub.restore();
    return done();
  });

  beforeEach(function(done) {

    request = {
      headers: {},
      options: {
        headers: {}
      },
      user: {
        _id: 'a1b2c3d4e5f6',
        username: 'valid_user*@a.com',
        roles: [ 'user' ],
        signUpDate: 1446037518993,
        platforms: [
          {
            platform:'sf',
            accessToken: {
              params: {
                id: 'f6e5d4c3b2a1',
                instance_url: 'http://instance.salesforce.com'
              }
            }

          }]
      }
    };

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

  it('skips the middleware for no user', function(done) {

    request.user = {};

    platformsSetUp(request, response, function(error) {
      assert.equal(error, undefined);
      assert.deepEqual(response.body, {});
      return done();
    });
  });

  it('gets setup for sf platform', function(done) {

    var expectedHeaderContent = JSON.stringify({
      userId: request.user.platforms[0].accessToken.params.id,
      accessToken: 'some_access_token',
      instanceUrl: request.user.platforms[0].accessToken.params.instance_url
    });

    platformsSetUp(request, response, function(error) {
      assert.equal(error, undefined);
      assert.notEqual(request.options.headers['x-sf-data'], undefined);
      assert.equal(request.options.headers['x-in-data'], undefined);
      var options = request.options.headers['x-sf-data'];
      assert.equal(options, expectedHeaderContent);

      return done();
    });
  });

  it('yields error for sf setup', function(done) {

    request.user._id = '666'; // User to force error in salesforce platform

    platformsSetUp(request, response, function(error) {
      assert.notEqual(error, undefined);
      assert.equal(response.body.status, 401);
      assert.equal(response.body.message.err, 'Could not renew SF token');

      var errorStrMatch = response.body.message.des.match(/Unable to renew sales force access token/) ? true : false;
      assert.equal(errorStrMatch, true);
      return done();
    });
  });

  it('gets setup for in platform', function(done) {

    request.user.platforms[0].platform = 'in';
    request.user.platforms[0].accessToken = 'some_access_token';

    var expectedHeaderContent = JSON.stringify({
      accessToken: 'some_access_token'
    });

    platformsSetUp(request, response, function(error) {
      assert.equal(error, undefined);
      assert.equal(request.options.headers['x-sf-data'], undefined);
      assert.notEqual(request.options.headers['x-in-data'], undefined);
      var options = request.options.headers['x-in-data'];
      assert.equal(options, expectedHeaderContent);
      return done();
    });
  });
});