var daoMng = require('../managers/dao');

function getRealms(req, res, next) {
	daoMng.getRealms(function (err, realms) {
		if (err) {
			res.send(500, {err: 'internalError', des: 'Internal server error'});
			return next(false);
		}

		res.send(200, {
			realms: realms
		});
		return next();
	});
}

function addRoutes(service) {
	service.get('/realms', getRealms);
}

module.exports = addRoutes;
