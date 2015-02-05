var assert = require('assert');
var clone = require('clone');
var request = require('request');
var ciphertoken = require('ciphertoken');
var nock = require('nock');
var fs = require('fs');
var cipherlayer = require('../src/cipherlayer.js');

var config = JSON.parse(fs.readFileSync('config.json','utf8'));
var dao = require('../src/dao.js');


describe('Reset Password', function () {
    var baseUser = {
        id: 'a1b2c3d4e5f6',
        username: 'jie.lee' + (config.allowedDomains[0] ? config.allowedDomains[0] : ''),
        password: 'validpassword'
    };

    afterEach(function(done){
        cipherlayer.stop(done);
    });
    beforeEach(function (done) {
        cipherlayer.start(config.public_port, config.private_port, function(err, result){
            dao.deleteAllUsers(function (err) {
                assert.equal(err, null);
                var userToCreate = clone(baseUser);
                dao.addUser()(userToCreate, function (err, createdUser) {
                    assert.equal(err, null);
                    assert.notEqual(createdUser, undefined);
                    done();
                });
            });
        });
    });

    it('Send Recover Password', function (done) {
        this.timeout(3000);
        var options = {
            url: 'http://localhost:' + config.public_port + '/api/user/'+ baseUser.username+'/password',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            method: 'GET'
        };
        options.headers[config.version.header] = "test/1";

        nock(config.services.notifications)
            .post('/notification/email')
            .reply(201);

        request(options, function (err, res, body) {
            assert.equal(err, null);
            assert.equal(res.statusCode, 201);
            dao.getAllUserFields(baseUser.username, function(err, result){
                assert.equal(err, null);
                assert.equal(result.password.length, 2);
                done();
            });
        });
    });

    it('Send 2 times recover Password', function (done) {
        this.timeout(3000);
        var options = {
            url: 'http://localhost:' + config.public_port + '/api/user/'+ baseUser.username+'/password',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            method: 'GET'
        };
        options.headers[config.version.header] = "test/1";

        nock(config.services.notifications)
            .post('/notification/email')
            .reply(201);

        request(options, function (err, res, body) {
            assert.equal(err, null);
            assert.equal(res.statusCode, 201);
            dao.getAllUserFields(baseUser.username, function(err, result){
                assert.equal(err, null);
                assert.equal(result.password.length, 2);

                nock(config.services.notifications)
                    .post('/notification/email')
                    .reply(201);

                request(options, function (err2, res2, body) {
                    assert.equal(err2, null);
                    assert.equal(res2.statusCode, 201);
                    dao.getAllUserFields(baseUser.username, function(err, result){
                        assert.equal(err, null);
                        assert.equal(result.password.length, 2);
                        done();
                    });
                });
            });
        });
    });

});
