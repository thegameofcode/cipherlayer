var assert = require('assert');
var async = require('async');
var nock = require('nock');

var config = require('../config.json');
var notifServiceURL = config.services.notifications;

describe('Email', function() {

    it('verifyEmail', function (done) {
        var emailMng = require('../src/managers/email')({
            "useEmailVerification": true
        });

        nock(notifServiceURL)
            .post('/notification/email')
            .reply(204);

        var email = "test@test.com";
        var bodyData = {
            key : "value",
            key2: "value2"
        };
        emailMng.verifyEmail(email, bodyData, function(err, returnedEmail){
            assert.equal(err, null);
            assert.equal(returnedEmail, email);
            done();
        });
    });

    it('verifyEmail (not email)', function (done) {
        var emailMng = require('../src/managers/email')({
            "useEmailVerification": true
        });

        var expected_error = {"err":"auth_proxy_error","des":"empty email"};

        nock(notifServiceURL)
            .post('/notification/email')
            .reply(204);

        var email = null;
        var bodyData = {
            key : "value",
            key2: "value2"
        };
        emailMng.verifyEmail(email, bodyData, function(err, returnedEmail){
            assert.deepEqual(err, expected_error);
            done();
        });
    });

    it('verifyEmail (useEmailVerification = false)', function (done) {
        var emailMng = require('../src/managers/email')({
            "useEmailVerification": false
        });

        nock(notifServiceURL)
            .post('/notification/email')
            .reply(204);

        var email = "test@test.com";
        var bodyData = {
            key : "value",
            key2: "value2"
        };
        emailMng.verifyEmail(email, bodyData, function(err, returnedEmail){
            assert.equal(err, null);
            assert.equal(returnedEmail, null);
            done();
        });
    });
});
