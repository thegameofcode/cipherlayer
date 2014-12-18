var debug = require('debug')('cipherlayer:platforms:salesforce');
var async = require('async');

var userDao = require('../dao');
var userManager = require('../managers/user');
var tokenManager = require('../managers/token');
var countrycodes = require('../countrycodes');
var fileStoreMng = require('../managers/file_store');

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

function prepareSession(accessToken, refreshToken, profile, done){
    debug('user '+ profile.id +' logged in using salesforce');
    async.series(
        [
            function uploadAvatar(done){
                if(!profile._raw || !profile._raw.photos || !profile._raw.photos.picture
                    || !config.aws || !config.aws.buckets || !config.aws.buckets.avatars) {
                    return done();
                }

                var oauthToken = "?oauth_token=" + accessToken.params.access_token;

                var avatarPath = profile._raw.photos.picture + oauthToken;
                //TODO change this to use 'path' framework
                var idPos = profile.id.lastIndexOf('/') ? profile.id.lastIndexOf('/') + 1 : 0;
                var name = profile.id.substring(idPos) + '.jpg';

                fileStoreMng.uploadAvatarToAWS(avatarPath, name, function(err, avatarUrl){
                    if(err){
                        debug('Error uploading a profile picture to AWS');
                    } else {
                        profile.avatar = avatarUrl;
                    }
                    done();
                });
            },
            function returnSessionData(done){
                var data = {
                    accessToken: accessToken,
                    refreshToken: refreshToken,
                    profile: profile,
                    expiry: new Date().getTime() + config.salesforce.expiration * 60 * 1000
                };
                done(data);
            }
        ], function(data){
            done(null, data);
        }
    );

}
var salesforceStrategy = new forcedotcomStrategy(salesforceSettings, prepareSession);

function salesforceDenyPermisionFilter(req, res, next){
    var errorCode = req.query.error;

    var errorDescription = req.query.error_description;
    if(!errorCode || !errorDescription) {
        return next();
    } else {
        res.send(401, {err:'access_denied', des: 'end-user denied authorization'});
        next(false);
    }
}

function salesforceCallback(req, res, next){
    var sfData = req.user;
    var profile = sfData.profile;

    userDao.getFromUsername(profile._raw.email, function(err, foundUser){
        if(err){
            if(err.message == userDao.ERROR_USER_NOT_FOUND){
                var tokenData = {
                    accessToken:sfData.accessToken,
                    refreshToken:sfData.refreshToken
                };
                tokenManager.createAccessToken(profile.id, tokenData, function(err, token){
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

            var platform = {
                platform:'sf',
                accessToken: sfData.accessToken,
                refreshToken: sfData.refreshToken,
                expiry: new Date().getTime() + sfData.expiresIn * 1000
            };

            //TODO check if setPlatformData and createBothTokens call can be made in parallel
            userManager.setPlatformData(foundUser._id, 'sf', platform, function(err){
                if(err){
                    debug('error updating sf tokens into user '+foundUser._id+':' + err);
                    //TODO check if it's ok to ignore this error
                }
                tokenManager.createBothTokens(foundUser._id, function(err, tokens){
                    if(err) {
                        res.send(409,{err: err.message});
                    } else {
                        tokens.expiresIn = config.accessToken.expiration * 60;
                        res.send(200,tokens);
                    }
                    next(false);
                });
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

module.exports = {
    addRoutes: addRoutes,
    prepareSession: prepareSession
};
