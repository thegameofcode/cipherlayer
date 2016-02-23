var log = require('./logger/service.js');
var restify = require('restify');
var async = require('async');
var fs = require('fs');
var path = require('path');
var config = require(process.cwd() + '/config.json');
var passport = require('passport');
var _ = require('lodash');

var userDao = require('./managers/dao');
var redisMng = require('./managers/redis');

var checkAccessTokenParam = require('./middlewares/accessTokenParam');
var checkAuthHeader = require('./middlewares/authHeaderRequired');
var decodeToken = require('./middlewares/decodeToken');
var findUser = require('./middlewares/findUser');
var prepareOptions = require('./middlewares/prepareOptions');
var platformsSetUp = require('./middlewares/platformsSetUp');
var propagateRequest = require('./middlewares/propagateRequest');
var permissions = require('./middlewares/permissions');
var bodyParserWrapper = require('./middlewares/bodyParserWrapper');

var versionControl = require('version-control');

var pinValidation = require('./middlewares/pinValidation')();
var userAppVersion = require('./middlewares/userAppVersion')();

var publicServer;
var internalServer;

function startDaos(cbk) {
	userDao.connect(function () {
		cbk();
	});
}

function stopDaos(cbk) {
	userDao.disconnect(function () {
		cbk();
	});
}

function startRedis(cbk) {
	redisMng.connect(function () {
		cbk();
	});
}

function stopRedis(cbk) {
	redisMng.disconnect(function () {
		cbk();
	});
}

function startListener(publicPort, internalPort, cbk) {
	async.series([
		function (done) {
			publicServer = restify.createServer({
				name: 'cipherlayer-server',
				log: log
			});

			log.info('PUBLIC SERVICE starting on PORT ' + publicPort);

			publicServer.on('after', function (req, res) {
				var logInfo = {
					request: {
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

			if (config.accessControlAllow) {
				publicServer.use(restify.CORS({
					origins: config.accessControlAllow.origins,
					credentials: true,
					headers: config.accessControlAllow.headers
				}));

				publicServer.opts(/.*/, function (req, res, next) {
					res.header("Access-Control-Allow-Methods", req.header("Access-Control-Request-Methods"));
					res.header("Access-Control-Allow-Headers", req.header("Access-Control-Request-Headers"));
					res.send(200);
					return next();
				});
			}

			publicServer.use(restify.queryParser());
			publicServer.use(bodyParserWrapper(restify.bodyParser({maxBodySize: 1024 * 1024 * 3})));

			var versionControlOptions = _.clone(config.version);
			versionControlOptions.public = [
				"/auth/sf",
				"/auth/sf/*",
				"/auth/in",
				"/auth/in/*",
				"/auth/google",
				"/auth/google/*",
				"/user/activate*",
				"/heartbeat",
				"/user/email/available"
			];
			publicServer.use(versionControl(versionControlOptions));

			publicServer.on('uncaughtException', function (req, res, route, error) {
				log.error({exception: {req: req, res: res, route: route, err: error}});
				if (!res.statusCode) {
					res.send(500, {err: 'internal_error', des: 'uncaught exception'});
				}
			});

			var routesPath = path.join(__dirname, './public_routes/');
			fs.readdirSync(routesPath).forEach(function (filename) {
				require(routesPath + filename)(publicServer);
			});

			var platformsPath = path.join(__dirname, '/platforms/');
			fs.readdirSync(platformsPath).forEach(function (filename) {
				require(platformsPath + filename).addRoutes(publicServer, passport);
			});

			publicServer.get(/(.*)/, checkAccessTokenParam, checkAuthHeader, decodeToken, permissions, findUser, pinValidation, userAppVersion, prepareOptions, platformsSetUp, propagateRequest);
			publicServer.post(/(.*)/, checkAccessTokenParam, checkAuthHeader, decodeToken, permissions, findUser, pinValidation, userAppVersion, prepareOptions, platformsSetUp, propagateRequest);
			publicServer.del(/(.*)/, checkAccessTokenParam, checkAuthHeader, decodeToken, permissions, findUser, pinValidation, userAppVersion, prepareOptions, platformsSetUp, propagateRequest);
			publicServer.put(/(.*)/, checkAccessTokenParam, checkAuthHeader, decodeToken, permissions, findUser, pinValidation, userAppVersion, prepareOptions, platformsSetUp, propagateRequest);
			publicServer.opts(/(.*)/, function (req, res, next) {
				res.send(200);
				next();
			});

			publicServer.use(function (req, res, next) {
				log.info('< ' + res.statusCode);
				next();
			});

			publicServer.listen(publicPort, function () {
				log.info('PUBLIC SERVICE listening on PORT ' + publicPort);
				done();
			});
		},
		function (done) {
			if (!internalPort) {
				log.info('INTERNAL SERVICE not started because there is no internal_port in config');
				return done();
			}

			log.info('INTERNAL SERVICE starting on PORT ' + internalPort);

			internalServer = restify.createServer({
				name: 'cipherlayer-internal-server',
				log: log
			});

			internalServer.on('after', function (req, res) {
				var logInfo = {
					request: {
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

			internalServer.use(restify.queryParser());
			internalServer.use(bodyParserWrapper(restify.bodyParser({maxBodySize: 1024 * 1024 * 3})));

			var routesPath = path.join(__dirname, './internal_routes/');
			fs.readdirSync(routesPath).forEach(function (filename) {
				require(routesPath + filename)(internalServer);
			});

			internalServer.use(function (req, res, next) {
				log.info('< ' + res.statusCode);
				next();
			});

			internalServer.listen(internalPort, function () {
				log.info('INTERNAL SERVICE listening on PORT ' + internalPort);
				done();
			});
		}
	], cbk);
}

function stopListener(cbk) {
	async.parallel([
		function (done) {
			publicServer.close(function () {
				done();
			});
		},
		function (done) {
			if (!internalServer) {
				return done();
			}
			internalServer.close(function () {
				done();
			});
		}
	], cbk);
}

function start(publicPort, internalPort, cbk) {
	//Validate the current config.json with the schema
	//if( !jsonValidator.isValidJSON(config, configSchema)) {
	//    return cbk({err:'invalid_config_json', des:'The config.json is not updated, check for the last version.'});
	//}

	async.series([
		startDaos,
		startRedis,
		function (done) {
			startListener(publicPort, internalPort, done);
		}
	], function (err) {
		cbk(err);
	});
}

function stop(cbk) {
	async.series([
		stopDaos,
		stopRedis,
		stopListener
	], function (err) {
		cbk(err);
	});
}

function getStatus(cbk) {
	async.series([
		function (done) {
			userDao.getStatus(done);
		},
		function (done) {
			redisMng.getStatus(done);
		}
	], function (err) {
		if (err) {
			return cbk(err);
		}
		cbk();
	});
}

module.exports = {
	start: start,
	stop: stop,
	getStatus: getStatus
};
