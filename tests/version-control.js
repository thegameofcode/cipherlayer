var assert = require('assert');
var versionManager = require('../middlewares/version.js');
var config = JSON.parse(require('fs').readFileSync('./config.json','utf8'));

describe('version control', function(){

    describe('manager', function(){
        //it('rejects if no version header is included', function(done){
        //    var expectedCode = 400;
        //    var expectedError = {
        //        err:"invalid_version",
        //        des:"Must update to last application version"
        //    };
        //    var validResponse = false;
        //
        //    var req = {
        //        header : function(){
        //            return undefined
        //        }
        //    };
        //    var res = {
        //        send : function(code, body){
        //            assert.equal(code, expectedCode, 'invalid response code');
        //            assert.deepEqual(body, expectedError, 'invalid response body');
        //            validResponse = true;
        //        }
        //    };
        //    var next = function(canContinue){
        //        if(canContinue === false && validResponse) done();
        //    };
        //
        //    versionManager(req,res,next);
        //});

        it('accepts if no version header is included', function(done){
            var req = {
                header : function(){
                    return undefined
                }
            };
            var res = {};
            var next = function(canContinue){
                if(canContinue === undefined || canContinue === true) done();
            };

            versionManager(req,res,next);
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

            versionManager(req,res,next);
        });

        it('invalid platform version in header', function(done){
            var expectedCode = 400;
            var expectedError = {
                err:"invalid_version",
                des:"Must update to last application version",
                data:config.version.platforms.iPhone.link
            };
            var validResponse = false;

            var req = {
                header : function(headerKey){
                    switch(headerKey){
                        case config.version.header:
                            return 'iPhone/invalidVersion';
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

            versionManager(req,res,next);
        });

        it('old platform version in header', function(done){
            var expectedCode = 400;
            var expectedError = {
                err:"invalid_version",
                des:"Must update to last application version",
                data:config.version.platforms.iPhone.link
            };
            var validResponse = false;

            var req = {
                header : function(headerKey){
                    switch(headerKey){
                        case config.version.header:
                            return 'iPhone/oldVersion';
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

            versionManager(req,res,next);
        });

        it('valid version must continue', function(done){

            var platformConfig = config.version.platforms.iPhone;
            var validVersion = '';
            for(var key in platformConfig){
                if(platformConfig[key] === true) {
                    validVersion = key;
                    break;
                }
            }

            var req = {
                header : function(headerKey){
                    switch(headerKey){
                        case config.version.header:
                            return 'iPhone/' + validVersion;
                    }
                }
            };
            var res = {};
            var next = function(canContinue){
                if(canContinue === undefined || canContinue === true) done();
            };

            versionManager(req,res,next);
        });
    });

});