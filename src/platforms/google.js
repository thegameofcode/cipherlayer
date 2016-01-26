var async = require('async');
var GoogleStrategy = require('passport-google-oauth2').Strategy;

var log = require('../logger/service');
var tokenMng = require('../managers/token');
var daoMng = require('../managers/dao');
var userManager = require('../managers/user')();
var config = require(process.cwd() + '/config.json');

function createGoogleStrategy() {

    return new GoogleStrategy({
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackURL,
        passReqToCallback: true
    }, function(req, accessToken, refreshToken, profile, done) {
        var data = {
            accessToken: accessToken,
            refreshToken: refreshToken,
            profile: profile
        };
        done(null, data);
    });
}

function googleCallback(req, res, next) {
    var googleData = req.user;
    var profile = googleData.profile;

    daoMng.getFromUsername(profile.email, function(err, foundUser) {
        if(err){
            if(err.message == daoMng.ERROR_USER_NOT_FOUND) {
                var tokenData = {
                    accessToken: googleData.accessToken,
                    refreshToken: googleData.refreshToken
                };
                tokenMng.createAccessToken(profile.id, tokenData, function(err, token){
                    var returnProfile = {
                        name: profile.name.givenName,
                        lastname: profile.name.familyName,
                        email: profile.email,
                        google: token
                    };
                    res.send(203, returnProfile);
                    return next(false);
                });
            }

            res.send(500, {err:'internal_error', des:'There was an internal error matching google profile'});
            return next(false);
        }


        var platform = {
            platform:'google',
            accessToken: googleData.accessToken
        };

        if (googleData.refreshToken) {
            platform.refreshToken = googleData.refreshToken;
        }
        if (googleData.expiresIn) {
            platform.expiry = new Date().getTime() + googleData.expiresIn * 1000;
        }

        userManager.setPlatformData(foundUser._id, 'google', platform, function(err) {
            if (err) {
                log.error({err:err}, 'error updating google tokens into user '+foundUser._id+'');
            }
            var data = {};
            if(foundUser.roles) {
                data = {"roles": foundUser.roles};
            }

            async.series([
                function(done){
                    //Add "realms" & "capabilities"
                    daoMng.getRealms(function(err, realms){
                        if(err){
                            log.error({err:err,des:'error obtaining user realms'});
                            return done();
                        }

                        if(!realms || !realms.length) {
                            log.info({des:'there are no REALMS in DB'});
                            return done();
                        }
                        async.eachSeries(realms, function(realm, next){
                            if(!realm.allowedDomains || !realm.allowedDomains.length){
                                return next();
                            }
                            async.eachSeries(realm.allowedDomains, function(domain, more){
                                //wildcard
                                var check = domain.replace(/\*/g,'.*');
                                var match = foundUser.username.match(check);
                                if(!match || foundUser.username !== match[0]){
                                    return more();
                                }

                                if(!data.realms){
                                    data.realms = [];
                                }
                                data.realms.push(realm.name);

                                async.each(Object.keys(realm.capabilities), function(capName, added){
                                    if(!data.capabilities){
                                        data.capabilities = {};
                                    }

                                    data.capabilities[capName] = realm.capabilities[capName];
                                    added();
                                }, more);
                            }, next);
                        }, done);
                    });
                }
            ], function(){
                tokenMng.createBothTokens(foundUser._id, data , function(err, tokens) {
                    if(err) {
                        res.send(409,{err: err.message});
                    } else {
                        tokens.expiresIn = config.accessToken.expiration * 60;
                        res.send(200,tokens);
                    }
                    return next();
                });
            });
        });
    });
}

function addRoutes(server, passport){
	if(!config.google){
		return;
	}

    log.info('Adding Google routes');
    var googleStrategy = createGoogleStrategy();
	passport.use(googleStrategy);
    server.get('/auth/google', passport.authenticate('google', {scope: config.google.scope, accessType: 'offline', state: new Date().getTime() } ));
    server.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/auth/error', session: false} ), googleCallback);
}

module.exports = {
    addRoutes: addRoutes
};
