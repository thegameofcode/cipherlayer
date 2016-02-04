var request = require('request');
var crypto = require('crypto');
var _ = require('lodash');

var log = require('../logger/service.js');
var daoMng = require('../managers/dao');
var userMng = require('../managers/user')();
var tokenMng = require('../managers/token');
var config = require(process.cwd() + '/config.json');

var defaultOptions = {
    url: 'https://graph.facebook.com/v2.5/me',
    json: true,
    method: 'GET',
    qs: {
        fields: config.facebook.requestFields,
        format: 'json',
        method: 'get',
        pretty: 0,
        suppress_http_code: 1
    }
};

function mapFacebookData(body, fieldsMap) {
    var mappedData = {};

    if(!fieldsMap) return mappedData;

    _.each(_.keys(fieldsMap), function(fb_key) {
        var profile_key = fieldsMap[fb_key];
        if (fb_key === 'profile_picture') {
            mappedData[profile_key] = body.picture ? body.picture.data.url : null;
            return;
        }

        if (fb_key === 'email' && !body[fb_key]) {
            body[fb_key] = body.id + '@facebook.com';
        }

        if (!body[fb_key]) {
            return;
        }

        mappedData[profile_key] = body[fb_key];
    });

    return mappedData;
}


function postAuthRegisterFacebook(req, res, next) {

    var options = _.clone(defaultOptions);
    options.qs.access_token = req.body.accessToken;


    if (!config.facebook) {
        res.send(400, {
            err: 'facebook_login_disabled',
            des: 'Facebook login is not configured'
        });
        return next(false);
    }

    if (!req.body && !req.body.accessToken)  {
        res.send(400, {
            err: 'missing_facebook_token',
            des: 'Missing facebook access_token'
        });
        return next(false);
    }

    request(options, function(err, fb_res, fb_body) {

        if (err) {
            res.send(409, {err: err.message});
            return next();
        }

        if (fb_body.error) {
            res.send(409, {err: fb_body.error.type, des: fb_body.error.message});
            return next();
        }

        var fbUserProfile = mapFacebookData(fb_body, config.facebook.fieldsMap);
        var fbUserProfileUsername = fbUserProfile[config.facebook.fieldsMap.email || 'email'];

        daoMng.getFromUsername(fbUserProfileUsername, function(err, foundUser) {
            // RETURNING FACEBOOK USER

            if (!err) {
                var platform = {
                    platform:'fb',
                    accessToken: req.body.accessToken
                };

                userMng.setPlatformData(foundUser._id, 'fb', platform, function(err) {
                    if(err){
                        log.error({err:err}, 'error updating sf tokens into user '+foundUser._id+'');
                    }

                    var data = {};
                    if(foundUser.roles){
                        data.roles = foundUser.roles;
                    }

                    if(config.version){
                        data.deviceVersion = req.headers[config.version.header];
                    }

                    tokenMng.createBothTokens(foundUser._id, data , function(err, tokens) {
                        if(err) {
                            res.send(409,{err: err.message});
                        } else {
                            tokens.expiresIn = config.accessToken.expiration * 60;
                            res.send(200, tokens);
                        }
                        return next(false);
                    });

                });
                return;
            }

            // NEW FACEBOOK USER

            if (err && err.message === daoMng.ERROR_USER_NOT_FOUND) {

                if (!config.facebook.registerByToken) {
                    res.send(401, {
                        err: 'facebook_user_not_registered',
                        des: 'This user need registration before login'
                    });
                    return next(false);
                }

                fbUserProfile.fb = {
                    accessToken: req.body.accessToken
                };

                fbUserProfile.password = random(12);

                userMng.createUser(fbUserProfile, null, function (err, tokens) {
                    if (err) {
                        if (!err.code) {
                            res.send(500, err);
                        } else {
                            var errCode = err.code;
                            delete(err.code);
                            res.send(errCode, err);
                        }
                        return next(false);
                    }

                    tokenMng.getRefreshTokenInfo(tokens.refreshToken, function (err, tokenSet) {
                        var userId = tokenSet.userId;
                        var tokenData = tokenSet.data;

                        if (config.version) {
                            tokenData.deviceVersion = req.headers[config.version.header];
                        }

                        tokenMng.createBothTokens(userId, tokenData, function (err, tokens) {
                            tokens.expiresIn = config.accessToken.expiration * 60;
                            res.send(201, tokens);
                            return next();
                        });
                    });

                });

                return;
            }

            if (err) {
                res.send(500, {err:'internal_error', des:'There was an internal error checking facebook profile'});
                return next(false);
            }

        });

    });
}

// TODO: extract to common util file
function random (howMany, chars) {
    chars = chars || "abcdefghijklmnopqrstuwxyzABCDEFGHIJKLMNOPQRSTUWXYZ0123456789";
    var rnd = crypto.randomBytes(howMany),
        value = new Array(howMany),
        len = chars.length;

    for (var i = 0; i < howMany; i++) {
        value[i] = chars[rnd[i] % len];
    }
    return value.join('');
}

function addRoutes(service) {
    service.post('/auth/login/facebook', postAuthRegisterFacebook);
}

module.exports = addRoutes;
