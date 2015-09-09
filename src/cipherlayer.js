var log = require('./logger/service.js');
var restify = require('restify');
var async = require('async');
var fs = require('fs');
var path = require('path');
var config = require(process.cwd() + '/config.json');
var passport = require('passport');
var clone = require('clone');
var _ = require('lodash');

var userDao = require('./managers/dao');
var redisMng = require('./managers/redis');

var checkAccessTokenParam = require('./middlewares/accessTokenParam.js');
var checkAuthHeader = require('./middlewares/authHeader.js');
var decodeToken = require('./middlewares/decodeToken.js');
var findUser = require('./middlewares/findUser.js');
var prepareOptions = require('./middlewares/prepareOptions.js');
var platformsSetUp = require('./middlewares/platformsSetUp.js');
var propagateRequest = require('./middlewares/propagateRequest.js');
var permissions = require('./middlewares/permissions.js');
var bodyParserWrapper = require('./middlewares/bodyParserWrapper.js');
var headerCors = require('./middlewares/headerCors.js');

var versionControl = require('version-control');

var pinValidation = require('./middlewares/pinValidation.js')();
var userAppVersion = require('./middlewares/userAppVersion.js')();

var server;

function startDaos(cbk){
    userDao.connect(function(){
        cbk();
    });
}

function stopDaos(cbk){
    userDao.disconnect(function(){
        cbk();
    });
}

function startRedis(cbk){
    redisMng.connect(function(){
        cbk();
    });
}

function stopRedis(cbk){
    redisMng.disconnect(function(){
        cbk();
    });
}

function startListener(publicPort, privatePort, cbk){
    server = restify.createServer({
        name: 'cipherlayer-server',
		log: log
    });

	server.on('after', function (req, res) {
		var logInfo = {
			request:{
				method: req.method,
				headers: req.headers,
				url: req.url,
				path: req._url.pathname,
				query: req._url.query,
				params: req.params,
				time: req._time
			},
			response: {
				statusCode: res.statusCode,
				hasBody: res.hasBody,
				bodySize: _.size(res.body),
				time: Date.now()
			},
			user: req.user,
			tokenInfo: req.tokenInfo
		};
		delete(logInfo.request.params.password);

		req.log.info(logInfo, "response");
	});

    server.use(headerCors);
    server.use(restify.queryParser());
    server.use(bodyParserWrapper(restify.bodyParser({maxBodySize: 1024 * 1024 * 3})));

    var versionControlOptions = clone(config.version);
    versionControlOptions.public = [
        "/auth/sf",
        "/auth/sf/*",
        "/auth/in",
        "/auth/in/*",
        "/auth/google",
        "/auth/google/*",
        "/user/activate*",
        "/heartbeat"
    ];
    server.use(versionControl(versionControlOptions));

    server.on('uncaughtException', function(req, res, route, error) {
        log.error({exception:{req:req, res:res, route:route, err:error}});
        if(!res.statusCode){
            res.send(500, {err:'internal_error', des: 'uncaught exception'});
        }
    });

    var routesPath = path.join(__dirname, './routes/');
    fs.readdirSync(routesPath).forEach(function(filename) {
        require(routesPath + filename)(server);
    });

    var platformsPath = path.join(__dirname, '/platforms/');
    fs.readdirSync(platformsPath).forEach(function(filename) {
        require(platformsPath + filename).addRoutes(server, passport);
    });

    server.get(/(.*)/,  checkAccessTokenParam, checkAuthHeader, decodeToken, permissions, findUser, pinValidation, userAppVersion, prepareOptions, platformsSetUp, propagateRequest);
    server.post(/(.*)/, checkAccessTokenParam, checkAuthHeader, decodeToken, permissions, findUser, pinValidation, userAppVersion, prepareOptions, platformsSetUp, propagateRequest);
    server.del(/(.*)/,  checkAccessTokenParam, checkAuthHeader, decodeToken, permissions, findUser, pinValidation, userAppVersion, prepareOptions, platformsSetUp, propagateRequest);
    server.put(/(.*)/,  checkAccessTokenParam, checkAuthHeader, decodeToken, permissions, findUser, pinValidation, userAppVersion, prepareOptions, platformsSetUp, propagateRequest);
    server.opts(/(.*)/, function (req, res, next) {res.send(200); next();});

    server.use(function(req, res, next){
        log.info('< ' + res.statusCode);
        next();
    });

    server.listen(publicPort, function(){
        cbk();
    });
}

function stopListener(cbk){
    server.close(function(){
        cbk();
    });
}

function start(publicPort, privatePort, cbk){
    //Validate the current config.json with the schema
    //if( !jsonValidator.isValidJSON(config, configSchema)) {
    //    return cbk({err:'invalid_config_json', des:'The config.json is not updated, check for the last version.'});
    //}

    async.series([
        startDaos,
        startRedis,
        function(done){
            startListener(publicPort, privatePort, done);
        }
    ],function(err){
        cbk(err);
    });
}

function stop(cbk){
    async.series([
        stopDaos,
        stopRedis,
        stopListener
    ],function(err){
        cbk(err);
    });
}

function getStatus(cbk){
    async.series([
        function(done){
            userDao.getStatus(done);
        },
        function(done){
            redisMng.getStatus(done);
        }
    ],function(err){
        if(err){
            return cbk(err);
        }
        cbk();
    });
}

module.exports = {
    start : start,
    stop : stop,
    getStatus: getStatus
};
