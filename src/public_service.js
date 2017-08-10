'use strict';

const passport = require('passport');
const _ = require('lodash');
const restify = require('restify');
const fs = require('fs');
const path = require('path');
const versionControl = require('version-control');

const config = require('../config');
const log = require('./logger/service');
const checkAccessTokenParam = require('./middlewares/accessTokenParam');
const checkAuthHeader = require('./middlewares/authHeaderRequired');
const decodeToken = require('./middlewares/decodeToken');
const findUser = require('./middlewares/findUser');
const prepareOptions = require('./middlewares/prepareOptions');
const platformsSetUp = require('./middlewares/platformsSetUp');
const propagateRequest = require('./middlewares/propagateRequest');
const permissions = require('./middlewares/permissions');
const bodyParserWrapper = require('./middlewares/bodyParserWrapper');
const pinValidation = require('./middlewares/pinValidation')();
const userAppVersion = require('./middlewares/userAppVersion')();

const routes = require('./routes_public/routes');

const service = {};
let server;

module.exports = function () {

	service.start = function (publicPort, done) {
		server = restify.createServer({
			name: 'cipherlayer-server',
			log
		});

		log.info(`PUBLIC SERVICE starting on PORT ${publicPort}`);

		server.on('after', function (req, res) {
			const logInfo = {
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
			
			if (logInfo.request.params && logInfo.request.params.password) {
				delete(logInfo.request.params.password);
			}

			req.log.info(logInfo, 'response');
		});

		if (config.accessControlAllow) {
			server.use(restify.CORS({
				origins: config.accessControlAllow.origins,
				credentials: true,
				headers: config.accessControlAllow.headers
			}));

			server.opts(/.*/, function (req, res, next) {
				res.header('Access-Control-Allow-Methods', req.header('Access-Control-Request-Methods'));
				res.header('Access-Control-Allow-Headers', req.header('Access-Control-Request-Headers'));
				res.header("Access-Control-Allow-Origin", config.accessControlAllow.origins);
				res.send(200);
				return next();
			});
		}

		server.use(restify.queryParser());
		server.use(bodyParserWrapper(restify.bodyParser({maxBodySize: 1024 * 1024 * 3})));

		const versionControlOptions = _.clone(config.version);
		versionControlOptions.public = [
			'/auth/sf',
			'/auth/sf/*',
			'/auth/login/refreshToken*',
			'/user/activate*',
			'/heartbeat',
			'/user/email/available'
		];
		if (config.version.public) {
			versionControlOptions.public = versionControlOptions.public.concat(config.version.public);
		}
		server.use(versionControl(versionControlOptions));

		server.on('uncaughtException', function (req, res, route, error) {
			log.error({exception: {req, res, route, err: error}}, 'uncaught exception');
			if (!res.statusCode) {
				res.send(500, {err: 'internal_error', des: 'uncaught exception'});
			}
		});

		routes(server);

		const platformsPath = path.join(__dirname, '/platforms/');
		fs.readdirSync(platformsPath).forEach(function (filename) {
			require(platformsPath + filename).addRoutes(server, passport);
		});

		const allMiddlewares = [
			checkAccessTokenParam,
			checkAuthHeader,
			decodeToken,
			permissions,
			findUser,
			pinValidation,
			userAppVersion,
			prepareOptions,
			platformsSetUp,
			propagateRequest
		];

		if (config.publicEndpoints) {
			config.publicEndpoints.forEach(publicEndpoint => {
				publicEndpoint.replace('*','.*');
				const regEx = new RegExp(publicEndpoint);
				server.get(regEx, prepareOptions,propagateRequest);
				server.post(regEx, prepareOptions,propagateRequest);
			});
		}

		server.get(/(.*)/, allMiddlewares);
		server.post(/(.*)/, allMiddlewares);
		server.del(/(.*)/, allMiddlewares);
		server.put(/(.*)/, allMiddlewares);

		server.listen(publicPort, function () {
			log.info(`PUBLIC SERVICE listening on PORT ${publicPort}`);
			return done();
		});
	};

	service.stop = function (done) {
		server.close(function () {
			return done();
		});
	};

	return service;
}();
