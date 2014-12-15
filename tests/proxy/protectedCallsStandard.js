var request = require('request');
var assert = require('assert');
var ciphertoken = require('ciphertoken');
var fs = require('fs');
var nock = require('nock');

var dao = require('../../dao.js');
var config = JSON.parse(fs.readFileSync('config.json','utf8'));

module.exports = {
    itUnauthorized: function Unauthorized() {
        it('401 Unauthorized', function (done) {
            var expectedBody = {field1: 'value1', field2: 'value2'};

            var options = {
                url: 'http://localhost:' + config.public_port + '/api/standard',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                method: 'POST',
                body: JSON.stringify(expectedBody)
            };

            request(options, function (err, res, body) {
                assert.equal(err, null);
                assert.equal(res.statusCode, 401);
                assert.notEqual(body, undefined);
                done();
            });
        });
    },
    itWithoutPlatforms: function withoutPlatforms(accessTokenSettings){
        it('200 without platforms', function (done) {
            var user = {
                id: 'a1b2c3d4e5f6',
                username: "valid@my-comms.com",
                password: "12345678"
            };

            dao.addUser(user, function (err, createdUser) {
                assert.equal(err, null);

                ciphertoken.createToken(accessTokenSettings, createdUser._id, null, {}, function (err, loginToken) {
                    var expectedBody = {field1: 'value1', field2: 'value2'};

                    nock('http://localhost:' + config.private_port, {
                        reqheaders: {
                            'x-user-id': createdUser._id,
                            'content-type': 'application/json; charset=utf-8'
                        }
                    })
                        .post('/api/standard', expectedBody)
                        .reply(200, {field3: 'value3'});

                    var options = {
                        url: 'http://localhost:' + config.public_port + '/api/standard',
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Authorization': 'bearer ' + loginToken
                        },
                        method: 'POST',
                        body: JSON.stringify(expectedBody)
                    };

                    request(options, function (err, res, body) {
                        assert.equal(err, null);
                        assert.equal(res.statusCode, 200);
                        assert.notEqual(body, undefined);
                        done();
                    });
                });
            });
        });
    },
    itWithSalesforce: function withSalesForce(accessTokenSettings){
        it('200 with salesforce', function (done) {
            var expectedBody = {field1: 'value1', field2: 'value2'};
            var expectedSfData = {
                userId: 'f6e5d4c3b2a1',
                accessToken: 'asdfg',
                instanceUrl: 'http://instance.salesforce.com'
            };
            var user = {
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
                        "expiry": 0
                    }
                ]
            };

            dao.addUser(user, function (err, createdUser) {
                assert.equal(err, null);

                ciphertoken.createToken(accessTokenSettings, createdUser._id, null, {}, function (err, loginToken) {

                    nock('http://localhost:' + config.private_port, {
                        reqheaders: {
                            'x-user-id': createdUser._id,
                            'x-sf-data': JSON.stringify(expectedSfData),
                            'content-type': 'application/json; charset=utf-8'
                        }
                    })
                        .post('/api/standard', expectedBody)
                        .reply(200, {field3: 'value3'});

                    var options = {
                        url: 'http://localhost:' + config.public_port + '/api/standard',
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Authorization': 'bearer ' + loginToken
                        },
                        method: 'POST',
                        body: JSON.stringify(expectedBody)
                    };

                    request(options, function (err, res, body) {
                        assert.equal(err, null);
                        assert.equal(res.statusCode, 200);
                        assert.notEqual(body, undefined);
                        done();
                    });
                });
            });
        });
    },
    itBodyResponseIsNotAJson: function bodyResponseIsNotAJson(accessTokenSettings){
        it('body response is not a json', function (done) {
            var user = {
                id: 'a1b2c3d4e5f6',
                username: "valid@my-comms.com",
                password: "12345678"
            };

            dao.addUser(user, function (err, createdUser) {
                assert.equal(err, null);

                ciphertoken.createToken(accessTokenSettings, createdUser._id, null, {}, function (err, loginToken) {
                    var expectedBody = {field1: 'value1', field2: 'value2'};

                    nock('http://localhost:' + config.private_port, {
                        reqheaders: {
                            'x-user-id': createdUser._id,
                            'content-type': 'application/json; charset=utf-8'
                        }
                    })
                        .post('/api/standard', expectedBody)
                        .reply(200, 'not a json');


                    var options = {
                        url: 'http://localhost:' + config.public_port + '/api/standard',
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Authorization': 'bearer ' + loginToken
                        },
                        method: 'POST',
                        body: JSON.stringify(expectedBody)
                    };

                    request(options, function (err, res, body) {
                        assert.equal(err, null);
                        assert.equal(res.statusCode, 200);
                        assert.notEqual(body, undefined);
                        done();
                    });
                });
            });
        });
    }
};
