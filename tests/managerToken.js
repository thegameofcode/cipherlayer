var assert = require('assert');
var ciphertoken = require('ciphertoken');
var tokenManager = require('../managers/token');
var config = JSON.parse(require('fs').readFileSync('./config.json','utf8'));


describe('token manager', function(){
    describe('createAccessToken',function(){
        it('userId, callback', function(done){
            var expectedUserId = 'a1b2c3d4e5f6';
            tokenManager.createAccessToken(expectedUserId, function(err, accessToken){
                assert.equal(err, null);
                assert.notEqual(accessToken, null);

                ciphertoken.getTokenSet(accessTokenSettings, accessToken, function(err, accessTokenInfo){
                    assert.equal(err, null);
                    assert.equal(accessTokenInfo.userId, expectedUserId);

                    done();
                });
            })
        });

        it('userId, data, callback', function(done){
            var expectedUserId = 'a1b2c3d4e5f6';
            var expectedData = {field1:'value1'};

            tokenManager.createAccessToken(expectedUserId, expectedData, function(err, accessToken){
                assert.equal(err, null);
                assert.notEqual(accessToken, null);

                ciphertoken.getTokenSet(accessTokenSettings, accessToken, function(err, accessTokenInfo){
                    assert.equal(err, null);
                    assert.equal(accessTokenInfo.userId, expectedUserId);
                    assert.deepEqual(accessTokenInfo.data, expectedData);

                    done();
                });
            })
        });
    });

    it('getAccessTokenInfo', function(done){
        var expectedUserId = 'a1b2c3d4e5f6';
        tokenManager.createAccessToken(expectedUserId, function(err, accessToken){
            assert.equal(err, null);
            assert.notEqual(accessToken, null);

            tokenManager.getAccessTokenInfo(accessToken, function(err, accessTokenInfo){
                assert.equal(err, null);
                assert.equal(accessTokenInfo.userId, expectedUserId);

                done();
            });
        })
    });

    describe('createRefreshToken',function(){
        it('userId, callback', function(done){
            var expectedUserId = 'a1b2c3d4e5f6';
            tokenManager.createRefreshToken(expectedUserId, function(err, refreshToken){
                assert.equal(err, null);
                assert.notEqual(refreshToken, null);

                ciphertoken.getTokenSet(refreshTokenSettings, refreshToken, function(err, refreshTokenInfo){
                    assert.equal(err, null);
                    assert.equal(refreshTokenInfo.userId, expectedUserId);

                    done();
                });
            })
        });

        it('userId, data, callback', function(done){
            var expectedUserId = 'a1b2c3d4e5f6';
            var expectedData = {field1:'value1'};
            tokenManager.createRefreshToken(expectedUserId, expectedData, function(err, refreshToken){
                assert.equal(err, null);
                assert.notEqual(refreshToken, null);

                ciphertoken.getTokenSet(refreshTokenSettings, refreshToken, function(err, refreshTokenInfo){
                    assert.equal(err, null);
                    assert.equal(refreshTokenInfo.userId, expectedUserId);
                    assert.deepEqual(refreshTokenInfo.data, expectedData);

                    done();
                });
            })
        });
    });

    describe('createBothTokens', function(){
        it('userId, callback', function(done){
            var expectedUserId = 'a1b2c3d4e5f6';
            tokenManager.createBothTokens(expectedUserId, function(err, tokens){
                assert.equal(err, null);
                assert.notEqual(tokens, null);

                ciphertoken.getTokenSet(accessTokenSettings, tokens.accessToken, function(err, accessTokenInfo){
                    assert.equal(err, null);
                    assert.equal(accessTokenInfo.userId, expectedUserId);

                    ciphertoken.getTokenSet(refreshTokenSettings, tokens.refreshToken, function(err, refreshTokenInfo){
                        assert.equal(err, null);
                        assert.equal(refreshTokenInfo.userId, expectedUserId);

                        done();
                    });
                });
            });
        });
    });
});

var accessTokenSettings = {
    cipherKey: config.accessToken.cipherKey,
    firmKey: config.accessToken.signKey,
    tokenExpirationMinutes: config.accessToken.expiration * 60
};

var refreshTokenSettings = {
    cipherKey: config.refreshToken.cipherKey,
    firmKey: config.refreshToken.signKey,
    tokenExpirationMinutes: config.refreshToken.expiration * 1000
};
