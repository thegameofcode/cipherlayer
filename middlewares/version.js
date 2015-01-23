var clone = require('clone');
var extend = require('util')._extend;

var defaultSettings = {
    "header" : "x-app-version",
    "platforms" : {
        "all" : {
            "link": "http://test.link",
            "1.0" : true
        }
    }
};

var errInvalidVersion = {
    err:"invalid_version",
    des:"Must update to last application version"
};

var errNoVersionHeader = {
    err:"no_version_header",
    des:"Version header must be included"
};

var errInvalidPlatform = {
    err:"invalid_version_platform",
    des:"Version header is invalid"
};

function checkVersion(req,res,next){
    var versionHeaderValue = req.header(_settings.header);

    if (!versionHeaderValue) {

        res.send(400, errNoVersionHeader);
        return next(false);
    }

    var split = versionHeaderValue.split("/");
    if (split.length < 2) {
        res.send(400, errInvalidPlatform);
        return next(false);
    }

    var platform = split[0];
    var platformAvailable = _settings.platforms[platform];
    if (platformAvailable === undefined) {
        res.send(400, errInvalidPlatform);
        return next(false);
    }

    var platformVersion = split[1];
    var platformVersionAvailable = platformAvailable[platformVersion];
    if (platformVersionAvailable === undefined) {
        errInvalidVersion.data = platformAvailable.link;
        res.send(400, errInvalidVersion);
        return next(false);
    }

    if(platformVersionAvailable === true) {
        return next();
    }

    next(false);
}

var _settings = {};
module.exports = function(settings){
    _settings = clone(defaultSettings);
    _settings = extend(_settings, settings);

    return checkVersion;
} ;