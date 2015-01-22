var config = JSON.parse(require('fs').readFileSync('./config.json','utf8'));

function checkVersion(req,res,next){
    var versionHeaderValue = req.header(config.version.header);

    var errInvalidVersion = {
        err:"invalid_version",
        des:"Must update to last application version"
    };

    if (!versionHeaderValue) {
        res.send(400, errInvalidVersion);
        return next(false);
    }

    var split = versionHeaderValue.split("/");
    if (split.length < 2) {
        res.send(400, errInvalidVersion);
        return next(false);
    }

    var platform = split[0];
    var platformAvailable = config.version.platforms[platform];
    if (platformAvailable === undefined) {
        res.send(400, errInvalidVersion);
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

module.exports = checkVersion;