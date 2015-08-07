var debug = require('debug')('cipherlayer:service');
var config = require(process.cwd() + '/config.json');

function printTraces (req, res, next){
    var url = req.options.url;
    debug('=> ' + req.method + ' ' + url);
    next();
}

module.exports = printTraces;
