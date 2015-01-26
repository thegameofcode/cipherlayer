var debug = require('debug')('cipherlayer:service');
var config = JSON.parse(require('fs').readFileSync('config.json','utf8'));

function printTraces (req, res, next){
    var url = req.options.url;
    debug('=> ' + req.method + ' ' + url);
    next();
}

module.exports = printTraces;
