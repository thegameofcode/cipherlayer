var request = require('request');
var assert = require('assert');
var ciphertoken = require('ciphertoken');
var _ = require('lodash');
var nock = require('nock');

var dao = require('../../src/managers/dao.js');
var config = require('../../config.json');


var expectedBody = {field1: 'value1', field2: 'value2'};
var SF_DATA = {
    userId: 'f6e5d4c3b2a1',
    accessToken: 'asdfg',
    instanceUrl: 'http://instance.salesforce.com'
};
var USER = {
    id: 'a1b2c3d4e5f6',
    username: "valid" + (config.allowedDomains && config.allowedDomains[0] ? config.allowedDomains[0].replace('*','') : ''),
    password: "12345678",
    platforms: [
        {
            "platform": "sf",
            "accessToken": {
                "params": {
                    "id": SF_DATA.userId,
                    "instance_url": SF_DATA.instanceUrl,
                    "access_token": SF_DATA.accessToken
                }
            },
            "refreshToken": "5Aep861i3pidIObecGGIqklOwR5avD.f1bdPfBAaGt3rDymDG_FK5ecIAm4g5rNUmCZJl78aef2YN0.8lfePtXi",
            "expiry": new Date().getTime() + config.salesforce.expiration * 60 * 1000
        }
    ]
};

var OPTIONS_STANDARD_CALL = {
    url: 'http://localhost:' + config.public_port + '/api/standard',
    headers: {
        'Content-Type': 'application/json; charset=utf-8'
    },
    method: 'POST',
    body: JSON.stringify(expectedBody)
};


module.exports = {
    itWithSalesforce: function withSalesForce(accessTokenSettings){
        it('200 with salesforce', function (done) {
            dao.addUser()(USER, function (err, createdUser) {
                assert.equal(err, null);

                ciphertoken.createToken(accessTokenSettings, createdUser._id, null, {}, function (err, loginToken) {
                    nockProtectedStandartCall(createdUser._id, SF_DATA, expectedBody);

                    var options = _.clone(OPTIONS_STANDARD_CALL);
                    options.headers.Authorization = 'bearer ' + loginToken;
                    options.headers[config.version.header] = "test/1";


                    request(options, function (err, res, body) {
                        assert.equal(err, null);
                        assert.equal(res.statusCode, 200, body);
                        assert.notEqual(body, undefined);
                        done();
                    });
                });
            });
        });
    },
    itRenewSFToken: function renewSFToken(accessTokenSettings){
        it('200 with salesforce when renewing access token', function(done){
            var userWithSoonExpiry = _.clone(USER);
            userWithSoonExpiry.platforms[0].expiry = new Date().getTime() + 0.9 * config.salesforce.renewWhenLessThan * 60 * 1000; // expire in less than a minute

            dao.addUser()(userWithSoonExpiry, function(err, createdUser){
                assert.equal(err, null);

                ciphertoken.createToken(accessTokenSettings, createdUser._id, null, {}, function(err, loginToken){
                    assert.equal(err, null);
                    var oldAccessToken = USER.platforms[0].accessToken.params.access_token;

                    var queryParams = 'grant_type=refresh_token&' +
                        'client_id=' + config.salesforce.clientId + '&' +
                        'client_secret=' + config.salesforce.clientSecret + '&' +
                        'refresh_token=' + USER.platforms[0].refreshToken;

                    var sfRenewTokenReturnedBody = {
                        "id":"https://login.salesforce.com/id/00Dx0000000BV7z/005x00000012Q9P",
                        "issued_at":"1278448384422",
                        "instance_url":"https://na1.salesforce.com",
                        "signature":"SSSbLO/gBhmmyNUvN18ODBDFYHzakxOMgqYtu+hDPsc=",
                        "access_token":"00Dx0000000BV7z!AR8AQP0jITN80ESEsj5EbaZTFG0RNBaT1cyWk7TrqoDjoNIWQ2ME_sTZzBjfmOE6zMHq6y8PIW4eWze9JksNEkWUl.Cju7m4"
                    };
                    nockSFRenewToken(queryParams, sfRenewTokenReturnedBody);

                    var newSFData = _.clone(SF_DATA);
                    newSFData.accessToken = sfRenewTokenReturnedBody.access_token;
                    nockProtectedStandartCall(createdUser._id, newSFData, expectedBody);

                    var options = _.clone(OPTIONS_STANDARD_CALL);
                    options.headers.Authorization = 'bearer ' + loginToken;
                    options.headers[config.version.header] = "test/1";

                    request(options, function (err, res, body) {
                        assert.equal(err, null);
                        assert.equal(res.statusCode, 200, body);
                        assert.notEqual(body, undefined);

                        dao.getFromId(createdUser._id, function(err, foundUser){
                            assert.equal(err, null);

                            var updatedExpiry = foundUser.platforms[0].expiry;
                            var roundedUpdatedExpiry = (updatedExpiry / 10000).toFixed();

                            var expectedExpiry = (new Date().getTime()) + config.salesforce.expiration * 60 * 1000;
                            var roundedExpectedExpiry = (expectedExpiry / 10000).toFixed();

                            assert.equal(roundedUpdatedExpiry, roundedExpectedExpiry);
                            assert.notEqual(oldAccessToken, foundUser.platforms[0].accessToken.params.access_token);
                            done();
                        });
                    });
                });
            });
        });
    }
};

function nockProtectedStandartCall(id, expectedSfData, expectedBody) {
    nock('http://' + config.private_host + ':' + config.private_port, {
        reqheaders: {
            'x-user-id': id,
            'x-sf-data': JSON.stringify(expectedSfData),
            'content-type': 'application/json; charset=utf-8'
        }
    })  .persist()
        .post('/api/standard', expectedBody)
        .reply(200, {field3: 'value3'});
}

function nockSFRenewToken(queryParams, bodyToReturn){
    nock('https://login.salesforce.com', {})
        .post('/services/oauth2/token' + '?' + queryParams)
        .reply(200, bodyToReturn);
}
