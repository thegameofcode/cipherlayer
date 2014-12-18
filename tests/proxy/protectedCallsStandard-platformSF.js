var request = require('request');
var assert = require('assert');
var ciphertoken = require('ciphertoken');
var fs = require('fs');
var clone = require('clone');
var nock = require('nock');

var dao = require('../../dao.js');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));


var expectedBody = {field1: 'value1', field2: 'value2'};
var expectedSfData = {
    userId: 'f6e5d4c3b2a1',
    accessToken: 'asdfg',
    instanceUrl: 'http://instance.salesforce.com'
};
var USER = {
    id: 'a1b2c3d4e5f6',
    username: "valid@my-comms.com",
    password: "12345678",
    platforms: [
        {
            "platform": "sf",
            "accessToken": {
                "params": {
                    "id": expectedSfData.userId,
                    "instance_url": expectedSfData.instanceUrl,
                    "access_token": expectedSfData.accessToken
                }
            },
            "refreshToken": "5Aep861i3pidIObecGGIqklOwR5avD.f1bdPfBAaGt3rDymDG_FK5ecIAm4g5rNUmCZJl78aef2YN0.8lfePtXi",
            "expiry": new Date().getTime() + 0.9 * config.salesforce.renewWhenLessThan * 60 * 1000 // expire in less than a minute
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
            dao.addUser(USER, function (err, createdUser) {
                assert.equal(err, null);

                ciphertoken.createToken(accessTokenSettings, createdUser._id, null, {}, function (err, loginToken) {

                    nockProtectedStandartCall(createdUser, expectedBody);

                    var options = clone(OPTIONS_STANDARD_CALL);
                    options.headers.Authorization = 'bearer ' + loginToken;

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
            dao.addUser(USER, function(err, createdUser){
                assert.equal(err, null);

                ciphertoken.createToken(accessTokenSettings, createdUser._id, null, {}, function(err, loginToken){
                    assert.equal(err, null);


                    var oldRefreshToken = USER.platforms[0].refreshToken;
                    nockProtectedStandartCall(createdUser, expectedBody);

                    var sfRenewTokenReturnedBody = {
                        "id":"https://login.salesforce.com/id/00Dx0000000BV7z/005x00000012Q9P",
                        "issued_at":"1278448384422",
                        "instance_url":"https://na1.salesforce.com",
                        "signature":"SSSbLO/gBhmmyNUvN18ODBDFYHzakxOMgqYtu+hDPsc=",
                        "access_token":"00Dx0000000BV7z!AR8AQP0jITN80ESEsj5EbaZTFG0RNBaT1cyWk7TrqoDjoNIWQ2ME_sTZzBjfmOE6zMHq6y8PIW4eWze9JksNEkWUl.Cju7m4"
                    };

                    var queryParams = 'grant_type=refresh_token&' +
                        'client_id=3MVG9lKcPoNINVBIPJjdw1J9LLM82HnFVVX19KY1uA5mu0QqEWhqKpoW3svG3XHrXDiCQjK1mdgAvhCscA9GE&' +
                        'client_secret=1955279925675241571&' +
                        'refresh_token' + USER.platforms[0].refreshToken;

                    nockSFRenewToken(queryParams, sfRenewTokenReturnedBody);

                    var options = clone(OPTIONS_STANDARD_CALL);
                    options.headers.Authorization = 'bearer ' + loginToken;

                    request(options, function (err, res, body) {
                        assert.equal(err, null);
                        assert.equal(res.statusCode, 200, body);
                        assert.notEqual(body, undefined);

                        // Don't know if going down to the dao is the best way to check expiration time has been updated
                        // Shouldn't this new refresh token be send back to the user doing the request?

                        //This method returns undefined...
                        var updatedUser = dao.getFromId(USER.id);

                        var updatedExpiry = updatedUser.platforms[0].expiry;
                        var roundedUpdatedExpiry = (updatedExpiry / 10000).toFixed();

                        var expectedExpiry = new Date.getTime() + config.salesforce.expiration * 60 * 1000;
                        var roundedExpectedExpiry = (expectedExpiry / 10000).toFixed();

                        assert.equal(roundedUpdatedExpiry, roundedExpectedExpiry);
                        assert.notEqual(oldRefreshToken, updatedUser.platforms[0].refreshToken);
                        done();
                    });
                });
            });
        });
    }
};

function nockProtectedStandartCall(createdUser, expectedBody) {
    nock('http://localhost:' + config.private_port, {
        reqheaders: {
            'x-user-id': createdUser._id,
            'x-sf-data': JSON.stringify(expectedSfData),
            'content-type': 'application/json; charset=utf-8'
        }
    })
        .post('/api/standard', expectedBody)
        .reply(200, {field3: 'value3'});
}

function nockSFRenewToken(queryParams, bodyToReturn){
    nock('https://login.salesforce.com', {
        reqheaders: {
            'content-type': 'application/json; charset=utf-8'
        }
    })
        .post('/services/oauth2/token' + '?' + queryParams)
        .reply(200, bodyToReturn);
}
