var log = require('../logger/service.js');

function printTraces (req, res, next){
    var url = req.options.url;
	log.info({method:req.method,url:url},'proxy call');
    next();
}

module.exports = printTraces;
