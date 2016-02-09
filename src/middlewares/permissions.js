var config = require(process.cwd() + '/config.json');
var _ = require('lodash');

function checkPermissions(req, res, next) {
	if (!config.endpoints) {
		return next();
	}

	var roles = req.tokenInfo.data.roles || ['user'];
	var path = req._url.pathname;
	var method = req.method;

	var hasPermissions = false;

	for (var i = 0; i < config.endpoints.length; i++) {
		var matchPath = path.match(new RegExp(config.endpoints[i].path, 'g'));
		var matchMethod = _.includes(config.endpoints[i].methods, method);

		if (matchPath && matchMethod) {
			var matchRole;
			for (var j = 0; j < roles.length; j++) {
				matchRole = _.includes(config.endpoints[i].roles, roles[j]);
				if (matchRole) {
					hasPermissions = true;
					break;
				}
			}
			break;
		}
	}

	if (!hasPermissions) {
		res.send(401, {err: 'unauthorized'});
		return next(false);
	}
	return next();
}

module.exports = checkPermissions;
