var fs = require('fs');
var https = require('https');

var userDao = require('../dao');
var tokenManager = require('../managers/token');
var countrycodes = require('../countrycodes');
var awsMng = require('../util/aws');

var config = JSON.parse(require('fs').readFileSync('./config.json','utf8'));

// PASSPORT
var forcedotcomStrategy = require('passport-forcedotcom').Strategy;
var salesforceSettings = {
    clientID : config.salesforce.clientId,
    clientSecret : config.salesforce.clientSecret,
    scope : config.salesforce.scope,
    callbackURL : config.salesforce.callbackURL
};
if(config.salesforce.authUrl){
    salesforceSettings.authorizationURL = config.salesforce.authUrl;
}
if(config.salesforce.tokenUrl){
    salesforceSettings.tokenURL = config.salesforce.tokenUrl;
}
var salesforceStrategy = new forcedotcomStrategy(salesforceSettings,
    function verify(accessToken, refreshToken, profile, done){

        getPlatformAvatar(profile, accessToken, function(retProfile){
            var data = {
                accessToken:accessToken,
                refreshToken:refreshToken,
                profile:retProfile
            };
            done(null, data);
        });
    }
);

function getPlatformAvatar(profile, accessToken, cbk){
    if(!profile._raw || !profile._raw.photos || !profile._raw.photos.picture) {
        //TODO line on debug with the error
        return cbk(profile);
    } else {
        var oauthToken = "?oauth_token=" + accessToken.params.access_token;

        var avatarPath = profile._raw.photos.picture + oauthToken;
        var idPos = profile.id.lastIndexOf('/') ? profile.id.lastIndexOf('/')+1 : 0;
        var name = profile.id.substring(idPos) + '.jpg';

        var validBucket = config.aws.buckets.avatars;

        https.get(avatarPath, function (res) {
            if (res.statusCode !== 200) {
                //TODO line on debug with the error
                return cbk(profile);
            }
            var data = [], dataLen = 0;

            res.on("data", function (chunk) {
                data.push(chunk);
                dataLen += chunk.length;
            });

            res.on("end", function () {
                var buf = new Buffer(dataLen);
                for (var i=0,len=data.length,pos=0; i<len; i++) {
                    data[i].copy(buf, pos);
                    pos += data[i].length;
                }

                //Save in S3
                awsMng.uploadFile(validBucket, name, buf, function (err, file) {
                    if(err){
                        //TODO line on debug with the error
                        return cbk(profile);
                    } else {
                        awsMng.getFileURL(validBucket, name, function(err, fileURL){
                            if(err){
                                //TODO line on debug with the error
                                return cbk(profile);
                            } else {
                                profile.avatar = fileURL;
                                return cbk(profile);
                            }
                        });
                    }
                });
            });
        });
    }
}

function salesforceDenyPermisionFilter(req, res, next){
    var errorCode = req.query.error;
    var errorDescription = req.query.error_description;

    if(!errorCode || !errorDescription) {
        return next();
    } else {
        res.send(401, {err:errorCode, des: errorDescription});
        next(false);
    }
}

function salesforceCallback(req, res, next){
    var data = req.user;
    var profile = data.profile;

    userDao.getFromUsername(profile._raw.email, function(err, foundUser){
        if(err){
            if(err.message == userDao.ERROR_USER_NOT_FOUND){
                var sfData = {
                    accessToken:data.accessToken,
                    refreshToken:data.refreshToken
                };
                tokenManager.createAccessToken(profile.id, sfData, function(err, token){
                    countrycodes.countryFromPhone(profile._raw.mobile_phone, function(err, country){
                        var returnProfile = {
                            name: profile._raw.first_name,
                            lastname: profile._raw.last_name,
                            email: profile._raw.email,
                            sf: token
                        };

                        if(profile.avatar){
                            returnProfile.avatar = profile.avatar;
                        }

                        if(err == null && country){
                            returnProfile.country = country['ISO3166-1-Alpha-2'];
                            returnProfile.phone = profile._raw.mobile_phone.replace('+'+country.Dial,'').trim();
                        }

                        res.send(203, returnProfile);
                        next(false);
                    });
                });
            } else {
                res.send(500, {err:'internal_error', des:'There was an internal error matching salesforce profile'});
                next(false);
            }
        } else {
            tokenManager.createBothTokens(foundUser._id, function(err, tokens){
                if(err) {
                    res.send(409,{err: err.message});
                } else {
                    tokens.expiresIn = config.accessToken.expiration * 60;
                    res.send(200,tokens);
                }
                next(false);
            });
        }
        next(false);
    });
}

function addRoutes(server, passport){
    passport.use(salesforceStrategy);
    server.get('/auth/sf', passport.authenticate('forcedotcom'));
    server.get('/auth/sf/callback', salesforceDenyPermisionFilter, passport.authenticate('forcedotcom', { failureRedirect: '/auth/error', session: false} ), salesforceCallback);
}

module.exports = addRoutes;