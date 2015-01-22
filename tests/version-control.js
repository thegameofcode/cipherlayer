var assert = require('assert');
var config = JSON.parse(require('fs').readFileSync('./config.json','utf8'));

describe('version control', function(){

    var settings = {
        "header" : "x-mycomms-version",
        "platforms" : {
            "test" : {
                "link" : "http://testLink",
                "1.0" : true
            }
        }
    };

    describe('manager', function(){
        it('rejects if no version header is included', function(done){
            var expectedCode = 400;
            var expectedError = {
                err:"invalid_version",
                des:"Must update to last application version"
            };
            var validResponse = false;

            var req = {
                header : function(){
                    return undefined
                }
            };
            var res = {
                send : function(code, body){
                    assert.equal(code, expectedCode, 'invalid response code');
                    assert.deepEqual(body, expectedError, 'invalid response body');
                    validResponse = true;
                }
            };
            var next = function(canContinue){
                if(canContinue === false && validResponse) done();
            };

            var versionCheck = require('../middlewares/version.js')(settings);
            versionCheck(req,res,next);
        });

        it('invalid platform in header', function(done){
            var expectedCode = 400;
            var expectedError = {
                err:"invalid_version",
                des:"Must update to last application version"
            };
            var validResponse = false;

            var req = {
                header : function(headerKey){
                    switch(headerKey){
                        case config.version.header:
                            return 'invalidPlatform/1.2.3';
                    }
                }
            };
            var res = {
                send : function(code, body){
                    assert.equal(code, expectedCode, 'invalid response code');
                    assert.deepEqual(body, expectedError, 'invalid response body');
                    validResponse = true;
                }
            };
            var next = function(canContinue){
                if(canContinue === false && validResponse) done();
            };

            var versionCheck = require('../middlewares/version.js')(settings);
            versionCheck(req,res,next);
        });

        it('invalid platform version in header', function(done){
            var expectedCode = 400;
            var expectedError = {
                err:"invalid_version",
                des:"Must update to last application version",
                data:settings.platforms.test.link
            };
            var validResponse = false;

            var req = {
                header : function(headerKey){
                    switch(headerKey){
                        case config.version.header:
                            return 'test/invalidVersion';
                    }
                }
            };
            var res = {
                send : function(code, body){
                    assert.equal(code, expectedCode, 'invalid response code');
                    assert.deepEqual(body, expectedError, 'invalid response body');
                    validResponse = true;
                }
            };
            var next = function(canContinue){
                if(canContinue === false && validResponse) done();
            };

            var versionCheck = require('../middlewares/version.js')(settings);
            versionCheck(req,res,next);
        });

        it('old platform version in header', function(done){
            var expectedCode = 400;
            var expectedError = {
                err:"invalid_version",
                des:"Must update to last application version",
                data:settings.platforms.test.link
            };
            var validResponse = false;

            var req = {
                header : function(headerKey){
                    switch(headerKey){
                        case config.version.header:
                            return 'test/oldVersion';
                    }
                }
            };
            var res = {
                send : function(code, body){
                    assert.equal(code, expectedCode, 'invalid response code');
                    assert.deepEqual(body, expectedError, 'invalid response body');
                    validResponse = true;
                }
            };
            var next = function(canContinue){
                if(canContinue === false && validResponse) done();
            };

            var versionCheck = require('../middlewares/version.js')(settings);
            versionCheck(req,res,next);
        });

        it('valid version must continue', function(done){

            var req = {
                header : function(headerKey){
                    switch(headerKey){
                        case settings.header:
                            return 'test/1.0';
                    }
                }
            };
            var res = {};
            var next = function(canContinue){
                if(canContinue === undefined || canContinue === true) done();
            };

            var versionCheck = require('../middlewares/version.js')(settings);
            versionCheck(req,res,next);
        });
    });
});