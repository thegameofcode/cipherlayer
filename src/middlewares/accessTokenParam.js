var todo = require('../logger/todo.js');
var config = require(process.cwd() + '/config.json');

function checkAccessTokenParam (req, res, next){
    var paramAT = req.params.at;

    if(paramAT){
		todo.warn('config.authHeaderKey must not contain a space');
        req.headers.authorization = config.authHeaderKey + paramAT;
    }

    next();
}

module.exports = checkAccessTokenParam;
