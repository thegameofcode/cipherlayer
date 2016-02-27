'use strict';

var log = require('./logger/service.js');
var restify = require('restify');
var fs = require('fs');
var path = require('path');
var config = require(process.cwd() + '/config.json');
var passport = require('passport');
var _ = require('lodash');

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

var routes = require('./public_routes/routes');

module.exports = function () {
	var service = {};

	var server;

	service.start = function (publicPort, done) {
		server = restify.createServer({
			name: 'cipherlayer-server',
			log: log
		});

		log.info('PUBLIC SERVICE starting on PORT ' + publicPort);

		server.on('after', function (req, res) {
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
			server.use(restify.CORS({
				origins: config.accessControlAllow.origins,
				credentials: true,
				headers: config.accessControlAllow.headers
			}));

			server.opts(/.*/, function (req, res, next) {
				res.header("Access-Control-Allow-Methods", req.header("Access-Control-Request-Methods"));
				res.header("Access-Control-Allow-Headers", req.header("Access-Control-Request-Headers"));
				res.send(200);
				return next();
			});
		}

		server.use(restify.queryParser());
		server.use(bodyParserWrapper(restify.bodyParser({maxBodySize: 1024 * 1024 * 3})));

		var versionControlOptions = _.clone(config.version);
		versionControlOptions.public = [
			"/auth/sf",
			"/auth/sf/*",
			"/auth/in",
			"/auth/in/*",
			"/auth/google",
			"/auth/google/*",
			"/auth/login/refreshToken*",
			"/user/activate*",
			"/heartbeat",
			"/user/email/available"
		];
		server.use(versionControl(versionControlOptions));

		server.on('uncaughtException', function (req, res, route, error) {
			log.error({exception: {req: req, res: res, route: route, err: error}});
			if (!res.statusCode) {
				res.send(500, {err: 'internal_error', des: 'uncaught exception'});
			}
		});

		routes(server);

		var platformsPath = path.join(__dirname, '/platforms/');
		fs.readdirSync(platformsPath).forEach(function (filename) {
			require(platformsPath + filename).addRoutes(server, passport);
		});

		server.get(/(.*)/, checkAccessTokenParam, checkAuthHeader, decodeToken, permissions, findUser, pinValidation, userAppVersion, prepareOptions, platformsSetUp, propagateRequest);
		server.post(/(.*)/, checkAccessTokenParam, checkAuthHeader, decodeToken, permissions, findUser, pinValidation, userAppVersion, prepareOptions, platformsSetUp, propagateRequest);
		server.del(/(.*)/, checkAccessTokenParam, checkAuthHeader, decodeToken, permissions, findUser, pinValidation, userAppVersion, prepareOptions, platformsSetUp, propagateRequest);
		server.put(/(.*)/, checkAccessTokenParam, checkAuthHeader, decodeToken, permissions, findUser, pinValidation, userAppVersion, prepareOptions, platformsSetUp, propagateRequest);

		server.listen(publicPort, function () {
			log.info('PUBLIC SERVICE listening on PORT ' + publicPort);
			done();
		});
	};

	service.stop = function (done) {
		server.close(function () {
			done();
		});
	};

	return service;
}();
