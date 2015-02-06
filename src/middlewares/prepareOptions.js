var config = JSON.parse(require('fs').readFileSync('config.json','utf8'));
var fs = require('fs');

function prepareOptions (req, res, next){
    var options = {
        url: 'http://'+ config.private_server + ':' + config.private_port + req.url,
        headers: {
            'Content-Type': req.header('Content-Type'),
            'x-user-id': req.tokenInfo.userId,
            'Host': req.headers.host,
            'X-Real-IP': req.connection.remoteAddress,
            'X-Forwarded-For': req.header('X-Forwarded-For') || req.connection.remoteAddress
        },
        method: req.method,
        followRedirect: false
    };

    // TODO pass all file data correctly
    if(req.header('Content-Type') && req.header('Content-Type').indexOf('multipart/form-data') > -1){
        var formData = {};
        var files = req.files;
        for(var fileKey in files){
            var file = files[fileKey];
            formData[fileKey] = fs.createReadStream(file.path);
        }
        options.formData = formData;
    } else {
        options.headers['Content-Type'] = req.header('Content-Type');
        options.body = JSON.stringify(req.body);
    }
    req.options = options;
    return next();
}

module.exports = prepareOptions;
